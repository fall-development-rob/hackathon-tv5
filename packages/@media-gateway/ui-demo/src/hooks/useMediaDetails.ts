import { useState, useEffect, useCallback, useRef } from "react";

export interface MediaDetails {
  id: string;
  title: string;
  mediaType: "movie" | "tv";
  year: number;
  genre: string[];
  rating: number;
  description: string;
  posterPath: string | null;
  popularity: number;
  runtime?: number;
  director?: string;
  cast?: string[];
  seasons?: number;
  episodes?: number;
  releaseDate?: string;
  language?: string;
  country?: string;
  awards?: string[];
  backdropPath?: string | null;
  trailerUrl?: string | null;
}

export interface UseMediaDetailsResult {
  details: MediaDetails | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface UseMediaDetailsConfig {
  contentId: string | null;
  mediaType: "movie" | "tv" | null;
  enabled?: boolean;
}

const API_BASE = "http://localhost:3001/v1";

// In-memory cache for media details
const detailsCache = new Map<
  string,
  { data: MediaDetails; timestamp: number }
>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCacheKey(contentId: string, mediaType: string): string {
  return `${mediaType}:${contentId}`;
}

function getCachedDetails(
  contentId: string,
  mediaType: string,
): MediaDetails | null {
  const key = getCacheKey(contentId, mediaType);
  const cached = detailsCache.get(key);

  if (!cached) return null;

  const isExpired = Date.now() - cached.timestamp > CACHE_DURATION;
  if (isExpired) {
    detailsCache.delete(key);
    return null;
  }

  return cached.data;
}

function setCachedDetails(
  contentId: string,
  mediaType: string,
  data: MediaDetails,
): void {
  const key = getCacheKey(contentId, mediaType);
  detailsCache.set(key, { data, timestamp: Date.now() });
}

async function fetchMediaDetails(
  contentId: string,
  mediaType: "movie" | "tv",
): Promise<MediaDetails> {
  // Check cache first
  const cached = getCachedDetails(contentId, mediaType);
  if (cached) {
    return cached;
  }

  const res = await fetch(
    `${API_BASE}/content/${contentId}?mediaType=${mediaType}`,
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({
      message: `Failed to fetch ${mediaType} details`,
    }));
    throw new Error(error.message || `Failed to fetch ${mediaType} details`);
  }

  const data = await res.json();

  // Cache the result
  setCachedDetails(contentId, mediaType, data);

  return data;
}

export function useMediaDetails(
  config: UseMediaDetailsConfig,
): UseMediaDetailsResult {
  const { contentId, mediaType, enabled = true } = config;

  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track the current request to avoid race conditions
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchedRef = useRef<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!contentId || !mediaType || !enabled) {
      setDetails(null);
      setError(null);
      return;
    }

    const fetchKey = `${mediaType}:${contentId}`;

    // Don't refetch if we just fetched this
    if (lastFetchedRef.current === fetchKey && details) {
      return;
    }

    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    lastFetchedRef.current = fetchKey;

    setLoading(true);
    setError(null);

    try {
      const data = await fetchMediaDetails(contentId, mediaType);

      // Only update if this request wasn't aborted
      if (!abortControllerRef.current.signal.aborted) {
        setDetails(data);
      }
    } catch (e) {
      if (!abortControllerRef.current.signal.aborted) {
        const error = e as Error;
        setError(error);
        setDetails(null);
      }
    } finally {
      if (!abortControllerRef.current.signal.aborted) {
        setLoading(false);
      }
    }
  }, [contentId, mediaType, enabled, details]);

  const refetch = useCallback(async () => {
    if (!contentId || !mediaType) return;

    // Clear cache for this item to force refetch
    const key = getCacheKey(contentId, mediaType);
    detailsCache.delete(key);
    lastFetchedRef.current = null;

    await fetchDetails();
  }, [contentId, mediaType, fetchDetails]);

  useEffect(() => {
    fetchDetails();

    // Cleanup on unmount or when dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchDetails]);

  return {
    details,
    loading,
    error,
    refetch,
  };
}

// Export cache management utilities for testing or manual cache control
export const cacheUtils = {
  clear: () => detailsCache.clear(),
  remove: (contentId: string, mediaType: string) => {
    const key = getCacheKey(contentId, mediaType);
    detailsCache.delete(key);
  },
  size: () => detailsCache.size,
};

import { useState, useEffect, useCallback, useRef } from "react";
import { api, Recommendation } from "../lib/api";

export interface UseTrendingResult {
  trending: Recommendation[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export interface UseTrendingConfig {
  autoFetch?: boolean;
  refreshInterval?: number;
  mediaType?: "movie" | "tv" | "all";
}

export function useTrending(config: UseTrendingConfig = {}): UseTrendingResult {
  const { autoFetch = true, refreshInterval, mediaType = "all" } = config;

  const [trending, setTrending] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track abort controller for cancelling requests
  const abortControllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const data = await api.trending();

      // Only update if request wasn't aborted
      if (!abortControllerRef.current.signal.aborted) {
        let filteredTrending = data.recommendations || [];

        // Apply mediaType filter if specified
        if (mediaType !== "all") {
          filteredTrending = filteredTrending.filter(
            (item) => item.mediaType === mediaType,
          );
        }

        setTrending(filteredTrending);
      }
    } catch (e) {
      // Only update error if request wasn't aborted
      if (!abortControllerRef.current.signal.aborted) {
        const error = e as Error;

        // Provide more specific error messages
        if (error.message.includes("fetch")) {
          setError(new Error("Network error. Please check your connection."));
        } else if (error.message.includes("timeout")) {
          setError(new Error("Request timed out. Please try again."));
        } else {
          setError(error);
        }

        setTrending([]);
      }
    } finally {
      // Only update loading if request wasn't aborted
      if (!abortControllerRef.current.signal.aborted) {
        setLoading(false);
      }
    }
  }, [mediaType]);

  useEffect(() => {
    if (autoFetch) {
      refresh();
    }

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [autoFetch, refresh]);

  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const timer = setInterval(() => {
        refresh();
      }, refreshInterval);

      return () => {
        clearInterval(timer);
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }
  }, [refreshInterval, refresh]);

  return {
    trending,
    loading,
    error,
    refresh,
  };
}

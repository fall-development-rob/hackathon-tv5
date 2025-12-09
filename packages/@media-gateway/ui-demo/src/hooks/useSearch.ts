import { useState, useEffect, useCallback } from "react";
import { api, SearchResult, SearchOptions } from "../lib/api";

export interface UseSearchResult {
  query: string;
  setQuery: (query: string) => void;
  results: SearchResult[];
  loading: boolean;
  error: Error | null;
  search: (q: string, options?: SearchOptions) => Promise<void>;
  clear: () => void;
}

export function useSearch(debounceMs = 300): UseSearchResult {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const search = useCallback(async (q: string, options?: SearchOptions) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.search(q, options);
      setResults(data.results || []);
    } catch (e) {
      setError(e as Error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
    setError(null);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      search(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs, search]);

  return { query, setQuery, results, loading, error, search, clear };
}

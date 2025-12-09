import { useState, useEffect, useCallback } from "react";
import { api, Recommendation, RecommendationOptions } from "../lib/api";

export interface UseRecommendationsResult {
  recommendations: Recommendation[];
  loading: boolean;
  error: Error | null;
  refresh: (options?: RecommendationOptions) => Promise<void>;
  setMood: (mood: string) => void;
  setContext: (context: string) => void;
}

export interface UseRecommendationsConfig {
  userId: string;
  initialMood?: string;
  initialContext?: string;
  limit?: number;
  autoFetch?: boolean;
}

export function useRecommendations(
  config: UseRecommendationsConfig,
): UseRecommendationsResult {
  const {
    userId,
    initialMood,
    initialContext,
    limit = 10,
    autoFetch = true,
  } = config;

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [mood, setMood] = useState(initialMood);
  const [context, setContext] = useState(initialContext);

  const refresh = useCallback(
    async (options?: RecommendationOptions) => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.recommendations(userId, {
          mood: options?.mood ?? mood,
          context: options?.context ?? context,
          limit: options?.limit ?? limit,
        });
        setRecommendations(data.recommendations || []);
      } catch (e) {
        setError(e as Error);
        setRecommendations([]);
      } finally {
        setLoading(false);
      }
    },
    [userId, mood, context, limit],
  );

  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [autoFetch, refresh]);

  return {
    recommendations,
    loading,
    error,
    refresh,
    setMood,
    setContext,
  };
}

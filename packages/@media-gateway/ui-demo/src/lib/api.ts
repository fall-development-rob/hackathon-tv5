const API_BASE = "http://localhost:3001/v1";

export interface SearchResult {
  id: string;
  title: string;
  mediaType: "movie" | "tv";
  year: number;
  genre: string[];
  rating: number;
  description: string;
  posterPath: string | null;
  popularity: number;
  availability: PlatformAvailability[];
}

export interface ContentDetails extends SearchResult {
  runtime?: number;
  cast?: string[];
  director?: string;
  tagline?: string;
  releaseDate?: string;
  status?: string;
  budget?: number;
  revenue?: number;
  originalLanguage?: string;
  productionCompanies?: string[];
  seasons?: number;
  episodes?: number;
  creators?: string[];
  network?: string;
}

export interface PlatformAvailability {
  platform: string;
  region: string;
  type: "subscription" | "rent" | "buy" | "free";
  price?: { amount: number; currency: string };
  deepLink: string;
}

export interface Recommendation extends SearchResult {
  matchScore: number;
  reasoning: string[];
}

export interface SearchOptions {
  mediaType?: "movie" | "tv";
  limit?: number;
  genre?: string;
}

export interface RecommendationOptions {
  mood?: string;
  context?: string;
  limit?: number;
  mediaType?: "movie" | "tv";
}

export interface TrendingOptions {
  mediaType?: "movie" | "tv";
  limit?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

export interface RecommendationResponse {
  recommendations: Recommendation[];
  total: number;
  userId: string;
}

export interface AvailabilityResponse {
  contentId: string;
  availability: PlatformAvailability[];
  region: string;
}

export interface ContentDetailsResponse {
  content: ContentDetails;
}

export interface SimilarContentResponse {
  results: SearchResult[];
  total: number;
  sourceId: string;
}

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown,
  ) {
    super(message);
    this.name = "APIError";
  }
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, options);

    if (!res.ok) {
      const error = await res.json().catch(() => ({
        message: `HTTP ${res.status}: ${res.statusText}`,
      }));
      throw new APIError(
        error.message || `Request failed with status ${res.status}`,
        res.status,
        error,
      );
    }

    return res.json();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new APIError(error.message);
    }
    throw new APIError("Unknown error occurred");
  }
}

export const api = {
  /**
   * Search for movies and TV shows
   */
  search: async (
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResponse> => {
    const params = new URLSearchParams({ q: query });
    if (options?.mediaType) params.set("mediaType", options.mediaType);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.genre) params.set("genre", options.genre);

    return fetchJSON<SearchResponse>(`${API_BASE}/search?${params}`);
  },

  /**
   * Get personalized recommendations
   */
  recommendations: async (
    userId: string,
    options?: RecommendationOptions,
  ): Promise<RecommendationResponse> => {
    const params = new URLSearchParams({ userId });
    if (options?.mood) params.set("mood", options.mood);
    if (options?.context) params.set("context", options.context);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.mediaType) params.set("mediaType", options.mediaType);

    return fetchJSON<RecommendationResponse>(
      `${API_BASE}/recommendations?${params}`,
    );
  },

  /**
   * Get detailed information about a specific movie or TV show
   */
  getDetails: async (
    mediaType: "movie" | "tv",
    id: string,
  ): Promise<ContentDetailsResponse> => {
    return fetchJSON<ContentDetailsResponse>(
      `${API_BASE}/media/${mediaType}/${id}`,
    );
  },

  /**
   * Get availability information for content across platforms
   */
  availability: async (
    contentId: string,
    region = "US",
  ): Promise<AvailabilityResponse> => {
    return fetchJSON<AvailabilityResponse>(
      `${API_BASE}/availability/${contentId}?region=${region}`,
    );
  },

  /**
   * Get trending content, optionally filtered by media type
   */
  trending: async (
    options?: TrendingOptions,
  ): Promise<RecommendationResponse> => {
    const params = new URLSearchParams({
      userId: "trending-user",
      limit: String(options?.limit || 20),
    });

    if (options?.mediaType) {
      params.set("mediaType", options.mediaType);
    }

    return fetchJSON<RecommendationResponse>(
      `${API_BASE}/recommendations?${params}`,
    );
  },

  /**
   * Search content by genre
   */
  searchByGenre: async (
    genre: string,
    options?: SearchOptions,
  ): Promise<SearchResponse> => {
    return api.search("", { ...options, genre });
  },

  /**
   * Get similar content based on a given movie or TV show
   */
  getSimilar: async (
    mediaType: "movie" | "tv",
    id: string,
    limit = 10,
  ): Promise<SimilarContentResponse> => {
    const params = new URLSearchParams({
      limit: String(limit),
    });

    return fetchJSON<SimilarContentResponse>(
      `${API_BASE}/media/${mediaType}/${id}/similar?${params}`,
    );
  },

  /**
   * Get content trending in a specific genre
   */
  trendingByGenre: async (
    genre: string,
    options?: TrendingOptions,
  ): Promise<RecommendationResponse> => {
    const params = new URLSearchParams({
      userId: "trending-user",
      limit: String(options?.limit || 20),
    });

    if (options?.mediaType) {
      params.set("mediaType", options.mediaType);
    }

    params.set("genre", genre);

    return fetchJSON<RecommendationResponse>(
      `${API_BASE}/recommendations?${params}`,
    );
  },
};

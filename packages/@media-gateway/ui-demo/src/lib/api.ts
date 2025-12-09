const API_BASE = "http://localhost:3001/v1";

// Default headers that will be used for all requests
const defaultHeaders: Record<string, string> = {
  "Content-Type": "application/json",
};

/**
 * Set the authentication token for API requests
 * @param token - The JWT token or null to clear
 */
export function setAuthToken(token: string | null): void {
  if (token) {
    defaultHeaders["Authorization"] = `Bearer ${token}`;
  } else {
    delete defaultHeaders["Authorization"];
  }
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface UserResponse {
  user: User;
}

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

export interface MyListItem {
  id: string;
  title: string;
  mediaType: "movie" | "tv";
  posterPath: string | null;
  addedAt: number;
}

export interface MyListItemInput {
  id: string;
  title: string;
  mediaType: "movie" | "tv";
  posterPath: string | null;
}

export interface MyListResponse {
  items: MyListItem[];
  total: number;
}

export interface MyListItemResponse {
  item: MyListItem;
}

export interface MyListCheckResponse {
  inList: boolean;
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
    // Merge default headers with provided headers
    const headers = {
      ...defaultHeaders,
      ...(options?.headers || {}),
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

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

/**
 * Register a new user account
 */
export async function authRegister(
  email: string,
  password: string,
  name: string,
): Promise<AuthResponse> {
  return fetchJSON<AuthResponse>(`${API_BASE}/auth/register`, {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

/**
 * Login with email and password
 */
export async function authLogin(
  email: string,
  password: string,
): Promise<AuthResponse> {
  return fetchJSON<AuthResponse>(`${API_BASE}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Logout the current user
 */
export async function authLogout(): Promise<void> {
  return fetchJSON<void>(`${API_BASE}/auth/logout`, {
    method: "POST",
  });
}

/**
 * Get the current authenticated user
 */
export async function authMe(): Promise<UserResponse> {
  return fetchJSON<UserResponse>(`${API_BASE}/auth/me`);
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

  /**
   * My List API Operations
   */
  myList: {
    /**
     * Fetch user's My List
     */
    fetch: async (token: string): Promise<MyListResponse> => {
      return fetchJSON<MyListResponse>(`${API_BASE}/my-list`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },

    /**
     * Add item to My List
     */
    add: async (
      token: string,
      item: MyListItemInput,
    ): Promise<MyListItemResponse> => {
      return fetchJSON<MyListItemResponse>(`${API_BASE}/my-list`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(item),
      });
    },

    /**
     * Remove item from My List
     */
    remove: async (token: string, contentId: string): Promise<void> => {
      return fetchJSON<void>(`${API_BASE}/my-list/${contentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },

    /**
     * Check if item is in My List
     */
    check: async (
      token: string,
      contentId: string,
    ): Promise<MyListCheckResponse> => {
      return fetchJSON<MyListCheckResponse>(
        `${API_BASE}/my-list/${contentId}/check`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
    },
  },
};

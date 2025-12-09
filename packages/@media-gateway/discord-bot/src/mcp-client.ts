/**
 * MCP Client for Media Gateway
 * Provides a high-level interface to interact with the Media Gateway REST API
 * using Anthropic's Claude for natural language processing
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  SearchOptions,
  RecommendationOptions,
  AvailabilityInfo,
  MediaDetails,
  TrendingItem,
  SearchResult,
} from "./types";

/**
 * Configuration for the Media Gateway MCP client
 */
export interface MediaGatewayConfig {
  apiBaseUrl?: string;
  apiKey?: string;
  timeout?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<MediaGatewayConfig> = {
  apiBaseUrl: "http://localhost:3001/v1",
  apiKey: "",
  timeout: 30000,
};

/**
 * Media Gateway Agent
 * Connects to the Media Gateway REST API and provides methods for content discovery,
 * recommendations, and availability checking
 */
export class MediaGatewayAgent {
  private anthropic: Anthropic;
  private config: Required<MediaGatewayConfig>;

  constructor(anthropic: Anthropic, config: MediaGatewayConfig = {}) {
    this.anthropic = anthropic;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Search for movies and TV shows
   * @param query - Search query string
   * @param options - Optional search filters
   * @returns Array of search results
   */
  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    const url = new URL(`${this.config.apiBaseUrl}/search`);
    url.searchParams.append("q", query);

    if (options.type) url.searchParams.append("type", options.type);
    if (options.genre) url.searchParams.append("genre", options.genre);
    if (options.year) url.searchParams.append("year", options.year.toString());
    if (options.minRating)
      url.searchParams.append("minRating", options.minRating.toString());
    if (options.limit)
      url.searchParams.append("limit", options.limit.toString());
    if (options.offset)
      url.searchParams.append("offset", options.offset.toString());

    const response = await this.fetchWithTimeout(url.toString());
    const data: any = await response.json();

    return (data.results as SearchResult[]) || [];
  }

  /**
   * Get personalized recommendations for a user
   * @param userId - User ID for personalized recommendations
   * @param options - Optional recommendation filters
   * @returns Array of recommended content
   */
  async getRecommendations(
    userId: string,
    options: RecommendationOptions = {},
  ): Promise<SearchResult[]> {
    const url = new URL(`${this.config.apiBaseUrl}/recommendations/${userId}`);

    if (options.limit)
      url.searchParams.append("limit", options.limit.toString());
    if (options.genre) url.searchParams.append("genre", options.genre);
    if (options.excludeWatched)
      url.searchParams.append(
        "excludeWatched",
        options.excludeWatched.toString(),
      );

    const response = await this.fetchWithTimeout(url.toString());
    const data: any = await response.json();

    return (data.recommendations as SearchResult[]) || [];
  }

  /**
   * Get trending content
   * @param limit - Maximum number of trending items to return
   * @returns Array of trending content
   */
  async getTrending(limit: number = 10): Promise<TrendingItem[]> {
    const url = new URL(`${this.config.apiBaseUrl}/trending`);
    url.searchParams.append("limit", limit.toString());

    const response = await this.fetchWithTimeout(url.toString());
    const data: any = await response.json();

    return (data.trending as TrendingItem[]) || [];
  }

  /**
   * Check availability of content in a specific region
   * @param contentId - Content ID to check
   * @param region - Region code (e.g., 'US', 'UK')
   * @returns Availability information
   */
  async getAvailability(
    contentId: string,
    region: string = "US",
  ): Promise<AvailabilityInfo> {
    const url = new URL(`${this.config.apiBaseUrl}/availability/${contentId}`);
    url.searchParams.append("region", region);

    const response = await this.fetchWithTimeout(url.toString());
    const data: any = await response.json();

    return data as AvailabilityInfo;
  }

  /**
   * Get detailed information about a specific movie or TV show
   * @param mediaType - Type of media ('movie' or 'tv')
   * @param id - Media ID
   * @returns Detailed media information
   */
  async getDetails(
    mediaType: "movie" | "tv",
    id: string,
  ): Promise<MediaDetails> {
    const url = `${this.config.apiBaseUrl}/${mediaType}/${id}`;

    const response = await this.fetchWithTimeout(url);
    const data: any = await response.json();

    return data as MediaDetails;
  }

  /**
   * Helper method to fetch with timeout
   * @param url - URL to fetch
   * @returns Response object
   */
  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.config.apiKey) {
        headers["Authorization"] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(url, {
        signal: controller.signal,
        headers,
      });

      if (!response.ok) {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`,
        );
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get the Anthropic client instance
   * @returns Anthropic client
   */
  getAnthropicClient(): Anthropic {
    return this.anthropic;
  }

  /**
   * Get the configuration
   * @returns Current configuration
   */
  getConfig(): Required<MediaGatewayConfig> {
    return { ...this.config };
  }
}

/**
 * Create a new Media Gateway Agent instance
 * @param apiKey - Anthropic API key
 * @param config - Optional Media Gateway configuration
 * @returns MediaGatewayAgent instance
 */
export function createMediaGatewayAgent(
  apiKey: string,
  config: MediaGatewayConfig = {},
): MediaGatewayAgent {
  const anthropic = new Anthropic({ apiKey });
  return new MediaGatewayAgent(anthropic, config);
}

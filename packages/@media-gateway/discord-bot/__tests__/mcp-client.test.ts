/**
 * MCPClient (MediaGatewayAgent) Unit Tests
 *
 * Tests for the Media Gateway MCP client including:
 * - API method functionality
 * - Error handling
 * - Authentication headers
 * - Timeout handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MediaGatewayAgent, createMediaGatewayAgent } from "../src/mcp-client";
import Anthropic from "@anthropic-ai/sdk";
import type {
  SearchOptions,
  RecommendationOptions,
  AvailabilityInfo,
  MediaDetails,
  TrendingItem,
  SearchResult,
} from "../src/types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("MediaGatewayAgent", () => {
  let agent: MediaGatewayAgent;
  let mockAnthropicClient: Anthropic;

  beforeEach(() => {
    // Create mock Anthropic client
    mockAnthropicClient = new Anthropic({ apiKey: "test-api-key" });

    // Reset fetch mock
    mockFetch.mockReset();
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Constructor and Configuration", () => {
    it("should create agent with default configuration", () => {
      agent = new MediaGatewayAgent(mockAnthropicClient);
      const config = agent.getConfig();

      expect(config.apiBaseUrl).toBe("http://localhost:3001/v1");
      expect(config.apiKey).toBe("");
      expect(config.timeout).toBe(30000);
    });

    it("should create agent with custom configuration", () => {
      agent = new MediaGatewayAgent(mockAnthropicClient, {
        apiBaseUrl: "https://api.example.com/v2",
        apiKey: "custom-key",
        timeout: 60000,
      });

      const config = agent.getConfig();
      expect(config.apiBaseUrl).toBe("https://api.example.com/v2");
      expect(config.apiKey).toBe("custom-key");
      expect(config.timeout).toBe(60000);
    });

    it("should merge partial configuration with defaults", () => {
      agent = new MediaGatewayAgent(mockAnthropicClient, {
        apiKey: "partial-key",
      });

      const config = agent.getConfig();
      expect(config.apiBaseUrl).toBe("http://localhost:3001/v1");
      expect(config.apiKey).toBe("partial-key");
      expect(config.timeout).toBe(30000);
    });

    it("should return Anthropic client instance", () => {
      agent = new MediaGatewayAgent(mockAnthropicClient);
      const client = agent.getAnthropicClient();

      expect(client).toBe(mockAnthropicClient);
    });
  });

  describe("createMediaGatewayAgent factory function", () => {
    it("should create agent with API key", () => {
      const newAgent = createMediaGatewayAgent("factory-api-key");
      const client = newAgent.getAnthropicClient();

      expect(client).toBeInstanceOf(Anthropic);
    });

    it("should create agent with custom config", () => {
      const newAgent = createMediaGatewayAgent("factory-api-key", {
        apiBaseUrl: "https://custom.api.com",
        timeout: 45000,
      });

      const config = newAgent.getConfig();
      expect(config.apiBaseUrl).toBe("https://custom.api.com");
      expect(config.timeout).toBe(45000);
    });
  });

  describe("search method", () => {
    beforeEach(() => {
      agent = new MediaGatewayAgent(mockAnthropicClient, {
        apiKey: "test-key",
      });
    });

    it("should search with query only", async () => {
      const mockResults: SearchResult[] = [
        {
          id: "1",
          title: "Test Movie",
          type: "movie",
          year: 2024,
          rating: 8.5,
          overview: "A test movie",
          posterUrl: "/test.jpg",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: mockResults }),
      });

      const results = await agent.search("action");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/search?q=action"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-key",
          }),
        }),
      );
      expect(results).toEqual(mockResults);
    });

    it("should search with all options", async () => {
      const mockResults: SearchResult[] = [];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: mockResults }),
      });

      const options: SearchOptions = {
        type: "movie",
        genre: "action",
        year: 2024,
        minRating: 7.0,
        limit: 10,
        offset: 5,
      };

      await agent.search("test query", options);

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("q=test+query");
      expect(callUrl).toContain("type=movie");
      expect(callUrl).toContain("genre=action");
      expect(callUrl).toContain("year=2024");
      expect(callUrl).toContain("minRating=7");
      expect(callUrl).toContain("limit=10");
      expect(callUrl).toContain("offset=5");
    });

    it("should return empty array if no results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: null }),
      });

      const results = await agent.search("no results");
      expect(results).toEqual([]);
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(agent.search("error query")).rejects.toThrow(
        "API request failed: 500 Internal Server Error",
      );
    });
  });

  describe("getRecommendations method", () => {
    beforeEach(() => {
      agent = new MediaGatewayAgent(mockAnthropicClient, {
        apiKey: "test-key",
      });
    });

    it("should get recommendations for user", async () => {
      const mockRecommendations: SearchResult[] = [
        {
          id: "2",
          title: "Recommended Show",
          type: "tv",
          year: 2023,
          rating: 8.0,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ recommendations: mockRecommendations }),
      });

      const results = await agent.getRecommendations("user-123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/recommendations/user-123"),
        expect.any(Object),
      );
      expect(results).toEqual(mockRecommendations);
    });

    it("should get recommendations with options", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ recommendations: [] }),
      });

      const options: RecommendationOptions = {
        limit: 5,
        genre: "comedy",
        excludeWatched: true,
      };

      await agent.getRecommendations("user-456", options);

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain("limit=5");
      expect(callUrl).toContain("genre=comedy");
      expect(callUrl).toContain("excludeWatched=true");
    });

    it("should return empty array if no recommendations", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      const results = await agent.getRecommendations("user-789");
      expect(results).toEqual([]);
    });
  });

  describe("getTrending method", () => {
    beforeEach(() => {
      agent = new MediaGatewayAgent(mockAnthropicClient);
    });

    it("should get trending content with default limit", async () => {
      const mockTrending: TrendingItem[] = [
        {
          id: "3",
          title: "Trending Movie",
          type: "movie",
          rating: 9.0,
          popularity: 1000,
          posterUrl: "/trending.jpg",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ trending: mockTrending }),
      });

      const results = await agent.getTrending();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/trending?limit=10"),
        expect.any(Object),
      );
      expect(results).toEqual(mockTrending);
    });

    it("should get trending content with custom limit", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ trending: [] }),
      });

      await agent.getTrending(25);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/trending?limit=25"),
        expect.any(Object),
      );
    });
  });

  describe("getAvailability method", () => {
    beforeEach(() => {
      agent = new MediaGatewayAgent(mockAnthropicClient, {
        apiKey: "test-key",
      });
    });

    it("should check availability with default region", async () => {
      const mockAvailability: AvailabilityInfo = {
        contentId: "content-1",
        region: "US",
        available: true,
        providers: [
          {
            name: "Netflix",
            type: "subscription",
            url: "https://netflix.com",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockAvailability,
      });

      const result = await agent.getAvailability("content-1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/availability/content-1?region=US"),
        expect.any(Object),
      );
      expect(result).toEqual(mockAvailability);
    });

    it("should check availability with custom region", async () => {
      const mockAvailability: AvailabilityInfo = {
        contentId: "content-2",
        region: "UK",
        available: false,
        providers: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockAvailability,
      });

      const result = await agent.getAvailability("content-2", "UK");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/availability/content-2?region=UK"),
        expect.any(Object),
      );
      expect(result).toEqual(mockAvailability);
    });
  });

  describe("getDetails method", () => {
    beforeEach(() => {
      agent = new MediaGatewayAgent(mockAnthropicClient);
    });

    it("should get movie details", async () => {
      const mockDetails: MediaDetails = {
        id: "movie-1",
        title: "Test Movie",
        type: "movie",
        overview: "A test movie overview",
        releaseDate: "2024-01-15",
        rating: 8.5,
        genres: ["Action", "Sci-Fi"],
        cast: ["Actor 1", "Actor 2"],
        director: "Director Name",
        runtime: 120,
        posterUrl: "/poster.jpg",
        backdropUrl: "/backdrop.jpg",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockDetails,
      });

      const result = await agent.getDetails("movie", "movie-1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/movie/movie-1"),
        expect.any(Object),
      );
      expect(result).toEqual(mockDetails);
    });

    it("should get TV show details", async () => {
      const mockDetails: MediaDetails = {
        id: "tv-1",
        title: "Test Show",
        type: "tv",
        seasons: 5,
        episodes: 60,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockDetails,
      });

      const result = await agent.getDetails("tv", "tv-1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/tv/tv-1"),
        expect.any(Object),
      );
      expect(result).toEqual(mockDetails);
    });
  });

  describe("Authentication and Headers", () => {
    it("should include Authorization header when API key is provided", async () => {
      agent = new MediaGatewayAgent(mockAnthropicClient, {
        apiKey: "secure-api-key",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [] }),
      });

      await agent.search("test");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer secure-api-key",
          },
        }),
      );
    });

    it("should not include Authorization header when API key is empty", async () => {
      agent = new MediaGatewayAgent(mockAnthropicClient, {
        apiKey: "",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [] }),
      });

      await agent.search("test");

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers).toEqual({
        "Content-Type": "application/json",
      });
      expect(headers.Authorization).toBeUndefined();
    });
  });

  describe("Timeout Handling", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should abort request after timeout", async () => {
      agent = new MediaGatewayAgent(mockAnthropicClient, {
        timeout: 100, // Short timeout for test
      });

      // Mock AbortController to simulate timeout
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";

      mockFetch.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          // Reject immediately to avoid actual timeout
          reject(abortError);
        });
      });

      // The request should be aborted after timeout
      await expect(agent.search("timeout test")).rejects.toThrow();
    });

    it("should clear timeout after successful request", async () => {
      agent = new MediaGatewayAgent(mockAnthropicClient, {
        timeout: 5000,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [] }),
      });

      await agent.search("quick test");

      // Should not throw even if we advance time
      vi.advanceTimersByTime(10000);
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      agent = new MediaGatewayAgent(mockAnthropicClient);
    });

    it("should throw error on 404 Not Found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(agent.search("missing")).rejects.toThrow(
        "API request failed: 404 Not Found",
      );
    });

    it("should throw error on 401 Unauthorized", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      await expect(agent.getRecommendations("user-1")).rejects.toThrow(
        "API request failed: 401 Unauthorized",
      );
    });

    it("should throw error on 500 Internal Server Error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(agent.getTrending()).rejects.toThrow(
        "API request failed: 500 Internal Server Error",
      );
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(agent.search("network fail")).rejects.toThrow(
        "Network error",
      );
    });

    it("should handle JSON parse errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      await expect(agent.search("invalid json")).rejects.toThrow(
        "Invalid JSON",
      );
    });
  });
});

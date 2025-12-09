/**
 * Conversation Agent Tests
 *
 * Unit tests for the ConversationAgent class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConversationAgent } from "../src/services/conversation";
import type { MediaGatewayAPIClient } from "../src/types";

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class Anthropic {
      messages = {
        create: vi.fn(),
      };
    },
  };
});

describe("ConversationAgent", () => {
  let agent: ConversationAgent;
  let mockAPIClient: MediaGatewayAPIClient;

  beforeEach(() => {
    // Create mock API client
    mockAPIClient = {
      searchContent: vi.fn().mockResolvedValue({
        results: [
          {
            content: {
              id: 1,
              title: "Test Movie",
              overview: "A test movie",
              mediaType: "movie",
              genreIds: [28, 878],
              voteAverage: 8.5,
              voteCount: 1000,
              releaseDate: "2024-01-01",
              posterPath: "/test.jpg",
              backdropPath: "/test-backdrop.jpg",
              popularity: 100,
            },
            score: 0.95,
            availability: [
              {
                platformId: "netflix",
                platformName: "Netflix",
                available: true,
                type: "subscription",
              },
            ],
            explanation: "Matches your search criteria",
          },
        ],
        totalCount: 1,
      }),
      getRecommendations: vi.fn().mockResolvedValue({
        recommendations: [
          {
            content: {
              id: 2,
              title: "Recommended Movie",
              overview: "A recommended movie",
              mediaType: "movie",
              genreIds: [28],
              voteAverage: 7.8,
              voteCount: 500,
              releaseDate: "2023-06-15",
              posterPath: "/rec.jpg",
              backdropPath: "/rec-backdrop.jpg",
              popularity: 80,
            },
            score: 0.88,
            reason: "Based on your preferences",
            availability: [],
          },
        ],
        personalizationScore: 0.75,
      }),
      checkAvailability: vi.fn().mockResolvedValue({
        content: {
          id: 1,
          title: "Test Movie",
          overview: "A test movie",
          mediaType: "movie",
          genreIds: [28],
          voteAverage: 8.5,
          voteCount: 1000,
          releaseDate: "2024-01-01",
          posterPath: "/test.jpg",
          backdropPath: "/test-backdrop.jpg",
          popularity: 100,
        },
        availability: [
          {
            platformId: "netflix",
            platformName: "Netflix",
            available: true,
            type: "subscription",
          },
        ],
      }),
      getDetails: vi.fn().mockResolvedValue({
        content: {
          id: 1,
          title: "Test Movie",
          overview: "A test movie",
          mediaType: "movie",
          genreIds: [28],
          voteAverage: 8.5,
          voteCount: 1000,
          releaseDate: "2024-01-01",
          posterPath: "/test.jpg",
          backdropPath: "/test-backdrop.jpg",
          popularity: 100,
        },
        details: {
          runtime: 120,
          genres: ["Action", "Sci-Fi"],
          cast: ["Actor 1", "Actor 2"],
          director: "Director Name",
          overview: "A test movie",
        },
        availability: [],
      }),
      addToList: vi.fn().mockResolvedValue({
        success: true,
        message: "Added to your list",
      }),
    };

    // Create agent with mock API client
    agent = new ConversationAgent(
      {
        apiKey: "test-api-key",
        model: "claude-3-5-sonnet-20241022",
        temperature: 0.7,
        maxTokens: 2048,
        sessionTTLMinutes: 30,
      },
      mockAPIClient,
    );
  });

  afterEach(() => {
    agent.destroy();
    vi.clearAllMocks();
  });

  describe("Session Management", () => {
    it("should create a new session for first message", async () => {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Hello! How can I help you?" }],
        stop_reason: "end_turn",
      });
      (Anthropic as any).prototype.messages.create = mockCreate;

      await agent.processMessage("channel-1", "user-1", "Hello");

      const history = agent.getSessionHistory("channel-1", "user-1");
      expect(history).toHaveLength(2); // User message + assistant response
      expect(history[0].role).toBe("user");
      expect(history[0].content).toBe("Hello");
      expect(history[1].role).toBe("assistant");
    });

    it("should maintain conversation history across messages", async () => {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Response" }],
        stop_reason: "end_turn",
      });
      (Anthropic as any).prototype.messages.create = mockCreate;

      await agent.processMessage("channel-1", "user-1", "First message");
      await agent.processMessage("channel-1", "user-1", "Second message");

      const history = agent.getSessionHistory("channel-1", "user-1");
      expect(history).toHaveLength(4); // 2 user messages + 2 assistant responses
    });

    it("should clear session history", async () => {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Response" }],
        stop_reason: "end_turn",
      });
      (Anthropic as any).prototype.messages.create = mockCreate;

      await agent.processMessage("channel-1", "user-1", "Test message");

      let history = agent.getSessionHistory("channel-1", "user-1");
      expect(history.length).toBeGreaterThan(0);

      agent.clearSession("channel-1", "user-1");

      history = agent.getSessionHistory("channel-1", "user-1");
      expect(history).toHaveLength(0);
    });

    it("should isolate sessions by channel and user", async () => {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Response" }],
        stop_reason: "end_turn",
      });
      (Anthropic as any).prototype.messages.create = mockCreate;

      await agent.processMessage("channel-1", "user-1", "Message 1");
      await agent.processMessage("channel-2", "user-2", "Message 2");

      const history1 = agent.getSessionHistory("channel-1", "user-1");
      const history2 = agent.getSessionHistory("channel-2", "user-2");

      expect(history1[0].content).toBe("Message 1");
      expect(history2[0].content).toBe("Message 2");
    });
  });

  describe("Tool Execution", () => {
    it("should execute search_content tool", async () => {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      let callCount = 0;
      const mockCreate = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: Claude wants to use search tool
          return Promise.resolve({
            content: [
              {
                type: "tool_use",
                id: "tool-1",
                name: "search_content",
                input: { query: "action movies", limit: 5 },
              },
            ],
            stop_reason: "tool_use",
          });
        } else {
          // Second call: Final response after tool execution
          return Promise.resolve({
            content: [
              { type: "text", text: "Found some great action movies!" },
            ],
            stop_reason: "end_turn",
          });
        }
      });
      (Anthropic as any).prototype.messages.create = mockCreate;

      const response = await agent.processMessage(
        "channel-1",
        "user-1",
        "Show me action movies",
      );

      expect(mockAPIClient.searchContent).toHaveBeenCalledWith({
        query: "action movies",
        limit: 5,
      });
      expect(response).toContain("action movies");
    });

    it("should execute get_recommendations tool", async () => {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      let callCount = 0;
      const mockCreate = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            content: [
              {
                type: "tool_use",
                id: "tool-1",
                name: "get_recommendations",
                input: { mood: "relaxed", limit: 5 },
              },
            ],
            stop_reason: "tool_use",
          });
        } else {
          return Promise.resolve({
            content: [
              { type: "text", text: "Here are some relaxing recommendations!" },
            ],
            stop_reason: "end_turn",
          });
        }
      });
      (Anthropic as any).prototype.messages.create = mockCreate;

      const response = await agent.processMessage(
        "channel-1",
        "user-1",
        "I want something relaxing",
      );

      expect(mockAPIClient.getRecommendations).toHaveBeenCalledWith("user-1", {
        mood: "relaxed",
        limit: 5,
      });
      expect(response).toContain("relaxing");
    });

    it("should handle tool execution errors gracefully", async () => {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      let callCount = 0;
      const mockCreate = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            content: [
              {
                type: "tool_use",
                id: "tool-1",
                name: "search_content",
                input: { query: "test" },
              },
            ],
            stop_reason: "tool_use",
          });
        } else {
          return Promise.resolve({
            content: [
              {
                type: "text",
                text: "Sorry, I encountered an issue searching.",
              },
            ],
            stop_reason: "end_turn",
          });
        }
      });
      (Anthropic as any).prototype.messages.create = mockCreate;

      // Make API client throw error
      mockAPIClient.searchContent = vi
        .fn()
        .mockRejectedValue(new Error("API error"));

      const response = await agent.processMessage(
        "channel-1",
        "user-1",
        "Search test",
      );

      expect(response).toBeDefined();
      // Agent should still respond even if tool fails
    });
  });

  describe("Error Handling", () => {
    it("should throw error when Anthropic API fails", async () => {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const mockCreate = vi.fn().mockRejectedValue(new Error("API error"));
      (Anthropic as any).prototype.messages.create = mockCreate;

      await expect(
        agent.processMessage("channel-1", "user-1", "Test message"),
      ).rejects.toThrow("Failed to process message");
    });

    it("should handle empty messages", async () => {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "Hello!" }],
        stop_reason: "end_turn",
      });
      (Anthropic as any).prototype.messages.create = mockCreate;

      const response = await agent.processMessage("channel-1", "user-1", "");

      expect(response).toBeDefined();
    });
  });

  describe("Cleanup", () => {
    it("should destroy agent and clear resources", () => {
      const history1 = agent.getSessionHistory("channel-1", "user-1");

      agent.destroy();

      // After destroy, sessions should be cleared
      const history2 = agent.getSessionHistory("channel-1", "user-1");
      expect(history2).toHaveLength(0);
    });
  });
});

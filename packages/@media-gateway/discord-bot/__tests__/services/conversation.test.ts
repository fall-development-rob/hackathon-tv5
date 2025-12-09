/**
 * Conversation Agent Service Tests
 *
 * Tests for ConversationAgent class including:
 * - Constructor and initialization
 * - Message processing
 * - Tool execution
 * - Session management
 * - Error handling
 * - Edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConversationAgent } from "../../src/services/conversation";
import type { MediaGatewayAPIClient } from "../../src/types/index";
import Anthropic from "@anthropic-ai/sdk";

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

describe("ConversationAgent", () => {
  let agent: ConversationAgent;
  let mockAPIClient: MediaGatewayAPIClient;
  let mockAnthropic: any;

  beforeEach(() => {
    vi.clearAllMocks();

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
            },
            score: 0.95,
            availability: [],
          },
        ],
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
            },
            score: 0.88,
          },
        ],
      }),
      checkAvailability: vi.fn().mockResolvedValue({
        content: {
          id: 1,
          title: "Test Movie",
          mediaType: "movie",
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
          mediaType: "movie",
        },
        details: {
          runtime: 120,
          genres: ["Action", "Sci-Fi"],
        },
      }),
      addToList: vi.fn().mockResolvedValue({
        success: true,
        message: "Added to your list",
      }),
    };

    // Create agent instance
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

    // Get mock Anthropic instance
    mockAnthropic = (agent as any).client;
  });

  afterEach(() => {
    agent.destroy();
  });

  describe("Constructor and Initialization", () => {
    it("should initialize with default configuration", () => {
      const defaultAgent = new ConversationAgent(
        { apiKey: "test-key" },
        mockAPIClient,
      );

      expect(defaultAgent).toBeDefined();
      expect((defaultAgent as any).config.model).toBe(
        "claude-3-5-sonnet-20241022",
      );
      expect((defaultAgent as any).config.temperature).toBe(0.7);
      expect((defaultAgent as any).config.maxTokens).toBe(2048);
      expect((defaultAgent as any).config.sessionTTLMinutes).toBe(30);

      defaultAgent.destroy();
    });

    it("should initialize with custom configuration", () => {
      const customAgent = new ConversationAgent(
        {
          apiKey: "test-key",
          model: "claude-3-opus-20240229",
          temperature: 0.5,
          maxTokens: 4096,
          sessionTTLMinutes: 60,
        },
        mockAPIClient,
      );

      expect((customAgent as any).config.model).toBe("claude-3-opus-20240229");
      expect((customAgent as any).config.temperature).toBe(0.5);
      expect((customAgent as any).config.maxTokens).toBe(4096);
      expect((customAgent as any).config.sessionTTLMinutes).toBe(60);

      customAgent.destroy();
    });

    it("should initialize with empty sessions map", () => {
      const sessions = (agent as any).sessions;
      expect(sessions).toBeDefined();
      expect(sessions.size).toBe(0);
    });

    it("should start cleanup interval", () => {
      const interval = (agent as any).cleanupInterval;
      expect(interval).toBeDefined();
    });
  });

  describe("Session Management", () => {
    it("should create new session for first message", async () => {
      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [{ type: "text", text: "Hello! How can I help?" }],
        stop_reason: "end_turn",
      });

      await agent.processMessage("channel-1", "user-1", "Hello");

      const history = agent.getSessionHistory("channel-1", "user-1");
      expect(history).toHaveLength(2);
      expect(history[0].role).toBe("user");
      expect(history[0].content).toBe("Hello");
      expect(history[1].role).toBe("assistant");
      expect(history[1].content).toBe("Hello! How can I help?");
    });

    it("should maintain conversation history", async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: "text", text: "Response" }],
        stop_reason: "end_turn",
      });

      await agent.processMessage("channel-1", "user-1", "First");
      await agent.processMessage("channel-1", "user-1", "Second");

      const history = agent.getSessionHistory("channel-1", "user-1");
      expect(history).toHaveLength(4);
      expect(history[0].content).toBe("First");
      expect(history[2].content).toBe("Second");
    });

    it("should isolate sessions by channel and user", async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: "text", text: "Response" }],
        stop_reason: "end_turn",
      });

      await agent.processMessage("channel-1", "user-1", "Message 1");
      await agent.processMessage("channel-2", "user-2", "Message 2");

      const history1 = agent.getSessionHistory("channel-1", "user-1");
      const history2 = agent.getSessionHistory("channel-2", "user-2");

      expect(history1[0].content).toBe("Message 1");
      expect(history2[0].content).toBe("Message 2");
      expect(history1).not.toEqual(history2);
    });

    it("should clear session history", async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: "text", text: "Response" }],
        stop_reason: "end_turn",
      });

      await agent.processMessage("channel-1", "user-1", "Test");

      let history = agent.getSessionHistory("channel-1", "user-1");
      expect(history.length).toBeGreaterThan(0);

      agent.clearSession("channel-1", "user-1");

      history = agent.getSessionHistory("channel-1", "user-1");
      expect(history).toHaveLength(0);
    });

    it("should return empty array for non-existent session", () => {
      const history = agent.getSessionHistory("non-existent", "user");
      expect(history).toEqual([]);
    });

    it("should update session timestamps on activity", async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: "text", text: "Response" }],
        stop_reason: "end_turn",
      });

      await agent.processMessage("channel-1", "user-1", "Test");

      const sessions = (agent as any).sessions;
      const session = sessions.get("channel-1:user-1");

      expect(session.lastActivityAt).toBeDefined();
      expect(session.expiresAt).toBeDefined();
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("should create new session if previous expired", async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: "text", text: "Response" }],
        stop_reason: "end_turn",
      });

      await agent.processMessage("channel-1", "user-1", "First");

      // Manually expire session
      const sessions = (agent as any).sessions;
      const session = sessions.get("channel-1:user-1");
      session.expiresAt = new Date(Date.now() - 1000);

      await agent.processMessage("channel-1", "user-1", "Second");

      const history = agent.getSessionHistory("channel-1", "user-1");
      // Should only have the second message (new session)
      expect(history).toHaveLength(2);
      expect(history[0].content).toBe("Second");
    });
  });

  describe("Message Processing", () => {
    it("should process simple text message", async () => {
      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [{ type: "text", text: "I can help you find movies!" }],
        stop_reason: "end_turn",
      });

      const response = await agent.processMessage(
        "channel-1",
        "user-1",
        "What can you do?",
      );

      expect(response).toBe("I can help you find movies!");
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(1);
    });

    it("should send correct parameters to Claude", async () => {
      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [{ type: "text", text: "Response" }],
        stop_reason: "end_turn",
      });

      await agent.processMessage("channel-1", "user-1", "Test");

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 2048,
          temperature: 0.7,
          system: expect.stringContaining("entertainment concierge"),
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "user",
              content: "Test",
            }),
          ]),
          tools: expect.any(Array),
        }),
      );
    });

    it("should handle missing text content", async () => {
      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "tool-1", name: "test", input: {} }],
        stop_reason: "end_turn",
      });

      const response = await agent.processMessage(
        "channel-1",
        "user-1",
        "Test",
      );

      expect(response).toBe(
        "I apologize, but I encountered an issue generating a response.",
      );
    });

    it("should handle empty message", async () => {
      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [{ type: "text", text: "How can I help?" }],
        stop_reason: "end_turn",
      });

      const response = await agent.processMessage("channel-1", "user-1", "");

      expect(response).toBeDefined();
      expect(mockAnthropic.messages.create).toHaveBeenCalled();
    });
  });

  describe("Tool Execution", () => {
    it("should execute search_content tool", async () => {
      mockAnthropic.messages.create
        .mockResolvedValueOnce({
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "search_content",
              input: { query: "action movies", limit: 5 },
            },
          ],
          stop_reason: "tool_use",
        })
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "Found some great action movies!" }],
          stop_reason: "end_turn",
        });

      const response = await agent.processMessage(
        "channel-1",
        "user-1",
        "Show me action movies",
      );

      expect(mockAPIClient.searchContent).toHaveBeenCalledWith({
        query: "action movies",
        limit: 5,
      });
      expect(response).toBe("Found some great action movies!");
    });

    it("should execute get_recommendations tool", async () => {
      mockAnthropic.messages.create
        .mockResolvedValueOnce({
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "get_recommendations",
              input: { mood: "relaxed", limit: 5 },
            },
          ],
          stop_reason: "tool_use",
        })
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "Here are some relaxing shows!" }],
          stop_reason: "end_turn",
        });

      const response = await agent.processMessage(
        "channel-1",
        "user-1",
        "I want something relaxing",
      );

      expect(mockAPIClient.getRecommendations).toHaveBeenCalledWith("user-1", {
        mood: "relaxed",
        limit: 5,
      });
      expect(response).toBe("Here are some relaxing shows!");
    });

    it("should execute check_availability tool", async () => {
      mockAnthropic.messages.create
        .mockResolvedValueOnce({
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "check_availability",
              input: { contentId: 123, mediaType: "movie" },
            },
          ],
          stop_reason: "tool_use",
        })
        .mockResolvedValueOnce({
          content: [
            { type: "text", text: "This movie is available on Netflix!" },
          ],
          stop_reason: "end_turn",
        });

      const response = await agent.processMessage(
        "channel-1",
        "user-1",
        "Where can I watch this?",
      );

      expect(mockAPIClient.checkAvailability).toHaveBeenCalledWith({
        contentId: 123,
        mediaType: "movie",
      });
      expect(response).toBe("This movie is available on Netflix!");
    });

    it("should execute get_details tool", async () => {
      mockAnthropic.messages.create
        .mockResolvedValueOnce({
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "get_details",
              input: { contentId: 123, mediaType: "movie" },
            },
          ],
          stop_reason: "tool_use",
        })
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "Here are the details!" }],
          stop_reason: "end_turn",
        });

      await agent.processMessage("channel-1", "user-1", "Tell me more");

      expect(mockAPIClient.getDetails).toHaveBeenCalledWith({
        contentId: 123,
        mediaType: "movie",
      });
    });

    it("should execute add_to_list tool", async () => {
      mockAnthropic.messages.create
        .mockResolvedValueOnce({
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "add_to_list",
              input: { contentId: 123, mediaType: "movie" },
            },
          ],
          stop_reason: "tool_use",
        })
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "Added to your list!" }],
          stop_reason: "end_turn",
        });

      await agent.processMessage("channel-1", "user-1", "Add this to my list");

      expect(mockAPIClient.addToList).toHaveBeenCalledWith("user-1", {
        contentId: 123,
        mediaType: "movie",
      });
    });

    it("should execute multiple tools in sequence", async () => {
      mockAnthropic.messages.create
        .mockResolvedValueOnce({
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "search_content",
              input: { query: "comedy" },
            },
          ],
          stop_reason: "tool_use",
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: "tool_use",
              id: "tool-2",
              name: "check_availability",
              input: { contentId: 1, mediaType: "movie" },
            },
          ],
          stop_reason: "tool_use",
        })
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "Found a comedy on Netflix!" }],
          stop_reason: "end_turn",
        });

      await agent.processMessage(
        "channel-1",
        "user-1",
        "Find a comedy I can watch",
      );

      expect(mockAPIClient.searchContent).toHaveBeenCalled();
      expect(mockAPIClient.checkAvailability).toHaveBeenCalled();
    });

    it("should handle unknown tool", async () => {
      mockAnthropic.messages.create
        .mockResolvedValueOnce({
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "unknown_tool",
              input: {},
            },
          ],
          stop_reason: "tool_use",
        })
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "Let me help you differently" }],
          stop_reason: "end_turn",
        });

      const response = await agent.processMessage(
        "channel-1",
        "user-1",
        "Test",
      );

      expect(response).toBeDefined();
    });

    it("should handle tool execution errors gracefully", async () => {
      mockAPIClient.searchContent = vi
        .fn()
        .mockRejectedValue(new Error("API error"));

      mockAnthropic.messages.create
        .mockResolvedValueOnce({
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "search_content",
              input: { query: "test" },
            },
          ],
          stop_reason: "tool_use",
        })
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "Sorry, I encountered an issue." }],
          stop_reason: "end_turn",
        });

      const response = await agent.processMessage(
        "channel-1",
        "user-1",
        "Search",
      );

      expect(response).toBeDefined();
      expect(response).toBe("Sorry, I encountered an issue.");
    });
  });

  describe("Error Handling", () => {
    it("should throw error when Anthropic API fails", async () => {
      mockAnthropic.messages.create.mockRejectedValueOnce(
        new Error("API error"),
      );

      await expect(
        agent.processMessage("channel-1", "user-1", "Test"),
      ).rejects.toThrow("Failed to process message");
    });

    it("should include error message in thrown error", async () => {
      mockAnthropic.messages.create.mockRejectedValueOnce(
        new Error("Rate limit exceeded"),
      );

      await expect(
        agent.processMessage("channel-1", "user-1", "Test"),
      ).rejects.toThrow("Rate limit exceeded");
    });

    it("should handle non-Error exceptions", async () => {
      mockAnthropic.messages.create.mockRejectedValueOnce("String error");

      await expect(
        agent.processMessage("channel-1", "user-1", "Test"),
      ).rejects.toThrow("Unknown error");
    });
  });

  describe("Session Cleanup", () => {
    it("should clean up expired sessions", async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: "text", text: "Response" }],
        stop_reason: "end_turn",
      });

      await agent.processMessage("channel-1", "user-1", "Test");

      const sessions = (agent as any).sessions;
      expect(sessions.size).toBe(1);

      // Expire session
      const session = sessions.get("channel-1:user-1");
      session.expiresAt = new Date(Date.now() - 1000);

      // Trigger cleanup
      (agent as any).cleanupExpiredSessions();

      expect(sessions.size).toBe(0);
    });

    it("should not remove active sessions during cleanup", async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: "text", text: "Response" }],
        stop_reason: "end_turn",
      });

      await agent.processMessage("channel-1", "user-1", "Test");

      const sessions = (agent as any).sessions;
      expect(sessions.size).toBe(1);

      // Trigger cleanup without expiring
      (agent as any).cleanupExpiredSessions();

      expect(sessions.size).toBe(1);
    });

    it("should clean up multiple expired sessions", async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: "text", text: "Response" }],
        stop_reason: "end_turn",
      });

      await agent.processMessage("channel-1", "user-1", "Test 1");
      await agent.processMessage("channel-2", "user-2", "Test 2");
      await agent.processMessage("channel-3", "user-3", "Test 3");

      const sessions = (agent as any).sessions;
      expect(sessions.size).toBe(3);

      // Expire all sessions
      for (const [, session] of sessions) {
        session.expiresAt = new Date(Date.now() - 1000);
      }

      (agent as any).cleanupExpiredSessions();

      expect(sessions.size).toBe(0);
    });
  });

  describe("Destroy", () => {
    it("should clear all sessions on destroy", async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: "text", text: "Response" }],
        stop_reason: "end_turn",
      });

      await agent.processMessage("channel-1", "user-1", "Test");

      const sessions = (agent as any).sessions;
      expect(sessions.size).toBe(1);

      agent.destroy();

      expect(sessions.size).toBe(0);
    });

    it("should clear cleanup interval on destroy", () => {
      const interval = (agent as any).cleanupInterval;
      expect(interval).toBeDefined();

      agent.destroy();

      // Interval should be cleared (no way to directly test, but shouldn't throw)
      expect(() => agent.destroy()).not.toThrow();
    });

    it("should be safe to call destroy multiple times", () => {
      agent.destroy();
      expect(() => agent.destroy()).not.toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long messages", async () => {
      const longMessage = "a".repeat(10000);

      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [{ type: "text", text: "Received your message" }],
        stop_reason: "end_turn",
      });

      const response = await agent.processMessage(
        "channel-1",
        "user-1",
        longMessage,
      );

      expect(response).toBeDefined();
      expect(mockAnthropic.messages.create).toHaveBeenCalled();
    });

    it("should handle special characters in messages", async () => {
      const specialMessage = "Test <>&\"'`\\n\\t";

      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [{ type: "text", text: "Understood" }],
        stop_reason: "end_turn",
      });

      const response = await agent.processMessage(
        "channel-1",
        "user-1",
        specialMessage,
      );

      expect(response).toBe("Understood");
    });

    it("should handle rapid consecutive messages", async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: "text", text: "Response" }],
        stop_reason: "end_turn",
      });

      const promises = [
        agent.processMessage("channel-1", "user-1", "Message 1"),
        agent.processMessage("channel-1", "user-1", "Message 2"),
        agent.processMessage("channel-1", "user-1", "Message 3"),
      ];

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(3);
      expect(responses.every((r) => r === "Response")).toBe(true);
    });

    it("should handle session key collisions", async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: "text", text: "Response" }],
        stop_reason: "end_turn",
      });

      // Messages with similar but different keys
      await agent.processMessage("channel-1", "user:1", "Test");
      await agent.processMessage("channel:1", "user-1", "Test");

      const history1 = agent.getSessionHistory("channel-1", "user:1");
      const history2 = agent.getSessionHistory("channel:1", "user-1");

      expect(history1).toHaveLength(2);
      expect(history2).toHaveLength(2);
    });
  });
});

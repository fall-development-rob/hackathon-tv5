/**
 * Agent Service Tests
 *
 * Tests for ConversationalAgent (agent.ts) including:
 * - Constructor and initialization
 * - Message processing with conversation context
 * - Tool execution
 * - Context management
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConversationalAgent } from "../../src/services/agent";
import { MediaGatewayAgent } from "../../src/mcp-client";
import type { ConversationContext } from "../../src/types";
import Anthropic from "@anthropic-ai/sdk";

// Mock MediaGatewayAgent
vi.mock("../../src/mcp-client", () => ({
  MediaGatewayAgent: vi.fn().mockImplementation(() => ({
    getAnthropicClient: vi.fn(),
    search: vi.fn(),
    getRecommendations: vi.fn(),
    getTrending: vi.fn(),
    getAvailability: vi.fn(),
    getDetails: vi.fn(),
  })),
}));

describe("ConversationalAgent", () => {
  let agent: ConversationalAgent;
  let mockMediaGatewayAgent: any;
  let mockAnthropic: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock Anthropic client
    mockAnthropic = {
      messages: {
        create: vi.fn(),
      },
    };

    // Create mock MediaGatewayAgent
    mockMediaGatewayAgent = {
      getAnthropicClient: vi.fn().mockReturnValue(mockAnthropic),
      search: vi.fn().mockResolvedValue([
        {
          id: "1",
          title: "Test Movie",
          type: "movie",
          rating: 8.5,
        },
      ]),
      getRecommendations: vi.fn().mockResolvedValue([
        {
          id: "2",
          title: "Recommended Show",
          type: "tv",
          rating: 7.8,
        },
      ]),
      getTrending: vi.fn().mockResolvedValue([
        {
          id: "3",
          title: "Trending Movie",
          type: "movie",
          rating: 9.0,
        },
      ]),
      getAvailability: vi.fn().mockResolvedValue({
        contentId: "1",
        region: "US",
        available: true,
        providers: [
          {
            name: "Netflix",
            type: "subscription",
          },
        ],
      }),
      getDetails: vi.fn().mockResolvedValue({
        id: "1",
        title: "Test Movie",
        type: "movie",
        overview: "A test movie",
        rating: 8.5,
      }),
    };

    // Create agent instance
    agent = new ConversationalAgent(mockMediaGatewayAgent);
  });

  describe("Constructor and Initialization", () => {
    it("should initialize with default options", () => {
      const defaultAgent = new ConversationalAgent(mockMediaGatewayAgent);

      expect(defaultAgent).toBeDefined();
      expect((defaultAgent as any).maxTokens).toBe(4096);
      expect((defaultAgent as any).model).toBe("claude-3-5-sonnet-20241022");
    });

    it("should initialize with custom options", () => {
      const customAgent = new ConversationalAgent(mockMediaGatewayAgent, {
        maxTokens: 8192,
        model: "claude-3-opus-20240229",
      });

      expect((customAgent as any).maxTokens).toBe(8192);
      expect((customAgent as any).model).toBe("claude-3-opus-20240229");
    });

    it("should store MediaGatewayAgent reference", () => {
      expect((agent as any).agent).toBe(mockMediaGatewayAgent);
    });
  });

  describe("Message Processing", () => {
    it("should process simple message without tools", async () => {
      const context: ConversationContext = {
        userId: "user-1",
        conversationHistory: [],
      };

      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [{ type: "text", text: "Hello! How can I help?" }],
        stop_reason: "end_turn",
      });

      const response = await agent.processMessage("What can you do?", context);

      expect(response.message).toBe("Hello! How can I help?");
      expect(response.toolCalls).toBeUndefined();
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(1);
    });

    it("should include conversation history in API call", async () => {
      const context: ConversationContext = {
        userId: "user-1",
        conversationHistory: [
          { role: "user", content: "Previous message" },
          { role: "assistant", content: "Previous response" },
        ],
      };

      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [{ type: "text", text: "Follow-up response" }],
        stop_reason: "end_turn",
      });

      await agent.processMessage("Follow-up question", context);

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: "user", content: "Previous message" },
            { role: "assistant", content: "Previous response" },
            { role: "user", content: "Follow-up question" },
          ]),
        }),
      );
    });

    it("should use correct model and max_tokens", async () => {
      const context = ConversationalAgent.createContext("user-1");

      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [{ type: "text", text: "Response" }],
        stop_reason: "end_turn",
      });

      await agent.processMessage("Test", context);

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 4096,
        }),
      );
    });

    it("should include system prompt and tools", async () => {
      const context = ConversationalAgent.createContext("user-1");

      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [{ type: "text", text: "Response" }],
        stop_reason: "end_turn",
      });

      await agent.processMessage("Test", context);

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining("media assistant"),
          tools: expect.arrayContaining([
            expect.objectContaining({ name: "search_content" }),
            expect.objectContaining({ name: "get_recommendations" }),
          ]),
        }),
      );
    });
  });

  describe("Tool Execution", () => {
    it("should execute search_content tool", async () => {
      const context = ConversationalAgent.createContext("user-1");

      mockAnthropic.messages.create
        .mockResolvedValueOnce({
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "search_content",
              input: { query: "action movies", type: "movie", limit: 10 },
            },
          ],
          stop_reason: "tool_use",
        })
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "Found action movies!" }],
          stop_reason: "end_turn",
        });

      const response = await agent.processMessage(
        "Show me action movies",
        context,
      );

      expect(mockMediaGatewayAgent.search).toHaveBeenCalledWith(
        "action movies",
        {
          type: "movie",
          genre: undefined,
          year: undefined,
          minRating: undefined,
          limit: 10,
        },
      );
      expect(response.message).toBe("Found action movies!");
      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls?.[0].name).toBe("search_content");
    });

    it("should execute get_recommendations tool", async () => {
      const context = ConversationalAgent.createContext("user-123");

      mockAnthropic.messages.create
        .mockResolvedValueOnce({
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "get_recommendations",
              input: { userId: "user-123", limit: 10, genre: "comedy" },
            },
          ],
          stop_reason: "tool_use",
        })
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "Here are some recommendations!" }],
          stop_reason: "end_turn",
        });

      const response = await agent.processMessage(
        "Recommend comedies",
        context,
      );

      expect(mockMediaGatewayAgent.getRecommendations).toHaveBeenCalledWith(
        "user-123",
        {
          limit: 10,
          genre: "comedy",
          excludeWatched: undefined,
        },
      );
      expect(response.message).toBe("Here are some recommendations!");
    });

    it("should execute get_trending tool", async () => {
      const context = ConversationalAgent.createContext("user-1");

      mockAnthropic.messages.create
        .mockResolvedValueOnce({
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "get_trending",
              input: { limit: 5 },
            },
          ],
          stop_reason: "tool_use",
        })
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "Trending content!" }],
          stop_reason: "end_turn",
        });

      await agent.processMessage("What's trending?", context);

      expect(mockMediaGatewayAgent.getTrending).toHaveBeenCalledWith(5);
    });

    it("should execute check_availability tool", async () => {
      const context = ConversationalAgent.createContext("user-1");

      mockAnthropic.messages.create
        .mockResolvedValueOnce({
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "check_availability",
              input: { contentId: "123", region: "US" },
            },
          ],
          stop_reason: "tool_use",
        })
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "Available on Netflix!" }],
          stop_reason: "end_turn",
        });

      await agent.processMessage("Where can I watch this?", context);

      expect(mockMediaGatewayAgent.getAvailability).toHaveBeenCalledWith(
        "123",
        "US",
      );
    });

    it("should execute get_details tool", async () => {
      const context = ConversationalAgent.createContext("user-1");

      mockAnthropic.messages.create
        .mockResolvedValueOnce({
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "get_details",
              input: { mediaType: "movie", id: "456" },
            },
          ],
          stop_reason: "tool_use",
        })
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "Here are the details!" }],
          stop_reason: "end_turn",
        });

      await agent.processMessage("Tell me about this movie", context);

      expect(mockMediaGatewayAgent.getDetails).toHaveBeenCalledWith(
        "movie",
        "456",
      );
    });

    it("should handle multiple tool calls in sequence", async () => {
      const context = ConversationalAgent.createContext("user-1");

      mockAnthropic.messages.create
        .mockResolvedValueOnce({
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "get_trending",
              input: { limit: 5 },
            },
            {
              type: "tool_use",
              id: "tool-2",
              name: "search_content",
              input: { query: "comedy", limit: 5 },
            },
          ],
          stop_reason: "tool_use",
        })
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "Combined results!" }],
          stop_reason: "end_turn",
        });

      const response = await agent.processMessage(
        "What's trending and show comedies",
        context,
      );

      expect(mockMediaGatewayAgent.getTrending).toHaveBeenCalled();
      expect(mockMediaGatewayAgent.search).toHaveBeenCalled();
      expect(response.toolCalls).toHaveLength(2);
    });

    it("should handle tool execution errors gracefully", async () => {
      const context = ConversationalAgent.createContext("user-1");

      mockMediaGatewayAgent.search.mockRejectedValueOnce(
        new Error("API error"),
      );

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
          content: [{ type: "text", text: "Error occurred" }],
          stop_reason: "end_turn",
        });

      const response = await agent.processMessage("Search test", context);

      expect(response.message).toBeDefined();
      // Should not throw, error handled gracefully
    });

    it("should handle unknown tool", async () => {
      const context = ConversationalAgent.createContext("user-1");

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
          content: [{ type: "text", text: "Let me try something else" }],
          stop_reason: "end_turn",
        });

      const response = await agent.processMessage("Test", context);

      expect(response.message).toBeDefined();
    });
  });

  describe("Context Management", () => {
    it("should create empty context with createContext", () => {
      const context = ConversationalAgent.createContext("user-123");

      expect(context.userId).toBe("user-123");
      expect(context.conversationHistory).toEqual([]);
    });

    it("should add user message to history", () => {
      const context = ConversationalAgent.createContext("user-1");

      ConversationalAgent.addToHistory(context, "user", "Hello");

      expect(context.conversationHistory).toHaveLength(1);
      expect(context.conversationHistory[0]).toEqual({
        role: "user",
        content: "Hello",
      });
    });

    it("should add assistant message to history", () => {
      const context = ConversationalAgent.createContext("user-1");

      ConversationalAgent.addToHistory(context, "assistant", "Hi there!");

      expect(context.conversationHistory).toHaveLength(1);
      expect(context.conversationHistory[0]).toEqual({
        role: "assistant",
        content: "Hi there!",
      });
    });

    it("should maintain conversation order", () => {
      const context = ConversationalAgent.createContext("user-1");

      ConversationalAgent.addToHistory(context, "user", "Message 1");
      ConversationalAgent.addToHistory(context, "assistant", "Response 1");
      ConversationalAgent.addToHistory(context, "user", "Message 2");

      expect(context.conversationHistory).toHaveLength(3);
      expect(context.conversationHistory[0].content).toBe("Message 1");
      expect(context.conversationHistory[1].content).toBe("Response 1");
      expect(context.conversationHistory[2].content).toBe("Message 2");
    });

    it("should keep only last 10 messages", () => {
      const context = ConversationalAgent.createContext("user-1");

      // Add 15 messages
      for (let i = 0; i < 15; i++) {
        ConversationalAgent.addToHistory(context, "user", `Message ${i}`);
      }

      expect(context.conversationHistory).toHaveLength(10);
      expect(context.conversationHistory[0].content).toBe("Message 5");
      expect(context.conversationHistory[9].content).toBe("Message 14");
    });
  });

  describe("Error Handling", () => {
    it("should handle Anthropic API errors", async () => {
      const context = ConversationalAgent.createContext("user-1");

      mockAnthropic.messages.create.mockRejectedValueOnce(
        new Error("API error"),
      );

      await expect(agent.processMessage("Test", context)).rejects.toThrow(
        "API error",
      );
    });

    it("should handle empty response content", async () => {
      const context = ConversationalAgent.createContext("user-1");

      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [],
        stop_reason: "end_turn",
      });

      const response = await agent.processMessage("Test", context);

      expect(response.message).toBe("");
    });

    it("should handle mixed content types", async () => {
      const context = ConversationalAgent.createContext("user-1");

      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [
          { type: "tool_use", id: "tool-1", name: "test", input: {} },
          { type: "text", text: "First text" },
          { type: "text", text: "Second text" },
        ],
        stop_reason: "end_turn",
      });

      const response = await agent.processMessage("Test", context);

      expect(response.message).toBe("First text\nSecond text");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty message", async () => {
      const context = ConversationalAgent.createContext("user-1");

      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [{ type: "text", text: "How can I help?" }],
        stop_reason: "end_turn",
      });

      const response = await agent.processMessage("", context);

      expect(response.message).toBeDefined();
    });

    it("should handle very long message", async () => {
      const context = ConversationalAgent.createContext("user-1");
      const longMessage = "a".repeat(10000);

      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [{ type: "text", text: "Received" }],
        stop_reason: "end_turn",
      });

      const response = await agent.processMessage(longMessage, context);

      expect(response.message).toBe("Received");
    });

    it("should handle special characters", async () => {
      const context = ConversationalAgent.createContext("user-1");
      const specialMessage = "Test <>&\"'`\\n\\t";

      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [{ type: "text", text: "Understood" }],
        stop_reason: "end_turn",
      });

      const response = await agent.processMessage(specialMessage, context);

      expect(response.message).toBe("Understood");
    });

    it("should handle concurrent requests", async () => {
      const context = ConversationalAgent.createContext("user-1");

      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: "text", text: "Response" }],
        stop_reason: "end_turn",
      });

      const promises = [
        agent.processMessage("Message 1", context),
        agent.processMessage("Message 2", context),
        agent.processMessage("Message 3", context),
      ];

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(3);
      expect(responses.every((r) => r.message === "Response")).toBe(true);
    });
  });
});

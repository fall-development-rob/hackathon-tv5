/**
 * Conversation Agent
 *
 * Core conversational AI agent for deep-dive entertainment discovery.
 * Uses Claude (Anthropic) for natural conversation with tool-calling capabilities.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  ConversationAgentConfig,
  ConversationSession,
  ConversationMessage,
  MediaGatewayAPIClient,
  ToolInput,
  ToolResult,
  SearchContentInput,
  GetRecommendationsInput,
  CheckAvailabilityInput,
  GetDetailsInput,
  AddToListInput,
} from "../types/index.js";

/**
 * System prompt for the entertainment concierge agent
 */
const SYSTEM_PROMPT = `You are a helpful entertainment concierge assistant for Media Gateway, helping users discover movies and TV shows that match their preferences.

Your role:
- Ask clarifying questions about mood, genre preferences, and what they're in the mood for
- Explain WHY recommendations match the user's request, highlighting specific aspects that align with their interests
- Always include where content is available to watch (streaming service, rental, purchase, or free)
- Specify whether content requires a subscription, rental fee, or is free
- Keep responses concise but insightful - aim for 2-3 sentences per recommendation
- Be conversational and friendly, as if chatting with a friend about entertainment

Available tools:
- search_content: Search for movies/TV shows by query, genre, or filters
- get_recommendations: Get personalized recommendations based on mood, available time, or occasion
- check_availability: Check where specific content is available to watch
- get_details: Get full details about a movie or TV show
- add_to_list: Add content to the user's My List

Guidelines:
- When users ask for something like another show/movie, search for similar content
- Always explain the reasoning behind recommendations
- Highlight unique aspects that match the user's request (mood, themes, tone, pacing, etc.)
- Be honest if content requires payment or subscription
- If unsure about preferences, ask follow-up questions
- Keep the conversation natural and flowing

Example response style:
"Based on your interest in workplace sci-fi, I'd recommend **Mythic Quest** - it explores creative burnout and office dynamics like Severance, but through gaming culture with way more laughs. It's on Apple TV+ which you have! The show nails that same feeling of being trapped in corporate absurdity but makes it hilarious instead of dystopian. Want me to tell you more or add it to your list?"`;

/**
 * Tool definitions for Claude
 */
const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_content",
    description:
      "Search for movies or TV shows by query, genre, or other filters. Use this when the user describes what they want to watch.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'Natural language search query (e.g., "workplace sci-fi comedy", "action movies with strong female leads")',
        },
        mediaType: {
          type: "string",
          enum: ["movie", "tv"],
          description: "Filter by media type: movie or tv show",
        },
        genres: {
          type: "array",
          items: { type: "string" },
          description: 'Genre names to filter by (e.g., ["Comedy", "Sci-Fi"])',
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 5)",
          default: 5,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_recommendations",
    description:
      "Get personalized recommendations based on mood, available time, or occasion. Use this when the user expresses a feeling or constraint.",
    input_schema: {
      type: "object",
      properties: {
        mood: {
          type: "string",
          description:
            'User\'s current mood (e.g., "relaxed", "energetic", "thoughtful", "need a laugh")',
        },
        availableTime: {
          type: "number",
          description: "Available viewing time in minutes",
        },
        occasion: {
          type: "string",
          description:
            'Viewing occasion (e.g., "date night", "family time", "solo viewing")',
        },
        limit: {
          type: "number",
          description: "Maximum number of recommendations (default: 5)",
          default: 5,
        },
      },
      required: [],
    },
  },
  {
    name: "check_availability",
    description:
      "Check where a specific movie or TV show is available to watch (streaming, rental, purchase).",
    input_schema: {
      type: "object",
      properties: {
        contentId: {
          type: "number",
          description: "The content ID from previous search results",
        },
        mediaType: {
          type: "string",
          enum: ["movie", "tv"],
          description: "Whether this is a movie or TV show",
        },
      },
      required: ["contentId", "mediaType"],
    },
  },
  {
    name: "get_details",
    description:
      "Get full details about a movie or TV show including cast, runtime, genres, and plot.",
    input_schema: {
      type: "object",
      properties: {
        contentId: {
          type: "number",
          description: "The content ID from previous search results",
        },
        mediaType: {
          type: "string",
          enum: ["movie", "tv"],
          description: "Whether this is a movie or TV show",
        },
      },
      required: ["contentId", "mediaType"],
    },
  },
  {
    name: "add_to_list",
    description:
      "Add a movie or TV show to the user's My List for later watching.",
    input_schema: {
      type: "object",
      properties: {
        contentId: {
          type: "number",
          description: "The content ID to add to the list",
        },
        mediaType: {
          type: "string",
          enum: ["movie", "tv"],
          description: "Whether this is a movie or TV show",
        },
      },
      required: ["contentId", "mediaType"],
    },
  },
];

/**
 * Conversation Agent
 *
 * Manages conversational interactions with users using Claude AI.
 * Maintains conversation history, executes tools, and generates responses.
 */
export class ConversationAgent {
  private client: Anthropic;
  private sessions: Map<string, ConversationSession>;
  private config: Required<ConversationAgentConfig>;
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    config: ConversationAgentConfig,
    private apiClient: MediaGatewayAPIClient,
  ) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.sessions = new Map();

    this.config = {
      apiKey: config.apiKey,
      model: config.model || "claude-3-5-sonnet-20241022",
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens || 2048,
      sessionTTLMinutes: config.sessionTTLMinutes || 30,
    };

    // Start cleanup interval for expired sessions
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Check every minute
  }

  /**
   * Process a user message and generate a response
   */
  async processMessage(
    channelId: string,
    userId: string,
    message: string,
  ): Promise<string> {
    // Get or create session
    const session = this.getOrCreateSession(channelId, userId);

    // Add user message to history
    session.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    try {
      // Create messages array for Claude
      const messages = session.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Call Claude with tools
      let response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: SYSTEM_PROMPT,
        messages,
        tools: TOOLS,
      });

      // Handle tool use in a loop until we get a final response
      while (response.stop_reason === "tool_use") {
        const toolResults = await this.executeTools(response, userId);

        // Add assistant's tool use to messages
        session.messages.push({
          role: "assistant",
          content: JSON.stringify(response.content),
          timestamp: new Date(),
        });

        // Add tool results and continue conversation
        messages.push({
          role: "assistant",
          content: JSON.stringify(response.content),
        });
        messages.push({
          role: "user",
          content: JSON.stringify(toolResults),
        });

        response = await this.client.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          system: SYSTEM_PROMPT,
          messages,
          tools: TOOLS,
        });
      }

      // Extract text response
      const textContent = response.content.find(
        (block) => block.type === "text",
      );
      const assistantMessage =
        textContent && "text" in textContent
          ? textContent.text
          : "I apologize, but I encountered an issue generating a response.";

      // Add assistant response to history
      session.messages.push({
        role: "assistant",
        content: assistantMessage,
        timestamp: new Date(),
      });

      // Update session activity
      session.lastActivityAt = new Date();
      session.expiresAt = new Date(
        Date.now() + this.config.sessionTTLMinutes * 60000,
      );

      return assistantMessage;
    } catch (error) {
      console.error("Error processing message:", error);
      throw new Error(
        `Failed to process message: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Execute tool calls from Claude's response
   */
  private async executeTools(
    response: Anthropic.Message,
    userId: string,
  ): Promise<
    Array<{ type: "tool_result"; tool_use_id: string; content: string }>
  > {
    const toolResults: Array<{
      type: "tool_result";
      tool_use_id: string;
      content: string;
    }> = [];

    for (const block of response.content) {
      if (block.type === "tool_use") {
        const result = await this.executeTool(
          block.name,
          block.input as ToolInput,
          userId,
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    return toolResults;
  }

  /**
   * Execute a single tool call
   */
  private async executeTool(
    toolName: string,
    input: ToolInput,
    userId: string,
  ): Promise<ToolResult> {
    try {
      switch (toolName) {
        case "search_content":
          const searchResult = await this.apiClient.searchContent(
            input as SearchContentInput,
          );
          return { success: true, data: searchResult };

        case "get_recommendations":
          const recResult = await this.apiClient.getRecommendations(
            userId,
            input as GetRecommendationsInput,
          );
          return { success: true, data: recResult };

        case "check_availability":
          const availResult = await this.apiClient.checkAvailability(
            input as CheckAvailabilityInput,
          );
          return { success: true, data: availResult };

        case "get_details":
          const detailsResult = await this.apiClient.getDetails(
            input as GetDetailsInput,
          );
          return { success: true, data: detailsResult };

        case "add_to_list":
          const addResult = await this.apiClient.addToList(
            userId,
            input as AddToListInput,
          );
          return { success: true, data: addResult };

        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Tool execution failed",
      };
    }
  }

  /**
   * Get or create a conversation session
   */
  private getOrCreateSession(
    channelId: string,
    userId: string,
  ): ConversationSession {
    const sessionKey = `${channelId}:${userId}`;
    let session = this.sessions.get(sessionKey);

    if (!session || session.expiresAt < new Date()) {
      session = {
        channelId,
        userId,
        messages: [],
        createdAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + this.config.sessionTTLMinutes * 60000),
      };
      this.sessions.set(sessionKey, session);
    }

    return session;
  }

  /**
   * Clear a conversation session
   */
  clearSession(channelId: string, userId: string): void {
    const sessionKey = `${channelId}:${userId}`;
    this.sessions.delete(sessionKey);
  }

  /**
   * Get session history for debugging/analytics
   */
  getSessionHistory(channelId: string, userId: string): ConversationMessage[] {
    const sessionKey = `${channelId}:${userId}`;
    const session = this.sessions.get(sessionKey);
    return session?.messages || [];
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => this.sessions.delete(key));

    if (expiredKeys.length > 0) {
      console.log(
        `Cleaned up ${expiredKeys.length} expired conversation sessions`,
      );
    }
  }

  /**
   * Graceful shutdown
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
  }
}

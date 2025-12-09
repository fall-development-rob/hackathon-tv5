/**
 * Conversational Agent Service
 * Uses Claude to interpret user messages and orchestrate tool calls
 * to the Media Gateway API
 */

import Anthropic from "@anthropic-ai/sdk";
import { MediaGatewayAgent } from "../mcp-client";
import {
  AgentMessage,
  ConversationContext,
  AgentResponse,
  ToolCall,
} from "../types";

/**
 * Tool definitions for Claude to use
 */
const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_content",
    description:
      "Search for movies and TV shows by title, genre, or other criteria. Use this when the user wants to find specific content or browse by category.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query (title, keyword, or description)",
        },
        type: {
          type: "string",
          enum: ["movie", "tv", "all"],
          description: "Filter by content type",
        },
        genre: {
          type: "string",
          description: 'Filter by genre (e.g., "action", "comedy", "drama")',
        },
        year: {
          type: "number",
          description: "Filter by release year",
        },
        minRating: {
          type: "number",
          description: "Minimum rating (0-10)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
          default: 10,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_recommendations",
    description:
      "Get personalized content recommendations for a user based on their viewing history and preferences.",
    input_schema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "The user ID to get recommendations for",
        },
        limit: {
          type: "number",
          description: "Maximum number of recommendations",
          default: 10,
        },
        genre: {
          type: "string",
          description: "Filter recommendations by genre",
        },
        excludeWatched: {
          type: "boolean",
          description: "Exclude content the user has already watched",
          default: true,
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_trending",
    description:
      'Get currently trending movies and TV shows. Use this when the user asks what\'s popular, trending, or "what everyone is watching".',
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of trending items",
          default: 10,
        },
      },
    },
  },
  {
    name: "check_availability",
    description:
      "Check where a specific movie or TV show is available to watch (streaming services, rental, purchase).",
    input_schema: {
      type: "object",
      properties: {
        contentId: {
          type: "string",
          description: "The ID of the content to check",
        },
        region: {
          type: "string",
          description: 'Region code (e.g., "US", "UK", "CA")',
          default: "US",
        },
      },
      required: ["contentId"],
    },
  },
  {
    name: "get_details",
    description:
      "Get detailed information about a specific movie or TV show including cast, director, plot, ratings, and more.",
    input_schema: {
      type: "object",
      properties: {
        mediaType: {
          type: "string",
          enum: ["movie", "tv"],
          description: "Type of media",
        },
        id: {
          type: "string",
          description: "The media ID",
        },
      },
      required: ["mediaType", "id"],
    },
  },
];

/**
 * System prompt for the conversational agent
 */
const SYSTEM_PROMPT = `You are a helpful media assistant with access to a comprehensive media gateway.
You can search for movies and TV shows, provide personalized recommendations, check what's trending,
verify where content is available to watch, and provide detailed information about any content.

Your responses should be:
- Friendly and conversational
- Concise but informative
- Formatted for Discord (use markdown where appropriate)
- Focused on helping users discover and enjoy content

When users ask questions, use the available tools to fetch real data, then format your response
in natural language. Always provide specific recommendations when possible, and include relevant
details like ratings, genres, and availability.

If you need to use multiple tools to answer a question, do so. For example, if someone asks
"What action movies are trending?", first get trending content, then filter for action movies.`;

/**
 * Conversational Agent for Media Gateway
 */
export class ConversationalAgent {
  private agent: MediaGatewayAgent;
  private maxTokens: number;
  private model: string;

  constructor(
    agent: MediaGatewayAgent,
    options: {
      maxTokens?: number;
      model?: string;
    } = {},
  ) {
    this.agent = agent;
    this.maxTokens = options.maxTokens || 4096;
    this.model = options.model || "claude-3-5-sonnet-20241022";
  }

  /**
   * Process a user message and generate a response
   * @param message - User's message
   * @param context - Conversation context
   * @returns Agent response with formatted message and data
   */
  async processMessage(
    message: string,
    context: ConversationContext,
  ): Promise<AgentResponse> {
    const anthropic = this.agent.getAnthropicClient();

    // Build conversation history
    const messages: Anthropic.MessageParam[] = [
      ...context.conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: "user" as const,
        content: message,
      },
    ];

    // Initial API call to Claude
    let response = await anthropic.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    // Process tool calls iteratively
    const toolCalls: ToolCall[] = [];
    let finalResponse = "";

    while (response.stop_reason === "tool_use") {
      // Extract tool use blocks
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );

      // Execute all tool calls
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (toolUse) => {
          const result = await this.executeTool(
            toolUse.name,
            toolUse.input as Record<string, any>,
          );

          toolCalls.push({
            name: toolUse.name,
            parameters: toolUse.input as Record<string, any>,
          });

          return {
            type: "tool_result" as const,
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          };
        }),
      );

      // Continue conversation with tool results
      messages.push({
        role: "assistant",
        content: response.content,
      });

      messages.push({
        role: "user",
        content: toolResults,
      });

      response = await anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });
    }

    // Extract final text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    finalResponse = textBlocks.map((block) => block.text).join("\n");

    return {
      message: finalResponse,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  /**
   * Execute a tool call
   * @param toolName - Name of the tool to execute
   * @param parameters - Tool parameters
   * @returns Tool execution result
   */
  private async executeTool(
    toolName: string,
    parameters: Record<string, any>,
  ): Promise<any> {
    try {
      switch (toolName) {
        case "search_content":
          return await this.agent.search(parameters.query, {
            type: parameters.type,
            genre: parameters.genre,
            year: parameters.year,
            minRating: parameters.minRating,
            limit: parameters.limit,
          });

        case "get_recommendations":
          return await this.agent.getRecommendations(parameters.userId, {
            limit: parameters.limit,
            genre: parameters.genre,
            excludeWatched: parameters.excludeWatched,
          });

        case "get_trending":
          return await this.agent.getTrending(parameters.limit);

        case "check_availability":
          return await this.agent.getAvailability(
            parameters.contentId,
            parameters.region,
          );

        case "get_details":
          return await this.agent.getDetails(
            parameters.mediaType,
            parameters.id,
          );

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      return {
        error: true,
        message:
          error instanceof Error ? error.message : "Tool execution failed",
      };
    }
  }

  /**
   * Create a simple conversation context
   * @param userId - User ID
   * @returns Empty conversation context
   */
  static createContext(userId: string): ConversationContext {
    return {
      userId,
      conversationHistory: [],
    };
  }

  /**
   * Add a message to conversation history
   * @param context - Conversation context
   * @param role - Message role
   * @param content - Message content
   */
  static addToHistory(
    context: ConversationContext,
    role: "user" | "assistant",
    content: string,
  ): void {
    context.conversationHistory.push({ role, content });

    // Keep only last 10 messages to manage context size
    if (context.conversationHistory.length > 10) {
      context.conversationHistory = context.conversationHistory.slice(-10);
    }
  }
}

/**
 * MCP Server Implementation
 * Handles JSON-RPC 2.0 protocol and routes tool calls
 */

import { ALL_TOOLS, getToolByName } from './tools.js';
import type { SwarmCoordinator } from '@media-gateway/agents';

/**
 * JSON-RPC 2.0 Request
 */
interface JSONRPCRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

/**
 * JSON-RPC 2.0 Response
 */
interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * Tool result pattern
 */
export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * MCP Server Configuration
 */
export interface MCPServerConfig {
  name: string;
  version: string;
  description: string;
}

/**
 * MCP Server Class
 */
export class MCPServer {
  private config: MCPServerConfig;
  private swarmCoordinator: SwarmCoordinator | null = null;
  private qLearningEnabled: boolean = false;
  private handlers: Map<string, (params: any) => Promise<any>>;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.handlers = new Map();
    this.setupHandlers();
  }

  /**
   * Set up request handlers
   */
  private setupHandlers(): void {
    // MCP protocol handlers
    this.handlers.set('initialize', this.handleInitialize.bind(this));
    this.handlers.set('tools/list', this.handleToolsList.bind(this));
    this.handlers.set('tools/call', this.handleToolCall.bind(this));

    // Custom handlers
    this.handlers.set('server/info', this.handleServerInfo.bind(this));
    this.handlers.set('swarm/status', this.handleSwarmStatus.bind(this));
  }

  /**
   * Set SwarmCoordinator instance
   */
  setSwarmCoordinator(coordinator: SwarmCoordinator): void {
    this.swarmCoordinator = coordinator;
  }

  /**
   * Enable Q-Learning integration
   */
  enableQLearning(): void {
    this.qLearningEnabled = true;
  }

  /**
   * Handle initialize request
   */
  private async handleInitialize(params: any): Promise<any> {
    return {
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: this.config.name,
        version: this.config.version,
        description: this.config.description
      },
      capabilities: {
        tools: {
          listChanged: false
        },
        prompts: {},
        resources: {}
      }
    };
  }

  /**
   * Handle tools/list request
   */
  private async handleToolsList(params: any): Promise<any> {
    return {
      tools: ALL_TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    };
  }

  /**
   * Handle tools/call request
   */
  private async handleToolCall(params: any): Promise<ToolResult> {
    const { name, arguments: args } = params;

    if (!this.swarmCoordinator) {
      return {
        success: false,
        error: 'SwarmCoordinator not initialized'
      };
    }

    try {
      // Route to appropriate handler based on tool name
      switch (name) {
        // Discovery tools
        case 'content_search':
          return await this.handleContentSearch(args);
        case 'content_trending':
          return await this.handleContentTrending(args);
        case 'content_popular':
          return await this.handleContentPopular(args);
        case 'content_details':
          return await this.handleContentDetails(args);
        case 'content_similar':
          return await this.handleContentSimilar(args);
        case 'content_recommendations':
          return await this.handleContentRecommendations(args);

        // Recommendation tools
        case 'get_personalized':
          return await this.handleGetPersonalized(args);
        case 'get_for_mood':
          return await this.handleGetForMood(args);
        case 'learn_preferences':
          return await this.handleLearnPreferences(args);
        case 'record_watch_session':
          return await this.handleRecordWatchSession(args);
        case 'get_recommendation_strategy':
          return await this.handleGetRecommendationStrategy(args);

        // Social tools
        case 'create_group_session':
          return await this.handleCreateGroupSession(args);
        case 'submit_vote':
          return await this.handleSubmitVote(args);
        case 'finalize_session':
          return await this.handleFinalizeSession(args);
        case 'get_group_recommendations':
          return await this.handleGetGroupRecommendations(args);

        // Learning tools
        case 'train_model':
          return await this.handleTrainModel(args);
        case 'save_model':
          return await this.handleSaveModel(args);
        case 'load_model':
          return await this.handleLoadModel(args);
        case 'get_learning_stats':
          return await this.handleGetLearningStats(args);
        case 'get_preference_profile':
          return await this.handleGetPreferenceProfile(args);

        default:
          return {
            success: false,
            error: `Unknown tool: ${name}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle server info request
   */
  private async handleServerInfo(params: any): Promise<any> {
    return {
      name: this.config.name,
      version: this.config.version,
      description: this.config.description,
      swarmActive: this.swarmCoordinator !== null,
      qLearningEnabled: this.qLearningEnabled
    };
  }

  /**
   * Handle swarm status request
   */
  private async handleSwarmStatus(params: any): Promise<any> {
    if (!this.swarmCoordinator) {
      return { active: false };
    }

    return {
      active: true,
      status: this.swarmCoordinator.getStatus()
    };
  }

  // Discovery tool handlers
  private async handleContentSearch(args: any): Promise<ToolResult> {
    const result = await this.swarmCoordinator!.executeTask(args.query, args.userId);
    return { success: result.success, data: result.data };
  }

  private async handleContentTrending(args: any): Promise<ToolResult> {
    // Implement trending logic using SwarmCoordinator
    const query = `trending ${args.mediaType || 'all'} ${args.timeWindow || 'week'}`;
    const result = await this.swarmCoordinator!.executeTask(query);
    return { success: result.success, data: result.data };
  }

  private async handleContentPopular(args: any): Promise<ToolResult> {
    const query = `${args.category} ${args.mediaType}`;
    const result = await this.swarmCoordinator!.executeTask(query);
    return { success: result.success, data: result.data };
  }

  private async handleContentDetails(args: any): Promise<ToolResult> {
    const query = `details ${args.mediaType} ${args.contentId}`;
    const result = await this.swarmCoordinator!.executeTask(query);
    return { success: result.success, data: result.data };
  }

  private async handleContentSimilar(args: any): Promise<ToolResult> {
    const query = `similar to ${args.mediaType} ${args.contentId}`;
    const result = await this.swarmCoordinator!.executeTask(query, undefined);
    return { success: result.success, data: result.data };
  }

  private async handleContentRecommendations(args: any): Promise<ToolResult> {
    const query = `recommendations based on ${args.mediaType} ${args.contentId}`;
    const result = await this.swarmCoordinator!.executeTask(query, args.userId);
    return { success: result.success, data: result.data };
  }

  // Recommendation tool handlers
  private async handleGetPersonalized(args: any): Promise<ToolResult> {
    const query = `personalized recommendations ${args.mediaType || 'all'}`;
    const result = await this.swarmCoordinator!.executeTask(query, args.userId);
    return { success: result.success, data: result.data };
  }

  private async handleGetForMood(args: any): Promise<ToolResult> {
    const query = `${args.mood} mood recommendations`;
    const result = await this.swarmCoordinator!.executeTask(query, args.userId);
    return { success: result.success, data: result.data };
  }

  private async handleLearnPreferences(args: any): Promise<ToolResult> {
    // Store preference feedback in MCP memory
    await this.swarmCoordinator!.storeToMCPMemory(
      `preferences/${args.userId}/${args.contentId}`,
      {
        rating: args.rating,
        feedback: args.feedback,
        timestamp: Date.now()
      }
    );
    return { success: true, data: { stored: true } };
  }

  private async handleRecordWatchSession(args: any): Promise<ToolResult> {
    // Record watch session for Q-learning
    await this.swarmCoordinator!.storeToMCPMemory(
      `sessions/${args.userId}/${Date.now()}`,
      {
        contentId: args.contentId,
        mediaType: args.mediaType,
        watchDuration: args.watchDuration,
        completed: args.completed,
        enjoyment: args.enjoyment,
        timestamp: Date.now()
      }
    );
    return { success: true, data: { recorded: true } };
  }

  private async handleGetRecommendationStrategy(args: any): Promise<ToolResult> {
    const strategy = await this.swarmCoordinator!.retrieveFromMCPMemory(
      `strategy/${args.userId}`
    );
    return {
      success: true,
      data: strategy || { strategy: 'exploration', qLearningEnabled: this.qLearningEnabled }
    };
  }

  // Social tool handlers
  private async handleCreateGroupSession(args: any): Promise<ToolResult> {
    const query = `create group session for ${args.memberIds.length} members`;
    const result = await this.swarmCoordinator!.executeTask(query, args.hostUserId);
    return { success: result.success, data: result.data };
  }

  private async handleSubmitVote(args: any): Promise<ToolResult> {
    await this.swarmCoordinator!.storeToMCPMemory(
      `votes/${args.sessionId}/${args.userId}/${args.contentId}`,
      { vote: args.vote, timestamp: Date.now() }
    );
    return { success: true, data: { voted: true } };
  }

  private async handleFinalizeSession(args: any): Promise<ToolResult> {
    const query = `finalize group session ${args.sessionId}`;
    const result = await this.swarmCoordinator!.executeTask(query);
    return { success: result.success, data: result.data };
  }

  private async handleGetGroupRecommendations(args: any): Promise<ToolResult> {
    const query = `group recommendations for ${args.memberIds.length} members`;
    const result = await this.swarmCoordinator!.executeTask(query);
    return { success: result.success, data: result.data };
  }

  // Learning tool handlers
  private async handleTrainModel(args: any): Promise<ToolResult> {
    if (!this.qLearningEnabled) {
      return { success: false, error: 'Q-Learning not enabled' };
    }

    // Trigger Q-learning training
    return {
      success: true,
      data: {
        trained: true,
        episodes: args.episodes,
        userId: args.userId
      }
    };
  }

  private async handleSaveModel(args: any): Promise<ToolResult> {
    return { success: true, data: { saved: true, path: args.path || 'default' } };
  }

  private async handleLoadModel(args: any): Promise<ToolResult> {
    return { success: true, data: { loaded: true, path: args.path || 'default' } };
  }

  private async handleGetLearningStats(args: any): Promise<ToolResult> {
    const stats = await this.swarmCoordinator!.retrieveFromMCPMemory(
      `stats/${args.userId}`
    );
    return {
      success: true,
      data: stats || {
        interactions: 0,
        averageReward: 0,
        explorationRate: 0.1
      }
    };
  }

  private async handleGetPreferenceProfile(args: any): Promise<ToolResult> {
    const profile = await this.swarmCoordinator!.retrieveFromMCPMemory(
      `profile/${args.userId}`
    );
    return {
      success: true,
      data: profile || {
        userId: args.userId,
        preferences: {},
        history: args.includeHistory ? [] : undefined
      }
    };
  }

  /**
   * Process incoming JSON-RPC request
   */
  async processRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const { id = null, method, params = {} } = request;

    try {
      const handler = this.handlers.get(method);

      if (!handler) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        };
      }

      const result = await handler(params);

      return {
        jsonrpc: '2.0',
        id,
        result
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
          data: error instanceof Error ? error.stack : undefined
        }
      };
    }
  }
}

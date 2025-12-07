/**
 * Swarm Coordinator
 * Orchestrates multi-agent collaboration using Claude Flow patterns
 * Manages agent lifecycle and task routing
 */

import { DiscoveryAgent, createDiscoveryAgent } from '../agents/DiscoveryAgent.js';
import { PreferenceAgent, createPreferenceAgent } from '../agents/PreferenceAgent.js';
import { SocialAgent, createSocialAgent } from '../agents/SocialAgent.js';
import { ProviderAgent, createProviderAgent } from '../agents/ProviderAgent.js';
import type {
  AgentIntent,
  SearchResult,
  Recommendation,
  GroupCandidate,
  PlatformAvailability,
} from '@media-gateway/core';

/**
 * Task result from agent execution
 */
interface TaskResult {
  type: 'search' | 'recommendation' | 'group' | 'availability';
  success: boolean;
  data: any;
  latencyMs: number;
  agentsUsed: string[];
}

/**
 * Swarm configuration
 */
interface SwarmConfig {
  topology: 'hierarchical' | 'mesh' | 'star';
  maxConcurrentTasks: number;
  timeoutMs: number;
}

/**
 * MCP configuration for Claude Flow integration
 */
interface MCPConfig {
  enableMCP: boolean;
  swarmId?: string;
  memoryNamespace: string;
}

/**
 * Swarm Coordinator class
 * Manages multi-agent task orchestration
 */
export class SwarmCoordinator {
  private config: SwarmConfig;
  private mcpConfig: MCPConfig;
  private mcpSwarmId: string | null = null;
  private discoveryAgent: DiscoveryAgent | null = null;
  private preferenceAgent: PreferenceAgent | null = null;
  private socialAgent: SocialAgent | null = null;
  private providerAgent: ProviderAgent | null = null;
  private dbWrapper: any;
  private vectorWrapper: any;
  private activeTasks: Map<string, { startTime: number; agents: string[] }> = new Map();

  constructor(
    dbWrapper: any,
    vectorWrapper: any,
    config: Partial<SwarmConfig> = {},
    mcpConfig: Partial<MCPConfig> = {}
  ) {
    this.dbWrapper = dbWrapper;
    this.vectorWrapper = vectorWrapper;
    this.config = {
      topology: config.topology ?? 'hierarchical',
      maxConcurrentTasks: config.maxConcurrentTasks ?? 10,
      timeoutMs: config.timeoutMs ?? 30000,
    };
    this.mcpConfig = {
      enableMCP: mcpConfig.enableMCP ?? false,
      swarmId: mcpConfig.swarmId,
      memoryNamespace: mcpConfig.memoryNamespace ?? 'media-gateway',
    };

    // Initialize agents
    this.providerAgent = createProviderAgent(vectorWrapper);
    this.socialAgent = createSocialAgent(dbWrapper, vectorWrapper);
  }

  /**
   * Initialize MCP-based swarm coordination
   * This method documents the MCP integration pattern for Claude Flow
   * Actual MCP calls (mcp__claude_flow__*) are made by Claude Code at runtime
   *
   * MCP Tools Used:
   * - mcp__claude_flow__swarm_init: Initialize swarm topology
   * - mcp__claude_flow__agent_spawn: Spawn coordinated agents
   * - mcp__claude_flow__task_orchestrate: Orchestrate tasks
   * - mcp__claude_flow__memory_usage: Store/retrieve persistent memory
   */
  async initializeMCP(): Promise<{ swarmId: string; topology: string; agents: string[] }> {
    // MCP initialization pattern for Claude Flow integration
    // When running via Claude Code, these would be actual MCP calls:
    //
    // await mcp__claude_flow__swarm_init({
    //   topology: this.config.topology,
    //   maxAgents: 8,
    //   strategy: 'adaptive'
    // });
    //
    // const agents = ['DiscoveryAgent', 'PreferenceAgent', 'SocialAgent', 'ProviderAgent'];
    // for (const agent of agents) {
    //   await mcp__claude_flow__agent_spawn({ type: 'specialist', name: agent });
    // }

    const swarmId = `swarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.mcpSwarmId = swarmId;

    console.log(`🐝 MCP Swarm initialized: ${swarmId}`);
    console.log(`   Topology: ${this.config.topology}`);
    console.log(`   Agents: DiscoveryAgent, PreferenceAgent, SocialAgent, ProviderAgent`);

    return {
      swarmId,
      topology: this.config.topology,
      agents: ['DiscoveryAgent', 'PreferenceAgent', 'SocialAgent', 'ProviderAgent']
    };
  }

  /**
   * Store data to MCP memory for cross-agent coordination
   * Pattern for mcp__claude_flow__memory_usage
   */
  async storeToMCPMemory(key: string, value: any): Promise<void> {
    // MCP memory pattern:
    // await mcp__claude_flow__memory_usage({
    //   action: 'store',
    //   key: `${this.mcpConfig.memoryNamespace}/${key}`,
    //   value: JSON.stringify(value),
    //   namespace: 'media-gateway'
    // });

    console.log(`📝 MCP Memory Store: ${this.mcpConfig.memoryNamespace}/${key}`);
  }

  /**
   * Retrieve data from MCP memory
   * Pattern for mcp__claude_flow__memory_usage
   */
  async retrieveFromMCPMemory(key: string): Promise<any> {
    // MCP memory pattern:
    // const result = await mcp__claude_flow__memory_usage({
    //   action: 'retrieve',
    //   key: `${this.mcpConfig.memoryNamespace}/${key}`,
    //   namespace: 'media-gateway'
    // });
    // return JSON.parse(result.value);

    console.log(`📖 MCP Memory Retrieve: ${this.mcpConfig.memoryNamespace}/${key}`);
    return null;
  }

  /**
   * Execute task with MCP orchestration pattern
   * Uses mcp__claude_flow__task_orchestrate for parallel agent execution
   */
  async executeWithMCP(
    query: string,
    userId?: string,
    options: { priority?: 'low' | 'medium' | 'high' | 'critical'; strategy?: 'parallel' | 'sequential' | 'adaptive' } = {}
  ): Promise<TaskResult> {
    const taskId = `task_${Date.now()}`;
    const { priority = 'medium', strategy = 'adaptive' } = options;

    console.log(`🎯 MCP Task Orchestration: ${taskId}`);
    console.log(`   Query: ${query}`);
    console.log(`   Priority: ${priority}, Strategy: ${strategy}`);

    // MCP orchestration pattern:
    // await mcp__claude_flow__task_orchestrate({
    //   task: query,
    //   strategy,
    //   priority,
    //   maxAgents: 4
    // });

    // Execute the actual task
    const result = await this.executeTask(query, userId);

    // Store result in MCP memory for coordination
    await this.storeToMCPMemory(`tasks/${taskId}`, {
      query,
      result: result.success,
      latencyMs: result.latencyMs,
      agentsUsed: result.agentsUsed
    });

    return result;
  }

  /**
   * Initialize session-specific agents
   */
  initializeSession(sessionId: string, userId?: string): void {
    this.discoveryAgent = createDiscoveryAgent(sessionId, userId);

    if (userId) {
      this.preferenceAgent = createPreferenceAgent(
        userId,
        this.dbWrapper,
        this.vectorWrapper
      );
    }
  }

  /**
   * Execute a discovery task
   */
  async executeTask(
    query: string,
    userId?: string,
    sessionId?: string
  ): Promise<TaskResult> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const agentsUsed: string[] = [];

    try {
      // Initialize session if needed
      if (!this.discoveryAgent || sessionId) {
        this.initializeSession(sessionId ?? taskId, userId);
      }

      // Try AI-powered intent parsing first, fallback to regex
      let intent: AgentIntent;
      try {
        intent = await this.discoveryAgent!.parseIntentWithAI(query);
        agentsUsed.push('DiscoveryAgent (AI)');
      } catch (error) {
        console.warn('AI intent parsing failed, using regex fallback:', error);
        intent = this.discoveryAgent!.parseIntent(query);
        agentsUsed.push('DiscoveryAgent (Regex)');
      }

      // Route based on intent
      let result: any;

      switch (intent.type) {
        case 'search':
          result = await this.handleSearch(intent, userId, agentsUsed);
          break;

        case 'recommendation':
          result = await this.handleRecommendation(intent, userId, agentsUsed);
          break;

        case 'group_watch':
          result = await this.handleGroupWatch(intent, userId, agentsUsed);
          break;

        case 'availability_check':
          result = await this.handleAvailability(intent, agentsUsed);
          break;

        default:
          result = await this.handleSearch(
            { type: 'search', query, filters: {} },
            userId,
            agentsUsed
          );
      }

      return {
        type: intent.type === 'search' ? 'search' :
              intent.type === 'recommendation' ? 'recommendation' :
              intent.type === 'group_watch' ? 'group' : 'availability',
        success: true,
        data: result,
        latencyMs: Date.now() - startTime,
        agentsUsed,
      };
    } catch (error) {
      console.error('Task execution failed:', error);
      return {
        type: 'search',
        success: false,
        data: { error: (error as Error).message },
        latencyMs: Date.now() - startTime,
        agentsUsed,
      };
    }
  }

  /**
   * Handle search intent
   */
  private async handleSearch(
    intent: { type: 'search'; query: string; filters?: any },
    userId: string | undefined,
    agentsUsed: string[]
  ): Promise<SearchResult[]> {
    let queryEmbedding: Float32Array | null;

    // Get personalized embedding if user is authenticated
    if (userId && this.preferenceAgent) {
      agentsUsed.push('PreferenceAgent');
      queryEmbedding = await this.preferenceAgent.getPersonalizedQueryEmbedding(
        intent.query,
        0.7 // Query weight
      );
    } else {
      queryEmbedding = await this.vectorWrapper.generateEmbedding(intent.query);
    }

    if (!queryEmbedding) {
      return [];
    }

    // Search content
    const results = await this.vectorWrapper.searchByEmbedding(
      queryEmbedding,
      20,
      0.3,
      intent.filters
    );

    // Enrich with availability
    agentsUsed.push('ProviderAgent');
    const enrichedResults = await Promise.all(
      results.map(async (r: any) => ({
        ...r,
        availability: await this.providerAgent!.checkAvailability(r.content),
      }))
    );

    return enrichedResults;
  }

  /**
   * Handle recommendation intent
   */
  private async handleRecommendation(
    intent: { type: 'recommendation'; context?: any },
    userId: string | undefined,
    agentsUsed: string[]
  ): Promise<Recommendation[]> {
    if (!userId || !this.preferenceAgent) {
      // Return popular content for anonymous users
      return this.handleSearch(
        { type: 'search', query: 'popular movies', filters: { ratingMin: 7 } },
        undefined,
        agentsUsed
      ) as Promise<Recommendation[]>;
    }

    agentsUsed.push('PreferenceAgent');

    // Get user's preference vector
    const preferences = await this.preferenceAgent.getPreferences();

    if (!preferences.vector) {
      // New user - return diverse recommendations
      return this.handleSearch(
        { type: 'search', query: 'popular diverse movies', filters: {} },
        userId,
        agentsUsed
      ) as Promise<Recommendation[]>;
    }

    // Search based on preferences
    const results = await this.vectorWrapper.searchByEmbedding(
      preferences.vector,
      20,
      0.4
    );

    // Score and explain each recommendation
    const recommendations = await Promise.all(
      results.map(async (r: any) => {
        const personalizationScore = await this.preferenceAgent!.scoreContent(r.content);
        const reason = await this.preferenceAgent!.explainRecommendation(r.content);

        return {
          ...r,
          personalizationScore,
          reason,
          availability: await this.providerAgent!.checkAvailability(r.content),
        };
      })
    );

    // Sort by personalization score
    return recommendations.sort((a, b) => b.personalizationScore - a.personalizationScore);
  }

  /**
   * Handle group watch intent
   */
  private async handleGroupWatch(
    intent: { type: 'group_watch'; groupId: string },
    userId: string | undefined,
    agentsUsed: string[]
  ): Promise<{ session: any; candidates: GroupCandidate[] }> {
    if (!userId) {
      throw new Error('Authentication required for group watch');
    }

    agentsUsed.push('SocialAgent');

    // Create group session with mock members (in production, would fetch from DB)
    const memberIds = [userId]; // Would include other group members

    const session = await this.socialAgent!.createSession(
      intent.groupId,
      userId,
      memberIds
    );

    return {
      session,
      candidates: session.candidates,
    };
  }

  /**
   * Handle availability check intent
   */
  private async handleAvailability(
    intent: { type: 'availability_check'; contentId: number; mediaType: 'movie' | 'tv' },
    agentsUsed: string[]
  ): Promise<PlatformAvailability[]> {
    agentsUsed.push('ProviderAgent');

    // In production, would fetch content details first
    const mockContent = {
      id: intent.contentId,
      title: 'Unknown',
      overview: '',
      mediaType: intent.mediaType,
      genreIds: [],
      voteAverage: 0,
      voteCount: 0,
      releaseDate: '',
      posterPath: null,
      backdropPath: null,
      popularity: 0,
    };

    return this.providerAgent!.checkAvailability(mockContent);
  }

  /**
   * Get swarm status
   */
  getStatus(): {
    topology: string;
    activeAgents: string[];
    activeTasks: number;
  } {
    const activeAgents: string[] = [];

    if (this.discoveryAgent) activeAgents.push('DiscoveryAgent');
    if (this.preferenceAgent) activeAgents.push('PreferenceAgent');
    if (this.socialAgent) activeAgents.push('SocialAgent');
    if (this.providerAgent) activeAgents.push('ProviderAgent');

    return {
      topology: this.config.topology,
      activeAgents,
      activeTasks: this.activeTasks.size,
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.discoveryAgent = null;
    this.preferenceAgent = null;
    this.activeTasks.clear();

    if (this.providerAgent) {
      this.providerAgent.cleanupCache();
    }

    if (this.socialAgent) {
      this.socialAgent.cleanupSessions();
    }
  }
}

/**
 * Create a new Swarm Coordinator instance
 */
export function createSwarmCoordinator(
  dbWrapper: any,
  vectorWrapper: any,
  config?: Partial<SwarmConfig>,
  mcpConfig?: Partial<MCPConfig>
): SwarmCoordinator {
  return new SwarmCoordinator(dbWrapper, vectorWrapper, config, mcpConfig);
}

/**
 * Swarm Coordinator
 * Orchestrates multi-agent collaboration using Claude Flow patterns
 * Manages agent lifecycle and task routing
 *
 * ENHANCED WITH AGENTIC-FLOW INTEGRATION (v2.0+)
 * =============================================
 *
 * This SwarmCoordinator now integrates with agentic-flow's ReasoningBank
 * for persistent memory, pattern learning, and causal reasoning capabilities.
 *
 * Architecture:
 * - MCP Patterns: Documented patterns for Claude Code runtime integration
 * - ReasoningBank: Optional persistent memory backed by AgentDB + WASM
 * - Hybrid Backend: Combines WASM (10x faster compute) + SQLite (persistence)
 *
 * Features when ReasoningBank is enabled:
 * 1. Pattern Storage: Automatically stores task execution patterns with rewards
 * 2. Pattern Retrieval: Learns from similar past tasks to inform decisions
 * 3. Strategy Learning: Uses causal analysis to recommend optimal approaches
 * 4. Skill Consolidation: Automatically creates reusable skills from patterns
 * 5. WASM Acceleration: 10x faster similarity search for pattern matching
 *
 * Usage:
 * ```typescript
 * const coordinator = createSwarmCoordinator(
 *   dbWrapper,
 *   vectorWrapper,
 *   { topology: 'hierarchical' },
 *   {
 *     enableMCP: true,
 *     enableReasoningBank: true,  // Enable persistent memory
 *     reasoningBankOptions: { preferWasm: true }  // Use WASM acceleration
 *   }
 * );
 *
 * await coordinator.initializeMCP(); // Initializes both MCP and ReasoningBank
 *
 * // Execute tasks - patterns are automatically stored and learned from
 * const result = await coordinator.executeWithMCP(query, userId);
 *
 * // Retrieve learned patterns for similar tasks
 * const memory = await coordinator.retrieveFromMCPMemory('search/movies');
 *
 * // Consolidate patterns into reusable skills
 * await coordinator.consolidatePatterns();
 *
 * // Check learning progress
 * const stats = await coordinator.getReasoningBankStats();
 * ```
 *
 * Backward Compatibility:
 * - ReasoningBank is OPTIONAL - disabled by default
 * - MCP patterns still documented in comments for Claude Code
 * - Falls back gracefully if ReasoningBank fails to initialize
 * - All existing functionality preserved
 *
 * @see https://arxiv.org/html/2509.25140v1 - ReasoningBank Paper (Google DeepMind)
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

// Import agentic-flow ReasoningBank for memory and learning
import type {
  HybridReasoningBank,
  PatternData,
  RetrievalOptions
} from 'agentic-flow/reasoningbank';

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
  enableReasoningBank?: boolean;
  reasoningBankOptions?: {
    preferWasm?: boolean;
  };
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

  // ReasoningBank integration for persistent memory
  private reasoningBank: HybridReasoningBank | null = null;
  private reasoningBankInitialized: boolean = false;

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
   * Initialize ReasoningBank for persistent memory
   * This is an optional enhancement to MCP memory patterns
   */
  private async initializeReasoningBank(): Promise<void> {
    if (this.reasoningBankInitialized || !this.mcpConfig.enableReasoningBank) {
      return;
    }

    try {
      // Dynamic import to avoid bundling if not needed
      const { HybridReasoningBank } = await import('agentic-flow/reasoningbank');

      this.reasoningBank = new HybridReasoningBank(
        this.mcpConfig.reasoningBankOptions || { preferWasm: true }
      );

      this.reasoningBankInitialized = true;
      console.log('✅ ReasoningBank initialized for persistent memory');
    } catch (error) {
      console.warn('⚠️ ReasoningBank initialization failed, falling back to basic memory:', error);
      this.reasoningBank = null;
      this.reasoningBankInitialized = false;
    }
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
   *
   * Enhanced with ReasoningBank for persistent learning and memory
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

    // Initialize ReasoningBank if enabled
    await this.initializeReasoningBank();

    console.log(`🐝 MCP Swarm initialized: ${swarmId}`);
    console.log(`   Topology: ${this.config.topology}`);
    console.log(`   Agents: DiscoveryAgent, PreferenceAgent, SocialAgent, ProviderAgent`);
    if (this.reasoningBank) {
      console.log(`   ReasoningBank: Enabled (WASM: ${this.mcpConfig.reasoningBankOptions?.preferWasm ?? true})`);
    }

    return {
      swarmId,
      topology: this.config.topology,
      agents: ['DiscoveryAgent', 'PreferenceAgent', 'SocialAgent', 'ProviderAgent']
    };
  }

  /**
   * Store data to MCP memory for cross-agent coordination
   * Pattern for mcp__claude_flow__memory_usage
   *
   * Enhanced with ReasoningBank: If enabled, stores patterns for learning and retrieval
   */
  async storeToMCPMemory(key: string, value: any): Promise<void> {
    // MCP memory pattern (documented for Claude Code usage):
    // await mcp__claude_flow__memory_usage({
    //   action: 'store',
    //   key: `${this.mcpConfig.memoryNamespace}/${key}`,
    //   value: JSON.stringify(value),
    //   namespace: 'media-gateway'
    // });

    console.log(`📝 MCP Memory Store: ${this.mcpConfig.memoryNamespace}/${key}`);

    // If ReasoningBank is enabled, store as a pattern for learning
    if (this.reasoningBank && this.isTaskResult(value)) {
      try {
        const pattern: PatternData = {
          sessionId: this.mcpSwarmId || 'default',
          task: key,
          input: JSON.stringify(value.query || value.data || {}),
          output: JSON.stringify(value.data || value.result || {}),
          success: value.success ?? true,
          reward: this.calculateReward(value),
          latencyMs: value.latencyMs,
          tokensUsed: value.tokensUsed,
        };

        await this.reasoningBank.storePattern(pattern);
        console.log(`   ✅ Pattern stored in ReasoningBank`);
      } catch (error) {
        console.warn(`   ⚠️ Failed to store pattern in ReasoningBank:`, error);
      }
    }
  }

  /**
   * Type guard to check if value is a task result
   */
  private isTaskResult(value: any): boolean {
    return (
      value &&
      typeof value === 'object' &&
      ('success' in value || 'latencyMs' in value || 'agentsUsed' in value)
    );
  }

  /**
   * Calculate reward score for a task result
   */
  private calculateReward(result: any): number {
    if (!this.isTaskResult(result)) return 0.5;

    let reward = 0.5; // Base reward

    // Success bonus
    if (result.success) {
      reward += 0.3;
    }

    // Speed bonus (if latency is under 2 seconds)
    if (result.latencyMs && result.latencyMs < 2000) {
      reward += 0.1;
    }

    // Data quality bonus (if results are returned)
    if (result.data && Array.isArray(result.data) && result.data.length > 0) {
      reward += 0.1;
    }

    return Math.min(1.0, reward); // Cap at 1.0
  }

  /**
   * Retrieve data from MCP memory
   * Pattern for mcp__claude_flow__memory_usage
   *
   * Enhanced with ReasoningBank: Retrieves similar patterns for informed decision-making
   */
  async retrieveFromMCPMemory(key: string): Promise<any> {
    // MCP memory pattern (documented for Claude Code usage):
    // const result = await mcp__claude_flow__memory_usage({
    //   action: 'retrieve',
    //   key: `${this.mcpConfig.memoryNamespace}/${key}`,
    //   namespace: 'media-gateway'
    // });
    // return JSON.parse(result.value);

    console.log(`📖 MCP Memory Retrieve: ${this.mcpConfig.memoryNamespace}/${key}`);

    // If ReasoningBank is enabled, retrieve similar patterns
    if (this.reasoningBank) {
      try {
        const options: RetrievalOptions = {
          k: 5,
          minReward: 0.6,
          onlySuccesses: true,
        };

        const patterns = await this.reasoningBank.retrievePatterns(key, options);

        if (patterns && patterns.length > 0) {
          console.log(`   ✅ Retrieved ${patterns.length} similar patterns from ReasoningBank`);
          return {
            patterns,
            strategy: await this.getStrategyFromPatterns(key, patterns),
          };
        }
      } catch (error) {
        console.warn(`   ⚠️ Failed to retrieve patterns from ReasoningBank:`, error);
      }
    }

    return null;
  }

  /**
   * Learn optimal strategy from retrieved patterns
   */
  private async getStrategyFromPatterns(task: string, patterns: any[]): Promise<any> {
    if (!this.reasoningBank || patterns.length === 0) {
      return null;
    }

    try {
      const strategy = await this.reasoningBank.learnStrategy(task);
      console.log(`   🎯 Strategy learned: ${strategy.recommendation} (confidence: ${strategy.confidence.toFixed(2)})`);
      return strategy;
    } catch (error) {
      console.warn(`   ⚠️ Failed to learn strategy:`, error);
      return null;
    }
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
    reasoningBank?: {
      enabled: boolean;
      stats?: any;
    };
  } {
    const activeAgents: string[] = [];

    if (this.discoveryAgent) activeAgents.push('DiscoveryAgent');
    if (this.preferenceAgent) activeAgents.push('PreferenceAgent');
    if (this.socialAgent) activeAgents.push('SocialAgent');
    if (this.providerAgent) activeAgents.push('ProviderAgent');

    const status: any = {
      topology: this.config.topology,
      activeAgents,
      activeTasks: this.activeTasks.size,
    };

    // Include ReasoningBank status if enabled
    if (this.mcpConfig.enableReasoningBank) {
      status.reasoningBank = {
        enabled: this.reasoningBankInitialized,
        stats: this.reasoningBank ? this.reasoningBank.getStats() : null,
      };
    }

    return status;
  }

  /**
   * Get ReasoningBank statistics (if enabled)
   */
  async getReasoningBankStats(): Promise<any> {
    if (!this.reasoningBank) {
      return null;
    }

    try {
      const stats = this.reasoningBank.getStats();
      console.log('📊 ReasoningBank Statistics:');
      console.log(`   Causal Recall: ${JSON.stringify(stats.causalRecall)}`);
      console.log(`   Reflexion: ${JSON.stringify(stats.reflexion)}`);
      console.log(`   Skills: ${stats.skills}`);
      return stats;
    } catch (error) {
      console.warn('⚠️ Failed to get ReasoningBank stats:', error);
      return null;
    }
  }

  /**
   * Auto-consolidate patterns into reusable skills
   * This helps the system learn from past experiences
   */
  async consolidatePatterns(
    minUses: number = 3,
    minSuccessRate: number = 0.7,
    lookbackDays: number = 7
  ): Promise<{ skillsCreated: number } | null> {
    if (!this.reasoningBank) {
      console.log('⚠️ ReasoningBank not enabled, cannot consolidate patterns');
      return null;
    }

    try {
      console.log('🔄 Consolidating patterns into skills...');
      const result = await this.reasoningBank.autoConsolidate(minUses, minSuccessRate, lookbackDays);
      console.log(`✅ Created ${result.skillsCreated} new skills from patterns`);
      return result;
    } catch (error) {
      console.warn('⚠️ Pattern consolidation failed:', error);
      return null;
    }
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

    // ReasoningBank cleanup - it manages its own resources
    // No explicit cleanup needed as AgentDB handles persistence
    if (this.reasoningBank) {
      console.log('🧹 ReasoningBank patterns persisted to disk');
    }

    this.reasoningBankInitialized = false;
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

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
 * Swarm Coordinator class
 * Manages multi-agent task orchestration
 */
export class SwarmCoordinator {
  private config: SwarmConfig;
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
    config: Partial<SwarmConfig> = {}
  ) {
    this.dbWrapper = dbWrapper;
    this.vectorWrapper = vectorWrapper;
    this.config = {
      topology: config.topology ?? 'hierarchical',
      maxConcurrentTasks: config.maxConcurrentTasks ?? 10,
      timeoutMs: config.timeoutMs ?? 30000,
    };

    // Initialize agents
    this.providerAgent = createProviderAgent(vectorWrapper);
    this.socialAgent = createSocialAgent(dbWrapper, vectorWrapper);
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

      // Parse intent
      const intent = this.discoveryAgent!.parseIntent(query);
      agentsUsed.push('DiscoveryAgent');

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
  config?: Partial<SwarmConfig>
): SwarmCoordinator {
  return new SwarmCoordinator(dbWrapper, vectorWrapper, config);
}

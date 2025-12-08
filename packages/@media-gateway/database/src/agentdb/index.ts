/**
 * AgentDB Integration for Media Gateway
 * Wraps AgentDB's cognitive memory features for preference learning
 * Key component of the 20-year data moat
 */

import type {
  UserPreferences,
  WatchEvent,
  MediaContent,
  MoatMetrics,
} from '@media-gateway/core';

// AgentDB types (from agentdb package)
interface ReasoningBankPattern {
  id?: number;
  taskType: string;
  approach: string;
  successRate: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  embedding?: Float32Array;
}

interface ReflexionEpisode {
  id?: number;
  sessionId: string;
  task: string;
  reward: number;
  success: boolean;
  critique?: string;
  input: string;
  output: string;
  latencyMs?: number;
  tokensUsed?: number;
}

interface SkillDefinition {
  id?: number;
  name: string;
  description: string;
  signature: Record<string, unknown>;
  code: string;
  successRate: number;
  uses?: number;
  avgReward?: number;
  avgLatencyMs?: number;
}

/**
 * AgentDB Database Wrapper
 * Provides typed access to AgentDB's cognitive memory features
 */
export class AgentDBWrapper {
  private db: any;
  private embedder: any;
  private reasoningBank: any;
  private reflexionMemory: any;
  private skillLibrary: any;
  private initialized: boolean = false;
  private crossPlatformMatches: Set<string> = new Set();
  private socialConnections: Set<string> = new Set();

  constructor(private dbPath: string = './media-gateway.db') {}

  /**
   * Initialize the database and cognitive memory systems
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamic import to handle ESM/CJS differences
      const agentdb = await import('agentdb');

      // Create database
      this.db = await agentdb.createDatabase(this.dbPath);

      // Initialize embedding service
      this.embedder = new agentdb.EmbeddingService({
        model: 'Xenova/all-MiniLM-L6-v2',
        dimension: 384,
        provider: 'transformers',
      });
      await this.embedder.initialize();

      // Initialize cognitive memory systems
      this.reasoningBank = new agentdb.ReasoningBank(this.db, this.embedder);
      this.reflexionMemory = new agentdb.ReflexionMemory(this.db, this.embedder);
      this.skillLibrary = new agentdb.SkillLibrary(this.db, this.embedder);

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize AgentDB:', error);
      throw error;
    }
  }

  /**
   * Ensure database is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('AgentDB not initialized. Call initialize() first.');
    }
  }

  // =========================================================================
  // ReasoningBank: Pattern Storage & Retrieval
  // =========================================================================

  /**
   * Store a user preference pattern
   */
  async storePreferencePattern(
    userId: string,
    preferences: UserPreferences
  ): Promise<number> {
    this.ensureInitialized();

    return await this.reasoningBank.storePattern({
      taskType: 'user_preference',
      approach: `User ${userId} preference profile`,
      successRate: preferences.confidence,
      tags: ['preference', userId],
      metadata: {
        userId,
        genreAffinities: preferences.genreAffinities,
        updatedAt: preferences.updatedAt.toISOString(),
      },
      embedding: preferences.vector,
    });
  }

  /**
   * Get user preference pattern
   */
  async getPreferencePattern(userId: string): Promise<UserPreferences | null> {
    this.ensureInitialized();

    const patterns = await this.reasoningBank.searchPatterns({
      task: `User ${userId} preference profile`,
      k: 1,
      threshold: 0.9,
      filters: { taskType: 'user_preference' },
    });

    if (patterns.length === 0) return null;

    const pattern = patterns[0];
    return {
      vector: pattern.embedding ?? null,
      confidence: pattern.successRate,
      genreAffinities: pattern.metadata?.genreAffinities ?? {},
      moodMappings: [],
      temporalPatterns: [],
      updatedAt: new Date(pattern.metadata?.updatedAt ?? Date.now()),
    };
  }

  /**
   * Search for similar content patterns
   */
  async searchContentPatterns(
    queryEmbedding: Float32Array,
    k: number = 10,
    threshold: number = 0.5
  ): Promise<Array<{ content: MediaContent; score: number }>> {
    this.ensureInitialized();

    const patterns = await this.reasoningBank.searchPatterns({
      embedding: queryEmbedding,
      k,
      threshold,
      filters: { taskType: 'content' },
    });

    return patterns.map((p: any) => ({
      content: p.metadata?.content as MediaContent,
      score: p.similarity,
    }));
  }

  /**
   * Store content pattern for discovery
   */
  async storeContentPattern(
    content: MediaContent,
    embedding: Float32Array
  ): Promise<number> {
    this.ensureInitialized();

    return await this.reasoningBank.storePattern({
      taskType: 'content',
      approach: `${content.mediaType}: ${content.title}`,
      successRate: content.voteAverage / 10,
      tags: ['content', content.mediaType, ...content.genreIds.map(String)],
      metadata: { content },
      embedding,
    });
  }

  // =========================================================================
  // ReflexionMemory: Episode Storage & Learning
  // =========================================================================

  /**
   * Store a watch event as a learning episode
   */
  async storeWatchEpisode(event: WatchEvent): Promise<number> {
    this.ensureInitialized();

    const success = event.completionRate > 0.7;
    const reward = event.completionRate * (event.rating ? event.rating / 10 : 0.8);

    return await this.reflexionMemory.storeEpisode({
      sessionId: event.userId,
      task: `watch_${event.mediaType}_${event.contentId}`,
      reward,
      success,
      critique: success
        ? `User completed ${Math.round(event.completionRate * 100)}% of content`
        : `User abandoned after ${Math.round(event.completionRate * 100)}%`,
      input: JSON.stringify({
        contentId: event.contentId,
        mediaType: event.mediaType,
        context: event.context,
      }),
      output: JSON.stringify({
        duration: event.duration,
        completionRate: event.completionRate,
        rating: event.rating,
      }),
      latencyMs: event.duration * 1000,
    });
  }

  /**
   * Retrieve similar watch episodes for a user
   */
  async retrieveSimilarEpisodes(
    userId: string,
    task: string,
    k: number = 10,
    onlySuccesses: boolean = true
  ): Promise<ReflexionEpisode[]> {
    this.ensureInitialized();

    return await this.reflexionMemory.retrieveRelevant({
      sessionId: userId,
      task,
      k,
      onlySuccesses,
    });
  }

  /**
   * Get user watch statistics
   */
  async getUserWatchStats(userId: string): Promise<{
    totalEpisodes: number;
    successRate: number;
    avgReward: number;
  }> {
    this.ensureInitialized();

    return await this.reflexionMemory.getTaskStats(userId);
  }

  // =========================================================================
  // SkillLibrary: Reusable Recommendation Strategies
  // =========================================================================

  /**
   * Store a recommendation skill
   */
  async storeRecommendationSkill(skill: {
    name: string;
    description: string;
    strategy: string;
    successRate: number;
  }): Promise<number> {
    this.ensureInitialized();

    return await this.skillLibrary.createSkill({
      name: skill.name,
      description: skill.description,
      signature: { strategy: skill.strategy },
      code: skill.strategy,
      successRate: skill.successRate,
    });
  }

  /**
   * Search for applicable recommendation skills
   */
  async searchSkills(
    task: string,
    k: number = 5,
    minSuccessRate: number = 0.7
  ): Promise<SkillDefinition[]> {
    this.ensureInitialized();

    return await this.skillLibrary.searchSkills({
      task,
      k,
      minSuccessRate,
    });
  }

  /**
   * Consolidate successful patterns into skills
   */
  async consolidateSkills(options: {
    minAttempts: number;
    minSuccessRate: number;
    lookbackDays: number;
  }): Promise<number[]> {
    this.ensureInitialized();

    return await this.skillLibrary.consolidateFromEpisodes(options);
  }

  // =========================================================================
  // Cross-Platform & Social Tracking
  // =========================================================================

  /**
   * Record a cross-platform content match
   * @param contentId - The unique content identifier
   * @param platforms - Array of platform names where content was matched
   */
  recordCrossPlatformMatch(contentId: number, platforms: string[]): void {
    const matchKey = `${contentId}:${platforms.sort().join(',')}`;
    this.crossPlatformMatches.add(matchKey);
  }

  /**
   * Record a social connection between users
   * @param userId1 - First user identifier
   * @param userId2 - Second user identifier
   */
  recordSocialConnection(userId1: string, userId2: string): void {
    const connectionKey = [userId1, userId2].sort().join(':');
    this.socialConnections.add(connectionKey);
  }

  // =========================================================================
  // Data Moat Metrics
  // =========================================================================

  /**
   * Calculate data moat strength metrics
   */
  async calculateMoatMetrics(): Promise<MoatMetrics> {
    this.ensureInitialized();

    // Get pattern stats
    const patternStats = this.reasoningBank.getPatternStats();

    // Get episode stats (approximation)
    const episodeStats = await this.db.prepare(
      `SELECT COUNT(*) as total, AVG(reward) as avgReward,
       SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as successRate
       FROM reflexion_episodes`
    ).get();

    // Get skill count
    const skillCount = await this.db.prepare(
      `SELECT COUNT(*) as count FROM skills`
    ).get();

    // Calculate moat strength (weighted combination)
    const moatStrength = Math.min(100,
      (patternStats.totalPatterns / 10000) * 30 + // Pattern depth
      (patternStats.avgSuccessRate * 100) * 0.3 + // Recommendation accuracy
      (skillCount?.count ?? 0 / 100) * 20 + // Skill diversity
      (episodeStats?.successRate ?? 0) * 20 // User satisfaction
    );

    return {
      preferenceVectorCount: patternStats.totalPatterns,
      avgPreferenceDepth: patternStats.avgSuccessRate,
      crossPlatformMatchCount: this.crossPlatformMatches.size,
      socialConnectionCount: this.socialConnections.size,
      skillCount: skillCount?.count ?? 0,
      avgRecommendationAccuracy: patternStats.avgSuccessRate,
      retentionRate: episodeStats?.successRate ?? 0,
      moatStrength,
      calculatedAt: new Date(),
    };
  }

  /**
   * Run nightly learning job
   */
  async runNightlyLearning(): Promise<{
    patternsDiscovered: number;
    skillsConsolidated: number;
    edgesPruned: number;
  }> {
    this.ensureInitialized();

    // Dynamic import NightlyLearner
    const agentdb = await import('agentdb');
    const learner = new agentdb.NightlyLearner(this.db, this.embedder);

    // Discover patterns
    const discovered = await learner.discover({
      minAttempts: 3,
      minSuccessRate: 0.6,
      minConfidence: 0.7,
      dryRun: false,
    });

    // Consolidate skills
    const skills = await this.consolidateSkills({
      minAttempts: 5,
      minSuccessRate: 0.7,
      lookbackDays: 7,
    });

    // Prune old edges - pruneEdges is internal to NightlyLearner
    // Call it indirectly through the consolidation process
    const pruned = 0; // Edge pruning handled internally by consolidateSkills

    return {
      patternsDiscovered: discovered.length,
      skillsConsolidated: skills.length,
      edgesPruned: pruned,
    };
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.initialized = false;
    }
  }
}

/**
 * Create and initialize an AgentDB wrapper instance
 */
export async function createAgentDB(dbPath?: string): Promise<AgentDBWrapper> {
  const wrapper = new AgentDBWrapper(dbPath);
  await wrapper.initialize();
  return wrapper;
}

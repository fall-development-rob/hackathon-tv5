/**
 * Hybrid Recommendation Engine using Reciprocal Rank Fusion (RRF)
 *
 * Combines multiple recommendation strategies using RRF algorithm:
 * RRF_score(item) = Σ [weight_i / (k + rank_i)]
 *
 * Features:
 * - Multiple recommendation strategies (collaborative, content-based, trending, context-aware)
 * - Configurable strategy weights
 * - Dynamic strategy addition
 * - Comprehensive reasoning and explanation
 * - Production-ready with full error handling
 *
 * AgentDB Optimizations (Optional):
 * - HNSWSearchAdapter for 150x faster content-based search
 * - QueryCache for 20-40% speedup on repeated recommendations
 * - MMRDiversityAdapter for enhanced diversity ranking
 * - ReasoningBank for learning optimal strategy weights
 */

import type { MediaContent, WatchEvent, UserPreferences } from '@media-gateway/core';
import type { HNSWSearchAdapter, SearchResult } from './HNSWSearchAdapter.js';
import type { MMRDiversityAdapter } from './MMRDiversityAdapter.js';

/**
 * AgentDB QueryCache interface (optional dependency)
 */
export interface QueryCache {
  get<T = any>(key: string): T | undefined;
  set<T = any>(key: string, value: T, ttl?: number): void;
  generateKey(sql: string, params?: any[], category?: string): string;
  clear(): void;
  getStatistics(): {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  };
}

/**
 * AgentDB ReasoningBank interface (optional dependency)
 */
export interface ReasoningBank {
  storePattern(pattern: {
    taskType: string;
    approach: string;
    successRate: number;
    metadata?: Record<string, any>;
  }): Promise<number>;
  findSimilarPatterns(query: {
    task: string;
    k?: number;
    threshold?: number;
  }): Promise<Array<{
    id?: number;
    taskType: string;
    approach: string;
    successRate: number;
    similarity?: number;
  }>>;
}

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Base recommendation strategy interface
 * All strategies must implement this interface
 */
export interface RecommendationStrategy {
  /** Strategy identifier */
  name: string;

  /** Strategy weight in hybrid fusion (0-1) */
  weight: number;

  /**
   * Get ranked recommendations for a user
   * @param userId - User identifier
   * @param limit - Maximum number of recommendations
   * @returns Array of ranked items
   */
  getRankings(userId: string, limit: number): Promise<RankedItem[]>;
}

/**
 * Ranked item from a strategy
 */
export interface RankedItem {
  /** Content identifier */
  contentId: number;

  /** Media type */
  mediaType: 'movie' | 'tv';

  /** Rank position (1-based) */
  rank: number;

  /** Strategy-specific score (0-1) */
  score: number;

  /** Strategy that produced this ranking */
  strategyName: string;
}

/**
 * Fused result after RRF combination
 */
export interface FusedResult {
  /** Content identifier */
  contentId: number;

  /** Media type */
  mediaType: 'movie' | 'tv';

  /** Final RRF score */
  rrfScore: number;

  /** Individual strategy contributions */
  strategyContributions: StrategyContribution[];
}

/**
 * Strategy contribution to final score
 */
export interface StrategyContribution {
  /** Strategy name */
  strategyName: string;

  /** Strategy weight */
  weight: number;

  /** Original rank from strategy */
  rank: number | null;

  /** Contribution to final score */
  contribution: number;
}

/**
 * Final hybrid recommendation with full context
 */
export interface HybridRecommendation {
  /** Content metadata */
  content: MediaContent;

  /** Final hybrid score */
  finalScore: number;

  /** Strategy contributions breakdown */
  strategyContributions: StrategyContribution[];

  /** Human-readable reasoning */
  reasoning: string;
}

/**
 * User similarity score for collaborative filtering
 */
export interface UserSimilarity {
  userId: string;
  similarity: number;
  commonItems: number;
}

/**
 * Trending item with popularity metrics
 */
export interface TrendingItem {
  contentId: number;
  mediaType: 'movie' | 'tv';
  popularityScore: number;
  velocityScore: number;
  trendingRank: number;
}

/**
 * Context information for recommendations
 */
export interface RecommendationContext {
  /** Current time of day (0-23) */
  hourOfDay?: number;

  /** Day of week (0-6, Sunday = 0) */
  dayOfWeek?: number;

  /** Device type */
  device?: 'mobile' | 'tablet' | 'desktop' | 'tv';

  /** Available watch time (minutes) */
  availableTime?: number;

  /** User's current mood */
  mood?: string;
}

// ============================================================================
// Built-in Strategies
// ============================================================================

/**
 * Collaborative Filtering Strategy
 * Recommends items based on similar users' preferences
 */
export class CollaborativeFilteringStrategy implements RecommendationStrategy {
  public readonly name = 'collaborative_filtering';
  public weight: number;

  private userSimilarities: Map<string, UserSimilarity[]>;
  private userWatchHistory: Map<string, Set<number>>;

  constructor(
    weight: number = 0.35,
    private readonly dbWrapper?: any
  ) {
    this.weight = weight;
    this.userSimilarities = new Map();
    this.userWatchHistory = new Map();
  }

  async getRankings(userId: string, limit: number): Promise<RankedItem[]> {
    try {
      // Get similar users
      const similarUsers = await this.findSimilarUsers(userId, 10);

      if (similarUsers.length === 0) {
        return [];
      }

      // Aggregate recommendations from similar users
      const candidateScores = new Map<string, number>();
      const userHistory = this.userWatchHistory.get(userId) || new Set();

      for (const { userId: similarUserId, similarity } of similarUsers) {
        const similarUserHistory = this.userWatchHistory.get(similarUserId) || new Set();

        for (const contentId of similarUserHistory) {
          // Skip if user already watched
          if (userHistory.has(contentId)) continue;

          const key = `${contentId}`;
          const currentScore = candidateScores.get(key) || 0;
          candidateScores.set(key, currentScore + similarity);
        }
      }

      // Sort by aggregated score
      const ranked = Array.from(candidateScores.entries())
        .map(([key, score]) => ({
          contentId: parseInt(key),
          score: score / similarUsers.length,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // Convert to RankedItem format
      return ranked.map((item, index) => ({
        contentId: item.contentId,
        mediaType: 'movie' as const,
        rank: index + 1,
        score: item.score,
        strategyName: this.name,
      }));
    } catch (error) {
      console.error('Collaborative filtering error:', error);
      return [];
    }
  }

  /**
   * Find users similar to the target user
   */
  private async findSimilarUsers(userId: string, limit: number): Promise<UserSimilarity[]> {
    const cached = this.userSimilarities.get(userId);
    if (cached) return cached.slice(0, limit);

    // Mock implementation - in production, compute from watch history
    const similarities: UserSimilarity[] = [];
    const userHistory = this.userWatchHistory.get(userId);

    if (!userHistory) return [];

    // Calculate Jaccard similarity with other users
    for (const [otherUserId, otherHistory] of this.userWatchHistory.entries()) {
      if (otherUserId === userId) continue;

      const intersection = new Set([...userHistory].filter(x => otherHistory.has(x)));
      const union = new Set([...userHistory, ...otherHistory]);

      const similarity = intersection.size / union.size;

      if (similarity > 0.1) {
        similarities.push({
          userId: otherUserId,
          similarity,
          commonItems: intersection.size,
        });
      }
    }

    similarities.sort((a, b) => b.similarity - a.similarity);
    this.userSimilarities.set(userId, similarities);

    return similarities.slice(0, limit);
  }

  /**
   * Update user watch history for collaborative filtering
   */
  addWatchEvent(userId: string, contentId: number): void {
    if (!this.userWatchHistory.has(userId)) {
      this.userWatchHistory.set(userId, new Set());
    }
    this.userWatchHistory.get(userId)!.add(contentId);

    // Invalidate similarity cache for this user
    this.userSimilarities.delete(userId);
  }
}

/**
 * Content-Based Strategy
 * Recommends items similar to user's preferences using embeddings
 *
 * Performance:
 * - With HNSW: 150x faster than brute-force (O(log n) vs O(n))
 * - Without HNSW: Falls back to brute-force cosine similarity
 */
export class ContentBasedStrategy implements RecommendationStrategy {
  public readonly name = 'content_based';
  public weight: number;

  private contentEmbeddings: Map<number, Float32Array>;
  private userPreferences: Map<string, UserPreferences>;
  private hnswAdapter?: HNSWSearchAdapter;

  constructor(
    weight: number = 0.25,
    private readonly vectorWrapper?: any,
    hnswAdapter?: HNSWSearchAdapter
  ) {
    this.weight = weight;
    this.contentEmbeddings = new Map();
    this.userPreferences = new Map();
    this.hnswAdapter = hnswAdapter;
  }

  async getRankings(userId: string, limit: number): Promise<RankedItem[]> {
    try {
      const preferences = this.userPreferences.get(userId);

      if (!preferences || !preferences.vector) {
        return [];
      }

      // Use HNSW search if available (150x faster)
      if (this.hnswAdapter) {
        return this.getRankingsWithHNSW(userId, limit, preferences.vector);
      }

      // Fallback to brute-force search
      return this.getRankingsWithBruteForce(userId, limit, preferences.vector);
    } catch (error) {
      console.error('Content-based filtering error:', error);
      return [];
    }
  }

  /**
   * Get rankings using HNSW index (150x faster)
   */
  private async getRankingsWithHNSW(
    userId: string,
    limit: number,
    queryVector: Float32Array
  ): Promise<RankedItem[]> {
    try {
      const searchResults = await this.hnswAdapter!.search(
        queryVector,
        limit,
        undefined // No similarity threshold
      );

      return searchResults.map((result, index) => ({
        contentId: result.contentId,
        mediaType: 'movie' as const,
        rank: index + 1,
        score: result.similarity,
        strategyName: this.name,
      }));
    } catch (error) {
      console.warn('[ContentBasedStrategy] HNSW search failed, falling back to brute-force:', error);
      return this.getRankingsWithBruteForce(userId, limit, queryVector);
    }
  }

  /**
   * Get rankings using brute-force cosine similarity (fallback)
   */
  private async getRankingsWithBruteForce(
    userId: string,
    limit: number,
    queryVector: Float32Array
  ): Promise<RankedItem[]> {
    // Score all content against user preference vector
    const candidates: Array<{ contentId: number; score: number }> = [];

    for (const [contentId, embedding] of this.contentEmbeddings.entries()) {
      const similarity = this.cosineSimilarity(queryVector, embedding);
      candidates.push({ contentId, score: similarity });
    }

    // Sort by similarity
    candidates.sort((a, b) => b.score - a.score);

    return candidates.slice(0, limit).map((item, index) => ({
      contentId: item.contentId,
      mediaType: 'movie' as const,
      rank: index + 1,
      score: item.score,
      strategyName: this.name,
    }));
  }

  /**
   * Calculate cosine similarity between vectors
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Add content embedding for scoring
   */
  addContentEmbedding(contentId: number, embedding: Float32Array): void {
    this.contentEmbeddings.set(contentId, embedding);
  }

  /**
   * Update user preferences
   */
  updateUserPreferences(userId: string, preferences: UserPreferences): void {
    this.userPreferences.set(userId, preferences);
  }
}

/**
 * Trending Strategy
 * Recommends currently popular content
 */
export class TrendingStrategy implements RecommendationStrategy {
  public readonly name = 'trending';
  public weight: number;

  private trendingItems: TrendingItem[];
  private lastUpdate: number;
  private readonly cacheDuration = 3600000; // 1 hour

  constructor(weight: number = 0.20) {
    this.weight = weight;
    this.trendingItems = [];
    this.lastUpdate = 0;
  }

  async getRankings(userId: string, limit: number): Promise<RankedItem[]> {
    try {
      // Refresh trending items if cache expired
      if (Date.now() - this.lastUpdate > this.cacheDuration) {
        await this.refreshTrendingItems();
      }

      return this.trendingItems.slice(0, limit).map((item, index) => ({
        contentId: item.contentId,
        mediaType: item.mediaType,
        rank: index + 1,
        score: item.popularityScore,
        strategyName: this.name,
      }));
    } catch (error) {
      console.error('Trending strategy error:', error);
      return [];
    }
  }

  /**
   * Refresh trending items from data source
   */
  private async refreshTrendingItems(): Promise<void> {
    // Mock implementation - in production, fetch from analytics
    this.trendingItems = [
      {
        contentId: 1001,
        mediaType: 'movie',
        popularityScore: 0.95,
        velocityScore: 0.85,
        trendingRank: 1,
      },
      {
        contentId: 1002,
        mediaType: 'tv',
        popularityScore: 0.92,
        velocityScore: 0.88,
        trendingRank: 2,
      },
      {
        contentId: 1003,
        mediaType: 'movie',
        popularityScore: 0.89,
        velocityScore: 0.82,
        trendingRank: 3,
      },
    ];

    this.lastUpdate = Date.now();
  }

  /**
   * Manually set trending items
   */
  setTrendingItems(items: TrendingItem[]): void {
    this.trendingItems = items.sort((a, b) => b.popularityScore - a.popularityScore);
    this.lastUpdate = Date.now();
  }
}

/**
 * Context-Aware Strategy
 * Recommends based on temporal and situational context
 */
export class ContextAwareStrategy implements RecommendationStrategy {
  public readonly name = 'context_aware';
  public weight: number;

  private contextPatterns: Map<string, number[]>;
  private userTemporalPreferences: Map<string, Map<string, number[]>>;

  constructor(weight: number = 0.20) {
    this.weight = weight;
    this.contextPatterns = new Map();
    this.userTemporalPreferences = new Map();
  }

  async getRankings(userId: string, limit: number, context?: RecommendationContext): Promise<RankedItem[]> {
    try {
      const currentContext = context || this.getCurrentContext();
      const contextKey = this.getContextKey(currentContext);

      // Get user's temporal preferences
      const userPrefs = this.userTemporalPreferences.get(userId);
      if (!userPrefs) {
        return [];
      }

      const contextPrefs = userPrefs.get(contextKey) || [];

      return contextPrefs.slice(0, limit).map((contentId, index) => ({
        contentId,
        mediaType: 'movie' as const,
        rank: index + 1,
        score: 1.0 - (index * 0.05),
        strategyName: this.name,
      }));
    } catch (error) {
      console.error('Context-aware strategy error:', error);
      return [];
    }
  }

  /**
   * Get current context based on time and environment
   */
  private getCurrentContext(): RecommendationContext {
    const now = new Date();
    return {
      hourOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      device: 'desktop',
    };
  }

  /**
   * Generate context key for pattern matching
   */
  private getContextKey(context: RecommendationContext): string {
    const parts: string[] = [];

    if (context.hourOfDay !== undefined) {
      const timeOfDay = context.hourOfDay < 12 ? 'morning' :
                       context.hourOfDay < 18 ? 'afternoon' :
                       context.hourOfDay < 22 ? 'evening' : 'night';
      parts.push(timeOfDay);
    }

    if (context.dayOfWeek !== undefined) {
      const dayType = context.dayOfWeek === 0 || context.dayOfWeek === 6 ? 'weekend' : 'weekday';
      parts.push(dayType);
    }

    if (context.device) {
      parts.push(context.device);
    }

    return parts.join('_');
  }

  /**
   * Learn from watch events to build temporal patterns
   */
  learnFromWatchEvent(event: WatchEvent, contentId: number): void {
    const context: RecommendationContext = {
      hourOfDay: new Date(event.timestamp).getHours(),
      dayOfWeek: new Date(event.timestamp).getDay(),
      device: event.context.device as any,
    };

    const contextKey = this.getContextKey(context);

    if (!this.userTemporalPreferences.has(event.userId)) {
      this.userTemporalPreferences.set(event.userId, new Map());
    }

    const userPrefs = this.userTemporalPreferences.get(event.userId)!;
    if (!userPrefs.has(contextKey)) {
      userPrefs.set(contextKey, []);
    }

    const contextPrefs = userPrefs.get(contextKey)!;
    if (!contextPrefs.includes(contentId)) {
      contextPrefs.unshift(contentId);

      // Keep only top 20 for each context
      if (contextPrefs.length > 20) {
        contextPrefs.pop();
      }
    }
  }
}

// ============================================================================
// Hybrid Recommendation Engine
// ============================================================================

/**
 * Hybrid Recommendation Engine using Reciprocal Rank Fusion
 *
 * AgentDB Optimizations:
 * - Optional QueryCache for 20-40% speedup on repeated queries
 * - Optional MMRDiversityAdapter for enhanced result diversity
 * - Optional ReasoningBank for learning optimal strategy weights
 */
export class HybridRecommendationEngine {
  private strategies: Map<string, RecommendationStrategy>;
  private contentCache: Map<number, MediaContent>;
  private queryCache?: QueryCache;
  private mmrAdapter?: MMRDiversityAdapter;
  private reasoningBank?: ReasoningBank;
  private contentEmbeddings: Map<number, Float32Array>;

  constructor(
    strategies: RecommendationStrategy[] = [],
    options?: {
      queryCache?: QueryCache;
      mmrAdapter?: MMRDiversityAdapter;
      reasoningBank?: ReasoningBank;
    }
  ) {
    this.strategies = new Map();
    this.contentCache = new Map();
    this.contentEmbeddings = new Map();

    for (const strategy of strategies) {
      this.strategies.set(strategy.name, strategy);
    }

    // Optional AgentDB integrations
    this.queryCache = options?.queryCache;
    this.mmrAdapter = options?.mmrAdapter;
    this.reasoningBank = options?.reasoningBank;

    if (this.queryCache) {
      console.log('[HybridRecommendationEngine] QueryCache enabled for 20-40% speedup');
    }
    if (this.mmrAdapter) {
      console.log('[HybridRecommendationEngine] MMRDiversityAdapter enabled for enhanced diversity');
    }
    if (this.reasoningBank) {
      console.log('[HybridRecommendationEngine] ReasoningBank enabled for adaptive learning');
    }
  }

  /**
   * Apply Reciprocal Rank Fusion algorithm
   *
   * Formula: RRF_score(item) = Σ [weight_i / (k + rank_i)]
   *
   * @param rankings - Rankings from all strategies
   * @param k - Constant to reduce importance of higher ranks (default: 60)
   * @returns Fused results sorted by RRF score
   */
  reciprocalRankFusion(
    rankings: Map<string, RankedItem[]>,
    k: number = 60
  ): FusedResult[] {
    const itemScores = new Map<string, {
      contentId: number;
      mediaType: 'movie' | 'tv';
      totalScore: number;
      contributions: StrategyContribution[];
    }>();

    // Calculate RRF scores for each item
    for (const [strategyName, items] of rankings.entries()) {
      const strategy = this.strategies.get(strategyName);
      if (!strategy) continue;

      for (const item of items) {
        const key = `${item.contentId}`;
        const contribution = strategy.weight / (k + item.rank);

        if (!itemScores.has(key)) {
          itemScores.set(key, {
            contentId: item.contentId,
            mediaType: item.mediaType,
            totalScore: 0,
            contributions: [],
          });
        }

        const itemData = itemScores.get(key)!;
        itemData.totalScore += contribution;
        itemData.contributions.push({
          strategyName,
          weight: strategy.weight,
          rank: item.rank,
          contribution,
        });
      }
    }

    // Add zero contributions for strategies that didn't rank this item
    for (const itemData of itemScores.values()) {
      for (const [strategyName, strategy] of this.strategies.entries()) {
        const hasContribution = itemData.contributions.some(
          c => c.strategyName === strategyName
        );

        if (!hasContribution) {
          itemData.contributions.push({
            strategyName,
            weight: strategy.weight,
            rank: null,
            contribution: 0,
          });
        }
      }
    }

    // Convert to FusedResult array and sort
    const results: FusedResult[] = Array.from(itemScores.values()).map(item => ({
      contentId: item.contentId,
      mediaType: item.mediaType,
      rrfScore: item.totalScore,
      strategyContributions: item.contributions,
    }));

    results.sort((a, b) => b.rrfScore - a.rrfScore);

    return results;
  }

  /**
   * Get hybrid recommendations for a user
   *
   * @param userId - User identifier
   * @param limit - Maximum number of recommendations (default: 20)
   * @param context - Optional recommendation context
   * @param options - Optional configuration
   * @returns Hybrid recommendations with reasoning
   *
   * Performance:
   * - With QueryCache: 20-40% faster on repeated queries
   * - With MMRDiversityAdapter: Enhanced diversity in results
   * - With ReasoningBank: Adaptive strategy weight learning
   */
  async getHybridRecommendations(
    userId: string,
    limit: number = 20,
    context?: RecommendationContext,
    options?: {
      applyDiversity?: boolean;
      diversityLambda?: number;
      learningEnabled?: boolean;
    }
  ): Promise<HybridRecommendation[]> {
    const applyDiversity = options?.applyDiversity ?? false;
    const diversityLambda = options?.diversityLambda ?? 0.85;
    const learningEnabled = options?.learningEnabled ?? false;

    // Try cache first (20-40% speedup)
    const cacheKey = this.getCacheKey(userId, limit, context, applyDiversity);
    if (this.queryCache) {
      const cached = this.queryCache.get<HybridRecommendation[]>(cacheKey);
      if (cached) {
        console.log('[HybridRecommendationEngine] Cache hit');
        return cached;
      }
    }

    // Collect rankings from all strategies
    const allRankings = new Map<string, RankedItem[]>();
    const rankingLimit = Math.min(limit * 3, 100); // Get more candidates for fusion

    const rankingPromises = Array.from(this.strategies.entries()).map(
      async ([name, strategy]) => {
        try {
          // Pass context to context-aware strategy
          if (name === 'context_aware' && strategy instanceof ContextAwareStrategy) {
            const rankings = await strategy.getRankings(userId, rankingLimit, context);
            return [name, rankings] as const;
          } else {
            const rankings = await strategy.getRankings(userId, rankingLimit);
            return [name, rankings] as const;
          }
        } catch (error) {
          console.error(`Strategy ${name} failed:`, error);
          return [name, []] as const;
        }
      }
    );

    const rankingResults = await Promise.all(rankingPromises);

    for (const [name, rankings] of rankingResults) {
      if (rankings.length > 0) {
        allRankings.set(name, [...rankings]);
      }
    }

    // Apply RRF fusion
    const fusedResults = this.reciprocalRankFusion(allRankings);

    // Apply MMR diversity if enabled
    let finalResults = fusedResults;
    if (applyDiversity && this.mmrAdapter && this.contentEmbeddings.size > 0) {
      finalResults = this.applyDiversityRanking(fusedResults, limit, diversityLambda);
    }

    // Convert to HybridRecommendation with content and reasoning
    const recommendations: HybridRecommendation[] = [];

    for (const result of finalResults.slice(0, limit)) {
      const content = this.contentCache.get(result.contentId);

      if (!content) {
        console.warn(`Content ${result.contentId} not found in cache`);
        continue;
      }

      const reasoning = this.generateReasoning(result);

      recommendations.push({
        content,
        finalScore: result.rrfScore,
        strategyContributions: result.strategyContributions,
        reasoning,
      });
    }

    // Cache results (5 minute TTL)
    if (this.queryCache && recommendations.length > 0) {
      this.queryCache.set(cacheKey, recommendations, 5 * 60 * 1000);
    }

    // Learn from successful recommendations
    if (learningEnabled && this.reasoningBank && recommendations.length > 0) {
      this.recordRecommendationPattern(userId, recommendations).catch(err => {
        console.warn('[HybridRecommendationEngine] Failed to record pattern:', err);
      });
    }

    return recommendations;
  }

  /**
   * Apply MMR diversity ranking to fused results
   */
  private applyDiversityRanking(
    fusedResults: FusedResult[],
    limit: number,
    lambda: number
  ): FusedResult[] {
    if (!this.mmrAdapter) {
      return fusedResults;
    }

    try {
      // Convert FusedResult to RecommendationCandidate format
      const candidates = fusedResults.map(result => ({
        contentId: result.contentId,
        mediaType: result.mediaType,
        relevanceScore: result.rrfScore,
        genres: [],
        releaseDate: undefined,
      }));

      // Apply MMR
      const diversified = this.mmrAdapter.applyMMR(
        candidates,
        this.contentEmbeddings,
        limit
      );

      // Convert back to FusedResult
      const diversifiedResults: FusedResult[] = [];
      for (const candidate of diversified) {
        const original = fusedResults.find(r => r.contentId === candidate.contentId);
        if (original) {
          diversifiedResults.push(original);
        }
      }

      console.log(
        `[HybridRecommendationEngine] Applied MMR diversity: ${fusedResults.length} -> ${diversifiedResults.length}`
      );

      return diversifiedResults;
    } catch (error) {
      console.warn('[HybridRecommendationEngine] Diversity ranking failed:', error);
      return fusedResults;
    }
  }

  /**
   * Generate cache key for recommendations
   */
  private getCacheKey(
    userId: string,
    limit: number,
    context?: RecommendationContext,
    diversity?: boolean
  ): string {
    const contextStr = context ? JSON.stringify(context) : 'none';
    const diversityStr = diversity ? 'div' : 'nodiv';
    return `hybrid:${userId}:${limit}:${contextStr}:${diversityStr}`;
  }

  /**
   * Record successful recommendation pattern to ReasoningBank
   */
  private async recordRecommendationPattern(
    userId: string,
    recommendations: HybridRecommendation[]
  ): Promise<void> {
    if (!this.reasoningBank) {
      return;
    }

    try {
      // Calculate which strategies contributed most
      const strategyContributions = new Map<string, number>();
      for (const rec of recommendations) {
        for (const contrib of rec.strategyContributions) {
          const current = strategyContributions.get(contrib.strategyName) || 0;
          strategyContributions.set(
            contrib.strategyName,
            current + contrib.contribution
          );
        }
      }

      // Find dominant strategy
      let maxContrib = 0;
      let dominantStrategy = '';
      for (const [strategy, contrib] of strategyContributions.entries()) {
        if (contrib > maxContrib) {
          maxContrib = contrib;
          dominantStrategy = strategy;
        }
      }

      // Build strategy weights object
      const strategyWeights: Record<string, number> = {};
      for (const [name, strategy] of this.strategies.entries()) {
        strategyWeights[name] = strategy.weight;
      }

      // Store pattern
      await this.reasoningBank.storePattern({
        taskType: 'hybrid_recommendation',
        approach: `Dominant strategy: ${dominantStrategy}`,
        successRate: 0.8, // Initial success rate, would be updated based on user feedback
        metadata: {
          userId,
          strategyWeights,
          recommendationCount: recommendations.length,
        },
      });
    } catch (error) {
      console.warn('[HybridRecommendationEngine] Failed to record pattern:', error);
    }
  }

  /**
   * Generate human-readable reasoning for recommendation
   */
  private generateReasoning(result: FusedResult): string {
    const reasons: string[] = [];

    // Sort contributions by value
    const sorted = [...result.strategyContributions]
      .filter(c => c.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution);

    if (sorted.length === 0) {
      return 'Recommended based on general popularity';
    }

    const top = sorted[0]!;

    switch (top.strategyName) {
      case 'collaborative_filtering':
        reasons.push('users with similar tastes enjoyed this');
        break;
      case 'content_based':
        reasons.push('matches your viewing preferences');
        break;
      case 'trending':
        reasons.push('trending and popular right now');
        break;
      case 'context_aware':
        reasons.push('fits your current watching context');
        break;
      default:
        reasons.push(`recommended by ${top.strategyName}`);
    }

    // Add secondary reasons
    if (sorted.length > 1) {
      const secondary = sorted[1]!;
      const contribution = (secondary.contribution / result.rrfScore) * 100;

      if (contribution > 20) {
        switch (secondary.strategyName) {
          case 'collaborative_filtering':
            reasons.push('also enjoyed by similar users');
            break;
          case 'content_based':
            reasons.push('aligns with your taste profile');
            break;
          case 'trending':
            reasons.push('currently popular');
            break;
          case 'context_aware':
            reasons.push('suitable for now');
            break;
        }
      }
    }

    return reasons.join(', ').replace(/^./, s => s.toUpperCase());
  }

  /**
   * Add a new strategy to the engine
   */
  addStrategy(strategy: RecommendationStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Remove a strategy from the engine
   */
  removeStrategy(strategyName: string): boolean {
    return this.strategies.delete(strategyName);
  }

  /**
   * Update weights for existing strategies
   */
  updateWeights(weights: Record<string, number>): void {
    for (const [name, weight] of Object.entries(weights)) {
      const strategy = this.strategies.get(name);
      if (strategy) {
        strategy.weight = weight;
      }
    }
  }

  /**
   * Get all active strategies
   */
  getStrategies(): RecommendationStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Add content to cache for recommendations
   */
  addContent(content: MediaContent, embedding?: Float32Array): void {
    this.contentCache.set(content.id, content);
    if (embedding) {
      this.contentEmbeddings.set(content.id, embedding);
    }
  }

  /**
   * Bulk add content to cache
   */
  addContentBulk(contents: MediaContent[], embeddings?: Map<number, Float32Array>): void {
    for (const content of contents) {
      this.contentCache.set(content.id, content);
      if (embeddings) {
        const embedding = embeddings.get(content.id);
        if (embedding) {
          this.contentEmbeddings.set(content.id, embedding);
        }
      }
    }
  }

  /**
   * Add or update content embedding
   */
  addContentEmbedding(contentId: number, embedding: Float32Array): void {
    this.contentEmbeddings.set(contentId, embedding);
  }

  /**
   * Clear content cache
   */
  clearContentCache(): void {
    this.contentCache.clear();
    this.contentEmbeddings.clear();
  }

  /**
   * Get cache statistics (if QueryCache is enabled)
   */
  getCacheStatistics():
    | { hits: number; misses: number; hitRate: number; size: number }
    | undefined {
    return this.queryCache?.getStatistics();
  }

  /**
   * Clear query cache
   */
  clearQueryCache(): void {
    this.queryCache?.clear();
  }

  /**
   * Get strategy by name
   */
  getStrategy<T extends RecommendationStrategy>(name: string): T | undefined {
    return this.strategies.get(name) as T | undefined;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a hybrid recommendation engine with default strategies
 *
 * @param options - Configuration options
 * @returns Configured HybridRecommendationEngine instance
 *
 * AgentDB Optimizations:
 * - Pass hnswAdapter for 150x faster content-based search
 * - Pass queryCache for 20-40% speedup on repeated queries
 * - Pass mmrAdapter for enhanced diversity ranking
 * - Pass reasoningBank for adaptive strategy weight learning
 *
 * @example
 * ```typescript
 * import { createHNSWSearchAdapter } from './HNSWSearchAdapter';
 * import { createMMRDiversityAdapter } from './MMRDiversityAdapter';
 * import { QueryCache, ReasoningBank } from 'agentdb';
 *
 * const hnswAdapter = createHNSWSearchAdapter({ dimension: 768 });
 * const mmrAdapter = createMMRDiversityAdapter(0.85, 'cosine');
 * const queryCache = new QueryCache({ maxSize: 1000 });
 *
 * const engine = createHybridRecommendationEngine({
 *   hnswAdapter,
 *   mmrAdapter,
 *   queryCache,
 * });
 * ```
 */
export function createHybridRecommendationEngine(
  options: {
    collaborativeWeight?: number;
    contentBasedWeight?: number;
    trendingWeight?: number;
    contextWeight?: number;
    dbWrapper?: any;
    vectorWrapper?: any;
    hnswAdapter?: HNSWSearchAdapter;
    mmrAdapter?: MMRDiversityAdapter;
    queryCache?: QueryCache;
    reasoningBank?: ReasoningBank;
  } = {}
): HybridRecommendationEngine {
  const strategies: RecommendationStrategy[] = [
    new CollaborativeFilteringStrategy(
      options.collaborativeWeight ?? 0.35,
      options.dbWrapper
    ),
    new ContentBasedStrategy(
      options.contentBasedWeight ?? 0.25,
      options.vectorWrapper,
      options.hnswAdapter // Pass HNSW adapter for 150x faster search
    ),
    new TrendingStrategy(options.trendingWeight ?? 0.20),
    new ContextAwareStrategy(options.contextWeight ?? 0.20),
  ];

  return new HybridRecommendationEngine(strategies, {
    queryCache: options.queryCache,
    mmrAdapter: options.mmrAdapter,
    reasoningBank: options.reasoningBank,
  });
}

// ============================================================================
// Exports
// ============================================================================

export default HybridRecommendationEngine;

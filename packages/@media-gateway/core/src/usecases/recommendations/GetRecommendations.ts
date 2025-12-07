/**
 * Get Recommendations Use Case
 *
 * Generates personalized content recommendations based on user preferences,
 * watch history, and contextual factors.
 */

import type {
  RecommendationRequest,
  Recommendation,
  UserPreferences,
  MediaContent,
} from '../../types/index.js';

/**
 * User Preferences Repository Interface
 */
export interface IUserPreferencesRepository {
  getByUserId(userId: string): Promise<UserPreferences | null>;
}

/**
 * Recommendation Engine Interface
 * Abstracts the ML/algorithm-based recommendation logic
 */
export interface IRecommendationEngine {
  generateRecommendations(
    preferences: UserPreferences,
    context?: {
      mood?: string;
      availableTime?: number;
      groupMembers?: string[];
      occasion?: string;
    },
    limit?: number
  ): Promise<Array<{
    contentId: number;
    score: number;
    reason: string;
  }>>;
}

/**
 * Content Repository Interface (subset for recommendations)
 */
export interface IContentRepository {
  getByIds(ids: number[]): Promise<MediaContent[]>;
  getPopular(limit: number): Promise<MediaContent[]>;
}

/**
 * Platform Availability Service Interface
 */
export interface IPlatformAvailabilityService {
  getAvailability(contentId: number, mediaType: 'movie' | 'tv'): Promise<Array<{
    platformId: string;
    platformName: string;
    available: boolean;
    type: 'subscription' | 'rent' | 'buy' | 'free';
    price?: number;
    deepLink?: string;
  }>>;
}

/**
 * Get Recommendations Result
 */
export interface GetRecommendationsResult {
  recommendations: Recommendation[];
  totalCount: number;
  personalizationScore: number;
  executionTime: number;
}

/**
 * Get Recommendations Use Case
 *
 * Orchestrates personalized recommendations:
 * 1. Load user preferences
 * 2. Generate recommendations using ML engine
 * 3. Enrich with content details
 * 4. Filter by availability
 * 5. Rank and return
 */
export class GetRecommendations {
  constructor(
    private readonly preferencesRepository: IUserPreferencesRepository,
    private readonly recommendationEngine: IRecommendationEngine,
    private readonly contentRepository: IContentRepository,
    private readonly platformService: IPlatformAvailabilityService
  ) {}

  /**
   * Execute recommendations use case
   *
   * @param request - Recommendation request with user ID and context
   * @returns Personalized recommendations with availability
   * @throws Error if user not found or recommendation fails
   */
  async execute(request: RecommendationRequest): Promise<GetRecommendationsResult> {
    const startTime = Date.now();

    try {
      // Step 1: Validate request
      this.validateRequest(request);

      // Step 2: Load user preferences
      const preferences = await this.loadUserPreferences(request.userId);

      // Step 3: Generate recommendations
      const rawRecommendations = await this.recommendationEngine.generateRecommendations(
        preferences,
        request.context,
        request.limit * 2 // Get more candidates for filtering
      );

      // Step 4: Load content details
      const contentIds = rawRecommendations.map(r => r.contentId);
      const contentMap = await this.loadContentDetails(contentIds);

      // Step 5: Filter watched content if requested
      let filteredRecommendations = rawRecommendations;
      if (request.excludeWatched) {
        filteredRecommendations = this.filterWatchedContent(
          rawRecommendations,
          preferences
        );
      }

      // Step 6: Enrich with availability and content details
      const enrichedRecommendations = await this.enrichRecommendations(
        filteredRecommendations.slice(0, request.limit),
        contentMap
      );

      // Step 7: Calculate personalization score
      const personalizationScore = this.calculatePersonalizationScore(preferences);

      const executionTime = Date.now() - startTime;

      return {
        recommendations: enrichedRecommendations,
        totalCount: filteredRecommendations.length,
        personalizationScore,
        executionTime,
      };
    } catch (error) {
      throw new Error(
        `Failed to generate recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate recommendation request
   */
  private validateRequest(request: RecommendationRequest): void {
    if (!request.userId) {
      throw new Error('User ID is required');
    }

    if (request.limit < 1 || request.limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }

    if (request.context?.availableTime && request.context.availableTime < 1) {
      throw new Error('Available time must be positive');
    }
  }

  /**
   * Load user preferences
   */
  private async loadUserPreferences(userId: string): Promise<UserPreferences> {
    const preferences = await this.preferencesRepository.getByUserId(userId);

    if (!preferences) {
      throw new Error(`User preferences not found for user: ${userId}`);
    }

    return preferences;
  }

  /**
   * Load content details for recommendations
   */
  private async loadContentDetails(
    contentIds: number[]
  ): Promise<Map<number, MediaContent>> {
    const contents = await this.contentRepository.getByIds(contentIds);
    const contentMap = new Map<number, MediaContent>();

    contents.forEach(content => {
      contentMap.set(content.id, content);
    });

    return contentMap;
  }

  /**
   * Filter out already watched content
   */
  private filterWatchedContent(
    recommendations: Array<{ contentId: number; score: number; reason: string }>,
    preferences: UserPreferences
  ): Array<{ contentId: number; score: number; reason: string }> {
    // Note: This assumes watched content tracking in preferences
    // In production, this would check against watch history
    return recommendations.filter(rec => {
      // Placeholder logic - would check actual watch history
      return true;
    });
  }

  /**
   * Enrich recommendations with content and availability
   */
  private async enrichRecommendations(
    recommendations: Array<{ contentId: number; score: number; reason: string }>,
    contentMap: Map<number, MediaContent>
  ): Promise<Recommendation[]> {
    const enrichPromises = recommendations.map(async rec => {
      const content = contentMap.get(rec.contentId);
      if (!content) {
        throw new Error(`Content not found: ${rec.contentId}`);
      }

      const availability = await this.platformService.getAvailability(
        content.id,
        content.mediaType
      );

      return {
        content,
        score: rec.score,
        personalizationScore: rec.score,
        reason: rec.reason,
        explanation: rec.reason,
        availability,
      };
    });

    return Promise.all(enrichPromises);
  }

  /**
   * Calculate overall personalization score
   */
  private calculatePersonalizationScore(preferences: UserPreferences): number {
    // Use confidence from preferences as personalization score
    return preferences.confidence;
  }

  /**
   * Get recommendations by mood
   * Convenience method for mood-based recommendations
   */
  async getByMood(
    userId: string,
    mood: string,
    limit: number = 20
  ): Promise<GetRecommendationsResult> {
    return this.execute({
      userId,
      context: { mood },
      limit,
      excludeWatched: true,
    });
  }

  /**
   * Get quick picks (short content for limited time)
   * Convenience method for time-constrained viewing
   */
  async getQuickPicks(
    userId: string,
    availableMinutes: number,
    limit: number = 20
  ): Promise<GetRecommendationsResult> {
    return this.execute({
      userId,
      context: { availableTime: availableMinutes },
      limit,
      excludeWatched: true,
    });
  }

  /**
   * Get group recommendations
   * Convenience method for group watch scenarios
   */
  async getForGroup(
    userId: string,
    groupMembers: string[],
    limit: number = 20
  ): Promise<GetRecommendationsResult> {
    return this.execute({
      userId,
      context: { groupMembers },
      limit,
      excludeWatched: true,
    });
  }

  /**
   * Get new releases
   * Recommendations filtered to recent content
   */
  async getNewReleases(
    userId: string,
    limit: number = 20
  ): Promise<GetRecommendationsResult> {
    // This would filter recommendations to recent releases
    // Implementation would add date filtering in the engine
    return this.execute({
      userId,
      limit,
      excludeWatched: false,
    });
  }
}

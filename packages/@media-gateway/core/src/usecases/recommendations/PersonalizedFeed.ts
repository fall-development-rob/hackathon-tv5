/**
 * Personalized Feed Use Case
 *
 * Generates a comprehensive personalized content feed combining:
 * - Personalized recommendations
 * - Trending content
 * - Continue watching
 * - New releases in preferred genres
 */

import type {
  MediaContent,
  UserPreferences,
  WatchEvent,
} from '../../types/index.js';
import type { GetRecommendations, GetRecommendationsResult } from './GetRecommendations.js';

/**
 * Watch History Repository Interface
 */
export interface IWatchHistoryRepository {
  getRecentByUserId(userId: string, limit: number): Promise<WatchEvent[]>;
  getIncomplete(userId: string): Promise<WatchEvent[]>;
}

/**
 * Content Repository Interface
 */
export interface IContentRepository {
  getByIds(ids: number[]): Promise<MediaContent[]>;
  getTrending(mediaType?: 'movie' | 'tv', limit?: number): Promise<MediaContent[]>;
  getNewReleases(genreIds?: number[], limit?: number): Promise<MediaContent[]>;
}

/**
 * Feed Section
 * Represents a section in the personalized feed
 */
export interface FeedSection {
  id: string;
  title: string;
  description?: string;
  items: MediaContent[];
  priority: number;
  metadata?: Record<string, any>;
}

/**
 * Personalized Feed Result
 */
export interface PersonalizedFeedResult {
  sections: FeedSection[];
  totalItems: number;
  generatedAt: Date;
  personalizationScore: number;
  executionTime: number;
}

/**
 * Feed Configuration
 */
export interface FeedConfiguration {
  /** Include continue watching section */
  includeContinueWatching?: boolean;
  /** Include trending content */
  includeTrending?: boolean;
  /** Include new releases */
  includeNewReleases?: boolean;
  /** Include personalized recommendations */
  includeRecommendations?: boolean;
  /** Maximum items per section */
  itemsPerSection?: number;
  /** Maximum total sections */
  maxSections?: number;
}

/**
 * Personalized Feed Use Case
 *
 * Creates a multi-section feed tailored to user preferences:
 * 1. Continue watching (incomplete content)
 * 2. Personalized for you
 * 3. Trending now
 * 4. New in [favorite genres]
 * 5. Because you watched [X]
 */
export class PersonalizedFeed {
  private readonly DEFAULT_CONFIG: Required<FeedConfiguration> = {
    includeContinueWatching: true,
    includeTrending: true,
    includeNewReleases: true,
    includeRecommendations: true,
    itemsPerSection: 20,
    maxSections: 10,
  };

  constructor(
    private readonly getRecommendations: GetRecommendations,
    private readonly watchHistoryRepository: IWatchHistoryRepository,
    private readonly contentRepository: IContentRepository
  ) {}

  /**
   * Generate personalized feed
   *
   * @param userId - User ID
   * @param preferences - User preferences
   * @param config - Feed configuration
   * @returns Multi-section personalized feed
   */
  async execute(
    userId: string,
    preferences: UserPreferences,
    config: FeedConfiguration = {}
  ): Promise<PersonalizedFeedResult> {
    const startTime = Date.now();
    const cfg = { ...this.DEFAULT_CONFIG, ...config };

    try {
      const sections: FeedSection[] = [];

      // Section 1: Continue Watching (highest priority)
      if (cfg.includeContinueWatching) {
        const continueWatching = await this.buildContinueWatchingSection(
          userId,
          cfg.itemsPerSection
        );
        if (continueWatching) {
          sections.push(continueWatching);
        }
      }

      // Section 2: Personalized Recommendations
      if (cfg.includeRecommendations) {
        const recommended = await this.buildRecommendationsSection(
          userId,
          cfg.itemsPerSection
        );
        if (recommended) {
          sections.push(recommended);
        }
      }

      // Section 3: Trending Now
      if (cfg.includeTrending) {
        const trending = await this.buildTrendingSection(cfg.itemsPerSection);
        if (trending) {
          sections.push(trending);
        }
      }

      // Section 4: New Releases in Favorite Genres
      if (cfg.includeNewReleases) {
        const newReleases = await this.buildNewReleasesSection(
          preferences,
          cfg.itemsPerSection
        );
        if (newReleases) {
          sections.push(newReleases);
        }
      }

      // Section 5: Because You Watched... (similar content)
      const becauseYouWatched = await this.buildBecauseYouWatchedSection(
        userId,
        preferences,
        cfg.itemsPerSection
      );
      if (becauseYouWatched) {
        sections.push(becauseYouWatched);
      }

      // Sort sections by priority and limit
      const finalSections = sections
        .sort((a, b) => b.priority - a.priority)
        .slice(0, cfg.maxSections);

      const totalItems = finalSections.reduce((sum, s) => sum + s.items.length, 0);
      const executionTime = Date.now() - startTime;

      return {
        sections: finalSections,
        totalItems,
        generatedAt: new Date(),
        personalizationScore: preferences.confidence,
        executionTime,
      };
    } catch (error) {
      throw new Error(
        `Failed to generate personalized feed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build Continue Watching section
   */
  private async buildContinueWatchingSection(
    userId: string,
    limit: number
  ): Promise<FeedSection | null> {
    const incompleteEvents = await this.watchHistoryRepository.getIncomplete(userId);

    if (incompleteEvents.length === 0) {
      return null;
    }

    // Get unique content IDs
    const contentIds = Array.from(
      new Set(incompleteEvents.map(e => e.contentId))
    ).slice(0, limit);

    const items = await this.contentRepository.getByIds(contentIds);

    return {
      id: 'continue-watching',
      title: 'Continue Watching',
      description: 'Pick up where you left off',
      items,
      priority: 100, // Highest priority
      metadata: {
        type: 'continue-watching',
      },
    };
  }

  /**
   * Build Personalized Recommendations section
   */
  private async buildRecommendationsSection(
    userId: string,
    limit: number
  ): Promise<FeedSection | null> {
    try {
      const result = await this.getRecommendations.execute({
        userId,
        limit,
        excludeWatched: true,
      });

      if (result.recommendations.length === 0) {
        return null;
      }

      return {
        id: 'personalized',
        title: 'Recommended for You',
        description: 'Based on your viewing preferences',
        items: result.recommendations.map(r => r.content),
        priority: 90,
        metadata: {
          type: 'recommendations',
          personalizationScore: result.personalizationScore,
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Build Trending section
   */
  private async buildTrendingSection(limit: number): Promise<FeedSection | null> {
    const trending = await this.contentRepository.getTrending(undefined, limit);

    if (trending.length === 0) {
      return null;
    }

    return {
      id: 'trending',
      title: 'Trending Now',
      description: 'Popular with viewers right now',
      items: trending,
      priority: 70,
      metadata: {
        type: 'trending',
      },
    };
  }

  /**
   * Build New Releases section (in favorite genres)
   */
  private async buildNewReleasesSection(
    preferences: UserPreferences,
    limit: number
  ): Promise<FeedSection | null> {
    // Get top 3 favorite genres
    const topGenres = Object.entries(preferences.genreAffinities)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([genreId]) => parseInt(genreId));

    if (topGenres.length === 0) {
      return null;
    }

    const newReleases = await this.contentRepository.getNewReleases(
      topGenres,
      limit
    );

    if (newReleases.length === 0) {
      return null;
    }

    return {
      id: 'new-releases',
      title: 'New Releases',
      description: 'Fresh content in your favorite genres',
      items: newReleases,
      priority: 80,
      metadata: {
        type: 'new-releases',
        genres: topGenres,
      },
    };
  }

  /**
   * Build "Because You Watched" section
   */
  private async buildBecauseYouWatchedSection(
    userId: string,
    preferences: UserPreferences,
    limit: number
  ): Promise<FeedSection | null> {
    // Get recent watch history
    const recentWatches = await this.watchHistoryRepository.getRecentByUserId(
      userId,
      5
    );

    if (recentWatches.length === 0) {
      return null;
    }

    // Find the most completed recent watch
    const topWatch = recentWatches.reduce((best, current) =>
      current.completionRate > best.completionRate ? current : best
    );

    // Get content details for the reference
    const [referenceContent] = await this.contentRepository.getByIds([
      topWatch.contentId,
    ]);

    if (!referenceContent) {
      return null;
    }

    // Generate recommendations similar to this content
    try {
      const result = await this.getRecommendations.execute({
        userId,
        limit,
        excludeWatched: true,
      });

      if (result.recommendations.length === 0) {
        return null;
      }

      return {
        id: 'because-you-watched',
        title: `Because You Watched "${referenceContent.title}"`,
        description: 'More like this',
        items: result.recommendations.map(r => r.content),
        priority: 60,
        metadata: {
          type: 'similar',
          referenceContentId: referenceContent.id,
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Refresh specific section
   * Allows partial feed updates
   */
  async refreshSection(
    sectionId: string,
    userId: string,
    preferences: UserPreferences,
    limit: number = 20
  ): Promise<FeedSection | null> {
    switch (sectionId) {
      case 'continue-watching':
        return this.buildContinueWatchingSection(userId, limit);
      case 'personalized':
        return this.buildRecommendationsSection(userId, limit);
      case 'trending':
        return this.buildTrendingSection(limit);
      case 'new-releases':
        return this.buildNewReleasesSection(preferences, limit);
      case 'because-you-watched':
        return this.buildBecauseYouWatchedSection(userId, preferences, limit);
      default:
        throw new Error(`Unknown section: ${sectionId}`);
    }
  }
}

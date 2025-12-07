/**
 * Provider Agent
 * Handles cross-platform content matching and availability
 * Core component of the content fingerprinting moat
 */

import type {
  MediaContent,
  PlatformAvailability,
  CrossPlatformMatch,
  ContentFingerprint,
} from '@media-gateway/core';
import {
  TMDBAdapter,
  AvailabilityService,
  type AggregatedAvailability,
} from '@media-gateway/providers';

/**
 * Provider Agent configuration
 */
export interface ProviderAgentConfig {
  tmdbApiKey?: string;
  defaultRegion?: string;
  cacheTTL?: number;
  enableTMDB?: boolean;
}

/**
 * Provider Agent class
 * Handles availability checking and deep link generation
 */
export class ProviderAgent {
  private vectorWrapper: any;
  private tmdbAdapter?: TMDBAdapter;
  private availabilityService: AvailabilityService;
  private contentMatchCache: Map<string, CrossPlatformMatch> = new Map();
  private readonly cacheTTL: number;
  private readonly defaultRegion: string;

  constructor(vectorWrapper: any, config: ProviderAgentConfig = {}) {
    this.vectorWrapper = vectorWrapper;
    this.cacheTTL = config.cacheTTL ?? 3600000; // 1 hour
    this.defaultRegion = config.defaultRegion ?? 'US';

    // Initialize TMDB adapter if API key is available
    const tmdbApiKey = config.tmdbApiKey ?? process.env.TMDB_API_KEY;
    if (tmdbApiKey) {
      this.tmdbAdapter = new TMDBAdapter({
        apiKey: tmdbApiKey,
        region: this.defaultRegion,
      });
    }

    // Initialize availability service
    this.availabilityService = new AvailabilityService({
      tmdbApiKey,
      enableTMDB: config.enableTMDB ?? !!tmdbApiKey,
      defaultRegion: this.defaultRegion,
      cacheTTL: this.cacheTTL,
    });
  }

  /**
   * Generate content fingerprint for matching
   */
  generateFingerprint(content: MediaContent): ContentFingerprint {
    const normalizedTitle = this.normalizeTitle(content.title);

    return {
      normalizedTitle,
      releaseYear: parseInt(content.releaseDate.substring(0, 4)) || 0,
      runtime: undefined, // Would be populated from full details
      topCast: [],
      director: undefined,
      hash: this.hashFingerprint(normalizedTitle, content.releaseDate),
    };
  }

  /**
   * Normalize title for matching
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generate hash for fingerprint
   */
  private hashFingerprint(normalizedTitle: string, releaseDate: string): string {
    const input = `${normalizedTitle}:${releaseDate.substring(0, 4)}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check availability across all platforms
   */
  async checkAvailability(
    content: MediaContent,
    region?: string
  ): Promise<PlatformAvailability[]> {
    try {
      // Use AvailabilityService to get real TMDB data
      const availability = await this.availabilityService.getAvailability(
        content,
        region ?? this.defaultRegion
      );
      return availability.platforms;
    } catch (error) {
      console.error('Error checking availability:', error);
      // Return empty array on error instead of throwing
      return [];
    }
  }

  /**
   * Find best available platform for user
   */
  async findBestPlatform(
    content: MediaContent,
    userSubscriptions: string[],
    region?: string
  ): Promise<PlatformAvailability | null> {
    try {
      // Use AvailabilityService's optimized platform selection
      return await this.availabilityService.findBestPlatform(
        content,
        userSubscriptions,
        region ?? this.defaultRegion
      );
    } catch (error) {
      console.error('Error finding best platform:', error);
      return null;
    }
  }

  /**
   * Match content across platforms
   */
  async matchAcrossPlatforms(
    content: MediaContent
  ): Promise<CrossPlatformMatch> {
    const cacheKey = `match:${content.id}`;

    // Check cache
    const cached = this.contentMatchCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const fingerprint = this.generateFingerprint(content);
    const matches: Record<string, any> = {};

    try {
      // Get real availability data from TMDB
      const availability = await this.availabilityService.getAvailability(
        content,
        this.defaultRegion
      );

      // Build matches from available platforms
      for (const platform of availability.platforms) {
        matches[platform.platformId] = {
          platformId: platform.platformId,
          contentId: `${platform.platformId}_${content.id}`,
          confidence: 0.98, // High confidence for TMDB data
          deepLink: platform.deepLink,
          lastVerified: new Date(),
        };
      }
    } catch (error) {
      console.error('Error matching across platforms:', error);
      // Continue with empty matches on error
    }

    const result: CrossPlatformMatch = {
      contentFingerprint: fingerprint,
      matches,
    };

    // Cache result
    this.contentMatchCache.set(cacheKey, result);

    return result;
  }

  /**
   * Get all available providers
   */
  getSupportedPlatforms(): Array<{ id: string; name: string }> {
    return this.availabilityService.getSupportedPlatforms();
  }

  /**
   * Get providers available in a region
   */
  getSupportedRegions(): string[] {
    return this.availabilityService.getSupportedRegions();
  }

  /**
   * Search for content using TMDB
   */
  async searchContent(query: string, page: number = 1): Promise<MediaContent[]> {
    if (!this.tmdbAdapter) {
      console.warn('TMDB adapter not initialized. Set TMDB_API_KEY environment variable.');
      return [];
    }

    try {
      return await this.tmdbAdapter.searchMulti(query, page);
    } catch (error) {
      console.error('Error searching content:', error);
      return [];
    }
  }

  /**
   * Get trending content using TMDB
   */
  async getTrending(
    mediaType: 'movie' | 'tv' | 'all' = 'all',
    timeWindow: 'day' | 'week' = 'week'
  ): Promise<MediaContent[]> {
    if (!this.tmdbAdapter) {
      console.warn('TMDB adapter not initialized. Set TMDB_API_KEY environment variable.');
      return [];
    }

    try {
      return await this.tmdbAdapter.getTrending(mediaType, timeWindow);
    } catch (error) {
      console.error('Error getting trending content:', error);
      return [];
    }
  }

  /**
   * Get popular content using TMDB
   */
  async getPopular(mediaType: 'movie' | 'tv' = 'movie', page: number = 1): Promise<MediaContent[]> {
    if (!this.tmdbAdapter) {
      console.warn('TMDB adapter not initialized. Set TMDB_API_KEY environment variable.');
      return [];
    }

    try {
      if (mediaType === 'movie') {
        return await this.tmdbAdapter.getPopularMovies(page);
      } else {
        return await this.tmdbAdapter.getPopularTVShows(page);
      }
    } catch (error) {
      console.error('Error getting popular content:', error);
      return [];
    }
  }

  /**
   * Get content details using TMDB
   */
  async getContentDetails(id: number, mediaType: 'movie' | 'tv'): Promise<MediaContent | null> {
    if (!this.tmdbAdapter) {
      console.warn('TMDB adapter not initialized. Set TMDB_API_KEY environment variable.');
      return null;
    }

    try {
      if (mediaType === 'movie') {
        return await this.tmdbAdapter.getMovie(id);
      } else {
        return await this.tmdbAdapter.getTVShow(id);
      }
    } catch (error) {
      console.error('Error getting content details:', error);
      return null;
    }
  }

  /**
   * Get similar content recommendations
   */
  async getSimilar(
    id: number,
    mediaType: 'movie' | 'tv',
    page: number = 1
  ): Promise<MediaContent[]> {
    if (!this.tmdbAdapter) {
      console.warn('TMDB adapter not initialized. Set TMDB_API_KEY environment variable.');
      return [];
    }

    try {
      return await this.tmdbAdapter.getSimilar(id, mediaType, page);
    } catch (error) {
      console.error('Error getting similar content:', error);
      return [];
    }
  }

  /**
   * Get content recommendations
   */
  async getRecommendations(
    id: number,
    mediaType: 'movie' | 'tv',
    page: number = 1
  ): Promise<MediaContent[]> {
    if (!this.tmdbAdapter) {
      console.warn('TMDB adapter not initialized. Set TMDB_API_KEY environment variable.');
      return [];
    }

    try {
      return await this.tmdbAdapter.getRecommendations(id, mediaType, page);
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return [];
    }
  }

  /**
   * Check if content is available on a specific platform
   */
  async isAvailableOn(
    content: MediaContent,
    platformId: string,
    region?: string
  ): Promise<boolean> {
    try {
      return await this.availabilityService.isAvailableOn(
        content,
        platformId,
        region ?? this.defaultRegion
      );
    } catch (error) {
      console.error('Error checking platform availability:', error);
      return false;
    }
  }

  /**
   * Get availability for multiple content items
   */
  async getBatchAvailability(
    contents: MediaContent[],
    region?: string
  ): Promise<Map<number, AggregatedAvailability>> {
    try {
      return await this.availabilityService.getBatchAvailability(
        contents,
        region ?? this.defaultRegion
      );
    } catch (error) {
      console.error('Error getting batch availability:', error);
      return new Map();
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.contentMatchCache.clear();
    this.availabilityService.clearCache();
    if (this.tmdbAdapter) {
      this.tmdbAdapter.clearCache();
    }
  }

  /**
   * Clean expired cache entries
   */
  cleanupCache(): number {
    const matchCleaned = this.contentMatchCache.size;
    this.contentMatchCache.clear();

    const availabilityCleaned = this.availabilityService.cleanCache();
    const tmdbCleaned = this.tmdbAdapter?.cleanCache() ?? 0;

    return matchCleaned + availabilityCleaned + tmdbCleaned;
  }
}

/**
 * Create a new Provider Agent instance
 */
export function createProviderAgent(
  vectorWrapper: any,
  config?: ProviderAgentConfig
): ProviderAgent {
  return new ProviderAgent(vectorWrapper, config);
}

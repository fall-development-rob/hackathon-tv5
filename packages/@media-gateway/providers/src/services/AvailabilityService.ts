/**
 * Availability Service
 * Aggregates streaming availability from multiple sources
 * Part of the cross-platform data moat
 */

import type { MediaContent, PlatformAvailability } from '@media-gateway/core';
import { TMDBAdapter } from '../adapters/TMDBAdapter.js';

/**
 * Provider ID mapping from TMDB to our internal IDs
 */
const PROVIDER_ID_MAP: Record<number, string> = {
  8: 'netflix',
  9: 'prime',
  337: 'disney',
  384: 'hbo',
  15: 'hulu',
  350: 'apple',
  386: 'peacock',
  531: 'paramount',
  2: 'apple_itunes',
  3: 'google_play',
  10: 'amazon_video',
};

/**
 * Provider name mapping
 */
const PROVIDER_NAMES: Record<string, string> = {
  netflix: 'Netflix',
  prime: 'Amazon Prime Video',
  disney: 'Disney+',
  hbo: 'Max (HBO)',
  hulu: 'Hulu',
  apple: 'Apple TV+',
  peacock: 'Peacock',
  paramount: 'Paramount+',
  apple_itunes: 'Apple iTunes',
  google_play: 'Google Play',
  amazon_video: 'Amazon Video',
};

/**
 * Availability source configuration
 */
export interface AvailabilityConfig {
  tmdbApiKey?: string;
  enableTMDB?: boolean;
  enableJustWatch?: boolean;
  defaultRegion?: string;
  cacheTTL?: number;
}

/**
 * Aggregated availability result
 */
export interface AggregatedAvailability {
  contentId: number;
  mediaType: 'movie' | 'tv';
  region: string;
  platforms: PlatformAvailability[];
  lastUpdated: Date;
  source: string;
}

/**
 * Availability Service class
 * Manages cross-platform availability data
 */
export class AvailabilityService {
  private tmdbAdapter?: TMDBAdapter;
  private config: Required<AvailabilityConfig>;
  private cache: Map<string, { data: AggregatedAvailability; timestamp: number }> = new Map();

  constructor(config: AvailabilityConfig = {}) {
    this.config = {
      tmdbApiKey: config.tmdbApiKey ?? '',
      enableTMDB: config.enableTMDB ?? true,
      enableJustWatch: config.enableJustWatch ?? false,
      defaultRegion: config.defaultRegion ?? 'US',
      cacheTTL: config.cacheTTL ?? 3600000, // 1 hour
    };

    if (this.config.enableTMDB && this.config.tmdbApiKey) {
      this.tmdbAdapter = new TMDBAdapter({ apiKey: this.config.tmdbApiKey });
    }
  }

  /**
   * Get streaming availability for content
   */
  async getAvailability(
    content: MediaContent,
    region?: string
  ): Promise<AggregatedAvailability> {
    const targetRegion = region ?? this.config.defaultRegion;
    const cacheKey = `${content.id}:${content.mediaType}:${targetRegion}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
      return cached.data;
    }

    const platforms: PlatformAvailability[] = [];
    let source = 'unknown';

    // Try TMDB first
    if (this.tmdbAdapter) {
      try {
        const tmdbProviders = await this.tmdbAdapter.getWatchProviders(
          content.id,
          content.mediaType
        );

        const regionData = tmdbProviders.results[targetRegion];
        if (regionData) {
          source = 'tmdb';

          // Process subscription streaming
          if (regionData.flatrate) {
            for (const provider of regionData.flatrate) {
              const platformId = PROVIDER_ID_MAP[provider.provider_id];
              if (platformId) {
                platforms.push({
                  platformId,
                  platformName: provider.provider_name,
                  available: true,
                  type: 'subscription',
                  deepLink: this.generateDeepLink(platformId, content),
                  logoPath: provider.logo_path,
                });
              }
            }
          }

          // Process rental options
          if (regionData.rent) {
            for (const provider of regionData.rent) {
              const platformId = PROVIDER_ID_MAP[provider.provider_id];
              if (platformId) {
                // Check if we already have this provider as subscription
                const existing = platforms.find(p => p.platformId === platformId);
                if (!existing) {
                  platforms.push({
                    platformId,
                    platformName: provider.provider_name,
                    available: true,
                    type: 'rent',
                    deepLink: this.generateDeepLink(platformId, content),
                    logoPath: provider.logo_path,
                  });
                }
              }
            }
          }

          // Process purchase options
          if (regionData.buy) {
            for (const provider of regionData.buy) {
              const platformId = PROVIDER_ID_MAP[provider.provider_id];
              if (platformId) {
                const existing = platforms.find(p => p.platformId === platformId);
                if (!existing) {
                  platforms.push({
                    platformId,
                    platformName: provider.provider_name,
                    available: true,
                    type: 'buy',
                    deepLink: this.generateDeepLink(platformId, content),
                    logoPath: provider.logo_path,
                  });
                }
              }
            }
          }

          // Process free options
          if (regionData.free) {
            for (const provider of regionData.free) {
              const platformId = PROVIDER_ID_MAP[provider.provider_id];
              if (platformId) {
                const existing = platforms.find(p => p.platformId === platformId);
                if (!existing) {
                  platforms.push({
                    platformId,
                    platformName: provider.provider_name,
                    available: true,
                    type: 'free',
                    deepLink: this.generateDeepLink(platformId, content),
                    logoPath: provider.logo_path,
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('TMDB availability lookup failed:', error);
      }
    }

    // If no TMDB data, use simulated data (in production, would use JustWatch or other APIs)
    if (platforms.length === 0) {
      source = 'simulated';
      const simulatedPlatforms = this.simulateAvailability(content, targetRegion);
      platforms.push(...simulatedPlatforms);
    }

    const result: AggregatedAvailability = {
      contentId: content.id,
      mediaType: content.mediaType,
      region: targetRegion,
      platforms,
      lastUpdated: new Date(),
      source,
    };

    // Cache result
    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return result;
  }

  /**
   * Check if content is available on a specific platform
   */
  async isAvailableOn(
    content: MediaContent,
    platformId: string,
    region?: string
  ): Promise<boolean> {
    const availability = await this.getAvailability(content, region);
    return availability.platforms.some(
      p => p.platformId === platformId && p.available
    );
  }

  /**
   * Find best platform for user based on their subscriptions
   */
  async findBestPlatform(
    content: MediaContent,
    userSubscriptions: string[],
    region?: string
  ): Promise<PlatformAvailability | null> {
    const availability = await this.getAvailability(content, region);

    // First, try user's subscriptions
    for (const sub of userSubscriptions) {
      const match = availability.platforms.find(
        p => p.platformId === sub && p.available && p.type === 'subscription'
      );
      if (match) return match;
    }

    // Then, any subscription platform
    const subscription = availability.platforms.find(
      p => p.type === 'subscription' && p.available
    );
    if (subscription) return subscription;

    // Then, free platforms
    const free = availability.platforms.find(
      p => p.type === 'free' && p.available
    );
    if (free) return free;

    // Finally, any available
    return availability.platforms[0] ?? null;
  }

  /**
   * Get availability for multiple content items
   */
  async getBatchAvailability(
    contents: MediaContent[],
    region?: string
  ): Promise<Map<number, AggregatedAvailability>> {
    const results = new Map<number, AggregatedAvailability>();

    // Process in batches of 10 to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < contents.length; i += batchSize) {
      const batch = contents.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(content => this.getAvailability(content, region))
      );

      batchResults.forEach((result, index) => {
        results.set(batch[index]!.id, result);
      });

      // Small delay between batches
      if (i + batchSize < contents.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Generate deep link for a platform
   */
  private generateDeepLink(platformId: string, content: MediaContent): string {
    const slug = content.title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '-');

    const templates: Record<string, string> = {
      netflix: `https://www.netflix.com/title/${content.id}`,
      prime: `https://www.amazon.com/gp/video/detail/${content.id}`,
      disney: `https://www.disneyplus.com/${content.mediaType === 'movie' ? 'movies' : 'series'}/${slug}/${content.id}`,
      hbo: `https://www.max.com/${content.mediaType === 'movie' ? 'movies' : 'series'}/${slug}/${content.id}`,
      hulu: `https://www.hulu.com/${content.mediaType === 'movie' ? 'movie' : 'series'}/${slug}`,
      apple: `https://tv.apple.com/${content.mediaType === 'movie' ? 'movie' : 'show'}/${slug}/${content.id}`,
      peacock: `https://www.peacocktv.com/watch/asset/${content.id}`,
      paramount: `https://www.paramountplus.com/${content.mediaType === 'movie' ? 'movies' : 'shows'}/video/${content.id}`,
      apple_itunes: `https://itunes.apple.com/movie/${content.id}`,
      google_play: `https://play.google.com/store/movies/details?id=${content.id}`,
      amazon_video: `https://www.amazon.com/gp/video/detail/${content.id}`,
    };

    return templates[platformId] ?? `https://www.${platformId}.com/watch/${content.id}`;
  }

  /**
   * Simulate availability for demo/fallback
   */
  private simulateAvailability(
    content: MediaContent,
    _region: string
  ): PlatformAvailability[] {
    const platforms: PlatformAvailability[] = [];
    const allPlatforms = ['netflix', 'prime', 'disney', 'hbo', 'hulu', 'apple', 'peacock', 'paramount'];

    // Use content ID to deterministically select platforms (for consistent demo)
    const seed = content.id;
    const numPlatforms = 2 + (seed % 3); // 2-4 platforms

    for (let i = 0; i < numPlatforms; i++) {
      const platformIndex = (seed + i * 7) % allPlatforms.length;
      const platformId = allPlatforms[platformIndex]!;

      if (!platforms.some(p => p.platformId === platformId)) {
        platforms.push({
          platformId,
          platformName: PROVIDER_NAMES[platformId] ?? platformId,
          available: true,
          type: 'subscription',
          deepLink: this.generateDeepLink(platformId, content),
        });
      }
    }

    return platforms;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clean expired cache entries
   */
  cleanCache(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.cache) {
      if (now - value.timestamp > this.config.cacheTTL) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get supported regions
   */
  getSupportedRegions(): string[] {
    return ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'ES', 'IT', 'BR', 'MX'];
  }

  /**
   * Get supported platforms
   */
  getSupportedPlatforms(): Array<{ id: string; name: string }> {
    return Object.entries(PROVIDER_NAMES).map(([id, name]) => ({ id, name }));
  }
}

/**
 * Create a new Availability Service instance
 */
export function createAvailabilityService(
  config?: AvailabilityConfig
): AvailabilityService {
  return new AvailabilityService(config);
}

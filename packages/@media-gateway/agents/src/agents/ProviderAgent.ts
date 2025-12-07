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

/**
 * Provider configuration
 */
interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  deepLinkTemplate: string;
  regions: string[];
  type: 'subscription' | 'rent' | 'buy' | 'free';
}

/**
 * Available streaming providers
 */
const PROVIDERS: ProviderConfig[] = [
  {
    id: 'netflix',
    name: 'Netflix',
    baseUrl: 'https://www.netflix.com',
    deepLinkTemplate: 'https://www.netflix.com/title/{id}',
    regions: ['US', 'UK', 'CA', 'AU', 'DE', 'FR'],
    type: 'subscription',
  },
  {
    id: 'prime',
    name: 'Amazon Prime Video',
    baseUrl: 'https://www.amazon.com/gp/video',
    deepLinkTemplate: 'https://www.amazon.com/gp/video/detail/{id}',
    regions: ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP'],
    type: 'subscription',
  },
  {
    id: 'disney',
    name: 'Disney+',
    baseUrl: 'https://www.disneyplus.com',
    deepLinkTemplate: 'https://www.disneyplus.com/movies/{slug}/{id}',
    regions: ['US', 'UK', 'CA', 'AU', 'DE', 'FR'],
    type: 'subscription',
  },
  {
    id: 'hbo',
    name: 'Max (HBO)',
    baseUrl: 'https://www.max.com',
    deepLinkTemplate: 'https://www.max.com/movies/{slug}/{id}',
    regions: ['US'],
    type: 'subscription',
  },
  {
    id: 'hulu',
    name: 'Hulu',
    baseUrl: 'https://www.hulu.com',
    deepLinkTemplate: 'https://www.hulu.com/movie/{slug}',
    regions: ['US', 'JP'],
    type: 'subscription',
  },
  {
    id: 'apple',
    name: 'Apple TV+',
    baseUrl: 'https://tv.apple.com',
    deepLinkTemplate: 'https://tv.apple.com/movie/{slug}/{id}',
    regions: ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP'],
    type: 'subscription',
  },
  {
    id: 'peacock',
    name: 'Peacock',
    baseUrl: 'https://www.peacocktv.com',
    deepLinkTemplate: 'https://www.peacocktv.com/watch/asset/{id}',
    regions: ['US', 'UK'],
    type: 'subscription',
  },
  {
    id: 'paramount',
    name: 'Paramount+',
    baseUrl: 'https://www.paramountplus.com',
    deepLinkTemplate: 'https://www.paramountplus.com/movies/video/{id}',
    regions: ['US', 'UK', 'CA', 'AU'],
    type: 'subscription',
  },
];

/**
 * Provider Agent class
 * Handles availability checking and deep link generation
 */
export class ProviderAgent {
  private vectorWrapper: any;
  private contentMatchCache: Map<string, CrossPlatformMatch> = new Map();
  private availabilityCache: Map<string, { data: PlatformAvailability[]; timestamp: number }> = new Map();
  private readonly cacheTTL = 3600000; // 1 hour

  constructor(vectorWrapper: any) {
    this.vectorWrapper = vectorWrapper;
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
    region: string = 'US'
  ): Promise<PlatformAvailability[]> {
    const cacheKey = `${content.id}:${region}`;

    // Check cache
    const cached = this.availabilityCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    const availability: PlatformAvailability[] = [];

    // In production, this would query actual provider APIs or a service like JustWatch
    // For now, simulate with random availability
    for (const provider of PROVIDERS) {
      if (!provider.regions.includes(region)) {
        continue;
      }

      // Simulate availability (in production, would query real API)
      const isAvailable = Math.random() > 0.5;

      if (isAvailable) {
        availability.push({
          platformId: provider.id,
          platformName: provider.name,
          available: true,
          type: provider.type,
          deepLink: this.generateDeepLink(provider, content),
        });
      }
    }

    // Cache result
    this.availabilityCache.set(cacheKey, {
      data: availability,
      timestamp: Date.now(),
    });

    return availability;
  }

  /**
   * Generate deep link for a provider
   */
  generateDeepLink(provider: ProviderConfig, content: MediaContent): string {
    const slug = this.normalizeTitle(content.title).replace(/\s+/g, '-');

    return provider.deepLinkTemplate
      .replace('{id}', content.id.toString())
      .replace('{slug}', slug);
  }

  /**
   * Find best available platform for user
   */
  async findBestPlatform(
    content: MediaContent,
    userSubscriptions: string[],
    region: string = 'US'
  ): Promise<PlatformAvailability | null> {
    const availability = await this.checkAvailability(content, region);

    // First, try subscribed platforms
    for (const sub of userSubscriptions) {
      const match = availability.find(
        a => a.platformId === sub && a.available
      );
      if (match) {
        return match;
      }
    }

    // Then, try any subscription platform
    const subscription = availability.find(
      a => a.type === 'subscription' && a.available
    );
    if (subscription) {
      return subscription;
    }

    // Finally, try free platforms
    const free = availability.find(
      a => a.type === 'free' && a.available
    );
    if (free) {
      return free;
    }

    return availability[0] ?? null;
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

    // In production, would search each platform's catalog
    for (const provider of PROVIDERS) {
      // Simulate match with high confidence
      matches[provider.id] = {
        platformId: provider.id,
        contentId: `${provider.id}_${content.id}`,
        confidence: 0.95 + Math.random() * 0.05,
        deepLink: this.generateDeepLink(provider, content),
        lastVerified: new Date(),
      };
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
  getProviders(): ProviderConfig[] {
    return [...PROVIDERS];
  }

  /**
   * Get providers available in a region
   */
  getProvidersForRegion(region: string): ProviderConfig[] {
    return PROVIDERS.filter(p => p.regions.includes(region));
  }

  /**
   * Clear expired cache entries
   */
  cleanupCache(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.availabilityCache) {
      if (now - value.timestamp > this.cacheTTL) {
        this.availabilityCache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

/**
 * Create a new Provider Agent instance
 */
export function createProviderAgent(vectorWrapper: any): ProviderAgent {
  return new ProviderAgent(vectorWrapper);
}

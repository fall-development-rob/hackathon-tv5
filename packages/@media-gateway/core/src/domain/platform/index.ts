/**
 * Platform Domain Layer
 *
 * Domain entities and value objects for streaming platforms, availability, and pricing.
 * Handles platform-specific business logic and cross-platform matching.
 */

import type {
  PlatformAvailability as PlatformAvailabilityType,
  ContentFingerprint,
  CrossPlatformMatch,
  PlatformContentMatch,
} from '../../types/index.js';

// Re-export platform-related types from existing types
export type {
  PlatformAvailability,
  ContentFingerprint,
  CrossPlatformMatch,
  PlatformContentMatch,
} from '../../types/index.js';

/**
 * Platform Entity
 * Represents a streaming platform with its properties and capabilities
 */
export class Platform {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly displayName: string,
    public readonly logoUrl?: string,
    public readonly baseUrl?: string,
    public readonly supportedRegions: string[] = ['US']
  ) {}

  /**
   * Check if platform is available in region
   */
  isAvailableInRegion(region: string): boolean {
    return this.supportedRegions.includes(region.toUpperCase());
  }

  /**
   * Get deep link URL for content
   */
  getDeepLink(contentId: string): string | null {
    if (!this.baseUrl) return null;
    return `${this.baseUrl}/watch/${contentId}`;
  }

  /**
   * Check if platform equals another
   */
  equals(other: Platform): boolean {
    return this.id === other.id;
  }
}

/**
 * Availability Value Object
 * Represents content availability on a specific platform
 */
export class Availability {
  constructor(
    public readonly platformId: string,
    public readonly platformName: string,
    public readonly available: boolean,
    public readonly type: 'subscription' | 'rent' | 'buy' | 'free',
    public readonly price?: number,
    public readonly deepLink?: string,
    public readonly expiresAt?: Date
  ) {}

  /**
   * Check if available for free (subscription or free tier)
   */
  isFree(): boolean {
    return this.available && (this.type === 'subscription' || this.type === 'free');
  }

  /**
   * Check if requires payment
   */
  requiresPayment(): boolean {
    return this.available && (this.type === 'rent' || this.type === 'buy');
  }

  /**
   * Get formatted price
   */
  getFormattedPrice(): string | null {
    if (!this.price) return null;
    return `$${(this.price / 100).toFixed(2)}`;
  }

  /**
   * Check if availability is expiring soon (within 7 days)
   */
  isExpiringSoon(): boolean {
    if (!this.expiresAt) return false;
    const daysUntilExpiry = Math.floor(
      (this.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
  }

  /**
   * Check if availability has expired
   */
  hasExpired(): boolean {
    if (!this.expiresAt) return false;
    return this.expiresAt < new Date();
  }

  /**
   * Get days until expiry
   */
  getDaysUntilExpiry(): number | null {
    if (!this.expiresAt) return null;
    return Math.floor(
      (this.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  }
}

/**
 * Pricing Value Object
 * Represents pricing information for content on a platform
 */
export class Pricing {
  constructor(
    public readonly rentPrice?: number,
    public readonly buyPrice?: number,
    public readonly currency: string = 'USD'
  ) {}

  /**
   * Check if rental is available
   */
  hasRentalOption(): boolean {
    return this.rentPrice !== undefined && this.rentPrice > 0;
  }

  /**
   * Check if purchase is available
   */
  hasPurchaseOption(): boolean {
    return this.buyPrice !== undefined && this.buyPrice > 0;
  }

  /**
   * Get formatted rental price
   */
  getFormattedRentPrice(): string | null {
    if (!this.rentPrice) return null;
    return `${this.currency} ${(this.rentPrice / 100).toFixed(2)}`;
  }

  /**
   * Get formatted purchase price
   */
  getFormattedBuyPrice(): string | null {
    if (!this.buyPrice) return null;
    return `${this.currency} ${(this.buyPrice / 100).toFixed(2)}`;
  }

  /**
   * Get cheapest option
   */
  getCheapestOption(): { type: 'rent' | 'buy'; price: number } | null {
    const options: Array<{ type: 'rent' | 'buy'; price: number }> = [];

    if (this.hasRentalOption()) {
      options.push({ type: 'rent', price: this.rentPrice! });
    }
    if (this.hasPurchaseOption()) {
      options.push({ type: 'buy', price: this.buyPrice! });
    }

    if (options.length === 0) return null;
    return options.reduce((min, opt) => opt.price < min.price ? opt : min);
  }

  /**
   * Calculate savings by buying vs renting multiple times
   */
  getBuyVsRentBreakeven(): number | null {
    if (!this.hasRentalOption() || !this.hasPurchaseOption()) return null;
    return Math.ceil(this.buyPrice! / this.rentPrice!);
  }
}

/**
 * Content Match Value Object
 * Represents a cross-platform content match with confidence score
 */
export class ContentMatch {
  constructor(
    public readonly fingerprint: ContentFingerprint,
    public readonly platformMatches: Map<string, PlatformContentMatch>
  ) {}

  /**
   * Get match for specific platform
   */
  getMatchForPlatform(platformId: string): PlatformContentMatch | undefined {
    return this.platformMatches.get(platformId);
  }

  /**
   * Check if content is available on platform
   */
  isAvailableOn(platformId: string): boolean {
    return this.platformMatches.has(platformId);
  }

  /**
   * Get all available platforms
   */
  getAvailablePlatforms(): string[] {
    return Array.from(this.platformMatches.keys());
  }

  /**
   * Get high-confidence matches (confidence >= 0.9)
   */
  getHighConfidenceMatches(): PlatformContentMatch[] {
    return Array.from(this.platformMatches.values())
      .filter(match => match.confidence >= 0.9);
  }

  /**
   * Get matches sorted by confidence
   */
  getMatchesByConfidence(): PlatformContentMatch[] {
    return Array.from(this.platformMatches.values())
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get best match (highest confidence)
   */
  getBestMatch(): PlatformContentMatch | null {
    const matches = this.getMatchesByConfidence();
    return matches.length > 0 ? matches[0] ?? null : null;
  }

  /**
   * Check if any matches need verification (older than 30 days)
   */
  hasStaleMatches(): boolean {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return Array.from(this.platformMatches.values())
      .some(match => match.lastVerified < thirtyDaysAgo);
  }

  /**
   * Get stale matches that need verification
   */
  getStaleMatches(): PlatformContentMatch[] {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return Array.from(this.platformMatches.values())
      .filter(match => match.lastVerified < thirtyDaysAgo);
  }
}

/**
 * Platform Subscription Value Object
 * Represents user's subscription to a platform
 */
export class PlatformSubscription {
  constructor(
    public readonly platformId: string,
    public readonly platformName: string,
    public readonly status: 'active' | 'expired' | 'canceled' | 'trial',
    public readonly startDate: Date,
    public readonly expiryDate?: Date,
    public readonly tier?: string,
    public readonly autoRenew: boolean = false
  ) {}

  /**
   * Check if subscription is active
   */
  isActive(): boolean {
    return this.status === 'active' || this.status === 'trial';
  }

  /**
   * Check if subscription is expired
   */
  isExpired(): boolean {
    if (!this.expiryDate) return false;
    return this.expiryDate < new Date();
  }

  /**
   * Check if subscription is in trial period
   */
  isTrial(): boolean {
    return this.status === 'trial';
  }

  /**
   * Get days remaining in subscription
   */
  getDaysRemaining(): number | null {
    if (!this.expiryDate) return null;
    return Math.max(0, Math.floor(
      (this.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ));
  }

  /**
   * Check if subscription is expiring soon (within 7 days)
   */
  isExpiringSoon(): boolean {
    const daysRemaining = this.getDaysRemaining();
    return daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0;
  }

  /**
   * Get subscription duration in days
   */
  getSubscriptionDuration(): number {
    return Math.floor(
      (Date.now() - this.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }
}

/**
 * Platform Statistics Value Object
 * Aggregated statistics for a platform
 */
export class PlatformStatistics {
  constructor(
    public readonly platformId: string,
    public readonly totalContent: number,
    public readonly movieCount: number,
    public readonly tvCount: number,
    public readonly averageRating: number,
    public readonly lastUpdated: Date
  ) {}

  /**
   * Get percentage of movies
   */
  getMoviePercentage(): number {
    if (this.totalContent === 0) return 0;
    return (this.movieCount / this.totalContent) * 100;
  }

  /**
   * Get percentage of TV shows
   */
  getTvPercentage(): number {
    if (this.totalContent === 0) return 0;
    return (this.tvCount / this.totalContent) * 100;
  }

  /**
   * Check if statistics are stale (older than 7 days)
   */
  isStale(): boolean {
    const daysSinceUpdate = Math.floor(
      (Date.now() - this.lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceUpdate >= 7;
  }

  /**
   * Check if platform has good content quality (avg rating >= 7)
   */
  hasGoodQuality(): boolean {
    return this.averageRating >= 7.0;
  }
}

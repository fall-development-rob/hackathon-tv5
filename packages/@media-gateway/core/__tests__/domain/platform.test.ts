/**
 * Platform Domain Layer Tests
 *
 * Tests for Platform, Availability, Pricing, ContentMatch, PlatformSubscription, and PlatformStatistics
 */

import { describe, it, expect } from 'vitest';
import {
  Platform,
  Availability,
  Pricing,
  ContentMatch,
  PlatformSubscription,
  PlatformStatistics,
  type ContentFingerprint,
  type PlatformContentMatch,
} from '../../src/domain/platform/index.js';

describe('Platform Entity', () => {
  const createTestPlatform = () => new Platform(
    'netflix',
    'Netflix',
    'Netflix',
    'https://example.com/netflix-logo.png',
    'https://netflix.com',
    ['US', 'CA', 'UK']
  );

  describe('isAvailableInRegion', () => {
    it('should return true for supported region', () => {
      const platform = createTestPlatform();
      expect(platform.isAvailableInRegion('US')).toBe(true);
      expect(platform.isAvailableInRegion('us')).toBe(true); // Case insensitive
    });

    it('should return false for unsupported region', () => {
      const platform = createTestPlatform();
      expect(platform.isAvailableInRegion('JP')).toBe(false);
    });
  });

  describe('getDeepLink', () => {
    it('should generate deep link with content ID', () => {
      const platform = createTestPlatform();
      expect(platform.getDeepLink('12345')).toBe('https://netflix.com/watch/12345');
    });

    it('should return null when base URL is undefined', () => {
      const platform = new Platform('test', 'Test', 'Test', undefined, undefined);
      expect(platform.getDeepLink('12345')).toBeNull();
    });
  });

  describe('equals', () => {
    it('should return true for platforms with same ID', () => {
      const p1 = createTestPlatform();
      const p2 = new Platform('netflix', 'Netflix Clone', 'Netflix');
      expect(p1.equals(p2)).toBe(true);
    });

    it('should return false for different platforms', () => {
      const p1 = createTestPlatform();
      const p2 = new Platform('hulu', 'Hulu', 'Hulu');
      expect(p1.equals(p2)).toBe(false);
    });
  });
});

describe('Availability Value Object', () => {
  const createAvailability = (type: 'subscription' | 'rent' | 'buy' | 'free' = 'subscription') =>
    new Availability(
      'netflix',
      'Netflix',
      true,
      type,
      type === 'rent' ? 399 : type === 'buy' ? 1499 : undefined,
      'https://netflix.com/watch/123'
    );

  describe('isFree', () => {
    it('should return true for subscription type', () => {
      const avail = createAvailability('subscription');
      expect(avail.isFree()).toBe(true);
    });

    it('should return true for free type', () => {
      const avail = createAvailability('free');
      expect(avail.isFree()).toBe(true);
    });

    it('should return false for rent/buy types', () => {
      expect(createAvailability('rent').isFree()).toBe(false);
      expect(createAvailability('buy').isFree()).toBe(false);
    });
  });

  describe('requiresPayment', () => {
    it('should return true for rent and buy', () => {
      expect(createAvailability('rent').requiresPayment()).toBe(true);
      expect(createAvailability('buy').requiresPayment()).toBe(true);
    });

    it('should return false for subscription and free', () => {
      expect(createAvailability('subscription').requiresPayment()).toBe(false);
      expect(createAvailability('free').requiresPayment()).toBe(false);
    });
  });

  describe('getFormattedPrice', () => {
    it('should format rent price correctly', () => {
      const avail = createAvailability('rent');
      expect(avail.getFormattedPrice()).toBe('$3.99');
    });

    it('should format buy price correctly', () => {
      const avail = createAvailability('buy');
      expect(avail.getFormattedPrice()).toBe('$14.99');
    });

    it('should return null when price is undefined', () => {
      const avail = createAvailability('subscription');
      expect(avail.getFormattedPrice()).toBeNull();
    });
  });

  describe('expiration handling', () => {
    it('should detect expiring soon content (within 7 days)', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const avail = new Availability('netflix', 'Netflix', true, 'subscription', undefined, undefined, futureDate);
      expect(avail.isExpiringSoon()).toBe(true);
    });

    it('should not flag content expiring in more than 7 days', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const avail = new Availability('netflix', 'Netflix', true, 'subscription', undefined, undefined, futureDate);
      expect(avail.isExpiringSoon()).toBe(false);
    });

    it('should detect expired content', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const avail = new Availability('netflix', 'Netflix', true, 'subscription', undefined, undefined, pastDate);
      expect(avail.hasExpired()).toBe(true);
    });

    it('should calculate days until expiry', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const avail = new Availability('netflix', 'Netflix', true, 'subscription', undefined, undefined, futureDate);
      const days = avail.getDaysUntilExpiry();
      expect(days).toBeGreaterThanOrEqual(9);
      expect(days).toBeLessThanOrEqual(10);
    });
  });
});

describe('Pricing Value Object', () => {
  describe('option availability', () => {
    it('should detect rental option', () => {
      const pricing = new Pricing(399, undefined);
      expect(pricing.hasRentalOption()).toBe(true);
      expect(pricing.hasPurchaseOption()).toBe(false);
    });

    it('should detect purchase option', () => {
      const pricing = new Pricing(undefined, 1499);
      expect(pricing.hasRentalOption()).toBe(false);
      expect(pricing.hasPurchaseOption()).toBe(true);
    });

    it('should detect both options', () => {
      const pricing = new Pricing(399, 1499);
      expect(pricing.hasRentalOption()).toBe(true);
      expect(pricing.hasPurchaseOption()).toBe(true);
    });
  });

  describe('formatted prices', () => {
    it('should format rental price', () => {
      const pricing = new Pricing(399);
      expect(pricing.getFormattedRentPrice()).toBe('USD 3.99');
    });

    it('should format purchase price', () => {
      const pricing = new Pricing(undefined, 1499, 'EUR');
      expect(pricing.getFormattedBuyPrice()).toBe('EUR 14.99');
    });
  });

  describe('getCheapestOption', () => {
    it('should return rent if cheaper', () => {
      const pricing = new Pricing(399, 1499);
      const cheapest = pricing.getCheapestOption();
      expect(cheapest?.type).toBe('rent');
      expect(cheapest?.price).toBe(399);
    });

    it('should return buy if cheaper', () => {
      const pricing = new Pricing(1999, 999);
      const cheapest = pricing.getCheapestOption();
      expect(cheapest?.type).toBe('buy');
      expect(cheapest?.price).toBe(999);
    });

    it('should return null when no options available', () => {
      const pricing = new Pricing();
      expect(pricing.getCheapestOption()).toBeNull();
    });
  });

  describe('getBuyVsRentBreakeven', () => {
    it('should calculate correct breakeven point', () => {
      const pricing = new Pricing(399, 1499);
      expect(pricing.getBuyVsRentBreakeven()).toBe(4); // 1499/399 = 3.76 -> 4
    });

    it('should return null when options missing', () => {
      const pricing = new Pricing(399);
      expect(pricing.getBuyVsRentBreakeven()).toBeNull();
    });
  });
});

describe('ContentMatch Value Object', () => {
  const createFingerprint = (): ContentFingerprint => ({
    tmdbId: 123,
    imdbId: 'tt1234567',
    title: 'Test Movie',
    year: 2023,
    mediaType: 'movie',
  });

  const createMatch = (platformId: string, confidence: number): PlatformContentMatch => ({
    platformId,
    platformContentId: `${platformId}-123`,
    confidence,
    lastVerified: new Date(),
  });

  it('should get match for specific platform', () => {
    const matches = new Map([
      ['netflix', createMatch('netflix', 0.95)],
      ['hulu', createMatch('hulu', 0.85)],
    ]);
    const contentMatch = new ContentMatch(createFingerprint(), matches);

    const netflixMatch = contentMatch.getMatchForPlatform('netflix');
    expect(netflixMatch?.confidence).toBe(0.95);
  });

  it('should check availability on platform', () => {
    const matches = new Map([['netflix', createMatch('netflix', 0.95)]]);
    const contentMatch = new ContentMatch(createFingerprint(), matches);

    expect(contentMatch.isAvailableOn('netflix')).toBe(true);
    expect(contentMatch.isAvailableOn('hulu')).toBe(false);
  });

  it('should list available platforms', () => {
    const matches = new Map([
      ['netflix', createMatch('netflix', 0.95)],
      ['hulu', createMatch('hulu', 0.85)],
    ]);
    const contentMatch = new ContentMatch(createFingerprint(), matches);

    const platforms = contentMatch.getAvailablePlatforms();
    expect(platforms).toContain('netflix');
    expect(platforms).toContain('hulu');
    expect(platforms).toHaveLength(2);
  });

  it('should filter high confidence matches', () => {
    const matches = new Map([
      ['netflix', createMatch('netflix', 0.95)],
      ['hulu', createMatch('hulu', 0.85)],
      ['disney', createMatch('disney', 0.92)],
    ]);
    const contentMatch = new ContentMatch(createFingerprint(), matches);

    const highConfidence = contentMatch.getHighConfidenceMatches();
    expect(highConfidence).toHaveLength(2);
    expect(highConfidence.every(m => m.confidence >= 0.9)).toBe(true);
  });

  it('should sort matches by confidence', () => {
    const matches = new Map([
      ['netflix', createMatch('netflix', 0.85)],
      ['hulu', createMatch('hulu', 0.95)],
      ['disney', createMatch('disney', 0.90)],
    ]);
    const contentMatch = new ContentMatch(createFingerprint(), matches);

    const sorted = contentMatch.getMatchesByConfidence();
    expect(sorted[0]!.platformId).toBe('hulu');
    expect(sorted[1]!.platformId).toBe('disney');
    expect(sorted[2]!.platformId).toBe('netflix');
  });

  it('should detect stale matches', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40);

    const matches = new Map([
      ['netflix', { ...createMatch('netflix', 0.95), lastVerified: oldDate }],
    ]);
    const contentMatch = new ContentMatch(createFingerprint(), matches);

    expect(contentMatch.hasStaleMatches()).toBe(true);
    expect(contentMatch.getStaleMatches()).toHaveLength(1);
  });
});

describe('PlatformSubscription Value Object', () => {
  const createSubscription = (status: 'active' | 'expired' | 'canceled' | 'trial' = 'active') => {
    const start = new Date('2024-01-01');
    const expiry = new Date('2024-12-31');
    return new PlatformSubscription('netflix', 'Netflix', status, start, expiry, 'Premium', true);
  };

  describe('status checks', () => {
    it('should identify active subscriptions', () => {
      const sub = createSubscription('active');
      expect(sub.isActive()).toBe(true);
      expect(sub.isExpired()).toBe(false);
    });

    it('should identify trial subscriptions as active', () => {
      const sub = createSubscription('trial');
      expect(sub.isActive()).toBe(true);
      expect(sub.isTrial()).toBe(true);
    });

    it('should identify expired subscriptions', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const sub = new PlatformSubscription('netflix', 'Netflix', 'expired', new Date(), pastDate);
      expect(sub.isExpired()).toBe(true);
    });
  });

  describe('days remaining', () => {
    it('should calculate days remaining correctly', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const sub = new PlatformSubscription('netflix', 'Netflix', 'active', new Date(), futureDate);

      const remaining = sub.getDaysRemaining();
      expect(remaining).toBeGreaterThanOrEqual(29);
      expect(remaining).toBeLessThanOrEqual(30);
    });

    it('should return 0 for expired subscriptions', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const sub = new PlatformSubscription('netflix', 'Netflix', 'expired', new Date(), pastDate);
      expect(sub.getDaysRemaining()).toBe(0);
    });
  });

  it('should detect expiring soon subscriptions', () => {
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 5);
    const sub = new PlatformSubscription('netflix', 'Netflix', 'active', new Date(), soonDate);
    expect(sub.isExpiringSoon()).toBe(true);
  });

  it('should calculate subscription duration', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 100);
    const sub = new PlatformSubscription('netflix', 'Netflix', 'active', startDate);

    const duration = sub.getSubscriptionDuration();
    expect(duration).toBeGreaterThanOrEqual(99);
    expect(duration).toBeLessThanOrEqual(100);
  });
});

describe('PlatformStatistics Value Object', () => {
  const createStats = () => new PlatformStatistics(
    'netflix',
    1000,
    600,
    400,
    7.5,
    new Date()
  );

  it('should calculate movie percentage', () => {
    const stats = createStats();
    expect(stats.getMoviePercentage()).toBe(60);
  });

  it('should calculate TV percentage', () => {
    const stats = createStats();
    expect(stats.getTvPercentage()).toBe(40);
  });

  it('should handle zero total content', () => {
    const stats = new PlatformStatistics('empty', 0, 0, 0, 0, new Date());
    expect(stats.getMoviePercentage()).toBe(0);
    expect(stats.getTvPercentage()).toBe(0);
  });

  it('should detect stale statistics', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    const stats = new PlatformStatistics('netflix', 1000, 600, 400, 7.5, oldDate);
    expect(stats.isStale()).toBe(true);
  });

  it('should detect good quality content', () => {
    const goodStats = new PlatformStatistics('quality', 100, 50, 50, 8.0, new Date());
    const poorStats = new PlatformStatistics('poor', 100, 50, 50, 5.0, new Date());

    expect(goodStats.hasGoodQuality()).toBe(true);
    expect(poorStats.hasGoodQuality()).toBe(false);
  });
});

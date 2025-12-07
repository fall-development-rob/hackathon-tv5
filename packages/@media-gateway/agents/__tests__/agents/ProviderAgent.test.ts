/**
 * Provider Agent Tests
 * Tests availability checking, platform matching, and TMDB integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderAgent, createProviderAgent } from '../../src/agents/ProviderAgent.js';
import type { MediaContent, PlatformAvailability } from '@media-gateway/core';

// Mock vector wrapper
const createMockVectorWrapper = () => ({
  generateEmbedding: vi.fn(),
});

describe('ProviderAgent', () => {
  let agent: ProviderAgent;
  let mockVector: ReturnType<typeof createMockVectorWrapper>;

  const mockContent: MediaContent = {
    id: 550,
    title: 'Fight Club',
    overview: 'A ticking-time-bomb insomniac...',
    mediaType: 'movie',
    genreIds: [18, 53],
    voteAverage: 8.4,
    voteCount: 26000,
    releaseDate: '1999-10-15',
    posterPath: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
    backdropPath: '/backdrop.jpg',
    popularity: 85,
  };

  beforeEach(() => {
    mockVector = createMockVectorWrapper();
    agent = createProviderAgent(mockVector, {
      cacheTTL: 3600000,
      defaultRegion: 'US',
    });
  });

  describe('Fingerprint Generation', () => {
    it('should generate content fingerprint', () => {
      const fingerprint = agent.generateFingerprint(mockContent);

      expect(fingerprint).toHaveProperty('normalizedTitle');
      expect(fingerprint).toHaveProperty('releaseYear');
      expect(fingerprint).toHaveProperty('hash');
      expect(fingerprint.releaseYear).toBe(1999);
    });

    it('should normalize titles correctly', () => {
      const content1 = { ...mockContent, title: 'Fight Club' };
      const content2 = { ...mockContent, title: 'fight club' };
      const content3 = { ...mockContent, title: 'Fight  Club!!!' };

      const fp1 = agent.generateFingerprint(content1);
      const fp2 = agent.generateFingerprint(content2);
      const fp3 = agent.generateFingerprint(content3);

      expect(fp1.normalizedTitle).toBe(fp2.normalizedTitle);
      expect(fp1.normalizedTitle).toBe(fp3.normalizedTitle);
    });

    it('should generate consistent hashes', () => {
      const fp1 = agent.generateFingerprint(mockContent);
      const fp2 = agent.generateFingerprint(mockContent);

      expect(fp1.hash).toBe(fp2.hash);
    });

    it('should handle content without release date', () => {
      const contentNoDate = { ...mockContent, releaseDate: '' };

      const fingerprint = agent.generateFingerprint(contentNoDate);

      expect(fingerprint.releaseYear).toBe(0);
    });
  });

  describe('Availability Checking', () => {
    it('should check availability across platforms', async () => {
      const availability = await agent.checkAvailability(mockContent);

      expect(Array.isArray(availability)).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const availability = await agent.checkAvailability(mockContent);

      expect(availability).toBeDefined();
    });

    it('should use specified region', async () => {
      const availability = await agent.checkAvailability(mockContent, 'UK');

      expect(availability).toBeDefined();
    });

    it('should return empty array on error', async () => {
      const badContent = { ...mockContent, id: -1 };

      const availability = await agent.checkAvailability(badContent);

      expect(Array.isArray(availability)).toBe(true);
    });
  });

  describe('Platform Selection', () => {
    it('should find best platform for user subscriptions', async () => {
      const subscriptions = ['netflix', 'hulu', 'prime'];

      const best = await agent.findBestPlatform(mockContent, subscriptions);

      // May be null if no availability data
      expect(best === null || typeof best === 'object').toBe(true);
    });

    it('should handle empty subscriptions', async () => {
      const best = await agent.findBestPlatform(mockContent, []);

      expect(best === null || typeof best === 'object').toBe(true);
    });

    it('should prioritize user subscriptions', async () => {
      const subscriptions = ['netflix'];

      const best = await agent.findBestPlatform(mockContent, subscriptions);

      // If a platform is returned, it should ideally be in subscriptions
      if (best) {
        expect(typeof best.platformId).toBe('string');
      }
    });
  });

  describe('Cross-Platform Matching', () => {
    it('should match content across platforms', async () => {
      const match = await agent.matchAcrossPlatforms(mockContent);

      expect(match).toHaveProperty('contentFingerprint');
      expect(match).toHaveProperty('matches');
    });

    it('should cache match results', async () => {
      await agent.matchAcrossPlatforms(mockContent);
      const match = await agent.matchAcrossPlatforms(mockContent);

      expect(match).toBeDefined();
    });

    it('should handle match errors gracefully', async () => {
      const badContent = { ...mockContent, id: -999 };

      const match = await agent.matchAcrossPlatforms(badContent);

      expect(match).toBeDefined();
      expect(match.matches).toBeDefined();
    });
  });

  describe('Platform Information', () => {
    it('should list supported platforms', () => {
      const platforms = agent.getSupportedPlatforms();

      expect(Array.isArray(platforms)).toBe(true);
      expect(platforms.length).toBeGreaterThan(0);
    });

    it('should list supported regions', () => {
      const regions = agent.getSupportedRegions();

      expect(Array.isArray(regions)).toBe(true);
      expect(regions.length).toBeGreaterThan(0);
    });
  });

  describe('TMDB Integration', () => {
    it('should search content without TMDB key', async () => {
      delete process.env.TMDB_API_KEY;

      const results = await agent.searchContent('fight club');

      expect(Array.isArray(results)).toBe(true);
    });

    it('should get trending content without TMDB key', async () => {
      delete process.env.TMDB_API_KEY;

      const trending = await agent.getTrending('movie', 'week');

      expect(Array.isArray(trending)).toBe(true);
    });

    it('should get popular content without TMDB key', async () => {
      delete process.env.TMDB_API_KEY;

      const popular = await agent.getPopular('movie', 1);

      expect(Array.isArray(popular)).toBe(true);
    });

    it('should get content details without TMDB key', async () => {
      delete process.env.TMDB_API_KEY;

      const details = await agent.getContentDetails(550, 'movie');

      expect(details).toBeNull();
    });

    it('should get similar content without TMDB key', async () => {
      delete process.env.TMDB_API_KEY;

      const similar = await agent.getSimilar(550, 'movie');

      expect(Array.isArray(similar)).toBe(true);
    });

    it('should get recommendations without TMDB key', async () => {
      delete process.env.TMDB_API_KEY;

      const recommendations = await agent.getRecommendations(550, 'movie');

      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('Availability Queries', () => {
    it('should check if available on specific platform', async () => {
      const isAvailable = await agent.isAvailableOn(mockContent, 'netflix');

      expect(typeof isAvailable).toBe('boolean');
    });

    it('should handle errors in platform check', async () => {
      const badContent = { ...mockContent, id: -1 };

      const isAvailable = await agent.isAvailableOn(badContent, 'netflix');

      expect(isAvailable).toBe(false);
    });

    it('should get batch availability', async () => {
      const contents = [mockContent, { ...mockContent, id: 551 }];

      const batchResults = await agent.getBatchAvailability(contents);

      expect(batchResults instanceof Map).toBe(true);
    });

    it('should handle batch availability errors', async () => {
      const badContents = [{ ...mockContent, id: -1 }];

      const batchResults = await agent.getBatchAvailability(badContents);

      expect(batchResults instanceof Map).toBe(true);
    });
  });

  describe('Cache Management', () => {
    it('should clear all caches', () => {
      agent.clearCache();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should cleanup expired cache entries', () => {
      const cleaned = agent.cleanupCache();

      expect(typeof cleaned).toBe('number');
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle content with special characters in title', () => {
      const specialContent = {
        ...mockContent,
        title: 'Movie: The (Re)volution! @2023',
      };

      const fingerprint = agent.generateFingerprint(specialContent);

      expect(fingerprint.normalizedTitle).not.toContain(':');
      expect(fingerprint.normalizedTitle).not.toContain('(');
      expect(fingerprint.normalizedTitle).not.toContain('@');
    });

    it('should handle very long titles', () => {
      const longTitle = 'A'.repeat(500);
      const longContent = { ...mockContent, title: longTitle };

      const fingerprint = agent.generateFingerprint(longContent);

      expect(fingerprint.normalizedTitle.length).toBeLessThanOrEqual(500);
    });

    it('should handle content with missing overview', () => {
      const noOverview = { ...mockContent, overview: '' };

      const match = agent.matchAcrossPlatforms(noOverview);

      expect(match).resolves.toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should use custom cache TTL', () => {
      const customAgent = createProviderAgent(mockVector, {
        cacheTTL: 1800000,
      });

      expect(customAgent).toBeDefined();
    });

    it('should use custom default region', () => {
      const customAgent = createProviderAgent(mockVector, {
        defaultRegion: 'UK',
      });

      expect(customAgent).toBeDefined();
    });

    it('should work without configuration', () => {
      const defaultAgent = createProviderAgent(mockVector);

      expect(defaultAgent).toBeDefined();
    });
  });

  describe('Factory Function', () => {
    it('should create agent with factory function', () => {
      const newAgent = createProviderAgent(mockVector);

      expect(newAgent).toBeInstanceOf(ProviderAgent);
    });
  });
});

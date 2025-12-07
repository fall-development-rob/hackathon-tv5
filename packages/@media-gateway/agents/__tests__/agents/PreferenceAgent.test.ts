/**
 * Preference Agent Tests
 * Tests preference learning, scoring, and vector operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PreferenceAgent, createPreferenceAgent } from '../../src/agents/PreferenceAgent.js';
import type { UserPreferences, WatchEvent, MediaContent } from '@media-gateway/core';

// Mock database and vector wrappers
const createMockDbWrapper = () => ({
  getPreferencePattern: vi.fn(),
  storePreferencePattern: vi.fn(),
  storeWatchEpisode: vi.fn(),
});

const createMockVectorWrapper = () => ({
  generateEmbedding: vi.fn(),
});

describe('PreferenceAgent', () => {
  let agent: PreferenceAgent;
  let mockDb: ReturnType<typeof createMockDbWrapper>;
  let mockVector: ReturnType<typeof createMockVectorWrapper>;

  const mockPreferences: UserPreferences = {
    vector: new Float32Array(768).fill(0.5),
    confidence: 0.7,
    genreAffinities: { 28: 0.8, 35: 0.6, 18: 0.75 },
    moodMappings: [],
    temporalPatterns: [],
    updatedAt: new Date(),
  };

  const mockContent: MediaContent = {
    id: 123,
    title: 'Test Movie',
    overview: 'A great action movie',
    mediaType: 'movie',
    genreIds: [28, 12],
    voteAverage: 8.5,
    voteCount: 1000,
    releaseDate: '2023-01-01',
    posterPath: '/test.jpg',
    backdropPath: '/backdrop.jpg',
    popularity: 100,
  };

  beforeEach(() => {
    mockDb = createMockDbWrapper();
    mockVector = createMockVectorWrapper();
    agent = createPreferenceAgent('user-123', mockDb, mockVector);
  });

  describe('Preference Retrieval', () => {
    it('should get preferences from database', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);

      const prefs = await agent.getPreferences();

      expect(prefs).toEqual(mockPreferences);
      expect(mockDb.getPreferencePattern).toHaveBeenCalledWith('user-123');
    });

    it('should return initial preferences for new users', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(null);

      const prefs = await agent.getPreferences();

      expect(prefs.vector).toBeNull();
      expect(prefs.confidence).toBe(0);
      expect(prefs.genreAffinities).toEqual({});
    });

    it('should cache preferences', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);

      await agent.getPreferences();
      await agent.getPreferences();

      expect(mockDb.getPreferencePattern).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache after TTL', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);

      await agent.getPreferences();

      // Wait for cache to expire (mocked time)
      vi.useFakeTimers();
      vi.advanceTimersByTime(61000); // 61 seconds

      await agent.getPreferences();

      expect(mockDb.getPreferencePattern).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('Learning from Watch Events', () => {
    it('should learn from completed watch event', async () => {
      const watchEvent: WatchEvent = {
        userId: 'user-123',
        contentId: 123,
        mediaType: 'movie',
        watchedAt: new Date(),
        completionRate: 1.0,
        rating: 5,
        sessionDuration: 7200,
        interactions: { pauses: 1, skips: 0, rewinds: 2 },
      };

      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.6));

      const updated = await agent.learnFromWatchEvent(watchEvent, mockContent);

      expect(updated.confidence).toBeGreaterThan(mockPreferences.confidence);
      expect(mockDb.storePreferencePattern).toHaveBeenCalled();
      expect(mockDb.storeWatchEpisode).toHaveBeenCalledWith(watchEvent);
    });

    it('should handle watch events with low engagement', async () => {
      const watchEvent: WatchEvent = {
        userId: 'user-123',
        contentId: 123,
        mediaType: 'movie',
        watchedAt: new Date(),
        completionRate: 0.2,
        sessionDuration: 1800,
        interactions: { pauses: 5, skips: 3, rewinds: 0 },
      };

      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.3));

      const updated = await agent.learnFromWatchEvent(watchEvent, mockContent);

      expect(updated).toBeDefined();
    });

    it('should handle embedding generation failure', async () => {
      const watchEvent: WatchEvent = {
        userId: 'user-123',
        contentId: 123,
        mediaType: 'movie',
        watchedAt: new Date(),
        completionRate: 1.0,
        sessionDuration: 7200,
      };

      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.generateEmbedding.mockResolvedValue(null);

      const updated = await agent.learnFromWatchEvent(watchEvent, mockContent);

      expect(updated).toEqual(mockPreferences);
    });

    it('should update genre affinities', async () => {
      const watchEvent: WatchEvent = {
        userId: 'user-123',
        contentId: 123,
        mediaType: 'movie',
        watchedAt: new Date(),
        completionRate: 1.0,
        rating: 5,
        sessionDuration: 7200,
      };

      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.7));

      const updated = await agent.learnFromWatchEvent(watchEvent, mockContent);

      // Should have updated affinities for genres 28 and 12
      expect(updated.genreAffinities[28]).toBeDefined();
      expect(updated.genreAffinities[12]).toBeDefined();
    });
  });

  describe('Content Scoring', () => {
    it('should score content against preferences', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.6));

      const score = await agent.scoreContent(mockContent);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should return neutral score for new users', async () => {
      const newUserPrefs: UserPreferences = {
        vector: null,
        confidence: 0,
        genreAffinities: {},
        moodMappings: [],
        temporalPatterns: [],
        updatedAt: new Date(),
      };

      mockDb.getPreferencePattern.mockResolvedValue(newUserPrefs);

      const score = await agent.scoreContent(mockContent);

      expect(score).toBe(0.5);
    });

    it('should boost score for matching genres', async () => {
      const prefsWithGenre: UserPreferences = {
        ...mockPreferences,
        genreAffinities: { 28: 0.9, 12: 0.85 },
      };

      mockDb.getPreferencePattern.mockResolvedValue(prefsWithGenre);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.6));

      const score = await agent.scoreContent(mockContent);

      expect(score).toBeGreaterThan(0.5);
    });

    it('should handle embedding generation failure in scoring', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.generateEmbedding.mockResolvedValue(null);

      const score = await agent.scoreContent(mockContent);

      expect(score).toBe(0.5);
    });
  });

  describe('Personalized Query Embeddings', () => {
    it('should generate personalized query embedding', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));

      const embedding = await agent.getPersonalizedQueryEmbedding('action movies');

      expect(embedding).toBeInstanceOf(Float32Array);
      expect(embedding?.length).toBe(768);
    });

    it('should weight query and preferences', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));

      const embedding = await agent.getPersonalizedQueryEmbedding('action movies', 0.8);

      expect(embedding).toBeDefined();
    });

    it('should handle missing query embedding', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.generateEmbedding.mockResolvedValue(null);

      const embedding = await agent.getPersonalizedQueryEmbedding('test query');

      expect(embedding).toBeNull();
    });
  });

  describe('Recommendation Explanations', () => {
    it('should explain highly matching recommendations', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.9));

      const explanation = await agent.explainRecommendation(mockContent);

      expect(explanation).toContain('highly matches');
    });

    it('should explain genre matches', async () => {
      const prefsWithGenre: UserPreferences = {
        ...mockPreferences,
        genreAffinities: { 28: 0.8, 12: 0.75 },
      };

      mockDb.getPreferencePattern.mockResolvedValue(prefsWithGenre);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.6));

      const explanation = await agent.explainRecommendation(mockContent);

      expect(explanation).toContain('genre preferences');
    });

    it('should explain high ratings', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));

      const explanation = await agent.explainRecommendation(mockContent);

      expect(explanation).toContain('acclaimed');
    });
  });

  describe('Top Genres', () => {
    it('should get top genre preferences', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);

      const topGenres = await agent.getTopGenres(3);

      expect(topGenres).toHaveLength(3);
      expect(topGenres[0].affinity).toBeGreaterThan(topGenres[1].affinity);
    });

    it('should limit results correctly', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);

      const topGenres = await agent.getTopGenres(2);

      expect(topGenres).toHaveLength(2);
    });
  });

  describe('Data Export and Privacy', () => {
    it('should export preferences for portability', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);

      const exported = await agent.exportPreferences();

      expect(exported).toHaveProperty('userId', 'user-123');
      expect(exported).toHaveProperty('confidence');
      expect(exported).toHaveProperty('topGenres');
      expect(exported).toHaveProperty('exportedAt');
    });

    it('should delete preferences (GDPR)', async () => {
      await agent.deletePreferences();

      // Should clear cache
      mockDb.getPreferencePattern.mockResolvedValue(null);
      const prefs = await agent.getPreferences();

      expect(prefs.vector).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero-magnitude vectors in similarity', async () => {
      const zeroPrefs: UserPreferences = {
        ...mockPreferences,
        vector: new Float32Array(768).fill(0),
      };

      mockDb.getPreferencePattern.mockResolvedValue(zeroPrefs);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));

      const score = await agent.scoreContent(mockContent);

      expect(score).toBe(0.5);
    });

    it('should handle content with no genres', async () => {
      const noGenreContent: MediaContent = {
        ...mockContent,
        genreIds: [],
      };

      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));

      const score = await agent.scoreContent(noGenreContent);

      expect(score).toBeDefined();
    });
  });

  describe('Factory Function', () => {
    it('should create agent with factory function', () => {
      const newAgent = createPreferenceAgent('user-456', mockDb, mockVector);

      expect(newAgent).toBeInstanceOf(PreferenceAgent);
    });
  });
});

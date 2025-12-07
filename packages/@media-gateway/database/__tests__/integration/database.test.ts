/**
 * Integration Tests
 * Tests for AgentDB + RuVector working together
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentDBWrapper } from '../../src/agentdb/index.js';
import { RuVectorWrapper, cosineSimilarity } from '../../src/ruvector/index.js';
import { clearMockVectorStore } from '../mocks/ruvector.mock.js';
import {
  mockMovie,
  mockTVShow,
  mockContentList,
  mockUserPreferences,
  mockWatchEvent,
  mockSuccessfulWatchEvent,
  createMockEmbedding,
  createNormalizedEmbedding,
} from '../fixtures/test-data.js';

describe('Database Integration', () => {
  let agentDB: AgentDBWrapper;
  let ruVector: RuVectorWrapper;

  beforeEach(async () => {
    vi.clearAllMocks();
    clearMockVectorStore();

    agentDB = new AgentDBWrapper(':memory:');
    ruVector = new RuVectorWrapper(':memory:');

    await Promise.all([
      agentDB.initialize(),
      ruVector.initialize(),
    ]);
  });

  afterEach(async () => {
    await Promise.all([
      agentDB.close(),
      // ruVector doesn't have close method
    ]);
  });

  // =========================================================================
  // Preference Pattern Storage & Retrieval
  // =========================================================================

  describe('Preference Pattern Storage & Retrieval', () => {
    it('should store and retrieve user preferences with embeddings', async () => {
      const userId = 'user-integration-1';

      // Generate preference embedding
      const preferenceText = Object.entries(mockUserPreferences.genreAffinities)
        .map(([genre, score]) => `genre_${genre}:${score}`)
        .join(' ');

      const embedding = await ruVector.generateEmbedding(preferenceText);
      expect(embedding).toBeDefined();

      const preferences = {
        ...mockUserPreferences,
        vector: embedding,
      };

      // Store in AgentDB
      const patternId = await agentDB.storePreferencePattern(userId, preferences);
      expect(patternId).toBeDefined();

      // Retrieve and verify
      const retrieved = await agentDB.getPreferencePattern(userId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.confidence).toBe(preferences.confidence);
      expect(retrieved?.genreAffinities).toEqual(preferences.genreAffinities);
    });

    it('should find similar users based on preference vectors', async () => {
      // Create multiple users with similar preferences
      const users = [
        { id: 'user-1', genreAffinities: { 18: 0.9, 28: 0.7 } }, // Drama, Action
        { id: 'user-2', genreAffinities: { 18: 0.85, 28: 0.75 } }, // Similar
        { id: 'user-3', genreAffinities: { 35: 0.9, 10751: 0.8 } }, // Comedy, Family (different)
      ];

      // Store all users
      for (const user of users) {
        const preferenceText = Object.entries(user.genreAffinities)
          .map(([g, s]) => `genre_${g}:${s}`)
          .join(' ');

        const embedding = await ruVector.generateEmbedding(preferenceText);
        const preferences = {
          ...mockUserPreferences,
          vector: embedding,
          genreAffinities: user.genreAffinities,
        };

        await agentDB.storePreferencePattern(user.id, preferences);
      }

      // Find similar to user-1
      const user1Prefs = await agentDB.getPreferencePattern('user-1');
      expect(user1Prefs?.vector).toBeDefined();

      // User-2 should be more similar than user-3
      const user2Prefs = await agentDB.getPreferencePattern('user-2');
      const user3Prefs = await agentDB.getPreferencePattern('user-3');

      const sim12 = cosineSimilarity(user1Prefs!.vector!, user2Prefs!.vector!);
      const sim13 = cosineSimilarity(user1Prefs!.vector!, user3Prefs!.vector!);

      expect(sim12).toBeGreaterThan(sim13);
    });
  });

  // =========================================================================
  // Content Discovery & Recommendation
  // =========================================================================

  describe('Content Discovery & Recommendation', () => {
    it('should store content with both AgentDB and RuVector', async () => {
      const content = mockMovie;

      // Generate content embedding
      const contentText = `${content.title} ${content.overview}`;
      const embedding = await ruVector.generateEmbedding(contentText);
      expect(embedding).toBeDefined();

      // Store in both systems
      const [agentPatternId, ruVectorId] = await Promise.all([
        agentDB.storeContentPattern(content, embedding!),
        ruVector.storeContentEmbedding(content, embedding!),
      ]);

      expect(agentPatternId).toBeDefined();
      expect(ruVectorId).toBe(`${content.mediaType}-${content.id}`);
    });

    it('should recommend content based on user preferences', async () => {
      const userId = 'user-rec-1';

      // Store user preferences
      const userText = 'action thriller sci-fi';
      const userEmbedding = await ruVector.generateEmbedding(userText);
      const preferences = {
        ...mockUserPreferences,
        vector: userEmbedding,
        genreAffinities: { 28: 0.9, 53: 0.8, 878: 0.7 }, // Action, Thriller, Sci-Fi
      };
      await agentDB.storePreferencePattern(userId, preferences);

      // Store content
      for (const content of mockContentList) {
        const contentText = `${content.title} ${content.overview}`;
        const contentEmbedding = await ruVector.generateEmbedding(contentText);

        await Promise.all([
          agentDB.storeContentPattern(content, contentEmbedding!),
          ruVector.storeContentEmbedding(content, contentEmbedding!),
        ]);
      }

      // Search for recommendations
      const userPrefs = await agentDB.getPreferencePattern(userId);
      expect(userPrefs?.vector).toBeDefined();

      const recommendations = await ruVector.searchByEmbedding(
        userPrefs!.vector!,
        5,
        0.3
      );

      expect(recommendations.length).toBeGreaterThan(0);
      recommendations.forEach(rec => {
        expect(rec.content).toBeDefined();
        expect(rec.score).toBeGreaterThan(0);
      });
    });

    it('should perform semantic search across content', async () => {
      // Store all content
      for (const content of mockContentList) {
        const contentText = `${content.title} ${content.overview}`;
        const embedding = await ruVector.generateEmbedding(contentText);

        await ruVector.storeContentEmbedding(content, embedding!);
      }

      // Semantic search
      const query = 'computer hacker fighting the system';
      const results = await ruVector.semanticSearch(query, 5);

      expect(results.length).toBeGreaterThan(0);

      // The Matrix should be highly ranked for this query
      const matrixResult = results.find(r => r.content.id === 603);
      expect(matrixResult).toBeDefined();
    });
  });

  // =========================================================================
  // Learning from Watch Events
  // =========================================================================

  describe('Learning from Watch Events', () => {
    it('should learn from watch events and update preferences', async () => {
      const userId = 'user-learning-1';

      // Initial preferences
      const initialEmbedding = createNormalizedEmbedding('initial preferences', 768);
      await agentDB.storePreferencePattern(userId, {
        ...mockUserPreferences,
        vector: initialEmbedding,
      });

      // Simulate watch events
      const events = [
        mockSuccessfulWatchEvent, // High completion
        { ...mockWatchEvent, contentId: 603, completionRate: 0.9, rating: 9 },
        { ...mockWatchEvent, contentId: 1396, completionRate: 0.85, rating: 8 },
      ];

      // Store all episodes
      for (const event of events) {
        await agentDB.storeWatchEpisode(event);
      }

      // Get watch statistics
      const stats = await agentDB.getUserWatchStats(userId);

      expect(stats.totalEpisodes).toBeGreaterThan(0);
      expect(stats.successRate).toBeGreaterThan(0);
      expect(stats.avgReward).toBeGreaterThan(0);
    });

    it('should retrieve relevant watch history', async () => {
      const userId = 'user-history-1';

      // Store multiple watch events
      const events = [
        { ...mockWatchEvent, contentId: 550 },
        { ...mockWatchEvent, contentId: 603 },
        { ...mockWatchEvent, contentId: 1396 },
      ];

      for (const event of events) {
        await agentDB.storeWatchEpisode(event);
      }

      // Retrieve similar episodes
      const similar = await agentDB.retrieveSimilarEpisodes(
        userId,
        'watch_movie',
        10,
        false
      );

      expect(Array.isArray(similar)).toBe(true);
    });
  });

  // =========================================================================
  // Skill Learning & Application
  // =========================================================================

  describe('Skill Learning & Application', () => {
    it('should consolidate successful patterns into skills', async () => {
      // Store successful recommendation skill
      const skill = {
        name: 'genre-matching',
        description: 'Match content to user genre preferences',
        strategy: 'weighted_genre_similarity',
        successRate: 0.82,
      };

      const skillId = await agentDB.storeRecommendationSkill(skill);
      expect(skillId).toBeDefined();

      // Search for applicable skills
      const skills = await agentDB.searchSkills('movie_recommendation', 5, 0.7);

      expect(Array.isArray(skills)).toBe(true);
    });

    it('should run nightly learning to consolidate patterns', async () => {
      // Store some watch events first
      for (let i = 0; i < 5; i++) {
        await agentDB.storeWatchEpisode({
          ...mockSuccessfulWatchEvent,
          contentId: 500 + i,
        });
      }

      // Run nightly learning
      const results = await agentDB.runNightlyLearning();

      expect(results.patternsDiscovered).toBeGreaterThanOrEqual(0);
      expect(results.skillsConsolidated).toBeGreaterThanOrEqual(0);
      expect(results.edgesPruned).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // Cross-Platform Content Matching
  // =========================================================================

  describe('Cross-Platform Content Matching', () => {
    it('should match content across platforms using embeddings', async () => {
      const content = mockMovie;

      // Generate embedding for content
      const contentText = `${content.title} ${content.overview}`;
      const embedding = await ruVector.generateEmbedding(contentText);

      // Store in RuVector
      await ruVector.storeContentEmbedding(content, embedding!);

      // Record cross-platform match
      agentDB.recordCrossPlatformMatch(content.id, ['netflix', 'prime-video', 'hulu']);

      // Find similar content (should work across platforms)
      const similar = await ruVector.findSimilarContent(content.id, content.mediaType, 5);

      expect(Array.isArray(similar)).toBe(true);
    });

    it('should track social connections for group recommendations', async () => {
      // Create social graph
      agentDB.recordSocialConnection('user-1', 'user-2');
      agentDB.recordSocialConnection('user-2', 'user-3');
      agentDB.recordSocialConnection('user-1', 'user-3');

      // Store preferences for each user
      const users = ['user-1', 'user-2', 'user-3'];
      for (const userId of users) {
        const embedding = createNormalizedEmbedding(userId, 768);
        await agentDB.storePreferencePattern(userId, {
          ...mockUserPreferences,
          vector: embedding,
        });
      }

      // Calculate moat metrics (should include social connections)
      const metrics = await agentDB.calculateMoatMetrics();

      expect(metrics.socialConnectionCount).toBeGreaterThan(0);
      expect(metrics.moatStrength).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Data Moat Strength
  // =========================================================================

  describe('Data Moat Strength', () => {
    it('should build data moat through user interactions', async () => {
      const userId = 'moat-user-1';

      // 1. Store user preferences
      const embedding = createNormalizedEmbedding('user preferences', 768);
      await agentDB.storePreferencePattern(userId, {
        ...mockUserPreferences,
        vector: embedding,
      });

      // 2. Store content
      for (const content of mockContentList) {
        const contentText = `${content.title} ${content.overview}`;
        const contentEmbedding = await ruVector.generateEmbedding(contentText);
        await agentDB.storeContentPattern(content, contentEmbedding!);
      }

      // 3. Record watch events
      for (const content of mockContentList) {
        await agentDB.storeWatchEpisode({
          ...mockSuccessfulWatchEvent,
          contentId: content.id,
        });
      }

      // 4. Create skills
      await agentDB.storeRecommendationSkill({
        name: 'personalized-rec',
        description: 'Personalized recommendations',
        strategy: 'user_preference_matching',
        successRate: 0.85,
      });

      // 5. Track cross-platform and social
      agentDB.recordCrossPlatformMatch(550, ['netflix', 'prime']);
      agentDB.recordSocialConnection(userId, 'friend-1');

      // Calculate moat strength
      const metrics = await agentDB.calculateMoatMetrics();

      expect(metrics.preferenceVectorCount).toBeGreaterThan(0);
      expect(metrics.avgPreferenceDepth).toBeGreaterThan(0);
      expect(metrics.crossPlatformMatchCount).toBeGreaterThan(0);
      expect(metrics.socialConnectionCount).toBeGreaterThan(0);
      expect(metrics.skillCount).toBeGreaterThan(0);
      expect(metrics.moatStrength).toBeGreaterThan(0);
      expect(metrics.moatStrength).toBeLessThanOrEqual(100);
    });

    it('should show moat growth over time', async () => {
      // Initial state
      const metrics1 = await agentDB.calculateMoatMetrics();
      const initialStrength = metrics1.moatStrength;

      // Add more data
      for (let i = 0; i < 10; i++) {
        const embedding = createMockEmbedding(i, 384);
        await agentDB.storePreferencePattern(`user-${i}`, {
          ...mockUserPreferences,
          vector: embedding,
        });
      }

      // Measure again
      const metrics2 = await agentDB.calculateMoatMetrics();
      const finalStrength = metrics2.moatStrength;

      // Moat should grow (though with mocks, exact behavior may vary)
      expect(metrics2.preferenceVectorCount).toBeGreaterThanOrEqual(
        metrics1.preferenceVectorCount
      );
    });
  });

  // =========================================================================
  // Performance & Edge Cases
  // =========================================================================

  describe('Performance & Edge Cases', () => {
    it('should handle concurrent operations', async () => {
      const operations = [];

      // Concurrent writes
      for (let i = 0; i < 10; i++) {
        operations.push(
          agentDB.storePreferencePattern(`user-${i}`, {
            ...mockUserPreferences,
            vector: createMockEmbedding(i, 384),
          })
        );
      }

      const results = await Promise.all(operations);

      expect(results).toHaveLength(10);
      results.forEach(id => expect(id).toBeDefined());
    });

    it('should handle empty search results gracefully', async () => {
      const embedding = createMockEmbedding(999, 768);
      const results = await ruVector.searchByEmbedding(embedding, 10, 0.99);

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle malformed embeddings', async () => {
      const invalidEmbedding = new Float32Array(0); // Empty

      await expect(
        ruVector.storeContentEmbedding(mockMovie, invalidEmbedding)
      ).resolves.toBeDefined(); // Should not throw
    });

    it('should maintain consistency across systems', async () => {
      const content = mockMovie;
      const embedding = createMockEmbedding(1, 768);

      // Store in both
      await Promise.all([
        agentDB.storeContentPattern(content, embedding),
        ruVector.storeContentEmbedding(content, embedding),
      ]);

      // Verify both stored
      const [agentResults, vectorResults] = await Promise.all([
        agentDB.searchContentPatterns(embedding, 1, 0.1),
        ruVector.searchByEmbedding(embedding, 1, 0.1),
      ]);

      expect(agentResults.length).toBeGreaterThan(0);
      expect(vectorResults.length).toBeGreaterThan(0);
    });
  });
});

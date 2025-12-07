/**
 * Integration Tests for Media Gateway Agents
 * Tests critical paths through the multi-agent system
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSwarmCoordinator } from '../src/orchestration/SwarmCoordinator.js';
import { createDiscoveryAgent } from '../src/agents/DiscoveryAgent.js';

// Mock wrappers
const createMockDbWrapper = () => ({
  getPreferencePattern: vi.fn().mockResolvedValue({
    vector: new Float32Array(768).fill(0.1),
    confidence: 0.8,
    genreAffinities: { 28: 0.9, 878: 0.8 },
    moodMappings: [],
    temporalPatterns: [],
    updatedAt: new Date(),
  }),
  recordInteraction: vi.fn().mockResolvedValue(undefined),
  updatePreferencePattern: vi.fn().mockResolvedValue(undefined),
});

const createMockVectorWrapper = () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Float32Array(768).fill(0.1)),
  searchByEmbedding: vi.fn().mockResolvedValue([
    {
      content: {
        id: 1,
        title: 'The Matrix',
        overview: 'A computer hacker learns about the true nature of reality',
        mediaType: 'movie',
        genreIds: [28, 878],
        voteAverage: 8.7,
        voteCount: 20000,
        releaseDate: '1999-03-30',
        posterPath: '/matrix.jpg',
        backdropPath: '/matrix-bg.jpg',
        popularity: 150,
      },
      score: 0.95,
    },
    {
      content: {
        id: 2,
        title: 'Inception',
        overview: 'A thief who enters dreams',
        mediaType: 'movie',
        genreIds: [28, 878, 53],
        voteAverage: 8.4,
        voteCount: 30000,
        releaseDate: '2010-07-16',
        posterPath: '/inception.jpg',
        backdropPath: '/inception-bg.jpg',
        popularity: 200,
      },
      score: 0.92,
    },
  ]),
});

describe('Media Gateway Integration Tests', () => {
  describe('Search Flow', () => {
    it('should complete full search flow with all agents', async () => {
      const dbWrapper = createMockDbWrapper();
      const vectorWrapper = createMockVectorWrapper();
      const coordinator = createSwarmCoordinator(dbWrapper, vectorWrapper);

      const result = await coordinator.executeTask(
        'action movies like The Matrix',
        'user123',
        'session456'
      );

      expect(result.success).toBe(true);
      expect(result.type).toBe('search');
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.agentsUsed).toContain('DiscoveryAgent');
      expect(result.agentsUsed).toContain('ProviderAgent');
      expect(result.latencyMs).toBeLessThan(5000);
    });

    it('should personalize results for authenticated users', async () => {
      const dbWrapper = createMockDbWrapper();
      const vectorWrapper = createMockVectorWrapper();
      const coordinator = createSwarmCoordinator(dbWrapper, vectorWrapper);

      const result = await coordinator.executeTask(
        'recommend something for tonight',
        'user123'
      );

      expect(result.success).toBe(true);
      expect(result.agentsUsed).toContain('PreferenceAgent');
      expect(dbWrapper.getPreferencePattern).toHaveBeenCalledWith('user123');
    });
  });

  describe('Intent Parsing', () => {
    it('should parse search intents correctly', () => {
      const agent = createDiscoveryAgent('session1');

      const searchIntent = agent.parseIntent('find action movies from the 90s');
      expect(searchIntent.type).toBe('search');
      expect(searchIntent.query).toContain('action');

      const recIntent = agent.parseIntent('recommend something for me');
      expect(recIntent.type).toBe('recommendation');

      const groupIntent = agent.parseIntent('start group watch session');
      expect(groupIntent.type).toBe('group_watch');
    });

    it('should extract filters from natural language', () => {
      const agent = createDiscoveryAgent('session1');

      const intent = agent.parseIntent('sci-fi movies rated above 8');
      expect(intent.type).toBe('search');
      if (intent.type === 'search') {
        expect(intent.filters?.ratingMin).toBeGreaterThanOrEqual(8);
      }
    });
  });

  describe('Group Watch Flow', () => {
    it('should handle group watch session creation', async () => {
      const dbWrapper = createMockDbWrapper();
      const vectorWrapper = createMockVectorWrapper();
      const coordinator = createSwarmCoordinator(dbWrapper, vectorWrapper);

      const result = await coordinator.executeTask(
        'start a group watch with my friends',
        'user123'
      );

      expect(result.success).toBe(true);
      expect(result.type).toBe('group');
      expect(result.agentsUsed).toContain('SocialAgent');
    });
  });

  describe('Error Handling', () => {
    it('should handle embedding generation failure gracefully', async () => {
      const dbWrapper = createMockDbWrapper();
      const vectorWrapper = createMockVectorWrapper();
      vectorWrapper.generateEmbedding.mockRejectedValueOnce(new Error('API Error'));

      const coordinator = createSwarmCoordinator(dbWrapper, vectorWrapper);
      const result = await coordinator.executeTask('test query');

      expect(result.success).toBe(false);
      expect(result.data.error).toBeDefined();
    });

    it('should handle missing user preferences gracefully', async () => {
      const dbWrapper = createMockDbWrapper();
      dbWrapper.getPreferencePattern.mockResolvedValueOnce(null);
      const vectorWrapper = createMockVectorWrapper();

      const coordinator = createSwarmCoordinator(dbWrapper, vectorWrapper);
      const result = await coordinator.executeTask(
        'recommend something',
        'newuser123'
      );

      // Should still succeed with popular content fallback
      expect(result.success).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should complete search in under 1 second with mocks', async () => {
      const dbWrapper = createMockDbWrapper();
      const vectorWrapper = createMockVectorWrapper();
      const coordinator = createSwarmCoordinator(dbWrapper, vectorWrapper);

      const start = Date.now();
      await coordinator.executeTask('quick test', 'user123');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });
  });
});

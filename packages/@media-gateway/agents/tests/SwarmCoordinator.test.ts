/**
 * Swarm Coordinator Tests
 * Multi-agent orchestration validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwarmCoordinator, createSwarmCoordinator } from '../src/orchestration/SwarmCoordinator.js';

// Mock database and vector wrappers
const mockDbWrapper = {
  getPreferencePattern: vi.fn(),
  recordInteraction: vi.fn(),
};

const mockVectorWrapper = {
  generateEmbedding: vi.fn(),
  searchByEmbedding: vi.fn(),
};

describe('SwarmCoordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create coordinator with default config', () => {
      const coordinator = createSwarmCoordinator(mockDbWrapper, mockVectorWrapper);

      const status = coordinator.getStatus();
      expect(status.topology).toBe('hierarchical');
      expect(status.activeAgents).toContain('SocialAgent');
      expect(status.activeAgents).toContain('ProviderAgent');
    });

    it('should accept custom config', () => {
      const coordinator = createSwarmCoordinator(mockDbWrapper, mockVectorWrapper, {
        topology: 'mesh',
        maxConcurrentTasks: 5,
      });

      const status = coordinator.getStatus();
      expect(status.topology).toBe('mesh');
    });

    it('should initialize session agents', () => {
      const coordinator = createSwarmCoordinator(mockDbWrapper, mockVectorWrapper);
      coordinator.initializeSession('session123', 'user123');

      const status = coordinator.getStatus();
      expect(status.activeAgents).toContain('DiscoveryAgent');
      expect(status.activeAgents).toContain('PreferenceAgent');
    });
  });

  describe('task execution', () => {
    it('should handle search intent', async () => {
      mockVectorWrapper.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.1));
      mockVectorWrapper.searchByEmbedding.mockResolvedValue([
        {
          content: {
            id: 1,
            title: 'Test Movie',
            overview: 'A test movie',
            mediaType: 'movie',
            genreIds: [28],
            voteAverage: 8.0,
            voteCount: 1000,
            releaseDate: '2024-01-01',
            posterPath: '/poster.jpg',
            backdropPath: null,
            popularity: 100,
          },
          score: 0.9,
        },
      ]);

      const coordinator = createSwarmCoordinator(mockDbWrapper, mockVectorWrapper);
      const result = await coordinator.executeTask('find action movies');

      expect(result.success).toBe(true);
      expect(result.type).toBe('search');
      expect(result.agentsUsed).toContain('DiscoveryAgent');
      expect(result.latencyMs).toBeGreaterThan(0);
    });

    it('should handle recommendation intent for authenticated user', async () => {
      mockDbWrapper.getPreferencePattern.mockResolvedValue({
        vector: new Float32Array(768).fill(0.1),
        confidence: 0.8,
        genreAffinities: { 28: 0.9 },
        moodMappings: [],
        temporalPatterns: [],
        updatedAt: new Date(),
      });

      mockVectorWrapper.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.1));
      mockVectorWrapper.searchByEmbedding.mockResolvedValue([
        {
          content: {
            id: 1,
            title: 'Recommended Movie',
            overview: 'Based on preferences',
            mediaType: 'movie',
            genreIds: [28],
            voteAverage: 8.5,
            voteCount: 2000,
            releaseDate: '2024-01-01',
            posterPath: '/poster.jpg',
            backdropPath: null,
            popularity: 150,
          },
          score: 0.95,
        },
      ]);

      const coordinator = createSwarmCoordinator(mockDbWrapper, mockVectorWrapper);
      const result = await coordinator.executeTask(
        'recommend something for me',
        'user123',
        'session123'
      );

      expect(result.success).toBe(true);
      expect(result.type).toBe('recommendation');
      expect(result.agentsUsed).toContain('PreferenceAgent');
    });

    it('should handle errors gracefully', async () => {
      mockVectorWrapper.generateEmbedding.mockRejectedValue(new Error('Embedding failed'));

      const coordinator = createSwarmCoordinator(mockDbWrapper, mockVectorWrapper);
      const result = await coordinator.executeTask('test query');

      expect(result.success).toBe(false);
      expect(result.data.error).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      const coordinator = createSwarmCoordinator(mockDbWrapper, mockVectorWrapper);
      coordinator.initializeSession('session123', 'user123');

      coordinator.cleanup();

      const status = coordinator.getStatus();
      expect(status.activeAgents).not.toContain('DiscoveryAgent');
      expect(status.activeAgents).not.toContain('PreferenceAgent');
      expect(status.activeTasks).toBe(0);
    });
  });
});

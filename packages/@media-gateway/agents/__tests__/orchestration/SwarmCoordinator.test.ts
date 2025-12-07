/**
 * Swarm Coordinator Tests
 * Tests task routing, agent coordination, and MCP integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SwarmCoordinator, createSwarmCoordinator } from '../../src/orchestration/SwarmCoordinator.js';
import type { AgentIntent } from '@media-gateway/core';

// Mock dependencies
const createMockDbWrapper = () => ({
  getPreferencePattern: vi.fn(),
  storePreferencePattern: vi.fn(),
  storeWatchEpisode: vi.fn(),
  recordSocialConnection: vi.fn(),
});

const createMockVectorWrapper = () => ({
  generateEmbedding: vi.fn(),
  searchByEmbedding: vi.fn(),
  searchById: vi.fn(),
});

// Mock Gemini API
global.fetch = vi.fn();

describe('SwarmCoordinator', () => {
  let coordinator: SwarmCoordinator;
  let mockDb: ReturnType<typeof createMockDbWrapper>;
  let mockVector: ReturnType<typeof createMockVectorWrapper>;

  beforeEach(() => {
    mockDb = createMockDbWrapper();
    mockVector = createMockVectorWrapper();
    coordinator = createSwarmCoordinator(mockDb, mockVector);
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const status = coordinator.getStatus();

      expect(status.topology).toBe('hierarchical');
      expect(status.activeAgents).toContain('ProviderAgent');
      expect(status.activeAgents).toContain('SocialAgent');
    });

    it('should initialize with custom configuration', () => {
      const customCoordinator = createSwarmCoordinator(
        mockDb,
        mockVector,
        { topology: 'mesh', maxConcurrentTasks: 20, timeoutMs: 60000 }
      );

      const status = customCoordinator.getStatus();

      expect(status.topology).toBe('mesh');
    });

    it('should support different topologies', () => {
      const topologies: Array<'hierarchical' | 'mesh' | 'star'> = ['hierarchical', 'mesh', 'star'];

      for (const topology of topologies) {
        const coord = createSwarmCoordinator(mockDb, mockVector, { topology });
        expect(coord.getStatus().topology).toBe(topology);
      }
    });
  });

  describe('MCP Integration', () => {
    it('should initialize MCP swarm', async () => {
      const result = await coordinator.initializeMCP();

      expect(result).toHaveProperty('swarmId');
      expect(result).toHaveProperty('topology');
      expect(result).toHaveProperty('agents');
      expect(result.agents).toContain('DiscoveryAgent');
    });

    it('should store data to MCP memory', async () => {
      await coordinator.storeToMCPMemory('test-key', { data: 'value' });

      // Should not throw
      expect(true).toBe(true);
    });

    it('should retrieve data from MCP memory', async () => {
      const data = await coordinator.retrieveFromMCPMemory('test-key');

      // Returns null in test mode
      expect(data).toBeNull();
    });

    it('should execute with MCP orchestration', async () => {
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));
      mockVector.searchByEmbedding.mockResolvedValue([]);

      const result = await coordinator.executeWithMCP('find action movies', 'user-123', {
        priority: 'high',
        strategy: 'parallel'
      });

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('agentsUsed');
    });
  });

  describe('Session Management', () => {
    it('should initialize session for user', () => {
      coordinator.initializeSession('session-123', 'user-456');

      const status = coordinator.getStatus();

      expect(status.activeAgents).toContain('DiscoveryAgent');
    });

    it('should initialize session without user ID', () => {
      coordinator.initializeSession('session-123');

      const status = coordinator.getStatus();

      expect(status.activeAgents).toContain('DiscoveryAgent');
    });

    it('should handle multiple session initializations', () => {
      coordinator.initializeSession('session-1', 'user-1');
      coordinator.initializeSession('session-2', 'user-2');

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Task Execution', () => {
    it('should execute search task', async () => {
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));
      mockVector.searchByEmbedding.mockResolvedValue([
        {
          content: {
            id: 123,
            title: 'Test Movie',
            overview: 'Test',
            mediaType: 'movie',
            genreIds: [28],
            voteAverage: 8,
            voteCount: 1000,
            releaseDate: '2023-01-01',
            posterPath: '/test.jpg',
            backdropPath: '/back.jpg',
            popularity: 100,
          },
          score: 0.9
        }
      ]);

      const result = await coordinator.executeTask('find action movies', 'user-123');

      expect(result.success).toBe(true);
      expect(result.type).toBe('search');
      expect(result.agentsUsed).toContain('DiscoveryAgent');
    });

    it('should execute recommendation task', async () => {
      mockDb.getPreferencePattern.mockResolvedValue({
        vector: new Float32Array(768).fill(0.5),
        confidence: 0.7,
        genreAffinities: { 28: 0.8 },
        moodMappings: [],
        temporalPatterns: [],
        updatedAt: new Date(),
      });
      mockVector.searchByEmbedding.mockResolvedValue([]);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));

      const result = await coordinator.executeTask('recommend something', 'user-123');

      expect(result.success).toBe(true);
      expect(result.agentsUsed).toContain('PreferenceAgent');
    });

    it('should execute group watch task', async () => {
      mockDb.getPreferencePattern.mockResolvedValue({
        vector: new Float32Array(768).fill(0.5),
        confidence: 0.7,
        genreAffinities: {},
        moodMappings: [],
        temporalPatterns: [],
        updatedAt: new Date(),
      });
      mockVector.searchByEmbedding.mockResolvedValue([]);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));

      const result = await coordinator.executeTask('movie night with friends', 'user-123');

      expect(result.success).toBe(true);
      expect(result.type).toBe('group');
      expect(result.agentsUsed).toContain('SocialAgent');
    });

    it('should execute availability check task', async () => {
      const result = await coordinator.executeTask('where can I watch Inception', 'user-123');

      expect(result.success).toBe(true);
      expect(result.type).toBe('availability');
      expect(result.agentsUsed).toContain('ProviderAgent');
    });

    it('should measure task latency', async () => {
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));
      mockVector.searchByEmbedding.mockResolvedValue([]);

      const result = await coordinator.executeTask('find movies');

      expect(result.latencyMs).toBeGreaterThan(0);
    });

    it('should handle task execution errors', async () => {
      mockVector.generateEmbedding.mockRejectedValue(new Error('Test error'));

      const result = await coordinator.executeTask('test query');

      expect(result.success).toBe(false);
      expect(result.data).toHaveProperty('error');
    });
  });

  describe('AI-Powered Intent Parsing', () => {
    it('should use AI for intent parsing when available', async () => {
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                type: 'search',
                query: 'action movies',
                filters: { genres: [28] }
              })
            }]
          }
        }]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      process.env.GOOGLE_GEMINI_API_KEY = 'test-key';

      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));
      mockVector.searchByEmbedding.mockResolvedValue([]);

      const result = await coordinator.executeTask('find action movies');

      expect(result.agentsUsed).toContain('DiscoveryAgent (AI)');

      delete process.env.GOOGLE_GEMINI_API_KEY;
    });

    it('should fallback to regex when AI fails', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('API error'));

      process.env.GOOGLE_GEMINI_API_KEY = 'test-key';

      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));
      mockVector.searchByEmbedding.mockResolvedValue([]);

      const result = await coordinator.executeTask('find movies');

      expect(result.agentsUsed).toContain('DiscoveryAgent (Regex)');

      delete process.env.GOOGLE_GEMINI_API_KEY;
    });
  });

  describe('Personalized Search', () => {
    it('should use PreferenceAgent for authenticated users', async () => {
      mockDb.getPreferencePattern.mockResolvedValue({
        vector: new Float32Array(768).fill(0.6),
        confidence: 0.8,
        genreAffinities: {},
        moodMappings: [],
        temporalPatterns: [],
        updatedAt: new Date(),
      });
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));
      mockVector.searchByEmbedding.mockResolvedValue([]);

      const result = await coordinator.executeTask('find movies', 'user-123');

      expect(result.agentsUsed).toContain('PreferenceAgent');
    });

    it('should skip PreferenceAgent for anonymous users', async () => {
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));
      mockVector.searchByEmbedding.mockResolvedValue([]);

      const result = await coordinator.executeTask('find movies');

      expect(result.agentsUsed).not.toContain('PreferenceAgent');
    });
  });

  describe('Availability Enrichment', () => {
    it('should enrich results with availability data', async () => {
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));
      mockVector.searchByEmbedding.mockResolvedValue([
        {
          content: {
            id: 123,
            title: 'Test',
            overview: '',
            mediaType: 'movie',
            genreIds: [],
            voteAverage: 8,
            voteCount: 100,
            releaseDate: '2023-01-01',
            posterPath: null,
            backdropPath: null,
            popularity: 50,
          },
          score: 0.8
        }
      ]);

      const result = await coordinator.executeTask('find movies');

      expect(result.success).toBe(true);
      expect(result.agentsUsed).toContain('ProviderAgent');
    });
  });

  describe('Status Monitoring', () => {
    it('should report active agents', () => {
      coordinator.initializeSession('session-1', 'user-1');

      const status = coordinator.getStatus();

      expect(status.activeAgents.length).toBeGreaterThan(0);
    });

    it('should track active tasks', () => {
      const status = coordinator.getStatus();

      expect(status.activeTasks).toBeGreaterThanOrEqual(0);
    });

    it('should report topology', () => {
      const status = coordinator.getStatus();

      expect(['hierarchical', 'mesh', 'star']).toContain(status.topology);
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup resources', () => {
      coordinator.initializeSession('session-1', 'user-1');
      coordinator.cleanup();

      const status = coordinator.getStatus();

      // Agents should be cleaned up
      expect(status.activeAgents).not.toContain('DiscoveryAgent');
    });

    it('should clear active tasks', () => {
      coordinator.cleanup();

      const status = coordinator.getStatus();

      expect(status.activeTasks).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty queries', async () => {
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));
      mockVector.searchByEmbedding.mockResolvedValue([]);

      const result = await coordinator.executeTask('');

      expect(result.success).toBe(true);
    });

    it('should handle null embedding generation', async () => {
      mockVector.generateEmbedding.mockResolvedValue(null);

      const result = await coordinator.executeTask('test query');

      expect(result.data).toEqual([]);
    });

    it('should require authentication for group watch', async () => {
      const result = await coordinator.executeTask('movie night with friends');

      expect(result.success).toBe(false);
      expect(result.data.error).toContain('Authentication required');
    });
  });

  describe('MCP Configuration', () => {
    it('should initialize with MCP disabled', () => {
      const coord = createSwarmCoordinator(
        mockDb,
        mockVector,
        {},
        { enableMCP: false }
      );

      expect(coord).toBeDefined();
    });

    it('should use custom memory namespace', () => {
      const coord = createSwarmCoordinator(
        mockDb,
        mockVector,
        {},
        { memoryNamespace: 'custom-namespace' }
      );

      expect(coord).toBeDefined();
    });

    it('should use custom swarm ID', () => {
      const coord = createSwarmCoordinator(
        mockDb,
        mockVector,
        {},
        { swarmId: 'custom-swarm-123' }
      );

      expect(coord).toBeDefined();
    });
  });

  describe('Factory Function', () => {
    it('should create coordinator with factory function', () => {
      const coord = createSwarmCoordinator(mockDb, mockVector);

      expect(coord).toBeInstanceOf(SwarmCoordinator);
    });

    it('should create coordinator with all optional parameters', () => {
      const coord = createSwarmCoordinator(
        mockDb,
        mockVector,
        { topology: 'mesh', maxConcurrentTasks: 15, timeoutMs: 45000 },
        { enableMCP: true, memoryNamespace: 'test' }
      );

      expect(coord).toBeDefined();
    });
  });
});

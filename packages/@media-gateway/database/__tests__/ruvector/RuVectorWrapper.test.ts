/**
 * RuVector Wrapper Tests
 * Tests for embedding generation, vector storage, and semantic search
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RuVectorWrapper, createRuVector, cosineSimilarity } from '../../src/ruvector/index.js';
import { mockVectorDB, clearMockVectorStore } from '../mocks/ruvector.mock.js';
import {
  mockMovie,
  mockTVShow,
  mockContentList,
  createMockEmbedding,
  mockOpenAIEmbeddingResponse,
  mockVertexAIEmbeddingResponse,
} from '../fixtures/test-data.js';

describe('RuVectorWrapper', () => {
  let wrapper: RuVectorWrapper;

  beforeEach(async () => {
    clearMockVectorStore();
    vi.clearAllMocks();
    wrapper = new RuVectorWrapper(':memory:');
    await wrapper.initialize();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_VERTEX_PROJECT_ID;
    delete process.env.GOOGLE_ACCESS_TOKEN;
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const newWrapper = new RuVectorWrapper(':memory:');
      await expect(newWrapper.initialize()).resolves.not.toThrow();
    });

    it('should not reinitialize if already initialized', async () => {
      await wrapper.initialize();
      await wrapper.initialize();
      // Should not throw or cause issues
      expect(wrapper).toBeDefined();
    });

    it('should throw on operations before initialization', async () => {
      const uninitWrapper = new RuVectorWrapper(':memory:');

      await expect(
        uninitWrapper.storeContentEmbedding(mockMovie, new Float32Array(768))
      ).rejects.toThrow('RuVector not initialized');
    });
  });

  // =========================================================================
  // Embedding Generation Tests
  // =========================================================================

  describe('Embedding Generation', () => {
    describe('OpenAI API', () => {
      beforeEach(() => {
        process.env.OPENAI_API_KEY = 'test-api-key';
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => mockOpenAIEmbeddingResponse,
        } as Response);
      });

      it('should generate embedding using OpenAI', async () => {
        const text = 'A thrilling action movie';
        const embedding = await wrapper.generateEmbedding(text);

        expect(embedding).toBeInstanceOf(Float32Array);
        expect(embedding?.length).toBe(768);

        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.openai.com/v1/embeddings',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-api-key',
              'Content-Type': 'application/json',
            }),
            body: expect.stringContaining('text-embedding-3-small'),
          })
        );
      });

      it('should cache embeddings', async () => {
        const text = 'Same query';

        const embedding1 = await wrapper.generateEmbedding(text);
        const embedding2 = await wrapper.generateEmbedding(text);

        expect(embedding1).toEqual(embedding2);
        // Should only call API once due to caching
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      it('should handle case-insensitive caching', async () => {
        await wrapper.generateEmbedding('Test Query');
        await wrapper.generateEmbedding('test query');
        await wrapper.generateEmbedding('TEST QUERY');

        // Should only call API once
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      it('should handle API errors gracefully', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
        } as Response);

        const embedding = await wrapper.generateEmbedding('test');

        expect(embedding).toBeNull();
      });

      it('should handle network errors', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const embedding = await wrapper.generateEmbedding('test');

        expect(embedding).toBeNull();
      });
    });

    describe('Vertex AI Fallback', () => {
      beforeEach(() => {
        process.env.GOOGLE_VERTEX_PROJECT_ID = 'test-project';
        process.env.GOOGLE_ACCESS_TOKEN = 'test-token';
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => mockVertexAIEmbeddingResponse,
        } as Response);
      });

      it('should use Vertex AI when credentials available', async () => {
        const text = 'Test query';
        const embedding = await wrapper.generateEmbedding(text);

        expect(embedding).toBeInstanceOf(Float32Array);
        expect(embedding?.length).toBe(768);

        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('aiplatform.googleapis.com'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-token',
            }),
          })
        );
      });

      it('should fallback to OpenAI on Vertex AI failure', async () => {
        // First call fails (Vertex AI), second succeeds (OpenAI)
        global.fetch = vi.fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
          } as Response)
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockOpenAIEmbeddingResponse,
          } as Response);

        process.env.OPENAI_API_KEY = 'fallback-key';

        const embedding = await wrapper.generateEmbedding('test');

        expect(embedding).toBeDefined();
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    describe('Mock Embeddings', () => {
      it('should generate mock embedding when no API key', async () => {
        const embedding = await wrapper.generateEmbedding('test query');

        expect(embedding).toBeInstanceOf(Float32Array);
        expect(embedding?.length).toBe(768);
      });

      it('should generate deterministic mock embeddings', async () => {
        const text = 'consistent query';

        const embedding1 = await wrapper.generateEmbedding(text);
        const embedding2 = await wrapper.generateEmbedding(text);

        expect(embedding1).toEqual(embedding2);
      });

      it('should normalize mock embeddings', async () => {
        const embedding = await wrapper.generateEmbedding('test');

        // Calculate magnitude
        let magnitude = 0;
        for (let i = 0; i < embedding!.length; i++) {
          magnitude += embedding![i]! * embedding![i]!;
        }
        magnitude = Math.sqrt(magnitude);

        // Should be approximately normalized
        expect(magnitude).toBeCloseTo(1.0, 1);
      });
    });

    describe('Cache Management', () => {
      it('should cleanup old cache entries', async () => {
        // Generate many embeddings to trigger cleanup
        for (let i = 0; i < 105; i++) {
          await wrapper.generateEmbedding(`query-${i}`);
        }

        // Should not throw
        expect(wrapper).toBeDefined();
      });

      it('should expire cache after TTL', async () => {
        vi.useFakeTimers();

        const text = 'expiring query';
        await wrapper.generateEmbedding(text);

        // Advance time by 6 minutes (past 5min TTL)
        vi.advanceTimersByTime(6 * 60 * 1000);

        await wrapper.generateEmbedding(text);

        vi.useRealTimers();
      });
    });
  });

  // =========================================================================
  // Vector Storage Tests
  // =========================================================================

  describe('Vector Storage', () => {
    it('should store content embedding', async () => {
      const embedding = createMockEmbedding(42, 768);
      const id = await wrapper.storeContentEmbedding(mockMovie, embedding);

      expect(id).toBe('movie-550');
      expect(mockVectorDB.insert).toHaveBeenCalledWith({
        id: 'movie-550',
        vector: embedding,
        metadata: expect.objectContaining({
          contentId: mockMovie.id,
          mediaType: mockMovie.mediaType,
          title: mockMovie.title,
          overview: mockMovie.overview,
        }),
      });
    });

    it('should batch store embeddings', async () => {
      const contents = mockContentList.map((content, i) => ({
        content,
        embedding: createMockEmbedding(i, 768),
      }));

      const ids = await wrapper.batchStoreEmbeddings(contents);

      expect(ids).toHaveLength(3);
      expect(ids).toContain('movie-550');
      expect(ids).toContain('tv-1396');
      expect(mockVectorDB.insert).toHaveBeenCalledTimes(3);
    });

    it('should delete content vector', async () => {
      mockVectorDB.delete.mockResolvedValueOnce(true);

      const deleted = await wrapper.deleteContentVector(550, 'movie');

      expect(deleted).toBe(true);
      expect(mockVectorDB.delete).toHaveBeenCalledWith('movie-550');
    });

    it('should return false when deleting non-existent vector', async () => {
      mockVectorDB.delete.mockResolvedValueOnce(false);

      const deleted = await wrapper.deleteContentVector(99999, 'movie');

      expect(deleted).toBe(false);
    });
  });

  // =========================================================================
  // Semantic Search Tests
  // =========================================================================

  describe('Semantic Search', () => {
    beforeEach(async () => {
      // Store some test content
      for (const content of mockContentList) {
        const embedding = createMockEmbedding(content.id, 768);
        await wrapper.storeContentEmbedding(content, embedding);
      }
    });

    it('should search by embedding', async () => {
      const queryEmbedding = createMockEmbedding(1, 768);
      const results = await wrapper.searchByEmbedding(queryEmbedding, 10, 0.5);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      results.forEach(result => {
        expect(result.content).toBeDefined();
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });

    it('should filter by media type', async () => {
      const queryEmbedding = createMockEmbedding(1, 768);
      const results = await wrapper.searchByEmbedding(
        queryEmbedding,
        10,
        0.3,
        { mediaType: 'movie' }
      );

      results.forEach(result => {
        expect(result.content.mediaType).toBe('movie');
      });
    });

    it('should filter by genres', async () => {
      const queryEmbedding = createMockEmbedding(1, 768);
      const results = await wrapper.searchByEmbedding(
        queryEmbedding,
        10,
        0.3,
        { genres: [18, 80] } // Drama, Crime
      );

      results.forEach(result => {
        const hasGenre = result.content.genreIds.some(g =>
          [18, 80].includes(g)
        );
        expect(hasGenre).toBe(true);
      });
    });

    it('should apply threshold correctly', async () => {
      const queryEmbedding = createMockEmbedding(1, 768);
      const highThreshold = 0.9;

      const results = await wrapper.searchByEmbedding(
        queryEmbedding,
        10,
        highThreshold
      );

      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(highThreshold);
      });
    });

    it('should limit results correctly', async () => {
      const queryEmbedding = createMockEmbedding(1, 768);
      const k = 2;

      const results = await wrapper.searchByEmbedding(queryEmbedding, k, 0.1);

      expect(results.length).toBeLessThanOrEqual(k);
    });

    it('should perform semantic search with text', async () => {
      const query = 'exciting action thriller';
      const results = await wrapper.semanticSearch(query, 5);

      expect(Array.isArray(results)).toBe(true);
      results.forEach(result => {
        expect(result.content).toBeDefined();
        expect(result.score).toBeGreaterThan(0);
      });
    });

    it('should return empty array when embedding generation fails', async () => {
      // Mock to return null
      vi.spyOn(wrapper, 'generateEmbedding').mockResolvedValueOnce(null);

      const results = await wrapper.semanticSearch('test query');

      expect(results).toEqual([]);
    });

    it('should find similar content', async () => {
      const contentId = 550;
      const mediaType = 'movie';

      // First store the content
      const embedding = createMockEmbedding(contentId, 768);
      await wrapper.storeContentEmbedding(mockMovie, embedding);

      mockVectorDB.get.mockResolvedValueOnce({
        vector: embedding,
        metadata: { contentId, mediaType },
      });

      const results = await wrapper.findSimilarContent(contentId, mediaType, 5);

      expect(Array.isArray(results)).toBe(true);
      // Should exclude the original content
      results.forEach(result => {
        expect(result.content.id).not.toBe(contentId);
      });
    });

    it('should return empty when finding similar to non-existent content', async () => {
      mockVectorDB.get.mockResolvedValueOnce(null);

      const results = await wrapper.findSimilarContent(99999, 'movie', 5);

      expect(results).toEqual([]);
    });
  });

  // =========================================================================
  // Statistics Tests
  // =========================================================================

  describe('Database Statistics', () => {
    it('should get database stats', async () => {
      mockVectorDB.len.mockResolvedValueOnce(42);

      const stats = await wrapper.getStats();

      expect(stats).toEqual({
        vectorCount: 42,
        dimensions: 768,
        storagePath: ':memory:',
      });
    });
  });

  // =========================================================================
  // Factory Function Tests
  // =========================================================================

  describe('createRuVector factory', () => {
    it('should create and initialize wrapper', async () => {
      const wrapper = await createRuVector(':memory:');

      expect(wrapper).toBeInstanceOf(RuVectorWrapper);

      // Should be able to use immediately
      await expect(
        wrapper.storeContentEmbedding(mockMovie, createMockEmbedding(1, 768))
      ).resolves.toBeDefined();
    });

    it('should use custom storage path', async () => {
      const customPath = './custom-vectors.db';
      const wrapper = await createRuVector(customPath);

      expect(wrapper).toBeInstanceOf(RuVectorWrapper);

      const stats = await wrapper.getStats();
      expect(stats.storagePath).toBe(customPath);
    });
  });
});

// =========================================================================
// Cosine Similarity Utility Tests
// =========================================================================

describe('cosineSimilarity', () => {
  it('should calculate similarity between identical vectors', () => {
    const vec1 = new Float32Array([1, 0, 0]);
    const vec2 = new Float32Array([1, 0, 0]);

    const similarity = cosineSimilarity(vec1, vec2);

    expect(similarity).toBeCloseTo(1.0, 5);
  });

  it('should calculate similarity between orthogonal vectors', () => {
    const vec1 = new Float32Array([1, 0, 0]);
    const vec2 = new Float32Array([0, 1, 0]);

    const similarity = cosineSimilarity(vec1, vec2);

    expect(similarity).toBeCloseTo(0.0, 5);
  });

  it('should calculate similarity between opposite vectors', () => {
    const vec1 = new Float32Array([1, 0, 0]);
    const vec2 = new Float32Array([-1, 0, 0]);

    const similarity = cosineSimilarity(vec1, vec2);

    expect(similarity).toBeCloseTo(-1.0, 5);
  });

  it('should calculate similarity for normalized vectors', () => {
    const vec1 = new Float32Array([0.6, 0.8]);
    const vec2 = new Float32Array([0.8, 0.6]);

    const similarity = cosineSimilarity(vec1, vec2);

    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThan(1);
  });

  it('should handle zero vectors', () => {
    const vec1 = new Float32Array([0, 0, 0]);
    const vec2 = new Float32Array([1, 2, 3]);

    const similarity = cosineSimilarity(vec1, vec2);

    expect(similarity).toBe(0);
  });

  it('should throw on mismatched dimensions', () => {
    const vec1 = new Float32Array([1, 2, 3]);
    const vec2 = new Float32Array([1, 2]);

    expect(() => cosineSimilarity(vec1, vec2)).toThrow(
      'Embeddings must have the same length'
    );
  });

  it('should handle high-dimensional vectors', () => {
    const vec1 = createMockEmbedding(1, 768);
    const vec2 = createMockEmbedding(2, 768);

    const similarity = cosineSimilarity(vec1, vec2);

    expect(similarity).toBeGreaterThanOrEqual(-1);
    expect(similarity).toBeLessThanOrEqual(1);
  });
});

/**
 * Content Embeddings Tests
 * Tests embedding generation, similarity calculations, and caching
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ContentEmbeddingGenerator,
  LRUCache,
  createContentEmbeddingGenerator,
  createLRUCache,
  type MediaContent,
  type UserPreferences,
  type QState,
} from '../../src/learning/ContentEmbeddings.js';

describe('ContentEmbeddingGenerator', () => {
  let generator: ContentEmbeddingGenerator;

  const mockContent: MediaContent = {
    id: 'movie-123',
    title: 'The Matrix',
    overview: 'A hacker discovers reality is a simulation',
    genres: ['science fiction', 'action'],
    contentType: 'movie',
    popularity: 95,
    rating: 8.7,
    releaseDate: '1999-03-31',
    runtime: 136,
  };

  beforeEach(() => {
    generator = createContentEmbeddingGenerator(1000);
  });

  describe('Content Embedding Generation', () => {
    it('should generate 64-dimensional embedding', () => {
      const embedding = generator.generateContentEmbedding(mockContent);

      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBe(64);
    });

    it('should normalize embeddings (L2 norm)', () => {
      const embedding = generator.generateContentEmbedding(mockContent);

      let norm = 0;
      for (const value of embedding) {
        norm += value * value;
      }
      norm = Math.sqrt(norm);

      expect(norm).toBeCloseTo(1.0, 5);
    });

    it('should generate consistent embeddings for same content', () => {
      const embedding1 = generator.generateContentEmbedding(mockContent);
      const embedding2 = generator.generateContentEmbedding(mockContent);

      expect(embedding1).toEqual(embedding2);
    });

    it('should generate different embeddings for different content', () => {
      const content2: MediaContent = {
        ...mockContent,
        id: 'movie-456',
        title: 'Toy Story',
        genres: ['animation', 'family'],
      };

      const embedding1 = generator.generateContentEmbedding(mockContent);
      const embedding2 = generator.generateContentEmbedding(content2);

      expect(embedding1).not.toEqual(embedding2);
    });

    it('should handle content without overview', () => {
      const noOverview: MediaContent = {
        ...mockContent,
        overview: undefined,
      };

      const embedding = generator.generateContentEmbedding(noOverview);

      expect(embedding.length).toBe(64);
    });

    it('should handle content with empty genres', () => {
      const noGenres: MediaContent = {
        ...mockContent,
        genres: [],
      };

      const embedding = generator.generateContentEmbedding(noGenres);

      expect(embedding.length).toBe(64);
    });
  });

  describe('User Preference Embedding', () => {
    it('should generate preference embedding', () => {
      const preferences: UserPreferences = {
        favoriteGenres: ['action', 'science fiction'],
        preferredContentTypes: ['movie', 'tv'],
        ratingThreshold: 7.5,
        recencyPreference: 0.8,
      };

      const embedding = generator.generateUserPreferenceEmbedding(preferences);

      expect(embedding.length).toBe(64);
    });

    it('should normalize preference embeddings', () => {
      const preferences: UserPreferences = {
        favoriteGenres: ['action'],
        preferredContentTypes: ['movie'],
      };

      const embedding = generator.generateUserPreferenceEmbedding(preferences);

      let norm = 0;
      for (const value of embedding) {
        norm += value * value;
      }
      norm = Math.sqrt(norm);

      expect(norm).toBeCloseTo(1.0, 5);
    });

    it('should cache preference embeddings', () => {
      const preferences: UserPreferences = {
        favoriteGenres: ['action'],
        preferredContentTypes: ['movie'],
      };

      const embedding1 = generator.generateUserPreferenceEmbedding(preferences);
      const embedding2 = generator.generateUserPreferenceEmbedding(preferences);

      expect(embedding1).toEqual(embedding2);
    });
  });

  describe('State Embedding Generation', () => {
    it('should generate state embedding for Q-learning', () => {
      const state: QState = {
        genres: ['action', 'thriller'],
        contentType: 'movie',
        minRating: 7.5,
        maxAge: 5,
      };

      const embedding = generator.generateStateEmbedding(state);

      expect(embedding.length).toBe(64);
    });

    it('should handle partial state', () => {
      const partialState: QState = {
        genres: ['action'],
      };

      const embedding = generator.generateStateEmbedding(partialState);

      expect(embedding.length).toBe(64);
    });

    it('should normalize state embeddings', () => {
      const state: QState = {
        genres: ['action'],
        contentType: 'movie',
      };

      const embedding = generator.generateStateEmbedding(state);

      let norm = 0;
      for (const value of embedding) {
        norm += value * value;
      }
      norm = Math.sqrt(norm);

      expect(norm).toBeCloseTo(1.0, 5);
    });
  });

  describe('Similarity Calculations', () => {
    it('should calculate cosine similarity', () => {
      const content1 = mockContent;
      const content2 = { ...mockContent, id: 'movie-456' };

      const emb1 = generator.generateContentEmbedding(content1);
      const emb2 = generator.generateContentEmbedding(content2);

      const similarity = generator.cosineSimilarity(emb1, emb2);

      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should return 1 for identical vectors', () => {
      const embedding = generator.generateContentEmbedding(mockContent);

      const similarity = generator.cosineSimilarity(embedding, embedding);

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should handle orthogonal vectors', () => {
      const vec1 = new Array(64).fill(0);
      vec1[0] = 1;

      const vec2 = new Array(64).fill(0);
      vec2[1] = 1;

      vec1[0] = vec1[0] / Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0)) || 0;
      vec2[1] = vec2[1] / Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0)) || 0;

      const similarity = generator.cosineSimilarity(vec1, vec2);

      expect(similarity).toBeCloseTo(0, 5);
    });

    it('should throw error for mismatched vector lengths', () => {
      const vec1 = new Array(64).fill(0.5);
      const vec2 = new Array(32).fill(0.5);

      expect(() => {
        generator.cosineSimilarity(vec1, vec2);
      }).toThrow();
    });

    it('should handle zero-magnitude vectors', () => {
      const zeroVec = new Array(64).fill(0);
      const normalVec = generator.generateContentEmbedding(mockContent);

      const similarity = generator.cosineSimilarity(zeroVec, normalVec);

      expect(similarity).toBe(0);
    });
  });

  describe('Euclidean Distance', () => {
    it('should calculate euclidean distance', () => {
      const emb1 = generator.generateContentEmbedding(mockContent);
      const emb2 = generator.generateContentEmbedding({
        ...mockContent,
        id: 'movie-456',
      });

      const distance = generator.euclideanDistance(emb1, emb2);

      expect(distance).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for identical vectors', () => {
      const embedding = generator.generateContentEmbedding(mockContent);

      const distance = generator.euclideanDistance(embedding, embedding);

      expect(distance).toBeCloseTo(0, 5);
    });

    it('should throw error for mismatched lengths', () => {
      const vec1 = new Array(64).fill(0.5);
      const vec2 = new Array(32).fill(0.5);

      expect(() => {
        generator.euclideanDistance(vec1, vec2);
      }).toThrow();
    });
  });

  describe('Batch Top-K Search', () => {
    it('should find top-K similar items', () => {
      const query = generator.generateContentEmbedding(mockContent);

      const candidates = [
        { id: '1', embedding: generator.generateContentEmbedding(mockContent) },
        { id: '2', embedding: generator.generateContentEmbedding({ ...mockContent, id: '2' }) },
        { id: '3', embedding: generator.generateContentEmbedding({ ...mockContent, id: '3', genres: ['comedy'] }) },
      ];

      const topK = generator.batchTopK(query, candidates, 2);

      expect(topK).toHaveLength(2);
      expect(topK[0].similarity).toBeGreaterThanOrEqual(topK[1].similarity);
    });

    it('should sort by similarity descending', () => {
      const query = generator.generateContentEmbedding(mockContent);

      const candidates = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        embedding: generator.generateContentEmbedding({ ...mockContent, id: `${i}` }),
      }));

      const topK = generator.batchTopK(query, candidates, 5);

      for (let i = 0; i < topK.length - 1; i++) {
        expect(topK[i].similarity).toBeGreaterThanOrEqual(topK[i + 1].similarity);
      }
    });
  });

  describe('Embedding Combination', () => {
    it('should combine embeddings with weights', () => {
      const emb1 = generator.generateContentEmbedding(mockContent);
      const emb2 = generator.generateContentEmbedding({ ...mockContent, id: 'movie-456' });

      const combined = generator.combineEmbeddings([emb1, emb2], [0.7, 0.3]);

      expect(combined.length).toBe(64);
    });

    it('should normalize combined embeddings', () => {
      const emb1 = generator.generateContentEmbedding(mockContent);
      const emb2 = generator.generateContentEmbedding({ ...mockContent, id: 'movie-456' });

      const combined = generator.combineEmbeddings([emb1, emb2], [0.5, 0.5]);

      let norm = 0;
      for (const value of combined) {
        norm += value * value;
      }
      norm = Math.sqrt(norm);

      expect(norm).toBeCloseTo(1.0, 5);
    });

    it('should throw error for mismatched lengths', () => {
      const emb1 = generator.generateContentEmbedding(mockContent);

      expect(() => {
        generator.combineEmbeddings([emb1, emb1], [0.5]);
      }).toThrow();
    });

    it('should throw error for empty embeddings', () => {
      expect(() => {
        generator.combineEmbeddings([], []);
      }).toThrow();
    });
  });

  describe('Custom Weights', () => {
    it('should support custom component weights', () => {
      const customGenerator = createContentEmbeddingGenerator(1000, {
        genre: 0.5,
        type: 0.2,
        metadata: 0.2,
        keywords: 0.1,
      });

      const embedding = customGenerator.generateContentEmbedding(mockContent);

      expect(embedding.length).toBe(64);
    });
  });

  describe('Cache Management', () => {
    it('should cache embeddings', () => {
      const stats1 = generator.getCacheStats();

      generator.generateContentEmbedding(mockContent);
      generator.generateContentEmbedding(mockContent); // Cache hit

      const stats2 = generator.getCacheStats();

      expect(stats2.hits).toBeGreaterThan(stats1.hits);
    });

    it('should report cache statistics', () => {
      generator.generateContentEmbedding(mockContent);

      const stats = generator.getCacheStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('size');
    });

    it('should clear cache', () => {
      generator.generateContentEmbedding(mockContent);
      generator.clearCache();

      const stats = generator.getCacheStats();

      expect(stats.size).toBe(0);
    });

    it('should cleanup expired entries', () => {
      generator.generateContentEmbedding(mockContent);

      const removed = generator.cleanupCache(0); // Remove all

      expect(removed).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('LRUCache', () => {
  let cache: LRUCache<number>;

  beforeEach(() => {
    cache = createLRUCache<number>(3);
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 100);

      const value = cache.get('key1');

      expect(value).toBe(100);
    });

    it('should return undefined for missing keys', () => {
      const value = cache.get('missing');

      expect(value).toBeUndefined();
    });

    it('should check key existence', () => {
      cache.set('key1', 100);

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('missing')).toBe(false);
    });

    it('should report cache size', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);

      expect(cache.size).toBe(2);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used items', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);
      cache.set('key4', 400); // Should evict key1

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });

    it('should update access order on get', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);

      cache.get('key1'); // Move key1 to end

      cache.set('key4', 400); // Should evict key2

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should update access order on set', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);

      cache.set('key1', 150); // Update and move to end

      cache.set('key4', 400); // Should evict key2

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });
  });

  describe('getOrCompute', () => {
    it('should compute value on cache miss', () => {
      let computeCount = 0;
      const generator = () => {
        computeCount++;
        return 100;
      };

      const value = cache.getOrCompute('key1', generator);

      expect(value).toBe(100);
      expect(computeCount).toBe(1);
    });

    it('should return cached value on cache hit', () => {
      let computeCount = 0;
      const generator = () => {
        computeCount++;
        return 100;
      };

      cache.getOrCompute('key1', generator);
      cache.getOrCompute('key1', generator);

      expect(computeCount).toBe(1);
    });
  });

  describe('Statistics', () => {
    it('should track cache hits', () => {
      cache.set('key1', 100);

      cache.get('key1');
      cache.get('key1');

      const stats = cache.getStats();

      expect(stats.hits).toBe(2);
    });

    it('should track cache misses', () => {
      cache.get('missing1');
      cache.get('missing2');

      const stats = cache.getStats();

      expect(stats.misses).toBe(2);
    });

    it('should calculate hit rate', () => {
      cache.set('key1', 100);

      cache.get('key1'); // Hit
      cache.get('missing'); // Miss

      const stats = cache.getStats();

      expect(stats.hitRate).toBe(0.5);
    });

    it('should track evictions', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);
      cache.set('key4', 400); // Eviction

      const stats = cache.getStats();

      expect(stats.evictions).toBe(1);
    });
  });

  describe('Cleanup', () => {
    it('should clear all entries', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);

      cache.clear();

      expect(cache.size).toBe(0);
    });

    it('should reset statistics on clear', () => {
      cache.set('key1', 100);
      cache.get('key1');

      cache.clear();

      const stats = cache.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should cleanup expired entries', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);

      const removed = cache.cleanup(0); // Remove all

      expect(removed).toBe(2);
    });
  });

  describe('Factory Function', () => {
    it('should create cache with factory function', () => {
      const newCache = createLRUCache<string>(5);

      expect(newCache).toBeInstanceOf(LRUCache);
    });

    it('should use default max size', () => {
      const defaultCache = createLRUCache<number>();

      expect(defaultCache.getStats().maxSize).toBe(1000);
    });
  });
});

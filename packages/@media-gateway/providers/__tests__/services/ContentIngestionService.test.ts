/**
 * ContentIngestionService Tests
 * Comprehensive test suite for content ingestion pipeline
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ContentIngestionService,
  createContentIngestionService,
  type VectorStore,
  type IngestionProgressCallback,
} from '../../src/services/ContentIngestionService.js';
import type { MediaContent } from '@media-gateway/core';

describe('ContentIngestionService', () => {
  let service: ContentIngestionService;
  let mockVectorStore: VectorStore;

  const mockConfig = {
    tmdb: {
      apiKey: 'test-api-key',
    },
    batchSize: 5,
    delayMs: 10,
    maxPages: 1,
  };

  const createMockContent = (id: number): MediaContent => ({
    id,
    title: `Test Content ${id}`,
    overview: `Overview for content ${id}`,
    mediaType: 'movie',
    genreIds: [28, 12],
    voteAverage: 7.5,
    voteCount: 1000,
    releaseDate: '2024-01-01',
    posterPath: '/poster.jpg',
    backdropPath: '/backdrop.jpg',
    popularity: 100.0,
  });

  beforeEach(() => {
    service = new ContentIngestionService(mockConfig);

    mockVectorStore = {
      upsertContent: vi.fn().mockResolvedValue(undefined),
      generateEmbedding: vi.fn().mockResolvedValue(new Float32Array([0.1, 0.2, 0.3])),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor and Factory', () => {
    it('should create service with config', () => {
      const testService = new ContentIngestionService(mockConfig);
      expect(testService).toBeInstanceOf(ContentIngestionService);
    });

    it('should create service via factory function', () => {
      const testService = createContentIngestionService(mockConfig);
      expect(testService).toBeInstanceOf(ContentIngestionService);
    });

    it('should use default configuration values', () => {
      const minimalService = new ContentIngestionService({
        tmdb: { apiKey: 'key' },
      });
      expect(minimalService).toBeInstanceOf(ContentIngestionService);
    });
  });

  describe('Popular Movies Ingestion', () => {
    it('should ingest popular movies successfully', async () => {
      const mockMovies = Array.from({ length: 10 }, (_, i) => createMockContent(i + 1));

      const mockResponse = {
        page: 1,
        results: mockMovies.map(m => ({
          id: m.id,
          title: m.title,
          overview: m.overview,
          release_date: m.releaseDate,
          genre_ids: m.genreIds,
          vote_average: m.voteAverage,
          vote_count: m.voteCount,
          popularity: m.popularity,
          poster_path: m.posterPath,
          backdrop_path: m.backdropPath,
          adult: false,
          original_language: 'en',
          original_title: m.title,
        })),
        total_pages: 1,
        total_results: 10,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.ingestPopularMovies(mockVectorStore);

      expect(result.successCount).toBe(10);
      expect(result.errorCount).toBe(0);
      expect(result.totalProcessed).toBe(10);
      expect(mockVectorStore.upsertContent).toHaveBeenCalledTimes(10);
      expect(mockVectorStore.generateEmbedding).toHaveBeenCalledTimes(10);
    });

    it('should call progress callback', async () => {
      const mockMovies = Array.from({ length: 5 }, (_, i) => createMockContent(i + 1));

      const mockResponse = {
        page: 1,
        results: mockMovies.map(m => ({
          id: m.id,
          title: m.title,
          overview: m.overview,
          release_date: m.releaseDate,
          genre_ids: m.genreIds,
          vote_average: m.voteAverage,
          vote_count: m.voteCount,
          popularity: m.popularity,
          poster_path: m.posterPath,
          backdrop_path: m.backdropPath,
          adult: false,
          original_language: 'en',
          original_title: m.title,
        })),
        total_pages: 1,
        total_results: 5,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const progressCallback: IngestionProgressCallback = vi.fn();

      await service.ingestPopularMovies(mockVectorStore, progressCallback);

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          processed: expect.any(Number),
          errors: expect.any(Number),
        })
      );
    });

    it('should process multiple pages', async () => {
      // Create a service with maxPages: 2
      const multiPageService = new ContentIngestionService({
        tmdb: { apiKey: 'test-api-key' },
        batchSize: 5,
        delayMs: 10,
        maxPages: 2,
      });

      const createPageResponse = (page: number) => ({
        page,
        results: Array.from({ length: 5 }, (_, i) => ({
          id: (page - 1) * 5 + i + 1,
          title: `Movie ${(page - 1) * 5 + i + 1}`,
          overview: 'Overview',
          release_date: '2024-01-01',
          genre_ids: [28],
          vote_average: 7.0,
          vote_count: 100,
          popularity: 50.0,
          poster_path: null,
          backdrop_path: null,
          adult: false,
          original_language: 'en',
          original_title: `Movie ${(page - 1) * 5 + i + 1}`,
        })),
        total_pages: 2,
        total_results: 10,
      });

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createPageResponse(1),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createPageResponse(2),
        });

      const result = await multiPageService.ingestPopularMovies(mockVectorStore);

      expect(result.totalProcessed).toBe(10);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Popular TV Shows Ingestion', () => {
    it('should ingest popular TV shows successfully', async () => {
      const mockResponse = {
        page: 1,
        results: Array.from({ length: 5 }, (_, i) => ({
          id: i + 1,
          name: `TV Show ${i + 1}`,
          overview: 'Overview',
          first_air_date: '2024-01-01',
          genre_ids: [18],
          vote_average: 8.0,
          vote_count: 500,
          popularity: 80.0,
          poster_path: null,
          backdrop_path: null,
          origin_country: ['US'],
          original_language: 'en',
          original_name: `TV Show ${i + 1}`,
        })),
        total_pages: 1,
        total_results: 5,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.ingestPopularTVShows(mockVectorStore);

      expect(result.successCount).toBe(5);
      expect(result.totalProcessed).toBe(5);
    });
  });

  describe('Trending Ingestion', () => {
    it('should ingest trending content', async () => {
      const mockResponse = {
        page: 1,
        results: [
          {
            id: 1,
            title: 'Trending Movie',
            overview: 'Overview',
            release_date: '2024-01-01',
            genre_ids: [28],
            vote_average: 7.5,
            vote_count: 1000,
            popularity: 150.0,
            poster_path: null,
            backdrop_path: null,
            adult: false,
            original_language: 'en',
            original_title: 'Trending Movie',
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.ingestTrending(mockVectorStore, 'movie');

      expect(result.successCount).toBe(1);
    });

    it('should only process 1 page for trending', async () => {
      const mockResponse = {
        page: 1,
        results: [],
        total_pages: 1,
        total_results: 0,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await service.ingestTrending(mockVectorStore);

      // Should only call once for trending (single page)
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Genre-based Ingestion', () => {
    it('should ingest content by genre', async () => {
      const mockResponse = {
        page: 1,
        results: [
          {
            id: 1,
            title: 'Action Movie',
            overview: 'Overview',
            release_date: '2024-01-01',
            genre_ids: [28],
            vote_average: 7.0,
            vote_count: 500,
            popularity: 100.0,
            poster_path: null,
            backdrop_path: null,
            adult: false,
            original_language: 'en',
            original_title: 'Action Movie',
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.ingestByGenre(mockVectorStore, [28]);

      expect(result.successCount).toBe(1);
    });
  });

  describe('Batch Processing', () => {
    it('should process in batches', async () => {
      const mockResponse = {
        page: 1,
        results: Array.from({ length: 12 }, (_, i) => ({
          id: i + 1,
          title: `Movie ${i + 1}`,
          overview: 'Overview',
          release_date: '2024-01-01',
          genre_ids: [28],
          vote_average: 7.0,
          vote_count: 100,
          popularity: 50.0,
          poster_path: null,
          backdrop_path: null,
          adult: false,
          original_language: 'en',
          original_title: `Movie ${i + 1}`,
        })),
        total_pages: 1,
        total_results: 12,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.ingestPopularMovies(mockVectorStore);

      // With batch size of 5, should process in 3 batches (5 + 5 + 2)
      expect(result.totalProcessed).toBe(12);
    });

    it('should delay between batches', async () => {
      const mockResponse = {
        page: 1,
        results: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          title: `Movie ${i + 1}`,
          overview: 'Overview',
          release_date: '2024-01-01',
          genre_ids: [28],
          vote_average: 7.0,
          vote_count: 100,
          popularity: 50.0,
          poster_path: null,
          backdrop_path: null,
          adult: false,
          original_language: 'en',
          original_title: `Movie ${i + 1}`,
        })),
        total_pages: 1,
        total_results: 10,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const startTime = Date.now();
      await service.ingestPopularMovies(mockVectorStore);
      const duration = Date.now() - startTime;

      // Should take at least some time due to delays
      expect(duration).toBeGreaterThan(10);
    });
  });

  describe('Error Handling', () => {
    it('should handle embedding generation errors', async () => {
      const mockResponse = {
        page: 1,
        results: [
          {
            id: 1,
            title: 'Movie',
            overview: 'Overview',
            release_date: '2024-01-01',
            genre_ids: [28],
            vote_average: 7.0,
            vote_count: 100,
            popularity: 50.0,
            poster_path: null,
            backdrop_path: null,
            adult: false,
            original_language: 'en',
            original_title: 'Movie',
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      mockVectorStore.generateEmbedding = vi.fn().mockResolvedValue(null);

      const result = await service.ingestPopularMovies(mockVectorStore);

      expect(result.errorCount).toBe(1);
      expect(result.successCount).toBe(0);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle upsert errors', async () => {
      const mockResponse = {
        page: 1,
        results: [
          {
            id: 1,
            title: 'Movie',
            overview: 'Overview',
            release_date: '2024-01-01',
            genre_ids: [28],
            vote_average: 7.0,
            vote_count: 100,
            popularity: 50.0,
            poster_path: null,
            backdrop_path: null,
            adult: false,
            original_language: 'en',
            original_title: 'Movie',
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      mockVectorStore.upsertContent = vi.fn().mockRejectedValue(new Error('Upsert failed'));

      const result = await service.ingestPopularMovies(mockVectorStore);

      expect(result.errorCount).toBe(1);
      expect(result.errors[0]?.error).toContain('Upsert failed');
    });

    it('should continue on page fetch errors', async () => {
      // With maxPages: 1, it won't try page 2, so we expect no successes
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.ingestPopularMovies(mockVectorStore);

      // Should handle error gracefully
      expect(result.successCount).toBe(0);
      expect(result.errorCount).toBe(0);
    });

    it('should limit error list to 100 entries', async () => {
      const largeResults = Array.from({ length: 150 }, (_, i) => ({
        id: i + 1,
        title: `Movie ${i + 1}`,
        overview: 'Overview',
        release_date: '2024-01-01',
        genre_ids: [28],
        vote_average: 7.0,
        vote_count: 100,
        popularity: 50.0,
        poster_path: null,
        backdrop_path: null,
        adult: false,
        original_language: 'en',
        original_title: `Movie ${i + 1}`,
      }));

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          page: 1,
          results: largeResults,
          total_pages: 1,
          total_results: 150,
        }),
      });

      mockVectorStore.generateEmbedding = vi.fn().mockResolvedValue(null);

      const result = await service.ingestPopularMovies(mockVectorStore);

      expect(result.errors.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Embedding Text Generation', () => {
    it('should create proper embedding text', async () => {
      const content = createMockContent(1);
      content.genreIds = [28, 12]; // Action, Adventure

      const mockResponse = {
        page: 1,
        results: [
          {
            id: content.id,
            title: content.title,
            overview: content.overview,
            release_date: content.releaseDate,
            genre_ids: content.genreIds,
            vote_average: content.voteAverage,
            vote_count: content.voteCount,
            popularity: content.popularity,
            poster_path: content.posterPath,
            backdrop_path: content.backdropPath,
            adult: false,
            original_language: 'en',
            original_title: content.title,
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      let embeddingText: string = '';
      mockVectorStore.generateEmbedding = vi.fn().mockImplementation((text: string) => {
        embeddingText = text;
        return Promise.resolve(new Float32Array([0.1, 0.2]));
      });

      await service.ingestPopularMovies(mockVectorStore);

      expect(embeddingText).toContain(content.title);
      expect(embeddingText).toContain(content.overview);
      expect(embeddingText).toContain('Action');
      expect(embeddingText).toContain('Adventure');
      expect(embeddingText).toContain('Movie');
      expect(embeddingText).toContain('2024');
    });
  });

  describe('Full Catalog Ingestion', () => {
    it('should ingest full catalog', async () => {
      const mockResponse = {
        page: 1,
        results: [
          {
            id: 1,
            title: 'Movie',
            overview: 'Overview',
            release_date: '2024-01-01',
            genre_ids: [28],
            vote_average: 7.0,
            vote_count: 100,
            popularity: 50.0,
            poster_path: null,
            backdrop_path: null,
            adult: false,
            original_language: 'en',
            original_title: 'Movie',
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      const tvResponse = {
        page: 1,
        results: [
          {
            id: 1,
            name: 'TV Show',
            overview: 'Overview',
            first_air_date: '2024-01-01',
            genre_ids: [18],
            vote_average: 8.0,
            vote_count: 200,
            popularity: 80.0,
            poster_path: null,
            backdrop_path: null,
            origin_country: ['US'],
            original_language: 'en',
            original_name: 'TV Show',
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/tv/')) {
          return Promise.resolve({
            ok: true,
            json: async () => tvResponse,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockResponse,
        });
      });

      const results = await service.ingestFullCatalog(mockVectorStore);

      expect(results.total.totalProcessed).toBeGreaterThan(0);
      expect(results.movies.successCount).toBeGreaterThan(0);
      expect(results.tvShows.successCount).toBeGreaterThan(0);
      expect(results.trending.successCount).toBeGreaterThan(0);
    });

    it('should aggregate totals correctly', async () => {
      const mockResponse = {
        page: 1,
        results: [],
        total_pages: 1,
        total_results: 0,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const results = await service.ingestFullCatalog(mockVectorStore);

      expect(results.total.totalProcessed).toBe(
        results.movies.totalProcessed +
        results.tvShows.totalProcessed +
        results.trending.totalProcessed
      );
      expect(results.total.successCount).toBe(
        results.movies.successCount +
        results.tvShows.successCount +
        results.trending.successCount
      );
    });
  });

  describe('Performance Metrics', () => {
    it('should track ingestion duration', async () => {
      const mockResponse = {
        page: 1,
        results: [
          {
            id: 1,
            title: 'Movie',
            overview: 'Overview',
            release_date: '2024-01-01',
            genre_ids: [28],
            vote_average: 7.0,
            vote_count: 100,
            popularity: 50.0,
            poster_path: null,
            backdrop_path: null,
            adult: false,
            original_language: 'en',
            original_title: 'Movie',
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.ingestPopularMovies(mockVectorStore);

      expect(result.duration).toBeGreaterThan(0);
    });
  });
});

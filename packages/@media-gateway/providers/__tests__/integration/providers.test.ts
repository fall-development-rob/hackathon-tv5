/**
 * Integration Tests
 * Tests TMDBAdapter + AvailabilityService working together
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TMDBAdapter } from '../../src/adapters/TMDBAdapter.js';
import { AvailabilityService } from '../../src/services/AvailabilityService.js';
import { ContentIngestionService, type VectorStore } from '../../src/services/ContentIngestionService.js';
import type { MediaContent } from '@media-gateway/core';

describe('Providers Integration Tests', () => {
  const mockApiKey = 'test-api-key';
  let tmdbAdapter: TMDBAdapter;
  let availabilityService: AvailabilityService;

  beforeEach(() => {
    tmdbAdapter = new TMDBAdapter({ apiKey: mockApiKey });
    availabilityService = new AvailabilityService({
      tmdbApiKey: mockApiKey,
      enableTMDB: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Search and Availability Flow', () => {
    it('should search content and get availability', async () => {
      const mockSearchResponse = {
        page: 1,
        results: [
          {
            id: 550,
            title: 'Fight Club',
            overview: 'A ticking-time-bomb insomniac...',
            release_date: '1999-10-15',
            genre_ids: [18, 53],
            vote_average: 8.4,
            vote_count: 26000,
            popularity: 123.45,
            poster_path: '/poster.jpg',
            backdrop_path: '/backdrop.jpg',
            adult: false,
            original_language: 'en',
            original_title: 'Fight Club',
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      const mockProvidersResponse = {
        results: {
          US: {
            link: 'https://www.themoviedb.org/movie/550/watch',
            flatrate: [
              {
                display_priority: 1,
                logo_path: '/netflix.jpg',
                provider_id: 8,
                provider_name: 'Netflix',
              },
            ],
          },
        },
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSearchResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockProvidersResponse,
        });

      // Search for content
      const searchResults = await tmdbAdapter.searchMovies('Fight Club');
      expect(searchResults).toHaveLength(1);

      const content = searchResults[0]!;

      // Get availability for the found content
      const availability = await availabilityService.getAvailability(content);

      expect(availability.platforms).toHaveLength(1);
      expect(availability.platforms[0]?.platformId).toBe('netflix');
      expect(availability.contentId).toBe(550);
    });

    it('should handle multi-search with availability', async () => {
      const movieResponse = {
        page: 1,
        results: [
          {
            id: 1,
            title: 'Test Movie',
            overview: 'Movie overview',
            release_date: '2024-01-01',
            genre_ids: [28],
            vote_average: 7.0,
            vote_count: 100,
            popularity: 50.0,
            poster_path: null,
            backdrop_path: null,
            adult: false,
            original_language: 'en',
            original_title: 'Test Movie',
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      const tvResponse = {
        page: 1,
        results: [
          {
            id: 2,
            name: 'Test Show',
            overview: 'TV overview',
            first_air_date: '2024-01-01',
            genre_ids: [18],
            vote_average: 8.0,
            vote_count: 200,
            popularity: 100.0,
            poster_path: null,
            backdrop_path: null,
            origin_country: ['US'],
            original_language: 'en',
            original_name: 'Test Show',
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      const mockProviders = {
        results: {
          US: {
            link: 'https://www.themoviedb.org/watch',
            flatrate: [
              {
                display_priority: 1,
                logo_path: '/netflix.jpg',
                provider_id: 8,
                provider_name: 'Netflix',
              },
            ],
          },
        },
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => movieResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => tvResponse })
        .mockResolvedValueOnce({ ok: true, json: async () => mockProviders })
        .mockResolvedValueOnce({ ok: true, json: async () => mockProviders });

      const results = await tmdbAdapter.searchMulti('test');
      expect(results).toHaveLength(2);

      const availabilities = await availabilityService.getBatchAvailability(results);
      expect(availabilities.size).toBe(2);
    });
  });

  describe('Recommendation Flow with Availability', () => {
    it('should get recommendations and check availability', async () => {
      const mockRecommendations = {
        page: 1,
        results: [
          {
            id: 551,
            title: 'Similar Movie',
            overview: 'Overview',
            release_date: '2000-01-01',
            genre_ids: [18],
            vote_average: 7.5,
            vote_count: 500,
            popularity: 80.0,
            poster_path: null,
            backdrop_path: null,
            adult: false,
            original_language: 'en',
            original_title: 'Similar Movie',
          },
          {
            id: 552,
            title: 'Another Recommendation',
            overview: 'Overview',
            release_date: '2001-01-01',
            genre_ids: [18],
            vote_average: 7.0,
            vote_count: 300,
            popularity: 70.0,
            poster_path: null,
            backdrop_path: null,
            adult: false,
            original_language: 'en',
            original_title: 'Another Recommendation',
          },
        ],
        total_pages: 1,
        total_results: 2,
      };

      const mockProviders = {
        results: {
          US: {
            link: 'https://www.themoviedb.org/watch',
            flatrate: [
              {
                display_priority: 1,
                logo_path: '/prime.jpg',
                provider_id: 9,
                provider_name: 'Amazon Prime Video',
              },
            ],
          },
        },
      };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => mockRecommendations })
        .mockResolvedValue({ ok: true, json: async () => mockProviders });

      const recommendations = await tmdbAdapter.getRecommendations(550, 'movie');
      expect(recommendations).toHaveLength(2);

      // Check which ones are available on user's platform
      const userPlatforms = ['prime'];
      const available = [];

      for (const content of recommendations) {
        const isAvailable = await availabilityService.isAvailableOn(
          content,
          userPlatforms[0]!
        );
        if (isAvailable) {
          available.push(content);
        }
      }

      expect(available.length).toBeGreaterThan(0);
    });
  });

  describe('Best Platform Selection', () => {
    it('should find best platform from user subscriptions', async () => {
      const mockContent: MediaContent = {
        id: 550,
        title: 'Fight Club',
        overview: 'Overview',
        mediaType: 'movie',
        genreIds: [18, 53],
        voteAverage: 8.4,
        voteCount: 26000,
        releaseDate: '1999-10-15',
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
        popularity: 123.45,
      };

      const mockProviders = {
        results: {
          US: {
            link: 'https://www.themoviedb.org/movie/550/watch',
            flatrate: [
              {
                display_priority: 1,
                logo_path: '/netflix.jpg',
                provider_id: 8,
                provider_name: 'Netflix',
              },
              {
                display_priority: 2,
                logo_path: '/prime.jpg',
                provider_id: 9,
                provider_name: 'Amazon Prime Video',
              },
              {
                display_priority: 3,
                logo_path: '/disney.jpg',
                provider_id: 337,
                provider_name: 'Disney+',
              },
            ],
          },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockProviders,
      });

      const userSubscriptions = ['disney', 'hulu'];
      const bestPlatform = await availabilityService.findBestPlatform(
        mockContent,
        userSubscriptions
      );

      expect(bestPlatform).toBeDefined();
      expect(bestPlatform?.platformId).toBe('disney');
    });
  });

  describe('Content Ingestion with Vector Store', () => {
    it('should ingest content and generate embeddings', async () => {
      const mockVectorStore: VectorStore = {
        upsertContent: vi.fn().mockResolvedValue(undefined),
        generateEmbedding: vi.fn().mockResolvedValue(new Float32Array([0.1, 0.2, 0.3])),
      };

      const ingestionService = new ContentIngestionService({
        tmdb: { apiKey: mockApiKey },
        batchSize: 5,
        delayMs: 10,
        maxPages: 1,
      });

      const mockMovies = {
        page: 1,
        results: [
          {
            id: 1,
            title: 'Test Movie',
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
            original_title: 'Test Movie',
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockMovies,
      });

      const result = await ingestionService.ingestPopularMovies(mockVectorStore);

      expect(result.successCount).toBe(1);
      expect(mockVectorStore.generateEmbedding).toHaveBeenCalled();
      expect(mockVectorStore.upsertContent).toHaveBeenCalled();
    });
  });

  describe('Error Resilience', () => {
    it('should handle TMDB errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      await expect(tmdbAdapter.searchMovies('test')).rejects.toThrow(
        'TMDB API error'
      );
    });

    it('should fallback to simulated data on availability errors', async () => {
      const mockContent: MediaContent = {
        id: 550,
        title: 'Fight Club',
        overview: 'Overview',
        mediaType: 'movie',
        genreIds: [18, 53],
        voteAverage: 8.4,
        voteCount: 26000,
        releaseDate: '1999-10-15',
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
        popularity: 123.45,
      };

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const availability = await availabilityService.getAvailability(mockContent);

      // Should fall back to simulated data
      expect(availability.source).toBe('simulated');
      expect(availability.platforms.length).toBeGreaterThan(0);
    });
  });

  describe('Caching Efficiency', () => {
    it('should use cache for repeated requests', async () => {
      const mockResponse = {
        page: 1,
        results: [
          {
            id: 550,
            title: 'Fight Club',
            overview: 'Overview',
            release_date: '1999-10-15',
            genre_ids: [18, 53],
            vote_average: 8.4,
            vote_count: 26000,
            popularity: 123.45,
            poster_path: '/poster.jpg',
            backdrop_path: '/backdrop.jpg',
            adult: false,
            original_language: 'en',
            original_title: 'Fight Club',
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // First search
      await tmdbAdapter.searchMovies('Fight Club');
      // Second search (should use cache)
      await tmdbAdapter.searchMovies('Fight Club');

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should cache availability results', async () => {
      const mockContent: MediaContent = {
        id: 550,
        title: 'Fight Club',
        overview: 'Overview',
        mediaType: 'movie',
        genreIds: [18, 53],
        voteAverage: 8.4,
        voteCount: 26000,
        releaseDate: '1999-10-15',
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
        popularity: 123.45,
      };

      const mockProviders = {
        results: {
          US: {
            link: 'https://www.themoviedb.org/movie/550/watch',
            flatrate: [
              {
                display_priority: 1,
                logo_path: '/netflix.jpg',
                provider_id: 8,
                provider_name: 'Netflix',
              },
            ],
          },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockProviders,
      });

      // First availability check
      await availabilityService.getAvailability(mockContent);
      // Second check (should use cache)
      await availabilityService.getAvailability(mockContent);

      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Regional Availability', () => {
    it('should get availability for different regions', async () => {
      const mockContent: MediaContent = {
        id: 550,
        title: 'Fight Club',
        overview: 'Overview',
        mediaType: 'movie',
        genreIds: [18, 53],
        voteAverage: 8.4,
        voteCount: 26000,
        releaseDate: '1999-10-15',
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
        popularity: 123.45,
      };

      const mockProviders = {
        results: {
          US: {
            link: 'https://www.themoviedb.org/movie/550/watch',
            flatrate: [
              {
                display_priority: 1,
                logo_path: '/netflix.jpg',
                provider_id: 8,
                provider_name: 'Netflix',
              },
            ],
          },
          UK: {
            link: 'https://www.themoviedb.org/movie/550/watch',
            flatrate: [
              {
                display_priority: 1,
                logo_path: '/prime.jpg',
                provider_id: 9,
                provider_name: 'Amazon Prime Video',
              },
            ],
          },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockProviders,
      });

      const usAvailability = await availabilityService.getAvailability(mockContent, 'US');
      const ukAvailability = await availabilityService.getAvailability(mockContent, 'UK');

      expect(usAvailability.platforms[0]?.platformId).toBe('netflix');
      expect(ukAvailability.platforms[0]?.platformId).toBe('prime');
    });
  });
});

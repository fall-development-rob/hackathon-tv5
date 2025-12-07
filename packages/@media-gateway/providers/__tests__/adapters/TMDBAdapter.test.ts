/**
 * TMDBAdapter Tests
 * Comprehensive test suite for TMDB API integration
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TMDBAdapter, createTMDBAdapter } from '../../src/adapters/TMDBAdapter.js';
import type { MediaContent } from '@media-gateway/core';

describe('TMDBAdapter', () => {
  let adapter: TMDBAdapter;
  const mockApiKey = 'test-api-key';
  const mockBaseUrl = 'https://api.themoviedb.org/3';

  beforeEach(() => {
    adapter = new TMDBAdapter({ apiKey: mockApiKey });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor and Factory', () => {
    it('should create adapter with default config', () => {
      const testAdapter = new TMDBAdapter({ apiKey: 'key' });
      expect(testAdapter).toBeInstanceOf(TMDBAdapter);
    });

    it('should create adapter via factory function', () => {
      const testAdapter = createTMDBAdapter({ apiKey: 'key' });
      expect(testAdapter).toBeInstanceOf(TMDBAdapter);
    });

    it('should use custom configuration', () => {
      const customAdapter = new TMDBAdapter({
        apiKey: 'key',
        baseUrl: 'https://custom.api.com',
        language: 'fr-FR',
        region: 'FR',
      });
      expect(customAdapter).toBeInstanceOf(TMDBAdapter);
    });
  });

  describe('Search Functionality', () => {
    it('should search movies successfully', async () => {
      const mockResponse = {
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

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const results = await adapter.searchMovies('Fight Club');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 550,
        title: 'Fight Club',
        mediaType: 'movie',
        popularity: 123.45,
      });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/search/movie')
      );
    });

    it('should search TV shows successfully', async () => {
      const mockResponse = {
        page: 1,
        results: [
          {
            id: 1396,
            name: 'Breaking Bad',
            overview: 'A high school chemistry teacher...',
            first_air_date: '2008-01-20',
            genre_ids: [18, 80],
            vote_average: 9.0,
            vote_count: 12000,
            popularity: 200.0,
            poster_path: '/poster.jpg',
            backdrop_path: '/backdrop.jpg',
            origin_country: ['US'],
            original_language: 'en',
            original_name: 'Breaking Bad',
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const results = await adapter.searchTVShows('Breaking Bad');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 1396,
        title: 'Breaking Bad',
        mediaType: 'tv',
      });
    });

    it('should search multi (movies and TV shows)', async () => {
      const movieResponse = {
        page: 1,
        results: [
          {
            id: 1,
            title: 'Movie',
            overview: 'Test',
            release_date: '2020-01-01',
            genre_ids: [18],
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
            id: 2,
            name: 'TV Show',
            overview: 'Test',
            first_air_date: '2020-01-01',
            genre_ids: [18],
            vote_average: 8.0,
            vote_count: 200,
            popularity: 100.0,
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

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => movieResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => tvResponse,
        });

      const results = await adapter.searchMulti('test');

      expect(results).toHaveLength(2);
      // Should be sorted by popularity (TV show first: 100 > movie: 50)
      expect(results[0]?.title).toBe('TV Show');
      expect(results[1]?.title).toBe('Movie');
    });

    it('should handle pagination', async () => {
      const mockResponse = {
        page: 2,
        results: [],
        total_pages: 10,
        total_results: 200,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await adapter.searchMovies('test', 2);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2')
      );
    });
  });

  describe('Content Details', () => {
    it('should get movie details', async () => {
      const mockMovie = {
        id: 550,
        title: 'Fight Club',
        overview: 'A ticking-time-bomb insomniac...',
        release_date: '1999-10-15',
        genre_ids: [18, 53],
        genres: [
          { id: 18, name: 'Drama' },
          { id: 53, name: 'Thriller' },
        ],
        vote_average: 8.4,
        vote_count: 26000,
        popularity: 123.45,
        poster_path: '/poster.jpg',
        backdrop_path: '/backdrop.jpg',
        adult: false,
        original_language: 'en',
        original_title: 'Fight Club',
        runtime: 139,
        production_companies: [
          { id: 1, name: 'Fox 2000 Pictures' },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockMovie,
      });

      const result = await adapter.getMovie(550);

      expect(result).toMatchObject({
        id: 550,
        title: 'Fight Club',
        mediaType: 'movie',
      });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/movie/550')
      );
    });

    it('should get TV show details', async () => {
      const mockShow = {
        id: 1396,
        name: 'Breaking Bad',
        overview: 'A high school chemistry teacher...',
        first_air_date: '2008-01-20',
        genre_ids: [18, 80],
        genres: [
          { id: 18, name: 'Drama' },
          { id: 80, name: 'Crime' },
        ],
        vote_average: 9.0,
        vote_count: 12000,
        popularity: 200.0,
        poster_path: '/poster.jpg',
        backdrop_path: '/backdrop.jpg',
        origin_country: ['US'],
        original_language: 'en',
        original_name: 'Breaking Bad',
        episode_run_time: [47],
        networks: [{ id: 1, name: 'AMC' }],
        number_of_seasons: 5,
        number_of_episodes: 62,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockShow,
      });

      const result = await adapter.getTVShow(1396);

      expect(result).toMatchObject({
        id: 1396,
        title: 'Breaking Bad',
        mediaType: 'tv',
      });
    });
  });

  describe('Trending and Popular', () => {
    it('should get trending content', async () => {
      const mockResponse = {
        page: 1,
        results: [
          {
            id: 1,
            title: 'Trending Movie',
            overview: 'Test',
            release_date: '2024-01-01',
            genre_ids: [28],
            vote_average: 8.0,
            vote_count: 1000,
            popularity: 500.0,
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

      const results = await adapter.getTrending('movie', 'week');

      expect(results).toHaveLength(1);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/trending/movie/week')
      );
    });

    it('should get popular movies', async () => {
      const mockResponse = {
        page: 1,
        results: [
          {
            id: 1,
            title: 'Popular Movie',
            overview: 'Test',
            release_date: '2024-01-01',
            genre_ids: [28],
            vote_average: 7.5,
            vote_count: 800,
            popularity: 300.0,
            poster_path: null,
            backdrop_path: null,
            adult: false,
            original_language: 'en',
            original_title: 'Popular Movie',
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const results = await adapter.getPopularMovies();

      expect(results).toHaveLength(1);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/movie/popular')
      );
    });

    it('should get popular TV shows', async () => {
      const mockResponse = {
        page: 1,
        results: [
          {
            id: 1,
            name: 'Popular Show',
            overview: 'Test',
            first_air_date: '2024-01-01',
            genre_ids: [18],
            vote_average: 8.5,
            vote_count: 1200,
            popularity: 400.0,
            poster_path: null,
            backdrop_path: null,
            origin_country: ['US'],
            original_language: 'en',
            original_name: 'Popular Show',
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const results = await adapter.getPopularTVShows();

      expect(results).toHaveLength(1);
    });
  });

  describe('Discovery', () => {
    it('should discover movies with filters', async () => {
      const mockResponse = {
        page: 1,
        results: [
          {
            id: 1,
            title: 'Action Movie',
            overview: 'Test',
            release_date: '2023-06-15',
            genre_ids: [28],
            vote_average: 7.0,
            vote_count: 500,
            popularity: 150.0,
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

      const results = await adapter.discoverMovies({
        genres: [28],
        yearMin: 2020,
        yearMax: 2024,
        ratingMin: 7.0,
        sortBy: 'vote_average.desc',
      });

      expect(results).toHaveLength(1);
      const fetchCall = (fetch as any).mock.calls[0][0];
      expect(fetchCall).toContain('with_genres=28');
      expect(fetchCall).toContain('primary_release_date.gte=2020-01-01');
      expect(fetchCall).toContain('primary_release_date.lte=2024-12-31');
      expect(fetchCall).toContain('vote_average.gte=7');
    });
  });

  describe('Watch Providers', () => {
    it('should get watch providers for movie', async () => {
      const mockResponse = {
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
        json: async () => mockResponse,
      });

      const result = await adapter.getWatchProviders(550, 'movie');

      expect(result.results.US).toBeDefined();
      expect(result.results.US!.flatrate).toHaveLength(1);
      expect(result.results.US!.flatrate![0]?.provider_name).toBe('Netflix');
    });
  });

  describe('Similar and Recommendations', () => {
    it('should get similar content', async () => {
      const mockResponse = {
        page: 1,
        results: [
          {
            id: 551,
            title: 'Similar Movie',
            overview: 'Test',
            release_date: '2000-01-01',
            genre_ids: [18],
            vote_average: 7.0,
            vote_count: 100,
            popularity: 50.0,
            poster_path: null,
            backdrop_path: null,
            adult: false,
            original_language: 'en',
            original_title: 'Similar Movie',
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const results = await adapter.getSimilar(550, 'movie');

      expect(results).toHaveLength(1);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/movie/550/similar')
      );
    });

    it('should get recommendations', async () => {
      const mockResponse = {
        page: 1,
        results: [
          {
            id: 552,
            title: 'Recommended Movie',
            overview: 'Test',
            release_date: '2001-01-01',
            genre_ids: [18],
            vote_average: 7.5,
            vote_count: 150,
            popularity: 60.0,
            poster_path: null,
            backdrop_path: null,
            adult: false,
            original_language: 'en',
            original_title: 'Recommended Movie',
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const results = await adapter.getRecommendations(550, 'movie');

      expect(results).toHaveLength(1);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/movie/550/recommendations')
      );
    });
  });

  describe('Caching', () => {
    it('should cache API responses', async () => {
      const mockResponse = {
        page: 1,
        results: [
          {
            id: 1,
            title: 'Test Movie',
            overview: 'Test',
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
        json: async () => mockResponse,
      });

      // First call
      await adapter.searchMovies('test');
      // Second call (should use cache)
      await adapter.searchMovies('test');

      // Fetch should only be called once
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should clear cache', async () => {
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

      await adapter.searchMovies('test');
      adapter.clearCache();
      await adapter.searchMovies('test');

      // Should be called twice (cache was cleared)
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should clean expired cache entries', async () => {
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

      // Make a request to populate cache
      await adapter.searchMovies('test');

      // Mock expired cache by manipulating time
      const cleaned = adapter.cleanCache();

      // Should report 0 cleaned (cache not expired yet)
      expect(cleaned).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(adapter.searchMovies('test')).rejects.toThrow(
        'TMDB API error: 401 Unauthorized'
      );
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(adapter.searchMovies('test')).rejects.toThrow('Network error');
    });

    it('should handle malformed JSON', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(adapter.searchMovies('test')).rejects.toThrow('Invalid JSON');
    });
  });

  describe('Image URLs', () => {
    it('should generate image URL with default size', () => {
      const url = adapter.getImageUrl('/poster.jpg');
      expect(url).toBe('https://image.tmdb.org/t/p/w500/poster.jpg');
    });

    it('should generate image URL with custom size', () => {
      const url = adapter.getImageUrl('/poster.jpg', 'w780');
      expect(url).toBe('https://image.tmdb.org/t/p/w780/poster.jpg');
    });

    it('should handle null paths', () => {
      const url = adapter.getImageUrl(null);
      expect(url).toBeNull();
    });
  });

  describe('Data Transformation', () => {
    it('should transform movie data correctly', async () => {
      const mockResponse = {
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

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const results = await adapter.searchMovies('Fight Club');
      const movie = results[0]!;

      expect(movie).toMatchObject({
        id: 550,
        title: 'Fight Club',
        overview: 'A ticking-time-bomb insomniac...',
        mediaType: 'movie',
        genreIds: [18, 53],
        voteAverage: 8.4,
        voteCount: 26000,
        releaseDate: '1999-10-15',
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
        popularity: 123.45,
      });
    });

    it('should transform TV show data correctly', async () => {
      const mockResponse = {
        page: 1,
        results: [
          {
            id: 1396,
            name: 'Breaking Bad',
            overview: 'A high school chemistry teacher...',
            first_air_date: '2008-01-20',
            genre_ids: [18, 80],
            vote_average: 9.0,
            vote_count: 12000,
            popularity: 200.0,
            poster_path: '/poster.jpg',
            backdrop_path: '/backdrop.jpg',
            origin_country: ['US'],
            original_language: 'en',
            original_name: 'Breaking Bad',
          },
        ],
        total_pages: 1,
        total_results: 1,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const results = await adapter.searchTVShows('Breaking Bad');
      const show = results[0]!;

      expect(show).toMatchObject({
        id: 1396,
        title: 'Breaking Bad',
        overview: 'A high school chemistry teacher...',
        mediaType: 'tv',
        genreIds: [18, 80],
        voteAverage: 9.0,
        voteCount: 12000,
        releaseDate: '2008-01-20',
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
        popularity: 200.0,
      });
    });
  });
});

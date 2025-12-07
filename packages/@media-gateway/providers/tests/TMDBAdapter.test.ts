/**
 * TMDB Adapter Tests
 * Content source integration validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TMDBAdapter, createTMDBAdapter } from '../src/adapters/TMDBAdapter.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('TMDBAdapter', () => {
  const apiKey = 'test-api-key';
  let adapter: TMDBAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createTMDBAdapter({ apiKey });
  });

  describe('searchMovies', () => {
    it('should search movies and transform results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          page: 1,
          results: [
            {
              id: 123,
              title: 'Test Movie',
              overview: 'A test movie',
              release_date: '2024-01-15',
              genre_ids: [28, 12],
              vote_average: 7.5,
              vote_count: 1000,
              popularity: 100,
              poster_path: '/poster.jpg',
              backdrop_path: '/backdrop.jpg',
              adult: false,
              original_language: 'en',
              original_title: 'Test Movie',
            },
          ],
          total_pages: 1,
          total_results: 1,
        }),
      });

      const results = await adapter.searchMovies('test');

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(123);
      expect(results[0]!.title).toBe('Test Movie');
      expect(results[0]!.mediaType).toBe('movie');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/search/movie')
      );
    });

    it('should include API key in requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ page: 1, results: [], total_pages: 0, total_results: 0 }),
      });

      await adapter.searchMovies('test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`api_key=${apiKey}`)
      );
    });
  });

  describe('searchTVShows', () => {
    it('should search TV shows and transform results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          page: 1,
          results: [
            {
              id: 456,
              name: 'Test Show',
              overview: 'A test TV show',
              first_air_date: '2024-02-20',
              genre_ids: [18, 80],
              vote_average: 8.0,
              vote_count: 500,
              popularity: 80,
              poster_path: '/poster.jpg',
              backdrop_path: null,
              origin_country: ['US'],
              original_language: 'en',
              original_name: 'Test Show',
            },
          ],
          total_pages: 1,
          total_results: 1,
        }),
      });

      const results = await adapter.searchTVShows('test');

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe(456);
      expect(results[0]!.title).toBe('Test Show');
      expect(results[0]!.mediaType).toBe('tv');
    });
  });

  describe('getTrending', () => {
    it('should get trending content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          page: 1,
          results: [
            {
              id: 789,
              title: 'Trending Movie',
              overview: 'A trending movie',
              release_date: '2024-03-01',
              genre_ids: [28],
              vote_average: 9.0,
              vote_count: 5000,
              popularity: 500,
              poster_path: '/poster.jpg',
              backdrop_path: '/backdrop.jpg',
              adult: false,
              original_language: 'en',
              original_title: 'Trending Movie',
            },
          ],
          total_pages: 1,
          total_results: 1,
        }),
      });

      const results = await adapter.getTrending('movie', 'week');

      expect(results).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/trending/movie/week')
      );
    });
  });

  describe('discoverMovies', () => {
    it('should apply filters correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ page: 1, results: [], total_pages: 0, total_results: 0 }),
      });

      await adapter.discoverMovies({
        genres: [28, 12],
        yearMin: 2020,
        yearMax: 2024,
        ratingMin: 7,
        sortBy: 'vote_average.desc',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('with_genres=28%2C12')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('vote_average.gte=7')
      );
    });
  });

  describe('getWatchProviders', () => {
    it('should fetch watch providers for content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            US: {
              link: 'https://www.themoviedb.org/movie/123/watch',
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
        }),
      });

      const result = await adapter.getWatchProviders(123, 'movie');

      expect(result.results).toBeDefined();
      expect(result.results.US).toBeDefined();
      expect(result.results.US.flatrate).toHaveLength(1);
    });
  });

  describe('caching', () => {
    it('should cache results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          page: 1,
          results: [{ id: 1, title: 'Movie', overview: '', release_date: '', genre_ids: [], vote_average: 0, vote_count: 0, popularity: 0, poster_path: null, backdrop_path: null, adult: false, original_language: 'en', original_title: 'Movie' }],
          total_pages: 1,
          total_results: 1,
        }),
      });

      await adapter.searchMovies('cached query');
      await adapter.searchMovies('cached query');

      // Should only call fetch once due to caching
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should clear cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ page: 1, results: [], total_pages: 0, total_results: 0 }),
      });

      await adapter.searchMovies('query');
      adapter.clearCache();
      await adapter.searchMovies('query');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getImageUrl', () => {
    it('should generate correct image URL', () => {
      const url = adapter.getImageUrl('/poster.jpg', 'w500');
      expect(url).toBe('https://image.tmdb.org/t/p/w500/poster.jpg');
    });

    it('should return null for null path', () => {
      const url = adapter.getImageUrl(null);
      expect(url).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(adapter.searchMovies('test')).rejects.toThrow('TMDB API error');
    });
  });
});

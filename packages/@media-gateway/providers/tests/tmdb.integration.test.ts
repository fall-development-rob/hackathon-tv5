/**
 * TMDB Integration Tests
 * Tests real API calls to TMDB
 * Run with: TMDB_API_KEY=xxx npx vitest run --config vitest.config.ts tmdb.integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTMDBAdapter, createAvailabilityService } from '../src/index.js';

// Skip if no API key
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const describeWithKey = TMDB_API_KEY ? describe : describe.skip;

describeWithKey('TMDB Integration Tests', () => {
  const tmdb = createTMDBAdapter({ apiKey: TMDB_API_KEY! });
  const availability = createAvailabilityService({ tmdbApiKey: TMDB_API_KEY });

  describe('Search', () => {
    it('should search for movies', async () => {
      const results = await tmdb.searchMovies('The Matrix');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Matrix');
      expect(results[0].mediaType).toBe('movie');
    });

    it('should search for TV shows', async () => {
      const results = await tmdb.searchTVShows('Breaking Bad');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Breaking Bad');
      expect(results[0].mediaType).toBe('tv');
    });

    it('should return empty array for nonsense query', async () => {
      const results = await tmdb.searchMovies('xyznonexistent123456');
      expect(results).toEqual([]);
    });
  });

  describe('Trending', () => {
    it('should get trending movies', async () => {
      const trending = await tmdb.getTrending('movie', 'week');

      expect(trending.length).toBeGreaterThan(0);
      expect(trending[0].mediaType).toBe('movie');
      expect(trending[0].popularity).toBeGreaterThan(0);
    });

    it('should get trending TV shows', async () => {
      const trending = await tmdb.getTrending('tv', 'day');

      expect(trending.length).toBeGreaterThan(0);
      expect(trending[0].mediaType).toBe('tv');
    });
  });

  describe('Discover', () => {
    it('should discover movies by genre', async () => {
      const sciFi = await tmdb.discoverMovies({ genres: [878] }); // Sci-Fi

      expect(sciFi.length).toBeGreaterThan(0);
      expect(sciFi[0].genreIds).toContain(878);
    });

    it('should filter by year and rating', async () => {
      const movies = await tmdb.discoverMovies({
        yearMin: 2020,
        ratingMin: 8,
      });

      expect(movies.length).toBeGreaterThan(0);
      movies.forEach(movie => {
        expect(new Date(movie.releaseDate).getFullYear()).toBeGreaterThanOrEqual(2020);
        expect(movie.voteAverage).toBeGreaterThanOrEqual(8);
      });
    });
  });

  describe('Availability', () => {
    it('should get watch providers for a movie', async () => {
      const movies = await tmdb.searchMovies('Inception');
      const inception = movies[0];

      expect(inception).toBeDefined();

      const providers = await tmdb.getWatchProviders(inception.id, 'movie');
      expect(providers.results).toBeDefined();
      // US should have providers for a popular movie
      expect(providers.results['US']).toBeDefined();
    });

    it('should use availability service', async () => {
      const movies = await tmdb.searchMovies('The Dark Knight');
      const movie = movies[0];

      expect(movie).toBeDefined();

      const availData = await availability.getAvailability(movie);
      expect(availData.contentId).toBe(movie.id);
      expect(availData.region).toBe('US');
      expect(availData.platforms).toBeDefined();
    });
  });

  describe('Similar & Recommendations', () => {
    it('should get similar movies', async () => {
      const movies = await tmdb.searchMovies('Inception');
      const similar = await tmdb.getSimilar(movies[0].id, 'movie');

      expect(similar.length).toBeGreaterThan(0);
    });

    it('should get recommendations', async () => {
      const movies = await tmdb.searchMovies('The Matrix');
      const recs = await tmdb.getRecommendations(movies[0].id, 'movie');

      expect(recs.length).toBeGreaterThan(0);
    });
  });

  afterAll(() => {
    tmdb.clearCache();
    availability.clearCache();
  });
});

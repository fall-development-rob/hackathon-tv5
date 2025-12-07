/**
 * Search Route Tests
 * Tests natural language content search endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server';

describe('Search Route - /v1/search', () => {
  describe('GET /v1/search', () => {
    it('should return search results with valid query', async () => {
      const response = await request(app)
        .get('/v1/search')
        .query({ q: 'action movies' })
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body).toHaveProperty('query');
      expect(response.body.results).toBeInstanceOf(Array);
      expect(response.body.pagination).toMatchObject({
        total: expect.any(Number),
        limit: expect.any(Number),
        offset: expect.any(Number),
        hasMore: expect.any(Boolean),
      });
    });

    it('should filter by mediaType', async () => {
      const response = await request(app)
        .get('/v1/search')
        .query({ q: 'thriller', mediaType: 'movie' })
        .expect(200);

      expect(response.body.query.filters).toMatchObject({
        mediaType: 'movie',
      });
    });

    it('should filter by genre', async () => {
      const response = await request(app)
        .get('/v1/search')
        .query({ q: 'drama', genre: 'Romance' })
        .expect(200);

      expect(response.body.query.filters).toMatchObject({
        genre: 'Romance',
      });
    });

    it('should filter by year', async () => {
      const response = await request(app)
        .get('/v1/search')
        .query({ q: 'movies', year: 2024 })
        .expect(200);

      expect(response.body.query.filters).toMatchObject({
        year: 2024,
      });
    });

    it('should filter by minimum rating', async () => {
      const response = await request(app)
        .get('/v1/search')
        .query({ q: 'best movies', rating: 8.0 })
        .expect(200);

      expect(response.body.query.filters).toMatchObject({
        rating: 8.0,
      });
    });

    it('should apply pagination with limit and offset', async () => {
      const response = await request(app)
        .get('/v1/search')
        .query({ q: 'movies', limit: 10, offset: 5 })
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        limit: 10,
        offset: 5,
      });
    });

    it('should use default limit if not provided', async () => {
      const response = await request(app)
        .get('/v1/search')
        .query({ q: 'movies' })
        .expect(200);

      expect(response.body.pagination.limit).toBe(20);
    });

    it('should return 400 for missing query parameter', async () => {
      const response = await request(app)
        .get('/v1/search')
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
    });

    it('should return 400 for invalid mediaType', async () => {
      const response = await request(app)
        .get('/v1/search')
        .query({ q: 'movies', mediaType: 'invalid' })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
    });

    it('should return 400 for invalid year', async () => {
      const response = await request(app)
        .get('/v1/search')
        .query({ q: 'movies', year: 1800 })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for rating out of range', async () => {
      const response = await request(app)
        .get('/v1/search')
        .query({ q: 'movies', rating: 15 })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for limit exceeding maximum', async () => {
      const response = await request(app)
        .get('/v1/search')
        .query({ q: 'movies', limit: 200 })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for negative offset', async () => {
      const response = await request(app)
        .get('/v1/search')
        .query({ q: 'movies', offset: -5 })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should include availability data in results', async () => {
      const response = await request(app)
        .get('/v1/search')
        .query({ q: 'movies' })
        .expect(200);

      if (response.body.results.length > 0) {
        expect(response.body.results[0]).toHaveProperty('availability');
        expect(response.body.results[0].availability).toBeInstanceOf(Array);
      }
    });

    it('should respect rate limiting', async () => {
      // Make multiple rapid requests to trigger rate limit
      const requests = Array(25).fill(null).map(() =>
        request(app).get('/v1/search').query({ q: 'test' })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);

      expect(rateLimited).toBe(true);
    });
  });
});

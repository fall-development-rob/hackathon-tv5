/**
 * Rate Limit Middleware Tests
 * Tests rate limiting behavior for different endpoints
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/server';

describe('Rate Limit Middleware', () => {
  describe('General API Rate Limit', () => {
    it('should allow requests within rate limit', async () => {
      const responses = await Promise.all(
        Array(10).fill(null).map(() =>
          request(app).get('/v1/content/test-id')
        )
      );

      responses.forEach(response => {
        expect(response.status).not.toBe(429);
      });
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/v1/content/test-id');

      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
      expect(response.headers).toHaveProperty('ratelimit-reset');
    });

    it('should return 429 when rate limit exceeded', async () => {
      // This test makes many requests - may need adjustment based on actual limits
      const requests = Array(105).fill(null).map(() =>
        request(app).get('/v1/content/test-' + Math.random())
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should include retry information in rate limit response', async () => {
      // Trigger rate limit
      const requests = Array(105).fill(null).map(() =>
        request(app).get('/v1/content/test-' + Math.random())
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find(r => r.status === 429);

      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body).toMatchObject({
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          details: expect.objectContaining({
            retryAfter: expect.any(String),
          }),
        });
      }
    });
  });

  describe('Search Rate Limit', () => {
    it('should apply stricter limit to search endpoint', async () => {
      const requests = Array(25).fill(null).map(() =>
        request(app).get('/v1/search').query({ q: 'test-' + Math.random() })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);

      // Search should have more restrictive limit (20 per minute)
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should return specific search rate limit error', async () => {
      const requests = Array(25).fill(null).map(() =>
        request(app).get('/v1/search').query({ q: 'test-' + Math.random() })
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find(r => r.status === 429);

      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body).toMatchObject({
          error: 'Too many search requests',
          code: 'SEARCH_RATE_LIMIT_EXCEEDED',
        });
      }
    });
  });

  describe('Write Operations Rate Limit', () => {
    it('should apply rate limit to write operations', async () => {
      const requests = Array(55).fill(null).map((_, i) =>
        request(app)
          .post('/v1/watch-history')
          .send({
            userId: 'user-' + i,
            contentId: 'content-' + i,
            watchedSeconds: 3600,
            completionRate: 0.85,
          })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should return write rate limit error', async () => {
      const requests = Array(55).fill(null).map((_, i) =>
        request(app)
          .post('/v1/ratings')
          .send({
            userId: 'user-' + i,
            contentId: 'content-' + i,
            rating: 8.0,
          })
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find(r => r.status === 429);

      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body).toMatchObject({
          error: 'Too many write requests',
          code: 'WRITE_RATE_LIMIT_EXCEEDED',
        });
      }
    });
  });

  describe('Rate Limit Recovery', () => {
    it('should use standard headers format', async () => {
      const response = await request(app)
        .get('/v1/content/test-id');

      // Should use standard RateLimit headers
      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');

      // Should not use legacy X-RateLimit headers
      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
    });
  });
});

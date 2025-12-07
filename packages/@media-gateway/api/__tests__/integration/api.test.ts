/**
 * Integration Tests
 * Tests end-to-end API workflows and scenarios
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/server';

describe('API Integration Tests', () => {
  describe('User Journey: Content Discovery and Rating', () => {
    let userId: string;
    let contentId: string;

    beforeAll(() => {
      userId = 'integration-user-' + Date.now();
      contentId = 'integration-content-' + Date.now();
    });

    it('should complete full content discovery workflow', async () => {
      // Step 1: Search for content
      const searchResponse = await request(app)
        .get('/v1/search')
        .query({ q: 'action thriller', mediaType: 'movie' })
        .expect(200);

      expect(searchResponse.body.results).toBeInstanceOf(Array);
      expect(searchResponse.body.results.length).toBeGreaterThan(0);

      // Step 2: Get detailed content information
      const content = searchResponse.body.results[0];
      const contentResponse = await request(app)
        .get(`/v1/content/${content.id}`)
        .query({ include: 'availability,similar,reviews' })
        .expect(200);

      expect(contentResponse.body).toHaveProperty('availability');
      expect(contentResponse.body).toHaveProperty('similar');
      expect(contentResponse.body).toHaveProperty('reviews');

      // Step 3: Check platform availability
      const availabilityResponse = await request(app)
        .get(`/v1/availability/${content.id}`)
        .query({ region: 'US' })
        .expect(200);

      expect(availabilityResponse.body.platforms).toBeInstanceOf(Array);
      expect(availabilityResponse.body.platforms.length).toBeGreaterThan(0);

      // Step 4: Log watch history
      const watchResponse = await request(app)
        .post('/v1/watch-history')
        .send({
          userId,
          contentId: content.id,
          watchedSeconds: 7200,
          completionRate: 0.95,
        })
        .expect(201);

      expect(watchResponse.body.success).toBe(true);
      expect(watchResponse.body.preferencesUpdated).toBe(true);

      // Step 5: Submit rating
      const ratingResponse = await request(app)
        .post('/v1/ratings')
        .send({
          userId,
          contentId: content.id,
          rating: 9.0,
          review: 'Excellent movie!',
        })
        .expect(201);

      expect(ratingResponse.body.success).toBe(true);
      expect(ratingResponse.body.ratingId).toBeDefined();

      // Step 6: Get personalized recommendations
      const recResponse = await request(app)
        .get('/v1/recommendations')
        .query({ userId, mood: 'excited', limit: 10 })
        .expect(200);

      expect(recResponse.body.recommendations).toBeInstanceOf(Array);
      expect(recResponse.body.metadata.userId).toBe(userId);
    });
  });

  describe('User Journey: Group Viewing Session', () => {
    let groupId: string;
    let users: string[];

    beforeAll(() => {
      groupId = 'group-' + Date.now();
      users = [
        'user-1-' + Date.now(),
        'user-2-' + Date.now(),
        'user-3-' + Date.now(),
      ];
    });

    it('should handle group viewing workflow', async () => {
      // Step 1: Search for group-friendly content
      const searchResponse = await request(app)
        .get('/v1/search')
        .query({ q: 'family comedy', mediaType: 'movie' })
        .expect(200);

      const content = searchResponse.body.results[0];

      // Step 2: Multiple users rate content
      const ratingPromises = users.map(userId =>
        request(app)
          .post('/v1/ratings')
          .send({
            userId,
            contentId: content.id,
            rating: 7.5 + Math.random() * 2,
          })
      );

      const ratingResponses = await Promise.all(ratingPromises);
      ratingResponses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Step 3: Get recommendations for each user
      const recPromises = users.map(userId =>
        request(app)
          .get('/v1/recommendations')
          .query({ userId, context: 'family', limit: 5 })
      );

      const recResponses = await Promise.all(recPromises);
      recResponses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.recommendations.length).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle cascading validation errors gracefully', async () => {
      // Invalid search query
      const searchResponse = await request(app)
        .get('/v1/search')
        .query({ q: '', rating: 15 })
        .expect(400);

      expect(searchResponse.body.code).toBe('VALIDATION_ERROR');
      expect(searchResponse.body.details).toBeInstanceOf(Array);

      // Invalid content request
      const contentResponse = await request(app)
        .get('/v1/content/')
        .expect(404);

      expect(contentResponse.body.code).toBe('NOT_FOUND');

      // Invalid rating submission
      const ratingResponse = await request(app)
        .post('/v1/ratings')
        .send({
          userId: 'user-123',
          contentId: 'content-456',
          rating: -5,
        })
        .expect(400);

      expect(ratingResponse.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Cross-Endpoint Data Consistency', () => {
    it('should maintain data consistency across endpoints', async () => {
      const testContentId = 'consistency-test-' + Date.now();

      // Get content details
      const contentResponse = await request(app)
        .get(`/v1/content/${testContentId}`)
        .query({ include: 'availability' })
        .expect(200);

      // Get availability separately
      const availabilityResponse = await request(app)
        .get(`/v1/availability/${testContentId}`)
        .expect(200);

      // Both should return data for same content
      expect(contentResponse.body.id).toBe(testContentId);
      expect(availabilityResponse.body.contentId).toBe(testContentId);

      // Platform data should be consistent
      if (contentResponse.body.availability && availabilityResponse.body.platforms) {
        expect(contentResponse.body.availability.length).toBeGreaterThan(0);
        expect(availabilityResponse.body.platforms.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();

      // Simulate 20 concurrent users searching
      const searchPromises = Array(20).fill(null).map((_, i) =>
        request(app)
          .get('/v1/search')
          .query({ q: `query-${i}`, limit: 10 })
      );

      const responses = await Promise.all(searchPromises);

      const duration = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });

      // Should complete reasonably fast (adjust threshold as needed)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle mixed read/write operations', async () => {
      const userId = 'perf-user-' + Date.now();

      // Mix of reads and writes
      const operations = [
        request(app).get('/v1/search').query({ q: 'action' }),
        request(app).get('/v1/recommendations').query({ userId, limit: 5 }),
        request(app).post('/v1/watch-history').send({
          userId,
          contentId: 'content-1',
          watchedSeconds: 1800,
          completionRate: 0.5,
        }),
        request(app).get('/v1/content/content-1'),
        request(app).post('/v1/ratings').send({
          userId,
          contentId: 'content-1',
          rating: 8.0,
        }),
        request(app).get('/v1/availability/content-1'),
      ];

      const responses = await Promise.all(operations);

      // Check success rates (accounting for potential rate limits)
      const successful = responses.filter(r => r.status < 400);
      expect(successful.length).toBeGreaterThan(0);
    });
  });

  describe('API Documentation', () => {
    it('should serve API documentation', async () => {
      const response = await request(app)
        .get('/v1/docs')
        .expect(301); // Redirect to docs page

      expect(response.headers.location).toContain('/v1/docs/');
    });

    it('should serve OpenAPI spec', async () => {
      const response = await request(app)
        .get('/v1/openapi.json')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toHaveProperty('openapi');
      expect(response.body).toHaveProperty('paths');
      expect(response.body).toHaveProperty('info');
    });
  });

  describe('Health and Status', () => {
    it('should return API information at root', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'ARW Media Gateway API',
        version: expect.any(String),
        description: expect.any(String),
        documentation: '/v1/docs',
        endpoints: expect.any(Object),
      });
    });
  });

  describe('Content Type Handling', () => {
    it('should handle JSON content type', async () => {
      const response = await request(app)
        .post('/v1/ratings')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({
          userId: 'user-123',
          contentId: 'content-456',
          rating: 8.0,
        }))
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should reject invalid content types for POST', async () => {
      const response = await request(app)
        .post('/v1/ratings')
        .set('Content-Type', 'text/plain')
        .send('invalid data');

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/v1/search')
        .query({ q: 'test' })
        .set('Origin', 'http://example.com');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should include security headers', async () => {
      const response = await request(app)
        .get('/');

      // Helmet security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Pagination Consistency', () => {
    it('should handle pagination correctly across pages', async () => {
      // First page
      const page1 = await request(app)
        .get('/v1/search')
        .query({ q: 'movies', limit: 5, offset: 0 })
        .expect(200);

      expect(page1.body.pagination).toMatchObject({
        limit: 5,
        offset: 0,
      });

      // Second page
      const page2 = await request(app)
        .get('/v1/search')
        .query({ q: 'movies', limit: 5, offset: 5 })
        .expect(200);

      expect(page2.body.pagination).toMatchObject({
        limit: 5,
        offset: 5,
      });
    });
  });

  describe('Filter Combination', () => {
    it('should handle multiple filters correctly', async () => {
      const response = await request(app)
        .get('/v1/search')
        .query({
          q: 'thriller',
          mediaType: 'movie',
          genre: 'Action',
          year: 2024,
          rating: 7.0,
          limit: 10,
        })
        .expect(200);

      expect(response.body.query.filters).toMatchObject({
        mediaType: 'movie',
        genre: 'Action',
        year: 2024,
        rating: 7.0,
      });
    });
  });
});

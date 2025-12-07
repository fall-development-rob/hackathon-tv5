/**
 * Recommendations Route Tests
 * Tests personalized content recommendation endpoint
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/server';

describe('Recommendations Route - /v1/recommendations', () => {
  describe('GET /v1/recommendations', () => {
    it('should return personalized recommendations', async () => {
      const response = await request(app)
        .get('/v1/recommendations')
        .query({ userId: 'user-123' })
        .expect(200);

      expect(response.body).toHaveProperty('recommendations');
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.recommendations).toBeInstanceOf(Array);
      expect(response.body.metadata).toMatchObject({
        userId: 'user-123',
        generatedAt: expect.any(String),
        algorithm: expect.any(String),
      });
    });

    it('should include match score and reasoning', async () => {
      const response = await request(app)
        .get('/v1/recommendations')
        .query({ userId: 'user-123' })
        .expect(200);

      if (response.body.recommendations.length > 0) {
        const rec = response.body.recommendations[0];
        expect(rec).toHaveProperty('matchScore');
        expect(rec).toHaveProperty('reasoning');
        expect(rec.matchScore).toBeGreaterThanOrEqual(0);
        expect(rec.matchScore).toBeLessThanOrEqual(1);
        expect(rec.reasoning).toBeInstanceOf(Array);
      }
    });

    it('should filter by mood', async () => {
      const response = await request(app)
        .get('/v1/recommendations')
        .query({ userId: 'user-123', mood: 'relaxed' })
        .expect(200);

      expect(response.body.metadata).toMatchObject({
        mood: 'relaxed',
      });
    });

    it('should filter by context', async () => {
      const response = await request(app)
        .get('/v1/recommendations')
        .query({ userId: 'user-123', context: 'family' })
        .expect(200);

      expect(response.body.metadata).toMatchObject({
        context: 'family',
      });
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/v1/recommendations')
        .query({ userId: 'user-123', limit: 5 })
        .expect(200);

      expect(response.body.recommendations.length).toBeLessThanOrEqual(5);
    });

    it('should use default limit of 10', async () => {
      const response = await request(app)
        .get('/v1/recommendations')
        .query({ userId: 'user-123' })
        .expect(200);

      expect(response.body.recommendations.length).toBeLessThanOrEqual(10);
    });

    it('should return 400 for missing userId', async () => {
      const response = await request(app)
        .get('/v1/recommendations')
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
      });
    });

    it('should return 400 for invalid mood', async () => {
      const response = await request(app)
        .get('/v1/recommendations')
        .query({ userId: 'user-123', mood: 'invalid' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid context', async () => {
      const response = await request(app)
        .get('/v1/recommendations')
        .query({ userId: 'user-123', context: 'invalid' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for limit exceeding maximum', async () => {
      const response = await request(app)
        .get('/v1/recommendations')
        .query({ userId: 'user-123', limit: 100 })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for limit less than 1', async () => {
      const response = await request(app)
        .get('/v1/recommendations')
        .query({ userId: 'user-123', limit: 0 })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should include availability in recommendations', async () => {
      const response = await request(app)
        .get('/v1/recommendations')
        .query({ userId: 'user-123' })
        .expect(200);

      if (response.body.recommendations.length > 0) {
        expect(response.body.recommendations[0]).toHaveProperty('availability');
        expect(response.body.recommendations[0].availability).toBeInstanceOf(Array);
      }
    });

    it('should handle multiple moods and contexts', async () => {
      const moods = ['relaxed', 'excited', 'thoughtful', 'social', 'adventurous'];
      const contexts = ['solo', 'family', 'date', 'party', 'background'];

      for (const mood of moods) {
        const response = await request(app)
          .get('/v1/recommendations')
          .query({ userId: 'user-123', mood })
          .expect(200);

        expect(response.body.metadata.mood).toBe(mood);
      }

      for (const context of contexts) {
        const response = await request(app)
          .get('/v1/recommendations')
          .query({ userId: 'user-123', context })
          .expect(200);

        expect(response.body.metadata.context).toBe(context);
      }
    });
  });
});

/**
 * User Route Tests
 * Tests watch history and ratings endpoints
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/server';

describe('User Routes', () => {
  describe('POST /v1/watch-history', () => {
    it('should log watch history successfully', async () => {
      const watchData = {
        userId: 'user-123',
        contentId: 'content-456',
        watchedSeconds: 3600,
        completionRate: 0.85,
      };

      const response = await request(app)
        .post('/v1/watch-history')
        .send(watchData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        watchHistoryId: expect.any(String),
        preferencesUpdated: expect.any(Boolean),
        message: expect.any(String),
        data: {
          userId: watchData.userId,
          contentId: watchData.contentId,
          watchedSeconds: watchData.watchedSeconds,
          completionRate: watchData.completionRate,
        },
      });
    });

    it('should update preferences for high completion rate', async () => {
      const watchData = {
        userId: 'user-123',
        contentId: 'content-456',
        watchedSeconds: 7000,
        completionRate: 0.95,
      };

      const response = await request(app)
        .post('/v1/watch-history')
        .send(watchData)
        .expect(201);

      expect(response.body.preferencesUpdated).toBe(true);
      expect(response.body.message).toContain('preferences updated');
    });

    it('should not update preferences for low completion rate', async () => {
      const watchData = {
        userId: 'user-123',
        contentId: 'content-456',
        watchedSeconds: 600,
        completionRate: 0.15,
      };

      const response = await request(app)
        .post('/v1/watch-history')
        .send(watchData)
        .expect(201);

      expect(response.body.preferencesUpdated).toBe(false);
    });

    it('should include timestamp if provided', async () => {
      const timestamp = new Date().toISOString();
      const watchData = {
        userId: 'user-123',
        contentId: 'content-456',
        watchedSeconds: 3600,
        completionRate: 0.85,
        timestamp,
      };

      const response = await request(app)
        .post('/v1/watch-history')
        .send(watchData)
        .expect(201);

      expect(response.body.data.timestamp).toBe(timestamp);
    });

    it('should auto-generate timestamp if not provided', async () => {
      const watchData = {
        userId: 'user-123',
        contentId: 'content-456',
        watchedSeconds: 3600,
        completionRate: 0.85,
      };

      const response = await request(app)
        .post('/v1/watch-history')
        .send(watchData)
        .expect(201);

      expect(response.body.data.timestamp).toBeDefined();
      expect(new Date(response.body.data.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should return 400 for missing userId', async () => {
      const response = await request(app)
        .post('/v1/watch-history')
        .send({
          contentId: 'content-456',
          watchedSeconds: 3600,
          completionRate: 0.85,
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for negative watchedSeconds', async () => {
      const response = await request(app)
        .post('/v1/watch-history')
        .send({
          userId: 'user-123',
          contentId: 'content-456',
          watchedSeconds: -100,
          completionRate: 0.85,
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for completionRate out of range', async () => {
      const response = await request(app)
        .post('/v1/watch-history')
        .send({
          userId: 'user-123',
          contentId: 'content-456',
          watchedSeconds: 3600,
          completionRate: 1.5,
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /v1/ratings', () => {
    it('should submit rating successfully', async () => {
      const ratingData = {
        userId: 'user-123',
        contentId: 'content-456',
        rating: 8.5,
      };

      const response = await request(app)
        .post('/v1/ratings')
        .send(ratingData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        ratingId: expect.any(String),
        message: 'Rating submitted successfully',
        data: {
          userId: ratingData.userId,
          contentId: ratingData.contentId,
          rating: ratingData.rating,
        },
      });
    });

    it('should accept rating with review', async () => {
      const ratingData = {
        userId: 'user-123',
        contentId: 'content-456',
        rating: 9.0,
        review: 'Amazing movie! Highly recommended.',
      };

      const response = await request(app)
        .post('/v1/ratings')
        .send(ratingData)
        .expect(201);

      expect(response.body.data).toMatchObject({
        rating: ratingData.rating,
        review: ratingData.review,
      });
    });

    it('should handle rating without review', async () => {
      const ratingData = {
        userId: 'user-123',
        contentId: 'content-456',
        rating: 7.5,
      };

      const response = await request(app)
        .post('/v1/ratings')
        .send(ratingData)
        .expect(201);

      expect(response.body.data.review).toBeNull();
    });

    it('should accept minimum rating of 0', async () => {
      const response = await request(app)
        .post('/v1/ratings')
        .send({
          userId: 'user-123',
          contentId: 'content-456',
          rating: 0,
        })
        .expect(201);

      expect(response.body.data.rating).toBe(0);
    });

    it('should accept maximum rating of 10', async () => {
      const response = await request(app)
        .post('/v1/ratings')
        .send({
          userId: 'user-123',
          contentId: 'content-456',
          rating: 10,
        })
        .expect(201);

      expect(response.body.data.rating).toBe(10);
    });

    it('should return 400 for rating below 0', async () => {
      const response = await request(app)
        .post('/v1/ratings')
        .send({
          userId: 'user-123',
          contentId: 'content-456',
          rating: -1,
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for rating above 10', async () => {
      const response = await request(app)
        .post('/v1/ratings')
        .send({
          userId: 'user-123',
          contentId: 'content-456',
          rating: 11,
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for review exceeding max length', async () => {
      const longReview = 'a'.repeat(1001);
      const response = await request(app)
        .post('/v1/ratings')
        .send({
          userId: 'user-123',
          contentId: 'content-456',
          rating: 8.0,
          review: longReview,
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing userId', async () => {
      const response = await request(app)
        .post('/v1/ratings')
        .send({
          contentId: 'content-456',
          rating: 8.0,
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing contentId', async () => {
      const response = await request(app)
        .post('/v1/ratings')
        .send({
          userId: 'user-123',
          rating: 8.0,
        })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should include custom timestamp if provided', async () => {
      const timestamp = new Date().toISOString();
      const response = await request(app)
        .post('/v1/ratings')
        .send({
          userId: 'user-123',
          contentId: 'content-456',
          rating: 8.0,
          timestamp,
        })
        .expect(201);

      expect(response.body.data.timestamp).toBe(timestamp);
    });

    it('should respect rate limiting on write operations', async () => {
      const requests = Array(55).fill(null).map(() =>
        request(app)
          .post('/v1/ratings')
          .send({
            userId: 'user-123',
            contentId: 'content-456',
            rating: 8.0,
          })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);

      expect(rateLimited).toBe(true);
    });
  });
});

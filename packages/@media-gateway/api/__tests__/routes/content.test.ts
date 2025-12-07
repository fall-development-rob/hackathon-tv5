/**
 * Content Route Tests
 * Tests content metadata retrieval endpoint
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/server';

describe('Content Route - /v1/content/:id', () => {
  describe('GET /v1/content/:id', () => {
    it('should return content metadata', async () => {
      const response = await request(app)
        .get('/v1/content/content-123')
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'content-123',
        title: expect.any(String),
        mediaType: expect.any(String),
        year: expect.any(Number),
        genre: expect.any(Array),
        rating: expect.any(Number),
        duration: expect.any(Number),
        description: expect.any(String),
      });
    });

    it('should include cast and crew information', async () => {
      const response = await request(app)
        .get('/v1/content/content-123')
        .expect(200);

      expect(response.body).toHaveProperty('cast');
      expect(response.body).toHaveProperty('crew');
      expect(response.body.cast).toBeInstanceOf(Array);
      expect(response.body.crew).toBeInstanceOf(Array);
    });

    it('should include metadata', async () => {
      const response = await request(app)
        .get('/v1/content/content-123')
        .expect(200);

      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toMatchObject({
        language: expect.any(String),
        country: expect.any(String),
        certification: expect.any(String),
      });
    });

    it('should conditionally include availability', async () => {
      const response = await request(app)
        .get('/v1/content/content-123')
        .query({ include: 'availability' })
        .expect(200);

      expect(response.body).toHaveProperty('availability');
      expect(response.body.availability).toBeInstanceOf(Array);

      if (response.body.availability.length > 0) {
        expect(response.body.availability[0]).toMatchObject({
          platform: expect.any(String),
          region: expect.any(String),
          type: expect.any(String),
          deepLink: expect.any(String),
        });
      }
    });

    it('should conditionally include similar content', async () => {
      const response = await request(app)
        .get('/v1/content/content-123')
        .query({ include: 'similar' })
        .expect(200);

      expect(response.body).toHaveProperty('similar');
      expect(response.body.similar).toBeInstanceOf(Array);

      if (response.body.similar.length > 0) {
        expect(response.body.similar[0]).toMatchObject({
          id: expect.any(String),
          title: expect.any(String),
          similarityScore: expect.any(Number),
        });
      }
    });

    it('should conditionally include reviews', async () => {
      const response = await request(app)
        .get('/v1/content/content-123')
        .query({ include: 'reviews' })
        .expect(200);

      expect(response.body).toHaveProperty('reviews');
      expect(response.body.reviews).toHaveProperty('aggregate');
      expect(response.body.reviews).toHaveProperty('recent');
      expect(response.body.reviews.aggregate).toMatchObject({
        averageRating: expect.any(Number),
        count: expect.any(Number),
        distribution: expect.any(Object),
      });
    });

    it('should include multiple includes', async () => {
      const response = await request(app)
        .get('/v1/content/content-123')
        .query({ include: 'availability,similar,reviews' })
        .expect(200);

      expect(response.body).toHaveProperty('availability');
      expect(response.body).toHaveProperty('similar');
      expect(response.body).toHaveProperty('reviews');
    });

    it('should handle empty include parameter', async () => {
      const response = await request(app)
        .get('/v1/content/content-123')
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should return 404 for invalid content ID format', async () => {
      const response = await request(app)
        .get('/v1/content/')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Resource not found',
        code: 'NOT_FOUND',
      });
    });

    it('should validate content exists', async () => {
      const response = await request(app)
        .get('/v1/content/valid-id-123')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBe('valid-id-123');
    });

    it('should handle pricing information in availability', async () => {
      const response = await request(app)
        .get('/v1/content/content-123')
        .query({ include: 'availability' })
        .expect(200);

      const rentOption = response.body.availability?.find((a: any) => a.type === 'rent');
      if (rentOption) {
        expect(rentOption.price).toMatchObject({
          amount: expect.any(Number),
          currency: expect.any(String),
        });
      }
    });

    it('should handle null prices for subscription services', async () => {
      const response = await request(app)
        .get('/v1/content/content-123')
        .query({ include: 'availability' })
        .expect(200);

      const subOption = response.body.availability?.find((a: any) => a.type === 'subscription');
      if (subOption) {
        expect(subOption.price).toBeNull();
      }
    });
  });
});

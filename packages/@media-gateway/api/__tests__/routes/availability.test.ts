/**
 * Availability Route Tests
 * Tests platform availability checking endpoint
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/server';

describe('Availability Route - /v1/availability/:contentId', () => {
  describe('GET /v1/availability/:contentId', () => {
    it('should return platform availability for content', async () => {
      const response = await request(app)
        .get('/v1/availability/content-123')
        .expect(200);

      expect(response.body).toMatchObject({
        contentId: 'content-123',
        region: expect.any(String),
        platforms: expect.any(Array),
        lastUpdated: expect.any(String),
        metadata: expect.any(Object),
      });
    });

    it('should include platform details', async () => {
      const response = await request(app)
        .get('/v1/availability/content-123')
        .expect(200);

      expect(response.body.platforms.length).toBeGreaterThan(0);

      const platform = response.body.platforms[0];
      expect(platform).toMatchObject({
        platform: expect.any(String),
        platformId: expect.any(String),
        type: expect.any(String),
        deepLink: expect.any(String),
        quality: expect.any(Array),
        available: expect.any(Boolean),
      });
    });

    it('should filter by region', async () => {
      const response = await request(app)
        .get('/v1/availability/content-123')
        .query({ region: 'UK' })
        .expect(200);

      expect(response.body.region).toBe('UK');
    });

    it('should use default region US', async () => {
      const response = await request(app)
        .get('/v1/availability/content-123')
        .expect(200);

      expect(response.body.region).toBe('US');
    });

    it('should include metadata with availability stats', async () => {
      const response = await request(app)
        .get('/v1/availability/content-123')
        .expect(200);

      expect(response.body.metadata).toMatchObject({
        totalPlatforms: expect.any(Number),
        subscriptionOptions: expect.any(Number),
        rentOptions: expect.any(Number),
        buyOptions: expect.any(Number),
      });
    });

    it('should include pricing for paid options', async () => {
      const response = await request(app)
        .get('/v1/availability/content-123')
        .expect(200);

      const rentOption = response.body.platforms.find((p: any) => p.type === 'rent');
      if (rentOption && rentOption.price) {
        expect(rentOption.price).toMatchObject({
          amount: expect.any(Number),
          currency: expect.any(String),
        });
      }
    });

    it('should have null price for subscription platforms', async () => {
      const response = await request(app)
        .get('/v1/availability/content-123')
        .expect(200);

      const subOption = response.body.platforms.find((p: any) => p.type === 'subscription');
      if (subOption) {
        expect(subOption.price).toBeNull();
      }
    });

    it('should include quality options', async () => {
      const response = await request(app)
        .get('/v1/availability/content-123')
        .expect(200);

      const platform = response.body.platforms[0];
      expect(platform.quality).toBeInstanceOf(Array);
      expect(platform.quality.length).toBeGreaterThan(0);
    });

    it('should include deep links', async () => {
      const response = await request(app)
        .get('/v1/availability/content-123')
        .expect(200);

      const platform = response.body.platforms[0];
      expect(platform.deepLink).toMatch(/^https?:\/\//);
    });

    it('should include availableUntil for temporary availability', async () => {
      const response = await request(app)
        .get('/v1/availability/content-123')
        .expect(200);

      const tempPlatform = response.body.platforms.find((p: any) => p.availableUntil);
      if (tempPlatform) {
        expect(tempPlatform.availableUntil).toMatch(/^\d{4}-\d{2}-\d{2}/);
      }
    });

    it('should return 400 for invalid region format', async () => {
      const response = await request(app)
        .get('/v1/availability/content-123')
        .query({ region: 'USA' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing content ID', async () => {
      const response = await request(app)
        .get('/v1/availability/')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Resource not found',
        code: 'NOT_FOUND',
      });
    });

    it('should categorize availability types correctly', async () => {
      const response = await request(app)
        .get('/v1/availability/content-123')
        .expect(200);

      const types = ['subscription', 'rent', 'buy', 'free'];
      response.body.platforms.forEach((platform: any) => {
        expect(types).toContain(platform.type);
      });
    });

    it('should include rental period for rent type', async () => {
      const response = await request(app)
        .get('/v1/availability/content-123')
        .expect(200);

      const rentOption = response.body.platforms.find((p: any) => p.type === 'rent');
      if (rentOption?.price) {
        expect(rentOption.price).toHaveProperty('rentalPeriod');
      }
    });

    it('should include lastUpdated timestamp', async () => {
      const response = await request(app)
        .get('/v1/availability/content-123')
        .expect(200);

      expect(response.body.lastUpdated).toBeDefined();
      expect(new Date(response.body.lastUpdated).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});

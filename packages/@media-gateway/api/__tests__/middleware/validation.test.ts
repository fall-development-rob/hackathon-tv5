/**
 * Validation Middleware Tests
 * Tests request validation middleware
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  validateQuery,
  validateBody,
  validateParams,
} from '../../src/middleware/validation';
import { createMockRequest, createMockResponse, createMockNext } from '../helpers/mocks';

describe('Validation Middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext();
  });

  describe('validateQuery', () => {
    const querySchema = z.object({
      userId: z.string().min(1),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    });

    it('should validate and parse valid query parameters', () => {
      req.query = { userId: 'user-123', limit: '10' };

      const middleware = validateQuery(querySchema);
      middleware(req, res, next);

      expect(req.query).toEqual({
        userId: 'user-123',
        limit: 10,
      });
      expect(next).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith();
    });

    it('should pass validation error to next for invalid query', () => {
      req.query = { userId: '' };

      const middleware = validateQuery(querySchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle missing required fields', () => {
      req.query = {};

      const middleware = validateQuery(querySchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should coerce string numbers to integers', () => {
      req.query = { userId: 'user-123', limit: '50' };

      const middleware = validateQuery(querySchema);
      middleware(req, res, next);

      expect(req.query.limit).toBe(50);
      expect(typeof req.query.limit).toBe('number');
    });

    it('should validate enum values', () => {
      const enumSchema = z.object({
        mediaType: z.enum(['movie', 'series', 'documentary']),
      });

      req.query = { mediaType: 'movie' };
      const middleware = validateQuery(enumSchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should reject invalid enum values', () => {
      const enumSchema = z.object({
        mediaType: z.enum(['movie', 'series', 'documentary']),
      });

      req.query = { mediaType: 'invalid' };
      const middleware = validateQuery(enumSchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('validateBody', () => {
    const bodySchema = z.object({
      userId: z.string().min(1),
      contentId: z.string().min(1),
      rating: z.number().min(0).max(10),
    });

    it('should validate and parse valid request body', () => {
      req.body = {
        userId: 'user-123',
        contentId: 'content-456',
        rating: 8.5,
      };

      const middleware = validateBody(bodySchema);
      middleware(req, res, next);

      expect(req.body).toEqual({
        userId: 'user-123',
        contentId: 'content-456',
        rating: 8.5,
      });
      expect(next).toHaveBeenCalledWith();
    });

    it('should pass validation error to next for invalid body', () => {
      req.body = {
        userId: 'user-123',
        contentId: 'content-456',
        rating: 15, // exceeds max
      };

      const middleware = validateBody(bodySchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle missing required fields in body', () => {
      req.body = { userId: 'user-123' };

      const middleware = validateBody(bodySchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle optional fields', () => {
      const optionalSchema = z.object({
        userId: z.string(),
        review: z.string().optional(),
      });

      req.body = { userId: 'user-123' };
      const middleware = validateBody(optionalSchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should validate nested objects', () => {
      const nestedSchema = z.object({
        user: z.object({
          id: z.string(),
          name: z.string(),
        }),
      });

      req.body = {
        user: {
          id: 'user-123',
          name: 'John Doe',
        },
      };

      const middleware = validateBody(nestedSchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('validateParams', () => {
    const paramsSchema = z.object({
      id: z.string().min(1),
    });

    it('should validate valid route parameters', () => {
      req.params = { id: 'content-123' };

      const middleware = validateParams(paramsSchema);
      middleware(req, res, next);

      expect(req.params).toEqual({ id: 'content-123' });
      expect(next).toHaveBeenCalledWith();
    });

    it('should pass validation error for invalid params', () => {
      req.params = { id: '' };

      const middleware = validateParams(paramsSchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle missing params', () => {
      req.params = {};

      const middleware = validateParams(paramsSchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should validate multiple params', () => {
      const multiParamSchema = z.object({
        userId: z.string(),
        contentId: z.string(),
      });

      req.params = { userId: 'user-123', contentId: 'content-456' };
      const middleware = validateParams(multiParamSchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('Complex Validation Scenarios', () => {
    it('should handle schema transformations', () => {
      const transformSchema = z.object({
        include: z.string().transform(val => val.split(',')),
      });

      req.query = { include: 'availability,similar,reviews' };
      const middleware = validateQuery(transformSchema);
      middleware(req, res, next);

      expect(req.query.include).toEqual(['availability', 'similar', 'reviews']);
    });

    it('should handle default values', () => {
      const defaultSchema = z.object({
        limit: z.number().default(20),
        offset: z.number().default(0),
      });

      req.query = {};
      const middleware = validateQuery(defaultSchema);
      middleware(req, res, next);

      expect(req.query).toEqual({
        limit: 20,
        offset: 0,
      });
    });

    it('should validate array fields', () => {
      const arraySchema = z.object({
        genres: z.array(z.string()),
      });

      req.body = { genres: ['Action', 'Thriller'] };
      const middleware = validateBody(arraySchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should handle datetime validation', () => {
      const dateSchema = z.object({
        timestamp: z.string().datetime(),
      });

      req.body = { timestamp: new Date().toISOString() };
      const middleware = validateBody(dateSchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });
});

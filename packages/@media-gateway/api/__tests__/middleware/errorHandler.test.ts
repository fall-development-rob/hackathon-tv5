/**
 * Error Handler Middleware Tests
 * Tests error handling middleware functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ZodError } from 'zod';
import {
  ApiError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
} from '../../src/middleware/errorHandler';
import { createMockRequest, createMockResponse, createMockNext } from '../helpers/mocks';

describe('Error Handler Middleware', () => {
  describe('ApiError', () => {
    it('should create custom API error', () => {
      const error = new ApiError(404, 'NOT_FOUND', 'Resource not found');

      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Resource not found');
      expect(error.name).toBe('ApiError');
    });

    it('should accept optional details', () => {
      const details = { field: 'userId', value: '123' };
      const error = new ApiError(400, 'INVALID_INPUT', 'Invalid input', details);

      expect(error.details).toEqual(details);
    });
  });

  describe('errorHandler', () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
      req = createMockRequest();
      res = createMockResponse();
      next = createMockNext();
    });

    it('should handle ZodError validation errors', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['userId'],
          message: 'Expected string, received number',
        },
      ]);

      errorHandler(zodError, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: [
          {
            path: 'userId',
            message: 'Expected string, received number',
          },
        ],
      });
    });

    it('should handle ApiError instances', () => {
      const apiError = new ApiError(404, 'NOT_FOUND', 'Content not found');

      errorHandler(apiError, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Content not found',
        code: 'NOT_FOUND',
        details: undefined,
      });
    });

    it('should include error details in ApiError response', () => {
      const details = { contentId: '123' };
      const apiError = new ApiError(404, 'NOT_FOUND', 'Content not found', details);

      errorHandler(apiError, req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        error: 'Content not found',
        code: 'NOT_FOUND',
        details,
      });
    });

    it('should handle generic errors', () => {
      const genericError = new Error('Unexpected error');

      errorHandler(genericError, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    });

    it('should handle multiple Zod validation errors', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['userId'],
          message: 'Invalid userId',
        },
        {
          code: 'too_small',
          minimum: 0,
          type: 'number',
          inclusive: true,
          exact: false,
          path: ['rating'],
          message: 'Rating must be at least 0',
        },
      ]);

      errorHandler(zodError, req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: [
          { path: 'userId', message: 'Invalid userId' },
          { path: 'rating', message: 'Rating must be at least 0' },
        ],
      });
    });
  });

  describe('notFoundHandler', () => {
    it('should handle 404 errors', () => {
      const req = createMockRequest({
        path: '/v1/invalid-endpoint',
        method: 'GET',
      });
      const res = createMockResponse();
      const next = createMockNext();

      notFoundHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Resource not found',
        code: 'NOT_FOUND',
        details: {
          path: '/v1/invalid-endpoint',
          method: 'GET',
        },
      });
    });

    it('should include request details in response', () => {
      const req = createMockRequest({
        path: '/v1/content/invalid',
        method: 'POST',
      });
      const res = createMockResponse();
      const next = createMockNext();

      notFoundHandler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        error: 'Resource not found',
        code: 'NOT_FOUND',
        details: {
          path: '/v1/content/invalid',
          method: 'POST',
        },
      });
    });
  });

  describe('asyncHandler', () => {
    it('should handle successful async operations', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      const handler = asyncHandler(async (req, res) => {
        res.json({ success: true });
      });

      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(next).not.toHaveBeenCalled();
    });

    it('should catch and forward async errors', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      const error = new Error('Async error');
      const handler = asyncHandler(async () => {
        throw error;
      });

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('should catch ApiError instances', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      const apiError = new ApiError(400, 'BAD_REQUEST', 'Invalid data');
      const handler = asyncHandler(async () => {
        throw apiError;
      });

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(apiError);
    });

    it('should handle rejected promises', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      const handler = asyncHandler(async () => {
        return Promise.reject(new Error('Promise rejection'));
      });

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});

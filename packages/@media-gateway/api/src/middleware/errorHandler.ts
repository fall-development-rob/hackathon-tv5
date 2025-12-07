import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ErrorResponse } from '../schemas';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Zod validation errors
  if (err instanceof ZodError) {
    const response: ErrorResponse = {
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
    res.status(400).json(response);
    return;
  }

  // API errors
  if (err instanceof ApiError) {
    const response: ErrorResponse = {
      error: err.message,
      code: err.code,
      details: err.details,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Default error
  console.error('Unexpected error:', err);
  const response: ErrorResponse = {
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  };
  res.status(500).json(response);
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const response: ErrorResponse = {
    error: 'Resource not found',
    code: 'NOT_FOUND',
    details: {
      path: req.path,
      method: req.method,
    },
  };
  res.status(404).json(response);
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

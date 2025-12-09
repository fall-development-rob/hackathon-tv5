import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { ApiError } from "./errorHandler";

// Extend Express Request type to include user information
// eslint-disable-next-line @typescript-eslint/no-namespace
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { userId: string; email?: string; name?: string } | null;
    }
  }
}

// JWT payload interface
interface JwtPayload {
  userId: string;
  email?: string;
  name?: string;
  iat?: number;
  exp?: number;
}

// Get JWT secret from environment or use default
const JWT_SECRET = process.env.JWT_SECRET || "media-gateway-secret-key";

/**
 * Authentication middleware that verifies JWT token
 * Requires a valid Bearer token in the Authorization header
 *
 * @throws {ApiError} 401 - If no token or invalid token
 * @throws {ApiError} 403 - If token is expired
 */
export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.substring(7)
        : null;

    if (!token) {
      throw new ApiError(
        401,
        "UNAUTHORIZED",
        "Authentication token is required",
      );
    }

    // Verify and decode token
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

      // Attach user information to request
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name,
      };

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(
          403,
          "TOKEN_EXPIRED",
          "Authentication token has expired",
        );
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(
          401,
          "INVALID_TOKEN",
          "Invalid authentication token",
        );
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication middleware
 * Verifies JWT token if present, but doesn't fail if token is missing
 * Useful for endpoints that work for both authenticated and anonymous users
 *
 * Sets req.user to null if no valid token is provided
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.substring(7)
        : null;

    // If no token, set user to null and continue
    if (!token) {
      req.user = null;
      next();
      return;
    }

    // Try to verify token
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

      // Attach user information to request
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name,
      };

      next();
    } catch (error) {
      // If token verification fails, set user to null and continue
      req.user = null;
      next();
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Enhanced authentication middleware that fetches full user data
 * Wraps authenticateToken with additional user lookup from UserService
 *
 * Note: This middleware requires a UserService to be implemented
 * Currently, it only attaches JWT decoded data to req.user
 *
 * @throws {ApiError} 401 - If no token or invalid token
 * @throws {ApiError} 403 - If token is expired
 * @throws {ApiError} 404 - If user not found in database
 */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.substring(7)
        : null;

    if (!token) {
      throw new ApiError(
        401,
        "UNAUTHORIZED",
        "Authentication token is required",
      );
    }

    // Verify and decode token
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

      // TODO: Implement user lookup from UserService when available
      // For now, just attach decoded JWT data
      // Example:
      // const userService = new UserService();
      // const fullUser = await userService.findById(decoded.userId);
      // if (!fullUser) {
      //   throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
      // }
      // req.user = fullUser;

      // Attach user information to request
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name,
      };

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(
          403,
          "TOKEN_EXPIRED",
          "Authentication token has expired",
        );
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(
          401,
          "INVALID_TOKEN",
          "Invalid authentication token",
        );
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Utility function to generate JWT token
 * Used by authentication routes to create tokens after login
 *
 * @param payload - User data to encode in the token
 * @param expiresIn - Token expiration time (default: 24h)
 * @returns Signed JWT token
 */
export const generateToken = (
  payload: Omit<JwtPayload, "iat" | "exp">,
  expiresIn = "24h",
): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
};

/**
 * Utility function to verify and decode JWT token
 * Useful for testing or external token validation
 *
 * @param token - JWT token to verify
 * @returns Decoded token payload
 * @throws {jwt.JsonWebTokenError} If token is invalid
 * @throws {jwt.TokenExpiredError} If token is expired
 */
export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};

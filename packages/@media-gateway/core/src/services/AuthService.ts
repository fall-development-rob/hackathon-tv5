/**
 * Authentication Service
 * SPARC NFR-4.1: Security & Authentication Implementation
 *
 * Features:
 * - Password hashing with bcrypt (cost factor: 12)
 * - JWT token management (access + refresh tokens)
 * - Session management with rate limiting
 * - OAuth2 support structure
 * - Two-factor authentication (TOTP) structure
 */

import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import type {
  TokenPayload,
  RefreshPayload,
  Session,
  AuthResult,
  OAuthProvider,
  OAuthTokens,
  OAuthUser,
  TOTPConfig,
  AuthServiceConfig,
} from '../types/auth.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  accessTokenExpiry: 24 * 60 * 60, // 24 hours in seconds
  refreshTokenExpiry: 30 * 24 * 60 * 60, // 30 days in seconds
  bcryptCost: 12,
  maxFailedAttempts: 5,
  lockoutDurationMinutes: 15,
} as const;

/**
 * Authentication Service
 * Handles password hashing, JWT tokens, sessions, and future OAuth/2FA support
 */
export class AuthService {
  private readonly config: Required<AuthServiceConfig>;
  private readonly sessions: Map<string, Session>;
  private readonly userSessions: Map<string, Set<string>>; // userId -> sessionIds

  constructor(config: AuthServiceConfig) {
    // Validate required secrets
    if (!config.jwtSecret || !config.jwtRefreshSecret) {
      throw new Error('JWT_SECRET and JWT_REFRESH_SECRET are required');
    }

    // Merge with defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.sessions = new Map();
    this.userSessions = new Map();
  }

  // ============================================================================
  // Password Hashing (bcrypt)
  // ============================================================================

  /**
   * Hash a password using bcrypt
   * @param password Plain text password
   * @returns Hashed password
   */
  async hashPassword(password: string): Promise<string> {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    return bcrypt.hash(password, this.config.bcryptCost);
  }

  /**
   * Verify a password against a hash
   * @param password Plain text password
   * @param hash Hashed password
   * @returns True if password matches
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
      return false;
    }

    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  // ============================================================================
  // JWT Token Management
  // ============================================================================

  /**
   * Generate an access token
   * @param userId User identifier
   * @param scopes Permission scopes
   * @returns JWT access token
   */
  generateAccessToken(userId: string, scopes: string[] = []): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: TokenPayload = {
      userId,
      scopes,
      iat: now,
      exp: now + this.config.accessTokenExpiry,
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      algorithm: 'HS256',
    });
  }

  /**
   * Generate a refresh token
   * @param userId User identifier
   * @param sessionId Session identifier
   * @returns JWT refresh token
   */
  generateRefreshToken(userId: string, sessionId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: RefreshPayload = {
      userId,
      sessionId,
      exp: now + this.config.refreshTokenExpiry,
    };

    return jwt.sign(payload, this.config.jwtRefreshSecret, {
      algorithm: 'HS256',
    });
  }

  /**
   * Verify an access token
   * @param token JWT access token
   * @returns Decoded payload or null if invalid
   */
  verifyAccessToken(token: string): TokenPayload | null {
    try {
      const payload = jwt.verify(token, this.config.jwtSecret, {
        algorithms: ['HS256'],
      }) as TokenPayload;

      // Verify expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return null;
      }

      return payload;
    } catch (error) {
      console.error('Access token verification error:', error);
      return null;
    }
  }

  /**
   * Verify a refresh token
   * @param token JWT refresh token
   * @returns Decoded payload or null if invalid
   */
  verifyRefreshToken(token: string): RefreshPayload | null {
    try {
      const payload = jwt.verify(token, this.config.jwtRefreshSecret, {
        algorithms: ['HS256'],
      }) as RefreshPayload;

      // Verify expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return null;
      }

      // Verify session is still valid
      const session = this.sessions.get(payload.sessionId);
      if (!session || !session.isValid) {
        return null;
      }

      return payload;
    } catch (error) {
      console.error('Refresh token verification error:', error);
      return null;
    }
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Create a new session
   * @param userId User identifier
   * @param metadata Optional session metadata
   * @returns Created session
   */
  createSession(
    userId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Session {
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.refreshTokenExpiry * 1000);

    const session: Session = {
      id: sessionId,
      userId,
      createdAt: now,
      expiresAt,
      ...(metadata?.ipAddress && { ipAddress: metadata.ipAddress }),
      ...(metadata?.userAgent && { userAgent: metadata.userAgent }),
      isValid: true,
      failedAttempts: 0,
    };

    this.sessions.set(sessionId, session);

    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(sessionId);

    return session;
  }

  /**
   * Validate a session
   * @param sessionId Session identifier
   * @returns True if session is valid
   */
  validateSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isValid) {
      return false;
    }

    // Check expiration
    if (session.expiresAt < new Date()) {
      session.isValid = false;
      return false;
    }

    // Check if locked
    if (session.lockedUntil && session.lockedUntil > new Date()) {
      return false;
    }

    return true;
  }

  /**
   * Record a failed authentication attempt
   * @param sessionId Session identifier
   * @returns Remaining attempts before lockout
   */
  recordFailedAttempt(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return 0;
    }

    session.failedAttempts += 1;

    // Check if should lock
    if (session.failedAttempts >= this.config.maxFailedAttempts) {
      const lockoutDuration = this.config.lockoutDurationMinutes * 60 * 1000;
      session.lockedUntil = new Date(Date.now() + lockoutDuration);
      session.isValid = false;
      return 0;
    }

    return this.config.maxFailedAttempts - session.failedAttempts;
  }

  /**
   * Reset failed attempts counter
   * @param sessionId Session identifier
   */
  resetFailedAttempts(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.failedAttempts = 0;
      delete session.lockedUntil;
    }
  }

  /**
   * Revoke a session
   * @param sessionId Session identifier
   */
  revokeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isValid = false;

      // Remove from user sessions
      const userSessionSet = this.userSessions.get(session.userId);
      if (userSessionSet) {
        userSessionSet.delete(sessionId);
      }
    }
  }

  /**
   * Revoke all sessions for a user
   * @param userId User identifier
   */
  revokeAllUserSessions(userId: string): void {
    const sessionIds = this.userSessions.get(userId);
    if (sessionIds) {
      sessionIds.forEach((sessionId) => {
        const session = this.sessions.get(sessionId);
        if (session) {
          session.isValid = false;
        }
      });
      this.userSessions.delete(userId);
    }
  }

  /**
   * Get active sessions for a user
   * @param userId User identifier
   * @returns Array of active sessions
   */
  getUserSessions(userId: string): Session[] {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) {
      return [];
    }

    return Array.from(sessionIds)
      .map((id) => this.sessions.get(id))
      .filter((session): session is Session => {
        return session !== undefined && session.isValid && session.expiresAt > new Date();
      });
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    this.sessions.forEach((session, sessionId) => {
      if (session.expiresAt < now) {
        expiredSessions.push(sessionId);
      }
    });

    expiredSessions.forEach((sessionId) => {
      this.revokeSession(sessionId);
      this.sessions.delete(sessionId);
    });
  }

  // ============================================================================
  // OAuth2 Support (Structure for future implementation)
  // ============================================================================

  /**
   * Validate an OAuth token from a provider
   * @param provider OAuth provider
   * @param token OAuth access token
   * @returns OAuth user information
   * @throws Error if token is invalid
   */
  async validateOAuthToken(
    provider: OAuthProvider,
    token: string
  ): Promise<OAuthUser> {
    // This is a placeholder for future OAuth implementation
    // Each provider will have specific validation logic
    throw new Error(`OAuth validation for ${provider} not yet implemented`);
  }

  /**
   * Exchange OAuth tokens for internal tokens
   * @param oauthUser OAuth user information
   * @param sessionMetadata Session metadata
   * @returns Authentication result with tokens
   */
  createOAuthSession(
    oauthUser: OAuthUser,
    sessionMetadata?: { ipAddress?: string; userAgent?: string }
  ): AuthResult {
    // Create internal user ID from OAuth provider ID
    const userId = `${oauthUser.provider}:${oauthUser.providerId}`;

    // Create session
    const session = this.createSession(userId, sessionMetadata);

    // Generate tokens
    const accessToken = this.generateAccessToken(userId, ['user']);
    const refreshToken = this.generateRefreshToken(userId, session.id);

    return {
      success: true,
      user: {
        id: userId,
        email: oauthUser.email,
        ...(oauthUser.name && { name: oauthUser.name }),
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  // ============================================================================
  // Two-Factor Authentication (TOTP) Structure
  // ============================================================================

  /**
   * Generate a TOTP secret for a user
   * @param userId User identifier
   * @param issuer Application name for QR code
   * @returns TOTP configuration with secret and QR code
   */
  generateTOTPSecret(userId: string, issuer: string = 'MediaGateway'): TOTPConfig {
    // Generate a random base32 secret
    const secret = this.generateBase32Secret();

    // Generate QR code URL (otpauth:// format)
    const qrCodeUrl = this.generateOTPAuthUrl(userId, secret, issuer);

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(8);

    return {
      secret,
      qrCodeUrl,
      backupCodes,
    };
  }

  /**
   * Verify a TOTP token
   * @param secret Base32 encoded secret
   * @param token 6-digit TOTP token
   * @returns True if token is valid
   */
  verifyTOTP(secret: string, token: string): boolean {
    // This is a placeholder for future TOTP implementation
    // Will use an OTP library like 'otplib' or implement RFC 6238
    throw new Error('TOTP verification not yet implemented');
  }

  /**
   * Verify a backup code
   * @param userId User identifier
   * @param code Backup code
   * @returns True if code is valid (and hasn't been used)
   */
  verifyBackupCode(userId: string, code: string): boolean {
    // This is a placeholder for future backup code implementation
    // Will track used codes in a database
    throw new Error('Backup code verification not yet implemented');
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private generateBase32Secret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    const bytes = crypto.randomBytes(20);

    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if (byte !== undefined) {
        secret += chars[byte % chars.length];
      }
    }

    return secret;
  }

  private generateOTPAuthUrl(userId: string, secret: string, issuer: string): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedUser = encodeURIComponent(userId);
    return `otpauth://totp/${encodedIssuer}:${encodedUser}?secret=${secret}&issuer=${encodedIssuer}`;
  }

  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const bytes = crypto.randomBytes(4);
      if (bytes) {
        const code = bytes.toString('hex').toUpperCase();
        codes.push(code);
      }
    }
    return codes;
  }

  /**
   * Get session by ID
   * @param sessionId Session identifier
   * @returns Session or undefined
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }
}

/**
 * Factory function to create an AuthService instance
 * @param config Authentication service configuration
 * @returns AuthService instance
 */
export function createAuthService(config: AuthServiceConfig): AuthService {
  return new AuthService(config);
}

/**
 * Create an AuthService from environment variables
 * @returns AuthService instance configured from environment
 */
export function createAuthServiceFromEnv(): AuthService {
  const jwtSecret = process.env['JWT_SECRET'];
  const jwtRefreshSecret = process.env['JWT_REFRESH_SECRET'];

  if (!jwtSecret || !jwtRefreshSecret) {
    throw new Error(
      'JWT_SECRET and JWT_REFRESH_SECRET environment variables must be set'
    );
  }

  const config: AuthServiceConfig = {
    jwtSecret,
    jwtRefreshSecret,
  };

  const accessTokenExpiry = process.env['ACCESS_TOKEN_EXPIRY'];
  if (accessTokenExpiry) {
    config.accessTokenExpiry = parseInt(accessTokenExpiry, 10);
  }

  const refreshTokenExpiry = process.env['REFRESH_TOKEN_EXPIRY'];
  if (refreshTokenExpiry) {
    config.refreshTokenExpiry = parseInt(refreshTokenExpiry, 10);
  }

  const bcryptCost = process.env['BCRYPT_COST'];
  if (bcryptCost) {
    config.bcryptCost = parseInt(bcryptCost, 10);
  }

  const maxFailedAttempts = process.env['MAX_FAILED_ATTEMPTS'];
  if (maxFailedAttempts) {
    config.maxFailedAttempts = parseInt(maxFailedAttempts, 10);
  }

  const lockoutDurationMinutes = process.env['LOCKOUT_DURATION_MINUTES'];
  if (lockoutDurationMinutes) {
    config.lockoutDurationMinutes = parseInt(lockoutDurationMinutes, 10);
  }

  return new AuthService(config);
}

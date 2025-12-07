/**
 * Authentication Type Definitions
 * SPARC NFR-4.1: Security & Authentication
 */

/**
 * OAuth provider types supported by the platform
 */
export type OAuthProvider = 'google' | 'apple' | 'facebook';

/**
 * JWT access token payload
 */
export interface TokenPayload {
  /** User identifier */
  userId: string;
  /** Permission scopes granted to this token */
  scopes: string[];
  /** Token expiration timestamp (Unix epoch) */
  exp: number;
  /** Token issued at timestamp (Unix epoch) */
  iat: number;
}

/**
 * JWT refresh token payload
 */
export interface RefreshPayload {
  /** User identifier */
  userId: string;
  /** Session identifier for tracking */
  sessionId: string;
  /** Token expiration timestamp (Unix epoch) */
  exp: number;
}

/**
 * User session tracking
 */
export interface Session {
  /** Unique session identifier */
  id: string;
  /** User identifier */
  userId: string;
  /** Session creation timestamp */
  createdAt: Date;
  /** Session expiration timestamp */
  expiresAt: Date;
  /** Client IP address (optional for security tracking) */
  ipAddress?: string;
  /** Client user agent (optional for security tracking) */
  userAgent?: string;
  /** Session validity status */
  isValid: boolean;
  /** Number of failed authentication attempts */
  failedAttempts: number;
  /** Timestamp when session was locked due to failed attempts */
  lockedUntil?: Date;
}

/**
 * OAuth tokens received from providers
 */
export interface OAuthTokens {
  /** OAuth access token */
  accessToken: string;
  /** OAuth refresh token (if available) */
  refreshToken?: string;
  /** Token expiration time in seconds */
  expiresIn: number;
  /** Token type (usually 'Bearer') */
  tokenType: string;
  /** Permission scopes granted */
  scope?: string;
}

/**
 * OAuth user information
 */
export interface OAuthUser {
  /** Provider identifier */
  provider: OAuthProvider;
  /** User ID from the provider */
  providerId: string;
  /** User email address */
  email: string;
  /** User display name */
  name?: string;
  /** User profile picture URL */
  picture?: string;
  /** Email verification status */
  emailVerified: boolean;
}

/**
 * Authentication result
 */
export interface AuthResult {
  /** Authentication success status */
  success: boolean;
  /** User information (if successful) */
  user?: {
    id: string;
    email: string;
    name?: string;
  };
  /** Generated tokens (if successful) */
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
  /** Error message (if failed) */
  error?: string;
  /** Remaining retry attempts before lockout */
  remainingAttempts?: number;
  /** Timestamp when account will be unlocked */
  lockedUntil?: Date;
}

/**
 * TOTP (Time-based One-Time Password) configuration
 */
export interface TOTPConfig {
  /** Base32 encoded secret */
  secret: string;
  /** QR code URL for easy setup */
  qrCodeUrl: string;
  /** Backup codes for account recovery */
  backupCodes: string[];
}

/**
 * Authentication service configuration
 */
export interface AuthServiceConfig {
  /** JWT secret for access tokens */
  jwtSecret: string;
  /** JWT secret for refresh tokens */
  jwtRefreshSecret: string;
  /** Access token expiry in seconds (default: 24 hours) */
  accessTokenExpiry?: number;
  /** Refresh token expiry in seconds (default: 30 days) */
  refreshTokenExpiry?: number;
  /** Bcrypt cost factor (default: 12) */
  bcryptCost?: number;
  /** Maximum failed login attempts before lockout (default: 5) */
  maxFailedAttempts?: number;
  /** Lockout duration in minutes (default: 15) */
  lockoutDurationMinutes?: number;
}

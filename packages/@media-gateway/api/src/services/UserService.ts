/**
 * User Service
 * Handles user authentication and management with PostgreSQL persistence
 *
 * Features:
 * - User registration with bcrypt password hashing
 * - User authentication and validation
 * - PostgreSQL persistence with proper error handling
 * - UUID-based user IDs
 * - Automatic table initialization
 */

import { Pool } from "pg";
import * as bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

/**
 * User interface representing a user in the system
 */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User creation input (without password hash)
 */
export interface UserInput {
  email: string;
  password: string;
  name: string;
}

/**
 * User update input (all fields optional)
 */
export interface UserUpdate {
  email?: string;
  name?: string;
  password?: string;
}

/**
 * UserService class
 * Provides user management operations with PostgreSQL persistence
 */
export class UserService {
  private static instance: UserService | null = null;
  private pool: Pool | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * Initialize the service and create database connection
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize();
    await this.initPromise;
  }

  private async _initialize(): Promise<void> {
    console.log("🚀 Initializing UserService...");

    try {
      const databaseUrl = process.env.DATABASE_URL;

      if (!databaseUrl) {
        throw new Error("DATABASE_URL environment variable is not set");
      }

      // Create PostgreSQL connection pool
      this.pool = new Pool({
        connectionString: databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      try {
        await client.query("SELECT NOW()");
        console.log("   ✅ PostgreSQL connection established");
      } finally {
        client.release();
      }

      // Initialize database table
      await this.createUserTable();

      this.initialized = true;
      console.log("✅ UserService initialized successfully");
    } catch (error) {
      console.error("❌ UserService initialization failed:", error);
      throw error;
    }
  }

  /**
   * Create users table if it doesn't exist
   */
  async createUserTable(): Promise<void> {
    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `;

    try {
      await this.pool.query(createTableQuery);
      console.log("   ✅ Users table ready");
    } catch (error) {
      console.error("❌ Failed to create users table:", error);
      throw error;
    }
  }

  /**
   * Create a new user with hashed password
   * @param email - User email (must be unique)
   * @param password - Plain text password (will be hashed)
   * @param name - User's full name
   * @returns Created user (without password hash)
   */
  async createUser(
    email: string,
    password: string,
    name: string,
  ): Promise<Omit<User, "passwordHash">> {
    await this.initialize();

    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }

    // Validate input
    if (!email || !email.includes("@")) {
      throw new Error("Invalid email address");
    }

    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    if (!name || name.trim().length === 0) {
      throw new Error("Name is required");
    }

    try {
      // Hash password with bcrypt (10 rounds)
      const passwordHash = await bcrypt.hash(password, 10);

      // Generate UUID
      const id = uuidv4();

      // Insert user into database
      const query = `
        INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING id, email, name, created_at, updated_at
      `;

      const result = await this.pool.query(query, [
        id,
        email.toLowerCase().trim(),
        passwordHash,
        name.trim(),
      ]);

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };
    } catch (error: any) {
      if (error.code === "23505") {
        // Unique violation
        throw new Error("Email already exists");
      }
      console.error("Failed to create user:", error);
      throw new Error("Failed to create user");
    }
  }

  /**
   * Find a user by email
   * @param email - User email
   * @returns User object or null if not found
   */
  async findByEmail(email: string): Promise<User | null> {
    await this.initialize();

    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }

    try {
      const query = `
        SELECT id, email, password_hash, name, created_at, updated_at
        FROM users
        WHERE email = $1
      `;

      const result = await this.pool.query(query, [email.toLowerCase().trim()]);

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        passwordHash: user.password_hash,
        name: user.name,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };
    } catch (error) {
      console.error("Failed to find user by email:", error);
      throw new Error("Failed to find user");
    }
  }

  /**
   * Find a user by ID
   * @param id - User UUID
   * @returns User object or null if not found
   */
  async findById(id: string): Promise<User | null> {
    await this.initialize();

    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }

    try {
      const query = `
        SELECT id, email, password_hash, name, created_at, updated_at
        FROM users
        WHERE id = $1
      `;

      const result = await this.pool.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        passwordHash: user.password_hash,
        name: user.name,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };
    } catch (error) {
      console.error("Failed to find user by ID:", error);
      throw new Error("Failed to find user");
    }
  }

  /**
   * Validate a user's password
   * @param user - User object with passwordHash
   * @param password - Plain text password to validate
   * @returns True if password is valid, false otherwise
   */
  async validatePassword(user: User, password: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, user.passwordHash);
    } catch (error) {
      console.error("Failed to validate password:", error);
      return false;
    }
  }

  /**
   * Update user fields
   * @param id - User UUID
   * @param updates - Object containing fields to update
   * @returns Updated user (without password hash)
   */
  async updateUser(
    id: string,
    updates: UserUpdate,
  ): Promise<Omit<User, "passwordHash"> | null> {
    await this.initialize();

    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }

    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.email !== undefined) {
      updateFields.push(`email = $${paramIndex++}`);
      values.push(updates.email.toLowerCase().trim());
    }

    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(updates.name.trim());
    }

    if (updates.password !== undefined) {
      if (updates.password.length < 8) {
        throw new Error("Password must be at least 8 characters long");
      }
      const passwordHash = await bcrypt.hash(updates.password, 10);
      updateFields.push(`password_hash = $${paramIndex++}`);
      values.push(passwordHash);
    }

    if (updateFields.length === 0) {
      throw new Error("No fields to update");
    }

    // Always update updated_at
    updateFields.push(`updated_at = NOW()`);

    // Add user ID as the last parameter
    values.push(id);

    try {
      const query = `
        UPDATE users
        SET ${updateFields.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id, email, name, created_at, updated_at
      `;

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };
    } catch (error: any) {
      if (error.code === "23505") {
        // Unique violation
        throw new Error("Email already exists");
      }
      console.error("Failed to update user:", error);
      throw new Error("Failed to update user");
    }
  }

  /**
   * Close the database connection pool
   * Should be called when shutting down the service
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.initialized = false;
      this.initPromise = null;
      console.log("✅ UserService connection pool closed");
    }
  }

  /**
   * Get the connection pool (for advanced usage or testing)
   */
  getPool(): Pool | null {
    return this.pool;
  }
}

/**
 * Export singleton getter function
 * Use this to get the UserService instance throughout your application
 *
 * @example
 * ```typescript
 * const userService = getService();
 * const user = await userService.createUser(
 *   "john@example.com",
 *   "securePassword123",
 *   "John Doe"
 * );
 * ```
 */
export function getService(): UserService {
  return UserService.getInstance();
}

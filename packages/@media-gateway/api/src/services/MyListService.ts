import { Pool } from "pg";

/**
 * MyListItem represents an item in a user's list
 */
export interface MyListItem {
  id: string;
  userId: string;
  contentId: string;
  title: string;
  mediaType: "movie" | "tv";
  posterPath: string | null;
  addedAt: Date;
}

/**
 * MyListService handles all My List operations
 * Uses PostgreSQL for persistent storage
 */
export class MyListService {
  private static instance: MyListService | null = null;
  private pool: Pool | null = null;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): MyListService {
    if (!MyListService.instance) {
      MyListService.instance = new MyListService();
    }
    return MyListService.instance;
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
    console.log("🚀 Initializing MyListService...");

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
      await this.createMyListTable();

      this.initialized = true;
      console.log("✅ MyListService initialized successfully");
    } catch (error) {
      console.error("❌ MyListService initialization failed:", error);
      throw error;
    }
  }

  /**
   * Create my_list table if it doesn't exist
   */
  async createMyListTable(): Promise<void> {
    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }

    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS my_list (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          content_id TEXT NOT NULL,
          title TEXT NOT NULL,
          media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
          poster_path TEXT,
          added_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id, content_id)
        )
      `);

      // Create indexes for performance
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_my_list_user_id
        ON my_list(user_id)
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_my_list_added_at
        ON my_list(user_id, added_at DESC)
      `);

      console.log("   ✅ My List table ready");
    } catch (error) {
      console.error("❌ Failed to create my_list table:", error);
      throw error;
    }
  }

  /**
   * Get all items in user's list
   * Returns items sorted by most recently added first
   *
   * @param userId - User ID
   * @returns Array of MyListItem
   */
  async getUserList(userId: string): Promise<MyListItem[]> {
    await this.initialize();

    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }

    const result = await this.pool.query<MyListItem>(
      `
        SELECT
          id,
          user_id as "userId",
          content_id as "contentId",
          title,
          media_type as "mediaType",
          poster_path as "posterPath",
          added_at as "addedAt"
        FROM my_list
        WHERE user_id = $1
        ORDER BY added_at DESC
      `,
      [userId],
    );

    return result.rows;
  }

  /**
   * Add item to user's list
   * Enforces 500 item limit per user
   * Uses UPSERT to prevent duplicates
   *
   * @param userId - User ID
   * @param item - Item to add (without id and addedAt)
   * @returns Added MyListItem
   * @throws Error if limit exceeded or validation fails
   */
  async addItem(
    userId: string,
    item: {
      contentId: string;
      title: string;
      mediaType: "movie" | "tv";
      posterPath: string | null;
    },
  ): Promise<MyListItem> {
    await this.initialize();

    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }

    // Check current count
    const countResult = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM my_list WHERE user_id = $1",
      [userId],
    );
    const currentCount = parseInt(countResult.rows[0]?.count || "0", 10);

    // Check if item already exists
    const existingResult = await this.pool.query(
      "SELECT id FROM my_list WHERE user_id = $1 AND content_id = $2",
      [userId, item.contentId],
    );

    if (existingResult.rows.length > 0) {
      // Item already exists, return it
      const result = await this.pool.query<MyListItem>(
        `
          SELECT
            id,
            user_id as "userId",
            content_id as "contentId",
            title,
            media_type as "mediaType",
            poster_path as "posterPath",
            added_at as "addedAt"
          FROM my_list
          WHERE user_id = $1 AND content_id = $2
        `,
        [userId, item.contentId],
      );
      return result.rows[0];
    }

    // Enforce 500 item limit
    if (currentCount >= 500) {
      throw new Error("My List is full (maximum 500 items)");
    }

    // Validate media type
    if (!["movie", "tv"].includes(item.mediaType)) {
      throw new Error('Invalid media type. Must be "movie" or "tv"');
    }

    // Insert new item
    const result = await this.pool.query<MyListItem>(
      `
        INSERT INTO my_list (
          user_id, content_id, title, media_type, poster_path
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          user_id as "userId",
          content_id as "contentId",
          title,
          media_type as "mediaType",
          poster_path as "posterPath",
          added_at as "addedAt"
      `,
      [userId, item.contentId, item.title, item.mediaType, item.posterPath],
    );

    return result.rows[0];
  }

  /**
   * Remove item from user's list
   *
   * @param userId - User ID
   * @param contentId - Content ID to remove
   * @returns true if item was removed, false if not found
   */
  async removeItem(userId: string, contentId: string): Promise<boolean> {
    await this.initialize();

    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }

    const result = await this.pool.query(
      "DELETE FROM my_list WHERE user_id = $1 AND content_id = $2",
      [userId, contentId],
    );

    return (result.rowCount || 0) > 0;
  }

  /**
   * Check if item is in user's list
   *
   * @param userId - User ID
   * @param contentId - Content ID to check
   * @returns true if item is in list, false otherwise
   */
  async isInList(userId: string, contentId: string): Promise<boolean> {
    await this.initialize();

    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }

    const result = await this.pool.query(
      "SELECT 1 FROM my_list WHERE user_id = $1 AND content_id = $2",
      [userId, contentId],
    );

    return result.rows.length > 0;
  }

  /**
   * Get count of items in user's list
   *
   * @param userId - User ID
   * @returns Number of items in list
   */
  async getCount(userId: string): Promise<number> {
    await this.initialize();

    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }

    const result = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM my_list WHERE user_id = $1",
      [userId],
    );

    return parseInt(result.rows[0]?.count || "0", 10);
  }

  /**
   * Clear all items from user's list
   *
   * @param userId - User ID
   * @returns Number of items removed
   */
  async clearList(userId: string): Promise<number> {
    await this.initialize();

    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }

    const result = await this.pool.query(
      "DELETE FROM my_list WHERE user_id = $1",
      [userId],
    );

    return result.rowCount || 0;
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
      console.log("✅ MyListService connection pool closed");
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
 * Use this to get the MyListService instance throughout your application
 *
 * @example
 * ```typescript
 * const myListService = getMyListService();
 * const items = await myListService.getUserList('user-123');
 * ```
 */
export function getMyListService(): MyListService {
  return MyListService.getInstance();
}

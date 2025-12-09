/**
 * User Preferences Service
 * Manages Discord user -> Media Gateway user mappings and brief preferences
 *
 * Features:
 * - Discord to API user ID mapping
 * - Brief subscription preferences (time, channel, enabled)
 * - PostgreSQL persistence via existing database
 */

import { Pool } from "pg";
import axios from "axios";

/**
 * Brief preferences for a Discord user
 */
export interface BriefPreferences {
  discordUserId: string;
  apiUserId: string;
  enabled: boolean;
  channelId: string | null;
  cronTime: string; // Cron format: "0 8 * * *" for 8am daily
  timezone: string; // IANA timezone: "America/New_York"
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User preferences creation input
 */
export interface PreferencesInput {
  discordUserId: string;
  apiUserId: string;
  channelId?: string;
  cronTime?: string;
  timezone?: string;
}

/**
 * User preferences update input
 */
export interface PreferencesUpdate {
  enabled?: boolean;
  channelId?: string;
  cronTime?: string;
  timezone?: string;
}

/**
 * UserPreferencesService class
 * Handles Discord user preferences and API user mapping
 */
export class UserPreferencesService {
  private static instance: UserPreferencesService | null = null;
  private pool: Pool | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private apiBaseUrl: string;
  private apiToken: string | null = null;

  private constructor(apiBaseUrl: string = "http://localhost:3000") {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Get singleton instance
   */
  static getInstance(apiBaseUrl?: string): UserPreferencesService {
    if (!UserPreferencesService.instance) {
      UserPreferencesService.instance = new UserPreferencesService(apiBaseUrl);
    }
    return UserPreferencesService.instance;
  }

  /**
   * Set API authentication token
   */
  setApiToken(token: string): void {
    this.apiToken = token;
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
    console.log("🚀 Initializing UserPreferencesService...");

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
      await this.createPreferencesTable();

      this.initialized = true;
      console.log("✅ UserPreferencesService initialized successfully");
    } catch (error) {
      console.error("❌ UserPreferencesService initialization failed:", error);
      throw error;
    }
  }

  /**
   * Create discord_user_preferences table if it doesn't exist
   */
  async createPreferencesTable(): Promise<void> {
    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS discord_user_preferences (
        discord_user_id VARCHAR(255) PRIMARY KEY,
        api_user_id UUID NOT NULL,
        enabled BOOLEAN DEFAULT true,
        channel_id VARCHAR(255),
        cron_time VARCHAR(50) DEFAULT '0 8 * * *',
        timezone VARCHAR(100) DEFAULT 'America/New_York',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_discord_preferences_api_user
        ON discord_user_preferences(api_user_id);

      CREATE INDEX IF NOT EXISTS idx_discord_preferences_enabled
        ON discord_user_preferences(enabled)
        WHERE enabled = true;
    `;

    try {
      await this.pool.query(createTableQuery);
      console.log("   ✅ Discord user preferences table ready");
    } catch (error) {
      console.error("❌ Failed to create preferences table:", error);
      throw error;
    }
  }

  /**
   * Verify API user exists via /v1/auth/me endpoint
   * @param token - JWT authentication token
   * @returns API user ID or null if invalid
   */
  async verifyApiUser(token: string): Promise<string | null> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data?.user?.id) {
        return response.data.user.id;
      }
      return null;
    } catch (error) {
      console.error("Failed to verify API user:", error);
      return null;
    }
  }

  /**
   * Link Discord user to Media Gateway API user
   * @param discordUserId - Discord user ID
   * @param apiToken - JWT token from Media Gateway API
   * @param channelId - Optional Discord channel ID for briefs
   * @param cronTime - Optional cron schedule (default: 8am daily)
   * @param timezone - Optional IANA timezone (default: America/New_York)
   * @returns Created preferences
   */
  async linkUser(
    discordUserId: string,
    apiToken: string,
    channelId?: string,
    cronTime: string = "0 8 * * *",
    timezone: string = "America/New_York",
  ): Promise<BriefPreferences> {
    await this.initialize();

    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }

    // Verify API user exists
    const apiUserId = await this.verifyApiUser(apiToken);
    if (!apiUserId) {
      throw new Error("Invalid API token or user not found");
    }

    try {
      const query = `
        INSERT INTO discord_user_preferences
          (discord_user_id, api_user_id, enabled, channel_id, cron_time, timezone, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (discord_user_id)
        DO UPDATE SET
          api_user_id = EXCLUDED.api_user_id,
          channel_id = EXCLUDED.channel_id,
          cron_time = EXCLUDED.cron_time,
          timezone = EXCLUDED.timezone,
          updated_at = NOW()
        RETURNING *
      `;

      const result = await this.pool.query(query, [
        discordUserId,
        apiUserId,
        true,
        channelId || null,
        cronTime,
        timezone,
      ]);

      const pref = result.rows[0];
      return this.mapRowToPreferences(pref);
    } catch (error: any) {
      console.error("Failed to link user:", error);
      throw new Error("Failed to link Discord user to API user");
    }
  }

  /**
   * Get preferences for a Discord user
   * @param discordUserId - Discord user ID
   * @returns Preferences or null if not found
   */
  async getPreferences(
    discordUserId: string,
  ): Promise<BriefPreferences | null> {
    await this.initialize();

    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }

    try {
      const query = `
        SELECT * FROM discord_user_preferences
        WHERE discord_user_id = $1
      `;

      const result = await this.pool.query(query, [discordUserId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToPreferences(result.rows[0]);
    } catch (error) {
      console.error("Failed to get preferences:", error);
      throw new Error("Failed to get user preferences");
    }
  }

  /**
   * Update preferences for a Discord user
   * @param discordUserId - Discord user ID
   * @param updates - Fields to update
   * @returns Updated preferences or null if not found
   */
  async updatePreferences(
    discordUserId: string,
    updates: PreferencesUpdate,
  ): Promise<BriefPreferences | null> {
    await this.initialize();

    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }

    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.enabled !== undefined) {
      updateFields.push(`enabled = $${paramIndex++}`);
      values.push(updates.enabled);
    }

    if (updates.channelId !== undefined) {
      updateFields.push(`channel_id = $${paramIndex++}`);
      values.push(updates.channelId || null);
    }

    if (updates.cronTime !== undefined) {
      updateFields.push(`cron_time = $${paramIndex++}`);
      values.push(updates.cronTime);
    }

    if (updates.timezone !== undefined) {
      updateFields.push(`timezone = $${paramIndex++}`);
      values.push(updates.timezone);
    }

    if (updateFields.length === 0) {
      throw new Error("No fields to update");
    }

    // Always update updated_at
    updateFields.push(`updated_at = NOW()`);

    // Add discord user ID as the last parameter
    values.push(discordUserId);

    try {
      const query = `
        UPDATE discord_user_preferences
        SET ${updateFields.join(", ")}
        WHERE discord_user_id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToPreferences(result.rows[0]);
    } catch (error) {
      console.error("Failed to update preferences:", error);
      throw new Error("Failed to update user preferences");
    }
  }

  /**
   * Get all enabled subscriptions
   * @returns Array of preferences for enabled users
   */
  async getEnabledSubscriptions(): Promise<BriefPreferences[]> {
    await this.initialize();

    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }

    try {
      const query = `
        SELECT * FROM discord_user_preferences
        WHERE enabled = true
        ORDER BY discord_user_id
      `;

      const result = await this.pool.query(query);
      return result.rows.map((row) => this.mapRowToPreferences(row));
    } catch (error) {
      console.error("Failed to get enabled subscriptions:", error);
      throw new Error("Failed to get enabled subscriptions");
    }
  }

  /**
   * Delete preferences for a Discord user
   * @param discordUserId - Discord user ID
   * @returns True if deleted, false if not found
   */
  async deletePreferences(discordUserId: string): Promise<boolean> {
    await this.initialize();

    if (!this.pool) {
      throw new Error("Database pool not initialized");
    }

    try {
      const query = `
        DELETE FROM discord_user_preferences
        WHERE discord_user_id = $1
      `;

      const result = await this.pool.query(query, [discordUserId]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error("Failed to delete preferences:", error);
      throw new Error("Failed to delete user preferences");
    }
  }

  /**
   * Map database row to BriefPreferences interface
   */
  private mapRowToPreferences(row: any): BriefPreferences {
    return {
      discordUserId: row.discord_user_id,
      apiUserId: row.api_user_id,
      enabled: row.enabled,
      channelId: row.channel_id,
      cronTime: row.cron_time,
      timezone: row.timezone,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Close the database connection pool
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.initialized = false;
      this.initPromise = null;
      console.log("✅ UserPreferencesService connection pool closed");
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
 */
export function getPreferencesService(
  apiBaseUrl?: string,
): UserPreferencesService {
  return UserPreferencesService.getInstance(apiBaseUrl);
}

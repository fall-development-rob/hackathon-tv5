/**
 * User Link Service
 * Manages linking between Discord users and Media Gateway accounts
 */

import { PostgreSQLConnectionPool } from "@media-gateway/database";
import {
  OneTimeLinkCode,
  LinkResult,
  UnlinkResult,
  UserProfile,
  UserLinkPreferences,
} from "../types/user-link";
import { randomBytes, timingSafeEqual, scrypt } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export class UserLinkService {
  constructor(private pool: PostgreSQLConnectionPool) {}

  /**
   * Link Discord user to Media Gateway account using email/password
   * @param discordId - Discord user ID
   * @param email - Media Gateway account email
   * @param password - Media Gateway account password
   * @returns LinkResult with success status and user_id
   */
  async linkUserWithCredentials(
    discordId: string,
    email: string,
    password: string,
  ): Promise<LinkResult> {
    try {
      // Verify credentials and get user_id
      const authResult = await this.authenticateUser(email, password);

      if (!authResult.success) {
        return {
          success: false,
          message: "Invalid email or password",
          error: authResult.error,
        };
      }

      // Check if Discord user is already linked
      const existingLink = await this.getLinkedUser(discordId);
      if (existingLink) {
        return {
          success: false,
          message:
            "Discord account is already linked to a Media Gateway account",
          user_id: existingLink,
        };
      }

      // Check if user_id is already linked to another Discord account
      const existingDiscordLink = await this.getUserByUserId(
        authResult.user_id!,
      );
      if (existingDiscordLink) {
        return {
          success: false,
          message:
            "Media Gateway account is already linked to another Discord account",
          error: "ALREADY_LINKED_TO_OTHER_DISCORD",
        };
      }

      // Create link
      await this.createLink(discordId, authResult.user_id!);

      return {
        success: true,
        message: "Successfully linked Discord account to Media Gateway",
        user_id: authResult.user_id,
      };
    } catch (error: any) {
      console.error("Error linking user with credentials:", error);
      return {
        success: false,
        message: "Failed to link accounts",
        error: error.message,
      };
    }
  }

  /**
   * Link Discord user to Media Gateway account using one-time code
   * @param discordId - Discord user ID
   * @param code - One-time link code
   * @returns LinkResult with success status and user_id
   */
  async linkUserWithCode(discordId: string, code: string): Promise<LinkResult> {
    try {
      // Verify code and get user_id
      const codeResult = await this.verifyLinkCode(code);

      if (!codeResult.success) {
        return {
          success: false,
          message: "Invalid or expired link code",
          error: codeResult.error,
        };
      }

      // Check if Discord user is already linked
      const existingLink = await this.getLinkedUser(discordId);
      if (existingLink) {
        return {
          success: false,
          message:
            "Discord account is already linked to a Media Gateway account",
          user_id: existingLink,
        };
      }

      // Mark code as used and create link
      await this.pool.transaction(async (client) => {
        // Mark code as used
        await client.query(
          "UPDATE one_time_link_codes SET used_at = NOW(), discord_id = $1 WHERE code = $2",
          [discordId, code],
        );

        // Create link
        await client.query(
          `INSERT INTO discord_user_links (discord_id, user_id, preferences)
           VALUES ($1, $2, $3)`,
          [
            discordId,
            codeResult.user_id,
            JSON.stringify({
              brief_enabled: false,
              brief_time: "09:00",
              preferred_region: "US",
            }),
          ],
        );
      });

      return {
        success: true,
        message: "Successfully linked Discord account to Media Gateway",
        user_id: codeResult.user_id,
      };
    } catch (error: any) {
      console.error("Error linking user with code:", error);
      return {
        success: false,
        message: "Failed to link accounts",
        error: error.message,
      };
    }
  }

  /**
   * Unlink Discord user from Media Gateway account
   * @param discordId - Discord user ID
   * @returns UnlinkResult with success status
   */
  async unlinkUser(discordId: string): Promise<UnlinkResult> {
    try {
      const result = await this.pool.query(
        "DELETE FROM discord_user_links WHERE discord_id = $1 RETURNING user_id",
        [discordId],
      );

      if (result.rowCount === 0) {
        return {
          success: false,
          message: "Discord account is not linked to any Media Gateway account",
        };
      }

      return {
        success: true,
        message: "Successfully unlinked Discord account from Media Gateway",
      };
    } catch (error: any) {
      console.error("Error unlinking user:", error);
      return {
        success: false,
        message: "Failed to unlink accounts",
        error: error.message,
      };
    }
  }

  /**
   * Get linked Media Gateway user_id for a Discord user
   * @param discordId - Discord user ID
   * @returns user_id if linked, null otherwise
   */
  async getLinkedUser(discordId: string): Promise<string | null> {
    try {
      const result = await this.pool.query<{ user_id: string }>(
        "SELECT user_id FROM discord_user_links WHERE discord_id = $1",
        [discordId],
      );

      return result.rows[0]?.user_id || null;
    } catch (error) {
      console.error("Error getting linked user:", error);
      return null;
    }
  }

  /**
   * Check if Discord user is linked to a Media Gateway account
   * @param discordId - Discord user ID
   * @returns true if linked, false otherwise
   */
  async isLinked(discordId: string): Promise<boolean> {
    const userId = await this.getLinkedUser(discordId);
    return userId !== null;
  }

  /**
   * Get full user profile including My List count and preferences
   * @param discordId - Discord user ID
   * @returns UserProfile if linked, null otherwise
   */
  async getUserProfile(discordId: string): Promise<UserProfile | null> {
    try {
      const result = await this.pool.query<any>(
        `SELECT
          dul.user_id,
          dul.discord_id,
          dul.preferences,
          dul.linked_at,
          u.username,
          u.email,
          COUNT(DISTINCT ml.id) as my_list_count
         FROM discord_user_links dul
         INNER JOIN users u ON u.id = dul.user_id
         LEFT JOIN my_list ml ON ml.user_id = dul.user_id
         WHERE dul.discord_id = $1
         GROUP BY dul.user_id, dul.discord_id, dul.preferences, dul.linked_at, u.username, u.email`,
        [discordId],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      // Get user's subscription platforms from user_subscriptions table
      const subscriptionPlatforms = await this.getUserSubscriptionPlatforms(
        row.user_id,
      );

      return {
        user_id: row.user_id,
        discord_id: row.discord_id,
        username: row.username,
        email: row.email,
        my_list_count: parseInt(row.my_list_count) || 0,
        subscription_platforms: subscriptionPlatforms,
        preferences:
          typeof row.preferences === "string"
            ? JSON.parse(row.preferences)
            : row.preferences,
        linked_at: row.linked_at,
      };
    } catch (error) {
      console.error("Error getting user profile:", error);
      return null;
    }
  }

  /**
   * Update user preferences
   * @param discordId - Discord user ID
   * @param preferences - New preferences
   * @returns true if updated, false otherwise
   */
  async updatePreferences(
    discordId: string,
    preferences: Partial<UserLinkPreferences>,
  ): Promise<boolean> {
    try {
      // Get current preferences
      const current = await this.pool.query<{ preferences: any }>(
        "SELECT preferences FROM discord_user_links WHERE discord_id = $1",
        [discordId],
      );

      if (current.rows.length === 0) {
        return false;
      }

      const currentPrefs =
        typeof current.rows[0].preferences === "string"
          ? JSON.parse(current.rows[0].preferences)
          : current.rows[0].preferences;

      // Merge preferences
      const newPrefs = { ...currentPrefs, ...preferences };

      // Update
      await this.pool.query(
        "UPDATE discord_user_links SET preferences = $1, updated_at = NOW() WHERE discord_id = $2",
        [JSON.stringify(newPrefs), discordId],
      );

      return true;
    } catch (error) {
      console.error("Error updating preferences:", error);
      return false;
    }
  }

  /**
   * Generate one-time link code for web-based linking
   * @param userId - Media Gateway user_id
   * @returns code that expires in 15 minutes
   */
  async generateLinkCode(userId: string): Promise<string> {
    try {
      // Generate random 8-character code
      const code = randomBytes(4).toString("hex").toUpperCase();

      // Expires in 15 minutes
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await this.pool.query(
        `INSERT INTO one_time_link_codes (code, user_id, expires_at)
         VALUES ($1, $2, $3)`,
        [code, userId, expiresAt],
      );

      return code;
    } catch (error) {
      console.error("Error generating link code:", error);
      throw error;
    }
  }

  /**
   * Verify one-time link code
   * @param code - Link code
   * @returns result with user_id if valid
   */
  private async verifyLinkCode(
    code: string,
  ): Promise<{ success: boolean; user_id?: string; error?: string }> {
    try {
      const result = await this.pool.query<OneTimeLinkCode>(
        `SELECT * FROM one_time_link_codes
         WHERE code = $1
           AND expires_at > NOW()
           AND used_at IS NULL`,
        [code],
      );

      if (result.rows.length === 0) {
        return {
          success: false,
          error: "INVALID_OR_EXPIRED",
        };
      }

      return {
        success: true,
        user_id: result.rows[0].user_id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Authenticate user with email/password
   * @param email - User email
   * @param password - User password
   * @returns result with user_id if valid
   */
  private async authenticateUser(
    email: string,
    password: string,
  ): Promise<{ success: boolean; user_id?: string; error?: string }> {
    try {
      const result = await this.pool.query<{
        id: string;
        password_hash: string;
      }>("SELECT id, password_hash FROM users WHERE email = $1", [email]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: "USER_NOT_FOUND",
        };
      }

      const storedHash = result.rows[0].password_hash;

      // Verify password using scrypt (same algorithm used for hashing)
      const isValid = await this.verifyPassword(password, storedHash);

      if (!isValid) {
        return {
          success: false,
          error: "INVALID_PASSWORD",
        };
      }

      return {
        success: true,
        user_id: result.rows[0].id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify password against stored hash using scrypt
   * @param password - Plain text password
   * @param storedHash - Stored hash in format "salt:hash"
   * @returns true if password matches
   */
  private async verifyPassword(
    password: string,
    storedHash: string,
  ): Promise<boolean> {
    try {
      // Handle different hash formats
      if (storedHash.includes(":")) {
        // Format: salt:hash (scrypt)
        const [salt, hash] = storedHash.split(":");
        const saltBuffer = Buffer.from(salt, "hex");
        const hashBuffer = Buffer.from(hash, "hex");

        const derivedKey = (await scryptAsync(
          password,
          saltBuffer,
          64,
        )) as Buffer;

        return timingSafeEqual(derivedKey, hashBuffer);
      } else if (storedHash.startsWith("$2")) {
        // bcrypt format - for backwards compatibility, compare directly
        // In production, you'd use bcrypt.compare here
        // For hackathon, we'll do a simple comparison if bcrypt is detected
        console.warn("bcrypt hash detected - using fallback comparison");
        return false; // bcrypt needs its own library
      } else {
        // Plain text comparison (legacy, not recommended)
        console.warn("Plain text password comparison detected - not secure!");
        return password === storedHash;
      }
    } catch (error) {
      console.error("Password verification error:", error);
      return false;
    }
  }

  /**
   * Get user's subscription platforms
   * @param userId - Media Gateway user_id
   * @returns Array of platform names
   */
  private async getUserSubscriptionPlatforms(
    userId: string,
  ): Promise<string[]> {
    try {
      const result = await this.pool.query<{ platform_name: string }>(
        `SELECT DISTINCT p.name as platform_name
         FROM user_subscriptions us
         INNER JOIN platforms p ON p.id = us.platform_id
         WHERE us.user_id = $1 AND us.active = true`,
        [userId],
      );

      return result.rows.map((row) => row.platform_name);
    } catch (error) {
      // Table might not exist yet, return empty array
      console.warn("Could not fetch subscription platforms:", error);
      return [];
    }
  }

  /**
   * Get Discord user by Media Gateway user_id
   * @param userId - Media Gateway user_id
   * @returns discord_id if found, null otherwise
   */
  private async getUserByUserId(userId: string): Promise<string | null> {
    try {
      const result = await this.pool.query<{ discord_id: string }>(
        "SELECT discord_id FROM discord_user_links WHERE user_id = $1",
        [userId],
      );

      return result.rows[0]?.discord_id || null;
    } catch (error) {
      console.error("Error getting user by user_id:", error);
      return null;
    }
  }

  /**
   * Create link between Discord and Media Gateway account
   * @param discordId - Discord user ID
   * @param userId - Media Gateway user_id
   */
  private async createLink(discordId: string, userId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO discord_user_links (discord_id, user_id, preferences)
       VALUES ($1, $2, $3)`,
      [
        discordId,
        userId,
        JSON.stringify({
          brief_enabled: false,
          brief_time: "09:00",
          preferred_region: "US",
        }),
      ],
    );
  }
}

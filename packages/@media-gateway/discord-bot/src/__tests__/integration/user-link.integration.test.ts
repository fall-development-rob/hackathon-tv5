/**
 * Integration tests for User Link functionality
 * Tests full flow with real PostgreSQL database
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PostgreSQLConnectionPool } from "@media-gateway/database";
import { UserLinkService } from "../../services/user-link";
import { readFileSync } from "fs";
import { join } from "path";

describe("UserLinkService Integration Tests", () => {
  let pool: PostgreSQLConnectionPool;
  let service: UserLinkService;
  let testUserId: string;

  beforeAll(async () => {
    // Initialize PostgreSQL connection from environment
    pool = new PostgreSQLConnectionPool({
      host: process.env["DB_HOST"] || "localhost",
      port: parseInt(process.env["DB_PORT"] || "5432"),
      database: process.env["DB_NAME"] || "mediagateway_test",
      user: process.env["DB_USER"] || "postgres",
      password: process.env["DB_PASSWORD"] || "postgres",
      ssl: false,
      minConnections: 1,
      maxConnections: 5,
    });

    await pool.initialize();
    service = new UserLinkService(pool);

    // Run migrations
    const migrationPath = join(
      __dirname,
      "../../migrations/001_create_discord_user_links.sql",
    );
    const migration = readFileSync(migrationPath, "utf-8");

    // Split by semicolons and execute each statement
    const statements = migration.split(";").filter((s) => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await pool.query(statement);
        } catch (error: any) {
          // Ignore errors for already existing objects
          if (!error.message.includes("already exists")) {
            console.error("Migration error:", error);
          }
        }
      }
    }

    // Create test user if not exists
    try {
      const result = await pool.query(
        `INSERT INTO users (id, email, username, password_hash)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING id`,
        ["test-user-123", "test@example.com", "testuser", "hashed_password"],
      );
      testUserId = result.rows[0].id;
    } catch (error) {
      // User might already exist
      const result = await pool.query("SELECT id FROM users WHERE email = $1", [
        "test@example.com",
      ]);
      testUserId = result.rows[0].id;
    }
  });

  afterAll(async () => {
    // Cleanup test data
    await pool.query(
      "DELETE FROM discord_user_links WHERE discord_id LIKE $1",
      ["test-%"],
    );
    await pool.query("DELETE FROM one_time_link_codes WHERE user_id = $1", [
      testUserId,
    ]);
    await pool.close();
  });

  beforeEach(async () => {
    // Clean up before each test
    await pool.query(
      "DELETE FROM discord_user_links WHERE discord_id LIKE $1",
      ["test-%"],
    );
    await pool.query("DELETE FROM one_time_link_codes WHERE user_id = $1", [
      testUserId,
    ]);
  });

  describe("Link with credentials flow", () => {
    it("should successfully link Discord user with valid credentials", async () => {
      const discordId = "test-discord-123";
      const email = "test@example.com";
      const password = "password123";

      const result = await service.linkUserWithCredentials(
        discordId,
        email,
        password,
      );

      expect(result.success).toBe(true);
      expect(result.user_id).toBe(testUserId);

      // Verify link was created
      const isLinked = await service.isLinked(discordId);
      expect(isLinked).toBe(true);

      // Verify user_id matches
      const linkedUserId = await service.getLinkedUser(discordId);
      expect(linkedUserId).toBe(testUserId);
    });

    it("should prevent linking already linked Discord account", async () => {
      const discordId = "test-discord-456";
      const email = "test@example.com";
      const password = "password123";

      // First link
      await service.linkUserWithCredentials(discordId, email, password);

      // Try to link again
      const result = await service.linkUserWithCredentials(
        discordId,
        email,
        password,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("already linked");
    });
  });

  describe("Link with code flow", () => {
    it("should successfully link with valid one-time code", async () => {
      const discordId = "test-discord-789";

      // Generate code
      const code = await service.generateLinkCode(testUserId);
      expect(code).toHaveLength(8);

      // Link with code
      const result = await service.linkUserWithCode(discordId, code);

      expect(result.success).toBe(true);
      expect(result.user_id).toBe(testUserId);

      // Verify link
      const isLinked = await service.isLinked(discordId);
      expect(isLinked).toBe(true);

      // Verify code was marked as used
      const codeCheck = await pool.query(
        "SELECT used_at FROM one_time_link_codes WHERE code = $1",
        [code],
      );
      expect(codeCheck.rows[0].used_at).not.toBeNull();
    });

    it("should reject expired code", async () => {
      const discordId = "test-discord-expired";

      // Manually insert expired code
      const code = "EXPIRED1";
      await pool.query(
        `INSERT INTO one_time_link_codes (code, user_id, expires_at)
         VALUES ($1, $2, NOW() - INTERVAL '1 hour')`,
        [code, testUserId],
      );

      // Try to link with expired code
      const result = await service.linkUserWithCode(discordId, code);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid or expired");
    });

    it("should reject already used code", async () => {
      const discordId1 = "test-discord-used1";
      const discordId2 = "test-discord-used2";

      // Generate and use code
      const code = await service.generateLinkCode(testUserId);
      await service.linkUserWithCode(discordId1, code);

      // Try to use same code again
      // First unlink to allow second attempt
      await service.unlinkUser(discordId1);

      const result = await service.linkUserWithCode(discordId2, code);

      expect(result.success).toBe(false);
    });
  });

  describe("Unlink flow", () => {
    it("should successfully unlink user", async () => {
      const discordId = "test-discord-unlink";

      // Link first
      await service.linkUserWithCredentials(
        discordId,
        "test@example.com",
        "password",
      );

      // Verify linked
      expect(await service.isLinked(discordId)).toBe(true);

      // Unlink
      const result = await service.unlinkUser(discordId);

      expect(result.success).toBe(true);

      // Verify unlinked
      expect(await service.isLinked(discordId)).toBe(false);
    });

    it("should fail to unlink non-linked user", async () => {
      const discordId = "test-discord-notlinked";

      const result = await service.unlinkUser(discordId);

      expect(result.success).toBe(false);
      expect(result.message).toContain("not linked");
    });
  });

  describe("Profile and preferences", () => {
    it("should retrieve full user profile", async () => {
      const discordId = "test-discord-profile";

      // Link user
      await service.linkUserWithCredentials(
        discordId,
        "test@example.com",
        "password",
      );

      // Get profile
      const profile = await service.getUserProfile(discordId);

      expect(profile).not.toBeNull();
      expect(profile?.user_id).toBe(testUserId);
      expect(profile?.discord_id).toBe(discordId);
      expect(profile?.email).toBe("test@example.com");
      expect(profile?.username).toBe("testuser");
      expect(profile?.my_list_count).toBeGreaterThanOrEqual(0);
      expect(profile?.preferences).toBeDefined();
      expect(profile?.preferences.brief_enabled).toBe(false);
      expect(profile?.preferences.brief_time).toBe("09:00");
      expect(profile?.preferences.preferred_region).toBe("US");
    });

    it("should update user preferences", async () => {
      const discordId = "test-discord-prefs";

      // Link user
      await service.linkUserWithCredentials(
        discordId,
        "test@example.com",
        "password",
      );

      // Update preferences
      const updated = await service.updatePreferences(discordId, {
        brief_enabled: true,
        brief_time: "10:30",
        preferred_region: "GB",
      });

      expect(updated).toBe(true);

      // Verify updated
      const profile = await service.getUserProfile(discordId);
      expect(profile?.preferences.brief_enabled).toBe(true);
      expect(profile?.preferences.brief_time).toBe("10:30");
      expect(profile?.preferences.preferred_region).toBe("GB");
    });
  });
});

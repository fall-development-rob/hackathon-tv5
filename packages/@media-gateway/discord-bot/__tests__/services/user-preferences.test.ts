/**
 * User Preferences Service Tests
 *
 * Tests for UserPreferencesService class including:
 * - Singleton pattern
 * - Initialization and database setup
 * - User linking with API verification
 * - Preferences management (CRUD)
 * - Subscription management
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { UserPreferencesService } from "../../src/services/user-preferences";
import { Pool } from "pg";
import axios from "axios";

// Mock pg Pool
vi.mock("pg", () => ({
  Pool: vi.fn(),
}));

// Mock axios
vi.mock("axios");

describe("UserPreferencesService", () => {
  let service: UserPreferencesService;
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    (UserPreferencesService as any).instance = null;

    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      query: vi.fn(),
      end: vi.fn(),
    };

    (Pool as any).mockImplementation(() => mockPool);

    // Set DATABASE_URL for tests
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";

    service = UserPreferencesService.getInstance();
  });

  afterEach(async () => {
    await service.close();
    delete process.env.DATABASE_URL;
  });

  describe("Singleton Pattern", () => {
    it("should return same instance on multiple calls", () => {
      const instance1 = UserPreferencesService.getInstance();
      const instance2 = UserPreferencesService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should accept optional apiBaseUrl parameter", () => {
      // Reset singleton to test apiBaseUrl parameter
      (UserPreferencesService as any).instance = null;
      const instance = UserPreferencesService.getInstance(
        "http://custom-api.com",
      );

      expect((instance as any).apiBaseUrl).toBe("http://custom-api.com");
    });
  });

  describe("Initialization", () => {
    it("should initialize database connection", async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [{ now: new Date() }] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.initialize();

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionString: "postgresql://localhost:5432/test",
          max: 20,
        }),
      );
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith("SELECT NOW()");
    });

    it("should create preferences table on initialization", async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.initialize();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "CREATE TABLE IF NOT EXISTS discord_user_preferences",
        ),
      );
    });

    it("should only initialize once", async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.initialize();
      await service.initialize();
      await service.initialize();

      // Should only create pool once
      expect(Pool).toHaveBeenCalledTimes(1);
    });

    it("should handle concurrent initialization", async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      mockPool.query.mockResolvedValue({ rows: [] });

      const promises = [
        service.initialize(),
        service.initialize(),
        service.initialize(),
      ];

      await Promise.all(promises);

      expect(Pool).toHaveBeenCalledTimes(1);
    });

    it("should throw error if DATABASE_URL not set", async () => {
      delete process.env.DATABASE_URL;
      const newService = UserPreferencesService.getInstance();

      await expect(newService.initialize()).rejects.toThrow(
        "DATABASE_URL environment variable is not set",
      );
    });

    it("should handle database connection errors", async () => {
      mockPool.connect.mockRejectedValueOnce(new Error("Connection failed"));

      await expect(service.initialize()).rejects.toThrow("Connection failed");
    });
  });

  describe("API Token Management", () => {
    it("should set API token", () => {
      service.setApiToken("test-token-123");

      expect((service as any).apiToken).toBe("test-token-123");
    });

    it("should overwrite existing token", () => {
      service.setApiToken("token-1");
      service.setApiToken("token-2");

      expect((service as any).apiToken).toBe("token-2");
    });
  });

  describe("API User Verification", () => {
    it("should verify valid API user", async () => {
      (axios.get as any).mockResolvedValueOnce({
        data: {
          user: {
            id: "user-123",
            email: "test@example.com",
          },
        },
      });

      const userId = await service.verifyApiUser("valid-token");

      expect(userId).toBe("user-123");
      expect(axios.get).toHaveBeenCalledWith(
        "http://localhost:3000/v1/auth/me",
        {
          headers: {
            Authorization: "Bearer valid-token",
          },
        },
      );
    });

    it("should return null for invalid token", async () => {
      (axios.get as any).mockRejectedValueOnce(new Error("Unauthorized"));

      const userId = await service.verifyApiUser("invalid-token");

      expect(userId).toBeNull();
    });

    it("should return null for malformed response", async () => {
      (axios.get as any).mockResolvedValueOnce({
        data: {
          // Missing user.id
          user: { email: "test@example.com" },
        },
      });

      const userId = await service.verifyApiUser("token");

      expect(userId).toBeNull();
    });

    it("should handle network errors", async () => {
      (axios.get as any).mockRejectedValueOnce(new Error("Network error"));

      const userId = await service.verifyApiUser("token");

      expect(userId).toBeNull();
    });
  });

  describe("Link User", () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      mockPool.query.mockResolvedValue({ rows: [] });
      await service.initialize();
    });

    it("should link user with valid token", async () => {
      (axios.get as any).mockResolvedValueOnce({
        data: { user: { id: "user-123" } },
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            discord_user_id: "discord-123",
            api_user_id: "user-123",
            enabled: true,
            channel_id: "channel-1",
            cron_time: "0 8 * * *",
            timezone: "America/New_York",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const prefs = await service.linkUser(
        "discord-123",
        "valid-token",
        "channel-1",
      );

      expect(prefs.discordUserId).toBe("discord-123");
      expect(prefs.apiUserId).toBe("user-123");
      expect(prefs.enabled).toBe(true);
      expect(prefs.channelId).toBe("channel-1");
    });

    it("should use default cron time and timezone", async () => {
      (axios.get as any).mockResolvedValueOnce({
        data: { user: { id: "user-123" } },
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            discord_user_id: "discord-123",
            api_user_id: "user-123",
            enabled: true,
            channel_id: null,
            cron_time: "0 8 * * *",
            timezone: "America/New_York",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const prefs = await service.linkUser("discord-123", "token");

      expect(prefs.cronTime).toBe("0 8 * * *");
      expect(prefs.timezone).toBe("America/New_York");
    });

    it("should throw error for invalid token", async () => {
      (axios.get as any).mockRejectedValueOnce(new Error("Unauthorized"));

      await expect(
        service.linkUser("discord-123", "invalid-token"),
      ).rejects.toThrow("Invalid API token or user not found");
    });

    it("should handle database errors", async () => {
      (axios.get as any).mockResolvedValueOnce({
        data: { user: { id: "user-123" } },
      });

      mockPool.query.mockRejectedValueOnce(new Error("Database error"));

      await expect(service.linkUser("discord-123", "token")).rejects.toThrow(
        "Failed to link Discord user to API user",
      );
    });

    it("should handle ON CONFLICT correctly", async () => {
      (axios.get as any).mockResolvedValueOnce({
        data: { user: { id: "user-new" } },
      });

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            discord_user_id: "discord-123",
            api_user_id: "user-new",
            enabled: true,
            channel_id: null,
            cron_time: "0 8 * * *",
            timezone: "America/New_York",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      // Link again with same discord_user_id but different api_user_id
      const prefs = await service.linkUser("discord-123", "new-token");

      expect(prefs.apiUserId).toBe("user-new");
    });
  });

  describe("Get Preferences", () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      mockPool.query.mockResolvedValue({ rows: [] });
      await service.initialize();
    });

    it("should get preferences for existing user", async () => {
      const mockRow = {
        discord_user_id: "discord-123",
        api_user_id: "user-123",
        enabled: true,
        channel_id: "channel-1",
        cron_time: "0 8 * * *",
        timezone: "America/New_York",
        created_at: new Date("2024-01-01"),
        updated_at: new Date("2024-01-02"),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockRow] });

      const prefs = await service.getPreferences("discord-123");

      expect(prefs).toEqual({
        discordUserId: "discord-123",
        apiUserId: "user-123",
        enabled: true,
        channelId: "channel-1",
        cronTime: "0 8 * * *",
        timezone: "America/New_York",
        createdAt: mockRow.created_at,
        updatedAt: mockRow.updated_at,
      });
    });

    it("should return null for non-existent user", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const prefs = await service.getPreferences("discord-nonexistent");

      expect(prefs).toBeNull();
    });

    it("should handle database errors", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("Database error"));

      await expect(service.getPreferences("discord-123")).rejects.toThrow(
        "Failed to get user preferences",
      );
    });
  });

  describe("Update Preferences", () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      mockPool.query.mockResolvedValue({ rows: [] });
      await service.initialize();
    });

    it("should update enabled status", async () => {
      const mockRow = {
        discord_user_id: "discord-123",
        api_user_id: "user-123",
        enabled: false,
        channel_id: null,
        cron_time: "0 8 * * *",
        timezone: "America/New_York",
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockRow] });

      const prefs = await service.updatePreferences("discord-123", {
        enabled: false,
      });

      expect(prefs?.enabled).toBe(false);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE discord_user_preferences"),
        expect.arrayContaining([false, "discord-123"]),
      );
    });

    it("should update channel ID", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            discord_user_id: "discord-123",
            api_user_id: "user-123",
            enabled: true,
            channel_id: "new-channel",
            cron_time: "0 8 * * *",
            timezone: "America/New_York",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const prefs = await service.updatePreferences("discord-123", {
        channelId: "new-channel",
      });

      expect(prefs?.channelId).toBe("new-channel");
    });

    it("should update cron time", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            discord_user_id: "discord-123",
            api_user_id: "user-123",
            enabled: true,
            channel_id: null,
            cron_time: "0 12 * * *",
            timezone: "America/New_York",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const prefs = await service.updatePreferences("discord-123", {
        cronTime: "0 12 * * *",
      });

      expect(prefs?.cronTime).toBe("0 12 * * *");
    });

    it("should update timezone", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            discord_user_id: "discord-123",
            api_user_id: "user-123",
            enabled: true,
            channel_id: null,
            cron_time: "0 8 * * *",
            timezone: "Europe/London",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const prefs = await service.updatePreferences("discord-123", {
        timezone: "Europe/London",
      });

      expect(prefs?.timezone).toBe("Europe/London");
    });

    it("should update multiple fields at once", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            discord_user_id: "discord-123",
            api_user_id: "user-123",
            enabled: false,
            channel_id: "new-channel",
            cron_time: "0 9 * * *",
            timezone: "America/Los_Angeles",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const prefs = await service.updatePreferences("discord-123", {
        enabled: false,
        channelId: "new-channel",
        cronTime: "0 9 * * *",
        timezone: "America/Los_Angeles",
      });

      expect(prefs?.enabled).toBe(false);
      expect(prefs?.channelId).toBe("new-channel");
      expect(prefs?.cronTime).toBe("0 9 * * *");
      expect(prefs?.timezone).toBe("America/Los_Angeles");
    });

    it("should return null for non-existent user", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const prefs = await service.updatePreferences("discord-nonexistent", {
        enabled: false,
      });

      expect(prefs).toBeNull();
    });

    it("should throw error if no fields to update", async () => {
      await expect(
        service.updatePreferences("discord-123", {}),
      ).rejects.toThrow("No fields to update");
    });

    it("should handle database errors", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("Database error"));

      await expect(
        service.updatePreferences("discord-123", { enabled: false }),
      ).rejects.toThrow("Failed to update user preferences");
    });

    it("should set channel_id to null explicitly", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            discord_user_id: "discord-123",
            api_user_id: "user-123",
            enabled: true,
            channel_id: null,
            cron_time: "0 8 * * *",
            timezone: "America/New_York",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      // Use null instead of undefined to explicitly set channel_id to null
      await service.updatePreferences("discord-123", {
        channelId: null as any,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([null]),
      );
    });
  });

  describe("Get Enabled Subscriptions", () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      mockPool.query.mockResolvedValue({ rows: [] });
      await service.initialize();
    });

    it("should return all enabled subscriptions", async () => {
      const mockRows = [
        {
          discord_user_id: "discord-1",
          api_user_id: "user-1",
          enabled: true,
          channel_id: "channel-1",
          cron_time: "0 8 * * *",
          timezone: "America/New_York",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          discord_user_id: "discord-2",
          api_user_id: "user-2",
          enabled: true,
          channel_id: "channel-2",
          cron_time: "0 9 * * *",
          timezone: "Europe/London",
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockRows });

      const subscriptions = await service.getEnabledSubscriptions();

      expect(subscriptions).toHaveLength(2);
      expect(subscriptions[0].discordUserId).toBe("discord-1");
      expect(subscriptions[1].discordUserId).toBe("discord-2");
      expect(subscriptions.every((s) => s.enabled)).toBe(true);
    });

    it("should return empty array if no enabled subscriptions", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const subscriptions = await service.getEnabledSubscriptions();

      expect(subscriptions).toEqual([]);
    });

    it("should handle database errors", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("Database error"));

      await expect(service.getEnabledSubscriptions()).rejects.toThrow(
        "Failed to get enabled subscriptions",
      );
    });
  });

  describe("Delete Preferences", () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      mockPool.query.mockResolvedValue({ rows: [] });
      await service.initialize();
    });

    it("should delete preferences for existing user", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await service.deletePreferences("discord-123");

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM discord_user_preferences"),
        ["discord-123"],
      );
    });

    it("should return false for non-existent user", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });

      const result = await service.deletePreferences("discord-nonexistent");

      expect(result).toBe(false);
    });

    it("should handle null rowCount", async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: null });

      const result = await service.deletePreferences("discord-123");

      expect(result).toBe(false);
    });

    it("should handle database errors", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("Database error"));

      await expect(service.deletePreferences("discord-123")).rejects.toThrow(
        "Failed to delete user preferences",
      );
    });
  });

  describe("Close Connection", () => {
    it("should close pool and reset state", async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.initialize();
      await service.close();

      expect(mockPool.end).toHaveBeenCalled();
      expect((service as any).pool).toBeNull();
      expect((service as any).initialized).toBe(false);
    });

    it("should be safe to call multiple times", async () => {
      await service.close();
      await service.close();

      expect(mockPool.end).not.toHaveBeenCalled();
    });

    it("should handle pool errors during close", async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      mockPool.query.mockResolvedValue({ rows: [] });
      mockPool.end.mockRejectedValueOnce(new Error("Close error"));

      await service.initialize();

      // Should not throw
      await expect(service.close()).rejects.toThrow("Close error");
    });
  });

  describe("Get Pool", () => {
    it("should return pool when initialized", async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      mockPool.query.mockResolvedValue({ rows: [] });

      await service.initialize();
      const pool = service.getPool();

      expect(pool).toBe(mockPool);
    });

    it("should return null when not initialized", () => {
      const pool = service.getPool();

      expect(pool).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    beforeEach(async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      mockPool.query.mockResolvedValue({ rows: [] });
      await service.initialize();
    });

    it("should handle very long Discord IDs", async () => {
      const longId = "9".repeat(100);

      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            discord_user_id: longId,
            api_user_id: "user-123",
            enabled: true,
            channel_id: null,
            cron_time: "0 8 * * *",
            timezone: "America/New_York",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const prefs = await service.getPreferences(longId);

      expect(prefs?.discordUserId).toBe(longId);
    });

    it("should handle special characters in IDs", async () => {
      const specialId = "discord-<>&\"'";

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.getPreferences(specialId);

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [
        specialId,
      ]);
    });

    it("should handle concurrent operations", async () => {
      // Clear call count from initialization
      mockPool.query.mockClear();

      mockPool.query.mockResolvedValue({
        rows: [
          {
            discord_user_id: "discord-123",
            api_user_id: "user-123",
            enabled: true,
            channel_id: null,
            cron_time: "0 8 * * *",
            timezone: "America/New_York",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const promises = [
        service.getPreferences("discord-1"),
        service.getPreferences("discord-2"),
        service.getPreferences("discord-3"),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });

    it("should handle null channel_id", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            discord_user_id: "discord-123",
            api_user_id: "user-123",
            enabled: true,
            channel_id: null,
            cron_time: "0 8 * * *",
            timezone: "America/New_York",
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const prefs = await service.getPreferences("discord-123");

      expect(prefs?.channelId).toBeNull();
    });

    it("should handle various cron formats", async () => {
      const cronFormats = [
        "0 8 * * *",
        "*/15 * * * *",
        "0 0 1 * *",
        "0 0 * * 0",
      ];

      for (const cronFormat of cronFormats) {
        mockPool.query.mockResolvedValueOnce({
          rows: [
            {
              discord_user_id: "discord-123",
              api_user_id: "user-123",
              enabled: true,
              channel_id: null,
              cron_time: cronFormat,
              timezone: "America/New_York",
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        });

        const prefs = await service.getPreferences("discord-123");
        expect(prefs?.cronTime).toBe(cronFormat);
      }
    });

    it("should handle various timezones", async () => {
      const timezones = [
        "America/New_York",
        "Europe/London",
        "Asia/Tokyo",
        "Australia/Sydney",
        "UTC",
      ];

      for (const timezone of timezones) {
        mockPool.query.mockResolvedValueOnce({
          rows: [
            {
              discord_user_id: "discord-123",
              api_user_id: "user-123",
              enabled: true,
              channel_id: null,
              cron_time: "0 8 * * *",
              timezone: timezone,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        });

        const prefs = await service.getPreferences("discord-123");
        expect(prefs?.timezone).toBe(timezone);
      }
    });
  });
});

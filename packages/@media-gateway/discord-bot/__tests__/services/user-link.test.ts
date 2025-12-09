/**
 * User Link Service Tests
 *
 * Tests for UserLinkService class including:
 * - Constructor and initialization
 * - Link user with credentials
 * - Link user with code
 * - Unlink user
 * - Get linked user
 * - User profile management
 * - Preferences management
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserLinkService } from "../../src/services/user-link";
import type { PostgreSQLConnectionPool } from "@media-gateway/database";

// Mock database pool
const createMockPool = () => ({
  query: vi.fn(),
  transaction: vi.fn(),
});

describe("UserLinkService", () => {
  let service: UserLinkService;
  let mockPool: any;

  beforeEach(() => {
    mockPool = createMockPool();
    service = new UserLinkService(mockPool);
    // Mock the private verifyPassword method to return true for test passwords
    vi.spyOn(service as any, "verifyPassword").mockResolvedValue(true);
    // Mock the private getUserSubscriptionPlatforms method
    vi.spyOn(service as any, "getUserSubscriptionPlatforms").mockResolvedValue(
      [],
    );
  });

  describe("Constructor and Initialization", () => {
    it("should initialize with pool", () => {
      expect(service).toBeDefined();
      expect((service as any).pool).toBe(mockPool);
    });
  });

  describe("Link User with Credentials", () => {
    it("should successfully link user with valid credentials", async () => {
      // Mock authentication success
      mockPool.query
        .mockResolvedValueOnce({
          // authenticateUser query
          rows: [{ id: "user-123", password_hash: "hash" }],
        })
        .mockResolvedValueOnce({
          // getLinkedUser query
          rows: [],
        })
        .mockResolvedValueOnce({
          // getUserByUserId query
          rows: [],
        })
        .mockResolvedValueOnce({
          // createLink query
          rows: [{}],
        });

      const result = await service.linkUserWithCredentials(
        "discord-123",
        "user@example.com",
        "password123",
      );

      expect(result.success).toBe(true);
      expect(result.user_id).toBe("user-123");
      expect(result.message).toContain("Successfully linked");
    });

    it("should fail with invalid credentials", async () => {
      // Mock authentication failure
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      const result = await service.linkUserWithCredentials(
        "discord-123",
        "wrong@example.com",
        "wrongpassword",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid email or password");
    });

    it("should fail if Discord user already linked", async () => {
      mockPool.query
        .mockResolvedValueOnce({
          // authenticateUser
          rows: [{ id: "user-123", password_hash: "hash" }],
        })
        .mockResolvedValueOnce({
          // getLinkedUser - already exists
          rows: [{ user_id: "existing-user" }],
        });

      const result = await service.linkUserWithCredentials(
        "discord-123",
        "user@example.com",
        "password123",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("already linked");
      expect(result.user_id).toBe("existing-user");
    });

    it("should fail if user_id already linked to another Discord account", async () => {
      mockPool.query
        .mockResolvedValueOnce({
          // authenticateUser
          rows: [{ id: "user-123", password_hash: "hash" }],
        })
        .mockResolvedValueOnce({
          // getLinkedUser
          rows: [],
        })
        .mockResolvedValueOnce({
          // getUserByUserId - already linked
          rows: [{ discord_id: "other-discord" }],
        });

      const result = await service.linkUserWithCredentials(
        "discord-123",
        "user@example.com",
        "password123",
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain(
        "already linked to another Discord account",
      );
      expect(result.error).toBe("ALREADY_LINKED_TO_OTHER_DISCORD");
    });

    it("should handle database errors", async () => {
      // DB error during authentication returns "Invalid email or password"
      // because authenticateUser catches the error internally
      mockPool.query.mockRejectedValueOnce(new Error("Database error"));

      const result = await service.linkUserWithCredentials(
        "discord-123",
        "user@example.com",
        "password123",
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe("Invalid email or password");
    });
  });

  describe("Link User with Code", () => {
    it("should successfully link user with valid code", async () => {
      mockPool.query
        .mockResolvedValueOnce({
          // verifyLinkCode
          rows: [
            {
              code: "ABC123",
              user_id: "user-456",
              expires_at: new Date(Date.now() + 10000),
            },
          ],
        })
        .mockResolvedValueOnce({
          // getLinkedUser
          rows: [],
        });

      mockPool.transaction.mockImplementationOnce(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockResolvedValue({ rows: [] }),
        };
        await callback(mockClient);
      });

      const result = await service.linkUserWithCode("discord-123", "ABC123");

      expect(result.success).toBe(true);
      expect(result.user_id).toBe("user-456");
      expect(result.message).toContain("Successfully linked");
    });

    it("should fail with invalid code", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      const result = await service.linkUserWithCode("discord-123", "INVALID");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid or expired");
    });

    it("should fail with expired code", async () => {
      // The SQL query checks expires_at > NOW() in the database,
      // so an expired code returns empty rows
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      const result = await service.linkUserWithCode("discord-123", "EXPIRED");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid or expired");
    });

    it("should fail if Discord user already linked", async () => {
      mockPool.query
        .mockResolvedValueOnce({
          // verifyLinkCode
          rows: [
            {
              code: "ABC123",
              user_id: "user-456",
              expires_at: new Date(Date.now() + 10000),
            },
          ],
        })
        .mockResolvedValueOnce({
          // getLinkedUser - already exists
          rows: [{ user_id: "existing-user" }],
        });

      const result = await service.linkUserWithCode("discord-123", "ABC123");

      expect(result.success).toBe(false);
      expect(result.message).toContain("already linked");
    });

    it("should handle transaction errors", async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              code: "ABC123",
              user_id: "user-456",
              expires_at: new Date(Date.now() + 10000),
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      mockPool.transaction.mockRejectedValueOnce(
        new Error("Transaction failed"),
      );

      const result = await service.linkUserWithCode("discord-123", "ABC123");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Failed to link accounts");
    });
  });

  describe("Unlink User", () => {
    it("should successfully unlink user", async () => {
      mockPool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ user_id: "user-123" }],
      });

      const result = await service.unlinkUser("discord-123");

      expect(result.success).toBe(true);
      expect(result.message).toContain("Successfully unlinked");
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM discord_user_links"),
        ["discord-123"],
      );
    });

    it("should fail if user not linked", async () => {
      mockPool.query.mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });

      const result = await service.unlinkUser("discord-123");

      expect(result.success).toBe(false);
      expect(result.message).toContain("not linked");
    });

    it("should handle database errors", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("Database error"));

      const result = await service.unlinkUser("discord-123");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Failed to unlink accounts");
    });
  });

  describe("Get Linked User", () => {
    it("should return user_id for linked Discord user", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: "user-123" }],
      });

      const userId = await service.getLinkedUser("discord-123");

      expect(userId).toBe("user-123");
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT user_id FROM discord_user_links"),
        ["discord-123"],
      );
    });

    it("should return null for unlinked Discord user", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      const userId = await service.getLinkedUser("discord-123");

      expect(userId).toBeNull();
    });

    it("should handle database errors gracefully", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("Database error"));

      const userId = await service.getLinkedUser("discord-123");

      expect(userId).toBeNull();
    });
  });

  describe("Is Linked", () => {
    it("should return true for linked user", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: "user-123" }],
      });

      const isLinked = await service.isLinked("discord-123");

      expect(isLinked).toBe(true);
    });

    it("should return false for unlinked user", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      const isLinked = await service.isLinked("discord-123");

      expect(isLinked).toBe(false);
    });
  });

  describe("Get User Profile", () => {
    it("should return complete user profile", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            user_id: "user-123",
            discord_id: "discord-123",
            username: "testuser",
            email: "test@example.com",
            my_list_count: "5",
            preferences: JSON.stringify({
              brief_enabled: true,
              brief_time: "09:00",
              preferred_region: "US",
            }),
            linked_at: new Date("2024-01-01"),
          },
        ],
      });

      const profile = await service.getUserProfile("discord-123");

      expect(profile).toEqual({
        user_id: "user-123",
        discord_id: "discord-123",
        username: "testuser",
        email: "test@example.com",
        my_list_count: 5,
        subscription_platforms: [],
        preferences: {
          brief_enabled: true,
          brief_time: "09:00",
          preferred_region: "US",
        },
        linked_at: new Date("2024-01-01"),
      });
    });

    it("should handle string preferences", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            user_id: "user-123",
            discord_id: "discord-123",
            username: "testuser",
            email: "test@example.com",
            my_list_count: "0",
            preferences:
              '{"brief_enabled":false,"brief_time":"08:00","preferred_region":"GB"}',
            linked_at: new Date(),
          },
        ],
      });

      const profile = await service.getUserProfile("discord-123");

      expect(profile?.preferences).toEqual({
        brief_enabled: false,
        brief_time: "08:00",
        preferred_region: "GB",
      });
    });

    it("should return null for non-existent user", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      const profile = await service.getUserProfile("discord-123");

      expect(profile).toBeNull();
    });

    it("should handle database errors", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("Database error"));

      const profile = await service.getUserProfile("discord-123");

      expect(profile).toBeNull();
    });
  });

  describe("Update Preferences", () => {
    it("should update preferences successfully", async () => {
      mockPool.query
        .mockResolvedValueOnce({
          // Get current preferences
          rows: [
            {
              preferences: JSON.stringify({
                brief_enabled: false,
                brief_time: "08:00",
                preferred_region: "US",
              }),
            },
          ],
        })
        .mockResolvedValueOnce({
          // Update preferences
          rows: [{}],
        });

      const result = await service.updatePreferences("discord-123", {
        brief_enabled: true,
        brief_time: "09:00",
      });

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it("should merge with existing preferences", async () => {
      const existingPrefs = {
        brief_enabled: false,
        brief_time: "08:00",
        preferred_region: "US",
      };

      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ preferences: JSON.stringify(existingPrefs) }],
        })
        .mockResolvedValueOnce({
          rows: [{}],
        });

      await service.updatePreferences("discord-123", {
        brief_enabled: true,
      });

      const updateCall = mockPool.query.mock.calls[1];
      const updatedPrefs = JSON.parse(updateCall[1][0]);

      expect(updatedPrefs).toEqual({
        ...existingPrefs,
        brief_enabled: true,
      });
    });

    it("should return false for non-existent user", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      const result = await service.updatePreferences("discord-123", {
        brief_enabled: true,
      });

      expect(result).toBe(false);
    });

    it("should handle database errors", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("Database error"));

      const result = await service.updatePreferences("discord-123", {
        brief_enabled: true,
      });

      expect(result).toBe(false);
    });
  });

  describe("Generate Link Code", () => {
    it("should generate valid link code", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const code = await service.generateLinkCode("user-123");

      expect(code).toBeDefined();
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[0-9A-F]+$/);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO one_time_link_codes"),
        expect.arrayContaining([code, "user-123", expect.any(Date)]),
      );
    });

    it("should set 15 minute expiration", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const beforeTime = Date.now();
      await service.generateLinkCode("user-123");
      const afterTime = Date.now();

      const expiresAt = mockPool.query.mock.calls[0][1][2];
      const expirationTime = expiresAt.getTime();

      expect(expirationTime).toBeGreaterThan(beforeTime + 14 * 60 * 1000);
      expect(expirationTime).toBeLessThan(afterTime + 16 * 60 * 1000);
    });

    it("should handle database errors", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("Database error"));

      await expect(service.generateLinkCode("user-123")).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle special characters in Discord IDs", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: "user-123" }],
      });

      const userId = await service.getLinkedUser("discord-<>&\"'");

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [
        "discord-<>&\"'",
      ]);
    });

    it("should handle special characters in emails", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: "user-123", password_hash: "hash" }],
      });

      await service.linkUserWithCredentials(
        "discord-123",
        "test+tag@example.com",
        "password",
      );

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [
        "test+tag@example.com",
      ]);
    });

    it("should handle concurrent operations", async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ user_id: "user-123" }],
      });

      const promises = [
        service.getLinkedUser("discord-1"),
        service.getLinkedUser("discord-2"),
        service.getLinkedUser("discord-3"),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r === "user-123")).toBe(true);
    });

    it("should handle empty preferences object", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ preferences: "{}" }],
      });

      const profile = await service.getUserProfile("discord-123");

      expect(profile?.preferences).toEqual({});
    });

    it("should handle null my_list_count", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            user_id: "user-123",
            discord_id: "discord-123",
            username: "testuser",
            email: "test@example.com",
            my_list_count: null,
            preferences: "{}",
            linked_at: new Date(),
          },
        ],
      });

      const profile = await service.getUserProfile("discord-123");

      expect(profile?.my_list_count).toBe(0);
    });

    it("should handle very long user IDs", async () => {
      const longId = "a".repeat(1000);

      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: longId }],
      });

      const userId = await service.getLinkedUser("discord-123");

      expect(userId).toBe(longId);
    });
  });
});

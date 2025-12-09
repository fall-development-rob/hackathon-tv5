/**
 * Unit tests for UserLinkService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { UserLinkService } from "../../services/user-link";
import { PostgreSQLConnectionPool } from "@media-gateway/database";

describe("UserLinkService", () => {
  let service: UserLinkService;
  let mockPool: PostgreSQLConnectionPool;

  beforeEach(() => {
    // Create mock pool
    mockPool = {
      query: vi.fn(),
      transaction: vi.fn(),
      initialize: vi.fn(),
      close: vi.fn(),
      isInitialized: vi.fn().mockReturnValue(true),
    } as any;

    service = new UserLinkService(mockPool);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("linkUserWithCode", () => {
    it("should successfully link user with valid code", async () => {
      const discordId = "123456789";
      const code = "ABCD1234";
      const userId = "user-123";

      // Mock code verification
      vi.mocked(mockPool.query)
        .mockResolvedValueOnce({
          rows: [
            { code, user_id: userId, expires_at: new Date(Date.now() + 10000) },
          ],
          rowCount: 1,
        } as any)
        // Mock existing link check
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        } as any);

      // Mock transaction
      vi.mocked(mockPool.transaction).mockImplementation(
        async (callback: any) => {
          const mockClient = {
            query: vi.fn(),
          };
          return await callback(mockClient);
        },
      );

      const result = await service.linkUserWithCode(discordId, code);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Successfully linked");
      expect(result.user_id).toBe(userId);
    });

    it("should fail with invalid code", async () => {
      const discordId = "123456789";
      const code = "INVALID";

      // Mock code verification - no results
      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await service.linkUserWithCode(discordId, code);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid or expired");
    });

    it("should fail if user is already linked", async () => {
      const discordId = "123456789";
      const code = "ABCD1234";
      const userId = "user-123";

      // Mock code verification
      vi.mocked(mockPool.query)
        .mockResolvedValueOnce({
          rows: [
            { code, user_id: userId, expires_at: new Date(Date.now() + 10000) },
          ],
          rowCount: 1,
        } as any)
        // Mock existing link check - already linked
        .mockResolvedValueOnce({
          rows: [{ user_id: "existing-user" }],
          rowCount: 1,
        } as any);

      const result = await service.linkUserWithCode(discordId, code);

      expect(result.success).toBe(false);
      expect(result.message).toContain("already linked");
    });
  });

  describe("linkUserWithCredentials", () => {
    it("should successfully link user with valid credentials", async () => {
      const discordId = "123456789";
      const email = "test@example.com";
      const password = "password123";
      const userId = "user-123";

      // Mock authentication
      vi.mocked(mockPool.query)
        .mockResolvedValueOnce({
          rows: [{ id: userId, password_hash: "hashed" }],
          rowCount: 1,
        } as any)
        // Mock existing Discord link check
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        } as any)
        // Mock existing user link check
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        } as any)
        // Mock insert
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
        } as any);

      const result = await service.linkUserWithCredentials(
        discordId,
        email,
        password,
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("Successfully linked");
      expect(result.user_id).toBe(userId);
    });

    it("should fail with invalid credentials", async () => {
      const discordId = "123456789";
      const email = "test@example.com";
      const password = "wrong";

      // Mock authentication failure
      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await service.linkUserWithCredentials(
        discordId,
        email,
        password,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid email or password");
    });
  });

  describe("unlinkUser", () => {
    it("should successfully unlink user", async () => {
      const discordId = "123456789";

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [{ user_id: "user-123" }],
        rowCount: 1,
      } as any);

      const result = await service.unlinkUser(discordId);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Successfully unlinked");
    });

    it("should fail if user is not linked", async () => {
      const discordId = "123456789";

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await service.unlinkUser(discordId);

      expect(result.success).toBe(false);
      expect(result.message).toContain("not linked");
    });
  });

  describe("getLinkedUser", () => {
    it("should return user_id for linked user", async () => {
      const discordId = "123456789";
      const userId = "user-123";

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [{ user_id: userId }],
        rowCount: 1,
      } as any);

      const result = await service.getLinkedUser(discordId);

      expect(result).toBe(userId);
    });

    it("should return null for non-linked user", async () => {
      const discordId = "123456789";

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await service.getLinkedUser(discordId);

      expect(result).toBeNull();
    });
  });

  describe("isLinked", () => {
    it("should return true for linked user", async () => {
      const discordId = "123456789";

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [{ user_id: "user-123" }],
        rowCount: 1,
      } as any);

      const result = await service.isLinked(discordId);

      expect(result).toBe(true);
    });

    it("should return false for non-linked user", async () => {
      const discordId = "123456789";

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await service.isLinked(discordId);

      expect(result).toBe(false);
    });
  });

  describe("getUserProfile", () => {
    it("should return full profile for linked user", async () => {
      const discordId = "123456789";
      const mockProfile = {
        user_id: "user-123",
        discord_id: discordId,
        username: "testuser",
        email: "test@example.com",
        my_list_count: "5",
        preferences: JSON.stringify({
          brief_enabled: true,
          brief_time: "09:00",
          preferred_region: "US",
        }),
        linked_at: new Date(),
      };

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [mockProfile],
        rowCount: 1,
      } as any);

      const result = await service.getUserProfile(discordId);

      expect(result).not.toBeNull();
      expect(result?.user_id).toBe("user-123");
      expect(result?.username).toBe("testuser");
      expect(result?.my_list_count).toBe(5);
      expect(result?.preferences.brief_enabled).toBe(true);
    });

    it("should return null for non-linked user", async () => {
      const discordId = "123456789";

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await service.getUserProfile(discordId);

      expect(result).toBeNull();
    });
  });

  describe("updatePreferences", () => {
    it("should successfully update preferences", async () => {
      const discordId = "123456789";
      const newPrefs = {
        brief_enabled: true,
        brief_time: "10:00",
      };

      // Mock getting current preferences
      vi.mocked(mockPool.query)
        .mockResolvedValueOnce({
          rows: [
            {
              preferences: JSON.stringify({
                brief_enabled: false,
                brief_time: "09:00",
                preferred_region: "US",
              }),
            },
          ],
          rowCount: 1,
        } as any)
        // Mock update
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 1,
        } as any);

      const result = await service.updatePreferences(discordId, newPrefs);

      expect(result).toBe(true);
    });

    it("should fail if user is not linked", async () => {
      const discordId = "123456789";
      const newPrefs = { brief_enabled: true };

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      } as any);

      const result = await service.updatePreferences(discordId, newPrefs);

      expect(result).toBe(false);
    });
  });

  describe("generateLinkCode", () => {
    it("should generate 8-character code", async () => {
      const userId = "user-123";

      vi.mocked(mockPool.query).mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      } as any);

      const code = await service.generateLinkCode(userId);

      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[A-F0-9]+$/);
    });
  });
});

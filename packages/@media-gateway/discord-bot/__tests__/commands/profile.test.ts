/**
 * Profile Command Tests
 *
 * Unit tests for the /profile command
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { data as profileData, execute } from "../../src/commands/profile";
import type { CommandInteraction } from "discord.js";

// Mock UserLinkService
const mockIsLinked = vi.fn();
const mockGetUserProfile = vi.fn();

vi.mock("../../src/services/user-link", () => ({
  UserLinkService: vi.fn().mockImplementation(() => ({
    isLinked: mockIsLinked,
    getUserProfile: mockGetUserProfile,
  })),
}));

const mockDeferReply = vi.fn().mockResolvedValue(undefined);
const mockEditReply = vi.fn().mockResolvedValue(undefined);

const createMockInteraction = (): CommandInteraction => {
  return {
    deferReply: mockDeferReply,
    editReply: mockEditReply,
    user: {
      id: "discord123",
      username: "testuser",
      displayAvatarURL: () => "https://cdn.discord.com/avatar.png",
    },
  } as unknown as CommandInteraction;
};

const mockPool = {} as any;

const mockProfile = {
  user_id: "user-uuid-12345678-1234-1234-1234-123456789012",
  email: "test@example.com",
  username: "testuser",
  linked_at: "2024-01-15T10:30:00Z",
  my_list_count: 15,
  subscription_platforms: ["Netflix", "Disney+", "HBO Max"],
  preferences: {
    brief_enabled: true,
    brief_time: "08:00",
    preferred_region: "US",
  },
};

describe("profileCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Slash Command Data", () => {
    it("should have correct command name", () => {
      expect(profileData.name).toBe("profile");
    });

    it("should have correct description", () => {
      expect(profileData.description).toBe(
        "View your Media Gateway profile and linked account info",
      );
    });

    it("should have no required options", () => {
      expect(profileData.options).toEqual([]);
    });
  });

  describe("Execute Function", () => {
    it("should defer ephemeral reply", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      expect(mockDeferReply).toHaveBeenCalledWith({ ephemeral: true });
    });

    it("should check if user is linked", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      expect(mockIsLinked).toHaveBeenCalledWith("discord123");
    });
  });

  describe("Not Linked Scenario", () => {
    it("should show not linked message", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      expect(mockEditReply).toHaveBeenCalled();
      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.title).toContain("Not Linked");
    });

    it("should explain benefits of linking", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      const benefitsField = reply.embeds[0].data.fields?.find((f: any) =>
        f.name.includes("Why Link"),
      );
      expect(benefitsField).toBeDefined();
      expect(benefitsField?.value).toContain("My List");
    });

    it("should provide instructions to link", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      const instructionsField = reply.embeds[0].data.fields?.find((f: any) =>
        f.name.includes("Get Started"),
      );
      expect(instructionsField).toBeDefined();
      expect(instructionsField?.value).toContain("/link");
    });

    it("should have warning color for not linked", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.color).toBe(0xff9900); // Orange/warning
    });
  });

  describe("Linked Scenario", () => {
    it("should fetch user profile", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce(mockProfile);

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      expect(mockGetUserProfile).toHaveBeenCalledWith("discord123");
    });

    it("should display profile information", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce(mockProfile);

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.title).toContain("Profile");
      expect(reply.embeds[0].data.description).toContain("Linked since");
    });

    it("should display email", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce(mockProfile);

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      const emailField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "📧 Email",
      );
      expect(emailField).toBeDefined();
      expect(emailField?.value).toBe("test@example.com");
    });

    it("should display username", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce(mockProfile);

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      const usernameField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "👤 Username",
      );
      expect(usernameField).toBeDefined();
      expect(usernameField?.value).toBe("testuser");
    });

    it("should display my list count", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce(mockProfile);

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      const listField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "📝 My List",
      );
      expect(listField).toBeDefined();
      expect(listField?.value).toContain("15 items");
    });

    it("should display subscription platforms", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce(mockProfile);

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      const platformsField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "🎬 Subscription Platforms",
      );
      expect(platformsField).toBeDefined();
      expect(platformsField?.value).toContain("Netflix");
      expect(platformsField?.value).toContain("Disney+");
      expect(platformsField?.value).toContain("HBO Max");
    });

    it("should display preferences", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce(mockProfile);

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      const prefsField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "⚙️ Preferences",
      );
      expect(prefsField).toBeDefined();
      expect(prefsField?.value).toContain("Daily Briefing");
      expect(prefsField?.value).toContain("08:00");
      expect(prefsField?.value).toContain("US");
    });

    it("should show enabled brief status", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce(mockProfile);

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      const prefsField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "⚙️ Preferences",
      );
      expect(prefsField?.value).toContain("✅ Enabled");
    });

    it("should show disabled brief status when disabled", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce({
        ...mockProfile,
        preferences: {
          ...mockProfile.preferences,
          brief_enabled: false,
        },
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      const prefsField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "⚙️ Preferences",
      );
      expect(prefsField?.value).toContain("❌ Disabled");
    });

    it("should set user avatar as thumbnail", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce(mockProfile);

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.thumbnail?.url).toBe(
        "https://cdn.discord.com/avatar.png",
      );
    });

    it("should include user ID in footer", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce(mockProfile);

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.footer?.text).toContain("User ID:");
      expect(reply.embeds[0].data.footer?.text).toContain("user-uuid");
    });

    it("should have success color for linked profile", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce(mockProfile);

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.color).toBe(0x00ff00); // Green
    });

    it("should have timestamp", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce(mockProfile);

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.timestamp).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle profile with no email", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce({
        ...mockProfile,
        email: null,
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      const emailField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "📧 Email",
      );
      expect(emailField?.value).toBe("Not available");
    });

    it("should handle profile with no username", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce({
        ...mockProfile,
        username: null,
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      const usernameField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "👤 Username",
      );
      expect(usernameField?.value).toBe("Not set");
    });

    it("should handle empty subscription platforms", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce({
        ...mockProfile,
        subscription_platforms: [],
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      const platformsField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "🎬 Subscription Platforms",
      );
      expect(platformsField?.value).toContain("Not set");
      expect(platformsField?.value).toContain("/settings");
    });

    it("should handle zero items in my list", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce({
        ...mockProfile,
        my_list_count: 0,
      });

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      const listField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "📝 My List",
      );
      expect(listField?.value).toBe("0 items");
    });
  });

  describe("Error Handling", () => {
    it("should handle profile fetch failure", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce(null);

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      expect(mockEditReply).toHaveBeenCalled();
      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.title).toContain("Error Loading Profile");
    });

    it("should have error color for profile fetch failure", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce(null);

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.color).toBe(0xff0000); // Red
    });

    it("should handle service errors", async () => {
      mockIsLinked.mockRejectedValueOnce(new Error("Database error"));

      const interaction = createMockInteraction();

      await expect(execute(interaction, mockPool)).rejects.toThrow();
    });
  });

  describe("Date Formatting", () => {
    it("should format linked date correctly", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce(mockProfile);

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.description).toContain("January");
      expect(reply.embeds[0].data.description).toContain("2024");
    });
  });

  describe("Privacy", () => {
    it("should be ephemeral by default", async () => {
      mockIsLinked.mockResolvedValueOnce(false);
      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      expect(mockDeferReply).toHaveBeenCalledWith({ ephemeral: true });
    });
  });

  describe("User ID Truncation", () => {
    it("should truncate long user IDs in footer", async () => {
      mockIsLinked.mockResolvedValueOnce(true);
      mockGetUserProfile.mockResolvedValueOnce(mockProfile);

      const interaction = createMockInteraction();

      await execute(interaction, mockPool);

      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.footer?.text).toContain("...");
    });
  });
});

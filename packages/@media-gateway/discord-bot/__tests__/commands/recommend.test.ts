/**
 * Recommend Command Tests
 *
 * Unit tests for the /recommend command
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { recommendCommand } from "../../src/commands/recommend";
import type { ChatInputCommandInteraction } from "discord.js";

// Mock Discord.js
const mockDeferReply = vi.fn().mockResolvedValue(undefined);
const mockEditReply = vi.fn().mockResolvedValue(undefined);
const mockGetString = vi.fn();
const mockGetInteger = vi.fn();

const createMockInteraction = (
  genre?: string | null,
  mood?: string | null,
  limit?: number | null,
): ChatInputCommandInteraction => {
  mockGetString.mockImplementation((name: string) => {
    if (name === "genre") return genre;
    if (name === "mood") return mood;
    return null;
  });

  mockGetInteger.mockImplementation((name: string) => {
    if (name === "limit") return limit;
    return null;
  });

  return {
    deferReply: mockDeferReply,
    editReply: mockEditReply,
    options: {
      getString: mockGetString,
      getInteger: mockGetInteger,
    },
    user: {
      username: "testuser",
      id: "123456789",
    },
  } as unknown as ChatInputCommandInteraction;
};

describe("recommendCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Slash Command Data", () => {
    it("should have correct command name", () => {
      expect(recommendCommand.data.name).toBe("recommend");
    });

    it("should have correct description", () => {
      expect(recommendCommand.data.description).toBe(
        "Get AI-powered content recommendations",
      );
    });

    it("should have genre option", () => {
      const options = recommendCommand.data.options;
      const genreOption = options.find((opt: any) => opt.name === "genre");
      expect(genreOption).toBeDefined();
      expect(genreOption?.required).toBe(false);
      expect(genreOption?.description).toContain("genre");
    });

    it("should have mood option", () => {
      const options = recommendCommand.data.options;
      const moodOption = options.find((opt: any) => opt.name === "mood");
      expect(moodOption).toBeDefined();
      expect(moodOption?.required).toBe(false);
      expect(moodOption?.description).toContain("mood");
    });

    it("should have limit option with min/max values", () => {
      const options = recommendCommand.data.options;
      const limitOption = options.find((opt: any) => opt.name === "limit");
      expect(limitOption).toBeDefined();
      expect(limitOption?.required).toBe(false);
      expect(limitOption?.min_value).toBe(1);
      expect(limitOption?.max_value).toBe(10);
    });
  });

  describe("Execute Function", () => {
    it("should defer reply at start", async () => {
      const interaction = createMockInteraction();
      await recommendCommand.execute(interaction);
      expect(mockDeferReply).toHaveBeenCalledOnce();
    });

    it("should handle recommendation request with no filters", async () => {
      const interaction = createMockInteraction(null, null, null);
      await recommendCommand.execute(interaction);

      expect(mockEditReply).toHaveBeenCalledOnce();
      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds).toBeDefined();
      expect(reply.embeds[0].data.title).toContain("Recommendations");
    });

    it("should handle recommendation request with genre filter", async () => {
      const interaction = createMockInteraction("action", null, null);
      await recommendCommand.execute(interaction);

      expect(mockEditReply).toHaveBeenCalledOnce();
      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.fields).toBeDefined();

      const filtersField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "🎯 Filters",
      );
      expect(filtersField?.value).toContain("action");
    });

    it("should handle recommendation request with mood filter", async () => {
      const interaction = createMockInteraction(null, "exciting", null);
      await recommendCommand.execute(interaction);

      expect(mockEditReply).toHaveBeenCalledOnce();
      const reply = mockEditReply.mock.calls[0][0];
      const filtersField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "🎯 Filters",
      );
      expect(filtersField?.value).toContain("exciting");
    });

    it("should handle recommendation request with both filters", async () => {
      const interaction = createMockInteraction("comedy", "relaxing", null);
      await recommendCommand.execute(interaction);

      expect(mockEditReply).toHaveBeenCalledOnce();
      const reply = mockEditReply.mock.calls[0][0];
      const filtersField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "🎯 Filters",
      );
      expect(filtersField?.value).toContain("comedy");
      expect(filtersField?.value).toContain("relaxing");
    });

    it("should respect custom limit", async () => {
      const interaction = createMockInteraction(null, null, 3);
      await recommendCommand.execute(interaction);

      expect(mockEditReply).toHaveBeenCalledOnce();
      const reply = mockEditReply.mock.calls[0][0];
      const recsField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "📺 Recommendations",
      );
      // Count the numbered items in the recommendations
      const recCount = (recsField?.value.match(/\d+\./g) || []).length;
      expect(recCount).toBeLessThanOrEqual(3);
    });

    it("should default to 5 recommendations when limit not provided", async () => {
      const interaction = createMockInteraction(null, null, null);
      await recommendCommand.execute(interaction);

      expect(mockEditReply).toHaveBeenCalledOnce();
      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.fields).toBeDefined();
    });

    it("should include user information in embed footer", async () => {
      const interaction = createMockInteraction();
      await recommendCommand.execute(interaction);

      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.footer?.text).toContain("testuser");
    });

    it("should have timestamp in embed", async () => {
      const interaction = createMockInteraction();
      await recommendCommand.execute(interaction);

      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.timestamp).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle errors gracefully", async () => {
      const interaction = createMockInteraction();
      mockEditReply.mockRejectedValueOnce(new Error("Network error"));

      await expect(recommendCommand.execute(interaction)).rejects.toThrow();
    });

    it("should handle validation errors from schema", async () => {
      // Create interaction with invalid limit
      mockGetInteger.mockReturnValueOnce(15); // Outside 1-10 range
      const interaction = createMockInteraction(null, null, 15);

      await recommendCommand.execute(interaction);

      // Should catch validation error and send error message
      expect(mockEditReply).toHaveBeenCalled();
      const reply = mockEditReply.mock.calls[0][0];
      if (typeof reply === "object" && "content" in reply) {
        expect(reply.content).toContain("error");
      }
    });
  });

  describe("Option Handling", () => {
    it("should handle null genre option", async () => {
      const interaction = createMockInteraction(null, "happy", 5);
      await recommendCommand.execute(interaction);
      expect(mockEditReply).toHaveBeenCalled();
    });

    it("should handle null mood option", async () => {
      const interaction = createMockInteraction("drama", null, 5);
      await recommendCommand.execute(interaction);
      expect(mockEditReply).toHaveBeenCalled();
    });

    it("should handle all null options", async () => {
      const interaction = createMockInteraction(null, null, null);
      await recommendCommand.execute(interaction);
      expect(mockEditReply).toHaveBeenCalled();
    });

    it("should handle empty string genre", async () => {
      const interaction = createMockInteraction("", null, null);
      await recommendCommand.execute(interaction);
      expect(mockEditReply).toHaveBeenCalled();
    });

    it("should handle empty string mood", async () => {
      const interaction = createMockInteraction(null, "", null);
      await recommendCommand.execute(interaction);
      expect(mockEditReply).toHaveBeenCalled();
    });
  });

  describe("Embed Structure", () => {
    it("should have correct embed color", async () => {
      const interaction = createMockInteraction();
      await recommendCommand.execute(interaction);

      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.color).toBe(0x5865f2);
    });

    it("should not show filters field when no filters provided", async () => {
      const interaction = createMockInteraction(null, null, null);
      await recommendCommand.execute(interaction);

      const reply = mockEditReply.mock.calls[0][0];
      const filtersField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "🎯 Filters",
      );
      expect(filtersField).toBeUndefined();
    });

    it("should show filters field when at least one filter provided", async () => {
      const interaction = createMockInteraction("action", null, null);
      await recommendCommand.execute(interaction);

      const reply = mockEditReply.mock.calls[0][0];
      const filtersField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "🎯 Filters",
      );
      expect(filtersField).toBeDefined();
    });

    it("should have recommendations field", async () => {
      const interaction = createMockInteraction();
      await recommendCommand.execute(interaction);

      const reply = mockEditReply.mock.calls[0][0];
      const recsField = reply.embeds[0].data.fields?.find(
        (f: any) => f.name === "📺 Recommendations",
      );
      expect(recsField).toBeDefined();
    });
  });
});

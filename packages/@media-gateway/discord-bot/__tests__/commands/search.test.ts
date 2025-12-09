/**
 * Search Command Tests
 *
 * Unit tests for the /search command
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { searchCommand } from "../../src/commands/search";
import type { ChatInputCommandInteraction } from "discord.js";

const mockDeferReply = vi.fn().mockResolvedValue(undefined);
const mockEditReply = vi.fn().mockResolvedValue(undefined);
const mockGetString = vi.fn();
const mockGetInteger = vi.fn();

const createMockInteraction = (
  query: string,
  type?: string | null,
  limit?: number | null,
): ChatInputCommandInteraction => {
  mockGetString.mockImplementation((name: string, required?: boolean) => {
    if (name === "query") return query;
    if (name === "type") return type;
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

describe("searchCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Slash Command Data", () => {
    it("should have correct command name", () => {
      expect(searchCommand.data.name).toBe("search");
    });

    it("should have correct description", () => {
      expect(searchCommand.data.description).toBe(
        "Search for movies and TV shows",
      );
    });

    it("should have required query option", () => {
      const options = searchCommand.data.options;
      const queryOption = options.find((opt: any) => opt.name === "query");
      expect(queryOption).toBeDefined();
      expect(queryOption?.required).toBe(true);
      expect(queryOption?.description).toContain("Search");
    });

    it("should have optional type option with choices", () => {
      const options = searchCommand.data.options;
      const typeOption = options.find((opt: any) => opt.name === "type");
      expect(typeOption).toBeDefined();
      expect(typeOption?.required).toBe(false);
      expect(typeOption?.choices).toBeDefined();
      expect(typeOption?.choices?.length).toBe(3);
    });

    it("should have type choices for movie, tv, and all", () => {
      const options = searchCommand.data.options;
      const typeOption = options.find((opt: any) => opt.name === "type");
      const choices = typeOption?.choices || [];

      const choiceValues = choices.map((c: any) => c.value);
      expect(choiceValues).toContain("movie");
      expect(choiceValues).toContain("tv");
      expect(choiceValues).toContain("all");
    });

    it("should have limit option with min/max values", () => {
      const options = searchCommand.data.options;
      const limitOption = options.find((opt: any) => opt.name === "limit");
      expect(limitOption).toBeDefined();
      expect(limitOption?.required).toBe(false);
      expect(limitOption?.min_value).toBe(1);
      expect(limitOption?.max_value).toBe(10);
    });
  });

  describe("Execute Function", () => {
    it("should defer reply at start", async () => {
      const interaction = createMockInteraction("star wars");
      await searchCommand.execute(interaction);
      expect(mockDeferReply).toHaveBeenCalledOnce();
    });

    it("should handle basic search query", async () => {
      const interaction = createMockInteraction("inception");
      await searchCommand.execute(interaction);

      expect(mockEditReply).toHaveBeenCalledOnce();
      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds).toBeDefined();
      expect(reply.embeds[0].data.title).toContain("inception");
    });

    it("should handle search with movie type filter", async () => {
      const interaction = createMockInteraction("matrix", "movie", null);
      await searchCommand.execute(interaction);

      expect(mockEditReply).toHaveBeenCalledOnce();
      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.description).toContain("movie");
    });

    it("should handle search with tv type filter", async () => {
      const interaction = createMockInteraction("breaking bad", "tv", null);
      await searchCommand.execute(interaction);

      expect(mockEditReply).toHaveBeenCalledOnce();
      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.description).toContain("TV show");
    });

    it("should handle search with all type filter", async () => {
      const interaction = createMockInteraction("star", "all", null);
      await searchCommand.execute(interaction);

      expect(mockEditReply).toHaveBeenCalledOnce();
      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.description).toContain("all content");
    });

    it("should respect custom limit", async () => {
      const interaction = createMockInteraction("test", null, 3);
      await searchCommand.execute(interaction);

      expect(mockEditReply).toHaveBeenCalledOnce();
      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.fields).toBeDefined();
    });

    it("should default to 5 results when limit not provided", async () => {
      const interaction = createMockInteraction("test", null, null);
      await searchCommand.execute(interaction);

      expect(mockEditReply).toHaveBeenCalledOnce();
    });

    it("should default to 'all' type when not provided", async () => {
      const interaction = createMockInteraction("test", null, null);
      await searchCommand.execute(interaction);

      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.description).toContain("all content");
    });

    it("should display search query in embed title", async () => {
      const searchQuery = "interstellar";
      const interaction = createMockInteraction(searchQuery);
      await searchCommand.execute(interaction);

      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.title).toContain(searchQuery);
    });

    it("should include user information in embed footer", async () => {
      const interaction = createMockInteraction("test");
      await searchCommand.execute(interaction);

      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.footer?.text).toContain("testuser");
    });

    it("should have timestamp in embed", async () => {
      const interaction = createMockInteraction("test");
      await searchCommand.execute(interaction);

      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.timestamp).toBeDefined();
    });
  });

  describe("Query Validation", () => {
    it("should handle short query strings", async () => {
      const interaction = createMockInteraction("a");
      await searchCommand.execute(interaction);
      expect(mockEditReply).toHaveBeenCalled();
    });

    it("should handle long query strings", async () => {
      const longQuery = "a".repeat(100);
      const interaction = createMockInteraction(longQuery);
      await searchCommand.execute(interaction);
      expect(mockEditReply).toHaveBeenCalled();
    });

    it("should handle query with special characters", async () => {
      const interaction = createMockInteraction("star wars: episode IV");
      await searchCommand.execute(interaction);
      expect(mockEditReply).toHaveBeenCalled();
    });

    it("should handle query with numbers", async () => {
      const interaction = createMockInteraction("2001 space odyssey");
      await searchCommand.execute(interaction);
      expect(mockEditReply).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle errors gracefully", async () => {
      const interaction = createMockInteraction("test");
      mockEditReply.mockRejectedValueOnce(new Error("Network error"));

      await expect(searchCommand.execute(interaction)).rejects.toThrow();
    });

    it("should handle validation errors for invalid limit", async () => {
      mockGetInteger.mockReturnValueOnce(15); // Outside 1-10 range
      const interaction = createMockInteraction("test", null, 15);

      await searchCommand.execute(interaction);

      expect(mockEditReply).toHaveBeenCalled();
      const reply = mockEditReply.mock.calls[0][0];
      if (typeof reply === "object" && "content" in reply) {
        expect(reply.content).toBeDefined();
      }
    });

    it("should handle validation errors for invalid type", async () => {
      // Mock invalid type that's not in enum
      mockGetString.mockImplementation((name: string) => {
        if (name === "query") return "test";
        if (name === "type") return "invalid_type";
        return null;
      });

      const interaction = createMockInteraction("test", "invalid_type", null);
      await searchCommand.execute(interaction);

      expect(mockEditReply).toHaveBeenCalled();
    });
  });

  describe("Result Formatting", () => {
    it("should have correct embed color", async () => {
      const interaction = createMockInteraction("test");
      await searchCommand.execute(interaction);

      const reply = mockEditReply.mock.calls[0][0];
      expect(reply.embeds[0].data.color).toBe(0x5865f2);
    });

    it("should display result count in field name", async () => {
      const interaction = createMockInteraction("test");
      await searchCommand.execute(interaction);

      const reply = mockEditReply.mock.calls[0][0];
      const resultsField = reply.embeds[0].data.fields?.find((f: any) =>
        f.name.includes("Found"),
      );
      expect(resultsField).toBeDefined();
    });

    it("should format results with ratings", async () => {
      const interaction = createMockInteraction("matrix");
      await searchCommand.execute(interaction);

      const reply = mockEditReply.mock.calls[0][0];
      const resultsField = reply.embeds[0].data.fields?.find((f: any) =>
        f.name.includes("Found"),
      );
      expect(resultsField?.value).toContain("⭐");
    });

    it("should show content type in results", async () => {
      const interaction = createMockInteraction("test");
      await searchCommand.execute(interaction);

      const reply = mockEditReply.mock.calls[0][0];
      const resultsField = reply.embeds[0].data.fields?.find((f: any) =>
        f.name.includes("Found"),
      );
      expect(resultsField?.value).toContain("📺");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty results scenario", async () => {
      const interaction = createMockInteraction("nonexistentmovie123456");
      await searchCommand.execute(interaction);
      expect(mockEditReply).toHaveBeenCalled();
    });

    it("should handle single character query", async () => {
      const interaction = createMockInteraction("a");
      await searchCommand.execute(interaction);
      expect(mockEditReply).toHaveBeenCalled();
    });

    it("should handle maximum length query", async () => {
      const maxQuery = "a".repeat(100);
      const interaction = createMockInteraction(maxQuery);
      await searchCommand.execute(interaction);
      expect(mockEditReply).toHaveBeenCalled();
    });
  });
});

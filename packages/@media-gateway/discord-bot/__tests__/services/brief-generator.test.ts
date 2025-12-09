/**
 * Brief Generator Service Tests
 *
 * Tests for BriefGenerator class including:
 * - Constructor and initialization
 * - Daily brief generation
 * - Insights generation
 * - Data fetching
 * - Formatting utilities
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BriefGenerator } from "../../src/services/brief-generator";
import { MediaGatewayAgent } from "../../src/mcp-client";
import type { TrendingItem, SearchResult } from "../../src/types";
import Anthropic from "@anthropic-ai/sdk";

// Mock MediaGatewayAgent
vi.mock("../../src/mcp-client");

describe("BriefGenerator", () => {
  let generator: BriefGenerator;
  let mockAgent: any;
  let mockAnthropic: any;

  const mockTrending: TrendingItem[] = [
    {
      id: "1",
      title: "Trending Movie 1",
      type: "movie",
      rating: 8.5,
      popularity: 100,
    },
    {
      id: "2",
      title: "Trending Show 1",
      type: "tv",
      rating: 7.8,
    },
  ];

  const mockNewReleases: SearchResult[] = [
    {
      id: "3",
      title: "New Release 1",
      type: "movie",
      year: 2024,
      rating: 7.5,
    },
  ];

  const mockRecommendations: SearchResult[] = [
    {
      id: "4",
      title: "Recommended Movie",
      type: "movie",
      rating: 8.0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockAnthropic = {
      messages: {
        create: vi.fn(),
      },
    };

    mockAgent = {
      getAnthropicClient: vi.fn().mockReturnValue(mockAnthropic),
      getTrending: vi.fn().mockResolvedValue(mockTrending),
      search: vi.fn().mockResolvedValue(mockNewReleases),
      getRecommendations: vi.fn().mockResolvedValue(mockRecommendations),
    };

    generator = new BriefGenerator(mockAgent);
  });

  describe("Constructor and Initialization", () => {
    it("should initialize with default config", () => {
      const defaultGenerator = new BriefGenerator(mockAgent);

      expect(defaultGenerator).toBeDefined();
      expect((defaultGenerator as any).config.trendingLimit).toBe(5);
      expect((defaultGenerator as any).config.newReleasesLimit).toBe(5);
      expect((defaultGenerator as any).config.recommendationsLimit).toBe(5);
      expect((defaultGenerator as any).config.model).toBe(
        "claude-3-5-sonnet-20241022",
      );
      expect((defaultGenerator as any).config.maxTokens).toBe(2048);
    });

    it("should initialize with custom config", () => {
      const customGenerator = new BriefGenerator(mockAgent, {
        trendingLimit: 10,
        newReleasesLimit: 8,
        recommendationsLimit: 12,
        model: "claude-3-opus-20240229",
        maxTokens: 4096,
      });

      expect((customGenerator as any).config.trendingLimit).toBe(10);
      expect((customGenerator as any).config.newReleasesLimit).toBe(8);
      expect((customGenerator as any).config.recommendationsLimit).toBe(12);
      expect((customGenerator as any).config.model).toBe(
        "claude-3-opus-20240229",
      );
      expect((customGenerator as any).config.maxTokens).toBe(4096);
    });

    it("should store MediaGatewayAgent reference", () => {
      expect((generator as any).agent).toBe(mockAgent);
    });
  });

  describe("Daily Brief Generation", () => {
    it("should generate complete daily brief", async () => {
      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: `SUMMARY: Great content today!
HIGHLIGHTS:
- Action-packed movies
- Relaxing shows
- Award-winning content
PERSONALIZED_NOTE: Based on your taste, you'll love these!`,
          },
        ],
      });

      const brief = await generator.generateDailyBrief("user-123");

      expect(brief.userId).toBe("user-123");
      expect(brief.generatedAt).toBeDefined();
      expect(brief.trending).toEqual(mockTrending);
      expect(brief.newReleases).toEqual(mockNewReleases);
      expect(brief.recommendations).toEqual(mockRecommendations);
      expect(brief.insights.summary).toBe("Great content today!");
      expect(brief.insights.highlights).toHaveLength(3);
      expect(brief.insights.personalizedNote).toBeDefined();
    });

    it("should fetch all data in parallel", async () => {
      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "SUMMARY: Test\nHIGHLIGHTS:\n- Test",
          },
        ],
      });

      const startTime = Date.now();
      await generator.generateDailyBrief("user-123");
      const duration = Date.now() - startTime;

      // Should complete quickly (parallel, not sequential)
      expect(duration).toBeLessThan(1000);
      expect(mockAgent.getTrending).toHaveBeenCalledWith(5);
      expect(mockAgent.search).toHaveBeenCalled();
      expect(mockAgent.getRecommendations).toHaveBeenCalledWith("user-123", {
        limit: 5,
        excludeWatched: true,
      });
    });

    it("should use correct limits from config", async () => {
      const customGenerator = new BriefGenerator(mockAgent, {
        trendingLimit: 10,
        recommendationsLimit: 15,
      });

      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "SUMMARY: Test\nHIGHLIGHTS:\n- Test",
          },
        ],
      });

      await customGenerator.generateDailyBrief("user-123");

      expect(mockAgent.getTrending).toHaveBeenCalledWith(10);
      expect(mockAgent.getRecommendations).toHaveBeenCalledWith("user-123", {
        limit: 15,
        excludeWatched: true,
      });
    });

    it("should generate insights from fetched data", async () => {
      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "SUMMARY: Amazing content\nHIGHLIGHTS:\n- Item 1\n- Item 2",
          },
        ],
      });

      await generator.generateDailyBrief("user-123");

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 2048,
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "user",
              content: expect.stringContaining("Trending Content"),
            }),
          ]),
        }),
      );
    });
  });

  describe("New Releases Fetching", () => {
    it("should fetch recent releases", async () => {
      const currentYear = new Date().getFullYear();

      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "SUMMARY: Test\nHIGHLIGHTS:\n- Test",
          },
        ],
      });

      await generator.generateDailyBrief("user-123");

      expect(mockAgent.search).toHaveBeenCalledWith("", {
        year: currentYear,
        limit: 5,
      });
    });

    it("should filter releases to last 30 days", async () => {
      const currentYear = new Date().getFullYear();
      const oldRelease: SearchResult = {
        id: "5",
        title: "Old Movie",
        type: "movie",
        year: currentYear - 1,
        rating: 7.0,
      };

      mockAgent.search.mockResolvedValueOnce([...mockNewReleases, oldRelease]);

      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "SUMMARY: Test\nHIGHLIGHTS:\n- Test",
          },
        ],
      });

      const brief = await generator.generateDailyBrief("user-123");

      // Old release should be filtered out
      expect(brief.newReleases).not.toContainEqual(oldRelease);
    });

    it("should handle empty new releases", async () => {
      mockAgent.search.mockResolvedValueOnce([]);

      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "SUMMARY: Test\nHIGHLIGHTS:\n- Test",
          },
        ],
      });

      const brief = await generator.generateDailyBrief("user-123");

      expect(brief.newReleases).toEqual([]);
    });
  });

  describe("Insights Generation", () => {
    it("should parse structured insights correctly", async () => {
      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: `SUMMARY: Today's content is amazing with blockbusters and indie gems.
HIGHLIGHTS:
- Trending action movies dominate the charts
- New comedy releases perfect for weekend viewing
- Award-winning dramas now available
PERSONALIZED_NOTE: Based on your love for sci-fi, check out the new releases!`,
          },
        ],
      });

      const brief = await generator.generateDailyBrief("user-123");

      expect(brief.insights.summary).toBe(
        "Today's content is amazing with blockbusters and indie gems.",
      );
      expect(brief.insights.highlights).toEqual([
        "Trending action movies dominate the charts",
        "New comedy releases perfect for weekend viewing",
        "Award-winning dramas now available",
      ]);
      expect(brief.insights.personalizedNote).toBe(
        "Based on your love for sci-fi, check out the new releases!",
      );
    });

    it("should handle highlights with bullet points", async () => {
      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: `SUMMARY: Test
HIGHLIGHTS:
• Item with bullet
- Item with dash
PERSONALIZED_NOTE: Note`,
          },
        ],
      });

      const brief = await generator.generateDailyBrief("user-123");

      expect(brief.insights.highlights).toEqual([
        "Item with bullet",
        "Item with dash",
      ]);
    });

    it("should handle missing personalized note", async () => {
      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: `SUMMARY: Test summary
HIGHLIGHTS:
- Highlight 1`,
          },
        ],
      });

      const brief = await generator.generateDailyBrief("user-123");

      expect(brief.insights.summary).toBe("Test summary");
      expect(brief.insights.highlights).toHaveLength(1);
      expect(brief.insights.personalizedNote).toBeUndefined();
    });

    it("should fallback to raw text if parsing fails", async () => {
      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "Unstructured response without proper format",
          },
        ],
      });

      const brief = await generator.generateDailyBrief("user-123");

      expect(brief.insights.summary).toBe(
        "Unstructured response without proper format",
      );
      expect(brief.insights.highlights).toEqual([
        "Check out the latest trending content!",
      ]);
    });

    it("should handle empty response", async () => {
      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "",
          },
        ],
      });

      const brief = await generator.generateDailyBrief("user-123");

      expect(brief.insights.summary).toBe("");
      expect(brief.insights.highlights).toEqual([
        "Check out the latest trending content!",
      ]);
    });

    it("should build correct insights prompt", async () => {
      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "SUMMARY: Test\nHIGHLIGHTS:\n- Test",
          },
        ],
      });

      await generator.generateDailyBrief("user-123");

      const call = mockAnthropic.messages.create.mock.calls[0][0];
      const prompt = call.messages[0].content;

      expect(prompt).toContain("Trending Content:");
      expect(prompt).toContain("New Releases:");
      expect(prompt).toContain("Personalized Recommendations:");
      expect(prompt).toContain("SUMMARY:");
      expect(prompt).toContain("HIGHLIGHTS:");
      expect(prompt).toContain("PERSONALIZED_NOTE:");
    });
  });

  describe("Discord Formatting", () => {
    it("should format brief for Discord embed", () => {
      const brief = {
        userId: "user-123",
        generatedAt: "2024-01-01T00:00:00.000Z",
        trending: mockTrending,
        newReleases: mockNewReleases,
        recommendations: mockRecommendations,
        insights: {
          summary: "Great content today!",
          highlights: ["Highlight 1", "Highlight 2"],
          personalizedNote: "Enjoy!",
        },
      };

      const formatted = BriefGenerator.formatForDiscord(brief);

      expect(formatted.title).toBe("🎬 Your Daily Media Brief");
      expect(formatted.description).toBe("Great content today!");
      expect(formatted.timestamp).toBe("2024-01-01T00:00:00.000Z");
      expect(formatted.fields).toHaveLength(5);
    });

    it("should format trending section correctly", () => {
      const brief = {
        userId: "user-123",
        generatedAt: "2024-01-01T00:00:00.000Z",
        trending: mockTrending,
        newReleases: [],
        recommendations: [],
        insights: {
          summary: "Test",
          highlights: ["Test"],
        },
      };

      const formatted = BriefGenerator.formatForDiscord(brief);
      const trendingField = formatted.fields.find(
        (f) => f.name === "📈 Trending Now",
      );

      expect(trendingField?.value).toContain("Trending Movie 1");
      expect(trendingField?.value).toContain("⭐ 8.5");
      expect(trendingField?.value).toContain("Trending Show 1");
    });

    it("should handle empty sections", () => {
      const brief = {
        userId: "user-123",
        generatedAt: "2024-01-01T00:00:00.000Z",
        trending: [],
        newReleases: [],
        recommendations: [],
        insights: {
          summary: "Test",
          highlights: ["Test"],
        },
      };

      const formatted = BriefGenerator.formatForDiscord(brief);

      const trendingField = formatted.fields.find(
        (f) => f.name === "📈 Trending Now",
      );
      expect(trendingField?.value).toBe("No trending content available");

      const newField = formatted.fields.find(
        (f) => f.name === "🆕 New Releases",
      );
      expect(newField?.value).toBe("No new releases available");

      const recField = formatted.fields.find(
        (f) => f.name === "💡 Recommended For You",
      );
      expect(recField?.value).toBe("No recommendations available");
    });

    it("should format highlights correctly", () => {
      const brief = {
        userId: "user-123",
        generatedAt: "2024-01-01T00:00:00.000Z",
        trending: [],
        newReleases: [],
        recommendations: [],
        insights: {
          summary: "Test",
          highlights: ["Highlight 1", "Highlight 2", "Highlight 3"],
        },
      };

      const formatted = BriefGenerator.formatForDiscord(brief);
      const highlightsField = formatted.fields.find(
        (f) => f.name === "✨ Highlights",
      );

      expect(highlightsField?.value).toBe(
        "Highlight 1\nHighlight 2\nHighlight 3",
      );
    });

    it("should include personalized note when present", () => {
      const brief = {
        userId: "user-123",
        generatedAt: "2024-01-01T00:00:00.000Z",
        trending: [],
        newReleases: [],
        recommendations: [],
        insights: {
          summary: "Test",
          highlights: ["Test"],
          personalizedNote: "Special message for you!",
        },
      };

      const formatted = BriefGenerator.formatForDiscord(brief);
      const noteField = formatted.fields.find(
        (f) => f.name === "💬 Just For You",
      );

      expect(noteField).toBeDefined();
      expect(noteField?.value).toBe("Special message for you!");
    });

    it("should omit personalized note when absent", () => {
      const brief = {
        userId: "user-123",
        generatedAt: "2024-01-01T00:00:00.000Z",
        trending: [],
        newReleases: [],
        recommendations: [],
        insights: {
          summary: "Test",
          highlights: ["Test"],
        },
      };

      const formatted = BriefGenerator.formatForDiscord(brief);
      const noteField = formatted.fields.find(
        (f) => f.name === "💬 Just For You",
      );

      expect(noteField).toBeUndefined();
    });

    it("should handle items without ratings", () => {
      const brief = {
        userId: "user-123",
        generatedAt: "2024-01-01T00:00:00.000Z",
        trending: [
          {
            id: "1",
            title: "No Rating Movie",
            type: "movie" as const,
          },
        ],
        newReleases: [],
        recommendations: [],
        insights: {
          summary: "Test",
          highlights: ["Test"],
        },
      };

      const formatted = BriefGenerator.formatForDiscord(brief);
      const trendingField = formatted.fields.find(
        (f) => f.name === "📈 Trending Now",
      );

      expect(trendingField?.value).toContain("No Rating Movie");
      expect(trendingField?.value).not.toContain("⭐");
    });
  });

  describe("Error Handling", () => {
    it("should handle trending fetch failure", async () => {
      mockAgent.getTrending.mockRejectedValueOnce(new Error("API error"));

      await expect(generator.generateDailyBrief("user-123")).rejects.toThrow();
    });

    it("should handle recommendations fetch failure", async () => {
      mockAgent.getRecommendations.mockRejectedValueOnce(
        new Error("API error"),
      );

      await expect(generator.generateDailyBrief("user-123")).rejects.toThrow();
    });

    it("should handle insights generation failure", async () => {
      mockAnthropic.messages.create.mockRejectedValueOnce(
        new Error("Claude API error"),
      );

      await expect(generator.generateDailyBrief("user-123")).rejects.toThrow();
    });

    it("should handle empty anthropic response", async () => {
      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [],
      });

      const brief = await generator.generateDailyBrief("user-123");

      expect(brief.insights.summary).toBe("");
    });
  });

  describe("Edge Cases", () => {
    it("should handle userId with special characters", async () => {
      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "SUMMARY: Test\nHIGHLIGHTS:\n- Test",
          },
        ],
      });

      const brief = await generator.generateDailyBrief("user-<>&\"'");

      expect(brief.userId).toBe("user-<>&\"'");
    });

    it("should handle very large data sets", async () => {
      const largeTrending = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        title: `Movie ${i}`,
        type: "movie" as const,
        rating: 8.0,
      }));

      mockAgent.getTrending.mockResolvedValueOnce(largeTrending);

      mockAnthropic.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "SUMMARY: Test\nHIGHLIGHTS:\n- Test",
          },
        ],
      });

      const brief = await generator.generateDailyBrief("user-123");

      expect(brief.trending).toHaveLength(100);
    });

    it("should handle concurrent brief generation", async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [
          {
            type: "text",
            text: "SUMMARY: Test\nHIGHLIGHTS:\n- Test",
          },
        ],
      });

      const promises = [
        generator.generateDailyBrief("user-1"),
        generator.generateDailyBrief("user-2"),
        generator.generateDailyBrief("user-3"),
      ];

      const briefs = await Promise.all(promises);

      expect(briefs).toHaveLength(3);
      expect(briefs[0].userId).toBe("user-1");
      expect(briefs[1].userId).toBe("user-2");
      expect(briefs[2].userId).toBe("user-3");
    });
  });
});

/**
 * Unit tests for search formatter
 * Tests search results embed formatting, pagination, and detail views
 */

import { describe, it, expect } from "vitest";
import {
  createSearchResultsEmbed,
  createSearchPaginationButtons,
  createSearchDetailEmbed,
  createSearchDetailButtons,
  createEmptySearchEmbed,
  type SearchResult,
} from "../../src/formatters/search";

describe("Search Formatter", () => {
  describe("createSearchResultsEmbed", () => {
    const mockResults: SearchResult[] = [
      {
        id: "550",
        title: "Fight Club",
        type: "movie",
        year: 1999,
        overview:
          "An insomniac office worker seeks a form of self-actualization.",
        rating: 8.4,
        posterPath: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
        popularity: 50.5,
      },
      {
        id: "1396",
        title: "Breaking Bad",
        type: "tv",
        year: 2008,
        overview: "A chemistry teacher turned meth producer.",
        rating: 9.5,
        posterPath: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
        popularity: 100.2,
      },
      {
        id: "278",
        title: "The Shawshank Redemption",
        type: "movie",
        year: 1994,
        overview: "Two imprisoned men bond over years.",
        rating: 8.7,
        posterPath: "/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
        popularity: 75.8,
      },
      {
        id: "238",
        title: "The Godfather",
        type: "movie",
        year: 1972,
        overview: "The aging patriarch transfers control.",
        rating: 8.7,
        posterPath: "/3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
        popularity: 80.3,
      },
      {
        id: "424",
        title: "Schindler's List",
        type: "movie",
        year: 1993,
        overview: "A German businessman saves Jews.",
        rating: 8.6,
        posterPath: "/sF1U4EUQS8YHUYjNl3pMGNIQyr0.jpg",
        popularity: 65.7,
      },
      {
        id: "680",
        title: "Pulp Fiction",
        type: "movie",
        year: 1994,
        overview: "Various interconnected stories.",
        rating: 8.5,
        posterPath: "/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
        popularity: 70.1,
      },
    ];

    it("should create search results embed for first page", () => {
      const embed = createSearchResultsEmbed(mockResults, "fight club", 0);

      expect(embed.data.title).toBe('🔍 Search Results: "fight club"');
      expect(embed.data.color).toBe(0xe74c3c); // Red
      expect(embed.data.description).toBe("Found 6 results");
      expect(embed.data.timestamp).toBeDefined();
    });

    it("should show 5 results per page", () => {
      const embed = createSearchResultsEmbed(mockResults, "movie", 0);

      expect(embed.data.fields).toHaveLength(5);
    });

    it("should paginate results correctly", () => {
      const embed = createSearchResultsEmbed(mockResults, "movie", 1);

      expect(embed.data.fields).toHaveLength(1); // Only 1 result on page 2
      expect(embed.data.fields?.[0].name).toContain("6. 🎬 Pulp Fiction");
    });

    it("should handle single result (singular text)", () => {
      const singleResult = [mockResults[0]];
      const embed = createSearchResultsEmbed(singleResult, "fight club", 0, 1);

      expect(embed.data.description).toBe("Found 1 result");
    });

    it("should display movie icon for movies", () => {
      const embed = createSearchResultsEmbed(mockResults, "movie", 0);

      const movieField = embed.data.fields?.find((f) =>
        f.name.includes("Fight Club"),
      );
      expect(movieField?.name).toContain("🎬");
    });

    it("should display TV icon for TV shows", () => {
      const embed = createSearchResultsEmbed(mockResults, "movie", 0);

      const tvField = embed.data.fields?.find((f) =>
        f.name.includes("Breaking Bad"),
      );
      expect(tvField?.name).toContain("📺");
    });

    it("should include year in field name", () => {
      const embed = createSearchResultsEmbed(mockResults, "movie", 0);

      const field = embed.data.fields?.find((f) =>
        f.name.includes("Fight Club"),
      );
      expect(field?.name).toContain("(1999)");
    });

    it("should include rating in field name", () => {
      const embed = createSearchResultsEmbed(mockResults, "movie", 0);

      const field = embed.data.fields?.find((f) =>
        f.name.includes("Fight Club"),
      );
      expect(field?.name).toContain("⭐ 8.4");
    });

    it("should truncate overview to 150 characters", () => {
      const longOverview = "A".repeat(200);
      const result: SearchResult = {
        id: "1",
        title: "Long Movie",
        type: "movie",
        overview: longOverview,
      };

      const embed = createSearchResultsEmbed([result], "test", 0);
      const field = embed.data.fields?.[0];

      expect(field?.value.length).toBe(150); // 147 + "..."
      expect(field?.value.endsWith("...")).toBe(true);
    });

    it("should handle missing overview", () => {
      const result: SearchResult = {
        id: "1",
        title: "No Overview Movie",
        type: "movie",
      };

      const embed = createSearchResultsEmbed([result], "test", 0);
      const field = embed.data.fields?.[0];

      expect(field?.value).toBe("No description available");
    });

    it("should handle missing year", () => {
      const result: SearchResult = {
        id: "1",
        title: "No Year Movie",
        type: "movie",
        overview: "Some description",
      };

      const embed = createSearchResultsEmbed([result], "test", 0);
      const field = embed.data.fields?.[0];

      expect(field?.name).not.toContain("(");
      expect(field?.name).toContain("No Year Movie");
    });

    it("should handle missing rating", () => {
      const result: SearchResult = {
        id: "1",
        title: "No Rating Movie",
        type: "movie",
        overview: "Some description",
      };

      const embed = createSearchResultsEmbed([result], "test", 0);
      const field = embed.data.fields?.[0];

      expect(field?.name).not.toContain("⭐");
    });

    it("should show pagination info in footer for multiple pages", () => {
      const embed = createSearchResultsEmbed(mockResults, "movie", 0, 6);

      expect(embed.data.footer?.text).toContain("Page 1 of 2");
      expect(embed.data.footer?.text).toContain("Type a number to see details");
    });

    it("should show simple footer for single page", () => {
      const fewResults = mockResults.slice(0, 3);
      const embed = createSearchResultsEmbed(fewResults, "movie", 0, 3);

      expect(embed.data.footer?.text).toBe("Type a number to see details");
    });

    it("should calculate correct result numbering across pages", () => {
      const embed = createSearchResultsEmbed(mockResults, "movie", 1, 6);

      expect(embed.data.fields?.[0].name).toContain("6. ");
    });

    it("should handle special characters in query", () => {
      const embed = createSearchResultsEmbed(
        mockResults,
        'test "query" & <special>',
        0,
      );

      expect(embed.data.title).toContain('test "query" & <special>');
    });

    it("should set all fields as non-inline", () => {
      const embed = createSearchResultsEmbed(mockResults, "movie", 0);

      embed.data.fields?.forEach((field) => {
        expect(field.inline).toBe(false);
      });
    });
  });

  describe("createSearchPaginationButtons", () => {
    it("should create all three pagination buttons", () => {
      const row = createSearchPaginationButtons(0, 3, "search123");

      expect(row.components).toHaveLength(3);
      expect(row.components[0].data.label).toBe("Previous");
      expect(row.components[1].data.label).toBe("1 / 3");
      expect(row.components[2].data.label).toBe("Next");
    });

    it("should disable Previous button on first page", () => {
      const row = createSearchPaginationButtons(0, 3, "search123");

      expect(row.components[0].data.disabled).toBe(true);
      expect(row.components[2].data.disabled).toBe(false);
    });

    it("should disable Next button on last page", () => {
      const row = createSearchPaginationButtons(2, 3, "search123");

      expect(row.components[0].data.disabled).toBe(false);
      expect(row.components[2].data.disabled).toBe(true);
    });

    it("should enable both buttons on middle page", () => {
      const row = createSearchPaginationButtons(1, 3, "search123");

      expect(row.components[0].data.disabled).toBe(false);
      expect(row.components[2].data.disabled).toBe(false);
    });

    it("should always disable page indicator button", () => {
      const row = createSearchPaginationButtons(1, 3, "search123");

      expect(row.components[1].data.disabled).toBe(true);
    });

    it("should include search ID in custom IDs", () => {
      const row = createSearchPaginationButtons(0, 3, "search123");

      expect(row.components[0].data.custom_id).toContain("search123");
      expect(row.components[1].data.custom_id).toContain("search123");
      expect(row.components[2].data.custom_id).toContain("search123");
    });

    it("should include page number in custom IDs", () => {
      const row = createSearchPaginationButtons(2, 5, "search123");

      expect(row.components[0].data.custom_id).toContain("_2");
      expect(row.components[2].data.custom_id).toContain("_2");
    });

    it("should have emojis on navigation buttons", () => {
      const row = createSearchPaginationButtons(1, 3, "search123");

      expect(row.components[0].data.emoji).toBeDefined();
      expect(row.components[2].data.emoji).toBeDefined();
    });

    it("should handle single page correctly", () => {
      const row = createSearchPaginationButtons(0, 1, "search123");

      expect(row.components[0].data.disabled).toBe(true);
      expect(row.components[2].data.disabled).toBe(true);
      expect(row.components[1].data.label).toBe("1 / 1");
    });
  });

  describe("createSearchDetailEmbed", () => {
    it("should create detailed embed for movie", () => {
      const result: SearchResult = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        year: 1999,
        overview:
          "An insomniac office worker seeks a form of self-actualization.",
        rating: 8.4,
        posterPath: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
        popularity: 50.5,
      };

      const embed = createSearchDetailEmbed(result);

      expect(embed.data.title).toBe("Fight Club");
      expect(embed.data.color).toBe(0x3498db); // Movie blue
      expect(embed.data.description).toBe(result.overview);
      expect(embed.data.image?.url).toContain(result.posterPath);
      expect(embed.data.timestamp).toBeDefined();
    });

    it("should create detailed embed for TV show", () => {
      const result: SearchResult = {
        id: "1396",
        title: "Breaking Bad",
        type: "tv",
        overview: "A chemistry teacher turned meth producer.",
        rating: 9.5,
      };

      const embed = createSearchDetailEmbed(result);

      expect(embed.data.color).toBe(0x9b59b6); // TV purple
      expect(embed.data.footer?.text).toContain("📺 TV Show");
    });

    it("should include year field when available", () => {
      const result: SearchResult = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        year: 1999,
      };

      const embed = createSearchDetailEmbed(result);
      const yearField = embed.data.fields?.find((f) => f.name === "📅 Year");

      expect(yearField).toBeDefined();
      expect(yearField?.value).toBe("1999");
      expect(yearField?.inline).toBe(true);
    });

    it("should include rating field with stars", () => {
      const result: SearchResult = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        rating: 8.4,
      };

      const embed = createSearchDetailEmbed(result);
      const ratingField = embed.data.fields?.find(
        (f) => f.name === "⭐ Rating",
      );

      expect(ratingField).toBeDefined();
      expect(ratingField?.value).toContain("⭐⭐⭐⭐"); // 4 stars
      expect(ratingField?.value).toContain("8.4/10");
    });

    it("should include popularity field when available", () => {
      const result: SearchResult = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        popularity: 50.567,
      };

      const embed = createSearchDetailEmbed(result);
      const popField = embed.data.fields?.find(
        (f) => f.name === "🔥 Popularity",
      );

      expect(popField).toBeDefined();
      expect(popField?.value).toBe("51"); // Rounded
      expect(popField?.inline).toBe(true);
    });

    it("should use large image for poster", () => {
      const result: SearchResult = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        posterPath: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
      };

      const embed = createSearchDetailEmbed(result);

      expect(embed.data.image?.url).toContain("w500");
      expect(embed.data.image?.url).toContain(result.posterPath);
    });

    it("should handle missing poster", () => {
      const result: SearchResult = {
        id: "550",
        title: "Fight Club",
        type: "movie",
      };

      const embed = createSearchDetailEmbed(result);

      expect(embed.data.image).toBeUndefined();
    });

    it("should handle missing overview", () => {
      const result: SearchResult = {
        id: "550",
        title: "Fight Club",
        type: "movie",
      };

      const embed = createSearchDetailEmbed(result);

      expect(embed.data.description).toBeUndefined();
    });

    it("should not truncate long overview in detail view", () => {
      const longOverview = "A".repeat(500);
      const result: SearchResult = {
        id: "1",
        title: "Long Movie",
        type: "movie",
        overview: longOverview,
      };

      const embed = createSearchDetailEmbed(result);

      expect(embed.data.description).toBe(longOverview);
    });

    it("should format footer with type", () => {
      const result: SearchResult = {
        id: "550",
        title: "Fight Club",
        type: "movie",
      };

      const embed = createSearchDetailEmbed(result);

      expect(embed.data.footer?.text).toBe("🎬 Movie");
    });
  });

  describe("createSearchDetailButtons", () => {
    it("should create all three action buttons", () => {
      const result: SearchResult = {
        id: "550",
        title: "Fight Club",
        type: "movie",
      };

      const row = createSearchDetailButtons(result);

      expect(row.components).toHaveLength(3);
      expect(row.components[0].data.label).toBe("View on TMDB");
      expect(row.components[1].data.label).toBe("Similar Content");
      expect(row.components[2].data.label).toBe("Add to Watchlist");
    });

    it("should create correct TMDB URL for movie", () => {
      const result: SearchResult = {
        id: "550",
        title: "Fight Club",
        type: "movie",
      };

      const row = createSearchDetailButtons(result);

      expect(row.components[0].data.url).toBe(
        "https://www.themoviedb.org/movie/550",
      );
    });

    it("should create correct TMDB URL for TV show", () => {
      const result: SearchResult = {
        id: "1396",
        title: "Breaking Bad",
        type: "tv",
      };

      const row = createSearchDetailButtons(result);

      expect(row.components[0].data.url).toBe(
        "https://www.themoviedb.org/tv/1396",
      );
    });

    it("should create recommend button with correct custom ID", () => {
      const result: SearchResult = {
        id: "550",
        title: "Fight Club",
        type: "movie",
      };

      const row = createSearchDetailButtons(result);
      const recommendButton = row.components[1];

      expect(recommendButton.data.custom_id).toBe("recommend_movie_550");
    });

    it("should create watchlist button with correct custom ID", () => {
      const result: SearchResult = {
        id: "1396",
        title: "Breaking Bad",
        type: "tv",
      };

      const row = createSearchDetailButtons(result);
      const watchlistButton = row.components[2];

      expect(watchlistButton.data.custom_id).toBe("watchlist_tv_1396");
    });

    it("should have emojis on all buttons", () => {
      const result: SearchResult = {
        id: "550",
        title: "Fight Club",
        type: "movie",
      };

      const row = createSearchDetailButtons(result);

      row.components.forEach((button) => {
        expect(button.data.emoji).toBeDefined();
      });
    });
  });

  describe("createEmptySearchEmbed", () => {
    it("should create empty search embed", () => {
      const embed = createEmptySearchEmbed("nonexistent movie");

      expect(embed.data.title).toBe("🔍 No Results Found");
      expect(embed.data.color).toBe(0x95a5a6); // Gray
      expect(embed.data.description).toContain("nonexistent movie");
      expect(embed.data.timestamp).toBeDefined();
    });

    it("should include search tips", () => {
      const embed = createEmptySearchEmbed("test");

      const tipsField = embed.data.fields?.find((f) => f.name === "💡 Tips");
      expect(tipsField).toBeDefined();
      expect(tipsField?.value).toContain("Check your spelling");
      expect(tipsField?.value).toContain("Try more general terms");
      expect(tipsField?.value).toContain("Search for actors");
      expect(tipsField?.value).toContain("original title");
    });

    it("should handle special characters in query", () => {
      const embed = createEmptySearchEmbed('<script>alert("xss")</script>');

      expect(embed.data.description).toContain('<script>alert("xss")</script>');
    });

    it("should have non-inline tips field", () => {
      const embed = createEmptySearchEmbed("test");

      const tipsField = embed.data.fields?.[0];
      expect(tipsField?.inline).toBe(false);
    });
  });
});

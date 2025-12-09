/**
 * Unit tests for recommendation formatter
 * Tests recommendation embed formatting, buttons, and summary embeds
 */

import { describe, it, expect } from "vitest";
import {
  createRecommendationEmbed,
  createRecommendationButtons,
  createRecommendationsSummaryEmbed,
  type RecommendationContent,
} from "../../src/formatters/recommendation";

describe("Recommendation Formatter", () => {
  describe("createRecommendationEmbed", () => {
    it("should create embed with all fields for movie", () => {
      const content: RecommendationContent = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        overview:
          "A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy.",
        rating: 8.4,
        posterPath: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
        releaseDate: "1999-10-15",
        genres: ["Drama", "Thriller", "Comedy"],
        availableOn: ["Netflix", "Amazon Prime"],
        matchScore: 0.95,
      };

      const embed = createRecommendationEmbed(content);

      expect(embed.data.title).toBe("Fight Club");
      expect(embed.data.color).toBe(0x3498db); // Movie blue
      expect(embed.data.description).toContain("ticking-time-bomb insomniac");
      expect(embed.data.thumbnail).toBeDefined();
      expect(embed.data.thumbnail?.url).toContain(
        "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
      );
      expect(embed.data.fields).toHaveLength(5); // rating, release, match, genres, availability
      expect(embed.data.timestamp).toBeDefined();
    });

    it("should create embed with all fields for TV show", () => {
      const content: RecommendationContent = {
        id: "1396",
        title: "Breaking Bad",
        type: "tv",
        overview:
          "A high school chemistry teacher turned methamphetamine producer.",
        rating: 9.5,
        posterPath: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
        releaseDate: "2008-01-20",
        genres: ["Drama", "Crime", "Thriller"],
        availableOn: ["Netflix"],
        matchScore: 0.98,
      };

      const embed = createRecommendationEmbed(content);

      expect(embed.data.title).toBe("Breaking Bad");
      expect(embed.data.color).toBe(0x9b59b6); // TV purple
      expect(embed.data.fields).toHaveLength(5);
      expect(embed.data.footer?.text).toContain("📺 TV Show");
    });

    it("should truncate long overview to 200 characters", () => {
      const longOverview = "A".repeat(250);
      const content: RecommendationContent = {
        id: "1",
        title: "Long Movie",
        type: "movie",
        overview: longOverview,
      };

      const embed = createRecommendationEmbed(content);

      expect(embed.data.description).toHaveLength(200); // 197 chars + "..."
      expect(embed.data.description?.endsWith("...")).toBe(true);
    });

    it("should handle missing optional fields gracefully", () => {
      const minimalContent: RecommendationContent = {
        id: "1",
        title: "Minimal Movie",
        type: "movie",
      };

      const embed = createRecommendationEmbed(minimalContent);

      expect(embed.data.title).toBe("Minimal Movie");
      expect(embed.data.description).toBeUndefined();
      expect(embed.data.thumbnail).toBeUndefined();
      expect(embed.data.fields).toHaveLength(1); // Only availability field
    });

    it("should format rating correctly with stars", () => {
      const content: RecommendationContent = {
        id: "1",
        title: "Test Movie",
        type: "movie",
        rating: 8.5,
      };

      const embed = createRecommendationEmbed(content);
      const ratingField = embed.data.fields?.find(
        (f) => f.name === "⭐ Rating",
      );

      expect(ratingField).toBeDefined();
      expect(ratingField?.value).toContain("⭐⭐⭐⭐☆"); // 4 stars for 8.5/10
      expect(ratingField?.value).toContain("8.5/10");
      expect(ratingField?.inline).toBe(true);
    });

    it("should format match score as percentage", () => {
      const content: RecommendationContent = {
        id: "1",
        title: "Test Movie",
        type: "movie",
        matchScore: 0.87,
      };

      const embed = createRecommendationEmbed(content);
      const matchField = embed.data.fields?.find(
        (f) => f.name === "🎯 Match Score",
      );

      expect(matchField).toBeDefined();
      expect(matchField?.value).toBe("87%");
      expect(matchField?.inline).toBe(true);
    });

    it("should format genres as comma-separated list", () => {
      const content: RecommendationContent = {
        id: "1",
        title: "Test Movie",
        type: "movie",
        genres: ["Action", "Adventure", "Sci-Fi"],
      };

      const embed = createRecommendationEmbed(content);
      const genresField = embed.data.fields?.find(
        (f) => f.name === "🎭 Genres",
      );

      expect(genresField).toBeDefined();
      expect(genresField?.value).toBe("Action, Adventure, Sci-Fi");
      expect(genresField?.inline).toBe(false);
    });

    it("should display platform icons for known platforms", () => {
      const content: RecommendationContent = {
        id: "1",
        title: "Test Movie",
        type: "movie",
        availableOn: ["Netflix", "Disney+", "HBO Max", "Amazon Prime", "Hulu"],
      };

      const embed = createRecommendationEmbed(content);
      const availField = embed.data.fields?.find(
        (f) => f.name === "📺 Availability",
      );

      expect(availField).toBeDefined();
      expect(availField?.value).toContain("🔴 Netflix");
      expect(availField?.value).toContain("➕ Disney+");
      expect(availField?.value).toContain("🎬 HBO Max");
      expect(availField?.value).toContain("📦 Prime Video");
      expect(availField?.value).toContain("🟢 Hulu");
    });

    it("should handle unknown platforms gracefully", () => {
      const content: RecommendationContent = {
        id: "1",
        title: "Test Movie",
        type: "movie",
        availableOn: ["Unknown Platform", "Random Service"],
      };

      const embed = createRecommendationEmbed(content);
      const availField = embed.data.fields?.find(
        (f) => f.name === "📺 Availability",
      );

      expect(availField).toBeDefined();
      expect(availField?.value).toContain("📺 Unknown Platform");
      expect(availField?.value).toContain("📺 Random Service");
    });

    it("should show unavailable message when no platforms", () => {
      const content: RecommendationContent = {
        id: "1",
        title: "Test Movie",
        type: "movie",
        availableOn: [],
      };

      const embed = createRecommendationEmbed(content);
      const availField = embed.data.fields?.find(
        (f) => f.name === "📺 Availability",
      );

      expect(availField).toBeDefined();
      expect(availField?.value).toBe("❌ Not currently available");
    });

    it("should handle null/undefined rating gracefully", () => {
      const content: RecommendationContent = {
        id: "1",
        title: "Test Movie",
        type: "movie",
        rating: undefined,
      };

      const embed = createRecommendationEmbed(content);
      const ratingField = embed.data.fields?.find(
        (f) => f.name === "⭐ Rating",
      );

      expect(ratingField).toBeUndefined();
    });

    it("should format release date field correctly", () => {
      const content: RecommendationContent = {
        id: "1",
        title: "Test Movie",
        type: "movie",
        releaseDate: "2023-05-15",
      };

      const embed = createRecommendationEmbed(content);
      const dateField = embed.data.fields?.find(
        (f) => f.name === "📅 Released",
      );

      expect(dateField).toBeDefined();
      expect(dateField?.value).toBe("2023-05-15");
      expect(dateField?.inline).toBe(true);
    });

    it("should handle special characters in title and overview", () => {
      const content: RecommendationContent = {
        id: "1",
        title: 'Movie: "Special" & <Characters>',
        type: "movie",
        overview: "Contains special chars: < > & \" '",
      };

      const embed = createRecommendationEmbed(content);

      expect(embed.data.title).toBe('Movie: "Special" & <Characters>');
      expect(embed.data.description).toContain("special chars");
    });
  });

  describe("createRecommendationButtons", () => {
    it("should create buttons with deep link for movie", () => {
      const content: RecommendationContent = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        deepLink: "https://www.netflix.com/title/550",
      };

      const row = createRecommendationButtons(content);

      expect(row.components).toHaveLength(3); // Watch Now, View Details, Save
      expect(row.components[0].data.label).toBe("Watch Now");
      expect(row.components[0].data.url).toBe(
        "https://www.netflix.com/title/550",
      );
    });

    it("should create buttons with deep link for TV show", () => {
      const content: RecommendationContent = {
        id: "1396",
        title: "Breaking Bad",
        type: "tv",
        deepLink: "https://www.netflix.com/title/1396",
      };

      const row = createRecommendationButtons(content);

      expect(row.components).toHaveLength(3);
      expect(row.components[0].data.label).toBe("Watch Now");
    });

    it("should create buttons without deep link", () => {
      const content: RecommendationContent = {
        id: "550",
        title: "Fight Club",
        type: "movie",
      };

      const row = createRecommendationButtons(content);

      expect(row.components).toHaveLength(2); // View Details, Save (no Watch Now)
    });

    it("should create correct TMDB URL for movie", () => {
      const content: RecommendationContent = {
        id: "550",
        title: "Fight Club",
        type: "movie",
      };

      const row = createRecommendationButtons(content);
      const detailsButton = row.components.find(
        (c) => c.data.label === "View Details",
      );

      expect(detailsButton).toBeDefined();
      expect(detailsButton?.data.url).toBe(
        "https://www.themoviedb.org/movie/550",
      );
    });

    it("should create correct TMDB URL for TV show", () => {
      const content: RecommendationContent = {
        id: "1396",
        title: "Breaking Bad",
        type: "tv",
      };

      const row = createRecommendationButtons(content);
      const detailsButton = row.components.find(
        (c) => c.data.label === "View Details",
      );

      expect(detailsButton).toBeDefined();
      expect(detailsButton?.data.url).toBe(
        "https://www.themoviedb.org/tv/1396",
      );
    });

    it("should create save button with correct custom ID", () => {
      const content: RecommendationContent = {
        id: "550",
        title: "Fight Club",
        type: "movie",
      };

      const row = createRecommendationButtons(content);
      const saveButton = row.components.find((c) => c.data.label === "Save");

      expect(saveButton).toBeDefined();
      expect(saveButton?.data.custom_id).toBe("save_movie_550");
    });

    it("should have emojis on all buttons", () => {
      const content: RecommendationContent = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        deepLink: "https://www.netflix.com/title/550",
      };

      const row = createRecommendationButtons(content);

      row.components.forEach((button) => {
        expect(button.data.emoji).toBeDefined();
      });
    });
  });

  describe("createRecommendationsSummaryEmbed", () => {
    const mockRecommendations: RecommendationContent[] = [
      {
        id: "1",
        title: "Movie 1",
        type: "movie",
        rating: 8.5,
        availableOn: ["Netflix", "Hulu"],
      },
      {
        id: "2",
        title: "Show 2",
        type: "tv",
        rating: 9.0,
        availableOn: ["Disney+"],
      },
      {
        id: "3",
        title: "Movie 3",
        type: "movie",
        rating: 7.5,
        availableOn: [],
      },
      {
        id: "4",
        title: "Show 4",
        type: "tv",
        rating: 8.0,
        availableOn: ["HBO Max"],
      },
      {
        id: "5",
        title: "Movie 5",
        type: "movie",
        rating: 8.8,
        availableOn: ["Amazon Prime"],
      },
      {
        id: "6",
        title: "Movie 6",
        type: "movie",
        rating: 7.0,
        availableOn: ["Netflix"],
      },
    ];

    it("should create summary with all recommendations", () => {
      const embed = createRecommendationsSummaryEmbed(mockRecommendations);

      expect(embed.data.title).toBe("🎯 Your Personalized Recommendations");
      expect(embed.data.color).toBe(0x2ecc71); // Green
      expect(embed.data.timestamp).toBeDefined();
    });

    it("should show query context when provided", () => {
      const embed = createRecommendationsSummaryEmbed(
        mockRecommendations,
        "action movies like Inception",
      );

      expect(embed.data.description).toContain(
        "Based on your interest in: *action movies like Inception*",
      );
    });

    it("should limit to top 5 recommendations", () => {
      const embed = createRecommendationsSummaryEmbed(mockRecommendations);

      // 5 recommendation fields + 1 "more" field + 0 or 1 description
      const recFields = embed.data.fields?.filter((f) =>
        f.name.match(/^\d+\./),
      );
      expect(recFields).toHaveLength(5);
    });

    it("should show overflow message for 6+ recommendations", () => {
      const embed = createRecommendationsSummaryEmbed(mockRecommendations);

      const moreField = embed.data.fields?.find((f) =>
        f.value.includes("more recommendations"),
      );
      expect(moreField).toBeDefined();
      expect(moreField?.value).toContain("And 1 more recommendations");
    });

    it("should not show overflow message for 5 or fewer recommendations", () => {
      const fewRecommendations = mockRecommendations.slice(0, 5);
      const embed = createRecommendationsSummaryEmbed(fewRecommendations);

      const moreField = embed.data.fields?.find((f) =>
        f.value.includes("more recommendations"),
      );
      expect(moreField).toBeUndefined();
    });

    it("should display correct icons for movie and TV", () => {
      const embed = createRecommendationsSummaryEmbed(mockRecommendations);

      const movieField = embed.data.fields?.find((f) =>
        f.name.includes("Movie 1"),
      );
      const tvField = embed.data.fields?.find((f) => f.name.includes("Show 2"));

      expect(movieField?.name).toContain("🎬");
      expect(tvField?.name).toContain("📺");
    });

    it("should show ratings when available", () => {
      const embed = createRecommendationsSummaryEmbed(mockRecommendations);

      const field = embed.data.fields?.find((f) => f.name.includes("Movie 1"));
      expect(field?.value).toContain("⭐ 8.5");
    });

    it("should show platforms when available", () => {
      const embed = createRecommendationsSummaryEmbed(mockRecommendations);

      const field = embed.data.fields?.find((f) => f.name.includes("Movie 1"));
      expect(field?.value).toContain("📺 Netflix");
    });

    it("should show unavailable message when no platforms", () => {
      const embed = createRecommendationsSummaryEmbed(mockRecommendations);

      const field = embed.data.fields?.find((f) => f.name.includes("Movie 3"));
      expect(field?.value).toContain("❌ Not available");
    });

    it("should include footer with total count", () => {
      const embed = createRecommendationsSummaryEmbed(mockRecommendations);

      expect(embed.data.footer?.text).toContain("6 recommendations");
    });

    it("should handle single recommendation", () => {
      const singleRec = [mockRecommendations[0]];
      const embed = createRecommendationsSummaryEmbed(singleRec);

      expect(embed.data.footer?.text).toContain("1 recommendations");
      expect(
        embed.data.fields?.filter((f) => f.name.match(/^\d+\./)),
      ).toHaveLength(1);
    });

    it("should handle empty recommendations array", () => {
      const embed = createRecommendationsSummaryEmbed([]);

      const recFields =
        embed.data.fields?.filter((f) => f.name.match(/^\d+\./)) || [];
      expect(recFields).toHaveLength(0);
      expect(embed.data.footer?.text).toContain("0 recommendations");
    });

    it("should truncate platform list to 2 platforms", () => {
      const manyPlatforms: RecommendationContent = {
        id: "1",
        title: "Popular Movie",
        type: "movie",
        rating: 8.5,
        availableOn: ["Netflix", "Disney+", "HBO Max", "Hulu"],
      };

      const embed = createRecommendationsSummaryEmbed([manyPlatforms]);
      const field = embed.data.fields?.find((f) =>
        f.name.includes("Popular Movie"),
      );

      expect(field?.value).toContain("Netflix");
      expect(field?.value).toContain("Disney+");
      expect(field?.value).not.toContain("HBO Max");
    });
  });
});

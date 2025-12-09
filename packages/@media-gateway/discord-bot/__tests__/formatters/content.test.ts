/**
 * Unit tests for content detail formatter
 * Tests comprehensive content detail embeds, buttons, and card views
 */

import { describe, it, expect } from "vitest";
import {
  createContentDetailEmbed,
  createContentDetailButtons,
  createContentCardEmbed,
  type ContentDetails,
} from "../../src/formatters/content";

describe("Content Formatter", () => {
  describe("createContentDetailEmbed", () => {
    it("should create comprehensive embed for movie", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        overview:
          "An insomniac office worker seeks a form of self-actualization.",
        posterPath: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
        backdropPath: "/fCayJrkfRaCRCTh8GqN30f8oyQF.jpg",
        rating: 8.4,
        voteCount: 26000,
        releaseDate: "1999-10-15",
        runtime: 139,
        genres: ["Drama", "Thriller", "Comedy"],
        cast: ["Edward Norton", "Brad Pitt", "Helena Bonham Carter"],
        directors: ["David Fincher"],
        availableOn: [
          { platform: "Netflix", link: "https://netflix.com/550" },
          { platform: "Amazon Prime", priceInfo: "$3.99" },
        ],
        trailerUrl: "https://youtube.com/watch?v=abc123",
        homepage: "https://www.foxmovies.com/movies/fight-club",
        status: "Released",
        tagline: "Mischief. Mayhem. Soap.",
      };

      const embed = createContentDetailEmbed(content);

      expect(embed.data.title).toBe("Fight Club");
      expect(embed.data.color).toBe(0x3498db); // Movie blue
      expect(embed.data.description).toContain("Mischief. Mayhem. Soap.");
      expect(embed.data.description).toContain("insomniac office worker");
      expect(embed.data.timestamp).toBeDefined();
    });

    it("should create comprehensive embed for TV show", () => {
      const content: ContentDetails = {
        id: "1396",
        title: "Breaking Bad",
        type: "tv",
        overview: "A chemistry teacher turned meth producer.",
        rating: 9.5,
        voteCount: 12000,
        releaseDate: "2008-01-20",
        numberOfSeasons: 5,
        genres: ["Drama", "Crime", "Thriller"],
        cast: ["Bryan Cranston", "Aaron Paul", "Anna Gunn"],
        creators: ["Vince Gilligan"],
        availableOn: [{ platform: "Netflix" }],
        status: "Ended",
      };

      const embed = createContentDetailEmbed(content);

      expect(embed.data.title).toBe("Breaking Bad");
      expect(embed.data.color).toBe(0x9b59b6); // TV purple
      expect(embed.data.footer?.text).toContain("📺 TV Show");
    });

    it("should use backdrop as main image", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        backdropPath: "/fCayJrkfRaCRCTh8GqN30f8oyQF.jpg",
      };

      const embed = createContentDetailEmbed(content);

      expect(embed.data.image?.url).toContain("original");
      expect(embed.data.image?.url).toContain(
        "/fCayJrkfRaCRCTh8GqN30f8oyQF.jpg",
      );
    });

    it("should use poster as thumbnail", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        posterPath: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
      };

      const embed = createContentDetailEmbed(content);

      expect(embed.data.thumbnail?.url).toContain("w500");
      expect(embed.data.thumbnail?.url).toContain(
        "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
      );
    });

    it("should format tagline with quotes", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        overview: "An insomniac office worker.",
        tagline: "Mischief. Mayhem. Soap.",
      };

      const embed = createContentDetailEmbed(content);

      expect(embed.data.description).toContain('"Mischief. Mayhem. Soap."');
      expect(embed.data.description).toContain("An insomniac office worker");
    });

    it("should show overview without tagline if no tagline", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        overview: "An insomniac office worker.",
      };

      const embed = createContentDetailEmbed(content);

      expect(embed.data.description).toBe("An insomniac office worker.");
      expect(embed.data.description).not.toContain('"');
    });

    it("should format rating with stars and vote count", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        rating: 8.4,
        voteCount: 26543,
      };

      const embed = createContentDetailEmbed(content);
      const ratingField = embed.data.fields?.find(
        (f) => f.name === "⭐ Rating",
      );

      expect(ratingField).toBeDefined();
      expect(ratingField?.value).toContain("⭐⭐⭐⭐☆");
      expect(ratingField?.value).toContain("8.4/10");
      expect(ratingField?.value).toContain("(26,543 votes)");
    });

    it("should format rating without vote count if missing", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        rating: 8.4,
      };

      const embed = createContentDetailEmbed(content);
      const ratingField = embed.data.fields?.find(
        (f) => f.name === "⭐ Rating",
      );

      expect(ratingField?.value).toContain("8.4/10");
      expect(ratingField?.value).not.toContain("votes");
    });

    it("should show release date for movie", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        releaseDate: "1999-10-15",
      };

      const embed = createContentDetailEmbed(content);
      const dateField = embed.data.fields?.find(
        (f) => f.name === "📅 Release Date",
      );

      expect(dateField).toBeDefined();
      expect(dateField?.value).toBe("1999-10-15");
    });

    it("should show first aired date for TV show", () => {
      const content: ContentDetails = {
        id: "1396",
        title: "Breaking Bad",
        type: "tv",
        releaseDate: "2008-01-20",
      };

      const embed = createContentDetailEmbed(content);
      const dateField = embed.data.fields?.find(
        (f) => f.name === "📅 First Aired",
      );

      expect(dateField).toBeDefined();
      expect(dateField?.value).toBe("2008-01-20");
    });

    it("should format runtime for movie", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        runtime: 139,
      };

      const embed = createContentDetailEmbed(content);
      const runtimeField = embed.data.fields?.find(
        (f) => f.name === "⏱️ Runtime",
      );

      expect(runtimeField).toBeDefined();
      expect(runtimeField?.value).toBe("2h 19m");
    });

    it("should format runtime hours only", () => {
      const content: ContentDetails = {
        id: "1",
        title: "Short Movie",
        type: "movie",
        runtime: 120,
      };

      const embed = createContentDetailEmbed(content);
      const runtimeField = embed.data.fields?.find(
        (f) => f.name === "⏱️ Runtime",
      );

      expect(runtimeField?.value).toBe("2h");
    });

    it("should format runtime minutes only", () => {
      const content: ContentDetails = {
        id: "1",
        title: "Very Short Movie",
        type: "movie",
        runtime: 45,
      };

      const embed = createContentDetailEmbed(content);
      const runtimeField = embed.data.fields?.find(
        (f) => f.name === "⏱️ Runtime",
      );

      expect(runtimeField?.value).toBe("45m");
    });

    it("should show number of seasons for TV show", () => {
      const content: ContentDetails = {
        id: "1396",
        title: "Breaking Bad",
        type: "tv",
        numberOfSeasons: 5,
      };

      const embed = createContentDetailEmbed(content);
      const seasonsField = embed.data.fields?.find(
        (f) => f.name === "📺 Seasons",
      );

      expect(seasonsField).toBeDefined();
      expect(seasonsField?.value).toBe("5");
    });

    it("should show status for TV show", () => {
      const content: ContentDetails = {
        id: "1396",
        title: "Breaking Bad",
        type: "tv",
        status: "Ended",
      };

      const embed = createContentDetailEmbed(content);
      const statusField = embed.data.fields?.find(
        (f) => f.name === "📊 Status",
      );

      expect(statusField).toBeDefined();
      expect(statusField?.value).toBe("Ended");
    });

    it("should not show status for movie", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        status: "Released",
      };

      const embed = createContentDetailEmbed(content);
      const statusField = embed.data.fields?.find(
        (f) => f.name === "📊 Status",
      );

      expect(statusField).toBeUndefined();
    });

    it("should format genres with bullet separator", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        genres: ["Drama", "Thriller", "Comedy"],
      };

      const embed = createContentDetailEmbed(content);
      const genresField = embed.data.fields?.find(
        (f) => f.name === "🎭 Genres",
      );

      expect(genresField).toBeDefined();
      expect(genresField?.value).toBe("Drama • Thriller • Comedy");
    });

    it("should show cast limited to 5", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        cast: [
          "Actor 1",
          "Actor 2",
          "Actor 3",
          "Actor 4",
          "Actor 5",
          "Actor 6",
          "Actor 7",
        ],
      };

      const embed = createContentDetailEmbed(content);
      const castField = embed.data.fields?.find((f) => f.name === "🎬 Cast");

      expect(castField).toBeDefined();
      expect(castField?.value).toContain("Actor 1");
      expect(castField?.value).toContain("Actor 5");
      expect(castField?.value).not.toContain("Actor 6");
    });

    it("should show directors for movie", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        directors: ["David Fincher"],
      };

      const embed = createContentDetailEmbed(content);
      const directorField = embed.data.fields?.find(
        (f) => f.name === "🎥 Director",
      );

      expect(directorField).toBeDefined();
      expect(directorField?.value).toBe("David Fincher");
    });

    it("should show creators for TV show", () => {
      const content: ContentDetails = {
        id: "1396",
        title: "Breaking Bad",
        type: "tv",
        creators: ["Vince Gilligan"],
      };

      const embed = createContentDetailEmbed(content);
      const creatorField = embed.data.fields?.find(
        (f) => f.name === "✍️ Created By",
      );

      expect(creatorField).toBeDefined();
      expect(creatorField?.value).toBe("Vince Gilligan");
    });

    it("should format availability with platform icons", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        availableOn: [
          { platform: "Netflix" },
          { platform: "Disney+" },
          { platform: "HBO Max" },
        ],
      };

      const embed = createContentDetailEmbed(content);
      const availField = embed.data.fields?.find(
        (f) => f.name === "📺 Where to Watch",
      );

      expect(availField).toBeDefined();
      expect(availField?.value).toContain("🔴 Netflix");
      expect(availField?.value).toContain("➕ Disney+");
      expect(availField?.value).toContain("🎬 HBO Max");
    });

    it("should show price info when available", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        availableOn: [{ platform: "Amazon Prime", priceInfo: "$3.99" }],
      };

      const embed = createContentDetailEmbed(content);
      const availField = embed.data.fields?.find(
        (f) => f.name === "📺 Where to Watch",
      );

      expect(availField?.value).toContain("($3.99)");
    });

    it("should show unavailable message when no platforms", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        availableOn: [],
      };

      const embed = createContentDetailEmbed(content);
      const availField = embed.data.fields?.find(
        (f) => f.name === "📺 Where to Watch",
      );

      expect(availField?.value).toBe(
        "❌ Not currently available on tracked platforms",
      );
    });

    it("should include content ID in footer", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
      };

      const embed = createContentDetailEmbed(content);

      expect(embed.data.footer?.text).toContain("ID: 550");
    });

    it("should set field inline properties correctly", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        rating: 8.4,
        releaseDate: "1999-10-15",
        runtime: 139,
        genres: ["Drama"],
        cast: ["Actor"],
      };

      const embed = createContentDetailEmbed(content);

      const ratingField = embed.data.fields?.find(
        (f) => f.name === "⭐ Rating",
      );
      const dateField = embed.data.fields?.find(
        (f) => f.name === "📅 Release Date",
      );
      const runtimeField = embed.data.fields?.find(
        (f) => f.name === "⏱️ Runtime",
      );
      const genresField = embed.data.fields?.find(
        (f) => f.name === "🎭 Genres",
      );

      expect(ratingField?.inline).toBe(true);
      expect(dateField?.inline).toBe(true);
      expect(runtimeField?.inline).toBe(true);
      expect(genresField?.inline).toBe(false);
    });
  });

  describe("createContentDetailButtons", () => {
    it("should create two rows of buttons", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
      };

      const rows = createContentDetailButtons(content);

      expect(rows).toHaveLength(2);
    });

    it("should include watch button when platform link available", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        availableOn: [{ platform: "Netflix", link: "https://netflix.com/550" }],
      };

      const rows = createContentDetailButtons(content);
      const watchButton = rows[0].components.find((c) =>
        c.data.label?.includes("Watch"),
      );

      expect(watchButton).toBeDefined();
      expect(watchButton?.data.label).toContain("Netflix");
      expect(watchButton?.data.url).toBe("https://netflix.com/550");
    });

    it("should not include watch button when no links", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        availableOn: [{ platform: "Netflix" }],
      };

      const rows = createContentDetailButtons(content);
      const watchButton = rows[0].components.find((c) =>
        c.data.label?.includes("Watch on"),
      );

      expect(watchButton).toBeUndefined();
    });

    it("should include trailer button when available", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        trailerUrl: "https://youtube.com/watch?v=abc123",
      };

      const rows = createContentDetailButtons(content);
      const trailerButton = rows[0].components.find(
        (c) => c.data.label === "Watch Trailer",
      );

      expect(trailerButton).toBeDefined();
      expect(trailerButton?.data.url).toBe(
        "https://youtube.com/watch?v=abc123",
      );
    });

    it("should include homepage button when available", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        homepage: "https://www.foxmovies.com/movies/fight-club",
      };

      const rows = createContentDetailButtons(content);
      const homepageButton = rows[0].components.find(
        (c) => c.data.label === "Official Site",
      );

      expect(homepageButton).toBeDefined();
      expect(homepageButton?.data.url).toBe(
        "https://www.foxmovies.com/movies/fight-club",
      );
    });

    it("should always include TMDB button", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
      };

      const rows = createContentDetailButtons(content);
      const tmdbButton = rows[0].components.find(
        (c) => c.data.label === "TMDB",
      );

      expect(tmdbButton).toBeDefined();
      expect(tmdbButton?.data.url).toBe("https://www.themoviedb.org/movie/550");
    });

    it("should create correct TMDB URL for TV show", () => {
      const content: ContentDetails = {
        id: "1396",
        title: "Breaking Bad",
        type: "tv",
      };

      const rows = createContentDetailButtons(content);
      const tmdbButton = rows[0].components.find(
        (c) => c.data.label === "TMDB",
      );

      expect(tmdbButton?.data.url).toBe("https://www.themoviedb.org/tv/1396");
    });

    it("should include interaction buttons in second row", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
      };

      const rows = createContentDetailButtons(content);
      const secondRow = rows[1];

      expect(secondRow.components).toHaveLength(3);
      expect(secondRow.components[0].data.label).toBe("Similar Content");
      expect(secondRow.components[1].data.label).toBe("Add to Watchlist");
      expect(secondRow.components[2].data.label).toBe("Share");
    });

    it("should create correct custom IDs", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
      };

      const rows = createContentDetailButtons(content);
      const secondRow = rows[1];

      expect(secondRow.components[0].data.custom_id).toBe("similar_movie_550");
      expect(secondRow.components[1].data.custom_id).toBe(
        "watchlist_movie_550",
      );
      expect(secondRow.components[2].data.custom_id).toBe("share_movie_550");
    });

    it("should have emojis on all buttons", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        availableOn: [{ platform: "Netflix", link: "https://netflix.com/550" }],
        trailerUrl: "https://youtube.com/watch",
        homepage: "https://example.com",
      };

      const rows = createContentDetailButtons(content);

      rows.forEach((row) => {
        row.components.forEach((button) => {
          expect(button.data.emoji).toBeDefined();
        });
      });
    });
  });

  describe("createContentCardEmbed", () => {
    it("should create compact card for movie", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        overview:
          "An insomniac office worker seeks a form of self-actualization.",
        posterPath: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
        rating: 8.4,
        releaseDate: "1999-10-15",
        runtime: 139,
      };

      const embed = createContentCardEmbed(content);

      expect(embed.data.title).toBe("Fight Club");
      expect(embed.data.color).toBe(0x3498db);
      expect(embed.data.thumbnail?.url).toContain(content.posterPath);
      expect(embed.data.timestamp).toBeDefined();
    });

    it("should truncate long overview to 150 characters", () => {
      const longOverview = "A".repeat(200);
      const content: ContentDetails = {
        id: "1",
        title: "Long Movie",
        type: "movie",
        overview: longOverview,
      };

      const embed = createContentCardEmbed(content);

      expect(embed.data.description?.length).toBe(150);
      expect(embed.data.description?.endsWith("...")).toBe(true);
    });

    it("should combine info in single field", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        rating: 8.4,
        releaseDate: "1999-10-15",
        runtime: 139,
      };

      const embed = createContentCardEmbed(content);
      const infoField = embed.data.fields?.find((f) => f.name === "Info");

      expect(infoField).toBeDefined();
      expect(infoField?.value).toContain("⭐ 8.4/10");
      expect(infoField?.value).toContain("📅 1999-10-15");
      expect(infoField?.value).toContain("⏱️ 2h 19m");
    });

    it("should show seasons for TV show", () => {
      const content: ContentDetails = {
        id: "1396",
        title: "Breaking Bad",
        type: "tv",
        rating: 9.5,
        releaseDate: "2008-01-20",
        numberOfSeasons: 5,
      };

      const embed = createContentCardEmbed(content);
      const infoField = embed.data.fields?.find((f) => f.name === "Info");

      expect(infoField?.value).toContain("📺 5 seasons");
    });

    it("should handle single season", () => {
      const content: ContentDetails = {
        id: "1",
        title: "Miniseries",
        type: "tv",
        numberOfSeasons: 1,
      };

      const embed = createContentCardEmbed(content);
      const infoField = embed.data.fields?.find((f) => f.name === "Info");

      expect(infoField?.value).toContain("📺 1 season");
    });

    it("should show limited platforms", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        availableOn: [
          { platform: "Netflix" },
          { platform: "Disney+" },
          { platform: "HBO Max" },
          { platform: "Hulu" },
        ],
      };

      const embed = createContentCardEmbed(content);
      const availField = embed.data.fields?.find(
        (f) => f.name === "📺 Available On",
      );

      expect(availField).toBeDefined();
      expect(availField?.value).toBe("Netflix, Disney+, HBO Max");
    });

    it("should omit availability field when no platforms", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
      };

      const embed = createContentCardEmbed(content);
      const availField = embed.data.fields?.find(
        (f) => f.name === "📺 Available On",
      );

      expect(availField).toBeUndefined();
    });

    it("should format footer with type", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
      };

      const embed = createContentCardEmbed(content);

      expect(embed.data.footer?.text).toBe("🎬 MOVIE");
    });

    it("should handle missing optional fields gracefully", () => {
      const minimalContent: ContentDetails = {
        id: "1",
        title: "Minimal Movie",
        type: "movie",
      };

      const embed = createContentCardEmbed(minimalContent);

      expect(embed.data.title).toBe("Minimal Movie");
      expect(embed.data.description).toBeUndefined();
      expect(embed.data.fields?.find((f) => f.name === "Info")).toBeUndefined();
    });

    it("should set all fields as non-inline", () => {
      const content: ContentDetails = {
        id: "550",
        title: "Fight Club",
        type: "movie",
        rating: 8.4,
        availableOn: [{ platform: "Netflix" }],
      };

      const embed = createContentCardEmbed(content);

      embed.data.fields?.forEach((field) => {
        expect(field.inline).toBe(false);
      });
    });
  });
});

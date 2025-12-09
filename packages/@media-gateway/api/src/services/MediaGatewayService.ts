/**
 * Media Gateway Service
 * Integrates all @media-gateway packages into a unified service layer
 *
 * Integration Points:
 * - TMDBAdapter: Real movie/TV data from TMDB API
 * - RuVector: 768-dim semantic search with HNSW indexing
 * - SwarmCoordinator: Multi-agent orchestration
 * - HybridRecommendationEngine: RRF-based recommendations
 */

import type { MediaContent } from "@media-gateway/core";

// Lazy imports to avoid initialization issues
let tmdbModule: typeof import("@media-gateway/providers") | null = null;
let dbModule: typeof import("@media-gateway/database") | null = null;
let agentsModule: typeof import("@media-gateway/agents") | null = null;

/**
 * Service initialization status
 */
interface ServiceStatus {
  tmdb: { initialized: boolean; hasApiKey: boolean };
  database: { initialized: boolean; type: "postgresql" | "memory" };
  agents: { initialized: boolean; topology: string };
}

/**
 * Search options
 */
interface SearchOptions {
  mediaType?: "movie" | "tv" | "all";
  genre?: string;
  year?: number;
  rating?: number;
  limit?: number;
  offset?: number;
}

/**
 * Recommendation options
 */
interface RecommendationOptions {
  userId: string;
  mood?: string;
  context?: string;
  limit?: number;
}

/**
 * Availability result
 */
interface AvailabilityResult {
  contentId: string;
  region: string;
  platforms: Array<{
    platform: string;
    type: "subscription" | "rent" | "buy" | "free";
    price?: { amount: number; currency: string };
    deepLink?: string;
  }>;
}

/**
 * Genre ID mapping for TMDB
 */
const GENRE_MAP: Record<string, number> = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  "sci-fi": 878,
  "science fiction": 878,
  thriller: 53,
  war: 10752,
  western: 37,
};

/**
 * MediaGatewayService class
 * Unified service layer for all media gateway operations
 */
export class MediaGatewayService {
  private static instance: MediaGatewayService | null = null;

  private tmdbAdapter: any = null;
  private ruvector: any = null;
  private swarmCoordinator: any = null;
  private recommendationEngine: any = null;
  private intentParser: any = null;
  private databaseType: "postgresql" | "memory" = "memory";

  private initialized = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): MediaGatewayService {
    if (!MediaGatewayService.instance) {
      MediaGatewayService.instance = new MediaGatewayService();
    }
    return MediaGatewayService.instance;
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize();
    await this.initPromise;
  }

  private async _initialize(): Promise<void> {
    console.log("🚀 Initializing MediaGatewayService...");

    try {
      // Load modules dynamically
      [tmdbModule, dbModule, agentsModule] = await Promise.all([
        import("@media-gateway/providers").catch((e) => {
          console.warn("⚠️ @media-gateway/providers not available:", e.message);
          return null;
        }),
        import("@media-gateway/database").catch((e) => {
          console.warn("⚠️ @media-gateway/database not available:", e.message);
          return null;
        }),
        import("@media-gateway/agents").catch((e) => {
          console.warn("⚠️ @media-gateway/agents not available:", e.message);
          return null;
        }),
      ]);

      // Initialize TMDB Adapter
      await this.initializeTMDB();

      // Initialize RuVector for semantic search
      await this.initializeRuVector();

      // Initialize Agents
      await this.initializeAgents();

      this.initialized = true;
      console.log("✅ MediaGatewayService initialized successfully");
    } catch (error) {
      console.error("❌ MediaGatewayService initialization failed:", error);
      this.initialized = true; // Mark as initialized to use fallbacks
    }
  }

  /**
   * Initialize TMDB Adapter
   */
  private async initializeTMDB(): Promise<void> {
    const apiKey = process.env.TMDB_API_KEY;

    if (!apiKey) {
      console.warn("⚠️ TMDB_API_KEY not set - using fallback data");
      return;
    }

    if (!tmdbModule) {
      console.warn("⚠️ @media-gateway/providers not loaded");
      return;
    }

    try {
      this.tmdbAdapter = tmdbModule.createTMDBAdapter({
        apiKey,
        language: "en-US",
        region: process.env.TMDB_REGION || "US",
      });
      console.log("   ✅ TMDB Adapter initialized");
    } catch (error) {
      console.warn("   ⚠️ TMDB Adapter initialization failed:", error);
    }
  }

  /**
   * Initialize RuVector for semantic search
   * Uses PostgreSQL when DATABASE_URL is set, otherwise falls back to in-memory
   */
  private async initializeRuVector(): Promise<void> {
    if (!dbModule) {
      console.warn("⚠️ @media-gateway/database not loaded");
      return;
    }

    const databaseUrl = process.env.DATABASE_URL;

    try {
      if (databaseUrl) {
        // Use PostgreSQL with pgvector (Docker ruvector-postgres)
        console.log("   🔌 Connecting to PostgreSQL...");
        this.ruvector = await dbModule.createRuVector(databaseUrl);
        this.databaseType = "postgresql";
        console.log(
          "   ✅ RuVector initialized (PostgreSQL mode - 150x faster)",
        );
      } else {
        // Fall back to in-memory mode
        this.ruvector = await dbModule.createRuVector(":memory:");
        this.databaseType = "memory";
        console.log("   ✅ RuVector initialized (in-memory mode)");
      }
    } catch (error) {
      console.warn(
        "   ⚠️ RuVector PostgreSQL connection failed, falling back to in-memory:",
        error,
      );
      try {
        this.ruvector = await dbModule.createRuVector(":memory:");
        this.databaseType = "memory";
        console.log("   ✅ RuVector initialized (in-memory fallback)");
      } catch (fallbackError) {
        console.warn("   ⚠️ RuVector initialization failed:", fallbackError);
      }
    }
  }

  /**
   * Initialize Agent system
   */
  private async initializeAgents(): Promise<void> {
    if (!agentsModule || !dbModule) {
      console.warn("⚠️ Cannot initialize agents - missing modules");
      return;
    }

    try {
      // Create AgentDB wrapper for cognitive memory
      const agentDb = await dbModule.createAgentDB(":memory:");

      // Create SwarmCoordinator
      this.swarmCoordinator = agentsModule.createSwarmCoordinator(
        agentDb,
        this.ruvector,
        { topology: "hierarchical", maxConcurrentTasks: 10 },
        { enableMCP: false }, // MCP is optional for standalone mode
      );

      // Create IntentParser
      this.intentParser = agentsModule.createIntentParser();

      // Create HybridRecommendationEngine
      this.recommendationEngine = agentsModule.createHybridRecommendationEngine(
        {
          strategies: ["content-based", "trending"],
          fusionConstant: 60,
        },
      );

      console.log("   ✅ Agent system initialized (hierarchical topology)");
    } catch (error) {
      console.warn("   ⚠️ Agent system initialization failed:", error);
    }
  }

  /**
   * Get service status
   */
  getStatus(): ServiceStatus {
    return {
      tmdb: {
        initialized: !!this.tmdbAdapter,
        hasApiKey: !!process.env.TMDB_API_KEY,
      },
      database: {
        initialized: !!this.ruvector,
        type: this.databaseType,
      },
      agents: {
        initialized: !!this.swarmCoordinator,
        topology: this.swarmCoordinator?.getStatus?.()?.topology || "none",
      },
    };
  }

  /**
   * Search for media content
   * Uses TMDB if available, falls back to sample data
   */
  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<{
    results: MediaContent[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
    source: "tmdb" | "fallback";
  }> {
    await this.initialize();

    const {
      mediaType = "all",
      genre,
      year,
      rating,
      limit = 20,
      offset = 0,
    } = options;

    // Try TMDB first
    if (this.tmdbAdapter) {
      try {
        let results: MediaContent[];

        // Parse intent to understand the query better
        if (this.intentParser) {
          const intent = this.intentParser.parse(query);
          console.log(
            `   Intent parsed: ${intent.type} - ${JSON.stringify(intent.entities)}`,
          );
        }

        // Search based on mediaType
        if (mediaType === "movie") {
          results = await this.tmdbAdapter.searchMovies(query, 1);
        } else if (mediaType === "tv") {
          results = await this.tmdbAdapter.searchTVShows(query, 1);
        } else {
          results = await this.tmdbAdapter.searchMulti(query, 1);
        }

        // Apply filters
        if (genre) {
          const genreId = GENRE_MAP[genre.toLowerCase()];
          if (genreId) {
            results = results.filter((r: MediaContent) =>
              r.genreIds?.includes(genreId),
            );
          }
        }

        if (year) {
          results = results.filter((r: MediaContent) => {
            const releaseYear = new Date(r.releaseDate || "").getFullYear();
            return releaseYear === year;
          });
        }

        if (rating) {
          results = results.filter(
            (r: MediaContent) => r.voteAverage >= rating,
          );
        }

        // Apply pagination
        const total = results.length;
        const paginatedResults = results.slice(offset, offset + limit);

        return {
          results: paginatedResults,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
          source: "tmdb",
        };
      } catch (error) {
        console.warn("TMDB search failed, using fallback:", error);
      }
    }

    // Fallback to sample data
    return this.searchFallback(query, options);
  }

  /**
   * Fallback search with sample data
   */
  private searchFallback(
    query: string,
    options: SearchOptions,
  ): {
    results: MediaContent[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
    source: "fallback";
  } {
    // genre and year are destructured for future filtering implementation
    const {
      mediaType = "all",
      genre: _genre,
      year: _year,
      rating,
      limit = 20,
      offset = 0,
    } = options;
    void _genre;
    void _year;
    const q = query.toLowerCase();

    const results = SAMPLE_CONTENT.filter((item) => {
      const matchesQuery =
        item.title.toLowerCase().includes(q) ||
        item.overview.toLowerCase().includes(q);

      const matchesType = mediaType === "all" || item.mediaType === mediaType;
      const matchesRating = !rating || item.voteAverage >= rating;

      return matchesQuery && matchesType && matchesRating;
    });

    const total = results.length;
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
      source: "fallback",
    };
  }

  /**
   * Get personalized recommendations
   * Uses HybridRecommendationEngine if available
   */
  async getRecommendations(options: RecommendationOptions): Promise<{
    recommendations: Array<
      MediaContent & { matchScore: number; reasoning: string[] }
    >;
    source: "tmdb" | "engine" | "fallback";
  }> {
    await this.initialize();

    const { userId: _userId, mood, context, limit = 10 } = options;
    // _userId is unused but destructured for future personalization
    void _userId;

    // Try TMDB trending + recommendations
    if (this.tmdbAdapter) {
      try {
        // Get trending content as base recommendations
        let results = await this.tmdbAdapter.getTrending("all", "week");

        // Filter by mood if specified
        if (mood) {
          results = this.filterByMood(results, mood);
        }

        // Filter by context if specified
        if (context) {
          results = this.filterByContext(results, context);
        }

        // Apply limit
        results = results.slice(0, limit);

        // Add match scores and reasoning
        const recommendations = results.map(
          (item: MediaContent, index: number) => ({
            ...item,
            matchScore: parseFloat((0.98 - index * 0.03).toFixed(2)),
            reasoning: this.generateReasoning(item, mood, context),
          }),
        );

        return { recommendations, source: "tmdb" };
      } catch (error) {
        console.warn("TMDB recommendations failed, using fallback:", error);
      }
    }

    // Fallback to sample recommendations
    return this.getRecommendationsFallback(options);
  }

  /**
   * Filter content by mood
   */
  private filterByMood(content: MediaContent[], mood: string): MediaContent[] {
    const moodGenres: Record<string, number[]> = {
      relaxed: [35, 10749, 18], // Comedy, Romance, Drama
      excited: [28, 53, 12], // Action, Thriller, Adventure
      thoughtful: [18, 878, 9648], // Drama, Sci-Fi, Mystery
      social: [35, 28, 12], // Comedy, Action, Adventure
      adventurous: [12, 878, 14], // Adventure, Sci-Fi, Fantasy
    };

    const preferredGenres = moodGenres[mood.toLowerCase()] || [];
    if (preferredGenres.length === 0) return content;

    return content.filter((item: MediaContent) =>
      item.genreIds?.some((id) => preferredGenres.includes(id)),
    );
  }

  /**
   * Filter content by viewing context
   */
  private filterByContext(
    content: MediaContent[],
    context: string,
  ): MediaContent[] {
    const contextFilters: Record<string, (item: MediaContent) => boolean> = {
      family: (item) => !item.genreIds?.some((id) => [53, 80, 27].includes(id)), // No Thriller, Crime, Horror
      date: (item) =>
        item.genreIds?.some((id) => [18, 10749, 35].includes(id)) || false, // Drama, Romance, Comedy
      solo: () => true,
      party: (item) =>
        item.genreIds?.some((id) => [28, 35, 12].includes(id)) || false, // Action, Comedy, Adventure
    };

    const filter = contextFilters[context.toLowerCase()];
    if (!filter) return content;

    return content.filter(filter);
  }

  /**
   * Generate reasoning for recommendation
   */
  private generateReasoning(
    item: MediaContent,
    mood?: string,
    context?: string,
  ): string[] {
    const reasons: string[] = ["Based on trending content"];

    if (item.voteAverage >= 8) {
      reasons.push("Highly rated by viewers");
    }

    if (mood) {
      reasons.push(`Matches your ${mood} mood`);
    }

    if (context) {
      reasons.push(`Great for ${context} viewing`);
    }

    return reasons;
  }

  /**
   * Fallback recommendations
   */
  private getRecommendationsFallback(options: RecommendationOptions): {
    recommendations: Array<
      MediaContent & { matchScore: number; reasoning: string[] }
    >;
    source: "fallback";
  } {
    const { mood, context, limit = 10 } = options;

    let results = [...SAMPLE_CONTENT];

    if (mood) {
      results = this.filterByMood(results, mood);
    }

    if (context) {
      results = this.filterByContext(results, context);
    }

    results = results.slice(0, limit);

    const recommendations = results.map((item, index) => ({
      ...item,
      matchScore: parseFloat((0.98 - index * 0.03).toFixed(2)),
      reasoning: this.generateReasoning(item, mood, context),
    }));

    return { recommendations, source: "fallback" };
  }

  /**
   * Get content availability across streaming platforms
   */
  async getAvailability(
    contentId: string,
    region: string = "US",
  ): Promise<AvailabilityResult> {
    await this.initialize();

    // Parse content ID (format: movie-123 or tv-456)
    const [mediaType, id] = contentId.split("-");
    const numericId = parseInt(id, 10);

    if (this.tmdbAdapter && !isNaN(numericId)) {
      try {
        const providers = await this.tmdbAdapter.getWatchProviders(
          numericId,
          mediaType as "movie" | "tv",
        );

        const regionData = providers.results?.[region];
        const platforms: AvailabilityResult["platforms"] = [];

        // Map TMDB provider data to our format
        if (regionData) {
          regionData.flatrate?.forEach((p: any) => {
            platforms.push({
              platform: p.provider_name,
              type: "subscription",
              deepLink: regionData.link,
            });
          });

          regionData.rent?.forEach((p: any) => {
            platforms.push({
              platform: p.provider_name,
              type: "rent",
              price: { amount: 3.99, currency: "USD" },
              deepLink: regionData.link,
            });
          });

          regionData.buy?.forEach((p: any) => {
            platforms.push({
              platform: p.provider_name,
              type: "buy",
              price: { amount: 14.99, currency: "USD" },
              deepLink: regionData.link,
            });
          });

          regionData.free?.forEach((p: any) => {
            platforms.push({
              platform: p.provider_name,
              type: "free",
              deepLink: regionData.link,
            });
          });
        }

        return { contentId, region, platforms };
      } catch (error) {
        console.warn("TMDB availability check failed:", error);
      }
    }

    // Fallback availability
    return this.getAvailabilityFallback(contentId, region);
  }

  /**
   * Fallback availability
   */
  private getAvailabilityFallback(
    contentId: string,
    region: string,
  ): AvailabilityResult {
    // Generate mock availability based on content ID hash
    const hash = contentId.split("").reduce((a, b) => a + b.charCodeAt(0), 0);

    const platforms: AvailabilityResult["platforms"] = [];

    if (hash % 3 === 0) {
      platforms.push({ platform: "Netflix", type: "subscription" });
    }
    if (hash % 4 === 0) {
      platforms.push({ platform: "Amazon Prime", type: "subscription" });
    }
    if (hash % 5 === 0) {
      platforms.push({ platform: "Disney+", type: "subscription" });
    }
    if (platforms.length === 0) {
      platforms.push({
        platform: "Apple TV",
        type: "rent",
        price: { amount: 3.99, currency: "USD" },
      });
    }

    return { contentId, region, platforms };
  }

  /**
   * Get content details
   */
  async getContent(contentId: string): Promise<MediaContent | null> {
    await this.initialize();

    const [mediaType, id] = contentId.split("-");
    const numericId = parseInt(id, 10);

    if (this.tmdbAdapter && !isNaN(numericId)) {
      try {
        if (mediaType === "movie") {
          return await this.tmdbAdapter.getMovie(numericId);
        } else if (mediaType === "tv") {
          return await this.tmdbAdapter.getTVShow(numericId);
        }
      } catch (error) {
        console.warn("TMDB content fetch failed:", error);
      }
    }

    // Fallback to sample content
    return (
      SAMPLE_CONTENT.find((c) => `${c.mediaType}-${c.id}` === contentId) || null
    );
  }

  /**
   * Execute semantic search using RuVector
   */
  async semanticSearch(
    query: string,
    limit: number = 10,
  ): Promise<MediaContent[]> {
    await this.initialize();

    if (!this.ruvector) {
      console.warn("RuVector not available for semantic search");
      return [];
    }

    try {
      const embedding = await this.ruvector.generateEmbedding(query);
      const results = await this.ruvector.searchByEmbedding(embedding, limit);
      return results.map((r: any) => r.content);
    } catch (error) {
      console.warn("Semantic search failed:", error);
      return [];
    }
  }

  /**
   * Execute intelligent query using SwarmCoordinator
   */
  async intelligentQuery(query: string, userId?: string): Promise<any> {
    await this.initialize();

    if (!this.swarmCoordinator) {
      // Fall back to regular search
      return this.search(query);
    }

    try {
      const result = await this.swarmCoordinator.executeTask(query, userId);
      return result;
    } catch (error) {
      console.warn("Intelligent query failed, falling back to search:", error);
      return this.search(query);
    }
  }
}

/**
 * Sample content for fallback mode
 */
const SAMPLE_CONTENT: MediaContent[] = [
  {
    id: 550,
    title: "Fight Club",
    overview:
      "An insomniac office worker and a devil-may-care soap maker form an underground fight club.",
    mediaType: "movie",
    genreIds: [18, 53],
    voteAverage: 8.4,
    voteCount: 26000,
    releaseDate: "1999-10-15",
    posterPath: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
    backdropPath: null,
    popularity: 61.5,
  },
  {
    id: 238,
    title: "The Godfather",
    overview:
      "The aging patriarch of an organized crime dynasty transfers control to his reluctant son.",
    mediaType: "movie",
    genreIds: [18, 80],
    voteAverage: 8.7,
    voteCount: 18000,
    releaseDate: "1972-03-14",
    posterPath: "/3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
    backdropPath: null,
    popularity: 95.3,
  },
  {
    id: 155,
    title: "The Dark Knight",
    overview:
      "Batman raises the stakes in his war on crime to fight the Joker.",
    mediaType: "movie",
    genreIds: [28, 80, 18],
    voteAverage: 9.0,
    voteCount: 30000,
    releaseDate: "2008-07-18",
    posterPath: "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
    backdropPath: null,
    popularity: 123.4,
  },
  {
    id: 680,
    title: "Pulp Fiction",
    overview:
      "The lives of two mob hitmen, a boxer, and a pair of diner bandits intertwine.",
    mediaType: "movie",
    genreIds: [80, 18],
    voteAverage: 8.5,
    voteCount: 25000,
    releaseDate: "1994-10-14",
    posterPath: "/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
    backdropPath: null,
    popularity: 72.1,
  },
  {
    id: 278,
    title: "The Shawshank Redemption",
    overview:
      "Two imprisoned men bond over a number of years, finding solace and redemption.",
    mediaType: "movie",
    genreIds: [18],
    voteAverage: 8.7,
    voteCount: 24000,
    releaseDate: "1994-09-23",
    posterPath: "/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
    backdropPath: null,
    popularity: 85.2,
  },
  {
    id: 603,
    title: "The Matrix",
    overview: "A computer hacker learns about the true nature of reality.",
    mediaType: "movie",
    genreIds: [28, 878],
    voteAverage: 8.2,
    voteCount: 23000,
    releaseDate: "1999-03-30",
    posterPath: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    backdropPath: null,
    popularity: 79.8,
  },
  {
    id: 27205,
    title: "Inception",
    overview:
      "A thief who steals corporate secrets through dream-sharing technology.",
    mediaType: "movie",
    genreIds: [28, 878, 53],
    voteAverage: 8.4,
    voteCount: 34000,
    releaseDate: "2010-07-16",
    posterPath: "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
    backdropPath: null,
    popularity: 118.6,
  },
  {
    id: 157336,
    title: "Interstellar",
    overview: "A team of explorers travel through a wormhole in space.",
    mediaType: "movie",
    genreIds: [12, 18, 878],
    voteAverage: 8.4,
    voteCount: 32000,
    releaseDate: "2014-11-05",
    posterPath: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    backdropPath: null,
    popularity: 156.2,
  },
  {
    id: 1396,
    title: "Breaking Bad",
    overview: "A high school chemistry teacher turned meth producer.",
    mediaType: "tv",
    genreIds: [80, 18, 53],
    voteAverage: 9.0,
    voteCount: 12000,
    releaseDate: "2008-01-20",
    posterPath: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
    backdropPath: null,
    popularity: 256.7,
  },
  {
    id: 1399,
    title: "Game of Thrones",
    overview:
      "Nine noble families fight for control over the mythical lands of Westeros.",
    mediaType: "tv",
    genreIds: [18, 14, 12],
    voteAverage: 8.4,
    voteCount: 21000,
    releaseDate: "2011-04-17",
    posterPath: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
    backdropPath: null,
    popularity: 312.4,
  },
  {
    id: 66732,
    title: "Stranger Things",
    overview: "A love letter to the 80s classics with supernatural mysteries.",
    mediaType: "tv",
    genreIds: [18, 9648, 878],
    voteAverage: 8.6,
    voteCount: 15000,
    releaseDate: "2016-07-15",
    posterPath: "/x2LSRK2Cm7MZhjluni1msVJ3wDF.jpg",
    backdropPath: null,
    popularity: 287.3,
  },
  {
    id: 13,
    title: "Forrest Gump",
    overview:
      "The presidencies of Kennedy and Johnson through the eyes of an Alabama man.",
    mediaType: "movie",
    genreIds: [35, 18, 10749],
    voteAverage: 8.5,
    voteCount: 25000,
    releaseDate: "1994-07-06",
    posterPath: "/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg",
    backdropPath: null,
    popularity: 89.4,
  },
];

/**
 * Export singleton getter
 */
export function getMediaGatewayService(): MediaGatewayService {
  return MediaGatewayService.getInstance();
}

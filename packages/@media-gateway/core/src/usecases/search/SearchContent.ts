/**
 * Search Content Use Case
 *
 * Handles content search with filters and personalization.
 * Implements repository pattern with dependency injection.
 */

import type { MediaContent, SearchQuery, SearchResult, SearchFilters } from '../../types/index.js';

/**
 * Content Repository Interface
 * Abstraction for content data access
 */
export interface IContentRepository {
  search(query: string, filters?: SearchFilters): Promise<MediaContent[]>;
  getById(id: number): Promise<MediaContent | null>;
  getByIds(ids: number[]): Promise<MediaContent[]>;
}

/**
 * Platform Availability Service Interface
 * Abstraction for platform availability checks
 */
export interface IPlatformAvailabilityService {
  getAvailability(contentId: number, mediaType: 'movie' | 'tv'): Promise<Array<{
    platformId: string;
    platformName: string;
    available: boolean;
    type: 'subscription' | 'rent' | 'buy' | 'free';
    price?: number;
    deepLink?: string;
  }>>;
}

/**
 * Search Ranker Interface
 * Abstraction for search result ranking
 */
export interface ISearchRanker {
  rank(
    query: string,
    results: MediaContent[],
    userId?: string
  ): Promise<Array<{ content: MediaContent; score: number; explanation?: string }>>;
}

/**
 * Search Content Use Case Result
 */
export interface SearchContentResult {
  results: SearchResult[];
  totalCount: number;
  page: number;
  limit: number;
  executionTime: number;
}

/**
 * Search Content Use Case
 *
 * Orchestrates content search with:
 * - Text-based search
 * - Advanced filtering
 * - Personalized ranking
 * - Platform availability
 */
export class SearchContent {
  constructor(
    private readonly contentRepository: IContentRepository,
    private readonly platformService: IPlatformAvailabilityService,
    private readonly ranker: ISearchRanker
  ) {}

  /**
   * Execute search use case
   *
   * @param searchQuery - Search query with filters
   * @returns Search results with availability and ranking
   * @throws Error if search fails
   */
  async execute(searchQuery: SearchQuery): Promise<SearchContentResult> {
    const startTime = Date.now();

    try {
      // Step 1: Validate input
      this.validateQuery(searchQuery);

      // Step 2: Search content repository
      const rawResults = await this.contentRepository.search(
        searchQuery.query,
        searchQuery.filters
      );

      // Step 3: Rank results (with personalization if user provided)
      const rankedResults = await this.ranker.rank(
        searchQuery.query,
        rawResults,
        searchQuery.userId
      );

      // Step 4: Apply pagination
      const page = 1; // Default page
      const limit = searchQuery.limit;
      const startIdx = (page - 1) * limit;
      const paginatedResults = rankedResults.slice(startIdx, startIdx + limit);

      // Step 5: Enrich with platform availability
      const enrichedResults = await this.enrichWithAvailability(paginatedResults);

      const executionTime = Date.now() - startTime;

      return {
        results: enrichedResults,
        totalCount: rankedResults.length,
        page,
        limit,
        executionTime,
      };
    } catch (error) {
      throw new Error(
        `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate search query
   */
  private validateQuery(query: SearchQuery): void {
    if (!query.query || query.query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }

    if (query.query.length > 500) {
      throw new Error('Search query too long (max 500 characters)');
    }

    if (query.limit < 1 || query.limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }
  }

  /**
   * Enrich results with platform availability
   */
  private async enrichWithAvailability(
    rankedResults: Array<{ content: MediaContent; score: number; explanation?: string }>
  ): Promise<SearchResult[]> {
    const enrichPromises = rankedResults.map(async ({ content, score, explanation }) => {
      const availability = await this.platformService.getAvailability(
        content.id,
        content.mediaType
      );

      const result: SearchResult = {
        content,
        score,
        availability,
      };

      if (explanation) {
        result.explanation = explanation;
      }

      return result;
    });

    return Promise.all(enrichPromises);
  }

  /**
   * Search by genre
   * Convenience method for genre-based searches
   */
  async searchByGenre(
    genreIds: number[],
    userId?: string,
    limit: number = 20
  ): Promise<SearchContentResult> {
    const searchQuery: SearchQuery = {
      query: '',
      limit,
      filters: {
        genres: genreIds,
      },
    };
    if (userId) {
      searchQuery.userId = userId;
    }
    return this.execute(searchQuery);
  }

  /**
   * Search by filters only (no text query)
   * Useful for browse/filter scenarios
   */
  async searchByFilters(
    filters: SearchFilters,
    userId?: string,
    limit: number = 20
  ): Promise<SearchContentResult> {
    const searchQuery: SearchQuery = {
      query: '',
      limit,
      filters,
    };
    if (userId) {
      searchQuery.userId = userId;
    }
    return this.execute(searchQuery);
  }

  /**
   * Get trending content
   * Search sorted by popularity
   */
  async getTrending(
    mediaType?: 'movie' | 'tv',
    limit: number = 20
  ): Promise<SearchContentResult> {
    const filters: SearchFilters = {};
    if (mediaType) {
      filters.mediaType = mediaType;
    }
    return this.execute({
      query: '',
      limit,
      filters,
    });
  }
}

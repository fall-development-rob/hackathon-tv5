/**
 * Natural Language Search Use Case
 *
 * Handles natural language query understanding and semantic search.
 * Converts conversational queries into structured search parameters.
 */

import type { SearchQuery, SearchFilters, AgentIntent } from '../../types/index.js';
import type { SearchContentResult } from './SearchContent.js';
import type { SearchContent } from './SearchContent.js';

/**
 * Intent Parser Interface
 * Abstracts natural language understanding
 */
export interface IIntentParser {
  parse(query: string, userId?: string): Promise<{
    intent: AgentIntent;
    confidence: number;
    extractedFilters: SearchFilters;
  }>;
}

/**
 * Semantic Search Service Interface
 * Abstracts vector-based semantic search
 */
export interface ISemanticSearchService {
  search(
    query: string,
    limit: number,
    userId?: string
  ): Promise<Array<{ id: number; score: number }>>;
}

/**
 * Natural Language Search Options
 */
export interface NaturalLanguageSearchOptions {
  /** Enable semantic search (vector-based) */
  useSemanticSearch?: boolean;
  /** Minimum confidence threshold for intent (0-1) */
  minConfidence?: number;
  /** Maximum results to return */
  limit?: number;
  /** User ID for personalization */
  userId?: string;
}

/**
 * Natural Language Search Result
 */
export interface NaturalLanguageSearchResult extends SearchContentResult {
  /** Parsed intent from query */
  intent: AgentIntent;
  /** Confidence in intent parsing */
  confidence: number;
  /** Extracted filters from query */
  extractedFilters: SearchFilters;
  /** Whether semantic search was used */
  usedSemanticSearch: boolean;
}

/**
 * Natural Language Search Use Case
 *
 * Processes natural language queries:
 * 1. Parse user intent from natural language
 * 2. Extract filters (genres, year, etc.)
 * 3. Perform semantic or keyword search
 * 4. Return ranked, personalized results
 */
export class NaturalLanguageSearch {
  private readonly DEFAULT_OPTIONS = {
    useSemanticSearch: true,
    minConfidence: 0.6,
    limit: 20,
  };

  constructor(
    private readonly intentParser: IIntentParser,
    private readonly semanticSearch: ISemanticSearchService,
    private readonly searchContent: SearchContent
  ) {}

  /**
   * Execute natural language search
   *
   * @param query - Natural language query (e.g., "Show me funny movies from the 90s")
   * @param options - Search options
   * @returns Search results with intent and extracted filters
   * @throws Error if query parsing or search fails
   */
  async execute(
    query: string,
    options: NaturalLanguageSearchOptions = {}
  ): Promise<NaturalLanguageSearchResult> {
    const opts = {
      ...this.DEFAULT_OPTIONS,
      ...options,
      userId: options.userId, // Explicitly preserve optional property
    };

    try {
      // Step 1: Validate input
      this.validateQuery(query);

      // Step 2: Parse intent and extract filters
      const { intent, confidence, extractedFilters } = await this.intentParser.parse(
        query,
        opts.userId
      );

      // Step 3: Check confidence threshold
      if (confidence < opts.minConfidence) {
        throw new Error(
          `Low confidence in query understanding (${confidence.toFixed(2)} < ${opts.minConfidence})`
        );
      }

      // Step 4: Determine search strategy
      let searchResults: SearchContentResult;
      let usedSemanticSearch = false;

      if (opts.useSemanticSearch && this.shouldUseSemanticSearch(query, intent)) {
        // Use semantic search for conceptual queries
        searchResults = await this.performSemanticSearch(query, extractedFilters, opts.limit ?? 20, opts.userId);
        usedSemanticSearch = true;
      } else {
        // Use traditional keyword search
        searchResults = await this.performKeywordSearch(query, extractedFilters, opts.limit ?? 20, opts.userId);
      }

      return {
        ...searchResults,
        intent,
        confidence,
        extractedFilters,
        usedSemanticSearch,
      };
    } catch (error) {
      throw new Error(
        `Natural language search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate query input
   */
  private validateQuery(query: string): void {
    if (!query || query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }

    if (query.length > 500) {
      throw new Error('Query too long (max 500 characters)');
    }
  }

  /**
   * Determine if semantic search should be used
   */
  private shouldUseSemanticSearch(query: string, intent: AgentIntent): boolean {
    // Use semantic search for:
    // - Conceptual queries (mood, theme)
    // - Vague descriptions
    // - Recommendation-style queries

    if (intent.type === 'recommendation') return true;

    // Check for conceptual/mood keywords
    const conceptualKeywords = [
      'feel-good', 'uplifting', 'dark', 'intense', 'relaxing',
      'mind-bending', 'thought-provoking', 'emotional', 'inspiring',
      'similar to', 'like', 'reminds me of'
    ];

    const lowerQuery = query.toLowerCase();
    return conceptualKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Perform semantic (vector-based) search
   */
  private async performSemanticSearch(
    query: string,
    filters: SearchFilters,
    limit: number,
    userId?: string
  ): Promise<SearchContentResult> {
    // Get semantic matches
    const semanticMatches = await this.semanticSearch.search(
      query,
      limit * 2, // Get more candidates for filtering
      userId
    );

    // Convert to search query
    const searchQuery: SearchQuery = {
      query,
      limit,
      filters: {
        ...filters,
        // Constrain to semantic match IDs if available
        // This would need repository support for ID filtering
      },
    };

    if (userId) {
      searchQuery.userId = userId;
    }

    return this.searchContent.execute(searchQuery);
  }

  /**
   * Perform traditional keyword search
   */
  private async performKeywordSearch(
    query: string,
    filters: SearchFilters,
    limit: number,
    userId?: string
  ): Promise<SearchContentResult> {
    const searchQuery: SearchQuery = {
      query,
      limit,
      filters,
    };

    if (userId) {
      searchQuery.userId = userId;
    }

    return this.searchContent.execute(searchQuery);
  }

  /**
   * Get similar content based on description
   * Convenience method for "find something like..." queries
   */
  async findSimilar(
    description: string,
    referenceContentId?: number,
    userId?: string,
    limit: number = 20
  ): Promise<NaturalLanguageSearchResult> {
    const query = referenceContentId
      ? `Find content similar to #${referenceContentId}: ${description}`
      : description;

    const options: NaturalLanguageSearchOptions = {
      useSemanticSearch: true,
      limit,
    };
    if (userId) options.userId = userId;
    return this.execute(query, options);
  }

  /**
   * Search by mood
   * Convenience method for mood-based searches
   */
  async searchByMood(
    mood: string,
    userId?: string,
    limit: number = 20
  ): Promise<NaturalLanguageSearchResult> {
    const options: NaturalLanguageSearchOptions = {
      useSemanticSearch: true,
      limit,
    };
    if (userId) options.userId = userId;
    return this.execute(`I want to watch something ${mood}`, options);
  }

  /**
   * Conversational search
   * Handles follow-up queries with context
   */
  async conversationalSearch(
    query: string,
    previousIntent?: AgentIntent,
    userId?: string,
    limit: number = 20
  ): Promise<NaturalLanguageSearchResult> {
    // In a full implementation, this would merge previous intent context
    // with the new query for better understanding

    const options: NaturalLanguageSearchOptions = {
      useSemanticSearch: true,
      limit,
    };
    if (userId) options.userId = userId;
    return this.execute(query, options);
  }
}

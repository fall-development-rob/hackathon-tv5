/**
 * Discovery Agent
 * Natural language understanding and intent parsing for media discovery
 * Uses Google Gemini for AI processing
 */

import type { AgentIntent, AgentContext, SearchFilters, ConversationTurn } from '@media-gateway/core';

// Intent patterns for classification
const INTENT_PATTERNS = {
  search: [
    /show\s+me/i,
    /find\s+(me\s+)?/i,
    /looking\s+for/i,
    /search\s+(for\s+)?/i,
    /movies?\s+(like|about|with)/i,
    /tv\s+shows?\s+(like|about|with)/i,
  ],
  recommendation: [
    /what\s+should\s+I\s+watch/i,
    /recommend/i,
    /suggest/i,
    /any\s+(good\s+)?ideas/i,
    /something\s+(to\s+watch|good)/i,
    /I('m|\s+am)\s+(bored|in\s+the\s+mood)/i,
  ],
  group_watch: [
    /movie\s+night/i,
    /watch\s+(with|together)/i,
    /group\s+(watch|movie)/i,
    /with\s+(my\s+)?(friends|family)/i,
    /we\s+(want|should)\s+(to\s+)?watch/i,
  ],
  availability: [
    /where\s+(can|to)\s+(I\s+)?watch/i,
    /is\s+.+\s+(on|available)/i,
    /which\s+(streaming|platform)/i,
    /available\s+on/i,
  ],
};

// Filter extraction patterns
const FILTER_PATTERNS = {
  mediaType: {
    movie: /\b(movie|film|movies|films)\b/i,
    tv: /\b(tv|show|series|shows)\b/i,
  },
  genres: {
    action: /\b(action)\b/i,
    comedy: /\b(comedy|comedies|funny)\b/i,
    drama: /\b(drama)\b/i,
    horror: /\b(horror|scary)\b/i,
    thriller: /\b(thriller|suspense)\b/i,
    scifi: /\b(sci-?fi|science\s+fiction|space)\b/i,
    romance: /\b(romance|romantic|love)\b/i,
    documentary: /\b(documentary|documentaries)\b/i,
    animation: /\b(animation|animated|cartoon|anime)\b/i,
    family: /\b(family|kids|children)\b/i,
  },
  year: {
    recent: /\b(recent|new|latest|2024|2023|2022)\b/i,
    classic: /\b(classic|old|vintage|retro)\b/i,
    decade: /\b(80s|90s|2000s|2010s|eighties|nineties)\b/i,
  },
  rating: {
    highlyRated: /\b(highly\s+rated|top\s+rated|best|acclaimed)\b/i,
  },
};

// Genre ID mapping (TMDB IDs)
const GENRE_IDS: Record<string, number> = {
  action: 28,
  comedy: 35,
  drama: 18,
  horror: 27,
  thriller: 53,
  scifi: 878,
  romance: 10749,
  documentary: 99,
  animation: 16,
  family: 10751,
};

/**
 * Discovery Agent class
 * Handles natural language understanding and task routing
 */
export class DiscoveryAgent {
  private context: AgentContext;

  constructor(sessionId: string, userId?: string) {
    this.context = {
      userId,
      sessionId,
      conversationHistory: [],
      accumulatedFilters: {},
    };
  }

  /**
   * Parse user intent from natural language query
   */
  parseIntent(query: string): AgentIntent {
    const normalizedQuery = query.toLowerCase().trim();

    // Check for availability intent first (most specific)
    for (const pattern of INTENT_PATTERNS.availability) {
      if (pattern.test(normalizedQuery)) {
        const contentMatch = normalizedQuery.match(/where\s+(?:can|to)\s+(?:I\s+)?watch\s+(.+)/i);
        return {
          type: 'availability_check' as const,
          contentId: 0, // Would need to resolve from query
          mediaType: 'movie',
        };
      }
    }

    // Check for group watch intent
    for (const pattern of INTENT_PATTERNS.group_watch) {
      if (pattern.test(normalizedQuery)) {
        return {
          type: 'group_watch' as const,
          groupId: 'default', // Would be resolved from context
        };
      }
    }

    // Check for recommendation intent
    for (const pattern of INTENT_PATTERNS.recommendation) {
      if (pattern.test(normalizedQuery)) {
        return {
          type: 'recommendation' as const,
          context: this.extractContext(normalizedQuery),
        };
      }
    }

    // Check for explicit search intent
    for (const pattern of INTENT_PATTERNS.search) {
      if (pattern.test(normalizedQuery)) {
        return {
          type: 'search' as const,
          query: this.cleanSearchQuery(normalizedQuery),
          filters: this.extractFilters(normalizedQuery),
        };
      }
    }

    // Default to search for any query
    return {
      type: 'search' as const,
      query: normalizedQuery,
      filters: this.extractFilters(normalizedQuery),
    };
  }

  /**
   * Extract search filters from natural language
   */
  extractFilters(query: string): SearchFilters {
    const filters: SearchFilters = {};

    // Extract media type
    if (FILTER_PATTERNS.mediaType.movie.test(query)) {
      filters.mediaType = 'movie';
    } else if (FILTER_PATTERNS.mediaType.tv.test(query)) {
      filters.mediaType = 'tv';
    }

    // Extract genres
    const genres: number[] = [];
    for (const [genre, pattern] of Object.entries(FILTER_PATTERNS.genres)) {
      if (pattern.test(query) && GENRE_IDS[genre]) {
        genres.push(GENRE_IDS[genre]!);
      }
    }
    if (genres.length > 0) {
      filters.genres = genres;
    }

    // Extract year range
    if (FILTER_PATTERNS.year.recent.test(query)) {
      filters.yearMin = new Date().getFullYear() - 3;
    } else if (FILTER_PATTERNS.year.classic.test(query)) {
      filters.yearMax = 2000;
    }

    // Extract rating preference
    if (FILTER_PATTERNS.rating.highlyRated.test(query)) {
      filters.ratingMin = 7.5;
    }

    // Merge with accumulated filters from conversation
    return { ...this.context.accumulatedFilters, ...filters };
  }

  /**
   * Extract context for recommendations
   */
  private extractContext(query: string): { mood?: string; availableTime?: number } {
    const context: { mood?: string; availableTime?: number } = {};

    // Mood detection
    if (/bored/i.test(query)) context.mood = 'bored';
    if (/relaxed?|chill/i.test(query)) context.mood = 'relaxed';
    if (/excited|action/i.test(query)) context.mood = 'excited';
    if (/sad|emotional/i.test(query)) context.mood = 'emotional';
    if (/happy|fun/i.test(query)) context.mood = 'happy';

    // Time extraction
    const timeMatch = query.match(/(\d+)\s*(hour|hr|minute|min)/i);
    if (timeMatch) {
      const value = parseInt(timeMatch[1]!);
      const unit = timeMatch[2]!.toLowerCase();
      context.availableTime = unit.startsWith('hour') || unit.startsWith('hr')
        ? value * 60
        : value;
    }

    return context;
  }

  /**
   * Clean search query by removing command words
   */
  private cleanSearchQuery(query: string): string {
    return query
      .replace(/show\s+me\s*/i, '')
      .replace(/find\s+(me\s+)?/i, '')
      .replace(/looking\s+for\s*/i, '')
      .replace(/search\s+(for\s+)?/i, '')
      .replace(/I\s+want\s+(to\s+)?(watch|see)\s*/i, '')
      .trim();
  }

  /**
   * Add conversation turn and accumulate context
   */
  addTurn(role: 'user' | 'assistant', content: string): void {
    const turn: ConversationTurn = {
      role,
      content,
      timestamp: new Date(),
    };

    if (role === 'user') {
      turn.intent = this.parseIntent(content);

      // Accumulate filters from search intents
      if (turn.intent.type === 'search' && turn.intent.filters) {
        this.context.accumulatedFilters = {
          ...this.context.accumulatedFilters,
          ...turn.intent.filters,
        };
      }
    }

    this.context.conversationHistory.push(turn);
  }

  /**
   * Get current conversation context
   */
  getContext(): AgentContext {
    return this.context;
  }

  /**
   * Clear conversation context
   */
  clearContext(): void {
    this.context.conversationHistory = [];
    this.context.accumulatedFilters = {};
  }

  /**
   * Generate conversation summary for context passing
   */
  getSummary(): string {
    const recentTurns = this.context.conversationHistory.slice(-5);
    return recentTurns
      .map(t => `${t.role}: ${t.content}`)
      .join('\n');
  }
}

/**
 * Create a new Discovery Agent instance
 */
export function createDiscoveryAgent(sessionId: string, userId?: string): DiscoveryAgent {
  return new DiscoveryAgent(sessionId, userId);
}

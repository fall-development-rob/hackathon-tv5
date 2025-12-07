/**
 * Discovery Agent
 * Natural language understanding and intent parsing for media discovery
 * Uses Google Gemini 2.0 Flash for AI-powered intent parsing
 */

import type { AgentIntent, AgentContext, SearchFilters, ConversationTurn } from '@media-gateway/core';

/**
 * Gemini API response structure for intent parsing
 */
interface GeminiIntentResponse {
  type: 'search' | 'recommendation' | 'group_watch' | 'availability_check' | 'unknown';
  query?: string;
  filters?: {
    genres?: number[];
    yearMin?: number;
    yearMax?: number;
    ratingMin?: number;
    mediaType?: 'movie' | 'tv' | 'all';
  };
  contentId?: number;
  mediaType?: 'movie' | 'tv';
  groupId?: string;
}

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
  private geminiApiKey: string | null;

  constructor(sessionId: string, userId?: string) {
    this.context = {
      userId,
      sessionId,
      conversationHistory: [],
      accumulatedFilters: {},
    };
    this.geminiApiKey = process.env.GOOGLE_GEMINI_API_KEY ?? null;
  }

  /**
   * Parse user intent from natural language query using AI (Gemini)
   * Falls back to regex-based parsing if Gemini is unavailable
   */
  async parseIntentWithAI(query: string): Promise<AgentIntent> {
    // If no API key, fall back to regex-based parsing
    if (!this.geminiApiKey) {
      console.warn('Google Gemini API key not found, using regex-based intent parsing');
      return this.parseIntent(query);
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are an intent parser for a media discovery app. Parse the user query and return JSON.

User query: "${query}"

Return ONLY valid JSON in this format:
{
  "type": "search" | "recommendation" | "group_watch" | "availability_check",
  "query": "cleaned search query if type is search",
  "filters": {
    "genres": [genre_ids],
    "yearMin": number,
    "yearMax": number,
    "ratingMin": number,
    "mediaType": "movie" | "tv" | "all"
  }
}

Genre IDs: 28=Action, 12=Adventure, 16=Animation, 35=Comedy, 80=Crime, 99=Documentary, 18=Drama, 10751=Family, 14=Fantasy, 36=History, 27=Horror, 10402=Music, 9648=Mystery, 10749=Romance, 878=SciFi, 53=Thriller, 10752=War, 37=Western

Examples:
- "action movies from the 90s" -> {"type":"search","query":"action movies","filters":{"genres":[28],"yearMin":1990,"yearMax":1999}}
- "recommend something for me" -> {"type":"recommendation"}
- "where can I watch Inception" -> {"type":"availability_check","query":"Inception"}
- "what should I watch with my friends" -> {"type":"group_watch"}

Parse the query and return ONLY the JSON object, no additional text.`
              }]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 500
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      // Extract JSON from response (handle cases where LLM adds extra text)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed: GeminiIntentResponse = JSON.parse(jsonMatch[0]);
        return this.convertGeminiResponse(parsed, query);
      } else {
        throw new Error('No JSON found in Gemini response');
      }
    } catch (error) {
      console.warn('Gemini parsing failed, falling back to regex:', error);
    }

    // Fallback to regex-based parsing
    return this.parseIntent(query);
  }

  /**
   * Convert Gemini response to AgentIntent format
   */
  private convertGeminiResponse(response: GeminiIntentResponse, originalQuery: string): AgentIntent {
    switch (response.type) {
      case 'search':
        return {
          type: 'search',
          query: response.query ?? originalQuery,
          filters: response.filters ?? {}
        };
      case 'recommendation':
        return {
          type: 'recommendation',
          context: response.filters ?? this.extractContext(originalQuery)
        };
      case 'group_watch':
        return {
          type: 'group_watch',
          groupId: response.groupId ?? 'default'
        };
      case 'availability_check':
        return {
          type: 'availability_check',
          contentId: response.contentId ?? 0,
          mediaType: response.mediaType ?? 'movie'
        };
      default:
        return {
          type: 'search',
          query: originalQuery,
          filters: {}
        };
    }
  }

  /**
   * Parse user intent from natural language query (regex-based fallback)
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
      // Use regex-based parsing for synchronous turn addition
      // For AI-powered parsing, use parseIntentWithAI() separately
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
   * Add conversation turn with AI-powered intent parsing
   */
  async addTurnWithAI(role: 'user' | 'assistant', content: string): Promise<void> {
    const turn: ConversationTurn = {
      role,
      content,
      timestamp: new Date(),
    };

    if (role === 'user') {
      // Use AI-powered intent parsing
      turn.intent = await this.parseIntentWithAI(content);

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

/**
 * IntentParser - Natural language query understanding for media search
 * Parses queries into structured intents with entity extraction and classification
 * Target: <10ms parsing latency
 */

export type IntentType =
  | 'GENRE_SEARCH'
  | 'ACTOR_SEARCH'
  | 'DIRECTOR_SEARCH'
  | 'MOOD_SEARCH'
  | 'SIMILAR_TO'
  | 'TRENDING'
  | 'PERSONALIZED'
  | 'TIME_BASED'
  | 'MIXED'
  | 'UNKNOWN';

export type EntityType =
  | 'genre'
  | 'actor'
  | 'director'
  | 'mood'
  | 'time_period'
  | 'quality'
  | 'media_title'
  | 'media_type';

export interface Entity {
  type: EntityType;
  value: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
}

export interface IntentMetadata {
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'high' | 'medium' | 'low';
  specificity: number;
}

export interface ParsedIntent {
  type: IntentType;
  entities: Entity[];
  confidence: number;
  originalQuery: string;
  normalizedQuery: string;
  metadata: IntentMetadata;
}

export interface Token {
  value: string;
  startIndex: number;
  endIndex: number;
  type: 'word' | 'punctuation' | 'whitespace';
}

interface Pattern {
  regex: RegExp;
  intentType: IntentType;
  weight: number;
}

interface EntityPattern {
  regex: RegExp;
  type: EntityType;
  extractGroup: number;
}

export interface IntentParser {
  parse(query: string): ParsedIntent;
  extractEntities(query: string, intentType: IntentType | undefined): Entity[];
  classifyIntent(query: string): { type: IntentType; confidence: number };
  tokenize(query: string): Token[];
  normalizeQuery(query: string): string;
  expandAbbreviations(query: string): string;
}

const ABBREVIATIONS: Record<string, string> = {
  'rom com': 'romantic comedy',
  'romcom': 'romantic comedy',
  'sci fi': 'science fiction',
  'scifi': 'science fiction',
  'docs': 'documentaries',
  'doc': 'documentary',
  'mov': 'movie',
  'flick': 'movie',
  'flicks': 'movies',
  'pic': 'picture',
  'pics': 'pictures',
};

const GENRES = [
  'action',
  'adventure',
  'animation',
  'anime',
  'comedy',
  'crime',
  'documentary',
  'drama',
  'fantasy',
  'horror',
  'mystery',
  'romance',
  'romantic comedy',
  'science fiction',
  'thriller',
  'western',
  'musical',
  'biographical',
  'historical',
  'war',
];

const MOODS = [
  'happy',
  'sad',
  'exciting',
  'relaxing',
  'scary',
  'romantic',
  'thought-provoking',
  'uplifting',
  'dark',
  'light',
  'funny',
  'intense',
  'emotional',
  'inspirational',
  'suspenseful',
  'heartwarming',
];

const TIME_PERIODS = [
  'classic',
  'recent',
  'new',
  'old',
  'latest',
  'current',
  'vintage',
  'modern',
  '80s',
  '90s',
  '2000s',
  '2010s',
  '2020s',
  'eighties',
  'nineties',
];

const QUALITY_INDICATORS = [
  'best',
  'top',
  'highest-rated',
  'award-winning',
  'critically acclaimed',
  'popular',
  'famous',
  'acclaimed',
  'masterpiece',
  'classic',
  'great',
];

const MEDIA_TYPES = ['movie', 'movies', 'film', 'films', 'show', 'shows', 'series', 'tv'];

class IntentParserImpl implements IntentParser {
  private readonly intentPatterns: Pattern[];
  private readonly entityPatterns: EntityPattern[];

  constructor() {
    this.intentPatterns = this.initializeIntentPatterns();
    this.entityPatterns = this.initializeEntityPatterns();
  }

  private initializeIntentPatterns(): Pattern[] {
    return [
      {
        regex: /\b(like|similar\s+to|reminds?\s+me\s+of|compared\s+to)\s+([a-z0-9\s]+)/i,
        intentType: 'SIMILAR_TO',
        weight: 0.95,
      },
      {
        regex:
          /\b(starring|with|featuring|acted\s+by|performance\s+by)\s+([a-z\s]+)|([a-z\s]+)\s+(movies?|films?)/i,
        intentType: 'ACTOR_SEARCH',
        weight: 0.9,
      },
      {
        regex: /\b(directed\s+by|director|filmmaker)\s+([a-z\s]+)|([a-z\s]+)\s+films?/i,
        intentType: 'DIRECTOR_SEARCH',
        weight: 0.9,
      },
      {
        regex: /\b(trending|popular|hot|viral|buzzing|what'?s\s+new|new\s+releases?)/i,
        intentType: 'TRENDING',
        weight: 0.85,
      },
      {
        regex: /\b(for\s+me|my\s+recommendations?|personalized|based\s+on\s+my)/i,
        intentType: 'PERSONALIZED',
        weight: 0.85,
      },
      {
        regex:
          /\b(something|movie|film|show)\s+(uplifting|scary|romantic|funny|sad|exciting|relaxing|intense)/i,
        intentType: 'MOOD_SEARCH',
        weight: 0.8,
      },
      {
        regex:
          /\b(80s|90s|2000s|2010s|2020s|eighties|nineties|classic|recent|new|old|vintage|modern)\s+(movies?|films?|shows?)/i,
        intentType: 'TIME_BASED',
        weight: 0.8,
      },
      {
        regex: /\b(action|comedy|drama|horror|thriller|romance|sci\s*fi|documentary)\s+(movies?|films?|shows?)/i,
        intentType: 'GENRE_SEARCH',
        weight: 0.75,
      },
      {
        regex: /\b(want\s+to\s+watch|looking\s+for|find\s+me|show\s+me)\s+([a-z\s]+)/i,
        intentType: 'GENRE_SEARCH',
        weight: 0.5,
      },
    ];
  }

  private initializeEntityPatterns(): EntityPattern[] {
    return [
      {
        regex: new RegExp(`\\b(${GENRES.join('|')})\\b`, 'gi'),
        type: 'genre',
        extractGroup: 0,
      },
      {
        regex: new RegExp(`\\b(${MOODS.join('|')})\\b`, 'gi'),
        type: 'mood',
        extractGroup: 0,
      },
      {
        regex: new RegExp(`\\b(${TIME_PERIODS.join('|')})\\b`, 'gi'),
        type: 'time_period',
        extractGroup: 0,
      },
      {
        regex: new RegExp(`\\b(${QUALITY_INDICATORS.join('|')})\\b`, 'gi'),
        type: 'quality',
        extractGroup: 0,
      },
      {
        regex: new RegExp(`\\b(${MEDIA_TYPES.join('|')})\\b`, 'gi'),
        type: 'media_type',
        extractGroup: 0,
      },
      {
        regex: /\b(starring|with|featuring|acted\s+by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
        type: 'actor',
        extractGroup: 2,
      },
      {
        regex: /\b(directed\s+by|director)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
        type: 'director',
        extractGroup: 2,
      },
      {
        regex: /\b(like|similar\s+to)\s+([A-Z][A-Za-z0-9\s:]+?)(?:\s|$|,|\.|!|\?)/g,
        type: 'media_title',
        extractGroup: 2,
      },
    ];
  }

  public parse(query: string): ParsedIntent {
    const startTime = performance.now();

    const expanded = this.expandAbbreviations(query);
    const normalized = this.normalizeQuery(expanded);
    const classification = this.classifyIntent(normalized);
    const entities = this.extractEntities(normalized, classification.type);
    const metadata = this.analyzeMetadata(normalized, entities);

    const elapsedTime = performance.now() - startTime;
    if (elapsedTime > 10) {
      console.warn(`IntentParser exceeded 10ms target: ${elapsedTime.toFixed(2)}ms`);
    }

    return {
      type: classification.type,
      entities,
      confidence: classification.confidence,
      originalQuery: query,
      normalizedQuery: normalized,
      metadata,
    };
  }

  public extractEntities(query: string, intentType: IntentType | undefined): Entity[] {
    const entities: Entity[] = [];
    const seenValues = new Set<string>();

    for (const pattern of this.entityPatterns) {
      let match: RegExpExecArray | null;

      while ((match = pattern.regex.exec(query)) !== null) {
        const extractedValue =
          pattern.extractGroup > 0 && match[pattern.extractGroup]
            ? match[pattern.extractGroup]
            : match[0];

        if (!extractedValue) {
          continue;
        }

        const normalizedValue = extractedValue.trim().toLowerCase();

        if (seenValues.has(`${pattern.type}:${normalizedValue}`)) {
          continue;
        }

        seenValues.add(`${pattern.type}:${normalizedValue}`);

        const confidence = this.calculateEntityConfidence(pattern.type, intentType, normalizedValue);

        entities.push({
          type: pattern.type,
          value: extractedValue.trim(),
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          confidence,
        });
      }
    }

    return entities.sort((a, b) => b.confidence - a.confidence);
  }

  private calculateEntityConfidence(
    entityType: EntityType,
    intentType: IntentType | undefined,
    value: string
  ): number {
    let confidence = 0.7;

    if (!intentType) {
      return confidence;
    }

    const typeMatches: Record<IntentType, EntityType[]> = {
      GENRE_SEARCH: ['genre', 'media_type'],
      ACTOR_SEARCH: ['actor', 'media_type'],
      DIRECTOR_SEARCH: ['director', 'media_type'],
      MOOD_SEARCH: ['mood', 'media_type'],
      SIMILAR_TO: ['media_title'],
      TRENDING: ['media_type', 'time_period'],
      PERSONALIZED: ['genre', 'mood', 'media_type'],
      TIME_BASED: ['time_period', 'media_type', 'genre'],
      MIXED: ['genre', 'actor', 'director', 'mood', 'time_period', 'media_type'],
      UNKNOWN: [],
    };

    const matchingTypes = typeMatches[intentType] || [];
    if (matchingTypes.includes(entityType)) {
      confidence += 0.2;
    }

    if (value.length > 2) {
      confidence += 0.05;
    }

    if (/^[A-Z]/.test(value)) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
  }

  public classifyIntent(query: string): { type: IntentType; confidence: number } {
    const scores: Map<IntentType, number> = new Map();

    for (const pattern of this.intentPatterns) {
      if (pattern.regex.test(query)) {
        const currentScore = scores.get(pattern.intentType) || 0;
        scores.set(pattern.intentType, Math.max(currentScore, pattern.weight));
      }
    }

    if (scores.size === 0) {
      return { type: 'UNKNOWN', confidence: 0.5 };
    }

    if (scores.size > 2) {
      const totalScore = Array.from(scores.values()).reduce((sum, score) => sum + score, 0);
      return { type: 'MIXED', confidence: totalScore / scores.size };
    }

    let maxScore = 0;
    let maxType: IntentType = 'UNKNOWN';

    scores.forEach((score, type) => {
      if (score > maxScore) {
        maxScore = score;
        maxType = type;
      }
    });

    return { type: maxType, confidence: maxScore };
  }

  public tokenize(query: string): Token[] {
    const tokens: Token[] = [];
    let currentIndex = 0;

    const tokenRegex = /(\w+|[^\w\s]|\s+)/g;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(query)) !== null) {
      const value = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + value.length;

      let type: Token['type'];
      if (/\w+/.test(value)) {
        type = 'word';
      } else if (/\s+/.test(value)) {
        type = 'whitespace';
      } else {
        type = 'punctuation';
      }

      tokens.push({
        value,
        startIndex,
        endIndex,
        type,
      });

      currentIndex = endIndex;
    }

    return tokens;
  }

  public normalizeQuery(query: string): string {
    let normalized = query.toLowerCase().trim();

    normalized = normalized.replace(/[?!.,;:]+/g, ' ');

    normalized = normalized.replace(/\s+/g, ' ');

    normalized = normalized.replace(/\b(a|an|the)\b/g, '');

    normalized = normalized.trim();

    return normalized;
  }

  public expandAbbreviations(query: string): string {
    let expanded = query;

    for (const [abbrev, full] of Object.entries(ABBREVIATIONS)) {
      const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
      expanded = expanded.replace(regex, full);
    }

    return expanded;
  }

  private analyzeMetadata(query: string, entities: Entity[]): IntentMetadata {
    const sentiment = this.analyzeSentiment(query);
    const urgency = this.analyzeUrgency(query);
    const specificity = this.calculateSpecificity(query, entities);

    return {
      sentiment,
      urgency,
      specificity,
    };
  }

  private analyzeSentiment(query: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = /\b(love|amazing|great|best|awesome|wonderful|excellent|fantastic|enjoy)\b/i;
    const negativeWords = /\b(hate|terrible|worst|awful|boring|bad|disappointing)\b/i;

    if (positiveWords.test(query)) {
      return 'positive';
    }

    if (negativeWords.test(query)) {
      return 'negative';
    }

    return 'neutral';
  }

  private analyzeUrgency(query: string): 'high' | 'medium' | 'low' {
    const highUrgencyWords = /\b(now|tonight|immediately|urgent|asap|quick|right\s+now)\b/i;
    const mediumUrgencyWords = /\b(soon|today|this\s+week|later)\b/i;

    if (highUrgencyWords.test(query)) {
      return 'high';
    }

    if (mediumUrgencyWords.test(query)) {
      return 'medium';
    }

    return 'low';
  }

  private calculateSpecificity(query: string, entities: Entity[]): number {
    let specificity = 0;

    specificity += entities.length * 0.15;

    const tokens = this.tokenize(query);
    const wordTokens = tokens.filter((t) => t.type === 'word');
    specificity += Math.min(wordTokens.length * 0.05, 0.3);

    const hasProperNoun = entities.some(
      (e) => e.type === 'actor' || e.type === 'director' || e.type === 'media_title'
    );
    if (hasProperNoun) {
      specificity += 0.2;
    }

    const hasMultipleEntityTypes = new Set(entities.map((e) => e.type)).size > 1;
    if (hasMultipleEntityTypes) {
      specificity += 0.15;
    }

    return Math.min(specificity, 1.0);
  }
}

export function createIntentParser(): IntentParser {
  return new IntentParserImpl();
}

export default createIntentParser;

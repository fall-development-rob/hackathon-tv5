/**
 * Core Types for Media Gateway
 * Solving the 45-minute decision problem with 20-year data moat
 */

// ============================================================================
// Media Content Types
// ============================================================================

export type MediaType = 'movie' | 'tv';

export interface MediaContent {
  id: number;
  title: string;
  overview: string;
  mediaType: MediaType;
  genreIds: number[];
  voteAverage: number;
  voteCount: number;
  releaseDate: string;
  posterPath: string | null;
  backdropPath: string | null;
  popularity: number;
}

export interface MediaDetails extends MediaContent {
  runtime?: number;
  genres: Genre[];
  cast: CastMember[];
  director?: string;
  tagline?: string;
  budget?: number;
  revenue?: number;
  status: string;
  originalLanguage: string;
  spokenLanguages: Language[];
  productionCompanies: ProductionCompany[];
}

export interface Genre {
  id: number;
  name: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
  order: number;
}

export interface Language {
  iso_639_1: string;
  name: string;
  englishName: string;
}

export interface ProductionCompany {
  id: number;
  name: string;
  logoPath: string | null;
  originCountry: string;
}

// ============================================================================
// User & Preference Types (Data Moat Foundation)
// ============================================================================

export interface User {
  id: string;
  email?: string;
  displayName?: string;
  createdAt: Date;
  lastActiveAt: Date;
  preferences: UserPreferences;
  connectedPlatforms: ConnectedPlatform[];
}

export interface UserPreferences {
  /** 768-dimensional preference vector */
  vector: Float32Array | null;
  /** Confidence in the preference vector (0-1) */
  confidence: number;
  /** Genre affinity scores */
  genreAffinities: Record<number, number>;
  /** Mood-to-content mappings */
  moodMappings: MoodMapping[];
  /** Temporal viewing patterns */
  temporalPatterns: TemporalPattern[];
  /** Last updated timestamp */
  updatedAt: Date;
}

export interface MoodMapping {
  mood: string;
  contentVector: Float32Array;
  strength: number;
}

export interface TemporalPattern {
  dayOfWeek: number; // 0-6
  hourOfDay: number; // 0-23
  preferredGenres: number[];
  avgWatchDuration: number;
}

export interface ConnectedPlatform {
  platformId: string;
  platformName: string;
  userId: string;
  connectedAt: Date;
  lastSyncAt: Date;
  subscriptionStatus: 'active' | 'expired' | 'unknown';
}

// ============================================================================
// Watch Event Types (Learning Signals)
// ============================================================================

export interface WatchEvent {
  userId: string;
  contentId: number;
  mediaType: MediaType;
  platformId: string;
  /** Watch duration in seconds */
  duration: number;
  /** Total content duration in seconds */
  totalDuration: number;
  /** Completion rate (0-1) */
  completionRate: number;
  /** User's explicit rating if provided */
  rating?: number;
  /** Whether this is a rewatch */
  isRewatch: boolean;
  /** Context of the watch */
  context: WatchContext;
  timestamp: Date;
}

export interface WatchContext {
  dayOfWeek: number;
  hourOfDay: number;
  device?: string;
  isGroupWatch: boolean;
  groupId?: string;
}

// ============================================================================
// Search & Recommendation Types
// ============================================================================

export interface SearchQuery {
  /** Natural language query */
  query: string;
  /** Optional user ID for personalization */
  userId?: string;
  /** Number of results to return */
  limit: number;
  /** Optional filters */
  filters?: SearchFilters;
}

export interface SearchFilters {
  mediaType?: MediaType;
  genres?: number[];
  yearMin?: number;
  yearMax?: number;
  ratingMin?: number;
  platforms?: string[];
}

export interface SearchResult {
  content: MediaContent;
  /** Relevance score (0-1) */
  score: number;
  /** Why this result was returned */
  explanation?: string;
  /** Platform availability */
  availability: PlatformAvailability[];
}

export interface PlatformAvailability {
  platformId: string;
  platformName: string;
  available: boolean;
  type: 'subscription' | 'rent' | 'buy' | 'free';
  price?: number;
  deepLink?: string;
}

export interface RecommendationRequest {
  userId: string;
  context?: RecommendationContext;
  limit: number;
  excludeWatched?: boolean;
}

export interface RecommendationContext {
  mood?: string;
  availableTime?: number; // minutes
  groupMembers?: string[];
  occasion?: string;
}

export interface Recommendation extends SearchResult {
  /** Personalization score (0-1) */
  personalizationScore: number;
  /** Recommendation reason */
  reason: string;
}

// ============================================================================
// Group & Social Types (Network Effects Moat)
// ============================================================================

export interface Group {
  id: string;
  name: string;
  creatorId: string;
  memberIds: string[];
  createdAt: Date;
  lastActiveAt: Date;
}

export interface GroupSession {
  id: string;
  groupId: string;
  status: 'voting' | 'decided' | 'watching' | 'completed';
  initiatorId: string;
  context: RecommendationContext;
  candidates: GroupCandidate[];
  selectedContentId?: number;
  createdAt: Date;
  decidedAt?: Date;
}

export interface GroupCandidate {
  content: MediaContent;
  /** Aggregated group score */
  groupScore: number;
  /** Per-member satisfaction scores */
  memberScores: Record<string, number>;
  /** Fairness metric */
  fairnessScore: number;
  votes: Record<string, number>;
}

// ============================================================================
// Content Matching Types (Cross-Platform Moat)
// ============================================================================

export interface ContentFingerprint {
  normalizedTitle: string;
  releaseYear: number;
  runtime?: number;
  topCast: string[];
  director?: string;
  hash: string;
}

export interface CrossPlatformMatch {
  contentFingerprint: ContentFingerprint;
  matches: Record<string, PlatformContentMatch>;
}

export interface PlatformContentMatch {
  platformId: string;
  contentId: string;
  confidence: number;
  deepLink: string;
  lastVerified: Date;
}

// ============================================================================
// Agent Types
// ============================================================================

export type AgentIntent =
  | { type: 'search'; query: string; filters?: SearchFilters }
  | { type: 'recommendation'; context?: RecommendationContext }
  | { type: 'group_watch'; groupId: string }
  | { type: 'availability_check'; contentId: number; mediaType: MediaType }
  | { type: 'explain'; contentId: number }
  | { type: 'unknown'; rawQuery: string };

export interface AgentContext {
  userId?: string;
  sessionId: string;
  conversationHistory: ConversationTurn[];
  accumulatedFilters: SearchFilters;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: AgentIntent;
}

// ============================================================================
// Data Moat Metrics
// ============================================================================

export interface MoatMetrics {
  /** Total preference vectors stored */
  preferenceVectorCount: number;
  /** Average preference vector depth (signals per user) */
  avgPreferenceDepth: number;
  /** Cross-platform content matches */
  crossPlatformMatchCount: number;
  /** Social graph connections */
  socialConnectionCount: number;
  /** Skill library size */
  skillCount: number;
  /** Average recommendation accuracy */
  avgRecommendationAccuracy: number;
  /** User retention rate */
  retentionRate: number;
  /** Calculated moat strength (0-100) */
  moatStrength: number;
  /** Timestamp */
  calculatedAt: Date;
}

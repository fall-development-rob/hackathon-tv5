/**
 * @media-gateway/core - Zod Schema Validation
 *
 * Comprehensive runtime type validation using Zod with advanced patterns:
 * - Schema composition for complex types
 * - Discriminated unions for command/intent types
 * - Runtime validation with TypeScript type inference
 * - Transform functions for data normalization
 * - Bounded arrays and constrained values
 */

import { z } from 'zod';

// ============================================================================
// Base Types & Enums
// ============================================================================

/**
 * Media content types supported by the platform
 */
export const MediaTypeSchema = z.enum(['movie', 'tv', 'documentary', 'anime', 'short']);
export type MediaType = z.infer<typeof MediaTypeSchema>;

/**
 * Content rating systems
 */
export const ContentRatingSchema = z.enum([
  'G', 'PG', 'PG-13', 'R', 'NC-17', // MPAA
  'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA', // TV Parental Guidelines
  'U', '12A', '15', '18', // BBFC
  'NR' // Not Rated
]);
export type ContentRating = z.infer<typeof ContentRatingSchema>;

/**
 * Streaming platforms
 */
export const StreamingPlatformSchema = z.enum([
  'netflix',
  'amazon-prime',
  'disney-plus',
  'hbo-max',
  'hulu',
  'apple-tv-plus',
  'paramount-plus',
  'peacock',
  'crunchyroll',
  'youtube-premium',
  'other'
]);
export type StreamingPlatform = z.infer<typeof StreamingPlatformSchema>;

/**
 * Genre categories
 */
export const GenreSchema = z.enum([
  'action',
  'adventure',
  'animation',
  'comedy',
  'crime',
  'documentary',
  'drama',
  'fantasy',
  'historical',
  'horror',
  'musical',
  'mystery',
  'romance',
  'sci-fi',
  'thriller',
  'war',
  'western'
]);
export type Genre = z.infer<typeof GenreSchema>;

/**
 * Mood/tone categories for content
 */
export const MoodSchema = z.enum([
  'uplifting',
  'dark',
  'intense',
  'light-hearted',
  'thought-provoking',
  'suspenseful',
  'emotional',
  'funny',
  'inspiring',
  'relaxing'
]);
export type Mood = z.infer<typeof MoodSchema>;

// ============================================================================
// Media Content Schema
// ============================================================================

/**
 * Core media content representation with validation
 */
export const MediaContentSchema = z.object({
  id: z.string().uuid('Invalid media ID format'),
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  type: MediaTypeSchema,

  // Metadata
  description: z.string().max(5000, 'Description too long').optional(),
  releaseYear: z.number()
    .int('Release year must be an integer')
    .min(1888, 'Must be after first film')
    .max(new Date().getFullYear() + 5, 'Release year too far in future'),
  runtime: z.number()
    .int('Runtime must be in minutes')
    .min(1, 'Runtime must be positive')
    .max(1440, 'Runtime exceeds 24 hours')
    .optional(),

  // Classifications
  genres: z.array(GenreSchema)
    .min(1, 'At least one genre required')
    .max(5, 'Maximum 5 genres allowed'),
  rating: ContentRatingSchema.optional(),
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid language code (use ISO 639-1)').default('en'),

  // Quality metrics
  imdbRating: z.number()
    .min(0, 'Rating cannot be negative')
    .max(10, 'Rating cannot exceed 10')
    .optional(),
  rottenTomatoesScore: z.number()
    .int('Score must be integer')
    .min(0, 'Score cannot be negative')
    .max(100, 'Score cannot exceed 100')
    .optional(),
  metacriticScore: z.number()
    .int('Score must be integer')
    .min(0, 'Score cannot be negative')
    .max(100, 'Score cannot exceed 100')
    .optional(),

  // Discovery
  mood: z.array(MoodSchema).max(3, 'Maximum 3 moods').optional(),
  tags: z.array(z.string().min(1).max(50))
    .max(20, 'Maximum 20 tags allowed')
    .optional(),

  // TV-specific fields
  seasons: z.number().int().min(1).optional(),
  episodes: z.number().int().min(1).optional(),

  // Timestamps
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
}).refine(
  (data) => {
    // TV shows must have seasons and episodes
    if (data.type === 'tv') {
      return data.seasons !== undefined && data.episodes !== undefined;
    }
    return true;
  },
  { message: 'TV shows must specify seasons and episodes' }
);

export type MediaContent = z.infer<typeof MediaContentSchema>;

// ============================================================================
// Search & Filter Schemas
// ============================================================================

/**
 * Sort order options
 */
export const SortOrderSchema = z.enum(['asc', 'desc']);
export type SortOrder = z.infer<typeof SortOrderSchema>;

/**
 * Sort field options
 */
export const SortBySchema = z.enum([
  'relevance',
  'rating',
  'release-year',
  'title',
  'popularity',
  'runtime'
]);
export type SortBy = z.infer<typeof SortBySchema>;

/**
 * Search filters with validation and defaults
 */
export const SearchFiltersSchema = z.object({
  // Query
  query: z.string().max(500, 'Query too long').optional(),

  // Type filters
  types: z.array(MediaTypeSchema).max(5, 'Maximum 5 types').optional(),
  genres: z.array(GenreSchema).max(10, 'Maximum 10 genres').optional(),
  moods: z.array(MoodSchema).max(5, 'Maximum 5 moods').optional(),

  // Platform filters
  platforms: z.array(StreamingPlatformSchema).max(10, 'Maximum 10 platforms').optional(),

  // Numeric filters
  minRating: z.number().min(0).max(10).optional(),
  maxRating: z.number().min(0).max(10).optional(),
  minYear: z.number().int().min(1888).optional(),
  maxYear: z.number().int().max(new Date().getFullYear() + 5).optional(),
  minRuntime: z.number().int().min(1).optional(),
  maxRuntime: z.number().int().min(1).optional(),

  // Content rating
  ratings: z.array(ContentRatingSchema).max(10, 'Maximum 10 ratings').optional(),

  // Language
  languages: z.array(z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/))
    .max(10, 'Maximum 10 languages')
    .optional(),

  // Pagination
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100, 'Maximum 100 results per page').default(20),

  // Sorting
  sortBy: SortBySchema.default('relevance'),
  sortOrder: SortOrderSchema.default('desc')
}).refine(
  (data) => {
    // Ensure min/max ranges are valid
    if (data.minRating !== undefined && data.maxRating !== undefined) {
      return data.minRating <= data.maxRating;
    }
    return true;
  },
  { message: 'minRating must be less than or equal to maxRating' }
).refine(
  (data) => {
    if (data.minYear !== undefined && data.maxYear !== undefined) {
      return data.minYear <= data.maxYear;
    }
    return true;
  },
  { message: 'minYear must be less than or equal to maxYear' }
).refine(
  (data) => {
    if (data.minRuntime !== undefined && data.maxRuntime !== undefined) {
      return data.minRuntime <= data.maxRuntime;
    }
    return true;
  },
  { message: 'minRuntime must be less than or equal to maxRuntime' }
);

export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

// ============================================================================
// Agent Intent Schema (Discriminated Union)
// ============================================================================

/**
 * Base intent schema with common fields
 */
const BaseIntentSchema = z.object({
  confidence: z.number().min(0).max(1),
  timestamp: z.date().default(() => new Date())
});

/**
 * Search intent - user wants to find content
 */
export const SearchIntentSchema = BaseIntentSchema.extend({
  type: z.literal('search'),
  query: z.string().min(1).max(500),
  filters: SearchFiltersSchema.optional()
});

/**
 * Recommendation intent - user wants personalized suggestions
 */
export const RecommendationIntentSchema = BaseIntentSchema.extend({
  type: z.literal('recommendation'),
  basedOn: z.array(z.string().uuid()).min(1, 'At least one reference required').max(10),
  reason: z.string().max(500).optional()
});

/**
 * Group session intent - create/join group watch
 */
export const GroupSessionIntentSchema = BaseIntentSchema.extend({
  type: z.literal('group-session'),
  action: z.enum(['create', 'join', 'leave', 'vote']),
  sessionId: z.string().uuid().optional()
});

/**
 * Platform check intent - verify availability
 */
export const PlatformCheckIntentSchema = BaseIntentSchema.extend({
  type: z.literal('platform-check'),
  mediaId: z.string().uuid(),
  preferredPlatforms: z.array(StreamingPlatformSchema).max(10).optional()
});

/**
 * Preference update intent - modify user preferences
 */
export const PreferenceUpdateIntentSchema = BaseIntentSchema.extend({
  type: z.literal('preference-update'),
  preferences: z.record(z.string(), z.number().min(0).max(1))
});

/**
 * Discriminated union of all intent types
 */
export const AgentIntentSchema = z.discriminatedUnion('type', [
  SearchIntentSchema,
  RecommendationIntentSchema,
  GroupSessionIntentSchema,
  PlatformCheckIntentSchema,
  PreferenceUpdateIntentSchema
]);

export type AgentIntent = z.infer<typeof AgentIntentSchema>;
export type SearchIntent = z.infer<typeof SearchIntentSchema>;
export type RecommendationIntent = z.infer<typeof RecommendationIntentSchema>;
export type GroupSessionIntent = z.infer<typeof GroupSessionIntentSchema>;
export type PlatformCheckIntent = z.infer<typeof PlatformCheckIntentSchema>;
export type PreferenceUpdateIntent = z.infer<typeof PreferenceUpdateIntentSchema>;

// ============================================================================
// User Preferences Schema
// ============================================================================

/**
 * Preference vector for personalization
 */
export const PreferenceVectorSchema = z.object({
  genres: z.record(GenreSchema, z.number().min(0).max(1))
    .transform(obj => {
      // Normalize to ensure sum doesn't exceed reasonable bounds
      const values = Object.values(obj);
      const sum = values.reduce((a, b) => a + b, 0);
      if (sum > 0) {
        const normalized: Record<string, number> = {};
        for (const [key, val] of Object.entries(obj)) {
          normalized[key] = val / sum;
        }
        return normalized as Record<Genre, number>;
      }
      return obj as Record<Genre, number>;
    }),

  moods: z.record(MoodSchema, z.number().min(0).max(1))
    .transform(obj => {
      const values = Object.values(obj);
      const sum = values.reduce((a, b) => a + b, 0);
      if (sum > 0) {
        const normalized: Record<string, number> = {};
        for (const [key, val] of Object.entries(obj)) {
          normalized[key] = val / sum;
        }
        return normalized as Record<Mood, number>;
      }
      return obj as Record<Mood, number>;
    }),

  platforms: z.record(StreamingPlatformSchema, z.number().min(0).max(1)).optional(),

  // Numeric preferences
  preferredRuntimeMin: z.number().int().min(1).max(1440).optional(),
  preferredRuntimeMax: z.number().int().min(1).max(1440).optional(),
  minAcceptableRating: z.number().min(0).max(10).default(5)
});

/**
 * Complete user preferences
 */
export const UserPreferencesSchema = z.object({
  userId: z.string().uuid(),
  vector: PreferenceVectorSchema,

  // Explicit preferences
  favoriteGenres: z.array(GenreSchema).max(10).default([]),
  dislikedGenres: z.array(GenreSchema).max(10).default([]),

  // Platform subscriptions
  subscribedPlatforms: z.array(StreamingPlatformSchema).max(15).default([]),

  // Watch history
  watchedContent: z.array(z.string().uuid()).max(1000).default([]),
  likedContent: z.array(z.string().uuid()).max(500).default([]),
  dislikedContent: z.array(z.string().uuid()).max(500).default([]),

  // Metadata
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
}).refine(
  (data) => {
    if (data.vector.preferredRuntimeMin !== undefined &&
        data.vector.preferredRuntimeMax !== undefined) {
      return data.vector.preferredRuntimeMin <= data.vector.preferredRuntimeMax;
    }
    return true;
  },
  { message: 'preferredRuntimeMin must be less than or equal to preferredRuntimeMax' }
);

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type PreferenceVector = z.infer<typeof PreferenceVectorSchema>;

// ============================================================================
// Group Session Schema
// ============================================================================

/**
 * Session status
 */
export const SessionStatusSchema = z.enum([
  'waiting',
  'voting',
  'decided',
  'watching',
  'completed',
  'cancelled'
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

/**
 * Vote on content
 */
export const VoteSchema = z.object({
  userId: z.string().uuid(),
  mediaId: z.string().uuid(),
  score: z.number().int().min(1, 'Score must be at least 1').max(10, 'Score cannot exceed 10'),
  timestamp: z.date().default(() => new Date())
});
export type Vote = z.infer<typeof VoteSchema>;

/**
 * Group watch session
 */
export const GroupSessionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  hostId: z.string().uuid(),

  // Participants
  participants: z.array(z.string().uuid())
    .min(2, 'At least 2 participants required')
    .max(50, 'Maximum 50 participants allowed'),

  // Status and timing
  status: SessionStatusSchema.default('waiting'),
  createdAt: z.date().default(() => new Date()),
  votingDeadline: z.date().optional(),

  // Voting
  votes: z.array(VoteSchema).max(500).default([]),
  candidateContent: z.array(z.string().uuid())
    .min(1, 'At least one candidate required')
    .max(20, 'Maximum 20 candidates allowed'),

  // Decision
  selectedContent: z.string().uuid().optional(),

  // Constraints
  constraints: SearchFiltersSchema.optional(),

  // Metadata
  completedAt: z.date().optional()
}).refine(
  (data) => {
    // If status is decided or later, must have selectedContent
    if (['decided', 'watching', 'completed'].includes(data.status)) {
      return data.selectedContent !== undefined;
    }
    return true;
  },
  { message: 'Decided sessions must have selectedContent' }
).refine(
  (data) => {
    // If completed, must have completedAt
    if (data.status === 'completed') {
      return data.completedAt !== undefined;
    }
    return true;
  },
  { message: 'Completed sessions must have completedAt timestamp' }
).refine(
  (data) => {
    // Host must be a participant
    return data.participants.includes(data.hostId);
  },
  { message: 'Host must be a participant in the session' }
);

export type GroupSession = z.infer<typeof GroupSessionSchema>;
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

// ============================================================================
// Platform Availability Schema
// ============================================================================

/**
 * Streaming quality options
 */
export const StreamingQualitySchema = z.enum(['SD', 'HD', '4K', '8K']);
export type StreamingQuality = z.infer<typeof StreamingQualitySchema>;

/**
 * Availability type
 */
export const AvailabilityTypeSchema = z.enum([
  'subscription',
  'rental',
  'purchase',
  'free-with-ads'
]);
export type AvailabilityType = z.infer<typeof AvailabilityTypeSchema>;

/**
 * Platform availability details
 */
export const PlatformAvailabilitySchema = z.object({
  mediaId: z.string().uuid(),
  platform: StreamingPlatformSchema,

  // Availability
  available: z.boolean(),
  availabilityType: AvailabilityTypeSchema.optional(),

  // Quality and features
  maxQuality: StreamingQualitySchema.optional(),
  hasSubtitles: z.boolean().default(false),
  hasDubbing: z.boolean().default(false),
  languages: z.array(z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/))
    .max(50)
    .default([]),

  // Pricing (in USD cents)
  rentalPrice: z.number().int().min(0).optional(),
  purchasePrice: z.number().int().min(0).optional(),

  // Temporal
  availableUntil: z.date().optional(),
  addedAt: z.date().default(() => new Date()),

  // Regional
  region: z.string().regex(/^[A-Z]{2}$/, 'Use ISO 3166-1 alpha-2 country code').default('US'),

  // Metadata
  link: z.string().url('Invalid URL').optional(),
  lastChecked: z.date().default(() => new Date())
}).refine(
  (data) => {
    // If not available, no pricing or quality info
    if (!data.available) {
      return data.availabilityType === undefined &&
             data.maxQuality === undefined &&
             data.rentalPrice === undefined &&
             data.purchasePrice === undefined;
    }
    return true;
  },
  { message: 'Unavailable content cannot have pricing or quality information' }
);

export type PlatformAvailability = z.infer<typeof PlatformAvailabilitySchema>;

// ============================================================================
// API Response Schemas (Result Pattern)
// ============================================================================

/**
 * Success response
 */
export const SuccessResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    timestamp: z.date().default(() => new Date())
  });

/**
 * Error response
 */
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string().regex(/^[A-Z_]+$/, 'Error code must be uppercase with underscores'),
    message: z.string().min(1).max(1000),
    details: z.unknown().optional(),
    stack: z.string().optional()
  }),
  timestamp: z.date().default(() => new Date())
});

/**
 * Result type combining success and error
 */
export const ResultSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.discriminatedUnion('success', [
    SuccessResponseSchema(dataSchema),
    ErrorResponseSchema
  ]);

// Common result types
export const MediaContentResultSchema = ResultSchema(MediaContentSchema);
export const MediaContentArrayResultSchema = ResultSchema(z.array(MediaContentSchema));
export const GroupSessionResultSchema = ResultSchema(GroupSessionSchema);
export const UserPreferencesResultSchema = ResultSchema(UserPreferencesSchema);
export const PlatformAvailabilityArrayResultSchema = ResultSchema(
  z.array(PlatformAvailabilitySchema)
);

// Inferred types
export type SuccessResponse<T> = {
  success: true;
  data: T;
  timestamp: Date;
};

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export type Result<T> = SuccessResponse<T> | ErrorResponse;

// ============================================================================
// Pagination Schema
// ============================================================================

/**
 * Paginated response wrapper
 */
export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pagination: z.object({
      page: z.number().int().min(1),
      limit: z.number().int().min(1).max(100),
      total: z.number().int().min(0),
      totalPages: z.number().int().min(0),
      hasNext: z.boolean(),
      hasPrevious: z.boolean()
    })
  });

export const PaginatedMediaContentSchema = PaginatedResponseSchema(MediaContentSchema);
export type PaginatedMediaContent = z.infer<typeof PaginatedMediaContentSchema>;

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Safe parse with detailed error reporting
 */
export function validateSchema<T extends z.ZodType>(
  schema: T,
  data: unknown
): Result<z.infer<T>> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      timestamp: new Date()
    };
  }

  const errors = result.error.errors.map(err => ({
    path: err.path.join('.'),
    message: err.message,
    code: err.code
  }));

  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Schema validation failed',
      details: errors
    },
    timestamp: new Date()
  };
}

/**
 * Async validation wrapper
 */
export async function validateSchemaAsync<T extends z.ZodType>(
  schema: T,
  data: unknown
): Promise<Result<z.infer<T>>> {
  return validateSchema(schema, data);
}

/**
 * Partial validation for updates
 */
export function validatePartial<T extends z.ZodType>(
  schema: T,
  data: unknown
): Result<Partial<z.infer<T>>> {
  if (schema instanceof z.ZodObject) {
    const partialSchema = schema.partial();
    return validateSchema(partialSchema, data);
  }

  return {
    success: false,
    error: {
      code: 'INVALID_SCHEMA',
      message: 'Schema does not support partial validation'
    },
    timestamp: new Date()
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if result is successful
 */
export function isSuccess<T>(result: Result<T>): result is SuccessResponse<T> {
  return result.success === true;
}

/**
 * Check if result is error
 */
export function isError<T>(result: Result<T>): result is ErrorResponse {
  return result.success === false;
}

/**
 * Unwrap result or throw
 */
export function unwrapResult<T>(result: Result<T>): T {
  if (isSuccess(result)) {
    return result.data;
  }
  throw new Error(`${result.error.code}: ${result.error.message}`);
}

// ============================================================================
// Export All Schemas
// ============================================================================

export const schemas = {
  // Base types
  MediaTypeSchema,
  ContentRatingSchema,
  StreamingPlatformSchema,
  GenreSchema,
  MoodSchema,

  // Media
  MediaContentSchema,

  // Search
  SearchFiltersSchema,
  SortOrderSchema,
  SortBySchema,

  // Intent
  AgentIntentSchema,
  SearchIntentSchema,
  RecommendationIntentSchema,
  GroupSessionIntentSchema,
  PlatformCheckIntentSchema,
  PreferenceUpdateIntentSchema,

  // User
  UserPreferencesSchema,
  PreferenceVectorSchema,

  // Group
  GroupSessionSchema,
  SessionStatusSchema,
  VoteSchema,

  // Platform
  PlatformAvailabilitySchema,
  StreamingQualitySchema,
  AvailabilityTypeSchema,

  // API
  SuccessResponseSchema,
  ErrorResponseSchema,
  ResultSchema,
  PaginatedResponseSchema
};

export default schemas;

/**
 * Schema Validation Tests
 *
 * Tests for Zod schema validation, type guards, and error handling
 */

import { describe, it, expect } from 'vitest';
import {
  MediaContentSchema,
  SearchFiltersSchema,
  AgentIntentSchema,
  UserPreferencesSchema,
  GroupSessionSchema,
  PlatformAvailabilitySchema,
  validateSchema,
  validatePartial,
  isSuccess,
  isError,
  unwrapResult,
  MediaTypeSchema,
  GenreSchema,
  MoodSchema,
} from '../../src/schemas/index.js';

describe('MediaContentSchema', () => {
  const validContent = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    title: 'Inception',
    type: 'movie' as const,
    releaseYear: 2010,
    genres: ['action', 'sci-fi'],
    language: 'en',
  };

  it('should validate correct media content', () => {
    const result = MediaContentSchema.safeParse(validContent);
    expect(result.success).toBe(true);
  });

  it('should reject invalid UUID', () => {
    const invalid = { ...validContent, id: 'not-a-uuid' };
    const result = MediaContentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject empty title', () => {
    const invalid = { ...validContent, title: '' };
    const result = MediaContentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject invalid release year', () => {
    const invalid = { ...validContent, releaseYear: 1800 };
    const result = MediaContentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject future release year beyond threshold', () => {
    const futureYear = new Date().getFullYear() + 10;
    const invalid = { ...validContent, releaseYear: futureYear };
    const result = MediaContentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should validate runtime within bounds', () => {
    const withRuntime = { ...validContent, runtime: 148 };
    const result = MediaContentSchema.safeParse(withRuntime);
    expect(result.success).toBe(true);
  });

  it('should reject negative runtime', () => {
    const invalid = { ...validContent, runtime: -10 };
    const result = MediaContentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should require genres with minimum 1', () => {
    const invalid = { ...validContent, genres: [] };
    const result = MediaContentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should limit genres to maximum 5', () => {
    const invalid = {
      ...validContent,
      genres: ['action', 'comedy', 'drama', 'thriller', 'horror', 'romance'],
    };
    const result = MediaContentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should validate rating scores within bounds', () => {
    const withRatings = {
      ...validContent,
      imdbRating: 8.8,
      rottenTomatoesScore: 87,
      metacriticScore: 74,
    };
    const result = MediaContentSchema.safeParse(withRatings);
    expect(result.success).toBe(true);
  });

  it('should reject ratings out of bounds', () => {
    const invalid = { ...validContent, imdbRating: 11 };
    const result = MediaContentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should require seasons/episodes for TV shows', () => {
    const tvShow = {
      ...validContent,
      type: 'tv' as const,
    };
    const result = MediaContentSchema.safeParse(tvShow);
    expect(result.success).toBe(false);

    const validTv = {
      ...tvShow,
      seasons: 5,
      episodes: 62,
    };
    expect(MediaContentSchema.safeParse(validTv).success).toBe(true);
  });

  it('should validate language code format', () => {
    const valid = { ...validContent, language: 'en-US' };
    expect(MediaContentSchema.safeParse(valid).success).toBe(true);

    const invalid = { ...validContent, language: 'english' };
    expect(MediaContentSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('SearchFiltersSchema', () => {
  it('should validate basic search filters', () => {
    const filters = {
      query: 'action movies',
      page: 1,
      limit: 20,
    };
    const result = SearchFiltersSchema.safeParse(filters);
    expect(result.success).toBe(true);
  });

  it('should apply default values', () => {
    const result = SearchFiltersSchema.safeParse({});
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sortBy).toBe('relevance');
      expect(result.data.sortOrder).toBe('desc');
    }
  });

  it('should validate min/max rating ranges', () => {
    const invalid = {
      minRating: 8,
      maxRating: 5,
    };
    const result = SearchFiltersSchema.safeParse(invalid);
    expect(result.success).toBe(false);

    const valid = {
      minRating: 5,
      maxRating: 8,
    };
    expect(SearchFiltersSchema.safeParse(valid).success).toBe(true);
  });

  it('should validate year ranges', () => {
    const invalid = {
      minYear: 2020,
      maxYear: 2010,
    };
    const result = SearchFiltersSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should validate runtime ranges', () => {
    const invalid = {
      minRuntime: 120,
      maxRuntime: 90,
    };
    const result = SearchFiltersSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should limit pagination', () => {
    const tooMany = { limit: 150 };
    expect(SearchFiltersSchema.safeParse(tooMany).success).toBe(false);

    const valid = { limit: 100 };
    expect(SearchFiltersSchema.safeParse(valid).success).toBe(true);
  });
});

describe('AgentIntentSchema (Discriminated Union)', () => {
  it('should validate search intent', () => {
    const searchIntent = {
      type: 'search',
      confidence: 0.9,
      query: 'science fiction movies',
    };
    const result = AgentIntentSchema.safeParse(searchIntent);
    expect(result.success).toBe(true);
  });

  it('should validate recommendation intent', () => {
    const recIntent = {
      type: 'recommendation',
      confidence: 0.85,
      basedOn: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
      reason: 'Similar to recently watched',
    };
    const result = AgentIntentSchema.safeParse(recIntent);
    expect(result.success).toBe(true);
  });

  it('should validate group session intent', () => {
    const groupIntent = {
      type: 'group-session',
      confidence: 0.8,
      action: 'create',
    };
    const result = AgentIntentSchema.safeParse(groupIntent);
    expect(result.success).toBe(true);
  });

  it('should validate platform check intent', () => {
    const platformIntent = {
      type: 'platform-check',
      confidence: 0.95,
      mediaId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    };
    const result = AgentIntentSchema.safeParse(platformIntent);
    expect(result.success).toBe(true);
  });

  it('should reject invalid intent type', () => {
    const invalid = {
      type: 'invalid-type',
      confidence: 0.9,
    };
    const result = AgentIntentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should require minimum basedOn array for recommendation', () => {
    const invalid = {
      type: 'recommendation',
      confidence: 0.8,
      basedOn: [],
    };
    const result = AgentIntentSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('UserPreferencesSchema', () => {
  const validPrefs = {
    userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    vector: {
      genres: { action: 0.8, comedy: 0.6 },
      moods: { uplifting: 0.7 },
    },
  };

  it('should validate user preferences', () => {
    const result = UserPreferencesSchema.safeParse(validPrefs);
    expect(result.success).toBe(true);
  });

  it('should normalize preference vectors', () => {
    const unnormalized = {
      ...validPrefs,
      vector: {
        genres: { action: 10, comedy: 5 },
        moods: { uplifting: 3 },
      },
    };
    const result = UserPreferencesSchema.safeParse(unnormalized);

    if (result.success) {
      const actionValue = result.data.vector.genres.action;
      expect(actionValue).toBeLessThanOrEqual(1);
      expect(actionValue).toBeGreaterThan(0);
    }
  });

  it('should validate runtime preferences', () => {
    const withRuntime = {
      ...validPrefs,
      vector: {
        ...validPrefs.vector,
        preferredRuntimeMin: 90,
        preferredRuntimeMax: 180,
      },
    };
    const result = UserPreferencesSchema.safeParse(withRuntime);
    expect(result.success).toBe(true);
  });

  it('should reject invalid runtime range', () => {
    const invalid = {
      ...validPrefs,
      vector: {
        ...validPrefs.vector,
        preferredRuntimeMin: 180,
        preferredRuntimeMax: 90,
      },
    };
    const result = UserPreferencesSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should apply default arrays', () => {
    const result = UserPreferencesSchema.safeParse(validPrefs);
    if (result.success) {
      expect(result.data.favoriteGenres).toEqual([]);
      expect(result.data.dislikedGenres).toEqual([]);
      expect(result.data.subscribedPlatforms).toEqual([]);
    }
  });

  it('should limit array sizes', () => {
    const tooMany = {
      ...validPrefs,
      watchedContent: Array(1001).fill('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
    };
    const result = UserPreferencesSchema.safeParse(tooMany);
    expect(result.success).toBe(false);
  });
});

describe('GroupSessionSchema', () => {
  const validSession = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    name: 'Friday Movie Night',
    hostId: 'b1c2d3e4-f5a6-7890-bcde-fa1234567890',
    participants: [
      'b1c2d3e4-f5a6-7890-bcde-fa1234567890',
      'c1d2e3f4-a5b6-7890-cdef-ab1234567890',
    ],
    candidateContent: ['d1e2f3a4-b5c6-7890-defa-bc1234567890'],
  };

  it('should validate group session', () => {
    const result = GroupSessionSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });

  it('should require minimum 2 participants', () => {
    const invalid = {
      ...validSession,
      participants: ['b1c2d3e4-f5a6-7890-bcde-fa1234567890'],
    };
    const result = GroupSessionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should require host to be participant', () => {
    const invalid = {
      ...validSession,
      hostId: 'x1y2z3a4-b5c6-7890-wxyz-ab1234567890',
    };
    const result = GroupSessionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should require selectedContent for decided status', () => {
    const invalid = {
      ...validSession,
      status: 'decided',
    };
    const result = GroupSessionSchema.safeParse(invalid);
    expect(result.success).toBe(false);

    const valid = {
      ...invalid,
      selectedContent: 'd1e2f3a4-b5c6-7890-defa-bc1234567890',
    };
    expect(GroupSessionSchema.safeParse(valid).success).toBe(true);
  });

  it('should require completedAt for completed status', () => {
    const invalid = {
      ...validSession,
      status: 'completed',
      selectedContent: 'd1e2f3a4-b5c6-7890-defa-bc1234567890',
    };
    const result = GroupSessionSchema.safeParse(invalid);
    expect(result.success).toBe(false);

    const valid = {
      ...invalid,
      completedAt: new Date(),
    };
    expect(GroupSessionSchema.safeParse(valid).success).toBe(true);
  });

  it('should limit participants and candidates', () => {
    const tooManyParticipants = {
      ...validSession,
      participants: Array(51).fill('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
    };
    expect(GroupSessionSchema.safeParse(tooManyParticipants).success).toBe(false);

    const tooManyCandidates = {
      ...validSession,
      candidateContent: Array(21).fill('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
    };
    expect(GroupSessionSchema.safeParse(tooManyCandidates).success).toBe(false);
  });
});

describe('PlatformAvailabilitySchema', () => {
  const validAvailability = {
    mediaId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    platform: 'netflix' as const,
    available: true,
    availabilityType: 'subscription' as const,
    maxQuality: 'HD' as const,
  };

  it('should validate platform availability', () => {
    const result = PlatformAvailabilitySchema.safeParse(validAvailability);
    expect(result.success).toBe(true);
  });

  it('should reject unavailable content with pricing', () => {
    const invalid = {
      ...validAvailability,
      available: false,
      rentalPrice: 399,
    };
    const result = PlatformAvailabilitySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should validate region code format', () => {
    const valid = { ...validAvailability, region: 'CA' };
    expect(PlatformAvailabilitySchema.safeParse(valid).success).toBe(true);

    const invalid = { ...validAvailability, region: 'USA' };
    expect(PlatformAvailabilitySchema.safeParse(invalid).success).toBe(false);
  });

  it('should validate URL format for links', () => {
    const valid = { ...validAvailability, link: 'https://netflix.com/watch/123' };
    expect(PlatformAvailabilitySchema.safeParse(valid).success).toBe(true);

    const invalid = { ...validAvailability, link: 'not-a-url' };
    expect(PlatformAvailabilitySchema.safeParse(invalid).success).toBe(false);
  });
});

describe('Validation Helper Functions', () => {
  describe('validateSchema', () => {
    it('should return success result for valid data', () => {
      const data = { type: 'movie' };
      const result = validateSchema(MediaTypeSchema, data.type);

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toBe('movie');
      }
    });

    it('should return error result for invalid data', () => {
      const result = validateSchema(MediaTypeSchema, 'invalid');

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.details).toBeDefined();
      }
    });
  });

  describe('validatePartial', () => {
    it('should validate partial objects', () => {
      const partial = { title: 'Updated Title' };
      const result = validatePartial(MediaContentSchema, partial);

      expect(isSuccess(result)).toBe(true);
    });

    it('should reject non-object schemas', () => {
      const result = validatePartial(MediaTypeSchema, 'movie');
      expect(isError(result)).toBe(true);
    });
  });

  describe('unwrapResult', () => {
    it('should return data for success result', () => {
      const successResult = {
        success: true as const,
        data: 'movie',
        timestamp: new Date(),
      };

      expect(unwrapResult(successResult)).toBe('movie');
    });

    it('should throw for error result', () => {
      const errorResult = {
        success: false as const,
        error: {
          code: 'TEST_ERROR',
          message: 'Test error',
        },
        timestamp: new Date(),
      };

      expect(() => unwrapResult(errorResult)).toThrow('TEST_ERROR: Test error');
    });
  });
});

describe('Enum Schemas', () => {
  it('should validate MediaType enum', () => {
    expect(MediaTypeSchema.safeParse('movie').success).toBe(true);
    expect(MediaTypeSchema.safeParse('tv').success).toBe(true);
    expect(MediaTypeSchema.safeParse('invalid').success).toBe(false);
  });

  it('should validate Genre enum', () => {
    expect(GenreSchema.safeParse('action').success).toBe(true);
    expect(GenreSchema.safeParse('sci-fi').success).toBe(true);
    expect(GenreSchema.safeParse('invalid-genre').success).toBe(false);
  });

  it('should validate Mood enum', () => {
    expect(MoodSchema.safeParse('uplifting').success).toBe(true);
    expect(MoodSchema.safeParse('dark').success).toBe(true);
    expect(MoodSchema.safeParse('invalid-mood').success).toBe(false);
  });
});

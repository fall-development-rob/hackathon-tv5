/**
 * Update User Preferences Use Case
 *
 * Handles updating user preferences based on:
 * - Explicit user input (ratings, likes)
 * - Implicit signals (watch events)
 * - Temporal patterns
 * - Mood mappings
 */

import type {
  UserPreferences,
  WatchEvent,
  MoodMapping,
  TemporalPattern,
} from '../../types/index.js';

/**
 * User Preferences Repository Interface
 */
export interface IUserPreferencesRepository {
  getByUserId(userId: string): Promise<UserPreferences | null>;
  save(preferences: UserPreferences): Promise<void>;
}

/**
 * Preference Vector Calculator Interface
 * Abstracts the ML logic for computing preference vectors
 */
export interface IPreferenceVectorCalculator {
  calculate(
    watchHistory: WatchEvent[],
    existingVector?: Float32Array | null
  ): Promise<{
    vector: Float32Array;
    confidence: number;
  }>;
}

/**
 * Preference Update Request
 */
export interface PreferenceUpdateRequest {
  userId: string;
  updates: {
    /** Explicit genre affinities (user-set preferences) */
    genreAffinities?: Record<number, number>;
    /** New mood mappings */
    moodMappings?: MoodMapping[];
    /** New temporal patterns */
    temporalPatterns?: TemporalPattern[];
    /** Watch events to incorporate */
    watchEvents?: WatchEvent[];
  };
}

/**
 * Preference Update Result
 */
export interface PreferenceUpdateResult {
  preferences: UserPreferences;
  updated: boolean;
  changes: {
    vectorUpdated: boolean;
    confidenceChanged: number; // Delta
    newGenreAffinities: number;
    newMoodMappings: number;
    newTemporalPatterns: number;
  };
}

/**
 * Update Preferences Use Case
 *
 * Updates user preferences incrementally:
 * 1. Load existing preferences
 * 2. Apply explicit updates
 * 3. Recalculate preference vector from watch history
 * 4. Update genre affinities
 * 5. Update mood mappings
 * 6. Update temporal patterns
 * 7. Save updated preferences
 */
export class UpdatePreferences {
  constructor(
    private readonly preferencesRepository: IUserPreferencesRepository,
    private readonly vectorCalculator: IPreferenceVectorCalculator
  ) {}

  /**
   * Execute preference update
   *
   * @param request - Preference update request
   * @returns Updated preferences with change summary
   * @throws Error if update fails
   */
  async execute(request: PreferenceUpdateRequest): Promise<PreferenceUpdateResult> {
    try {
      // Step 1: Load existing preferences or create new
      let existing = await this.preferencesRepository.getByUserId(request.userId);

      if (!existing) {
        existing = this.createDefaultPreferences(request.userId);
      }

      const oldConfidence = existing.confidence;

      // Step 2: Apply updates
      const updated = await this.applyUpdates(existing, request.updates);

      // Step 3: Save if changed
      const hasChanges = this.hasChanges(existing, updated);

      if (hasChanges) {
        await this.preferencesRepository.save(updated);
      }

      // Step 4: Calculate change summary
      const changes = this.calculateChanges(existing, updated, oldConfidence);

      return {
        preferences: updated,
        updated: hasChanges,
        changes,
      };
    } catch (error) {
      throw new Error(
        `Failed to update preferences: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create default preferences for new user
   */
  private createDefaultPreferences(userId: string): UserPreferences {
    return {
      vector: null,
      confidence: 0,
      genreAffinities: {},
      moodMappings: [],
      temporalPatterns: [],
      updatedAt: new Date(),
    };
  }

  /**
   * Apply updates to preferences
   */
  private async applyUpdates(
    existing: UserPreferences,
    updates: PreferenceUpdateRequest['updates']
  ): Promise<UserPreferences> {
    let result = { ...existing };

    // Update genre affinities
    if (updates.genreAffinities) {
      result = this.updateGenreAffinities(result, updates.genreAffinities);
    }

    // Update mood mappings
    if (updates.moodMappings) {
      result = this.updateMoodMappings(result, updates.moodMappings);
    }

    // Update temporal patterns
    if (updates.temporalPatterns) {
      result = this.updateTemporalPatterns(result, updates.temporalPatterns);
    }

    // Recalculate preference vector from watch events
    if (updates.watchEvents && updates.watchEvents.length > 0) {
      result = await this.updatePreferenceVector(result, updates.watchEvents);
    }

    // Update timestamp
    result.updatedAt = new Date();

    return result;
  }

  /**
   * Update genre affinities
   */
  private updateGenreAffinities(
    preferences: UserPreferences,
    newAffinities: Record<number, number>
  ): UserPreferences {
    // Merge with existing affinities, normalizing values
    const merged = { ...preferences.genreAffinities };

    for (const [genreId, affinity] of Object.entries(newAffinities)) {
      const normalized = Math.max(0, Math.min(1, affinity)); // Clamp to [0, 1]
      merged[parseInt(genreId)] = normalized;
    }

    return {
      ...preferences,
      genreAffinities: merged,
    };
  }

  /**
   * Update mood mappings
   */
  private updateMoodMappings(
    preferences: UserPreferences,
    newMappings: MoodMapping[]
  ): UserPreferences {
    // Replace or add mood mappings
    const existingMap = new Map(
      preferences.moodMappings.map(m => [m.mood, m])
    );

    for (const mapping of newMappings) {
      existingMap.set(mapping.mood, mapping);
    }

    return {
      ...preferences,
      moodMappings: Array.from(existingMap.values()),
    };
  }

  /**
   * Update temporal patterns
   */
  private updateTemporalPatterns(
    preferences: UserPreferences,
    newPatterns: TemporalPattern[]
  ): UserPreferences {
    // Replace or add temporal patterns
    const existingMap = new Map(
      preferences.temporalPatterns.map(p => [`${p.dayOfWeek}-${p.hourOfDay}`, p])
    );

    for (const pattern of newPatterns) {
      const key = `${pattern.dayOfWeek}-${pattern.hourOfDay}`;
      existingMap.set(key, pattern);
    }

    return {
      ...preferences,
      temporalPatterns: Array.from(existingMap.values()),
    };
  }

  /**
   * Update preference vector from watch events
   */
  private async updatePreferenceVector(
    preferences: UserPreferences,
    watchEvents: WatchEvent[]
  ): Promise<UserPreferences> {
    const { vector, confidence } = await this.vectorCalculator.calculate(
      watchEvents,
      preferences.vector
    );

    return {
      ...preferences,
      vector,
      confidence,
    };
  }

  /**
   * Check if preferences have changed
   */
  private hasChanges(
    existing: UserPreferences,
    updated: UserPreferences
  ): boolean {
    // Simple comparison - in production would use deep equality
    return (
      existing.confidence !== updated.confidence ||
      Object.keys(existing.genreAffinities).length !== Object.keys(updated.genreAffinities).length ||
      existing.moodMappings.length !== updated.moodMappings.length ||
      existing.temporalPatterns.length !== updated.temporalPatterns.length
    );
  }

  /**
   * Calculate change summary
   */
  private calculateChanges(
    existing: UserPreferences,
    updated: UserPreferences,
    oldConfidence: number
  ): PreferenceUpdateResult['changes'] {
    return {
      vectorUpdated: existing.vector !== updated.vector,
      confidenceChanged: updated.confidence - oldConfidence,
      newGenreAffinities:
        Object.keys(updated.genreAffinities).length -
        Object.keys(existing.genreAffinities).length,
      newMoodMappings:
        updated.moodMappings.length - existing.moodMappings.length,
      newTemporalPatterns:
        updated.temporalPatterns.length - existing.temporalPatterns.length,
    };
  }

  /**
   * Update from watch event
   * Convenience method for single watch event updates
   */
  async updateFromWatchEvent(
    userId: string,
    watchEvent: WatchEvent
  ): Promise<PreferenceUpdateResult> {
    return this.execute({
      userId,
      updates: {
        watchEvents: [watchEvent],
      },
    });
  }

  /**
   * Set explicit genre preferences
   * Convenience method for user-set genre preferences
   */
  async setGenrePreferences(
    userId: string,
    genreAffinities: Record<number, number>
  ): Promise<PreferenceUpdateResult> {
    return this.execute({
      userId,
      updates: {
        genreAffinities,
      },
    });
  }

  /**
   * Add mood mapping
   * Convenience method for adding mood preferences
   */
  async addMoodMapping(
    userId: string,
    moodMapping: MoodMapping
  ): Promise<PreferenceUpdateResult> {
    return this.execute({
      userId,
      updates: {
        moodMappings: [moodMapping],
      },
    });
  }
}

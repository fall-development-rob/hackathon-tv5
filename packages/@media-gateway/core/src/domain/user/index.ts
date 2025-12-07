/**
 * User Domain Layer
 *
 * Domain entities and value objects for users, profiles, preferences, and watch history.
 * Encapsulates user-related business logic and rules.
 */

import type {
  User,
  UserPreferences,
  MoodMapping,
  TemporalPattern,
  ConnectedPlatform,
  WatchEvent,
  WatchContext,
} from '../../types/index.js';

// Re-export user-related types from existing types
export type {
  User,
  UserPreferences,
  MoodMapping,
  TemporalPattern,
  ConnectedPlatform,
  WatchEvent,
  WatchContext,
} from '../../types/index.js';

/**
 * User Entity
 * Represents a user with preferences and connected platforms
 */
export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly email: string | undefined,
    public readonly displayName: string | undefined,
    public readonly createdAt: Date,
    public readonly lastActiveAt: Date,
    private preferences: UserPreferences,
    private connectedPlatforms: ConnectedPlatform[]
  ) {}

  /**
   * Get user preferences
   */
  getPreferences(): UserPreferences {
    return { ...this.preferences };
  }

  /**
   * Update user preferences
   */
  updatePreferences(preferences: Partial<UserPreferences>): UserEntity {
    const updatedPreferences = {
      ...this.preferences,
      ...preferences,
      updatedAt: new Date(),
    };

    return new UserEntity(
      this.id,
      this.email,
      this.displayName,
      this.createdAt,
      new Date(),
      updatedPreferences,
      this.connectedPlatforms
    );
  }

  /**
   * Check if user has a preference vector
   */
  hasPreferenceVector(): boolean {
    return this.preferences.vector !== null;
  }

  /**
   * Get preference confidence score
   */
  getPreferenceConfidence(): number {
    return this.preferences.confidence;
  }

  /**
   * Check if user is new (created within last 7 days)
   */
  isNewUser(): boolean {
    const daysSinceCreation = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreation <= 7;
  }

  /**
   * Check if user is active (active within last 30 days)
   */
  isActive(): boolean {
    const daysSinceActive = Math.floor(
      (Date.now() - this.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceActive <= 30;
  }

  /**
   * Get connected platforms
   */
  getConnectedPlatforms(): ConnectedPlatform[] {
    return [...this.connectedPlatforms];
  }

  /**
   * Add connected platform
   */
  connectPlatform(platform: ConnectedPlatform): UserEntity {
    const updatedPlatforms = [...this.connectedPlatforms, platform];
    return new UserEntity(
      this.id,
      this.email,
      this.displayName,
      this.createdAt,
      new Date(),
      this.preferences,
      updatedPlatforms
    );
  }

  /**
   * Remove connected platform
   */
  disconnectPlatform(platformId: string): UserEntity {
    const updatedPlatforms = this.connectedPlatforms.filter(
      p => p.platformId !== platformId
    );
    return new UserEntity(
      this.id,
      this.email,
      this.displayName,
      this.createdAt,
      new Date(),
      this.preferences,
      updatedPlatforms
    );
  }

  /**
   * Check if platform is connected
   */
  hasPlatformConnected(platformId: string): boolean {
    return this.connectedPlatforms.some(p => p.platformId === platformId);
  }

  /**
   * Get active subscriptions count
   */
  getActiveSubscriptionsCount(): number {
    return this.connectedPlatforms.filter(p => p.subscriptionStatus === 'active').length;
  }
}

/**
 * Profile Value Object
 * Represents user's public profile information
 */
export class Profile {
  constructor(
    public readonly userId: string,
    public readonly displayName: string,
    public readonly avatarUrl?: string,
    public readonly bio?: string
  ) {}

  /**
   * Get display name or fallback
   */
  getDisplayNameOrDefault(fallback: string = 'Anonymous'): string {
    return this.displayName || fallback;
  }

  /**
   * Check if profile has avatar
   */
  hasAvatar(): boolean {
    return !!this.avatarUrl;
  }
}

/**
 * Preferences Value Object
 * Encapsulates user preference logic
 */
export class PreferencesEntity {
  constructor(
    private readonly vector: Float32Array | null,
    private readonly confidence: number,
    private readonly genreAffinities: Record<number, number>,
    private readonly moodMappings: MoodMapping[],
    private readonly temporalPatterns: TemporalPattern[],
    private readonly updatedAt: Date
  ) {}

  /**
   * Get preference vector
   */
  getVector(): Float32Array | null {
    return this.vector;
  }

  /**
   * Get confidence score (0-1)
   */
  getConfidence(): number {
    return this.confidence;
  }

  /**
   * Get top N preferred genres
   */
  getTopGenres(n: number = 5): Array<{ genreId: number; affinity: number }> {
    return Object.entries(this.genreAffinities)
      .map(([genreId, affinity]) => ({ genreId: parseInt(genreId), affinity }))
      .sort((a, b) => b.affinity - a.affinity)
      .slice(0, n);
  }

  /**
   * Get affinity for a specific genre
   */
  getGenreAffinity(genreId: number): number {
    return this.genreAffinities[genreId] ?? 0;
  }

  /**
   * Get mood mapping for a specific mood
   */
  getMoodMapping(mood: string): MoodMapping | undefined {
    return this.moodMappings.find(m => m.mood.toLowerCase() === mood.toLowerCase());
  }

  /**
   * Get viewing pattern for current time
   */
  getCurrentTemporalPattern(): TemporalPattern | undefined {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hourOfDay = now.getHours();

    return this.temporalPatterns.find(
      p => p.dayOfWeek === dayOfWeek && p.hourOfDay === hourOfDay
    );
  }

  /**
   * Get preferred genres for current time
   */
  getPreferredGenresForNow(): number[] {
    const pattern = this.getCurrentTemporalPattern();
    if (!pattern) return [];
    return pattern.preferredGenres;
  }

  /**
   * Check if preferences need updating (older than 7 days)
   */
  needsUpdate(): boolean {
    const daysSinceUpdate = Math.floor(
      (Date.now() - this.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceUpdate >= 7;
  }
}

/**
 * Watch History Value Object
 * Tracks user's viewing history and patterns
 */
export class WatchHistory {
  constructor(
    private readonly events: WatchEvent[]
  ) {}

  /**
   * Get all watch events
   */
  getEvents(): WatchEvent[] {
    return [...this.events];
  }

  /**
   * Get watch events for a specific content
   */
  getEventsForContent(contentId: number, mediaType: 'movie' | 'tv'): WatchEvent[] {
    return this.events.filter(
      e => e.contentId === contentId && e.mediaType === mediaType
    );
  }

  /**
   * Check if content has been watched
   */
  hasWatched(contentId: number, mediaType: 'movie' | 'tv'): boolean {
    return this.getEventsForContent(contentId, mediaType).length > 0;
  }

  /**
   * Get completion rate for content
   */
  getCompletionRate(contentId: number, mediaType: 'movie' | 'tv'): number {
    const events = this.getEventsForContent(contentId, mediaType);
    if (events.length === 0) return 0;

    // Return highest completion rate for this content
    return Math.max(...events.map(e => e.completionRate));
  }

  /**
   * Check if content was completed (completion rate >= 0.9)
   */
  wasCompleted(contentId: number, mediaType: 'movie' | 'tv'): boolean {
    return this.getCompletionRate(contentId, mediaType) >= 0.9;
  }

  /**
   * Get total watch time in minutes
   */
  getTotalWatchTimeMinutes(): number {
    return this.events.reduce((total, event) => total + (event.duration / 60), 0);
  }

  /**
   * Get watch count (distinct content pieces)
   */
  getWatchCount(): number {
    const uniqueContent = new Set(
      this.events.map(e => `${e.mediaType}-${e.contentId}`)
    );
    return uniqueContent.size;
  }

  /**
   * Get rewatch count
   */
  getRewatchCount(): number {
    return this.events.filter(e => e.isRewatch).length;
  }

  /**
   * Get average completion rate
   */
  getAverageCompletionRate(): number {
    if (this.events.length === 0) return 0;
    const total = this.events.reduce((sum, e) => sum + e.completionRate, 0);
    return total / this.events.length;
  }

  /**
   * Get watch events in date range
   */
  getEventsInRange(startDate: Date, endDate: Date): WatchEvent[] {
    return this.events.filter(
      e => e.timestamp >= startDate && e.timestamp <= endDate
    );
  }

  /**
   * Get most watched platform
   */
  getMostWatchedPlatform(): string | null {
    if (this.events.length === 0) return null;

    const platformCounts: Record<string, number> = {};
    this.events.forEach(e => {
      platformCounts[e.platformId] = (platformCounts[e.platformId] ?? 0) + 1;
    });

    const sorted = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]);
    const first = sorted[0];
    return first ? first[0] : null;
  }

  /**
   * Get viewing patterns by day of week
   */
  getViewingPatternsByDay(): Record<number, number> {
    const patterns: Record<number, number> = {};
    this.events.forEach(e => {
      const day = e.context.dayOfWeek;
      patterns[day] = (patterns[day] ?? 0) + 1;
    });
    return patterns;
  }

  /**
   * Get viewing patterns by hour
   */
  getViewingPatternsByHour(): Record<number, number> {
    const patterns: Record<number, number> = {};
    this.events.forEach(e => {
      const hour = e.context.hourOfDay;
      patterns[hour] = (patterns[hour] ?? 0) + 1;
    });
    return patterns;
  }
}

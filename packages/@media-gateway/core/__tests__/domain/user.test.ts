/**
 * User Domain Layer Tests
 *
 * Tests for UserEntity, Profile, PreferencesEntity, and WatchHistory
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  UserEntity,
  Profile,
  PreferencesEntity,
  WatchHistory,
  type UserPreferences,
  type ConnectedPlatform,
  type WatchEvent,
} from '../../src/domain/user/index.js';

describe('UserEntity', () => {
  let preferences: UserPreferences;
  let platforms: ConnectedPlatform[];
  let user: UserEntity;

  beforeEach(() => {
    preferences = {
      vector: null,
      confidence: 0.7,
      genreAffinities: { 28: 0.9, 35: 0.6 },
      moodMappings: [],
      temporalPatterns: [],
      updatedAt: new Date(),
    };

    platforms = [
      {
        platformId: 'netflix',
        platformName: 'Netflix',
        userId: 'netflix-user-123',
        subscriptionStatus: 'active' as const,
        connectedAt: new Date(),
        lastSyncAt: new Date(),
      },
    ];

    user = new UserEntity(
      'user-123',
      'test@example.com',
      'Test User',
      new Date('2024-01-01'),
      new Date('2024-12-01'),
      preferences,
      platforms
    );
  });

  describe('getPreferences', () => {
    it('should return a copy of preferences', () => {
      const prefs = user.getPreferences();
      expect(prefs).toEqual(preferences);
      expect(prefs).not.toBe(preferences); // Different object
    });
  });

  describe('updatePreferences', () => {
    it('should create new user with updated preferences', () => {
      const newPrefs = { confidence: 0.8 };
      const updated = user.updatePreferences(newPrefs);

      expect(updated.getPreferences().confidence).toBe(0.8);
      expect(user.getPreferences().confidence).toBe(0.7); // Original unchanged
      expect(updated).not.toBe(user);
    });

    it('should update lastActiveAt timestamp', () => {
      const before = new Date();
      const updated = user.updatePreferences({ confidence: 0.9 });
      expect(updated.lastActiveAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('hasPreferenceVector', () => {
    it('should return false when vector is null', () => {
      expect(user.hasPreferenceVector()).toBe(false);
    });

    it('should return true when vector exists', () => {
      const vectorPrefs = { ...preferences, vector: new Float32Array([1, 2, 3]) };
      const userWithVector = new UserEntity('id', 'email', 'name', new Date(), new Date(), vectorPrefs, []);
      expect(userWithVector.hasPreferenceVector()).toBe(true);
    });
  });

  describe('getPreferenceConfidence', () => {
    it('should return current confidence score', () => {
      expect(user.getPreferenceConfidence()).toBe(0.7);
    });
  });

  describe('isNewUser', () => {
    it('should return true for user created within 7 days', () => {
      const recent = new Date();
      recent.setDate(recent.getDate() - 5);
      const newUser = new UserEntity('id', 'email', 'name', recent, new Date(), preferences, []);
      expect(newUser.isNewUser()).toBe(true);
    });

    it('should return false for user created more than 7 days ago', () => {
      expect(user.isNewUser()).toBe(false);
    });
  });

  describe('isActive', () => {
    it('should return true for user active within 30 days', () => {
      const recentlyActive = new Date();
      recentlyActive.setDate(recentlyActive.getDate() - 10);
      const activeUser = new UserEntity('id', 'email', 'name', new Date('2024-01-01'), recentlyActive, preferences, []);
      expect(activeUser.isActive()).toBe(true);
    });

    it('should return false for user inactive for more than 30 days', () => {
      const longAgo = new Date();
      longAgo.setDate(longAgo.getDate() - 60);
      const inactiveUser = new UserEntity('id', 'email', 'name', new Date('2024-01-01'), longAgo, preferences, []);
      expect(inactiveUser.isActive()).toBe(false);
    });
  });

  describe('platform management', () => {
    it('should add new platform', () => {
      const newPlatform: ConnectedPlatform = {
        platformId: 'hulu',
        platformName: 'Hulu',
        userId: 'hulu-user-123',
        subscriptionStatus: 'active' as const,
        connectedAt: new Date(),
        lastSyncAt: new Date(),
      };
      const updated = user.connectPlatform(newPlatform);

      expect(updated.getConnectedPlatforms()).toHaveLength(2);
      expect(updated.hasPlatformConnected('hulu')).toBe(true);
    });

    it('should remove platform', () => {
      const updated = user.disconnectPlatform('netflix');
      expect(updated.getConnectedPlatforms()).toHaveLength(0);
      expect(updated.hasPlatformConnected('netflix')).toBe(false);
    });

    it('should count active subscriptions', () => {
      const multiplePlatforms: ConnectedPlatform[] = [
        { platformId: 'netflix', platformName: 'Netflix', userId: 'u1', subscriptionStatus: 'active' as const, connectedAt: new Date(), lastSyncAt: new Date() },
        { platformId: 'hulu', platformName: 'Hulu', userId: 'u2', subscriptionStatus: 'active' as const, connectedAt: new Date(), lastSyncAt: new Date() },
        { platformId: 'disney', platformName: 'Disney+', userId: 'u3', subscriptionStatus: 'expired' as const, connectedAt: new Date(), lastSyncAt: new Date() },
      ];
      const multiUser = new UserEntity('id', 'email', 'name', new Date(), new Date(), preferences, multiplePlatforms);
      expect(multiUser.getActiveSubscriptionsCount()).toBe(2);
    });
  });
});

describe('Profile', () => {
  it('should create profile with all fields', () => {
    const profile = new Profile('user-123', 'John Doe', 'https://avatar.com/pic.jpg', 'Bio text');
    expect(profile.userId).toBe('user-123');
    expect(profile.displayName).toBe('John Doe');
    expect(profile.avatarUrl).toBe('https://avatar.com/pic.jpg');
    expect(profile.bio).toBe('Bio text');
  });

  describe('getDisplayNameOrDefault', () => {
    it('should return display name when present', () => {
      const profile = new Profile('id', 'John');
      expect(profile.getDisplayNameOrDefault()).toBe('John');
    });

    it('should return custom fallback when display name is empty', () => {
      const profile = new Profile('id', '');
      expect(profile.getDisplayNameOrDefault('Guest')).toBe('Guest');
    });
  });

  describe('hasAvatar', () => {
    it('should return true when avatar URL exists', () => {
      const profile = new Profile('id', 'name', 'https://example.com/avatar.jpg');
      expect(profile.hasAvatar()).toBe(true);
    });

    it('should return false when avatar URL is undefined', () => {
      const profile = new Profile('id', 'name');
      expect(profile.hasAvatar()).toBe(false);
    });
  });
});

describe('PreferencesEntity', () => {
  const genreAffinities = { 28: 0.9, 35: 0.7, 18: 0.5 };
  const moodMappings = [
    { mood: 'happy', strength: 0.8, contentVector: new Float32Array([0.1, 0.2, 0.3]) },
  ];
  const temporalPatterns = [
    { dayOfWeek: 5, hourOfDay: 20, preferredGenres: [28], avgWatchDuration: 120 },
  ];

  const createPreferences = () => new PreferencesEntity(
    new Float32Array([0.1, 0.2, 0.3]),
    0.8,
    genreAffinities,
    moodMappings,
    temporalPatterns,
    new Date()
  );

  describe('getTopGenres', () => {
    it('should return top N genres sorted by affinity', () => {
      const prefs = createPreferences();
      const top = prefs.getTopGenres(2);

      expect(top).toHaveLength(2);
      expect(top[0]!.genreId).toBe(28);
      expect(top[0]!.affinity).toBe(0.9);
      expect(top[1]!.genreId).toBe(35);
    });

    it('should default to top 5', () => {
      const prefs = createPreferences();
      const top = prefs.getTopGenres();
      expect(top.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getGenreAffinity', () => {
    it('should return affinity for existing genre', () => {
      const prefs = createPreferences();
      expect(prefs.getGenreAffinity(28)).toBe(0.9);
    });

    it('should return 0 for unknown genre', () => {
      const prefs = createPreferences();
      expect(prefs.getGenreAffinity(999)).toBe(0);
    });
  });

  describe('getMoodMapping', () => {
    it('should return mapping for existing mood (case insensitive)', () => {
      const prefs = createPreferences();
      const mapping = prefs.getMoodMapping('happy');
      expect(mapping).toBeDefined();
      expect(mapping?.strength).toBe(0.8);
    });

    it('should handle case insensitive search', () => {
      const prefs = createPreferences();
      expect(prefs.getMoodMapping('HAPPY')).toBeDefined();
    });

    it('should return undefined for unknown mood', () => {
      const prefs = createPreferences();
      expect(prefs.getMoodMapping('sad')).toBeUndefined();
    });
  });

  describe('getCurrentTemporalPattern', () => {
    it('should return pattern matching current time', () => {
      const friday8pm = new Date();
      friday8pm.setDay(5); // Friday
      friday8pm.setHours(20); // 8 PM

      // Mock current time by creating pattern for current actual time
      const now = new Date();
      const currentPatterns = [
        { dayOfWeek: now.getDay(), hourOfDay: now.getHours(), preferredGenres: [28], avgWatchDuration: 120 },
      ];

      const prefs = new PreferencesEntity(null, 0.8, {}, [], currentPatterns, new Date());
      const pattern = prefs.getCurrentTemporalPattern();
      expect(pattern).toBeDefined();
    });
  });

  describe('needsUpdate', () => {
    it('should return true for preferences older than 7 days', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      const prefs = new PreferencesEntity(null, 0.8, {}, [], [], oldDate);
      expect(prefs.needsUpdate()).toBe(true);
    });

    it('should return false for recent preferences', () => {
      const prefs = createPreferences();
      expect(prefs.needsUpdate()).toBe(false);
    });
  });
});

describe('WatchHistory', () => {
  const createWatchEvent = (overrides: Partial<WatchEvent> = {}): WatchEvent => ({
    userId: 'user-123',
    contentId: 1,
    mediaType: 'movie' as const,
    timestamp: new Date(),
    duration: 7200,
    totalDuration: 7200,
    completionRate: 1.0,
    platformId: 'netflix',
    isRewatch: false,
    context: {
      dayOfWeek: 5,
      hourOfDay: 20,
      device: 'tv',
      isGroupWatch: false,
    },
    ...overrides,
  });

  describe('hasWatched', () => {
    it('should return true for watched content', () => {
      const events = [createWatchEvent({ contentId: 1, mediaType: 'movie' })];
      const history = new WatchHistory(events);
      expect(history.hasWatched(1, 'movie')).toBe(true);
    });

    it('should return false for unwatched content', () => {
      const events = [createWatchEvent({ contentId: 1 })];
      const history = new WatchHistory(events);
      expect(history.hasWatched(2, 'movie')).toBe(false);
    });
  });

  describe('wasCompleted', () => {
    it('should return true for completion rate >= 0.9', () => {
      const events = [createWatchEvent({ contentId: 1, completionRate: 0.95 })];
      const history = new WatchHistory(events);
      expect(history.wasCompleted(1, 'movie')).toBe(true);
    });

    it('should return false for completion rate < 0.9', () => {
      const events = [createWatchEvent({ contentId: 1, completionRate: 0.5 })];
      const history = new WatchHistory(events);
      expect(history.wasCompleted(1, 'movie')).toBe(false);
    });
  });

  describe('getTotalWatchTimeMinutes', () => {
    it('should sum all watch durations in minutes', () => {
      const events = [
        createWatchEvent({ duration: 3600 }), // 60 minutes
        createWatchEvent({ duration: 7200 }), // 120 minutes
      ];
      const history = new WatchHistory(events);
      expect(history.getTotalWatchTimeMinutes()).toBe(180);
    });
  });

  describe('getWatchCount', () => {
    it('should count distinct content pieces', () => {
      const events = [
        createWatchEvent({ contentId: 1, mediaType: 'movie' }),
        createWatchEvent({ contentId: 1, mediaType: 'movie' }), // Duplicate
        createWatchEvent({ contentId: 2, mediaType: 'tv' }),
      ];
      const history = new WatchHistory(events);
      expect(history.getWatchCount()).toBe(2);
    });
  });

  describe('getRewatchCount', () => {
    it('should count rewatch events', () => {
      const events = [
        createWatchEvent({ isRewatch: false }),
        createWatchEvent({ isRewatch: true }),
        createWatchEvent({ isRewatch: true }),
      ];
      const history = new WatchHistory(events);
      expect(history.getRewatchCount()).toBe(2);
    });
  });

  describe('getAverageCompletionRate', () => {
    it('should calculate average completion rate', () => {
      const events = [
        createWatchEvent({ completionRate: 1.0 }),
        createWatchEvent({ completionRate: 0.5 }),
        createWatchEvent({ completionRate: 0.7 }),
      ];
      const history = new WatchHistory(events);
      expect(history.getAverageCompletionRate()).toBeCloseTo(0.733, 2);
    });

    it('should return 0 for empty history', () => {
      const history = new WatchHistory([]);
      expect(history.getAverageCompletionRate()).toBe(0);
    });
  });

  describe('getMostWatchedPlatform', () => {
    it('should return platform with most watches', () => {
      const events = [
        createWatchEvent({ platformId: 'netflix' }),
        createWatchEvent({ platformId: 'netflix' }),
        createWatchEvent({ platformId: 'hulu' }),
      ];
      const history = new WatchHistory(events);
      expect(history.getMostWatchedPlatform()).toBe('netflix');
    });

    it('should return null for empty history', () => {
      const history = new WatchHistory([]);
      expect(history.getMostWatchedPlatform()).toBeNull();
    });
  });

  describe('viewing patterns', () => {
    it('should group by day of week', () => {
      const events = [
        createWatchEvent({ context: { dayOfWeek: 5, hourOfDay: 20, device: 'tv', isGroupWatch: false } }),
        createWatchEvent({ context: { dayOfWeek: 5, hourOfDay: 21, device: 'tv', isGroupWatch: false } }),
        createWatchEvent({ context: { dayOfWeek: 6, hourOfDay: 15, device: 'tv', isGroupWatch: false } }),
      ];
      const history = new WatchHistory(events);
      const patterns = history.getViewingPatternsByDay();

      expect(patterns[5]).toBe(2);
      expect(patterns[6]).toBe(1);
    });

    it('should group by hour', () => {
      const events = [
        createWatchEvent({ context: { dayOfWeek: 5, hourOfDay: 20, device: 'tv', isGroupWatch: false } }),
        createWatchEvent({ context: { dayOfWeek: 5, hourOfDay: 20, device: 'tv', isGroupWatch: false } }),
        createWatchEvent({ context: { dayOfWeek: 6, hourOfDay: 15, device: 'tv', isGroupWatch: false } }),
      ];
      const history = new WatchHistory(events);
      const patterns = history.getViewingPatternsByHour();

      expect(patterns[20]).toBe(2);
      expect(patterns[15]).toBe(1);
    });
  });
});

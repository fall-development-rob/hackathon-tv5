/**
 * Group Recommendation Service Tests
 * Social moat validation - group consensus algorithms
 */

import { describe, it, expect } from 'vitest';
import {
  calculateGroupCentroid,
  rankGroupCandidates,
  applyContextBoosts,
  processVotes,
  generateGroupExplanation,
} from '../src/services/GroupRecommendationService.js';
import type { GroupCandidate, MediaContent, UserPreferences } from '../src/types/index.js';

const mockContent = (id: number, title: string): MediaContent => ({
  id,
  title,
  overview: 'Test content',
  mediaType: 'movie',
  genreIds: [28, 12],
  voteAverage: 7.5,
  voteCount: 1000,
  releaseDate: '2024-01-01',
  posterPath: '/poster.jpg',
  backdropPath: '/backdrop.jpg',
  popularity: 100,
});

const mockPreferences = (vector: number[]): UserPreferences => ({
  vector: new Float32Array(vector),
  confidence: 0.8,
  genreAffinities: { 28: 0.8, 12: 0.7 },
  moodMappings: [],
  temporalPatterns: [],
  updatedAt: new Date(),
});

describe('GroupRecommendationService', () => {
  describe('calculateGroupCentroid', () => {
    it('should calculate centroid from member preferences', () => {
      const members = [
        { userId: 'user1', preferences: mockPreferences([1.0, 0.0, 0.0]), weight: 1 },
        { userId: 'user2', preferences: mockPreferences([0.0, 1.0, 0.0]), weight: 1 },
      ];

      const centroid = calculateGroupCentroid(members);

      expect(centroid).toBeInstanceOf(Float32Array);
      expect(centroid!.length).toBe(3);
      // Average of [1,0,0] and [0,1,0] normalized
      expect(centroid![0]).toBeCloseTo(centroid![1]);
    });

    it('should apply member weights', () => {
      const members = [
        { userId: 'user1', preferences: mockPreferences([1.0, 0.0, 0.0]), weight: 2 },
        { userId: 'user2', preferences: mockPreferences([0.0, 1.0, 0.0]), weight: 1 },
      ];

      const centroid = calculateGroupCentroid(members);

      // User1 has 2x weight, so centroid should lean toward their preference
      expect(centroid![0]).toBeGreaterThan(centroid![1]);
    });

    it('should handle members without preferences', () => {
      const members = [
        { userId: 'user1', preferences: mockPreferences([1.0, 0.0, 0.0]), weight: 1 },
        { userId: 'user2', preferences: { ...mockPreferences([0.0, 0.0, 0.0]), vector: null }, weight: 1 },
      ];

      const centroid = calculateGroupCentroid(members);

      expect(centroid).toBeInstanceOf(Float32Array);
    });

    it('should return null for no valid preferences', () => {
      const members = [
        { userId: 'user1', preferences: { ...mockPreferences([0, 0, 0]), vector: null }, weight: 1 },
      ];

      const centroid = calculateGroupCentroid(members);
      expect(centroid).toBeNull();
    });
  });

  describe('rankGroupCandidates', () => {
    it('should rank candidates by group satisfaction', () => {
      const candidates = [
        { content: mockContent(1, 'Movie A'), embedding: new Float32Array([1.0, 0.0, 0.0]) },
        { content: mockContent(2, 'Movie B'), embedding: new Float32Array([0.5, 0.5, 0.0]) },
      ];

      const members = [
        { userId: 'user1', preferences: mockPreferences([1.0, 0.0, 0.0]), weight: 1 },
        { userId: 'user2', preferences: mockPreferences([0.0, 1.0, 0.0]), weight: 1 },
      ];

      const ranked = rankGroupCandidates(candidates, members, 0.5);

      expect(ranked.length).toBe(2);
      // Movie B should rank higher as it satisfies both users better
      expect(ranked[0]!.content.id).toBe(2);
    });

    it('should include fairness scores', () => {
      const candidates = [
        { content: mockContent(1, 'Movie A'), embedding: new Float32Array([0.5, 0.5, 0.0]) },
      ];

      const members = [
        { userId: 'user1', preferences: mockPreferences([1.0, 0.0, 0.0]), weight: 1 },
        { userId: 'user2', preferences: mockPreferences([0.0, 1.0, 0.0]), weight: 1 },
      ];

      const ranked = rankGroupCandidates(candidates, members, 0.5);

      expect(ranked[0]).toHaveProperty('fairnessScore');
      expect(ranked[0]).toHaveProperty('groupScore');
      expect(ranked[0]!.fairnessScore).toBeGreaterThan(0);
    });
  });

  describe('applyContextBoosts', () => {
    it('should boost candidates matching mood', () => {
      const candidates: GroupCandidate[] = [
        {
          content: mockContent(1, 'Comedy Movie'),
          groupScore: 0.5,
          fairnessScore: 0.5,
          memberScores: {},
          votes: {},
        },
      ];

      // Mock genre 35 = Comedy
      candidates[0]!.content.genreIds = [35];

      const boosted = applyContextBoosts(candidates, { mood: 'fun' });

      expect(boosted[0]!.groupScore).toBeGreaterThan(0.5);
    });

    it('should boost recently released content when context indicates', () => {
      const candidates: GroupCandidate[] = [
        {
          content: { ...mockContent(1, 'New Movie'), releaseDate: '2024-11-01' },
          groupScore: 0.5,
          fairnessScore: 0.5,
          memberScores: {},
          votes: {},
        },
        {
          content: { ...mockContent(2, 'Old Movie'), releaseDate: '2020-01-01' },
          groupScore: 0.5,
          fairnessScore: 0.5,
          memberScores: {},
          votes: {},
        },
      ];

      const boosted = applyContextBoosts(candidates, { preferRecent: true });

      expect(boosted[0]!.groupScore).toBeGreaterThan(boosted[1]!.groupScore);
    });
  });

  describe('processVotes', () => {
    it('should select candidate with highest average vote', () => {
      const candidates: GroupCandidate[] = [
        {
          content: mockContent(1, 'Movie A'),
          groupScore: 0.5,
          fairnessScore: 0.5,
          memberScores: {},
          votes: { user1: 8, user2: 7 },
        },
        {
          content: mockContent(2, 'Movie B'),
          groupScore: 0.5,
          fairnessScore: 0.5,
          memberScores: {},
          votes: { user1: 6, user2: 5 },
        },
      ];

      const votes = {
        user1: { 1: 8, 2: 6 },
        user2: { 1: 7, 2: 5 },
      };

      const winner = processVotes(candidates, votes);

      expect(winner).not.toBeNull();
      expect(winner!.content.id).toBe(1);
    });

    it('should handle tie by fairness score', () => {
      const candidates: GroupCandidate[] = [
        {
          content: mockContent(1, 'Movie A'),
          groupScore: 0.5,
          fairnessScore: 0.8,
          memberScores: {},
          votes: { user1: 7, user2: 7 },
        },
        {
          content: mockContent(2, 'Movie B'),
          groupScore: 0.5,
          fairnessScore: 0.6,
          memberScores: {},
          votes: { user1: 7, user2: 7 },
        },
      ];

      const votes = {
        user1: { 1: 7, 2: 7 },
        user2: { 1: 7, 2: 7 },
      };

      const winner = processVotes(candidates, votes);

      // Higher fairness should win in tie
      expect(winner!.content.id).toBe(1);
    });

    it('should return null for no votes', () => {
      const candidates: GroupCandidate[] = [
        {
          content: mockContent(1, 'Movie A'),
          groupScore: 0.5,
          fairnessScore: 0.5,
          memberScores: {},
          votes: {},
        },
      ];

      const winner = processVotes(candidates, {});
      expect(winner).toBeNull();
    });
  });

  describe('generateGroupExplanation', () => {
    it('should generate explanation for group candidate', () => {
      const candidate: GroupCandidate = {
        content: mockContent(1, 'Action Movie'),
        groupScore: 0.85,
        fairnessScore: 0.9,
        memberScores: { user1: 0.9, user2: 0.8 },
        votes: {},
      };

      const explanation = generateGroupExplanation(candidate);

      expect(explanation).toContain('Action Movie');
      expect(explanation.length).toBeGreaterThan(0);
    });

    it('should mention fairness when high', () => {
      const candidate: GroupCandidate = {
        content: mockContent(1, 'Balanced Movie'),
        groupScore: 0.7,
        fairnessScore: 0.95,
        memberScores: { user1: 0.7, user2: 0.7, user3: 0.7 },
        votes: {},
      };

      const explanation = generateGroupExplanation(candidate);

      expect(explanation.toLowerCase()).toMatch(/fair|equal|everyone/);
    });
  });
});

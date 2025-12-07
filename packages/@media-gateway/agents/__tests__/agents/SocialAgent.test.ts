/**
 * Social Agent Tests
 * Tests group sessions, voting, and social recommendations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SocialAgent, createSocialAgent } from '../../src/agents/SocialAgent.js';
import type { GroupSession, MediaContent, UserPreferences } from '@media-gateway/core';

// Mock dependencies
const createMockDbWrapper = () => ({
  getPreferencePattern: vi.fn(),
  recordSocialConnection: vi.fn(),
});

const createMockVectorWrapper = () => ({
  generateEmbedding: vi.fn(),
  searchByEmbedding: vi.fn(),
  searchById: vi.fn(),
});

describe('SocialAgent', () => {
  let agent: SocialAgent;
  let mockDb: ReturnType<typeof createMockDbWrapper>;
  let mockVector: ReturnType<typeof createMockVectorWrapper>;

  const mockContent: MediaContent = {
    id: 123,
    title: 'Test Movie',
    overview: 'A great movie',
    mediaType: 'movie',
    genreIds: [28, 12],
    voteAverage: 8.5,
    voteCount: 1000,
    releaseDate: '2023-01-01',
    posterPath: '/test.jpg',
    backdropPath: '/backdrop.jpg',
    popularity: 100,
  };

  const mockPreferences: UserPreferences = {
    vector: new Float32Array(768).fill(0.5),
    confidence: 0.7,
    genreAffinities: { 28: 0.8, 35: 0.6 },
    moodMappings: [],
    temporalPatterns: [],
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockDb = createMockDbWrapper();
    mockVector = createMockVectorWrapper();
    agent = createSocialAgent(mockDb, mockVector);
  });

  describe('Session Creation', () => {
    it('should create a group session', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.searchByEmbedding.mockResolvedValue([
        { content: mockContent, score: 0.9 }
      ]);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.6));

      const session = await agent.createSession(
        'group-123',
        'user-1',
        ['user-2', 'user-3']
      );

      expect(session).toBeDefined();
      expect(session.groupId).toBe('group-123');
      expect(session.initiatorId).toBe('user-1');
      expect(session.status).toBe('voting');
      expect(session.candidates).toBeDefined();
    });

    it('should record social connections', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.searchByEmbedding.mockResolvedValue([]);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));

      await agent.createSession('group-123', 'user-1', ['user-2', 'user-3']);

      expect(mockDb.recordSocialConnection).toHaveBeenCalled();
    });

    it('should generate candidates with context', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.searchByEmbedding.mockResolvedValue([
        { content: mockContent, score: 0.9 }
      ]);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.6));

      const session = await agent.createSession(
        'group-123',
        'user-1',
        ['user-2'],
        { mood: 'fun', availableTime: 120 }
      );

      expect(session.context).toEqual({ mood: 'fun', availableTime: 120 });
    });

    it('should handle no preferences for members', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(null);
      mockVector.searchByEmbedding.mockResolvedValue([]);

      const session = await agent.createSession('group-123', 'user-1', ['user-2']);

      expect(session.candidates).toEqual([]);
    });
  });

  describe('Voting System', () => {
    it('should submit votes correctly', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.searchByEmbedding.mockResolvedValue([
        { content: mockContent, score: 0.9 }
      ]);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.6));

      const session = await agent.createSession('group-123', 'user-1', ['user-2']);

      const success = agent.submitVote(session.id, 'user-1', mockContent.id, 8);

      expect(success).toBe(true);
    });

    it('should reject votes for non-existent sessions', () => {
      const success = agent.submitVote('fake-session', 'user-1', 123, 8);

      expect(success).toBe(false);
    });

    it('should reject votes for invalid content', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.searchByEmbedding.mockResolvedValue([
        { content: mockContent, score: 0.9 }
      ]);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.6));

      const session = await agent.createSession('group-123', 'user-1', ['user-2']);

      const success = agent.submitVote(session.id, 'user-1', 999, 8);

      expect(success).toBe(false);
    });

    it('should clamp vote scores to 0-10 range', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.searchByEmbedding.mockResolvedValue([
        { content: mockContent, score: 0.9 }
      ]);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.6));

      const session = await agent.createSession('group-123', 'user-1', ['user-2']);

      agent.submitVote(session.id, 'user-1', mockContent.id, 15);

      const retrievedSession = agent.getSession(session.id);
      const candidate = retrievedSession?.candidates.find(c => c.content.id === mockContent.id);

      expect(candidate?.votes['user-1']).toBe(10);
    });

    it('should not accept votes after session is decided', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.searchByEmbedding.mockResolvedValue([
        { content: mockContent, score: 0.9 }
      ]);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.6));

      const session = await agent.createSession('group-123', 'user-1', ['user-2']);

      agent.submitVote(session.id, 'user-1', mockContent.id, 8);
      agent.finalizeSession(session.id);

      const success = agent.submitVote(session.id, 'user-2', mockContent.id, 9);

      expect(success).toBe(false);
    });
  });

  describe('Session Finalization', () => {
    it('should finalize session and pick winner', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.searchByEmbedding.mockResolvedValue([
        { content: mockContent, score: 0.9 }
      ]);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.6));

      const session = await agent.createSession('group-123', 'user-1', ['user-2']);

      agent.submitVote(session.id, 'user-1', mockContent.id, 9);
      agent.submitVote(session.id, 'user-2', mockContent.id, 8);

      const winner = agent.finalizeSession(session.id);

      expect(winner).toBeDefined();
      expect(winner?.content.id).toBe(mockContent.id);
    });

    it('should update session status to decided', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.searchByEmbedding.mockResolvedValue([
        { content: mockContent, score: 0.9 }
      ]);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.6));

      const session = await agent.createSession('group-123', 'user-1', ['user-2']);

      agent.submitVote(session.id, 'user-1', mockContent.id, 9);
      agent.finalizeSession(session.id);

      const retrievedSession = agent.getSession(session.id);

      expect(retrievedSession?.status).toBe('decided');
      expect(retrievedSession?.selectedContentId).toBe(mockContent.id);
    });

    it('should return null for non-existent session', () => {
      const winner = agent.finalizeSession('fake-session');

      expect(winner).toBeNull();
    });

    it('should strengthen social connections after voting', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.searchByEmbedding.mockResolvedValue([
        { content: mockContent, score: 0.9 }
      ]);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.6));

      const session = await agent.createSession('group-123', 'user-1', ['user-2', 'user-3']);

      agent.submitVote(session.id, 'user-1', mockContent.id, 9);
      agent.submitVote(session.id, 'user-2', mockContent.id, 8);

      mockDb.recordSocialConnection.mockClear();

      agent.finalizeSession(session.id);

      expect(mockDb.recordSocialConnection).toHaveBeenCalled();
    });
  });

  describe('Session Management', () => {
    it('should retrieve session by ID', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.searchByEmbedding.mockResolvedValue([]);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));

      const session = await agent.createSession('group-123', 'user-1', ['user-2']);

      const retrieved = agent.getSession(session.id);

      expect(retrieved).toEqual(session);
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = agent.getSession('fake-session');

      expect(retrieved).toBeUndefined();
    });

    it('should get user sessions', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.searchByEmbedding.mockResolvedValue([]);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));

      await agent.createSession('group-1', 'user-1', ['user-2']);
      await agent.createSession('group-2', 'user-2', ['user-1']);

      const userSessions = agent.getUserSessions('user-1');

      expect(userSessions.length).toBeGreaterThan(0);
    });
  });

  describe('Social Affinity', () => {
    it('should calculate affinity between users', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);

      const affinity = await agent.calculateAffinity('user-1', 'user-2');

      expect(affinity).toBeGreaterThanOrEqual(0);
      expect(affinity).toBeLessThanOrEqual(1);
    });

    it('should return neutral affinity for users without preferences', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(null);

      const affinity = await agent.calculateAffinity('user-1', 'user-2');

      expect(affinity).toBe(0.5);
    });

    it('should find similar users', async () => {
      const similarUsers = await agent.findSimilarUsers('user-1', 5);

      expect(Array.isArray(similarUsers)).toBe(true);
    });
  });

  describe('Group Score Calculation', () => {
    it('should calculate detailed group score', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.searchById.mockResolvedValue(mockContent);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.6));

      const scoreResult = await agent.calculateContentGroupScore(123, ['user-1', 'user-2']);

      expect(scoreResult).toBeDefined();
      expect(scoreResult?.groupScore).toBeDefined();
      expect(scoreResult?.memberScores).toBeDefined();
      expect(scoreResult?.minSatisfaction).toBeDefined();
    });

    it('should return null for non-existent content', async () => {
      mockVector.searchById.mockResolvedValue(null);

      const scoreResult = await agent.calculateContentGroupScore(999, ['user-1']);

      expect(scoreResult).toBeNull();
    });
  });

  describe('Explanations', () => {
    it('should generate explanation for group recommendation', () => {
      const candidate = {
        content: mockContent,
        embedding: new Float32Array(768).fill(0.6),
        groupScore: 0.85,
        fairnessScore: 0.9,
        memberScores: { 'user-1': 0.9, 'user-2': 0.8 },
        votes: {},
      };

      const explanation = agent.getExplanation(candidate);

      expect(typeof explanation).toBe('string');
      expect(explanation.length).toBeGreaterThan(0);
    });
  });

  describe('Session Cleanup', () => {
    it('should cleanup expired sessions', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.searchByEmbedding.mockResolvedValue([]);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));

      await agent.createSession('group-1', 'user-1', ['user-2']);

      vi.useFakeTimers();
      vi.advanceTimersByTime(25 * 60 * 60 * 1000); // 25 hours

      const cleaned = agent.cleanupSessions(24 * 60 * 60 * 1000);

      expect(cleaned).toBe(1);

      vi.useRealTimers();
    });

    it('should not cleanup recent sessions', async () => {
      mockDb.getPreferencePattern.mockResolvedValue(mockPreferences);
      mockVector.searchByEmbedding.mockResolvedValue([]);
      mockVector.generateEmbedding.mockResolvedValue(new Float32Array(768).fill(0.5));

      await agent.createSession('group-1', 'user-1', ['user-2']);

      const cleaned = agent.cleanupSessions(24 * 60 * 60 * 1000);

      expect(cleaned).toBe(0);
    });
  });

  describe('Factory Function', () => {
    it('should create agent with factory function', () => {
      const newAgent = createSocialAgent(mockDb, mockVector);

      expect(newAgent).toBeInstanceOf(SocialAgent);
    });
  });
});

/**
 * Social Agent
 * Handles group recommendations and social features
 * Core component of the network effects moat
 */

import type {
  Group,
  GroupSession,
  GroupCandidate,
  MediaContent,
  RecommendationContext,
  UserPreferences,
} from '@media-gateway/core';
import {
  calculateGroupCentroid,
  rankGroupCandidates,
  applyContextBoosts,
  processVotes,
  generateGroupExplanation,
} from '@media-gateway/core';

/**
 * Member profile with preferences and weight
 */
interface MemberProfile {
  userId: string;
  preferences: UserPreferences;
  weight: number;
}

/**
 * Social Agent class
 * Manages group sessions and social recommendations
 */
export class SocialAgent {
  private activeSessions: Map<string, GroupSession> = new Map();
  private dbWrapper: any;
  private vectorWrapper: any;

  constructor(dbWrapper: any, vectorWrapper: any) {
    this.dbWrapper = dbWrapper;
    this.vectorWrapper = vectorWrapper;
  }

  /**
   * Create a new group session
   */
  async createSession(
    groupId: string,
    initiatorId: string,
    memberIds: string[],
    context?: RecommendationContext
  ): Promise<GroupSession> {
    const session: GroupSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      groupId,
      status: 'voting',
      initiatorId,
      context: context ?? {},
      candidates: [],
      createdAt: new Date(),
    };

    // Generate recommendations for the group
    const candidates = await this.generateGroupCandidates(memberIds, context);
    session.candidates = candidates;

    this.activeSessions.set(session.id, session);
    return session;
  }

  /**
   * Generate group recommendation candidates
   */
  private async generateGroupCandidates(
    memberIds: string[],
    context?: RecommendationContext
  ): Promise<GroupCandidate[]> {
    // Get member profiles
    const memberProfiles: MemberProfile[] = [];

    for (const memberId of memberIds) {
      const preferences = await this.dbWrapper.getPreferencePattern(memberId);
      memberProfiles.push({
        userId: memberId,
        preferences: preferences ?? {
          vector: null,
          confidence: 0,
          genreAffinities: {},
          moodMappings: [],
          temporalPatterns: [],
          updatedAt: new Date(),
        },
        weight: 1.0, // Equal weight for all members
      });
    }

    // Calculate group centroid
    const centroid = calculateGroupCentroid(memberProfiles);

    if (!centroid) {
      // If no preferences, return popular content
      return [];
    }

    // Search for content near centroid
    const searchResults = await this.vectorWrapper.searchByEmbedding(
      centroid,
      100,
      0.3
    );

    // Create candidates with embeddings
    const candidatesWithEmbeddings = await Promise.all(
      searchResults.map(async (result: { content: MediaContent; score: number }) => {
        const contentText = `${result.content.title} ${result.content.overview}`;
        const embedding = await this.vectorWrapper.generateEmbedding(contentText);
        return {
          content: result.content,
          embedding: embedding ?? new Float32Array(768),
        };
      })
    );

    // Rank candidates for group satisfaction
    let candidates = rankGroupCandidates(
      candidatesWithEmbeddings,
      memberProfiles,
      0.6 // Fairness threshold
    );

    // Apply context boosts if provided
    if (context) {
      candidates = applyContextBoosts(candidates, context);
    }

    return candidates.slice(0, 20); // Return top 20
  }

  /**
   * Submit a vote for a candidate
   */
  submitVote(
    sessionId: string,
    userId: string,
    contentId: number,
    score: number
  ): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'voting') {
      return false;
    }

    const candidate = session.candidates.find(
      c => c.content.id === contentId
    );

    if (!candidate) {
      return false;
    }

    candidate.votes[userId] = Math.min(Math.max(score, 0), 10);
    return true;
  }

  /**
   * Finalize session and pick winner
   */
  finalizeSession(sessionId: string): GroupCandidate | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Create votes map from all candidates
    const allVotes: Record<string, Record<number, number>> = {};

    for (const candidate of session.candidates) {
      for (const [userId, vote] of Object.entries(candidate.votes)) {
        if (!allVotes[userId]) {
          allVotes[userId] = {};
        }
        allVotes[userId]![candidate.content.id] = vote;
      }
    }

    const winner = processVotes(session.candidates, allVotes);

    if (winner) {
      session.selectedContentId = winner.content.id;
      session.status = 'decided';
      session.decidedAt = new Date();
    }

    return winner;
  }

  /**
   * Get session status
   */
  getSession(sessionId: string): GroupSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get active sessions for a user
   */
  getUserSessions(userId: string): GroupSession[] {
    return Array.from(this.activeSessions.values()).filter(
      session =>
        session.initiatorId === userId ||
        session.candidates.some(c =>
          Object.keys(c.votes).includes(userId)
        )
    );
  }

  /**
   * Calculate social affinity between two users
   */
  async calculateAffinity(
    userId1: string,
    userId2: string
  ): Promise<number> {
    const prefs1 = await this.dbWrapper.getPreferencePattern(userId1);
    const prefs2 = await this.dbWrapper.getPreferencePattern(userId2);

    if (!prefs1?.vector || !prefs2?.vector) {
      return 0.5; // Neutral affinity
    }

    // Calculate cosine similarity between preference vectors
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < prefs1.vector.length; i++) {
      dotProduct += prefs1.vector[i]! * prefs2.vector[i]!;
      magnitude1 += prefs1.vector[i]! * prefs1.vector[i]!;
      magnitude2 += prefs2.vector[i]! * prefs2.vector[i]!;
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0.5;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Find users with similar taste
   */
  async findSimilarUsers(
    userId: string,
    limit: number = 10
  ): Promise<Array<{ userId: string; affinity: number }>> {
    // This would query a social graph in production
    // For now, return empty array
    return [];
  }

  /**
   * Get explanation for group recommendation
   */
  getExplanation(candidate: GroupCandidate): string {
    return generateGroupExplanation(candidate);
  }

  /**
   * Cleanup expired sessions
   */
  cleanupSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.activeSessions) {
      if (now - session.createdAt.getTime() > maxAgeMs) {
        this.activeSessions.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}

/**
 * Create a new Social Agent instance
 */
export function createSocialAgent(
  dbWrapper: any,
  vectorWrapper: any
): SocialAgent {
  return new SocialAgent(dbWrapper, vectorWrapper);
}

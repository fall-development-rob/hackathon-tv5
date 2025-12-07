/**
 * Social Domain Layer
 *
 * Domain entities and value objects for social features including friends, groups, and recommendations.
 * Handles social networking and group watch functionality.
 */

import type {
  Group,
  GroupSession,
  GroupCandidate,
  RecommendationContext,
  MediaContent,
} from '../../types/index.js';

// Re-export social-related types from existing types
export type {
  Group,
  GroupSession,
  GroupCandidate,
  RecommendationContext,
} from '../../types/index.js';

/**
 * Friend Entity
 * Represents a friendship connection between users
 */
export class Friend {
  constructor(
    public readonly userId: string,
    public readonly friendId: string,
    public readonly displayName: string,
    public readonly avatarUrl: string | undefined,
    public readonly connectedAt: Date,
    public readonly lastInteraction: Date
  ) {}

  /**
   * Check if friend is recently active (within 24 hours)
   */
  isRecentlyActive(): boolean {
    const hoursSinceInteraction = Math.floor(
      (Date.now() - this.lastInteraction.getTime()) / (1000 * 60 * 60)
    );
    return hoursSinceInteraction <= 24;
  }

  /**
   * Get friendship duration in days
   */
  getFriendshipDuration(): number {
    return Math.floor(
      (Date.now() - this.connectedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  /**
   * Check if new friendship (less than 30 days)
   */
  isNewFriendship(): boolean {
    return this.getFriendshipDuration() <= 30;
  }
}

/**
 * Group Entity
 * Represents a group of users for collaborative watching
 */
export class GroupEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly creatorId: string,
    private memberIds: string[],
    public readonly createdAt: Date,
    public readonly lastActiveAt: Date,
    public readonly description?: string,
    public readonly avatarUrl?: string
  ) {}

  /**
   * Get all member IDs
   */
  getMemberIds(): string[] {
    return [...this.memberIds];
  }

  /**
   * Get member count
   */
  getMemberCount(): number {
    return this.memberIds.length;
  }

  /**
   * Check if user is a member
   */
  hasMember(userId: string): boolean {
    return this.memberIds.includes(userId);
  }

  /**
   * Check if user is the creator
   */
  isCreator(userId: string): boolean {
    return this.creatorId === userId;
  }

  /**
   * Add member to group
   */
  addMember(userId: string): GroupEntity {
    if (this.hasMember(userId)) return this;

    return new GroupEntity(
      this.id,
      this.name,
      this.creatorId,
      [...this.memberIds, userId],
      this.createdAt,
      new Date(),
      this.description,
      this.avatarUrl
    );
  }

  /**
   * Remove member from group
   */
  removeMember(userId: string): GroupEntity {
    if (!this.hasMember(userId)) return this;
    if (this.isCreator(userId)) {
      throw new Error('Cannot remove group creator');
    }

    return new GroupEntity(
      this.id,
      this.name,
      this.creatorId,
      this.memberIds.filter(id => id !== userId),
      this.createdAt,
      new Date(),
      this.description,
      this.avatarUrl
    );
  }

  /**
   * Check if group is active (activity within 7 days)
   */
  isActive(): boolean {
    const daysSinceActive = Math.floor(
      (Date.now() - this.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceActive <= 7;
  }

  /**
   * Check if group is small (2-5 members)
   */
  isSmallGroup(): boolean {
    return this.memberIds.length >= 2 && this.memberIds.length <= 5;
  }

  /**
   * Check if group is large (more than 10 members)
   */
  isLargeGroup(): boolean {
    return this.memberIds.length > 10;
  }
}

/**
 * Group Session Entity
 * Represents a collaborative watch session
 */
export class GroupSessionEntity {
  constructor(
    public readonly id: string,
    public readonly groupId: string,
    public readonly status: 'voting' | 'decided' | 'watching' | 'completed',
    public readonly initiatorId: string,
    public readonly context: RecommendationContext,
    private candidates: GroupCandidate[],
    public readonly selectedContentId: number | undefined,
    public readonly createdAt: Date,
    public readonly decidedAt: Date | undefined
  ) {}

  /**
   * Get all candidates
   */
  getCandidates(): GroupCandidate[] {
    return [...this.candidates];
  }

  /**
   * Get top candidate by group score
   */
  getTopCandidate(): GroupCandidate | null {
    if (this.candidates.length === 0) return null;
    return this.candidates.reduce((top, candidate) =>
      candidate.groupScore > top.groupScore ? candidate : top
    );
  }

  /**
   * Add vote for candidate
   */
  addVote(contentId: number, userId: string, score: number): GroupSessionEntity {
    const updatedCandidates = this.candidates.map(candidate => {
      if (candidate.content.id === contentId) {
        return {
          ...candidate,
          votes: { ...candidate.votes, [userId]: score }
        };
      }
      return candidate;
    });

    return new GroupSessionEntity(
      this.id,
      this.groupId,
      this.status,
      this.initiatorId,
      this.context,
      updatedCandidates,
      this.selectedContentId,
      this.createdAt,
      this.decidedAt
    );
  }

  /**
   * Get vote count for a candidate
   */
  getVoteCount(contentId: number): number {
    const candidate = this.candidates.find(c => c.content.id === contentId);
    return candidate ? Object.keys(candidate.votes).length : 0;
  }

  /**
   * Check if all users have voted
   */
  hasAllVoted(memberCount: number): boolean {
    return this.candidates.some(
      candidate => Object.keys(candidate.votes).length === memberCount
    );
  }

  /**
   * Decide on content
   */
  decide(contentId: number): GroupSessionEntity {
    if (this.status !== 'voting') {
      throw new Error('Can only decide during voting phase');
    }

    return new GroupSessionEntity(
      this.id,
      this.groupId,
      'decided',
      this.initiatorId,
      this.context,
      this.candidates,
      contentId,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Start watching
   */
  startWatching(): GroupSessionEntity {
    if (this.status !== 'decided') {
      throw new Error('Must decide on content before watching');
    }

    return new GroupSessionEntity(
      this.id,
      this.groupId,
      'watching',
      this.initiatorId,
      this.context,
      this.candidates,
      this.selectedContentId,
      this.createdAt,
      this.decidedAt
    );
  }

  /**
   * Complete session
   */
  complete(): GroupSessionEntity {
    if (this.status !== 'watching') {
      throw new Error('Can only complete while watching');
    }

    return new GroupSessionEntity(
      this.id,
      this.groupId,
      'completed',
      this.initiatorId,
      this.context,
      this.candidates,
      this.selectedContentId,
      this.createdAt,
      this.decidedAt
    );
  }

  /**
   * Get session duration in minutes
   */
  getSessionDuration(): number | null {
    if (!this.decidedAt) return null;
    return Math.floor(
      (this.decidedAt.getTime() - this.createdAt.getTime()) / (1000 * 60)
    );
  }

  /**
   * Check if session is stale (voting for more than 24 hours)
   */
  isStale(): boolean {
    if (this.status !== 'voting') return false;
    const hoursSinceCreation = Math.floor(
      (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60)
    );
    return hoursSinceCreation >= 24;
  }
}

/**
 * Recommendation Value Object
 * Represents a personalized recommendation for a user or group
 */
export class RecommendationEntity {
  constructor(
    public readonly contentId: number,
    public readonly score: number,
    public readonly reason: string,
    public readonly sources: string[],
    public readonly generatedAt: Date
  ) {}

  /**
   * Check if recommendation is highly relevant (score >= 0.8)
   */
  isHighlyRelevant(): boolean {
    return this.score >= 0.8;
  }

  /**
   * Check if recommendation is fresh (generated within 1 hour)
   */
  isFresh(): boolean {
    const hoursSinceGeneration = Math.floor(
      (Date.now() - this.generatedAt.getTime()) / (1000 * 60 * 60)
    );
    return hoursSinceGeneration < 1;
  }

  /**
   * Get normalized score (0-100)
   */
  getNormalizedScore(): number {
    return Math.round(this.score * 100);
  }
}

/**
 * Group Compatibility Value Object
 * Calculates compatibility between group members for content selection
 */
export class GroupCompatibility {
  constructor(
    public readonly memberPreferenceSimilarities: Map<string, Map<string, number>>,
    public readonly averageCompatibility: number
  ) {}

  /**
   * Get compatibility between two members
   */
  getCompatibility(userId1: string, userId2: string): number | undefined {
    return this.memberPreferenceSimilarities.get(userId1)?.get(userId2);
  }

  /**
   * Check if group has high compatibility (>= 0.7)
   */
  hasHighCompatibility(): boolean {
    return this.averageCompatibility >= 0.7;
  }

  /**
   * Get most compatible pair
   */
  getMostCompatiblePair(): { user1: string; user2: string; score: number } | null {
    let maxCompatibility = -1;
    let bestPair: { user1: string; user2: string; score: number } | null = null;

    for (const [user1, similarities] of this.memberPreferenceSimilarities) {
      for (const [user2, score] of similarities) {
        if (score > maxCompatibility) {
          maxCompatibility = score;
          bestPair = { user1, user2, score };
        }
      }
    }

    return bestPair;
  }

  /**
   * Get least compatible pair
   */
  getLeastCompatiblePair(): { user1: string; user2: string; score: number } | null {
    let minCompatibility = Infinity;
    let worstPair: { user1: string; user2: string; score: number } | null = null;

    for (const [user1, similarities] of this.memberPreferenceSimilarities) {
      for (const [user2, score] of similarities) {
        if (score < minCompatibility) {
          minCompatibility = score;
          worstPair = { user1, user2, score };
        }
      }
    }

    return worstPair;
  }
}

/**
 * Create Group Session Use Case
 *
 * Handles creation and management of group watch sessions:
 * - Initialize voting session
 * - Generate group-optimized candidates
 * - Manage voting process
 * - Select content based on group preferences
 */

import type {
  GroupSession,
  GroupCandidate,
  RecommendationContext,
  MediaContent,
  UserPreferences,
} from '../../types/index.js';

/**
 * Group Repository Interface
 */
export interface IGroupRepository {
  getById(groupId: string): Promise<{
    id: string;
    name: string;
    memberIds: string[];
  } | null>;
}

/**
 * Group Session Repository Interface
 */
export interface IGroupSessionRepository {
  save(session: GroupSession): Promise<void>;
  getById(sessionId: string): Promise<GroupSession | null>;
}

/**
 * Group Recommendation Engine Interface
 */
export interface IGroupRecommendationEngine {
  generateGroupCandidates(
    memberPreferences: UserPreferences[],
    context: RecommendationContext,
    limit: number
  ): Promise<GroupCandidate[]>;
}

/**
 * User Preferences Repository Interface
 */
export interface IUserPreferencesRepository {
  getByIds(userIds: string[]): Promise<UserPreferences[]>;
}

/**
 * Create Group Session Request
 */
export interface CreateGroupSessionRequest {
  groupId: string;
  initiatorId: string;
  context?: RecommendationContext;
  candidateCount?: number;
}

/**
 * Create Group Session Result
 */
export interface CreateGroupSessionResult {
  session: GroupSession;
  candidatesGenerated: number;
  groupSize: number;
  executionTime: number;
}

/**
 * Create Group Session Use Case
 *
 * Orchestrates group watch session creation:
 * 1. Validate group and initiator
 * 2. Load member preferences
 * 3. Generate group-optimized candidates
 * 4. Initialize voting session
 * 5. Return session ready for voting
 */
export class CreateGroupSession {
  private readonly DEFAULT_CANDIDATE_COUNT = 10;

  constructor(
    private readonly groupRepository: IGroupRepository,
    private readonly sessionRepository: IGroupSessionRepository,
    private readonly groupRecommendationEngine: IGroupRecommendationEngine,
    private readonly preferencesRepository: IUserPreferencesRepository
  ) {}

  /**
   * Execute create group session use case
   *
   * @param request - Group session creation request
   * @returns Created session ready for voting
   * @throws Error if group not found or session creation fails
   */
  async execute(
    request: CreateGroupSessionRequest
  ): Promise<CreateGroupSessionResult> {
    const startTime = Date.now();

    try {
      // Step 1: Validate and load group
      const group = await this.loadAndValidateGroup(
        request.groupId,
        request.initiatorId
      );

      // Step 2: Load member preferences
      const memberPreferences = await this.loadMemberPreferences(group.memberIds);

      // Step 3: Generate group-optimized candidates
      const candidateCount = request.candidateCount ?? this.DEFAULT_CANDIDATE_COUNT;
      const candidates = await this.generateCandidates(
        memberPreferences,
        request.context ?? {},
        candidateCount
      );

      // Step 4: Create session
      const session = this.createSession(
        request.groupId,
        request.initiatorId,
        request.context ?? {},
        candidates
      );

      // Step 5: Save session
      await this.sessionRepository.save(session);

      const executionTime = Date.now() - startTime;

      return {
        session,
        candidatesGenerated: candidates.length,
        groupSize: group.memberIds.length,
        executionTime,
      };
    } catch (error) {
      throw new Error(
        `Failed to create group session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load and validate group
   */
  private async loadAndValidateGroup(
    groupId: string,
    initiatorId: string
  ): Promise<{ id: string; name: string; memberIds: string[] }> {
    const group = await this.groupRepository.getById(groupId);

    if (!group) {
      throw new Error(`Group not found: ${groupId}`);
    }

    if (!group.memberIds.includes(initiatorId)) {
      throw new Error(`Initiator ${initiatorId} is not a member of group ${groupId}`);
    }

    if (group.memberIds.length < 2) {
      throw new Error('Group must have at least 2 members');
    }

    return group;
  }

  /**
   * Load preferences for all group members
   */
  private async loadMemberPreferences(
    memberIds: string[]
  ): Promise<UserPreferences[]> {
    const preferences = await this.preferencesRepository.getByIds(memberIds);

    if (preferences.length === 0) {
      throw new Error('No preferences found for group members');
    }

    return preferences;
  }

  /**
   * Generate group-optimized candidates
   */
  private async generateCandidates(
    memberPreferences: UserPreferences[],
    context: RecommendationContext,
    count: number
  ): Promise<GroupCandidate[]> {
    const candidates = await this.groupRecommendationEngine.generateGroupCandidates(
      memberPreferences,
      context,
      count
    );

    if (candidates.length === 0) {
      throw new Error('No suitable candidates found for group');
    }

    return candidates;
  }

  /**
   * Create session object
   */
  private createSession(
    groupId: string,
    initiatorId: string,
    context: RecommendationContext,
    candidates: GroupCandidate[]
  ): GroupSession {
    const session: GroupSession = {
      id: this.generateSessionId(),
      groupId,
      status: 'voting',
      initiatorId,
      context,
      candidates,
      createdAt: new Date(),
    };
    return session;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Vote on candidate
   * Allows members to vote during voting phase
   */
  async vote(
    sessionId: string,
    userId: string,
    contentId: number,
    score: number
  ): Promise<GroupSession> {
    // Step 1: Load session
    const session = await this.sessionRepository.getById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Step 2: Validate voting state
    if (session.status !== 'voting') {
      throw new Error('Session is not in voting state');
    }

    // Step 3: Validate score
    if (score < 0 || score > 10) {
      throw new Error('Score must be between 0 and 10');
    }

    // Step 4: Update votes
    const updatedCandidates = session.candidates.map(candidate => {
      if (candidate.content.id === contentId) {
        return {
          ...candidate,
          votes: {
            ...candidate.votes,
            [userId]: score,
          },
        };
      }
      return candidate;
    });

    const updatedSession = {
      ...session,
      candidates: updatedCandidates,
    };

    // Step 5: Save updated session
    await this.sessionRepository.save(updatedSession);

    return updatedSession;
  }

  /**
   * Finalize session
   * Select content based on votes and move to decided state
   */
  async finalize(sessionId: string): Promise<GroupSession> {
    // Step 1: Load session
    const session = await this.sessionRepository.getById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Step 2: Validate state
    if (session.status !== 'voting') {
      throw new Error('Can only finalize session in voting state');
    }

    // Step 3: Calculate winner
    const winner = this.selectWinner(session.candidates);
    if (!winner) {
      throw new Error('No valid winner found');
    }

    // Step 4: Update session
    const finalizedSession: GroupSession = {
      ...session,
      status: 'decided',
      selectedContentId: winner.content.id,
      decidedAt: new Date(),
    };

    // Step 5: Save finalized session
    await this.sessionRepository.save(finalizedSession);

    return finalizedSession;
  }

  /**
   * Select winner from candidates based on votes
   */
  private selectWinner(candidates: GroupCandidate[]): GroupCandidate | null {
    if (candidates.length === 0) return null;

    // Calculate average vote for each candidate
    const candidatesWithScores = candidates.map(candidate => {
      const votes = Object.values(candidate.votes);
      const avgVote = votes.length > 0
        ? votes.reduce((sum, v) => sum + v, 0) / votes.length
        : 0;

      // Combine vote score with group score and fairness
      const finalScore =
        avgVote * 0.5 +
        candidate.groupScore * 0.3 +
        candidate.fairnessScore * 0.2;

      return {
        candidate,
        score: finalScore,
      };
    });

    // Sort by final score
    candidatesWithScores.sort((a, b) => b.score - a.score);

    const winner = candidatesWithScores[0];
    return winner ? winner.candidate : null;
  }

  /**
   * Cancel session
   * Move session to completed state without selection
   */
  async cancel(sessionId: string): Promise<GroupSession> {
    const session = await this.sessionRepository.getById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const canceledSession: GroupSession = {
      ...session,
      status: 'completed',
    };

    await this.sessionRepository.save(canceledSession);

    return canceledSession;
  }
}

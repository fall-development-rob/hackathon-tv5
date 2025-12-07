/**
 * Group Recommendation Service
 * Aggregates preferences for group decision-making
 * Key component of the social network effects moat
 */

import type {
  MediaContent,
  UserPreferences,
  GroupCandidate,
  RecommendationContext,
} from '../types/index.js';
import { cosineSimilarity } from './SemanticSearchService.js';

/**
 * Member preference profile for group aggregation
 */
interface MemberProfile {
  userId: string;
  preferences: UserPreferences;
  weight: number; // Influence weight in group decision
}

/**
 * Calculate centroid of member preference vectors
 * This represents the "center" of the group's collective taste
 */
export function calculateGroupCentroid(
  members: MemberProfile[]
): Float32Array | null {
  const vectorMembers = members.filter(m => m.preferences.vector !== null);

  if (vectorMembers.length === 0) {
    return null;
  }

  const dimensions = vectorMembers[0]!.preferences.vector!.length;
  const centroid = new Float32Array(dimensions);

  // Weighted average of all member vectors
  let totalWeight = 0;
  for (const member of vectorMembers) {
    const weight = member.weight * member.preferences.confidence;
    totalWeight += weight;

    for (let i = 0; i < dimensions; i++) {
      const vectorValue = member.preferences.vector![i];
      if (vectorValue !== undefined && centroid[i] !== undefined) {
        centroid[i]! += vectorValue * weight;
      }
    }
  }

  // Normalize
  if (totalWeight > 0) {
    for (let i = 0; i < dimensions; i++) {
      const value = centroid[i];
      if (value !== undefined) {
        centroid[i] = value / totalWeight;
      }
    }
  }

  // Unit normalize the result
  let magnitude = 0;
  for (let i = 0; i < dimensions; i++) {
    const value = centroid[i];
    if (value !== undefined) {
      magnitude += value * value;
    }
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude > 0) {
    for (let i = 0; i < dimensions; i++) {
      const value = centroid[i];
      if (value !== undefined) {
        centroid[i] = value / magnitude;
      }
    }
  }

  return centroid;
}

/**
 * Calculate satisfaction score for a member given content
 */
export function calculateMemberSatisfaction(
  contentEmbedding: Float32Array,
  memberPreferences: UserPreferences
): number {
  if (!memberPreferences.vector) {
    return 0.5; // Neutral for members without preferences
  }

  return cosineSimilarity(contentEmbedding, memberPreferences.vector);
}

/**
 * Calculate group score for a piece of content
 * Uses maximin fairness: maximize the minimum satisfaction
 */
export function calculateGroupScore(
  contentEmbedding: Float32Array,
  members: MemberProfile[]
): { groupScore: number; memberScores: Record<string, number>; minSatisfaction: number } {
  const memberScores: Record<string, number> = {};
  let minSatisfaction = 1.0;
  let totalSatisfaction = 0;

  for (const member of members) {
    const satisfaction = calculateMemberSatisfaction(
      contentEmbedding,
      member.preferences
    );
    memberScores[member.userId] = satisfaction;
    minSatisfaction = Math.min(minSatisfaction, satisfaction);
    totalSatisfaction += satisfaction * member.weight;
  }

  // Group score combines minimum satisfaction (fairness) with average (efficiency)
  const avgSatisfaction = totalSatisfaction / members.reduce((sum, m) => sum + m.weight, 0);
  const groupScore = 0.6 * minSatisfaction + 0.4 * avgSatisfaction;

  return { groupScore, memberScores, minSatisfaction };
}

/**
 * Calculate fairness score using Gini coefficient
 * 0 = perfectly fair, 1 = completely unfair
 */
export function calculateFairnessScore(memberScores: Record<string, number>): number {
  const scores = Object.values(memberScores);
  const n = scores.length;

  if (n <= 1) return 1.0;

  // Calculate Gini coefficient
  scores.sort((a, b) => a - b);

  let sumDifferences = 0;
  let sumScores = 0;

  for (let i = 0; i < n; i++) {
    sumScores += scores[i]!;
    for (let j = 0; j < n; j++) {
      sumDifferences += Math.abs(scores[i]! - scores[j]!);
    }
  }

  if (sumScores === 0) return 0;

  const gini = sumDifferences / (2 * n * sumScores);

  // Convert to fairness score (1 = fair, 0 = unfair)
  return 1 - gini;
}

/**
 * Score and rank candidates for group recommendation
 */
export function rankGroupCandidates(
  candidates: Array<{
    content: MediaContent;
    embedding: Float32Array;
  }>,
  members: MemberProfile[],
  fairnessThreshold: number = 0.6
): GroupCandidate[] {
  const scored: GroupCandidate[] = [];

  for (const candidate of candidates) {
    const { groupScore, memberScores, minSatisfaction } = calculateGroupScore(
      candidate.embedding,
      members
    );

    const fairnessScore = calculateFairnessScore(memberScores);

    // Filter out candidates below fairness threshold
    if (fairnessScore < fairnessThreshold) {
      continue;
    }

    scored.push({
      content: candidate.content,
      groupScore,
      memberScores,
      fairnessScore,
      votes: {}, // Will be populated during voting phase
    });
  }

  // Sort by group score (which already incorporates fairness)
  return scored.sort((a, b) => b.groupScore - a.groupScore);
}

/**
 * Apply context-based boosts to group candidates
 */
export function applyContextBoosts(
  candidates: GroupCandidate[],
  context: RecommendationContext
): GroupCandidate[] {
  return candidates.map(candidate => {
    let boost = 1.0;

    // Time-based boost (prefer content matching available time)
    if (context.availableTime) {
      const runtime = (candidate.content as any).runtime ?? 120;
      const timeFit = 1 - Math.abs(runtime - context.availableTime) / context.availableTime;
      boost *= 1 + Math.max(0, timeFit) * 0.2;
    }

    // Occasion-based boost would require genre/mood mapping
    // Simplified here - in production would use LLM

    return {
      ...candidate,
      groupScore: candidate.groupScore * boost,
    };
  }).sort((a, b) => b.groupScore - a.groupScore);
}

/**
 * Process votes and determine winner
 */
export function processVotes(
  candidates: GroupCandidate[],
  votes: Record<string, Record<number, number>> // userId -> contentId -> score
): GroupCandidate | null {
  if (candidates.length === 0) return null;

  // Aggregate votes into candidates
  for (const candidate of candidates) {
    for (const [userId, contentVotes] of Object.entries(votes)) {
      const vote = contentVotes[candidate.content.id];
      if (vote !== undefined) {
        candidate.votes[userId] = vote;
      }
    }
  }

  // Find candidate with highest vote score
  let winner = candidates[0]!;
  let highestScore = calculateVoteScore(winner);

  for (let i = 1; i < candidates.length; i++) {
    const score = calculateVoteScore(candidates[i]!);
    if (score > highestScore) {
      highestScore = score;
      winner = candidates[i]!;
    }
  }

  return winner;
}

/**
 * Calculate vote score for a candidate
 */
function calculateVoteScore(candidate: GroupCandidate): number {
  const votes = Object.values(candidate.votes);
  if (votes.length === 0) {
    return candidate.groupScore; // Fall back to algorithm score
  }

  const avgVote = votes.reduce((sum, v) => sum + v, 0) / votes.length;

  // Combine algorithm score with vote score
  return 0.3 * candidate.groupScore + 0.7 * (avgVote / 10);
}

/**
 * Generate explanation for group recommendation
 */
export function generateGroupExplanation(candidate: GroupCandidate): string {
  const satisfactionLevels = Object.values(candidate.memberScores);
  const avgSatisfaction = satisfactionLevels.reduce((a, b) => a + b, 0) / satisfactionLevels.length;

  if (candidate.fairnessScore > 0.9) {
    return 'Everyone in the group will enjoy this equally';
  } else if (avgSatisfaction > 0.7) {
    return 'Great match for most group members';
  } else if (candidate.fairnessScore > 0.7) {
    return 'Fair compromise that works for everyone';
  } else {
    return 'Balanced choice for the group';
  }
}

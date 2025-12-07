/**
 * User Preference Service
 * Core service for learning and managing user preferences
 * This is a key component of the 20-year data moat strategy
 */

import type {
  WatchEvent,
  UserPreferences,
  MoodMapping,
  TemporalPattern,
} from '../types/index.js';

// Learning rate configuration
const DEFAULT_ALPHA = 0.3; // How much new signals affect preferences
const MIN_CONFIDENCE = 0.1;
const MAX_CONFIDENCE = 0.95;

/**
 * Calculate signal strength from a watch event
 * Higher completion rate, explicit ratings, and rewatches = stronger signal
 */
export function calculateSignalStrength(event: WatchEvent): number {
  let strength = 0;

  // Completion rate is primary signal (0-0.4)
  strength += event.completionRate * 0.4;

  // Explicit rating is strong signal (0-0.3)
  if (event.rating !== undefined) {
    strength += (event.rating / 10) * 0.3;
  } else {
    // Infer from completion if no rating
    strength += event.completionRate > 0.8 ? 0.15 : 0;
  }

  // Rewatches are strong positive signals (0-0.2)
  if (event.isRewatch) {
    strength += 0.2;
  }

  // Watch duration relative to content length (0-0.1)
  const durationRatio = Math.min(event.duration / event.totalDuration, 1);
  strength += durationRatio * 0.1;

  return Math.min(strength, 1);
}

/**
 * Calculate adaptive learning rate based on confidence and signal strength
 * Lower confidence = higher learning rate (learn faster when uncertain)
 */
export function calculateLearningRate(
  currentConfidence: number,
  signalStrength: number
): number {
  // Start with default alpha
  let alpha = DEFAULT_ALPHA;

  // Lower confidence = higher learning rate
  alpha *= 1 + (1 - currentConfidence);

  // Stronger signals get more weight
  alpha *= 0.5 + signalStrength * 0.5;

  // Clamp to reasonable range
  return Math.min(Math.max(alpha, 0.1), 0.7);
}

/**
 * Update confidence based on signal quality
 */
export function updateConfidence(
  currentConfidence: number,
  signalStrength: number
): number {
  // Strong signals increase confidence, weak signals decrease
  const delta = signalStrength > 0.5
    ? (1 - currentConfidence) * 0.1
    : -currentConfidence * 0.05;

  return Math.min(Math.max(currentConfidence + delta, MIN_CONFIDENCE), MAX_CONFIDENCE);
}

/**
 * Update preference vector using exponential moving average
 */
export function updatePreferenceVector(
  currentVector: Float32Array | null,
  newEmbedding: Float32Array,
  learningRate: number
): Float32Array {
  if (!currentVector) {
    return newEmbedding;
  }

  const result = new Float32Array(currentVector.length);
  for (let i = 0; i < result.length; i++) {
    result[i] = (1 - learningRate) * currentVector[i]! + learningRate * newEmbedding[i]!;
  }

  // Normalize the vector
  let magnitude = 0;
  for (let i = 0; i < result.length; i++) {
    magnitude += result[i]! * result[i]!;
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude > 0) {
    for (let i = 0; i < result.length; i++) {
      result[i] = result[i]! / magnitude;
    }
  }

  return result;
}

/**
 * Update genre affinities based on watch event
 */
export function updateGenreAffinities(
  current: Record<number, number>,
  genreIds: number[],
  signalStrength: number
): Record<number, number> {
  const updated = { ...current };

  for (const genreId of genreIds) {
    const currentAffinity = updated[genreId] ?? 0.5;
    // Move towards 1.0 or 0.0 based on signal
    const target = signalStrength > 0.5 ? 1.0 : 0.0;
    const delta = (target - currentAffinity) * 0.1 * signalStrength;
    updated[genreId] = Math.min(Math.max(currentAffinity + delta, 0), 1);
  }

  return updated;
}

/**
 * Update temporal patterns based on watch context
 */
export function updateTemporalPatterns(
  patterns: TemporalPattern[],
  event: WatchEvent
): TemporalPattern[] {
  const { dayOfWeek, hourOfDay } = event.context;

  // Find or create pattern for this time slot
  let pattern = patterns.find(
    p => p.dayOfWeek === dayOfWeek && p.hourOfDay === hourOfDay
  );

  if (!pattern) {
    pattern = {
      dayOfWeek,
      hourOfDay,
      preferredGenres: [],
      avgWatchDuration: 0,
    };
    patterns.push(pattern);
  }

  // Update preferred genres for this time slot
  // (simplified - in production would use more sophisticated tracking)
  pattern.avgWatchDuration = pattern.avgWatchDuration * 0.9 + event.duration * 0.1;

  return patterns;
}

/**
 * Combine query embedding with user preferences for personalized search
 */
export function combineQueryWithPreferences(
  queryEmbedding: Float32Array,
  userPreferences: UserPreferences,
  queryWeight: number = 0.7
): Float32Array {
  if (!userPreferences.vector) {
    return queryEmbedding;
  }

  const preferenceWeight = 1 - queryWeight;
  const confidenceAdjustedWeight = preferenceWeight * userPreferences.confidence;
  const adjustedQueryWeight = 1 - confidenceAdjustedWeight;

  const result = new Float32Array(queryEmbedding.length);
  for (let i = 0; i < result.length; i++) {
    result[i] =
      adjustedQueryWeight * queryEmbedding[i]! +
      confidenceAdjustedWeight * userPreferences.vector[i]!;
  }

  // Normalize
  let magnitude = 0;
  for (let i = 0; i < result.length; i++) {
    magnitude += result[i]! * result[i]!;
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude > 0) {
    for (let i = 0; i < result.length; i++) {
      result[i] = result[i]! / magnitude;
    }
  }

  return result;
}

/**
 * Create initial preferences for a new user
 */
export function createInitialPreferences(): UserPreferences {
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
 * Calculate recommendation accuracy for a user
 * Based on whether they completed recommended content
 */
export function calculateRecommendationAccuracy(
  recommendations: Array<{ contentId: number; score: number }>,
  watchEvents: WatchEvent[]
): number {
  if (recommendations.length === 0) return 0;

  let hits = 0;
  const recommendedIds = new Set(recommendations.map(r => r.contentId));

  for (const event of watchEvents) {
    if (recommendedIds.has(event.contentId) && event.completionRate > 0.7) {
      hits++;
    }
  }

  return hits / recommendations.length;
}

/**
 * Export user preferences for data portability
 */
export function exportPreferences(preferences: UserPreferences): object {
  return {
    confidence: preferences.confidence,
    genreAffinities: preferences.genreAffinities,
    moodMappings: preferences.moodMappings.map(m => ({
      mood: m.mood,
      strength: m.strength,
    })),
    temporalPatterns: preferences.temporalPatterns,
    updatedAt: preferences.updatedAt.toISOString(),
    // Note: vector is not exported for privacy (can be regenerated)
  };
}

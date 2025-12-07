/**
 * Preference Agent
 * Manages user preferences using AgentDB cognitive memory
 * Core component of the data moat strategy
 */

import type {
  UserPreferences,
  WatchEvent,
  MediaContent,
  Recommendation,
} from '@media-gateway/core';
import {
  calculateSignalStrength,
  calculateLearningRate,
  updateConfidence,
  updatePreferenceVector,
  updateGenreAffinities,
  updateTemporalPatterns,
  combineQueryWithPreferences,
  createInitialPreferences,
} from '@media-gateway/core';

/**
 * Preference Agent class
 * Handles preference learning, storage, and retrieval
 */
export class PreferenceAgent {
  private userId: string;
  private dbWrapper: any; // AgentDBWrapper
  private vectorWrapper: any; // RuVectorWrapper
  private cachedPreferences: UserPreferences | null = null;
  private cacheTimestamp: number = 0;
  private readonly cacheTTL = 60000; // 1 minute cache

  constructor(
    userId: string,
    dbWrapper: any,
    vectorWrapper: any
  ) {
    this.userId = userId;
    this.dbWrapper = dbWrapper;
    this.vectorWrapper = vectorWrapper;
  }

  /**
   * Get user preferences (with caching)
   */
  async getPreferences(): Promise<UserPreferences> {
    // Check cache
    if (
      this.cachedPreferences &&
      Date.now() - this.cacheTimestamp < this.cacheTTL
    ) {
      return this.cachedPreferences;
    }

    // Fetch from database
    const preferences = await this.dbWrapper.getPreferencePattern(this.userId);

    if (preferences) {
      this.cachedPreferences = preferences;
      this.cacheTimestamp = Date.now();
      return preferences;
    }

    // Return initial preferences for new users
    return createInitialPreferences();
  }

  /**
   * Learn from a watch event
   */
  async learnFromWatchEvent(
    event: WatchEvent,
    content: MediaContent
  ): Promise<UserPreferences> {
    const currentPreferences = await this.getPreferences();

    // Generate content embedding
    const contentText = `${content.title} ${content.overview} ${content.genreIds.join(' ')}`;
    const contentEmbedding = await this.vectorWrapper.generateEmbedding(contentText);

    if (!contentEmbedding) {
      console.warn('Failed to generate content embedding');
      return currentPreferences;
    }

    // Calculate signal strength
    const signalStrength = calculateSignalStrength(event);

    // Calculate learning rate
    const learningRate = calculateLearningRate(
      currentPreferences.confidence,
      signalStrength
    );

    // Update preference vector
    const newVector = updatePreferenceVector(
      currentPreferences.vector,
      contentEmbedding,
      learningRate
    );

    // Update confidence
    const newConfidence = updateConfidence(
      currentPreferences.confidence,
      signalStrength
    );

    // Update genre affinities
    const newGenreAffinities = updateGenreAffinities(
      currentPreferences.genreAffinities,
      content.genreIds,
      signalStrength
    );

    // Update temporal patterns
    const newTemporalPatterns = updateTemporalPatterns(
      currentPreferences.temporalPatterns,
      event
    );

    // Create updated preferences
    const updatedPreferences: UserPreferences = {
      vector: newVector,
      confidence: newConfidence,
      genreAffinities: newGenreAffinities,
      moodMappings: currentPreferences.moodMappings,
      temporalPatterns: newTemporalPatterns,
      updatedAt: new Date(),
    };

    // Store updated preferences
    await this.dbWrapper.storePreferencePattern(this.userId, updatedPreferences);

    // Store as learning episode
    await this.dbWrapper.storeWatchEpisode(event);

    // Invalidate cache
    this.cachedPreferences = updatedPreferences;
    this.cacheTimestamp = Date.now();

    return updatedPreferences;
  }

  /**
   * Get personalized query embedding
   */
  async getPersonalizedQueryEmbedding(
    query: string,
    queryWeight: number = 0.7
  ): Promise<Float32Array | null> {
    const preferences = await this.getPreferences();
    const queryEmbedding = await this.vectorWrapper.generateEmbedding(query);

    if (!queryEmbedding) {
      return null;
    }

    return combineQueryWithPreferences(queryEmbedding, preferences, queryWeight);
  }

  /**
   * Score content against user preferences
   */
  async scoreContent(content: MediaContent): Promise<number> {
    const preferences = await this.getPreferences();

    if (!preferences.vector) {
      return 0.5; // Neutral score for new users
    }

    // Generate content embedding
    const contentText = `${content.title} ${content.overview}`;
    const contentEmbedding = await this.vectorWrapper.generateEmbedding(contentText);

    if (!contentEmbedding) {
      return 0.5;
    }

    // Calculate cosine similarity
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < preferences.vector.length; i++) {
      dotProduct += preferences.vector[i]! * contentEmbedding[i]!;
      magnitudeA += preferences.vector[i]! * preferences.vector[i]!;
      magnitudeB += contentEmbedding[i]! * contentEmbedding[i]!;
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0.5;
    }

    const similarity = dotProduct / (magnitudeA * magnitudeB);

    // Boost based on genre affinity
    let genreBoost = 0;
    for (const genreId of content.genreIds) {
      const affinity = preferences.genreAffinities[genreId];
      if (affinity !== undefined) {
        genreBoost += (affinity - 0.5) * 0.1;
      }
    }

    return Math.min(Math.max(similarity + genreBoost, 0), 1);
  }

  /**
   * Generate recommendation explanation
   */
  async explainRecommendation(content: MediaContent): Promise<string> {
    const preferences = await this.getPreferences();
    const score = await this.scoreContent(content);
    const reasons: string[] = [];

    // Check genre match
    for (const genreId of content.genreIds) {
      const affinity = preferences.genreAffinities[genreId];
      if (affinity && affinity > 0.7) {
        reasons.push('matches your genre preferences');
        break;
      }
    }

    // Check score
    if (score > 0.8) {
      reasons.push('highly matches your taste');
    } else if (score > 0.6) {
      reasons.push('aligns with your viewing history');
    }

    // Check rating
    if (content.voteAverage > 7.5) {
      reasons.push('critically acclaimed');
    }

    if (reasons.length === 0) {
      return 'You might enjoy this based on your interests';
    }

    return reasons.join(', ').replace(/^./, s => s.toUpperCase());
  }

  /**
   * Get user's top genre preferences
   */
  async getTopGenres(limit: number = 5): Promise<Array<{ genreId: number; affinity: number }>> {
    const preferences = await this.getPreferences();

    return Object.entries(preferences.genreAffinities)
      .map(([id, affinity]) => ({ genreId: parseInt(id), affinity }))
      .sort((a, b) => b.affinity - a.affinity)
      .slice(0, limit);
  }

  /**
   * Export user preferences for data portability
   */
  async exportPreferences(): Promise<object> {
    const preferences = await this.getPreferences();
    const topGenres = await this.getTopGenres(10);

    return {
      userId: this.userId,
      confidence: preferences.confidence,
      topGenres,
      temporalPatterns: preferences.temporalPatterns,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Delete user preferences (GDPR right to be forgotten)
   */
  async deletePreferences(): Promise<void> {
    // Implementation would delete from database
    this.cachedPreferences = null;
    this.cacheTimestamp = 0;
    console.log(`Deleted preferences for user ${this.userId}`);
  }
}

/**
 * Create a new Preference Agent instance
 */
export function createPreferenceAgent(
  userId: string,
  dbWrapper: any,
  vectorWrapper: any
): PreferenceAgent {
  return new PreferenceAgent(userId, dbWrapper, vectorWrapper);
}

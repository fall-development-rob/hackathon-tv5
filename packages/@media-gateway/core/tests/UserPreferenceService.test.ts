/**
 * User Preference Service Tests
 * Core data moat validation - preference learning algorithms
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSignalStrength,
  calculateLearningRate,
  updatePreferenceVector,
  aggregateSessionSignals,
} from '../src/services/UserPreferenceService.js';
import type { WatchEvent } from '../src/types/index.js';

describe('UserPreferenceService', () => {
  describe('calculateSignalStrength', () => {
    it('should return 1.0 for completed content', () => {
      const event: WatchEvent = {
        contentId: 1,
        userId: 'user1',
        watchDuration: 7200, // 2 hours
        totalDuration: 7200,
        completionPercentage: 100,
        timestamp: new Date(),
        context: {},
      };

      const strength = calculateSignalStrength(event);
      expect(strength).toBe(1.0);
    });

    it('should return lower signal for skipped content', () => {
      const event: WatchEvent = {
        contentId: 1,
        userId: 'user1',
        watchDuration: 300, // 5 minutes
        totalDuration: 7200,
        completionPercentage: 4.17,
        timestamp: new Date(),
        context: {},
      };

      const strength = calculateSignalStrength(event);
      expect(strength).toBeLessThan(0.5);
    });

    it('should account for watch duration minimum threshold', () => {
      const event: WatchEvent = {
        contentId: 1,
        userId: 'user1',
        watchDuration: 60, // 1 minute
        totalDuration: 7200,
        completionPercentage: 0.8,
        timestamp: new Date(),
        context: {},
      };

      const strength = calculateSignalStrength(event);
      // Very short watch should have low signal
      expect(strength).toBeLessThan(0.2);
    });
  });

  describe('calculateLearningRate', () => {
    it('should return higher rate for low confidence', () => {
      const rateNew = calculateLearningRate(0.1, 0.8);
      const rateEstablished = calculateLearningRate(0.9, 0.8);

      expect(rateNew).toBeGreaterThan(rateEstablished);
    });

    it('should scale with signal strength', () => {
      const rateWeak = calculateLearningRate(0.5, 0.2);
      const rateStrong = calculateLearningRate(0.5, 0.9);

      expect(rateStrong).toBeGreaterThan(rateWeak);
    });

    it('should stay within bounds', () => {
      const rate = calculateLearningRate(0.5, 0.8);
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThanOrEqual(1);
    });
  });

  describe('updatePreferenceVector', () => {
    it('should initialize vector from null', () => {
      const newEmbedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      const result = updatePreferenceVector(null, newEmbedding, 1.0);

      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(4);
      expect(result[0]).toBeCloseTo(0.1);
    });

    it('should blend vectors with learning rate', () => {
      const current = new Float32Array([1.0, 0.0, 0.0, 0.0]);
      const newEmbedding = new Float32Array([0.0, 1.0, 0.0, 0.0]);
      const learningRate = 0.5;

      const result = updatePreferenceVector(current, newEmbedding, learningRate);

      // Should be halfway between
      expect(result[0]).toBeCloseTo(0.5);
      expect(result[1]).toBeCloseTo(0.5);
    });

    it('should normalize the result', () => {
      const current = new Float32Array([1.0, 0.0, 0.0, 0.0]);
      const newEmbedding = new Float32Array([1.0, 1.0, 0.0, 0.0]);

      const result = updatePreferenceVector(current, newEmbedding, 0.5);

      // Calculate magnitude
      const magnitude = Math.sqrt(
        result.reduce((sum, val) => sum + val * val, 0)
      );

      expect(magnitude).toBeCloseTo(1.0, 1);
    });
  });

  describe('aggregateSessionSignals', () => {
    it('should combine multiple watch events', () => {
      const events: WatchEvent[] = [
        {
          contentId: 1,
          userId: 'user1',
          watchDuration: 7200,
          totalDuration: 7200,
          completionPercentage: 100,
          timestamp: new Date(),
          context: {},
        },
        {
          contentId: 2,
          userId: 'user1',
          watchDuration: 3600,
          totalDuration: 7200,
          completionPercentage: 50,
          timestamp: new Date(),
          context: {},
        },
      ];

      const embeddings = new Map<number, Float32Array>([
        [1, new Float32Array([1.0, 0.0, 0.0])],
        [2, new Float32Array([0.0, 1.0, 0.0])],
      ]);

      const result = aggregateSessionSignals(events, embeddings);

      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(3);
      // Completed content should have more weight
      expect(result[0]).toBeGreaterThan(result[1]);
    });

    it('should handle empty events', () => {
      const result = aggregateSessionSignals([], new Map());
      expect(result).toBeNull();
    });
  });
});

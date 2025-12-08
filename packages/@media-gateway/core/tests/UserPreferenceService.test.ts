/**
 * User Preference Service Tests
 * Core data moat validation - preference learning algorithms
 */

import { describe, it, expect } from "vitest";
import {
  calculateSignalStrength,
  calculateLearningRate,
  updatePreferenceVector,
} from "../src/services/UserPreferenceService.js";
import type { WatchEvent } from "../src/types/index.js";

describe("UserPreferenceService", () => {
  describe("calculateSignalStrength", () => {
    it("should return high signal for completed content with rating", () => {
      // The implementation uses: completionRate, rating, isRewatch, duration/totalDuration
      const event: WatchEvent = {
        contentId: 1,
        userId: "user1",
        duration: 7200, // 2 hours
        totalDuration: 7200,
        completionRate: 1.0, // 100% completion
        rating: 10, // Perfect rating
        timestamp: new Date(),
        context: {},
      };

      const strength = calculateSignalStrength(event);
      // Should be high: 0.4 (completion) + 0.3 (rating) + 0.1 (duration) = 0.8+
      expect(strength).toBeGreaterThan(0.7);
    });

    it("should return lower signal for skipped content", () => {
      const event: WatchEvent = {
        contentId: 1,
        userId: "user1",
        duration: 300, // 5 minutes
        totalDuration: 7200,
        completionRate: 0.04, // ~4% completion
        timestamp: new Date(),
        context: {},
      };

      const strength = calculateSignalStrength(event);
      expect(strength).toBeLessThan(0.3);
    });

    it("should account for watch duration ratio", () => {
      const event: WatchEvent = {
        contentId: 1,
        userId: "user1",
        duration: 60, // 1 minute
        totalDuration: 7200,
        completionRate: 0.01,
        timestamp: new Date(),
        context: {},
      };

      const strength = calculateSignalStrength(event);
      // Very short watch should have low signal
      expect(strength).toBeLessThan(0.15);
    });
  });

  describe("calculateLearningRate", () => {
    it("should return higher rate for low confidence", () => {
      const rateNew = calculateLearningRate(0.1, 0.8);
      const rateEstablished = calculateLearningRate(0.9, 0.8);

      expect(rateNew).toBeGreaterThan(rateEstablished);
    });

    it("should scale with signal strength", () => {
      const rateWeak = calculateLearningRate(0.5, 0.2);
      const rateStrong = calculateLearningRate(0.5, 0.9);

      expect(rateStrong).toBeGreaterThan(rateWeak);
    });

    it("should stay within bounds", () => {
      const rate = calculateLearningRate(0.5, 0.8);
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThanOrEqual(1);
    });
  });

  describe("updatePreferenceVector", () => {
    it("should initialize vector from null", () => {
      const newEmbedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      const result = updatePreferenceVector(null, newEmbedding, 1.0);

      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(4);
      expect(result[0]).toBeCloseTo(0.1);
    });

    it("should blend vectors with learning rate", () => {
      const current = new Float32Array([1.0, 0.0, 0.0, 0.0]);
      const newEmbedding = new Float32Array([0.0, 1.0, 0.0, 0.0]);
      const learningRate = 0.5;

      const result = updatePreferenceVector(
        current,
        newEmbedding,
        learningRate,
      );

      // After blending: [0.5, 0.5, 0, 0] then normalized
      // Magnitude = sqrt(0.25 + 0.25) = sqrt(0.5) ≈ 0.707
      // Normalized: [0.5/0.707, 0.5/0.707, 0, 0] ≈ [0.707, 0.707, 0, 0]
      expect(result[0]).toBeCloseTo(0.707, 2);
      expect(result[1]).toBeCloseTo(0.707, 2);
    });

    it("should normalize the result", () => {
      const current = new Float32Array([1.0, 0.0, 0.0, 0.0]);
      const newEmbedding = new Float32Array([1.0, 1.0, 0.0, 0.0]);

      const result = updatePreferenceVector(current, newEmbedding, 0.5);

      // Calculate magnitude
      const magnitude = Math.sqrt(
        result.reduce((sum, val) => sum + val * val, 0),
      );

      expect(magnitude).toBeCloseTo(1.0, 1);
    });
  });

  // Note: aggregateSessionSignals is not exported from the implementation
  // These tests would need to be added if the function is implemented
});

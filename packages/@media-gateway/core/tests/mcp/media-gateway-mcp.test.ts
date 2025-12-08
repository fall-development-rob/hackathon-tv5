/**
 * Media Gateway MCP Server Tests
 * Tests for the MCP tool handlers
 */

import { describe, it, expect } from "vitest";
import {
  calculateSignalStrength,
  calculateLearningRate,
  updateConfidence,
  updatePreferenceVector,
} from "../../src/services/UserPreferenceService.js";
import { calculateGroupCentroid } from "../../src/services/GroupRecommendationService.js";
import { MCP_TOOLS, MCP_CONFIG } from "../../src/mcp/index.js";

describe("Media Gateway MCP Server", () => {
  describe("MCP Configuration", () => {
    it("should have correct server name and version", () => {
      expect(MCP_CONFIG.name).toBe("media-gateway");
      // v2.0.0 added Q-Learning, caching, and swarm tools
      expect(MCP_CONFIG.version).toBe("2.0.0");
    });

    it("should export all expected tools", () => {
      expect(MCP_TOOLS).toContain("discover_content");
      expect(MCP_TOOLS).toContain("get_personalized_recommendations");
      expect(MCP_TOOLS).toContain("get_moat_metrics");
      expect(MCP_TOOLS).toContain("record_watch_event");
      expect(MCP_TOOLS).toContain("create_group_session");
    });

    it("should have correct tool count", () => {
      // v2.0.0: 15 original + 10 learning + 8 caching + 10 swarm = 43 tools
      expect(MCP_TOOLS.length).toBe(43);
    });
  });

  describe("Discovery Tools Support", () => {
    it("should have natural language discovery tool", () => {
      expect(MCP_TOOLS).toContain("discover_content");
    });

    it("should have query intent parsing tool", () => {
      expect(MCP_TOOLS).toContain("parse_query_intent");
    });

    it("should have filter-based search tool", () => {
      expect(MCP_TOOLS).toContain("search_by_filters");
    });
  });

  describe("Recommendation Tools Support", () => {
    it("should have personalized recommendations tool", () => {
      expect(MCP_TOOLS).toContain("get_personalized_recommendations");
    });

    it("should have group recommendations tool", () => {
      expect(MCP_TOOLS).toContain("get_group_recommendations");
    });

    it("should have recommendation explanation tool", () => {
      expect(MCP_TOOLS).toContain("explain_recommendation");
    });
  });

  describe("User Preference Tools Support", () => {
    it("should have watch event recording tool", () => {
      expect(MCP_TOOLS).toContain("record_watch_event");
    });

    it("should have preference retrieval tool", () => {
      expect(MCP_TOOLS).toContain("get_user_preferences");
    });

    it("should have explicit preference update tool", () => {
      expect(MCP_TOOLS).toContain("update_explicit_preferences");
    });
  });

  describe("Data Moat Tools Support", () => {
    it("should have moat metrics tool", () => {
      expect(MCP_TOOLS).toContain("get_moat_metrics");
    });

    it("should have platform stats tool", () => {
      expect(MCP_TOOLS).toContain("get_platform_stats");
    });

    it("should have engagement analysis tool", () => {
      expect(MCP_TOOLS).toContain("analyze_user_engagement");
    });
  });

  describe("Social & Group Tools Support", () => {
    it("should have group session creation tool", () => {
      expect(MCP_TOOLS).toContain("create_group_session");
    });

    it("should have group join tool", () => {
      expect(MCP_TOOLS).toContain("join_group_session");
    });

    it("should have content voting tool", () => {
      expect(MCP_TOOLS).toContain("vote_content");
    });
  });

  describe("Signal Strength Calculation (Used by record_watch_event)", () => {
    it("should calculate high signal for complete watch with rating", () => {
      const event = {
        userId: "test",
        contentId: 1,
        mediaType: "movie" as const,
        platformId: "default",
        duration: 7200,
        totalDuration: 7200,
        completionRate: 1.0,
        rating: 9,
        isRewatch: false,
        context: { dayOfWeek: 1, hourOfDay: 20 },
        timestamp: new Date(),
      };

      const strength = calculateSignalStrength(event);
      expect(strength).toBeGreaterThan(0.7);
    });

    it("should calculate low signal for short partial watch", () => {
      const event = {
        userId: "test",
        contentId: 1,
        mediaType: "movie" as const,
        platformId: "default",
        duration: 300,
        totalDuration: 7200,
        completionRate: 0.04,
        isRewatch: false,
        context: { dayOfWeek: 1, hourOfDay: 20 },
        timestamp: new Date(),
      };

      const strength = calculateSignalStrength(event);
      expect(strength).toBeLessThan(0.2);
    });

    it("should boost signal for rewatches", () => {
      const baseEvent = {
        userId: "test",
        contentId: 1,
        mediaType: "movie" as const,
        platformId: "default",
        duration: 3600,
        totalDuration: 7200,
        completionRate: 0.5,
        isRewatch: false,
        context: { dayOfWeek: 1, hourOfDay: 20 },
        timestamp: new Date(),
      };

      const rewatchEvent = { ...baseEvent, isRewatch: true };

      const baseStrength = calculateSignalStrength(baseEvent);
      const rewatchStrength = calculateSignalStrength(rewatchEvent);

      expect(rewatchStrength).toBeGreaterThan(baseStrength);
    });
  });

  describe("Learning Rate Calculation", () => {
    it("should have higher learning rate for low confidence users", () => {
      const lowConfidenceRate = calculateLearningRate(0.2, 0.7);
      const highConfidenceRate = calculateLearningRate(0.9, 0.7);

      expect(lowConfidenceRate).toBeGreaterThan(highConfidenceRate);
    });

    it("should scale with signal strength", () => {
      const weakSignalRate = calculateLearningRate(0.5, 0.3);
      const strongSignalRate = calculateLearningRate(0.5, 0.9);

      expect(strongSignalRate).toBeGreaterThan(weakSignalRate);
    });
  });

  describe("Group Centroid Calculation (Used by get_group_recommendations)", () => {
    it("should calculate centroid from member preferences", () => {
      const members = [
        {
          userId: "user1",
          preferences: {
            vector: new Float32Array([1, 0, 0]),
            confidence: 0.8,
            genreAffinities: {},
            moodMappings: [],
            temporalPatterns: [],
            updatedAt: new Date(),
          },
          weight: 1.0,
        },
        {
          userId: "user2",
          preferences: {
            vector: new Float32Array([0, 1, 0]),
            confidence: 0.8,
            genreAffinities: {},
            moodMappings: [],
            temporalPatterns: [],
            updatedAt: new Date(),
          },
          weight: 1.0,
        },
      ];

      const centroid = calculateGroupCentroid(members);

      expect(centroid).not.toBeNull();
      expect(centroid!.length).toBe(3);
      // Centroid should be normalized
      const magnitude = Math.sqrt(
        centroid![0]! ** 2 + centroid![1]! ** 2 + centroid![2]! ** 2,
      );
      expect(magnitude).toBeCloseTo(1.0, 3);
    });

    it("should return null for empty members", () => {
      const centroid = calculateGroupCentroid([]);
      expect(centroid).toBeNull();
    });

    it("should return null when no members have vectors", () => {
      const members = [
        {
          userId: "user1",
          preferences: {
            vector: null,
            confidence: 0.1,
            genreAffinities: {},
            moodMappings: [],
            temporalPatterns: [],
            updatedAt: new Date(),
          },
          weight: 1.0,
        },
      ];

      const centroid = calculateGroupCentroid(members);
      expect(centroid).toBeNull();
    });

    it("should weight members by confidence", () => {
      const members = [
        {
          userId: "user1",
          preferences: {
            vector: new Float32Array([1, 0, 0]),
            confidence: 0.9,
            genreAffinities: {},
            moodMappings: [],
            temporalPatterns: [],
            updatedAt: new Date(),
          },
          weight: 1.0,
        },
        {
          userId: "user2",
          preferences: {
            vector: new Float32Array([0, 1, 0]),
            confidence: 0.1,
            genreAffinities: {},
            moodMappings: [],
            temporalPatterns: [],
            updatedAt: new Date(),
          },
          weight: 1.0,
        },
      ];

      const centroid = calculateGroupCentroid(members);

      // Centroid should be closer to user1's preference (higher confidence)
      expect(centroid![0]).toBeGreaterThan(centroid![1]);
    });
  });

  describe("Preference Vector Update (Used by record_watch_event)", () => {
    it("should initialize with first embedding when vector is null", () => {
      const embedding = new Float32Array([0.5, 0.5, 0.5]);
      const result = updatePreferenceVector(null, embedding, 0.3);

      expect(result).toEqual(embedding);
    });

    it("should blend old and new vectors based on learning rate", () => {
      const current = new Float32Array([1, 0, 0]);
      const newEmbedding = new Float32Array([0, 1, 0]);
      const learningRate = 0.5;

      const result = updatePreferenceVector(
        current,
        newEmbedding,
        learningRate,
      );

      // After blending [0.5, 0.5, 0] gets normalized
      // Magnitude = sqrt(0.25 + 0.25) = 0.707
      // So normalized values ≈ 0.707
      expect(result[0]).toBeCloseTo(0.707, 2);
      expect(result[1]).toBeCloseTo(0.707, 2);
    });

    it("should preserve more of current vector with low learning rate", () => {
      const current = new Float32Array([1, 0, 0]);
      const newEmbedding = new Float32Array([0, 1, 0]);
      const learningRate = 0.1;

      const result = updatePreferenceVector(
        current,
        newEmbedding,
        learningRate,
      );

      // With 10% learning rate, should be 90% current
      expect(result[0]).toBeGreaterThan(0.8);
      expect(result[1]).toBeLessThan(0.2);
    });
  });

  describe("Confidence Update (Used by record_watch_event)", () => {
    it("should increase confidence with strong signals", () => {
      const initial = 0.5;
      const updated = updateConfidence(initial, 0.9);

      expect(updated).toBeGreaterThan(initial);
    });

    it("should decrease confidence with weak signals", () => {
      const initial = 0.5;
      const updated = updateConfidence(initial, 0.2);

      expect(updated).toBeLessThan(initial);
    });

    it("should respect minimum confidence", () => {
      const initial = 0.15;
      const updated = updateConfidence(initial, 0.1);

      expect(updated).toBeGreaterThanOrEqual(0.1);
    });

    it("should respect maximum confidence", () => {
      const initial = 0.9;
      const updated = updateConfidence(initial, 0.99);

      expect(updated).toBeLessThanOrEqual(0.95);
    });
  });
});

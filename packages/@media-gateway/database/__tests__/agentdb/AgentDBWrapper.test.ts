/**
 * AgentDB Wrapper Tests
 * Tests for ReasoningBank, ReflexionMemory, and SkillLibrary operations
 *
 * NOTE: agentdb module is aliased to __mocks__/agentdb.ts in vitest.config.ts
 * to prevent loading heavy ML models and avoid OOM during tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { AgentDBWrapper, createAgentDB } from "../../src/agentdb/index.js";
import {
  mockUserPreferences,
  mockWatchEvent,
  mockSuccessfulWatchEvent,
  mockAbandonedWatchEvent,
  mockMovie,
  createMockEmbedding,
} from "../fixtures/test-data.js";

// Import mocks for assertions - these are the actual exports from the aliased module
import {
  mockReasoningBank,
  mockReflexionMemory,
  mockSkillLibrary,
  mockDatabase,
  mockNightlyLearner,
} from "agentdb";

describe("AgentDBWrapper", () => {
  let wrapper: AgentDBWrapper;

  beforeEach(async () => {
    vi.clearAllMocks();
    wrapper = new AgentDBWrapper(":memory:");
    await wrapper.initialize();
  });

  afterEach(async () => {
    await wrapper.close();
  });

  describe("Initialization", () => {
    it("should initialize successfully", async () => {
      const newWrapper = new AgentDBWrapper(":memory:");
      await expect(newWrapper.initialize()).resolves.not.toThrow();
      await newWrapper.close();
    });

    it("should not reinitialize if already initialized", async () => {
      await wrapper.initialize();
      await wrapper.initialize();
      // Should only initialize once
      expect(mockDatabase.close).not.toHaveBeenCalled();
    });

    it("should throw on operations before initialization", async () => {
      const uninitWrapper = new AgentDBWrapper(":memory:");

      await expect(
        uninitWrapper.storePreferencePattern("user-123", mockUserPreferences),
      ).rejects.toThrow("AgentDB not initialized");
    });
  });

  // =========================================================================
  // ReasoningBank Tests
  // =========================================================================

  describe("ReasoningBank - Pattern Storage & Retrieval", () => {
    it("should store user preference pattern", async () => {
      const userId = "user-123";
      const patternId = await wrapper.storePreferencePattern(
        userId,
        mockUserPreferences,
      );

      expect(patternId).toBe(1);
      expect(mockReasoningBank.storePattern).toHaveBeenCalledWith(
        expect.objectContaining({
          taskType: "user_preference",
          approach: `User ${userId} preference profile`,
          successRate: mockUserPreferences.confidence,
          tags: ["preference", userId],
          metadata: expect.objectContaining({
            userId,
            genreAffinities: mockUserPreferences.genreAffinities,
          }),
          embedding: mockUserPreferences.vector,
        }),
      );
    });

    it("should retrieve user preference pattern", async () => {
      const userId = "user-456";
      const mockPattern = {
        embedding: new Float32Array(768).fill(0.5),
        successRate: 0.9,
        metadata: {
          userId,
          genreAffinities: { 18: 0.8, 28: 0.6 },
          updatedAt: "2024-01-15T10:00:00Z",
        },
        similarity: 0.95,
      };

      mockReasoningBank.searchPatterns.mockResolvedValueOnce([mockPattern]);

      const preferences = await wrapper.getPreferencePattern(userId);

      expect(preferences).toBeDefined();
      expect(preferences?.vector).toEqual(mockPattern.embedding);
      expect(preferences?.confidence).toBe(0.9);
      expect(preferences?.genreAffinities).toEqual({ 18: 0.8, 28: 0.6 });

      expect(mockReasoningBank.searchPatterns).toHaveBeenCalledWith({
        task: `User ${userId} preference profile`,
        k: 1,
        threshold: 0.9,
        filters: { taskType: "user_preference" },
      });
    });

    it("should return null when no preference pattern found", async () => {
      mockReasoningBank.searchPatterns.mockResolvedValueOnce([]);

      const preferences =
        await wrapper.getPreferencePattern("nonexistent-user");

      expect(preferences).toBeNull();
    });

    it("should store content pattern", async () => {
      const embedding = createMockEmbedding(42, 384);
      const patternId = await wrapper.storeContentPattern(mockMovie, embedding);

      expect(patternId).toBe(1);
      expect(mockReasoningBank.storePattern).toHaveBeenCalledWith(
        expect.objectContaining({
          taskType: "content",
          approach: `${mockMovie.mediaType}: ${mockMovie.title}`,
          successRate: mockMovie.voteAverage / 10,
          tags: expect.arrayContaining(["content", mockMovie.mediaType]),
          metadata: { content: mockMovie },
          embedding,
        }),
      );
    });

    it("should search content patterns", async () => {
      const queryEmbedding = createMockEmbedding(1, 384);
      const mockResults = [
        {
          metadata: { content: mockMovie },
          similarity: 0.85,
        },
      ];

      mockReasoningBank.searchPatterns.mockResolvedValueOnce(mockResults);

      const results = await wrapper.searchContentPatterns(
        queryEmbedding,
        10,
        0.5,
      );

      expect(results).toHaveLength(1);
      expect(results[0]?.content).toEqual(mockMovie);
      expect(results[0]?.score).toBe(0.85);

      expect(mockReasoningBank.searchPatterns).toHaveBeenCalledWith({
        embedding: queryEmbedding,
        k: 10,
        threshold: 0.5,
        filters: { taskType: "content" },
      });
    });
  });

  // =========================================================================
  // ReflexionMemory Tests
  // =========================================================================

  describe("ReflexionMemory - Episode Storage & Learning", () => {
    it("should store successful watch episode", async () => {
      const episodeId = await wrapper.storeWatchEpisode(
        mockSuccessfulWatchEvent,
      );

      expect(episodeId).toBe(1);
      expect(mockReflexionMemory.storeEpisode).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: mockSuccessfulWatchEvent.userId,
          task: `watch_${mockSuccessfulWatchEvent.mediaType}_${mockSuccessfulWatchEvent.contentId}`,
          success: true,
          reward: expect.any(Number),
          critique: expect.stringContaining("95%"),
          latencyMs: mockSuccessfulWatchEvent.duration * 1000,
        }),
      );
    });

    it("should store abandoned watch episode with lower reward", async () => {
      const episodeId = await wrapper.storeWatchEpisode(
        mockAbandonedWatchEvent,
      );

      expect(episodeId).toBe(1);

      const call = mockReflexionMemory.storeEpisode.mock.calls[0]?.[0];
      expect(call.success).toBe(false);
      expect(call.reward).toBeLessThan(0.5);
      expect(call.critique).toContain("abandoned");
    });

    it("should calculate reward based on completion and rating", async () => {
      await wrapper.storeWatchEpisode(mockWatchEvent);

      const call = mockReflexionMemory.storeEpisode.mock.calls[0]?.[0];
      const expectedReward =
        mockWatchEvent.completionRate * (mockWatchEvent.rating! / 10);

      expect(call.reward).toBeCloseTo(expectedReward, 2);
    });

    it("should retrieve similar episodes", async () => {
      const mockEpisodes = [
        {
          id: 1,
          sessionId: "user-123",
          task: "watch_movie_550",
          reward: 0.8,
          success: true,
        },
      ];

      mockReflexionMemory.retrieveRelevant.mockResolvedValueOnce(mockEpisodes);

      const episodes = await wrapper.retrieveSimilarEpisodes(
        "user-123",
        "watch_movie",
        5,
        true,
      );

      expect(episodes).toEqual(mockEpisodes);
      expect(mockReflexionMemory.retrieveRelevant).toHaveBeenCalledWith({
        sessionId: "user-123",
        task: "watch_movie",
        k: 5,
        onlySuccesses: true,
      });
    });

    it("should get user watch statistics", async () => {
      const stats = await wrapper.getUserWatchStats("user-123");

      expect(stats).toEqual({
        totalEpisodes: 50,
        successRate: 0.75,
        avgReward: 0.8,
      });

      expect(mockReflexionMemory.getTaskStats).toHaveBeenCalledWith("user-123");
    });
  });

  // =========================================================================
  // SkillLibrary Tests
  // =========================================================================

  describe("SkillLibrary - Recommendation Strategies", () => {
    it("should store recommendation skill", async () => {
      const skill = {
        name: "collaborative-filtering",
        description: "User-based collaborative filtering",
        strategy: "find_similar_users_and_aggregate_preferences",
        successRate: 0.82,
      };

      const skillId = await wrapper.storeRecommendationSkill(skill);

      expect(skillId).toBe(1);
      expect(mockSkillLibrary.createSkill).toHaveBeenCalledWith({
        name: skill.name,
        description: skill.description,
        signature: { strategy: skill.strategy },
        code: skill.strategy,
        successRate: skill.successRate,
      });
    });

    it("should search for applicable skills", async () => {
      const mockSkills = [
        {
          id: 1,
          name: "content-based",
          description: "Content-based filtering",
          successRate: 0.78,
        },
      ];

      mockSkillLibrary.searchSkills.mockResolvedValueOnce(mockSkills);

      const skills = await wrapper.searchSkills("movie_recommendation", 5, 0.7);

      expect(skills).toEqual(mockSkills);
      expect(mockSkillLibrary.searchSkills).toHaveBeenCalledWith({
        task: "movie_recommendation",
        k: 5,
        minSuccessRate: 0.7,
      });
    });

    it("should consolidate skills from successful patterns", async () => {
      const options = {
        minAttempts: 5,
        minSuccessRate: 0.7,
        lookbackDays: 7,
      };

      const skillIds = await wrapper.consolidateSkills(options);

      expect(skillIds).toEqual([1, 2, 3]);
      expect(mockSkillLibrary.consolidateFromEpisodes).toHaveBeenCalledWith(
        options,
      );
    });
  });

  // =========================================================================
  // Cross-Platform & Social Tracking Tests
  // =========================================================================

  describe("Cross-Platform & Social Tracking", () => {
    it("should record cross-platform matches", () => {
      wrapper.recordCrossPlatformMatch(550, ["netflix", "prime-video"]);
      wrapper.recordCrossPlatformMatch(603, ["hulu", "disney-plus"]);

      // Should be tracked internally (tested via moat metrics)
      expect(() => {
        wrapper.recordCrossPlatformMatch(1234, ["netflix"]);
      }).not.toThrow();
    });

    it("should record social connections", () => {
      wrapper.recordSocialConnection("user-1", "user-2");
      wrapper.recordSocialConnection("user-2", "user-3");

      // Should deduplicate bidirectional connections
      wrapper.recordSocialConnection("user-2", "user-1");

      expect(() => {
        wrapper.recordSocialConnection("user-3", "user-4");
      }).not.toThrow();
    });
  });

  // =========================================================================
  // Data Moat Metrics Tests
  // =========================================================================

  describe("Data Moat Metrics", () => {
    it("should calculate moat metrics", async () => {
      // Setup mocks
      wrapper.recordCrossPlatformMatch(550, ["netflix", "prime"]);
      wrapper.recordSocialConnection("user-1", "user-2");

      const metrics = await wrapper.calculateMoatMetrics();

      expect(metrics).toMatchObject({
        preferenceVectorCount: 100,
        avgPreferenceDepth: 0.85,
        crossPlatformMatchCount: expect.any(Number),
        socialConnectionCount: expect.any(Number),
        skillCount: 10,
        avgRecommendationAccuracy: 0.85,
        retentionRate: 0.75,
        moatStrength: expect.any(Number),
        calculatedAt: expect.any(Date),
      });

      expect(metrics.moatStrength).toBeGreaterThan(0);
      expect(metrics.moatStrength).toBeLessThanOrEqual(100);
    });

    it("should calculate moat strength based on multiple factors", async () => {
      const metrics = await wrapper.calculateMoatMetrics();

      // Moat strength should be a weighted combination
      expect(metrics.moatStrength).toBeGreaterThan(0);

      // With mock data, should have reasonable strength
      expect(metrics.moatStrength).toBeGreaterThan(10);
    });
  });

  // =========================================================================
  // Nightly Learning Tests
  // =========================================================================

  describe("Nightly Learning Job", () => {
    it("should run nightly learning and return results", async () => {
      const results = await wrapper.runNightlyLearning();

      // edgesPruned is 0 because edge pruning is handled internally by consolidateSkills
      expect(results).toEqual({
        patternsDiscovered: 2,
        skillsConsolidated: 3,
        edgesPruned: 0,
      });

      expect(mockNightlyLearner.discover).toHaveBeenCalledWith({
        minAttempts: 3,
        minSuccessRate: 0.6,
        minConfidence: 0.7,
        dryRun: false,
      });

      expect(mockSkillLibrary.consolidateFromEpisodes).toHaveBeenCalledWith({
        minAttempts: 5,
        minSuccessRate: 0.7,
        lookbackDays: 7,
      });
    });
  });

  // =========================================================================
  // Database Lifecycle Tests
  // =========================================================================

  describe("Database Lifecycle", () => {
    it("should close database connection", async () => {
      await wrapper.close();

      expect(mockDatabase.close).toHaveBeenCalled();
    });

    it("should handle close when not initialized", async () => {
      const uninitWrapper = new AgentDBWrapper(":memory:");

      await expect(uninitWrapper.close()).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // Factory Function Tests
  // =========================================================================

  describe("createAgentDB factory", () => {
    it("should create and initialize wrapper", async () => {
      const wrapper = await createAgentDB(":memory:");

      expect(wrapper).toBeInstanceOf(AgentDBWrapper);

      // Should be able to use immediately
      await expect(
        wrapper.storePreferencePattern("user-123", mockUserPreferences),
      ).resolves.toBeDefined();

      await wrapper.close();
    });

    it("should use custom database path", async () => {
      const customPath = "./custom-test.db";
      const wrapper = await createAgentDB(customPath);

      expect(wrapper).toBeInstanceOf(AgentDBWrapper);

      await wrapper.close();
    });
  });
});

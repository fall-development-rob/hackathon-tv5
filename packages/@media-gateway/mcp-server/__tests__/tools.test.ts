/**
 * MCP Tools Tests
 * Tests for tool definitions and utility functions
 */

import { describe, it, expect } from "vitest";
import {
  ALL_TOOLS,
  DISCOVERY_TOOLS,
  RECOMMENDATION_TOOLS,
  SOCIAL_TOOLS,
  LEARNING_TOOLS,
  getToolByName,
  getToolsByCategory,
  type ToolDefinition,
} from "../src/tools.js";

describe("MCP Tool Definitions", () => {
  describe("Tool Structure", () => {
    it("should have valid structure for all tools", () => {
      ALL_TOOLS.forEach((tool: ToolDefinition) => {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
        expect(typeof tool.name).toBe("string");
        expect(typeof tool.description).toBe("string");
        expect(tool.inputSchema.type).toBe("object");
        expect(tool.inputSchema).toHaveProperty("properties");
      });
    });

    it("should have unique tool names", () => {
      const names = ALL_TOOLS.map((tool) => tool.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it("should have non-empty descriptions", () => {
      ALL_TOOLS.forEach((tool) => {
        expect(tool.description.length).toBeGreaterThan(10);
      });
    });
  });

  describe("Discovery Tools", () => {
    it("should have 6 discovery tools", () => {
      expect(DISCOVERY_TOOLS.length).toBe(6);
    });

    it("should include content_search tool", () => {
      const searchTool = DISCOVERY_TOOLS.find(
        (t) => t.name === "content_search",
      );
      expect(searchTool).toBeDefined();
      expect(searchTool!.inputSchema.required).toContain("query");
    });

    it("should include content_trending tool", () => {
      const trendingTool = DISCOVERY_TOOLS.find(
        (t) => t.name === "content_trending",
      );
      expect(trendingTool).toBeDefined();
    });

    it("should include content_popular tool", () => {
      const popularTool = DISCOVERY_TOOLS.find(
        (t) => t.name === "content_popular",
      );
      expect(popularTool).toBeDefined();
      expect(popularTool!.inputSchema.required).toContain("mediaType");
      expect(popularTool!.inputSchema.required).toContain("category");
    });

    it("should include content_details tool", () => {
      const detailsTool = DISCOVERY_TOOLS.find(
        (t) => t.name === "content_details",
      );
      expect(detailsTool).toBeDefined();
      expect(detailsTool!.inputSchema.required).toContain("contentId");
      expect(detailsTool!.inputSchema.required).toContain("mediaType");
    });

    it("should include content_similar tool", () => {
      const similarTool = DISCOVERY_TOOLS.find(
        (t) => t.name === "content_similar",
      );
      expect(similarTool).toBeDefined();
      expect(similarTool!.inputSchema.required).toContain("contentId");
    });

    it("should include content_recommendations tool", () => {
      const recsTool = DISCOVERY_TOOLS.find(
        (t) => t.name === "content_recommendations",
      );
      expect(recsTool).toBeDefined();
    });
  });

  describe("Recommendation Tools", () => {
    it("should have 5 recommendation tools", () => {
      expect(RECOMMENDATION_TOOLS.length).toBe(5);
    });

    it("should include get_personalized tool", () => {
      const tool = RECOMMENDATION_TOOLS.find(
        (t) => t.name === "get_personalized",
      );
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.required).toContain("userId");
    });

    it("should include get_for_mood tool", () => {
      const tool = RECOMMENDATION_TOOLS.find((t) => t.name === "get_for_mood");
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.required).toContain("mood");
    });

    it("should include learn_preferences tool", () => {
      const tool = RECOMMENDATION_TOOLS.find(
        (t) => t.name === "learn_preferences",
      );
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.required).toContain("userId");
      expect(tool!.inputSchema.required).toContain("contentId");
      expect(tool!.inputSchema.required).toContain("feedback");
    });

    it("should include record_watch_session tool", () => {
      const tool = RECOMMENDATION_TOOLS.find(
        (t) => t.name === "record_watch_session",
      );
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.required).toContain("userId");
      expect(tool!.inputSchema.required).toContain("watchDuration");
    });

    it("should include get_recommendation_strategy tool", () => {
      const tool = RECOMMENDATION_TOOLS.find(
        (t) => t.name === "get_recommendation_strategy",
      );
      expect(tool).toBeDefined();
    });
  });

  describe("Social Tools", () => {
    it("should have 4 social tools", () => {
      expect(SOCIAL_TOOLS.length).toBe(4);
    });

    it("should include create_group_session tool", () => {
      const tool = SOCIAL_TOOLS.find((t) => t.name === "create_group_session");
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.required).toContain("hostUserId");
      expect(tool!.inputSchema.required).toContain("memberIds");
    });

    it("should include submit_vote tool", () => {
      const tool = SOCIAL_TOOLS.find((t) => t.name === "submit_vote");
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.required).toContain("sessionId");
      expect(tool!.inputSchema.required).toContain("vote");
    });

    it("should include finalize_session tool", () => {
      const tool = SOCIAL_TOOLS.find((t) => t.name === "finalize_session");
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.required).toContain("sessionId");
    });

    it("should include get_group_recommendations tool", () => {
      const tool = SOCIAL_TOOLS.find(
        (t) => t.name === "get_group_recommendations",
      );
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.required).toContain("memberIds");
    });
  });

  describe("Learning Tools", () => {
    it("should have 5 learning tools", () => {
      expect(LEARNING_TOOLS.length).toBe(5);
    });

    it("should include train_model tool", () => {
      const tool = LEARNING_TOOLS.find((t) => t.name === "train_model");
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.required).toContain("userId");
      expect(tool!.inputSchema.properties.episodes).toBeDefined();
      expect(tool!.inputSchema.properties.learningRate).toBeDefined();
    });

    it("should include save_model tool", () => {
      const tool = LEARNING_TOOLS.find((t) => t.name === "save_model");
      expect(tool).toBeDefined();
    });

    it("should include load_model tool", () => {
      const tool = LEARNING_TOOLS.find((t) => t.name === "load_model");
      expect(tool).toBeDefined();
    });

    it("should include get_learning_stats tool", () => {
      const tool = LEARNING_TOOLS.find((t) => t.name === "get_learning_stats");
      expect(tool).toBeDefined();
    });

    it("should include get_preference_profile tool", () => {
      const tool = LEARNING_TOOLS.find(
        (t) => t.name === "get_preference_profile",
      );
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.properties.includeHistory).toBeDefined();
    });
  });

  describe("getToolByName", () => {
    it("should find tool by name", () => {
      const tool = getToolByName("content_search");
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("content_search");
    });

    it("should return undefined for non-existent tool", () => {
      const tool = getToolByName("non_existent_tool");
      expect(tool).toBeUndefined();
    });

    it("should find tools from different categories", () => {
      expect(getToolByName("content_trending")).toBeDefined();
      expect(getToolByName("get_personalized")).toBeDefined();
      expect(getToolByName("submit_vote")).toBeDefined();
      expect(getToolByName("train_model")).toBeDefined();
    });
  });

  describe("getToolsByCategory", () => {
    it("should return discovery tools", () => {
      const tools = getToolsByCategory("discovery");
      expect(tools).toEqual(DISCOVERY_TOOLS);
    });

    it("should return recommendation tools", () => {
      const tools = getToolsByCategory("recommendation");
      expect(tools).toEqual(RECOMMENDATION_TOOLS);
    });

    it("should return social tools", () => {
      const tools = getToolsByCategory("social");
      expect(tools).toEqual(SOCIAL_TOOLS);
    });

    it("should return learning tools", () => {
      const tools = getToolsByCategory("learning");
      expect(tools).toEqual(LEARNING_TOOLS);
    });

    it("should return empty array for unknown category", () => {
      const tools = getToolsByCategory("unknown" as any);
      expect(tools).toEqual([]);
    });
  });

  describe("Tool Count", () => {
    it("should have correct total tool count", () => {
      const expectedTotal =
        DISCOVERY_TOOLS.length +
        RECOMMENDATION_TOOLS.length +
        SOCIAL_TOOLS.length +
        LEARNING_TOOLS.length;

      expect(ALL_TOOLS.length).toBe(expectedTotal);
      expect(ALL_TOOLS.length).toBe(20); // 6 + 5 + 4 + 5 = 20
    });
  });
});

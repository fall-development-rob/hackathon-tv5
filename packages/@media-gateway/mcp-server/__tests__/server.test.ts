/**
 * MCP Server Tests
 * Tests for MCPServer class and request handling
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MCPServer } from "../src/server.js";
import { ALL_TOOLS } from "../src/tools.js";

// Mock SwarmCoordinator
const createMockSwarmCoordinator = () => ({
  executeTask: vi
    .fn()
    .mockResolvedValue({ success: true, data: { results: [] } }),
  storeToMCPMemory: vi.fn().mockResolvedValue(undefined),
  retrieveFromMCPMemory: vi.fn().mockResolvedValue(null),
  getStatus: vi.fn().mockReturnValue({ active: true, agents: [] }),
  initializeMCP: vi.fn().mockResolvedValue(undefined),
});

describe("MCPServer", () => {
  let server: MCPServer;

  beforeEach(() => {
    server = new MCPServer({
      name: "test-server",
      version: "1.0.0",
      description: "Test MCP server",
    });
  });

  describe("Initialize Request", () => {
    it("should return server info on initialize", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "initialize",
        params: {},
      };

      const response = await server.processRequest(request);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      expect(response.result.protocolVersion).toBe("2024-11-05");
      expect(response.result.serverInfo.name).toBe("test-server");
      expect(response.result.serverInfo.version).toBe("1.0.0");
      expect(response.result.capabilities).toBeDefined();
    });
  });

  describe("Tools List Request", () => {
    it("should return all tools on tools/list", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 2,
        method: "tools/list",
        params: {},
      };

      const response = await server.processRequest(request);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(2);
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeDefined();
      expect(response.result.tools.length).toBe(ALL_TOOLS.length);
    });

    it("should include tool schemas in list", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 3,
        method: "tools/list",
        params: {},
      };

      const response = await server.processRequest(request);
      const tools = response.result.tools;

      tools.forEach((tool: any) => {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
      });
    });
  });

  describe("Server Info Request", () => {
    it("should return server info", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 4,
        method: "server/info",
        params: {},
      };

      const response = await server.processRequest(request);

      expect(response.result.name).toBe("test-server");
      expect(response.result.version).toBe("1.0.0");
      expect(response.result.swarmActive).toBe(false);
      expect(response.result.qLearningEnabled).toBe(false);
    });

    it("should reflect Q-learning state", async () => {
      server.enableQLearning();

      const request = {
        jsonrpc: "2.0" as const,
        id: 5,
        method: "server/info",
        params: {},
      };

      const response = await server.processRequest(request);
      expect(response.result.qLearningEnabled).toBe(true);
    });

    it("should reflect swarm coordinator state", async () => {
      const mockCoordinator = createMockSwarmCoordinator();
      server.setSwarmCoordinator(mockCoordinator as any);

      const request = {
        jsonrpc: "2.0" as const,
        id: 6,
        method: "server/info",
        params: {},
      };

      const response = await server.processRequest(request);
      expect(response.result.swarmActive).toBe(true);
    });
  });

  describe("Swarm Status Request", () => {
    it("should return inactive when no coordinator", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 7,
        method: "swarm/status",
        params: {},
      };

      const response = await server.processRequest(request);
      expect(response.result.active).toBe(false);
    });

    it("should return active when coordinator set", async () => {
      const mockCoordinator = createMockSwarmCoordinator();
      server.setSwarmCoordinator(mockCoordinator as any);

      const request = {
        jsonrpc: "2.0" as const,
        id: 8,
        method: "swarm/status",
        params: {},
      };

      const response = await server.processRequest(request);
      expect(response.result.active).toBe(true);
      expect(mockCoordinator.getStatus).toHaveBeenCalled();
    });
  });

  describe("Unknown Method", () => {
    it("should return error for unknown method", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 9,
        method: "unknown/method",
        params: {},
      };

      const response = await server.processRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32601);
      expect(response.error!.message).toContain("Method not found");
    });
  });

  describe("Tool Call Request", () => {
    let mockCoordinator: ReturnType<typeof createMockSwarmCoordinator>;

    beforeEach(() => {
      mockCoordinator = createMockSwarmCoordinator();
      server.setSwarmCoordinator(mockCoordinator as any);
    });

    it("should return error when coordinator not initialized", async () => {
      const noCoordinatorServer = new MCPServer({
        name: "test",
        version: "1.0.0",
        description: "Test",
      });

      const request = {
        jsonrpc: "2.0" as const,
        id: 10,
        method: "tools/call",
        params: { name: "content_search", arguments: { query: "test" } },
      };

      const response = await noCoordinatorServer.processRequest(request);
      expect(response.result.success).toBe(false);
      expect(response.result.error).toContain(
        "SwarmCoordinator not initialized",
      );
    });

    it("should handle content_search tool call", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 11,
        method: "tools/call",
        params: {
          name: "content_search",
          arguments: { query: "action movies", userId: "user-123" },
        },
      };

      const response = await server.processRequest(request);

      expect(response.result.success).toBe(true);
      expect(mockCoordinator.executeTask).toHaveBeenCalledWith(
        "action movies",
        "user-123",
      );
    });

    it("should handle learn_preferences tool call", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 12,
        method: "tools/call",
        params: {
          name: "learn_preferences",
          arguments: {
            userId: "user-123",
            contentId: 456,
            feedback: "like",
            rating: 8,
          },
        },
      };

      const response = await server.processRequest(request);

      expect(response.result.success).toBe(true);
      expect(mockCoordinator.storeToMCPMemory).toHaveBeenCalled();
      const storeCall = mockCoordinator.storeToMCPMemory.mock.calls[0];
      expect(storeCall[0]).toContain("preferences/user-123/456");
    });

    it("should handle record_watch_session tool call", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 13,
        method: "tools/call",
        params: {
          name: "record_watch_session",
          arguments: {
            userId: "user-123",
            contentId: 789,
            mediaType: "movie",
            watchDuration: 3600,
            completed: true,
            enjoyment: 9,
          },
        },
      };

      const response = await server.processRequest(request);

      expect(response.result.success).toBe(true);
      expect(mockCoordinator.storeToMCPMemory).toHaveBeenCalled();
    });

    it("should handle submit_vote tool call", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 14,
        method: "tools/call",
        params: {
          name: "submit_vote",
          arguments: {
            sessionId: "session-1",
            userId: "user-123",
            contentId: 456,
            vote: "yes",
          },
        },
      };

      const response = await server.processRequest(request);

      expect(response.result.success).toBe(true);
      expect(response.result.data.voted).toBe(true);
    });

    it("should handle train_model tool call with Q-learning enabled", async () => {
      server.enableQLearning();

      const request = {
        jsonrpc: "2.0" as const,
        id: 15,
        method: "tools/call",
        params: {
          name: "train_model",
          arguments: {
            userId: "user-123",
            episodes: 50,
            learningRate: 0.1,
          },
        },
      };

      const response = await server.processRequest(request);

      expect(response.result.success).toBe(true);
      expect(response.result.data.trained).toBe(true);
      expect(response.result.data.episodes).toBe(50);
    });

    it("should return error for train_model when Q-learning disabled", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 16,
        method: "tools/call",
        params: {
          name: "train_model",
          arguments: { userId: "user-123" },
        },
      };

      const response = await server.processRequest(request);

      expect(response.result.success).toBe(false);
      expect(response.result.error).toContain("Q-Learning not enabled");
    });

    it("should return error for unknown tool", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 17,
        method: "tools/call",
        params: {
          name: "unknown_tool",
          arguments: {},
        },
      };

      const response = await server.processRequest(request);

      expect(response.result.success).toBe(false);
      expect(response.result.error).toContain("Unknown tool");
    });

    it("should handle get_learning_stats tool call", async () => {
      mockCoordinator.retrieveFromMCPMemory.mockResolvedValueOnce({
        interactions: 100,
        averageReward: 0.8,
        explorationRate: 0.05,
      });

      const request = {
        jsonrpc: "2.0" as const,
        id: 18,
        method: "tools/call",
        params: {
          name: "get_learning_stats",
          arguments: { userId: "user-123" },
        },
      };

      const response = await server.processRequest(request);

      expect(response.result.success).toBe(true);
      expect(response.result.data.interactions).toBe(100);
    });

    it("should handle get_preference_profile with default values", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 19,
        method: "tools/call",
        params: {
          name: "get_preference_profile",
          arguments: { userId: "user-123" },
        },
      };

      const response = await server.processRequest(request);

      expect(response.result.success).toBe(true);
      expect(response.result.data.userId).toBe("user-123");
    });
  });

  describe("Request ID Handling", () => {
    it("should preserve string ID", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: "string-id-123",
        method: "initialize",
        params: {},
      };

      const response = await server.processRequest(request);
      expect(response.id).toBe("string-id-123");
    });

    it("should handle null ID", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        method: "initialize",
        params: {},
      };

      const response = await server.processRequest(request);
      expect(response.id).toBeNull();
    });

    it("should handle numeric ID", async () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 42,
        method: "initialize",
        params: {},
      };

      const response = await server.processRequest(request);
      expect(response.id).toBe(42);
    });
  });
});

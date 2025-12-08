/**
 * Vitest Test Setup
 * Global mocks and test utilities
 *
 * CRITICAL: vi.mock() calls are hoisted by Vitest to run before imports
 */

import { vi, beforeEach, afterEach } from "vitest";

// CRITICAL: These vi.mock() calls are HOISTED by Vitest to run BEFORE all imports
// This prevents the heavy real packages from ever being loaded
vi.mock("agentdb", async () => {
  return await import("../__mocks__/agentdb.js");
});

vi.mock("ruvector", async () => {
  return await import("../__mocks__/ruvector.js");
});

// Mock environment variables
process.env["NODE_ENV"] = "test";

// Import the mock utilities after vi.mock has been hoisted
import { clearMockVectorStore } from "../__mocks__/ruvector.js";
import {
  mockReasoningBank,
  mockReflexionMemory,
  mockSkillLibrary,
  mockEmbeddingService,
  mockNightlyLearner,
  mockDatabase,
  createDatabase,
} from "../__mocks__/agentdb.js";

// Function to restore all agentdb mock implementations
// Called after vi.clearAllMocks() to ensure mocks work correctly
function restoreAgentDBMocks(): void {
  // Restore mockDatabase methods
  mockDatabase.close.mockResolvedValue(undefined);
  mockDatabase.prepare.mockReturnValue({
    get: vi.fn().mockReturnValue({
      total: 100,
      avgReward: 0.8,
      successRate: 0.75,
      count: 10,
    }),
    run: vi.fn(),
    all: vi.fn().mockReturnValue([]),
  });

  // Restore createDatabase
  createDatabase.mockImplementation(async () => mockDatabase);

  // Restore ReasoningBank methods
  mockReasoningBank.storePattern.mockResolvedValue(1);
  mockReasoningBank.searchPatterns.mockResolvedValue([]);
  mockReasoningBank.getPatternStats.mockReturnValue({
    totalPatterns: 100,
    avgSuccessRate: 0.85,
  });

  // Restore ReflexionMemory methods
  mockReflexionMemory.storeEpisode.mockResolvedValue(1);
  mockReflexionMemory.retrieveRelevant.mockResolvedValue([]);
  mockReflexionMemory.getTaskStats.mockResolvedValue({
    totalEpisodes: 50,
    successRate: 0.75,
    avgReward: 0.8,
  });

  // Restore SkillLibrary methods
  mockSkillLibrary.createSkill.mockResolvedValue(1);
  mockSkillLibrary.searchSkills.mockResolvedValue([]);
  mockSkillLibrary.consolidateFromEpisodes.mockResolvedValue([1, 2, 3]);

  // Restore EmbeddingService methods
  mockEmbeddingService.initialize.mockResolvedValue(undefined);
  mockEmbeddingService.generateEmbedding.mockImplementation((text: string) => {
    const embedding = new Float32Array(384);
    for (let i = 0; i < text.length && i < 384; i++) {
      embedding[i] = text.charCodeAt(i) / 255;
    }
    return Promise.resolve(embedding);
  });

  // Restore NightlyLearner methods
  mockNightlyLearner.discover.mockResolvedValue([
    { id: 1, pattern: "pattern1" },
    { id: 2, pattern: "pattern2" },
  ]);
  mockNightlyLearner.pruneEdges.mockResolvedValue(5);
}

// Suppress console output during tests unless explicitly needed
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock fetch globally
global.fetch = vi.fn();

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  restoreAgentDBMocks(); // Restore agentdb mock implementations after clearing
  clearMockVectorStore(); // Clear vector store to prevent memory leaks
});

// Clean up after each test
afterEach(() => {
  // Force garbage collection hint (not guaranteed but helps)
  if (global.gc) {
    global.gc();
  }
});

// Add custom matchers or utilities here if needed

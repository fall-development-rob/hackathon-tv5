/**
 * Mock for agentdb package
 * This file is automatically used by vitest when vi.mock('agentdb') is called
 */

import { vi } from "vitest";

// Create mock instances that are returned by constructors
export const mockReasoningBank = {
  storePattern: vi.fn().mockResolvedValue(1),
  searchPatterns: vi.fn().mockResolvedValue([]),
  getPatternStats: vi.fn().mockReturnValue({
    totalPatterns: 100,
    avgSuccessRate: 0.85,
  }),
};

export const mockReflexionMemory = {
  storeEpisode: vi.fn().mockResolvedValue(1),
  retrieveRelevant: vi.fn().mockResolvedValue([]),
  getTaskStats: vi.fn().mockResolvedValue({
    totalEpisodes: 50,
    successRate: 0.75,
    avgReward: 0.8,
  }),
};

export const mockSkillLibrary = {
  createSkill: vi.fn().mockResolvedValue(1),
  searchSkills: vi.fn().mockResolvedValue([]),
  consolidateFromEpisodes: vi.fn().mockResolvedValue([1, 2, 3]),
};

export const mockEmbeddingService = {
  initialize: vi.fn().mockResolvedValue(undefined),
  generateEmbedding: vi.fn().mockImplementation((text: string) => {
    const embedding = new Float32Array(384);
    for (let i = 0; i < text.length && i < 384; i++) {
      embedding[i] = text.charCodeAt(i) / 255;
    }
    return Promise.resolve(embedding);
  }),
};

export const mockNightlyLearner = {
  discover: vi.fn().mockResolvedValue([
    { id: 1, pattern: "pattern1" },
    { id: 2, pattern: "pattern2" },
  ]),
  pruneEdges: vi.fn().mockResolvedValue(5),
};

// mockDatabase needs prepare that returns a callable .get() with row data
const mockPreparedStatement = {
  get: vi.fn().mockReturnValue({
    total: 100,
    avgReward: 0.8,
    successRate: 0.75,
    count: 10,
  }),
  run: vi.fn(),
  all: vi.fn().mockReturnValue([]),
};

export const mockDatabase = {
  close: vi.fn().mockResolvedValue(undefined),
  prepare: vi.fn().mockReturnValue(mockPreparedStatement),
  exec: vi.fn(),
};

// Export constructors that return mock instances
// createDatabase is async, returns the mockDatabase
export const createDatabase = vi
  .fn()
  .mockImplementation(async () => mockDatabase);

// Constructor classes - using class syntax to properly work with 'new' keyword
export class EmbeddingService {
  constructor(_config?: Record<string, unknown>) {}
  initialize = mockEmbeddingService.initialize;
  generateEmbedding = mockEmbeddingService.generateEmbedding;
}

export class ReasoningBank {
  constructor(_db?: unknown, _embedder?: unknown) {}
  storePattern = mockReasoningBank.storePattern;
  searchPatterns = mockReasoningBank.searchPatterns;
  getPatternStats = mockReasoningBank.getPatternStats;
}

export class ReflexionMemory {
  constructor(_db?: unknown, _embedder?: unknown) {}
  storeEpisode = mockReflexionMemory.storeEpisode;
  retrieveRelevant = mockReflexionMemory.retrieveRelevant;
  getTaskStats = mockReflexionMemory.getTaskStats;
}

export class SkillLibrary {
  constructor(_db?: unknown, _embedder?: unknown) {}
  createSkill = mockSkillLibrary.createSkill;
  searchSkills = mockSkillLibrary.searchSkills;
  consolidateFromEpisodes = mockSkillLibrary.consolidateFromEpisodes;
}

export class NightlyLearner {
  constructor(_db?: unknown, _embedder?: unknown) {}
  discover = mockNightlyLearner.discover;
  pruneEdges = mockNightlyLearner.pruneEdges;
}

// Default export for CommonJS compatibility
export default {
  createDatabase,
  EmbeddingService,
  ReasoningBank,
  ReflexionMemory,
  SkillLibrary,
  NightlyLearner,
  // Also export mocks for test assertions
  mockDatabase,
  mockReasoningBank,
  mockReflexionMemory,
  mockSkillLibrary,
  mockEmbeddingService,
  mockNightlyLearner,
};

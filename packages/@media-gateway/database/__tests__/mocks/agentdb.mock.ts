/**
 * Mock implementations for AgentDB package
 */

import { vi } from 'vitest';

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
    // Generate deterministic mock embedding
    const embedding = new Float32Array(384);
    for (let i = 0; i < text.length && i < 384; i++) {
      embedding[i] = text.charCodeAt(i) / 255;
    }
    return Promise.resolve(embedding);
  }),
};

export const mockNightlyLearner = {
  discover: vi.fn().mockResolvedValue([
    { id: 1, pattern: 'pattern1' },
    { id: 2, pattern: 'pattern2' },
  ]),
  pruneEdges: vi.fn().mockResolvedValue(5),
};

export const mockDatabase = {
  close: vi.fn().mockResolvedValue(undefined),
  prepare: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue({
      total: 100,
      avgReward: 0.8,
      successRate: 0.75,
      count: 10,
    }),
  }),
};

// Main AgentDB mock factory
export const createMockAgentDB = () => ({
  createDatabase: vi.fn().mockResolvedValue(mockDatabase),
  EmbeddingService: vi.fn(() => mockEmbeddingService),
  ReasoningBank: vi.fn(() => mockReasoningBank),
  ReflexionMemory: vi.fn(() => mockReflexionMemory),
  SkillLibrary: vi.fn(() => mockSkillLibrary),
  NightlyLearner: vi.fn(() => mockNightlyLearner),
});

// Mock agentdb module
vi.mock('agentdb', () => createMockAgentDB());

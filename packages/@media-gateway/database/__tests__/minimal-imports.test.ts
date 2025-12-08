/**
 * Test with all imports from RuVectorWrapper.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  RuVectorWrapper,
  createRuVector,
  cosineSimilarity,
} from "../src/ruvector/index.js";
import { mockVectorDB, clearMockVectorStore } from "./mocks/ruvector.mock.js";
import { mockMovie, createMockEmbedding } from "./fixtures/test-data.js";

describe("Test Imports", () => {
  it("should import everything without OOM", () => {
    expect(RuVectorWrapper).toBeDefined();
    expect(createRuVector).toBeDefined();
    expect(cosineSimilarity).toBeDefined();
    expect(mockVectorDB).toBeDefined();
    expect(clearMockVectorStore).toBeDefined();
    expect(mockMovie).toBeDefined();
    expect(createMockEmbedding).toBeDefined();
  });
});

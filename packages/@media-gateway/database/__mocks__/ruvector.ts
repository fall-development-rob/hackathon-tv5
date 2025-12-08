/**
 * Mock for ruvector package
 * This file replaces the real ruvector during tests to prevent
 * database connection attempts and memory issues
 */

import { vi } from "vitest";

const mockVectorStore = new Map<
  string,
  { vector: Float32Array; metadata: Record<string, unknown> }
>();

export const mockVectorDB = {
  insert: vi.fn().mockImplementation(({ id, vector, metadata }) => {
    mockVectorStore.set(id, { vector, metadata });
    return Promise.resolve(id);
  }),

  get: vi.fn().mockImplementation((id: string) => {
    const result = mockVectorStore.get(id);
    return Promise.resolve(result || null);
  }),

  search: vi
    .fn()
    .mockImplementation(
      ({ k, threshold }: { k?: number; threshold?: number }) => {
        const results: Array<{
          id: string;
          vector: Float32Array;
          metadata: Record<string, unknown>;
          score: number;
        }> = [];

        // Simple mock search - return stored items with mock similarity scores
        for (const [id, data] of mockVectorStore.entries()) {
          const similarity = Math.random() * 0.5 + 0.5; // 0.5-1.0

          if (similarity >= (threshold || 0)) {
            results.push({
              id,
              vector: data.vector,
              metadata: data.metadata,
              score: similarity,
            });
          }
        }

        // Sort by score and limit
        results.sort((a, b) => b.score - a.score);
        return Promise.resolve(results.slice(0, k || 10));
      },
    ),

  delete: vi.fn().mockImplementation((id: string) => {
    const existed = mockVectorStore.has(id);
    mockVectorStore.delete(id);
    return Promise.resolve(existed);
  }),

  len: vi.fn().mockImplementation(() => {
    return Promise.resolve(mockVectorStore.size);
  }),

  clear: vi.fn().mockImplementation(() => {
    mockVectorStore.clear();
    return Promise.resolve(undefined);
  }),
};

// Mock VectorDB class
export class VectorDB {
  constructor(_config: Record<string, unknown>) {}

  insert = mockVectorDB.insert;
  get = mockVectorDB.get;
  search = mockVectorDB.search;
  delete = mockVectorDB.delete;
  len = mockVectorDB.len;
  clear = mockVectorDB.clear;
}

// Helper to clear mock store between tests
export function clearMockVectorStore() {
  mockVectorStore.clear();
  vi.clearAllMocks();
}

// Default export for CommonJS compatibility
export default {
  VectorDB,
  mockVectorDB,
  clearMockVectorStore,
};

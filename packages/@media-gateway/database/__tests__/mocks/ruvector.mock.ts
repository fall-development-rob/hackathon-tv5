/**
 * Mock implementations for RuVector package
 */

import { vi } from 'vitest';

const mockVectorStore = new Map<string, { vector: Float32Array; metadata: any }>();

export const mockVectorDB = {
  insert: vi.fn().mockImplementation(({ id, vector, metadata }) => {
    mockVectorStore.set(id, { vector, metadata });
    return Promise.resolve(id);
  }),

  get: vi.fn().mockImplementation((id: string) => {
    const result = mockVectorStore.get(id);
    return Promise.resolve(result || null);
  }),

  search: vi.fn().mockImplementation(({ vector, k, threshold }) => {
    const results: any[] = [];

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
  }),

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
export class MockVectorDB {
  constructor(config: any) {}

  insert = mockVectorDB.insert;
  get = mockVectorDB.get;
  search = mockVectorDB.search;
  delete = mockVectorDB.delete;
  len = mockVectorDB.len;
  clear = mockVectorDB.clear;
}

// Mock ruvector module
vi.mock('ruvector', () => ({
  VectorDB: MockVectorDB,
}));

// Helper to clear mock store between tests
export function clearMockVectorStore() {
  mockVectorStore.clear();
  vi.clearAllMocks();
}

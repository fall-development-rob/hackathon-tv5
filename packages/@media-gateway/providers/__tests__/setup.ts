/**
 * Test setup file
 * Configures global test environment and mocks
 */

import { beforeAll, afterEach, vi } from 'vitest';

// Mock global fetch for all tests
beforeAll(() => {
  global.fetch = vi.fn();
});

// Clear all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

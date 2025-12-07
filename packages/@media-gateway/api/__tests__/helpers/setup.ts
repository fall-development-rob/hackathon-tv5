/**
 * Test Setup - Configure test environment
 */

import { beforeAll, afterAll, afterEach } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.CORS_ORIGIN = '*';

// Global test setup
beforeAll(() => {
  // Suppress console.error in tests unless debugging
  if (!process.env.DEBUG) {
    global.console.error = () => {};
    global.console.warn = () => {};
  }
});

// Cleanup after each test
afterEach(() => {
  // Clear any mocks
  vi.clearAllMocks();
});

// Global test teardown
afterAll(() => {
  // Cleanup
});

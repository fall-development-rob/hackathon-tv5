/**
 * Vitest Test Setup
 * Global mocks and test utilities
 */

import { vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';

// Suppress console output during tests unless explicitly needed
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock fetch globally
global.fetch = vi.fn();

// Add custom matchers or utilities here if needed

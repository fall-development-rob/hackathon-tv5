import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use absolute path to prevent vite from double-resolving through symlinks
const corePackagePath = path.resolve(__dirname, "..", "core", "src");

/**
 * E2E Test Configuration
 *
 * This configuration is specifically for end-to-end tests that:
 * - Connect to REAL PostgreSQL databases (no mocks)
 * - Use REAL ruvector and agentdb libraries
 * - Require longer timeouts for I/O operations
 * - Run in isolated forks for stability
 *
 * Usage: npm run test:e2e
 */
export default defineConfig({
  // NO plugins - we want real dependencies, not mocks
  resolve: {
    // Prevent Vite from resolving symlinks to real paths (fixes pnpm workspace issues)
    preserveSymlinks: true,
    alias: [
      { find: "@media-gateway/core", replacement: corePackagePath },
      // NO ruvector/agentdb aliases - let them load naturally
    ],
  },
  esbuild: {
    target: "node18",
  },
  test: {
    globals: true,
    environment: "node",
    // Use forks pool with single fork for maximum stability
    pool: "forks",
    poolOptions: {
      forks: {
        // Single fork to reduce memory overhead and ensure clean state
        singleFork: true,
        // Isolate tests for clean state between test files
        isolate: true,
      },
    },
    // Server configuration - DO NOT inline heavy dependencies
    server: {
      deps: {
        // Only inline our own source code
        inline: [/@media-gateway\//, /__tests__/],
        // Let all external packages load naturally (no inlining)
        external: [/node_modules/],
        fallbackCJS: true,
      },
    },
    // Additional deps config at test level
    deps: {
      // Ensure external packages are not transformed
      interopDefault: true,
    },
    // DISABLE coverage for E2E tests
    coverage: {
      enabled: false,
    },
    // NO setup files - E2E tests should NOT use mocks
    // LONGER timeouts for real database operations
    testTimeout: 30000, // 30 seconds for tests
    hookTimeout: 60000, // 60 seconds for setup/teardown hooks
    // Mock configuration
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
    // ONLY include E2E tests
    include: ["__tests__/e2e/**/*.test.ts"],
    // Exclude everything else
    exclude: [
      "__tests__/unit/**",
      "__tests__/integration/**",
      "node_modules/**",
      "dist/**",
    ],
  },
});

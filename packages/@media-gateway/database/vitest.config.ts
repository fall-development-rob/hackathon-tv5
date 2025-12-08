import { defineConfig, type Plugin } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use absolute path to prevent vite from double-resolving through symlinks
const corePackagePath = path.resolve(__dirname, "..", "core", "src");
const agentdbMockPath = path.resolve(__dirname, "__mocks__", "agentdb.ts");
const ruvectorMockPath = path.resolve(__dirname, "__mocks__", "ruvector.ts");

/**
 * Custom Vite plugin to intercept heavy module imports during tests
 * This runs BEFORE normal resolution to prevent loading ML models
 */
function mockHeavyDependencies(): Plugin {
  return {
    name: "mock-heavy-deps",
    enforce: "pre", // Run before other resolvers
    resolveId(source, importer) {
      // Debug: Log what's being resolved
      if (source.includes("agentdb") || source.includes("ruvector")) {
        console.log(`[mock-heavy-deps] Resolving: ${source} from ${importer}`);
      }
      if (source === "agentdb") {
        console.log(`[mock-heavy-deps] Redirecting agentdb to mock`);
        return agentdbMockPath;
      }
      if (source === "ruvector") {
        console.log(`[mock-heavy-deps] Redirecting ruvector to mock`);
        return ruvectorMockPath;
      }
      return null; // Let other resolvers handle
    },
  };
}

export default defineConfig({
  plugins: [mockHeavyDependencies()],
  resolve: {
    // Prevent Vite from resolving symlinks to real paths (fixes pnpm workspace issues)
    preserveSymlinks: true,
    alias: [
      { find: "@media-gateway/core", replacement: corePackagePath },
      // CRITICAL: Redirect ruvector and agentdb to mocks to prevent OOM
      { find: "ruvector", replacement: ruvectorMockPath },
      { find: "agentdb", replacement: agentdbMockPath },
    ],
  },
  esbuild: {
    target: "node18",
  },
  test: {
    globals: true,
    environment: "node",
    // Use forks pool for better isolation - vmThreads was causing OOM issues
    pool: "forks",
    poolOptions: {
      forks: {
        // Single fork to reduce memory overhead
        singleFork: true,
        // Isolate tests for clean state
        isolate: true,
      },
    },
    // Server configuration to prevent heavy dep analysis
    server: {
      deps: {
        // ONLY inline our own source code - prevent analyzing node_modules
        inline: [/@media-gateway\//, /__mocks__/, /__tests__/],
        // Mark heavy packages as external to prevent vitest from analyzing them
        external: [
          /ruvector/,
          /agentdb/,
          /better-sqlite3/,
          /hnswlib-node/,
          /@tensorflow/,
          /@xenova\/transformers/,
        ],
        // Don't follow symlinks (pnpm creates symlinks)
        fallbackCJS: true,
      },
    },
    // Additional deps config at test level
    deps: {
      // Ensure external packages are not transformed
      interopDefault: true,
    },
    // DISABLE coverage to prevent loading source files that import heavy deps
    coverage: {
      enabled: false,
    },
    setupFiles: ["__tests__/setup.ts"],
    testTimeout: 10000,
    hookTimeout: 10000,
    mockReset: true, // Reset mocks between tests to prevent state leakage
    restoreMocks: true,
    clearMocks: true,
    // Exclude integration tests, ruvector tests (run separately to avoid OOM), and compiled files
    // Note: RuVectorWrapper tests cause OOM when running with full suite due to Vitest module analysis
    // Run ruvector tests separately: npx vitest run -t "Initialization" (or other specific test pattern)
    exclude: [
      "**/integration/**",
      "**/ruvector/**",
      "node_modules/**",
      "dist/**",
    ],
    include: ["__tests__/**/*.test.ts"],
  },
});

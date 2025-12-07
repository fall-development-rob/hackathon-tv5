import { defineConfig } from 'vitest/config';
import path from 'path';

// Fix for vite/esbuild double-resolving @media-gateway/core path
// The symlink in node_modules/@media-gateway/core points to ../../../core
// but vite prepends the package directory again
const corePackagePath = path.resolve(__dirname, '../core/src');

export default defineConfig({
  resolve: {
    alias: [
      // Handle direct import
      { find: '@media-gateway/core', replacement: corePackagePath },
      // Handle sub-path imports
      { find: /^@media-gateway\/core\/(.*)$/, replacement: `${corePackagePath}/$1` },
    ],
  },
  esbuild: {
    // Ensure esbuild doesn't resolve through node_modules for this package
    target: 'node18',
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '__tests__/**',
        'vitest.config.ts',
      ],
      include: ['src/**/*.ts'],
      all: true,
      lines: 90,
      functions: 90,
      branches: 85,
      statements: 90,
    },
    setupFiles: ['__tests__/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },
});

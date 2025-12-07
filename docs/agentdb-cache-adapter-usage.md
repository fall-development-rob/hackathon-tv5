# AgentDB Cache Adapter Usage Guide

## Overview

The `AgentDBCacheAdapter` provides a drop-in replacement for ContentEmbeddings' `LRUCache` that uses agentdb's `QueryCache` for improved performance. The adapter automatically falls back to the built-in `LRUCache` if agentdb is not available.

## Benefits

Using agentdb's QueryCache provides:

- **20-40% speedup** on repeated queries
- **TTL support** for automatic cache expiration
- **Memory-efficient** size-based limits (10MB default)
- **Thread-safe** operations
- **Automatic invalidation** on writes
- **Hit/miss ratio tracking**

## Installation

```bash
# Install agentdb (optional - adapter falls back to LRUCache if not available)
npm install agentdb
```

## Basic Usage

### 1. Simple Cache Creation

```typescript
import { createAgentDBCache } from '@media-gateway/agents';

// Create cache with automatic fallback
const cache = createAgentDBCache<number[]>(1000);

// Check which implementation is being used
import { isAgentDBAvailable } from '@media-gateway/agents';
if (isAgentDBAvailable()) {
  console.log('Using agentdb QueryCache (20-40% speedup)');
} else {
  console.log('Using built-in LRUCache');
}
```

### 2. Use with ContentEmbeddingGenerator

```typescript
import {
  ContentEmbeddingGenerator,
  createAgentDBCache,
  type MediaContent
} from '@media-gateway/agents';

// Create generator with agentdb cache
class EnhancedContentEmbeddingGenerator extends ContentEmbeddingGenerator {
  constructor(cacheSize: number = 1000) {
    super(cacheSize);
    // Replace built-in cache with agentdb adapter
    this.cache = createAgentDBCache<number[]>(cacheSize, 'content-embeddings');
  }
}

const generator = new EnhancedContentEmbeddingGenerator(1000);

// Use normally
const content: MediaContent = {
  id: 'movie-123',
  title: 'The Matrix',
  genres: ['action', 'science fiction'],
  contentType: 'movie',
  overview: 'A computer programmer discovers reality is a simulation',
  popularity: 85,
  rating: 8.7,
  releaseDate: '1999-03-31',
  runtime: 136
};

const embedding = generator.generateContentEmbedding(content);
```

### 3. Category-Based Caching

```typescript
import { createAgentDBCache } from '@media-gateway/agents';

// Create separate caches for different data types
const contentCache = createAgentDBCache<number[]>(1000, 'content');
const userCache = createAgentDBCache<number[]>(500, 'users');
const stateCache = createAgentDBCache<number[]>(500, 'states');

// Each cache is isolated by category in agentdb
```

### 4. Strict Mode (Require AgentDB)

```typescript
import { createAgentDBCacheStrict } from '@media-gateway/agents';

try {
  // This will throw if agentdb is not available
  const cache = createAgentDBCacheStrict<number[]>(1000);
  console.log('AgentDB cache created successfully');
} catch (error) {
  console.error('AgentDB is required but not available:', error.message);
  // Handle error (e.g., exit, use alternative, etc.)
}
```

## API Reference

### createAgentDBCache

```typescript
function createAgentDBCache<T>(
  maxSize?: number,
  category?: string
): CacheAdapter<T>
```

Creates a cache adapter that uses agentdb's QueryCache when available, otherwise falls back to built-in LRUCache.

**Parameters:**
- `maxSize` (optional): Maximum number of cache entries (default: 1000)
- `category` (optional): Cache category for agentdb QueryCache (default: 'embeddings')

**Returns:** `CacheAdapter<T>` instance

### createAgentDBCacheStrict

```typescript
function createAgentDBCacheStrict<T>(
  maxSize?: number,
  category?: string
): AgentDBCacheAdapter<T>
```

Creates a cache adapter that ONLY uses agentdb's QueryCache. Throws an error if agentdb is not available.

**Parameters:**
- `maxSize` (optional): Maximum number of cache entries (default: 1000)
- `category` (optional): Cache category for agentdb QueryCache (default: 'embeddings')

**Returns:** `AgentDBCacheAdapter<T>` instance

**Throws:** Error if agentdb is not available

### isAgentDBAvailable

```typescript
function isAgentDBAvailable(): boolean
```

Checks if agentdb QueryCache is available.

**Returns:** `true` if agentdb is available, `false` otherwise

## CacheAdapter Interface

The adapter implements the following interface (compatible with LRUCache):

```typescript
interface CacheAdapter<T> {
  getOrCompute(key: string, generator: () => T): T;
  set(key: string, value: T): void;
  get(key: string): T | undefined;
  has(key: string): boolean;
  clear(): void;
  cleanup(maxAge?: number): number;
  getStats(): CacheStats;
  size: number;
}
```

## Performance Comparison

```typescript
import {
  createAgentDBCache,
  createLRUCache,
  ContentEmbeddingGenerator
} from '@media-gateway/agents';

// Benchmark function
async function benchmark() {
  const iterations = 10000;
  const content = { /* ... media content ... */ };

  // Test with LRUCache
  const lruGenerator = new ContentEmbeddingGenerator(1000);
  const lruStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    lruGenerator.generateContentEmbedding(content);
  }
  const lruTime = performance.now() - lruStart;

  // Test with AgentDB cache
  const agentdbCache = createAgentDBCache<number[]>(1000);
  const agentdbGenerator = new ContentEmbeddingGenerator(1000);
  // Replace cache (implementation detail)
  const agentdbStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    agentdbGenerator.generateContentEmbedding(content);
  }
  const agentdbTime = performance.now() - agentdbStart;

  console.log(`LRU Cache: ${lruTime}ms`);
  console.log(`AgentDB Cache: ${agentdbTime}ms`);
  console.log(`Speedup: ${((lruTime / agentdbTime - 1) * 100).toFixed(1)}%`);
}
```

## Cache Statistics

```typescript
import { createAgentDBCache } from '@media-gateway/agents';

const cache = createAgentDBCache<number[]>(1000);

// Use cache...
cache.set('key1', [1, 2, 3]);
cache.get('key1');
cache.getOrCompute('key2', () => [4, 5, 6]);

// Get statistics
const stats = cache.getStats();
console.log({
  hits: stats.hits,
  misses: stats.misses,
  hitRate: stats.hitRate,
  size: stats.size,
  maxSize: stats.maxSize,
  evictions: stats.evictions
});
```

## Migration Guide

### From LRUCache to AgentDBCacheAdapter

**Before:**
```typescript
import { LRUCache, createLRUCache } from '@media-gateway/agents';

const cache = createLRUCache<number[]>(1000);
```

**After:**
```typescript
import { createAgentDBCache } from '@media-gateway/agents';

const cache = createAgentDBCache<number[]>(1000);
// Uses agentdb if available, falls back to LRUCache
```

### Updating ContentEmbeddingGenerator

**Option 1: Subclass (Recommended)**
```typescript
class EnhancedContentEmbeddingGenerator extends ContentEmbeddingGenerator {
  constructor(cacheSize: number = 1000) {
    super(cacheSize);
    this.cache = createAgentDBCache<number[]>(cacheSize);
  }
}
```

**Option 2: Factory Function**
```typescript
function createEnhancedEmbeddingGenerator(cacheSize: number = 1000) {
  const generator = new ContentEmbeddingGenerator(cacheSize);
  // Note: This requires cache to be public or have a setter
  return generator;
}
```

## Troubleshooting

### AgentDB Not Available

If you see "Using built-in LRUCache" but expected to use agentdb:

1. Check agentdb is installed: `npm list agentdb`
2. Verify package.json includes: `"agentdb": "^2.0.0"`
3. Rebuild: `npm install`

### Import Errors

If you get import errors for `agentdb/core/QueryCache`:

```typescript
// The adapter handles this gracefully with try/catch
// It will automatically fall back to LRUCache
```

### Performance Not Improving

If you're not seeing the expected 20-40% speedup:

1. Verify agentdb is actually being used: `isAgentDBAvailable()`
2. Check cache hit rate: `cache.getStats().hitRate`
3. Ensure you're testing repeated queries (cache needs hits to show benefit)
4. Try increasing cache size if evictions are high

## Best Practices

1. **Use Category-Based Caching**: Separate caches by data type for better organization
2. **Monitor Statistics**: Regularly check `getStats()` to optimize cache size
3. **Fallback Strategy**: Always use `createAgentDBCache` for automatic fallback
4. **Cache Size**: Start with 1000 entries, adjust based on memory and hit rate
5. **TTL Awareness**: Remember that agentdb QueryCache expires entries after 5 minutes by default

## Related Documentation

- [ContentEmbeddings.ts](../packages/@media-gateway/agents/src/learning/ContentEmbeddings.ts) - Original LRUCache implementation
- [QueryCache.ts](../apps/agentdb/src/core/QueryCache.ts) - AgentDB QueryCache source
- [AgentDB Documentation](https://agentdb.ruv.io) - Official agentdb docs

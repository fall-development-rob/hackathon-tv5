/**
 * AgentDB Cache Adapter
 *
 * Provides an adapter to use agentdb's QueryCache as a drop-in replacement
 * for ContentEmbeddings' LRUCache. Falls back to built-in LRUCache if agentdb
 * is not available.
 *
 * Benefits of using agentdb QueryCache:
 * - 20-40% speedup on repeated queries
 * - TTL (Time To Live) support for automatic expiration
 * - Memory-efficient size-based limits (10MB default)
 * - Thread-safe operations
 * - Automatic cache invalidation
 * - Hit/miss ratio tracking
 *
 * Usage:
 * ```typescript
 * import { createAgentDBCache } from '@media-gateway/agents';
 *
 * // Try to use agentdb QueryCache, fall back to LRUCache
 * const cache = createAgentDBCache<number[]>(1000);
 *
 * // Use with ContentEmbeddingGenerator
 * const generator = new ContentEmbeddingGenerator();
 * generator.setCache(cache);
 * ```
 */

import type { CacheEntry, CacheStats } from './ContentEmbeddings.js';
import { LRUCache } from './ContentEmbeddings.js';

// ============================================================================
// Interface Definition - Matches LRUCache<T>
// ============================================================================

export interface CacheAdapter<T> {
  getOrCompute(key: string, generator: () => T): T;
  set(key: string, value: T): void;
  get(key: string): T | undefined;
  has(key: string): boolean;
  clear(): void;
  cleanup(maxAge?: number): number;
  getStats(): CacheStats;
  size: number;
}

// ============================================================================
// AgentDB QueryCache Types (minimal interface for external package)
// ============================================================================

interface QueryCacheEntry<T = any> {
  value: T;
  key: string;
  timestamp: number;
  ttl: number;
  size: number;
  hits: number;
}

interface QueryCacheStatistics {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  capacity: number;
  evictions: number;
  memoryUsed: number;
  entriesByCategory: Record<string, number>;
}

interface QueryCacheInterface {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttl?: number): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  clear(): void;
  getStatistics(): QueryCacheStatistics;
  pruneExpired(): number;
}

// ============================================================================
// AgentDB Cache Adapter Implementation
// ============================================================================

export class AgentDBCacheAdapter<T> implements CacheAdapter<T> {
  private queryCache: QueryCacheInterface;
  private readonly category: string;

  constructor(queryCache: QueryCacheInterface, category: string = 'embeddings') {
    this.queryCache = queryCache;
    this.category = category;
  }

  /**
   * Get value from cache or compute it
   */
  getOrCompute(key: string, generator: () => T): T {
    const prefixedKey = this.getPrefixedKey(key);
    const cached = this.queryCache.get<T>(prefixedKey);

    if (cached !== undefined) {
      return cached;
    }

    // Cache miss - generate value
    const value = generator();
    this.queryCache.set(prefixedKey, value);
    return value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    const prefixedKey = this.getPrefixedKey(key);
    this.queryCache.set(prefixedKey, value);
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const prefixedKey = this.getPrefixedKey(key);
    return this.queryCache.get<T>(prefixedKey);
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const prefixedKey = this.getPrefixedKey(key);
    return this.queryCache.has(prefixedKey);
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.queryCache.clear();
  }

  /**
   * Cleanup expired entries
   * Note: QueryCache uses TTL automatically, so this calls pruneExpired()
   */
  cleanup(maxAge?: number): number {
    // QueryCache handles TTL automatically via pruneExpired
    // maxAge parameter is ignored as QueryCache uses TTL from constructor
    return this.queryCache.pruneExpired();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const stats = this.queryCache.getStatistics();

    return {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hitRate / 100, // QueryCache returns 0-100, we need 0-1
      size: stats.size,
      maxSize: stats.capacity,
      evictions: stats.evictions,
    };
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.queryCache.getStatistics().size;
  }

  /**
   * Get prefixed key for category-based caching
   */
  private getPrefixedKey(key: string): string {
    return `${this.category}:${key}`;
  }
}

// ============================================================================
// Factory Function with Fallback
// ============================================================================

/**
 * Create a cache adapter that uses agentdb's QueryCache when available,
 * otherwise falls back to built-in LRUCache.
 *
 * @param maxSize - Maximum number of cache entries (default: 1000)
 * @param category - Cache category for agentdb QueryCache (default: 'embeddings')
 * @returns CacheAdapter instance (AgentDB or LRU fallback)
 *
 * @example
 * ```typescript
 * // Create cache with agentdb QueryCache
 * const cache = createAgentDBCache<number[]>(1000);
 *
 * // Use with ContentEmbeddingGenerator
 * const generator = new ContentEmbeddingGenerator();
 * generator.setCache(cache);
 * ```
 */
export function createAgentDBCache<T>(
  maxSize: number = 1000,
  category: string = 'embeddings'
): CacheAdapter<T> {
  try {
    // Try to import QueryCache from agentdb
    // This is a dynamic import to gracefully handle missing package
    const agentdbModule = require('agentdb/core/QueryCache');
    const { QueryCache } = agentdbModule;

    if (QueryCache) {
      // Create QueryCache instance
      const queryCache = new QueryCache({
        maxSize,
        defaultTTL: 5 * 60 * 1000, // 5 minutes (matches QueryCache default)
        enabled: true,
        maxResultSize: 10 * 1024 * 1024, // 10MB (matches QueryCache default)
      });

      // Return adapter wrapping QueryCache
      return new AgentDBCacheAdapter<T>(queryCache, category);
    }
  } catch (error) {
    // agentdb not available, fall back to LRUCache
    // This is expected and not an error - just use built-in implementation
  }

  // Fallback to built-in LRUCache
  return new LRUCache<T>(maxSize);
}

/**
 * Create a cache adapter that ONLY uses agentdb's QueryCache.
 * Throws an error if agentdb is not available.
 *
 * @param maxSize - Maximum number of cache entries (default: 1000)
 * @param category - Cache category for agentdb QueryCache (default: 'embeddings')
 * @returns AgentDBCacheAdapter instance
 * @throws Error if agentdb is not available
 *
 * @example
 * ```typescript
 * try {
 *   const cache = createAgentDBCacheStrict<number[]>(1000);
 * } catch (error) {
 *   console.error('agentdb is required but not available');
 * }
 * ```
 */
export function createAgentDBCacheStrict<T>(
  maxSize: number = 1000,
  category: string = 'embeddings'
): AgentDBCacheAdapter<T> {
  try {
    // Try to import QueryCache from agentdb
    const agentdbModule = require('agentdb/core/QueryCache');
    const { QueryCache } = agentdbModule;

    if (!QueryCache) {
      throw new Error('QueryCache not found in agentdb package');
    }

    // Create QueryCache instance
    const queryCache = new QueryCache({
      maxSize,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      enabled: true,
      maxResultSize: 10 * 1024 * 1024, // 10MB
    });

    // Return adapter wrapping QueryCache
    return new AgentDBCacheAdapter<T>(queryCache, category);
  } catch (error) {
    throw new Error(
      `Failed to create AgentDB cache: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
      'Ensure agentdb package is installed: npm install agentdb'
    );
  }
}

/**
 * Check if agentdb QueryCache is available
 *
 * @returns true if agentdb is available, false otherwise
 *
 * @example
 * ```typescript
 * if (isAgentDBAvailable()) {
 *   console.log('Using agentdb QueryCache for 20-40% speedup');
 * } else {
 *   console.log('Using built-in LRUCache');
 * }
 * ```
 */
export function isAgentDBAvailable(): boolean {
  try {
    const agentdbModule = require('agentdb/core/QueryCache');
    return !!agentdbModule.QueryCache;
  } catch {
    return false;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default createAgentDBCache;

/**
 * FACT-Style Intelligent Caching for Media Gateway MCP
 * Inspired by https://github.com/ruvnet/FACT
 *
 * Implements three-tier caching strategy:
 * - Static: Long-lived reference data (schemas, genre mappings)
 * - Semi-dynamic: User preferences, viewing patterns
 * - Dynamic: Trending content, real-time recommendations
 */

// ============================================================================
// Cache Types
// ============================================================================

export type CacheTier = 'static' | 'semi-dynamic' | 'dynamic';

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  tier: CacheTier;
  createdAt: Date;
  expiresAt: Date;
  hits: number;
  lastAccessed: Date;
  metadata: Record<string, unknown> | undefined;
}

export interface CacheStats {
  totalEntries: number;
  byTier: Record<CacheTier, number>;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  memoryUsageEstimate: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}

// ============================================================================
// Default TTLs (matching FACT patterns)
// ============================================================================

const DEFAULT_TTL: Record<CacheTier, number> = {
  static: 24 * 60 * 60 * 1000, // 24 hours
  'semi-dynamic': 60 * 60 * 1000, // 1 hour
  dynamic: 5 * 60 * 1000, // 5 minutes
};

// ============================================================================
// Intelligent Cache Implementation
// ============================================================================

export class IntelligentCache {
  private cache: Map<string, CacheEntry> = new Map();
  private hits = 0;
  private misses = 0;

  /**
   * Set a value in the cache
   */
  set<T>(
    key: string,
    value: T,
    tier: CacheTier = 'dynamic',
    ttlMs?: number,
    metadata?: Record<string, unknown>
  ): void {
    const now = new Date();
    const ttl = ttlMs ?? DEFAULT_TTL[tier];

    this.cache.set(key, {
      key,
      value,
      tier,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttl),
      hits: 0,
      lastAccessed: now,
      metadata,
    });
  }

  /**
   * Get a value from the cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check expiration
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update access stats
    entry.hits++;
    entry.lastAccessed = new Date();
    this.hits++;

    return entry.value as T;
  }

  /**
   * Check if a key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a key from the cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    tier: CacheTier = 'dynamic',
    ttlMs?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    this.set(key, value, tier, ttlMs);
    return value;
  }

  /**
   * Invalidate entries matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): number {
    let count = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Invalidate all entries for a tier
   */
  invalidateTier(tier: CacheTier): number {
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tier === tier) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Prune expired entries
   */
  prune(): number {
    const now = new Date();
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const byTier: Record<CacheTier, number> = {
      static: 0,
      'semi-dynamic': 0,
      dynamic: 0,
    };

    let oldestEntry: Date | null = null;
    let newestEntry: Date | null = null;
    let estimatedMemory = 0;

    for (const entry of this.cache.values()) {
      byTier[entry.tier]++;

      if (!oldestEntry || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
      if (!newestEntry || entry.createdAt > newestEntry) {
        newestEntry = entry.createdAt;
      }

      // Rough memory estimate
      estimatedMemory += JSON.stringify(entry.value).length * 2;
    }

    return {
      totalEntries: this.cache.size,
      byTier,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      totalHits: this.hits,
      totalMisses: this.misses,
      memoryUsageEstimate: estimatedMemory,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Export cache for persistence
   */
  export(): Array<CacheEntry> {
    return Array.from(this.cache.values());
  }

  /**
   * Import cache from persistence
   */
  import(entries: Array<CacheEntry>): number {
    let imported = 0;
    const now = new Date();

    for (const entry of entries) {
      // Only import non-expired entries
      if (new Date(entry.expiresAt) > now) {
        this.cache.set(entry.key, {
          ...entry,
          createdAt: new Date(entry.createdAt),
          expiresAt: new Date(entry.expiresAt),
          lastAccessed: new Date(entry.lastAccessed),
        });
        imported++;
      }
    }

    return imported;
  }
}

// ============================================================================
// Specialized Caches for Media Gateway
// ============================================================================

export class MediaGatewayCache {
  private cache = new IntelligentCache();

  // Key prefixes for different data types
  private readonly PREFIXES = {
    userPrefs: 'user_prefs:',
    trending: 'trending:',
    content: 'content:',
    search: 'search:',
    recommendations: 'recs:',
    genres: 'genres:',
    platforms: 'platforms:',
  };

  /**
   * Cache user preferences (semi-dynamic, 1 hour)
   */
  setUserPreferences(userId: string, prefs: unknown): void {
    this.cache.set(`${this.PREFIXES.userPrefs}${userId}`, prefs, 'semi-dynamic');
  }

  getUserPreferences<T>(userId: string): T | null {
    return this.cache.get<T>(`${this.PREFIXES.userPrefs}${userId}`);
  }

  /**
   * Cache trending content (dynamic, 5 minutes)
   */
  setTrending(category: string, content: unknown): void {
    this.cache.set(`${this.PREFIXES.trending}${category}`, content, 'dynamic');
  }

  getTrending<T>(category: string): T | null {
    return this.cache.get<T>(`${this.PREFIXES.trending}${category}`);
  }

  /**
   * Cache content metadata (semi-dynamic, 1 hour)
   */
  setContent(contentId: number, content: unknown): void {
    this.cache.set(`${this.PREFIXES.content}${contentId}`, content, 'semi-dynamic');
  }

  getContent<T>(contentId: number): T | null {
    return this.cache.get<T>(`${this.PREFIXES.content}${contentId}`);
  }

  /**
   * Cache search results (dynamic, 5 minutes)
   */
  setSearchResults(queryHash: string, results: unknown): void {
    this.cache.set(`${this.PREFIXES.search}${queryHash}`, results, 'dynamic');
  }

  getSearchResults<T>(queryHash: string): T | null {
    return this.cache.get<T>(`${this.PREFIXES.search}${queryHash}`);
  }

  /**
   * Cache recommendations (dynamic, 5 minutes)
   */
  setRecommendations(userId: string, context: string, recs: unknown): void {
    this.cache.set(`${this.PREFIXES.recommendations}${userId}:${context}`, recs, 'dynamic');
  }

  getRecommendations<T>(userId: string, context: string): T | null {
    return this.cache.get<T>(`${this.PREFIXES.recommendations}${userId}:${context}`);
  }

  /**
   * Cache genre mappings (static, 24 hours)
   */
  setGenres(genres: unknown): void {
    this.cache.set(`${this.PREFIXES.genres}all`, genres, 'static');
  }

  getGenres<T>(): T | null {
    return this.cache.get<T>(`${this.PREFIXES.genres}all`);
  }

  /**
   * Cache platform availability (semi-dynamic, 1 hour)
   */
  setPlatforms(contentId: number, platforms: unknown): void {
    this.cache.set(`${this.PREFIXES.platforms}${contentId}`, platforms, 'semi-dynamic');
  }

  getPlatforms<T>(contentId: number): T | null {
    return this.cache.get<T>(`${this.PREFIXES.platforms}${contentId}`);
  }

  /**
   * Invalidate all user-related cache entries
   */
  invalidateUser(userId: string): number {
    return this.cache.invalidatePattern(new RegExp(`(user_prefs|recs):${userId}`));
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * Prune expired entries
   */
  prune(): number {
    return this.cache.prune();
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Export for persistence
   */
  export(): Array<CacheEntry> {
    return this.cache.export();
  }

  /**
   * Import from persistence
   */
  import(entries: Array<CacheEntry>): number {
    return this.cache.import(entries);
  }
}

// ============================================================================
// MCP Tool Definitions for Caching
// ============================================================================

export const cacheTools = [
  {
    name: 'cache_get',
    description: 'Get a value from the intelligent cache. Supports different data types: user_preferences, trending, content, search, recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['user_preferences', 'trending', 'content', 'search', 'recommendations', 'genres', 'platforms'],
          description: 'Type of cached data',
        },
        key: { type: 'string', description: 'Key identifier (userId, contentId, query hash, etc.)' },
        context: { type: 'string', description: 'Additional context (for recommendations)' },
      },
      required: ['type', 'key'],
    },
  },
  {
    name: 'cache_set',
    description: 'Set a value in the intelligent cache with appropriate TTL based on data type.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['user_preferences', 'trending', 'content', 'search', 'recommendations', 'genres', 'platforms'],
          description: 'Type of data to cache',
        },
        key: { type: 'string', description: 'Key identifier' },
        value: { type: 'object', description: 'Value to cache' },
        context: { type: 'string', description: 'Additional context (for recommendations)' },
        ttl_seconds: { type: 'number', description: 'Custom TTL in seconds (optional)' },
      },
      required: ['type', 'key', 'value'],
    },
  },
  {
    name: 'cache_invalidate',
    description: 'Invalidate cache entries by pattern or user ID.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex pattern to match keys' },
        user_id: { type: 'string', description: 'User ID to invalidate all caches for' },
        type: {
          type: 'string',
          enum: ['user_preferences', 'trending', 'content', 'search', 'recommendations'],
          description: 'Type of cache to invalidate',
        },
      },
    },
  },
  {
    name: 'cache_stats',
    description: 'Get cache statistics including hit rate, memory usage, and entry distribution by tier.',
    inputSchema: {
      type: 'object',
      properties: {
        detailed: { type: 'boolean', description: 'Include detailed breakdown', default: false },
      },
    },
  },
  {
    name: 'cache_prune',
    description: 'Remove expired entries from the cache to free memory.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'cache_warm',
    description: 'Pre-warm the cache with common data (genres, popular content). Improves first-request latency.',
    inputSchema: {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['genres', 'trending', 'popular_content'],
          },
          description: 'Categories to warm',
        },
      },
      required: ['categories'],
    },
  },
  {
    name: 'cache_export',
    description: 'Export cache state for persistence or backup.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'cache_import',
    description: 'Import previously exported cache state.',
    inputSchema: {
      type: 'object',
      properties: {
        entries: { type: 'array', description: 'Cache entries to import' },
      },
      required: ['entries'],
    },
  },
];

// Singleton instance
export const mediaGatewayCache = new MediaGatewayCache();

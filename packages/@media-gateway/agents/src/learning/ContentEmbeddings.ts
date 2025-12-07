/**
 * Content Embedding System with LRU Caching
 *
 * Generates 64-dimensional embeddings for media content:
 * - Genre vectors (10 dims): predefined vectors per genre
 * - Content type (8 dims): one-hot encoding
 * - Metadata (8 dims): normalized popularity, rating, recency, duration
 * - Keywords (38 dims): hash-based distribution
 *
 * Weighting: genre(0.30), type(0.15), metadata(0.25), keywords(0.30)
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface MediaContent {
  id: string;
  title: string;
  overview?: string;
  genres: string[];
  contentType: 'movie' | 'tv' | 'documentary' | 'other';
  popularity?: number;
  rating?: number;
  releaseDate?: string;
  runtime?: number; // in minutes
  metadata?: Record<string, any>;
}

export interface UserPreferences {
  favoriteGenres: string[];
  preferredContentTypes: string[];
  ratingThreshold?: number;
  recencyPreference?: number; // 0-1, higher = prefer newer content
  metadata?: Record<string, any>;
}

export interface QState {
  genres?: string[];
  contentType?: string;
  minRating?: number;
  maxAge?: number; // in years
  metadata?: Record<string, any>;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
  evictions: number;
}

export interface EmbeddingWeights {
  genre: number;
  type: number;
  metadata: number;
  keywords: number;
}

// ============================================================================
// LRU Cache Implementation
// ============================================================================

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly maxSize: number;
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
  };

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Get value from cache or compute it
   */
  getOrCompute(key: string, generator: () => T): T {
    const entry = this.cache.get(key);

    if (entry) {
      // Cache hit - update access stats
      this.stats.hits++;
      entry.accessCount++;
      entry.lastAccessed = Date.now();

      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, entry);

      return entry.value;
    }

    // Cache miss - generate value
    this.stats.misses++;
    const value = generator();

    // Add to cache
    this.set(key, value);

    return value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    // Remove if exists to reorder
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }

    // Add new entry
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
    };

    this.cache.set(key, entry);
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (entry) {
      this.stats.hits++;
      entry.accessCount++;
      entry.lastAccessed = Date.now();

      // Move to end
      this.cache.delete(key);
      this.cache.set(key, entry);

      return entry.value;
    }

    this.stats.misses++;
    return undefined;
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanup(maxAge?: number): number {
    if (!maxAge) return 0;

    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      size: this.cache.size,
      maxSize: this.maxSize,
      evictions: this.stats.evictions,
    };
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Genre Vectors (10 dimensions)
// ============================================================================

const GENRE_VECTORS: Record<string, number[]> = {
  action: [1.0, 0.8, 0.2, 0.1, 0.0, 0.3, 0.9, 0.1, 0.2, 0.4],
  adventure: [0.8, 1.0, 0.4, 0.3, 0.2, 0.5, 0.7, 0.2, 0.3, 0.6],
  animation: [0.2, 0.4, 1.0, 0.8, 0.6, 0.7, 0.3, 0.9, 0.5, 0.4],
  comedy: [0.1, 0.3, 0.8, 1.0, 0.7, 0.6, 0.2, 0.8, 0.7, 0.3],
  crime: [0.9, 0.5, 0.1, 0.2, 1.0, 0.4, 0.8, 0.0, 0.3, 0.7],
  documentary: [0.0, 0.1, 0.3, 0.2, 0.4, 1.0, 0.1, 0.5, 0.8, 0.6],
  drama: [0.3, 0.4, 0.5, 0.6, 0.5, 0.7, 1.0, 0.4, 0.6, 0.8],
  family: [0.2, 0.5, 0.9, 0.8, 0.1, 0.6, 0.4, 1.0, 0.5, 0.3],
  fantasy: [0.5, 0.8, 0.7, 0.4, 0.2, 0.3, 0.6, 0.5, 1.0, 0.7],
  horror: [0.8, 0.3, 0.1, 0.0, 0.7, 0.2, 0.5, 0.1, 0.4, 1.0],
  mystery: [0.6, 0.4, 0.2, 0.3, 0.8, 0.5, 0.6, 0.2, 0.5, 0.7],
  romance: [0.1, 0.3, 0.6, 0.7, 0.2, 0.4, 0.9, 0.6, 0.3, 0.2],
  'science fiction': [0.7, 0.6, 0.4, 0.2, 0.3, 0.5, 0.4, 0.3, 0.9, 0.5],
  thriller: [0.9, 0.5, 0.1, 0.2, 0.9, 0.3, 0.6, 0.1, 0.4, 0.8],
  western: [0.7, 0.8, 0.2, 0.3, 0.6, 0.4, 0.7, 0.2, 0.3, 0.5],
  war: [0.9, 0.6, 0.1, 0.1, 0.5, 0.6, 0.8, 0.2, 0.3, 0.6],
  music: [0.2, 0.3, 0.7, 0.8, 0.2, 0.5, 0.6, 0.7, 0.4, 0.3],
  history: [0.3, 0.4, 0.3, 0.2, 0.4, 0.9, 0.7, 0.3, 0.4, 0.5],
  tv: [0.4, 0.5, 0.6, 0.7, 0.4, 0.6, 0.8, 0.6, 0.5, 0.4],
  default: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
};

// ============================================================================
// Content Embedding Generator
// ============================================================================

export class ContentEmbeddingGenerator {
  private cache: LRUCache<number[]>;
  private readonly weights: EmbeddingWeights;

  constructor(
    cacheSize: number = 1000,
    weights?: Partial<EmbeddingWeights>
  ) {
    this.cache = new LRUCache<number[]>(cacheSize);
    this.weights = {
      genre: weights?.genre ?? 0.30,
      type: weights?.type ?? 0.15,
      metadata: weights?.metadata ?? 0.25,
      keywords: weights?.keywords ?? 0.30,
    };
  }

  // ==========================================================================
  // Genre Vector Generation (10 dimensions)
  // ==========================================================================

  private generateGenreVector(genres: string[]): number[] {
    if (genres.length === 0) {
      return GENRE_VECTORS.default.slice();
    }

    // Average vectors for multiple genres
    const vector = new Array(10).fill(0);
    let count = 0;

    for (const genre of genres) {
      const normalized = genre.toLowerCase().trim();
      const genreVector = GENRE_VECTORS[normalized] || GENRE_VECTORS.default;

      for (let i = 0; i < 10; i++) {
        vector[i] += genreVector[i];
      }
      count++;
    }

    // Average
    if (count > 0) {
      for (let i = 0; i < 10; i++) {
        vector[i] /= count;
      }
    }

    return vector;
  }

  // ==========================================================================
  // Content Type One-Hot Encoding (8 dimensions)
  // ==========================================================================

  private generateContentTypeVector(contentType: string): number[] {
    const vector = new Array(8).fill(0);

    switch (contentType.toLowerCase()) {
      case 'movie':
        vector[0] = 1.0;
        vector[1] = 0.8;
        break;
      case 'tv':
        vector[2] = 1.0;
        vector[3] = 0.8;
        break;
      case 'documentary':
        vector[4] = 1.0;
        vector[5] = 0.8;
        break;
      default:
        vector[6] = 1.0;
        vector[7] = 0.5;
    }

    return vector;
  }

  // ==========================================================================
  // Metadata Normalization (8 dimensions)
  // ==========================================================================

  private generateMetadataVector(content: MediaContent): number[] {
    const vector = new Array(8).fill(0);

    // Popularity (normalized 0-1)
    vector[0] = Math.min(1.0, (content.popularity ?? 0) / 100);
    vector[1] = Math.sqrt(vector[0]); // Non-linear scaling

    // Rating (normalized 0-1)
    vector[2] = Math.min(1.0, (content.rating ?? 5) / 10);
    vector[3] = Math.pow(vector[2], 1.5); // Emphasize higher ratings

    // Recency (normalized 0-1, newer = higher)
    const recency = this.calculateRecency(content.releaseDate);
    vector[4] = recency;
    vector[5] = Math.pow(recency, 0.7); // Gentle decay

    // Duration (normalized 0-1)
    const duration = this.normalizeDuration(content.runtime ?? 0);
    vector[6] = duration;
    vector[7] = Math.log1p(duration) / Math.log1p(1); // Log scaling

    return vector;
  }

  private calculateRecency(releaseDate?: string): number {
    if (!releaseDate) return 0.5;

    const now = new Date();
    const release = new Date(releaseDate);
    const ageInYears = (now.getTime() - release.getTime()) / (1000 * 60 * 60 * 24 * 365);

    // Decay over 20 years
    return Math.max(0, 1 - (ageInYears / 20));
  }

  private normalizeDuration(runtime: number): number {
    // Normalize 0-300 minutes to 0-1
    return Math.min(1.0, runtime / 300);
  }

  // ==========================================================================
  // Keyword Hash-Based Distribution (38 dimensions)
  // ==========================================================================

  private generateKeywordVector(text: string): number[] {
    const vector = new Array(38).fill(0);

    if (!text) return vector;

    // Extract keywords (simple tokenization)
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3); // Filter short words

    // Hash each word to dimensions
    for (const word of words) {
      const hash = this.hashString(word);
      const idx = hash % 38;
      vector[idx] += 1.0;
    }

    // Normalize by word count
    const total = words.length || 1;
    for (let i = 0; i < 38; i++) {
      vector[i] /= total;
    }

    return vector;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // ==========================================================================
  // Main Embedding Generation
  // ==========================================================================

  /**
   * Generate content embedding (64 dimensions)
   */
  generateContentEmbedding(content: MediaContent): number[] {
    return this.cache.getOrCompute(content.id, () => {
      // Generate component vectors
      const genreVec = this.generateGenreVector(content.genres);
      const typeVec = this.generateContentTypeVector(content.contentType);
      const metaVec = this.generateMetadataVector(content);
      const keywordVec = this.generateKeywordVector(content.overview ?? '');

      // Combine with weights
      const embedding = [
        ...genreVec.map(v => v * this.weights.genre),
        ...typeVec.map(v => v * this.weights.type),
        ...metaVec.map(v => v * this.weights.metadata),
        ...keywordVec.map(v => v * this.weights.keywords),
      ];

      // L2 normalization
      return this.l2Normalize(embedding);
    });
  }

  /**
   * Generate user preference embedding
   */
  generateUserPreferenceEmbedding(preferences: UserPreferences): number[] {
    const cacheKey = JSON.stringify(preferences);

    return this.cache.getOrCompute(cacheKey, () => {
      // Genre preferences
      const genreVec = this.generateGenreVector(preferences.favoriteGenres || []);

      // Content type preferences
      const typeVec = preferences.preferredContentTypes?.length
        ? this.combineEmbeddings(
            preferences.preferredContentTypes.map(t => this.generateContentTypeVector(t)),
            preferences.preferredContentTypes.map(() => 1.0)
          ).slice(0, 8)
        : new Array(8).fill(0.5);

      // Metadata preferences
      const metaVec = new Array(8).fill(0);
      metaVec[0] = 0.7; // Popularity preference
      metaVec[2] = (preferences.ratingThreshold ?? 7) / 10;
      metaVec[4] = preferences.recencyPreference ?? 0.5;
      metaVec[6] = 0.5; // Duration neutral

      // Keywords empty for preferences
      const keywordVec = new Array(38).fill(0);

      const embedding = [
        ...genreVec.map(v => v * this.weights.genre),
        ...typeVec.map(v => v * this.weights.type),
        ...metaVec.map(v => v * this.weights.metadata),
        ...keywordVec.map(v => v * this.weights.keywords),
      ];

      return this.l2Normalize(embedding);
    });
  }

  /**
   * Generate state embedding for Q-learning
   */
  generateStateEmbedding(qState: QState): number[] {
    const cacheKey = JSON.stringify(qState);

    return this.cache.getOrCompute(cacheKey, () => {
      // Genre state
      const genreVec = this.generateGenreVector(qState.genres || []);

      // Content type state
      const typeVec = qState.contentType
        ? this.generateContentTypeVector(qState.contentType)
        : new Array(8).fill(0.5);

      // Metadata state
      const metaVec = new Array(8).fill(0);
      metaVec[2] = (qState.minRating ?? 0) / 10;
      metaVec[4] = qState.maxAge ? Math.max(0, 1 - (qState.maxAge / 20)) : 0.5;
      metaVec[0] = 0.5;
      metaVec[6] = 0.5;

      // Keywords empty for state
      const keywordVec = new Array(38).fill(0);

      const embedding = [
        ...genreVec.map(v => v * this.weights.genre),
        ...typeVec.map(v => v * this.weights.type),
        ...metaVec.map(v => v * this.weights.metadata),
        ...keywordVec.map(v => v * this.weights.keywords),
      ];

      return this.l2Normalize(embedding);
    });
  }

  // ==========================================================================
  // Similarity Functions
  // ==========================================================================

  /**
   * Cosine similarity with loop unrolling
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    // Loop unrolling for performance (process 4 elements at a time)
    const len = a.length;
    const unrolled = Math.floor(len / 4) * 4;

    for (let i = 0; i < unrolled; i += 4) {
      dotProduct += a[i] * b[i] + a[i+1] * b[i+1] + a[i+2] * b[i+2] + a[i+3] * b[i+3];
      normA += a[i] * a[i] + a[i+1] * a[i+1] + a[i+2] * a[i+2] + a[i+3] * a[i+3];
      normB += b[i] * b[i] + b[i+1] * b[i+1] + b[i+2] * b[i+2] + b[i+3] * b[i+3];
    }

    // Handle remaining elements
    for (let i = unrolled; i < len; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Euclidean distance
   */
  euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  /**
   * Find top-K similar items
   */
  batchTopK(
    query: number[],
    candidates: Array<{ id: string; embedding: number[] }>,
    k: number
  ): Array<{ id: string; similarity: number }> {
    // Calculate similarities
    const similarities = candidates.map(candidate => ({
      id: candidate.id,
      similarity: this.cosineSimilarity(query, candidate.embedding),
    }));

    // Sort and take top-K
    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, k);
  }

  // ==========================================================================
  // Utility Functions
  // ==========================================================================

  /**
   * Combine multiple embeddings with weights
   */
  combineEmbeddings(embeddings: number[][], weights: number[]): number[] {
    if (embeddings.length === 0) {
      throw new Error('At least one embedding required');
    }

    if (embeddings.length !== weights.length) {
      throw new Error('Embeddings and weights must have same length');
    }

    const dim = embeddings[0].length;
    const combined = new Array(dim).fill(0);

    // Normalize weights
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const normalizedWeights = weights.map(w => w / totalWeight);

    // Weighted sum
    for (let i = 0; i < embeddings.length; i++) {
      const embedding = embeddings[i];
      const weight = normalizedWeights[i];

      for (let j = 0; j < dim; j++) {
        combined[j] += embedding[j] * weight;
      }
    }

    return this.l2Normalize(combined);
  }

  /**
   * L2 normalization
   */
  l2Normalize(vector: number[]): number[] {
    let norm = 0;
    for (let i = 0; i < vector.length; i++) {
      norm += vector[i] * vector[i];
    }

    norm = Math.sqrt(norm);

    if (norm === 0) return vector;

    return vector.map(v => v / norm);
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Cleanup expired entries
   */
  cleanupCache(maxAge?: number): number {
    return this.cache.cleanup(maxAge);
  }

  /**
   * Get cache instance
   */
  getCache(): LRUCache<number[]> {
    return this.cache;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create content embedding generator
 */
export function createContentEmbeddingGenerator(
  cacheSize?: number,
  weights?: Partial<EmbeddingWeights>
): ContentEmbeddingGenerator {
  return new ContentEmbeddingGenerator(cacheSize, weights);
}

/**
 * Create LRU cache
 */
export function createLRUCache<T>(maxSize?: number): LRUCache<T> {
  return new LRUCache<T>(maxSize);
}

// ============================================================================
// Exports
// ============================================================================

export default ContentEmbeddingGenerator;

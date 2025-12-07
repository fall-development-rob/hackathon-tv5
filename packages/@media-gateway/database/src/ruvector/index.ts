/**
 * RuVector Integration for Media Gateway
 * High-performance vector embeddings and search
 */

import type { MediaContent } from '@media-gateway/core';

// Vector dimensions (text-embedding-3-small compatible)
const EMBEDDING_DIMENSIONS = 768;
const MAX_ELEMENTS = 100000;

/**
 * Content metadata stored with vectors
 */
interface ContentVectorMetadata {
  contentId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  overview: string;
  genreIds: number[];
  voteAverage: number;
  releaseDate: string;
  posterPath: string | null;
}

/**
 * RuVector wrapper for content embeddings
 */
export class RuVectorWrapper {
  private db: any;
  private initialized: boolean = false;
  private embeddingCache: Map<string, { embedding: Float32Array; timestamp: number }> = new Map();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(private storagePath: string = './data/media-vectors.db') {}

  /**
   * Initialize RuVector database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const { VectorDB } = await import('ruvector');

      this.db = new VectorDB({
        dimensions: EMBEDDING_DIMENSIONS,
        maxElements: MAX_ELEMENTS,
        storagePath: this.storagePath,
      });

      this.initialized = true;
      console.log(`✅ RuVector initialized with ${EMBEDDING_DIMENSIONS} dimensions`);
    } catch (error) {
      console.error('Failed to initialize RuVector:', error);
      throw error;
    }
  }

  /**
   * Ensure database is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('RuVector not initialized. Call initialize() first.');
    }
  }

  /**
   * Generate embedding for text using OpenAI API
   * Tries Vertex AI first if credentials are available
   */
  async generateEmbedding(text: string): Promise<Float32Array | null> {
    // Check cache first
    const cacheKey = text.toLowerCase().trim();
    const cached = this.embeddingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.embedding;
    }

    // Try Vertex AI first if credentials are available
    const hasVertexAI = process.env['GOOGLE_VERTEX_PROJECT_ID'] && process.env['GOOGLE_ACCESS_TOKEN'];
    if (hasVertexAI) {
      const vertexEmbedding = await this.generateEmbeddingWithVertexAI(text);
      if (vertexEmbedding) {
        return vertexEmbedding;
      }
    }

    // Fall back to OpenAI
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) {
      console.warn('OpenAI API key not set, using mock embedding');
      return this.generateMockEmbedding(text);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const embedding = new Float32Array(data.data[0].embedding);

      // Cache the result
      this.embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });
      this.cleanupCache();

      return embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      return null;
    }
  }

  /**
   * Generate embedding using Google Vertex AI
   * Uses text-embedding-004 for 768-dim embeddings
   */
  async generateEmbeddingWithVertexAI(text: string): Promise<Float32Array | null> {
    const projectId = process.env['GOOGLE_VERTEX_PROJECT_ID'];
    const accessToken = process.env['GOOGLE_ACCESS_TOKEN'];

    if (!projectId || !accessToken) {
      console.warn('Google Vertex AI credentials not set, falling back to default embedding');
      return this.generateEmbedding(text);
    }

    try {
      const response = await fetch(
        `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/text-embedding-004:predict`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instances: [{ content: text }],
            parameters: { outputDimensionality: EMBEDDING_DIMENSIONS }
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Vertex AI error: ${response.status}`);
      }

      const data = await response.json();
      const values = data.predictions?.[0]?.embeddings?.values;

      if (values && values.length === EMBEDDING_DIMENSIONS) {
        const embedding = new Float32Array(values);
        this.embeddingCache.set(text.toLowerCase().trim(), { embedding, timestamp: Date.now() });
        return embedding;
      }

      throw new Error('Invalid embedding response from Vertex AI');
    } catch (error) {
      console.warn('Vertex AI embedding failed, falling back:', error);
      return this.generateEmbedding(text);
    }
  }

  /**
   * Generate mock embedding for testing
   */
  private generateMockEmbedding(text: string): Float32Array {
    const embedding = new Float32Array(EMBEDDING_DIMENSIONS);
    const textLower = text.toLowerCase();

    for (let i = 0; i < textLower.length; i++) {
      const charCode = textLower.charCodeAt(i);
      const idx = (charCode + i) % EMBEDDING_DIMENSIONS;
      embedding[idx] += Math.sin(charCode / 10) * 0.1;
    }

    // Normalize
    let magnitude = 0;
    for (let i = 0; i < embedding.length; i++) {
      magnitude += embedding[i]! * embedding[i]!;
    }
    magnitude = Math.sqrt(magnitude);

    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] = embedding[i]! / magnitude;
      }
    }

    return embedding;
  }

  /**
   * Cleanup old cache entries
   */
  private cleanupCache(): void {
    if (this.embeddingCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of this.embeddingCache) {
        if (now - value.timestamp > this.cacheTTL) {
          this.embeddingCache.delete(key);
        }
      }
    }
  }

  /**
   * Store content embedding
   */
  async storeContentEmbedding(
    content: MediaContent,
    embedding: Float32Array
  ): Promise<string> {
    this.ensureInitialized();

    const id = `${content.mediaType}-${content.id}`;

    await this.db.insert({
      id,
      vector: embedding,
      metadata: {
        contentId: content.id,
        mediaType: content.mediaType,
        title: content.title,
        overview: content.overview,
        genreIds: content.genreIds,
        voteAverage: content.voteAverage,
        releaseDate: content.releaseDate,
        posterPath: content.posterPath,
      } as ContentVectorMetadata,
    });

    return id;
  }

  /**
   * Batch store content embeddings
   */
  async batchStoreEmbeddings(
    contents: Array<{ content: MediaContent; embedding: Float32Array }>
  ): Promise<string[]> {
    this.ensureInitialized();

    const ids: string[] = [];

    for (const { content, embedding } of contents) {
      const id = await this.storeContentEmbedding(content, embedding);
      ids.push(id);
    }

    console.log(`✅ Stored ${ids.length} embeddings`);
    return ids;
  }

  /**
   * Search for similar content by embedding
   */
  async searchByEmbedding(
    queryEmbedding: Float32Array,
    k: number = 10,
    threshold: number = 0.5,
    filter?: { mediaType?: 'movie' | 'tv'; genres?: number[] }
  ): Promise<Array<{ content: MediaContent; score: number }>> {
    this.ensureInitialized();

    const results = await this.db.search({
      vector: queryEmbedding,
      k: k * 2, // Over-fetch for filtering
      threshold,
    });

    // Apply filters
    let filtered = results.filter(
      (r: any) => r.metadata && 'contentId' in r.metadata
    );

    if (filter?.mediaType) {
      filtered = filtered.filter(
        (r: any) => r.metadata.mediaType === filter.mediaType
      );
    }

    if (filter?.genres && filter.genres.length > 0) {
      filtered = filtered.filter((r: any) =>
        r.metadata.genreIds?.some((g: number) => filter.genres!.includes(g))
      );
    }

    return filtered.slice(0, k).map((result: any) => {
      const meta = result.metadata as ContentVectorMetadata;
      return {
        content: {
          id: meta.contentId,
          title: meta.title,
          overview: meta.overview,
          mediaType: meta.mediaType,
          genreIds: meta.genreIds,
          voteAverage: meta.voteAverage,
          releaseDate: meta.releaseDate,
          posterPath: meta.posterPath,
          backdropPath: null,
          voteCount: 0,
          popularity: 0,
        },
        score: result.score,
      };
    });
  }

  /**
   * Semantic search using natural language
   */
  async semanticSearch(
    query: string,
    k: number = 10,
    filter?: { mediaType?: 'movie' | 'tv'; genres?: number[] }
  ): Promise<Array<{ content: MediaContent; score: number }>> {
    const embedding = await this.generateEmbedding(query);
    if (!embedding) {
      return [];
    }

    return this.searchByEmbedding(embedding, k, 0.3, filter);
  }

  /**
   * Find similar content to a given item
   */
  async findSimilarContent(
    contentId: number,
    mediaType: 'movie' | 'tv',
    k: number = 10
  ): Promise<Array<{ content: MediaContent; score: number }>> {
    this.ensureInitialized();

    const id = `${mediaType}-${contentId}`;
    const existing = await this.db.get(id);

    if (!existing) {
      return [];
    }

    const results = await this.searchByEmbedding(existing.vector, k + 1, 0.3);
    return results.filter(r => r.content.id !== contentId).slice(0, k);
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    vectorCount: number;
    dimensions: number;
    storagePath: string;
  }> {
    this.ensureInitialized();

    const count = await this.db.len();

    return {
      vectorCount: count,
      dimensions: EMBEDDING_DIMENSIONS,
      storagePath: this.storagePath,
    };
  }

  /**
   * Delete content vector
   */
  async deleteContentVector(
    contentId: number,
    mediaType: 'movie' | 'tv'
  ): Promise<boolean> {
    this.ensureInitialized();

    const id = `${mediaType}-${contentId}`;
    return await this.db.delete(id);
  }
}

/**
 * Create and initialize a RuVector wrapper instance
 */
export async function createRuVector(storagePath?: string): Promise<RuVectorWrapper> {
  const wrapper = new RuVectorWrapper(storagePath);
  await wrapper.initialize();
  return wrapper;
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(
  embedding1: Float32Array,
  embedding2: Float32Array
): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i]! * embedding2[i]!;
    magnitude1 += embedding1[i]! * embedding1[i]!;
    magnitude2 += embedding2[i]! * embedding2[i]!;
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

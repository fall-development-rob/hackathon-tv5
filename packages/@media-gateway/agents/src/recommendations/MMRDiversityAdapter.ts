/**
 * MMR Diversity Adapter
 *
 * Adapter that wraps agentdb's MMRDiversityRanker for use in @media-gateway/agents
 * DiversityFilter, maintaining backward compatibility with existing interfaces.
 *
 * Key differences handled by the adapter:
 * - DiversityFilter uses Float32Array embeddings, agentdb uses number[]
 * - DiversityFilter uses lambda=0.85 default, agentdb uses lambda=0.5
 * - DiversityFilter has RecommendationCandidate, agentdb has MMRCandidate
 *
 * @module MMRDiversityAdapter
 */

import type {
  RecommendationCandidate,
  DiversityMetrics,
} from './DiversityFilter.js';

/**
 * MMR Candidate interface matching agentdb's MMRDiversityRanker
 */
export interface MMRCandidate {
  id: number;
  embedding: number[];
  similarity: number;
  [key: string]: any;
}

/**
 * MMR Options matching agentdb's MMRDiversityRanker
 */
export interface MMROptions {
  lambda?: number;
  k?: number;
  metric?: 'cosine' | 'euclidean' | 'dot';
}

/**
 * Static MMR Diversity Ranker implementation
 * (Inline implementation for when agentdb is not available)
 */
class MMRDiversityRankerImpl {
  static selectDiverse(
    candidates: MMRCandidate[],
    queryEmbedding: number[],
    options: MMROptions = {}
  ): MMRCandidate[] {
    const lambda = options.lambda ?? 0.5;
    const k = options.k ?? 10;
    const metric = options.metric ?? 'cosine';

    if (candidates.length === 0) {
      return [];
    }

    if (candidates.length <= k) {
      return candidates;
    }

    // Calculate initial similarities to query
    const candidatesWithSim = candidates.map(c => ({
      ...c,
      similarity: c.similarity ?? this.calculateSimilarity(queryEmbedding, c.embedding, metric),
    }));

    const selected: MMRCandidate[] = [];
    const remaining = [...candidatesWithSim];

    // Select first item (highest relevance)
    remaining.sort((a, b) => b.similarity - a.similarity);
    selected.push(remaining.shift()!);

    // Iteratively select items with highest MMR score
    while (selected.length < k && remaining.length > 0) {
      let maxMMR = -Infinity;
      let maxIdx = 0;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i]!;

        // Calculate max similarity to already-selected items
        let maxSimToSelected = -Infinity;
        for (const selectedItem of selected) {
          const sim = this.calculateSimilarity(candidate.embedding, selectedItem.embedding, metric);
          maxSimToSelected = Math.max(maxSimToSelected, sim);
        }

        // Calculate MMR score
        const mmrScore = lambda * candidate.similarity - (1 - lambda) * maxSimToSelected;

        if (mmrScore > maxMMR) {
          maxMMR = mmrScore;
          maxIdx = i;
        }
      }

      // Add item with highest MMR score
      selected.push(remaining.splice(maxIdx, 1)[0]!);
    }

    return selected;
  }

  private static calculateSimilarity(
    vec1: number[],
    vec2: number[],
    metric: 'cosine' | 'euclidean' | 'dot'
  ): number {
    if (vec1.length !== vec2.length) {
      throw new Error(`Vector dimension mismatch: ${vec1.length} vs ${vec2.length}`);
    }

    switch (metric) {
      case 'cosine': {
        let dot = 0, mag1 = 0, mag2 = 0;
        for (let i = 0; i < vec1.length; i++) {
          dot += (vec1[i] ?? 0) * (vec2[i] ?? 0);
          mag1 += (vec1[i] ?? 0) * (vec1[i] ?? 0);
          mag2 += (vec2[i] ?? 0) * (vec2[i] ?? 0);
        }
        const denom = Math.sqrt(mag1) * Math.sqrt(mag2);
        return denom > 0 ? dot / denom : 0;
      }

      case 'euclidean': {
        let sum = 0;
        for (let i = 0; i < vec1.length; i++) {
          const diff = (vec1[i] ?? 0) - (vec2[i] ?? 0);
          sum += diff * diff;
        }
        return 1 / (1 + Math.sqrt(sum));
      }

      case 'dot': {
        let dot = 0;
        for (let i = 0; i < vec1.length; i++) {
          dot += (vec1[i] ?? 0) * (vec2[i] ?? 0);
        }
        return dot;
      }

      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }
}

// Use inline implementation (compatible with agentdb's interface)
const MMRDiversityRanker = MMRDiversityRankerImpl;

/**
 * Configuration for MMR Diversity Adapter
 */
export interface MMRAdapterConfig {
  /** Diversity parameter (0-1), default: 0.85 to match DiversityFilter */
  lambda?: number;
  /** Distance metric for similarity calculation */
  metric?: 'cosine' | 'euclidean' | 'dot';
  /** Expected embedding dimensions for validation */
  embeddingDimensions?: number;
}

/**
 * MMRDiversityAdapter wraps agentdb's MMRDiversityRanker
 * to maintain compatibility with DiversityFilter interface
 */
export class MMRDiversityAdapter {
  private readonly lambda: number;
  private readonly metric: 'cosine' | 'euclidean' | 'dot';
  private readonly embeddingDimensions: number;

  /**
   * Creates a new MMRDiversityAdapter instance
   *
   * @param config - Adapter configuration
   */
  constructor(config: MMRAdapterConfig = {}) {
    this.lambda = config.lambda ?? 0.85; // Match DiversityFilter default
    this.metric = config.metric ?? 'cosine';
    this.embeddingDimensions = config.embeddingDimensions ?? 768;

    if (this.lambda < 0 || this.lambda > 1) {
      throw new Error('Lambda must be between 0 and 1');
    }
  }

  /**
   * Apply MMR algorithm using agentdb's MMRDiversityRanker
   *
   * Converts between RecommendationCandidate and MMRCandidate formats,
   * delegates to agentdb's implementation, and converts results back.
   *
   * @param candidates - Array of recommendation candidates
   * @param embeddings - Map of contentId to embedding vectors
   * @param limit - Maximum number of recommendations to return
   * @returns Filtered and reordered candidates maximizing MMR
   */
  public applyMMR(
    candidates: RecommendationCandidate[],
    embeddings: Map<number, Float32Array>,
    limit: number
  ): RecommendationCandidate[] {
    if (candidates.length === 0) {
      return [];
    }

    if (limit <= 0) {
      throw new Error('Limit must be greater than 0');
    }

    // Convert RecommendationCandidate to MMRCandidate
    const mmrCandidates: MMRCandidate[] = [];
    const candidateMap = new Map<number, RecommendationCandidate>();

    for (const candidate of candidates) {
      const embedding = embeddings.get(candidate.contentId);
      if (!embedding) {
        console.warn(`Missing embedding for content ${candidate.contentId}`);
        continue;
      }

      if (embedding.length !== this.embeddingDimensions) {
        console.warn(
          `Invalid embedding dimension for content ${candidate.contentId}: ` +
            `expected ${this.embeddingDimensions}, got ${embedding.length}`
        );
        continue;
      }

      // Convert Float32Array to number[]
      const embeddingArray = Array.from(embedding);

      mmrCandidates.push({
        id: candidate.contentId,
        embedding: embeddingArray,
        similarity: candidate.relevanceScore,
        // Preserve original candidate data
        contentId: candidate.contentId,
        mediaType: candidate.mediaType,
        genres: candidate.genres,
        releaseDate: candidate.releaseDate,
      });

      candidateMap.set(candidate.contentId, candidate);
    }

    if (mmrCandidates.length === 0) {
      return [];
    }

    // Create a synthetic query embedding (average of all embeddings weighted by relevance)
    // This allows us to use agentdb's MMR which expects a query embedding
    const queryEmbedding = this.createQueryEmbedding(mmrCandidates);

    // Use agentdb's MMRDiversityRanker
    const options: MMROptions = {
      lambda: this.lambda,
      k: limit,
      metric: this.metric,
    };

    const selectedMMR = MMRDiversityRanker.selectDiverse(
      mmrCandidates,
      queryEmbedding,
      options
    );

    // Convert back to RecommendationCandidate
    const result: RecommendationCandidate[] = [];
    for (const mmrCandidate of selectedMMR) {
      const original = candidateMap.get(mmrCandidate.id);
      if (original) {
        // Attach the embedding for downstream use
        const embedding = embeddings.get(original.contentId);
        if (embedding) {
          original.embedding = embedding;
        }
        result.push(original);
      }
    }

    return result;
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   *
   * Formula: cos(θ) = (A · B) / (||A|| * ||B||)
   *
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Cosine similarity score (0-1)
   */
  public cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Embedding vectors must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] ?? 0;
      const bVal = b[i] ?? 0;
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Calculate comprehensive diversity metrics for recommendations
   *
   * @param recommendations - Array of selected recommendations
   * @returns Diversity metrics
   */
  public calculateDiversityMetrics(
    recommendations: RecommendationCandidate[]
  ): DiversityMetrics {
    if (recommendations.length === 0) {
      return {
        averageSimilarity: 0,
        genreDistribution: new Map(),
        temporalSpread: 0,
        uniqueGenres: 0,
        diversityScore: 0,
      };
    }

    // Calculate average pairwise similarity
    let totalSimilarity = 0;
    let pairCount = 0;

    for (let i = 0; i < recommendations.length; i++) {
      for (let j = i + 1; j < recommendations.length; j++) {
        const recI = recommendations[i]!;
        const recJ = recommendations[j]!;
        if (recI.embedding && recJ.embedding) {
          const sim = this.cosineSimilarity(recI.embedding, recJ.embedding);
          totalSimilarity += sim;
          pairCount++;
        }
      }
    }

    const averageSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;

    // Calculate genre distribution
    const genreDistribution = new Map<string, number>();
    for (const rec of recommendations) {
      if (rec.genres) {
        for (const genre of rec.genres) {
          genreDistribution.set(genre, (genreDistribution.get(genre) || 0) + 1);
        }
      }
    }

    const uniqueGenres = genreDistribution.size;

    // Calculate temporal diversity
    const releaseDates = recommendations
      .filter(rec => rec.releaseDate)
      .map(rec => rec.releaseDate!.getFullYear());

    const temporalSpread =
      releaseDates.length > 0
        ? Math.max(...releaseDates) - Math.min(...releaseDates)
        : 0;

    // Calculate overall diversity score (inverse of similarity)
    const diversityScore = 1 - averageSimilarity;

    return {
      averageSimilarity,
      genreDistribution,
      temporalSpread,
      uniqueGenres,
      diversityScore,
    };
  }

  /**
   * Create a synthetic query embedding from candidates
   *
   * This is necessary because agentdb's MMR requires a query embedding,
   * but DiversityFilter doesn't use queries. We create a weighted average
   * of all candidate embeddings, weighted by relevance scores.
   *
   * @param candidates - MMR candidates with embeddings and similarities
   * @returns Synthetic query embedding
   * @private
   */
  private createQueryEmbedding(candidates: MMRCandidate[]): number[] {
    if (candidates.length === 0) {
      return [];
    }

    const dimensions = candidates[0]?.embedding.length ?? 0;
    const queryEmbedding = new Array(dimensions).fill(0);
    let totalWeight = 0;

    for (const candidate of candidates) {
      const weight = candidate.similarity;
      totalWeight += weight;

      for (let i = 0; i < dimensions; i++) {
        queryEmbedding[i] += (candidate.embedding[i] ?? 0) * weight;
      }
    }

    // Normalize by total weight
    if (totalWeight > 0) {
      for (let i = 0; i < dimensions; i++) {
        queryEmbedding[i] /= totalWeight;
      }
    }

    return queryEmbedding;
  }

  /**
   * Get the current lambda value
   */
  public getLambda(): number {
    return this.lambda;
  }

  /**
   * Get the current distance metric
   */
  public getMetric(): 'cosine' | 'euclidean' | 'dot' {
    return this.metric;
  }

  /**
   * Get expected embedding dimensions
   */
  public getEmbeddingDimensions(): number {
    return this.embeddingDimensions;
  }
}

/**
 * Factory function to create an MMRDiversityAdapter with default settings
 *
 * @param lambda - Diversity parameter (default: 0.85 to match DiversityFilter)
 * @param metric - Distance metric (default: 'cosine')
 * @returns Configured MMRDiversityAdapter instance
 */
export function createMMRDiversityAdapter(
  lambda?: number,
  metric?: 'cosine' | 'euclidean' | 'dot'
): MMRDiversityAdapter {
  const config: MMRAdapterConfig = {};
  if (lambda !== undefined) config.lambda = lambda;
  if (metric !== undefined) config.metric = metric;
  return new MMRDiversityAdapter(config);
}

/**
 * Helper function to convert Float32Array to number[]
 *
 * @param embedding - Float32Array embedding
 * @returns number[] embedding
 */
export function float32ArrayToNumberArray(embedding: Float32Array): number[] {
  return Array.from(embedding);
}

/**
 * Helper function to convert number[] to Float32Array
 *
 * @param embedding - number[] embedding
 * @returns Float32Array embedding
 */
export function numberArrayToFloat32Array(embedding: number[]): Float32Array {
  return new Float32Array(embedding);
}

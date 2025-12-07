/**
 * Maximal Marginal Relevance (MMR) Diversity Filter
 *
 * Implements MMR algorithm to balance relevance with diversity in content recommendations.
 * MMR_score = λ * relevance - (1-λ) * max_similarity_to_selected
 *
 * @module DiversityFilter
 */

/**
 * Represents a candidate item for recommendation
 */
export interface RecommendationCandidate {
  /** Unique identifier for the content */
  contentId: number;
  /** Type of media content */
  mediaType: 'movie' | 'tv';
  /** Relevance score from recommendation engine (0-1) */
  relevanceScore: number;
  /** Optional embedding vector for similarity calculation */
  embedding?: Float32Array;
  /** Optional genre tags for diversity analysis */
  genres?: string[];
  /** Optional release date for temporal diversity */
  releaseDate?: Date;
}

/**
 * Metrics for analyzing recommendation diversity
 */
export interface DiversityMetrics {
  /** Average pairwise cosine similarity (0-1) */
  averageSimilarity: number;
  /** Distribution of genres in recommendations */
  genreDistribution: Map<string, number>;
  /** Temporal spread in years */
  temporalSpread: number;
  /** Number of unique genres */
  uniqueGenres: number;
  /** Diversity score (0-1, higher is more diverse) */
  diversityScore: number;
}

/**
 * Configuration for genre-based diversification
 */
export interface GenreDiversityConfig {
  /** Minimum number of items per genre */
  minPerGenre?: number;
  /** Maximum number of items per genre */
  maxPerGenre?: number;
  /** Enforce genre distribution constraints */
  enforceDistribution?: boolean;
}

/**
 * DiversityFilter implements Maximal Marginal Relevance (MMR) algorithm
 * to ensure diverse and relevant recommendations.
 */
export class DiversityFilter {
  /**
   * Diversity parameter (0-1)
   * - λ = 1: Pure relevance (no diversity)
   * - λ = 0: Pure diversity (no relevance)
   * - λ = 0.85: Balanced (default)
   */
  private readonly lambda: number;

  /**
   * Expected dimensionality of embedding vectors
   */
  private readonly embeddingDimensions: number;

  /**
   * Creates a new DiversityFilter instance
   *
   * @param lambda - Diversity parameter (default: 0.85)
   * @param embeddingDimensions - Expected embedding dimensions (default: 768)
   */
  constructor(lambda: number = 0.85, embeddingDimensions: number = 768) {
    if (lambda < 0 || lambda > 1) {
      throw new Error('Lambda must be between 0 and 1');
    }
    this.lambda = lambda;
    this.embeddingDimensions = embeddingDimensions;
  }

  /**
   * Apply MMR algorithm to select diverse and relevant candidates
   *
   * Uses greedy iterative selection:
   * 1. Start with highest relevance item
   * 2. For remaining items, calculate MMR score
   * 3. Select item with highest MMR score
   * 4. Repeat until limit reached
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

    // Validate and attach embeddings
    const validCandidates = candidates.filter(candidate => {
      const embedding = embeddings.get(candidate.contentId);
      if (!embedding) {
        console.warn(`Missing embedding for content ${candidate.contentId}`);
        return false;
      }
      if (embedding.length !== this.embeddingDimensions) {
        console.warn(
          `Invalid embedding dimension for content ${candidate.contentId}: ` +
          `expected ${this.embeddingDimensions}, got ${embedding.length}`
        );
        return false;
      }
      candidate.embedding = embedding;
      return true;
    });

    if (validCandidates.length === 0) {
      return [];
    }

    const selected: RecommendationCandidate[] = [];
    const selectedEmbeddings: Float32Array[] = [];
    const remaining = [...validCandidates];

    // Step 1: Select item with highest relevance score
    remaining.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const first = remaining.shift()!;
    selected.push(first);
    selectedEmbeddings.push(first.embedding!);

    // Step 2: Iteratively select items with highest MMR score
    while (selected.length < limit && remaining.length > 0) {
      let bestIndex = -1;
      let bestScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i]!;
        const relevance = candidate.relevanceScore;
        const maxSimilarity = this.maxSimilarityToSelected(
          candidate.embedding!,
          selectedEmbeddings
        );
        const mmrScore = this.calculateMMRScore(relevance, maxSimilarity);

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0) {
        const selectedItem = remaining.splice(bestIndex, 1)[0]!;
        selected.push(selectedItem);
        selectedEmbeddings.push(selectedItem.embedding!);
      } else {
        break;
      }
    }

    return selected;
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
   * Find maximum similarity between candidate and all selected items
   *
   * @param candidateEmbedding - Embedding of candidate item
   * @param selectedEmbeddings - Embeddings of already selected items
   * @returns Maximum cosine similarity (0-1)
   */
  public maxSimilarityToSelected(
    candidateEmbedding: Float32Array,
    selectedEmbeddings: Float32Array[]
  ): number {
    if (selectedEmbeddings.length === 0) {
      return 0;
    }

    let maxSim = -Infinity;
    for (const selectedEmbedding of selectedEmbeddings) {
      const sim = this.cosineSimilarity(candidateEmbedding, selectedEmbedding);
      maxSim = Math.max(maxSim, sim);
    }

    return maxSim;
  }

  /**
   * Calculate MMR score for a candidate
   *
   * Formula: MMR_score = λ * relevance - (1-λ) * max_similarity
   *
   * @param relevance - Relevance score (0-1)
   * @param maxSimilarity - Maximum similarity to selected items (0-1)
   * @returns MMR score
   */
  public calculateMMRScore(relevance: number, maxSimilarity: number): number {
    return this.lambda * relevance - (1 - this.lambda) * maxSimilarity;
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
}

/**
 * GenreDiversifier ensures recommendations span multiple genres
 * with configurable constraints
 */
export class GenreDiversifier {
  private readonly config: Required<GenreDiversityConfig>;

  /**
   * Creates a new GenreDiversifier
   *
   * @param config - Genre diversity configuration
   */
  constructor(config: GenreDiversityConfig = {}) {
    this.config = {
      minPerGenre: config.minPerGenre ?? 1,
      maxPerGenre: config.maxPerGenre ?? 5,
      enforceDistribution: config.enforceDistribution ?? true,
    };
  }

  /**
   * Apply genre-based diversification to candidates
   *
   * Ensures recommendations include items from multiple genres
   * while respecting min/max constraints per genre
   *
   * @param candidates - Array of recommendation candidates
   * @param limit - Maximum number of recommendations
   * @returns Diversified recommendations
   */
  public diversifyByGenre(
    candidates: RecommendationCandidate[],
    limit: number
  ): RecommendationCandidate[] {
    if (!this.config.enforceDistribution || candidates.length === 0) {
      return candidates.slice(0, limit);
    }

    // Group candidates by genres
    const genreGroups = new Map<string, RecommendationCandidate[]>();

    for (const candidate of candidates) {
      if (!candidate.genres || candidate.genres.length === 0) {
        continue;
      }

      // Add to each genre group
      for (const genre of candidate.genres) {
        if (!genreGroups.has(genre)) {
          genreGroups.set(genre, []);
        }
        genreGroups.get(genre)!.push(candidate);
      }
    }

    // Sort candidates within each genre by relevance
    for (const [, group] of genreGroups) {
      group.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    const selected: RecommendationCandidate[] = [];
    const selectedIds = new Set<number>();
    const genreCounts = new Map<string, number>();

    // Initialize genre counts
    for (const genre of genreGroups.keys()) {
      genreCounts.set(genre, 0);
    }

    // Round-robin selection from each genre
    let genreIndex = 0;
    const genreList = Array.from(genreGroups.keys());

    while (selected.length < limit && genreList.length > 0) {
      const genre = genreList[genreIndex % genreList.length] ?? '';
      const group = genreGroups.get(genre) ?? [];
      const currentCount = genreCounts.get(genre) ?? 0;

      // Check if we can still add from this genre
      if (currentCount < this.config.maxPerGenre && group.length > 0) {
        // Find next unselected candidate
        let candidate: RecommendationCandidate | undefined;
        while (group.length > 0) {
          const next = group.shift();
          if (next && !selectedIds.has(next.contentId)) {
            candidate = next;
            break;
          }
        }

        if (candidate) {
          selected.push(candidate);
          selectedIds.add(candidate.contentId);
          genreCounts.set(genre, currentCount + 1);
        }
      }

      // Remove genre if exhausted or at max
      const updatedCount = genreCounts.get(genre) ?? 0;
      if (group.length === 0 || updatedCount >= this.config.maxPerGenre) {
        genreList.splice(genreIndex % genreList.length, 1);
      } else {
        genreIndex++;
      }

      // Safety check
      if (genreList.length === 0) {
        break;
      }
    }

    // Validate minimum per genre if enforcing
    if (this.config.enforceDistribution) {
      for (const [genre, count] of genreCounts) {
        if (count < this.config.minPerGenre && genreGroups.get(genre)!.length > 0) {
          console.warn(
            `Genre "${genre}" has only ${count} items, ` +
            `minimum is ${this.config.minPerGenre}`
          );
        }
      }
    }

    return selected;
  }

  /**
   * Get genre distribution from recommendations
   *
   * @param recommendations - Array of recommendations
   * @returns Map of genre to count
   */
  public getGenreDistribution(
    recommendations: RecommendationCandidate[]
  ): Map<string, number> {
    const distribution = new Map<string, number>();

    for (const rec of recommendations) {
      if (rec.genres) {
        for (const genre of rec.genres) {
          distribution.set(genre, (distribution.get(genre) || 0) + 1);
        }
      }
    }

    return distribution;
  }

  /**
   * Validate that genre distribution meets constraints
   *
   * @param recommendations - Array of recommendations
   * @returns True if distribution is valid
   */
  public validateDistribution(
    recommendations: RecommendationCandidate[]
  ): boolean {
    if (!this.config.enforceDistribution) {
      return true;
    }

    const distribution = this.getGenreDistribution(recommendations);

    for (const count of distribution.values()) {
      if (count < this.config.minPerGenre || count > this.config.maxPerGenre) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Factory function to create a DiversityFilter with default settings
 */
export function createDiversityFilter(
  lambda?: number,
  embeddingDimensions?: number
): DiversityFilter {
  return new DiversityFilter(lambda, embeddingDimensions);
}

/**
 * Factory function to create a GenreDiversifier with default settings
 */
export function createGenreDiversifier(
  config?: GenreDiversityConfig
): GenreDiversifier {
  return new GenreDiversifier(config);
}

/**
 * Semantic Search Service
 * Natural language search with personalization and multi-criteria ranking
 */

import type {
  SearchQuery,
  SearchResult,
  SearchFilters,
  MediaContent,
  UserPreferences,
  PlatformAvailability,
} from '../types/index.js';
import { combineQueryWithPreferences } from './UserPreferenceService.js';

// Search configuration
const DEFAULT_SIMILARITY_THRESHOLD = 0.3;
const PERSONALIZATION_WEIGHT = 0.3;

/**
 * Search result with internal scoring details
 */
interface ScoredCandidate {
  content: MediaContent;
  embedding: Float32Array;
  similarityScore: number;
  personalizationScore: number;
  recencyScore: number;
  popularityScore: number;
  finalScore: number;
}

/**
 * Apply filters to search results
 */
export function applyFilters(
  candidates: MediaContent[],
  filters: SearchFilters
): MediaContent[] {
  return candidates.filter(content => {
    // Media type filter
    if (filters.mediaType && content.mediaType !== filters.mediaType) {
      return false;
    }

    // Genre filter
    if (filters.genres && filters.genres.length > 0) {
      const hasMatchingGenre = filters.genres.some(g =>
        content.genreIds.includes(g)
      );
      if (!hasMatchingGenre) return false;
    }

    // Year range filter
    if (filters.yearMin || filters.yearMax) {
      const year = parseInt(content.releaseDate.substring(0, 4));
      if (filters.yearMin && year < filters.yearMin) return false;
      if (filters.yearMax && year > filters.yearMax) return false;
    }

    // Rating filter
    if (filters.ratingMin && content.voteAverage < filters.ratingMin) {
      return false;
    }

    return true;
  });
}

/**
 * Calculate personalization score between user preferences and content
 */
export function calculatePersonalizationScore(
  contentEmbedding: Float32Array,
  userPreferences: UserPreferences | null
): number {
  if (!userPreferences?.vector) {
    return 0.5; // Neutral score for anonymous users
  }

  return cosineSimilarity(contentEmbedding, userPreferences.vector);
}

/**
 * Calculate recency score (newer content gets slight boost)
 */
export function calculateRecencyScore(releaseDate: string): number {
  const releaseYear = parseInt(releaseDate.substring(0, 4));
  const currentYear = new Date().getFullYear();
  const age = currentYear - releaseYear;

  // Exponential decay: recent content scores higher
  return Math.exp(-age / 10);
}

/**
 * Normalize popularity score to 0-1 range
 */
export function calculatePopularityScore(
  popularity: number,
  maxPopularity: number = 1000
): number {
  return Math.min(popularity / maxPopularity, 1);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    magnitudeA += a[i]! * a[i]!;
    magnitudeB += b[i]! * b[i]!;
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Rerank candidates using multi-criteria scoring
 *
 * Final score = α·similarity + β·personalization + γ·recency + δ·popularity
 */
export function rerankCandidates(
  candidates: Array<{
    content: MediaContent;
    embedding: Float32Array;
    similarityScore: number;
  }>,
  userPreferences: UserPreferences | null,
  weights: {
    similarity?: number;
    personalization?: number;
    recency?: number;
    popularity?: number;
  } = {}
): ScoredCandidate[] {
  const {
    similarity: α = 0.5,
    personalization: β = 0.25,
    recency: γ = 0.15,
    popularity: δ = 0.1,
  } = weights;

  const scored: ScoredCandidate[] = candidates.map(candidate => {
    const personalizationScore = calculatePersonalizationScore(
      candidate.embedding,
      userPreferences
    );
    const recencyScore = calculateRecencyScore(candidate.content.releaseDate);
    const popularityScore = calculatePopularityScore(candidate.content.popularity);

    const finalScore =
      α * candidate.similarityScore +
      β * personalizationScore +
      γ * recencyScore +
      δ * popularityScore;

    return {
      ...candidate,
      personalizationScore,
      recencyScore,
      popularityScore,
      finalScore,
    };
  });

  // Sort by final score descending
  return scored.sort((a, b) => b.finalScore - a.finalScore);
}

/**
 * Generate explanation for why a result was returned
 */
export function generateExplanation(scored: ScoredCandidate): string {
  const reasons: string[] = [];

  if (scored.similarityScore > 0.7) {
    reasons.push('highly relevant to your search');
  } else if (scored.similarityScore > 0.5) {
    reasons.push('matches your search criteria');
  }

  if (scored.personalizationScore > 0.7) {
    reasons.push('matches your preferences');
  }

  if (scored.recencyScore > 0.8) {
    reasons.push('recently released');
  }

  if (scored.popularityScore > 0.7) {
    reasons.push('popular choice');
  }

  if (reasons.length === 0) {
    return 'May interest you based on your query';
  }

  return reasons.join(', ').replace(/^./, s => s.toUpperCase());
}

/**
 * Format scored candidates into search results
 */
export function formatSearchResults(
  scored: ScoredCandidate[],
  availability: Map<number, PlatformAvailability[]>,
  limit: number
): SearchResult[] {
  return scored.slice(0, limit).map(candidate => ({
    content: candidate.content,
    score: candidate.finalScore,
    explanation: generateExplanation(candidate),
    availability: availability.get(candidate.content.id) ?? [],
  }));
}

/**
 * Extract filter hints from natural language query
 * This is a simplified version - in production would use LLM
 */
export function extractFiltersFromQuery(query: string): Partial<SearchFilters> {
  const filters: Partial<SearchFilters> = {};
  const lowerQuery = query.toLowerCase();

  // Media type detection
  if (lowerQuery.includes('movie') || lowerQuery.includes('film')) {
    filters.mediaType = 'movie';
  } else if (lowerQuery.includes('show') || lowerQuery.includes('series') || lowerQuery.includes('tv')) {
    filters.mediaType = 'tv';
  }

  // Year detection (e.g., "from 2020", "after 2015")
  const yearMatch = query.match(/(?:from|after|since)\s*(\d{4})/i);
  if (yearMatch) {
    filters.yearMin = parseInt(yearMatch[1]!);
  }

  const recentMatch = query.match(/(?:recent|new|latest)/i);
  if (recentMatch) {
    filters.yearMin = new Date().getFullYear() - 2;
  }

  // Rating detection
  if (lowerQuery.includes('highly rated') || lowerQuery.includes('top rated')) {
    filters.ratingMin = 7.5;
  }

  return filters;
}

/**
 * Merge user-provided filters with extracted filters
 * User-provided filters take precedence
 */
export function mergeFilters(
  extracted: Partial<SearchFilters>,
  provided: SearchFilters | undefined
): SearchFilters {
  return {
    ...extracted,
    ...provided,
  };
}

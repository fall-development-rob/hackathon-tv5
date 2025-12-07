/**
 * Explainable Recommendations System for Media Gateway
 * Provides transparent, human-readable explanations for content recommendations
 */

/**
 * Reason codes for recommendation explanations
 */
export enum ReasonCode {
  SIMILAR_TO_WATCHED = 'SIMILAR_TO_WATCHED',
  TRENDING_NOW = 'TRENDING_NOW',
  FRIEND_RECOMMENDED = 'FRIEND_RECOMMENDED',
  MOOD_MATCH = 'MOOD_MATCH',
  GENRE_PREFERENCE = 'GENRE_PREFERENCE',
  ACTOR_PREFERENCE = 'ACTOR_PREFERENCE',
  DIRECTOR_PREFERENCE = 'DIRECTOR_PREFERENCE',
  COMPLETION_PATTERN = 'COMPLETION_PATTERN',
  TIME_OF_DAY_MATCH = 'TIME_OF_DAY_MATCH',
  HIGHLY_RATED = 'HIGHLY_RATED',
  NEW_RELEASE = 'NEW_RELEASE',
  POPULAR_IN_REGION = 'POPULAR_IN_REGION',
}

/**
 * Individual explanation factor contributing to a recommendation
 */
export interface ExplanationFactor {
  /** The reason code for this factor */
  reasonCode: ReasonCode;
  /** Weight/contribution to final recommendation score (0-1) */
  weight: number;
  /** Human-readable details about this factor */
  details: string;
  /** Related content IDs that influenced this factor */
  relatedContentIds: number[] | undefined;
  /** Related user IDs that influenced this factor */
  relatedUserIds: string[] | undefined;
}

/**
 * Complete explanation for a recommendation
 */
export interface RecommendationExplanation {
  /** ID of the recommended content */
  contentId: number;
  /** All factors contributing to this recommendation */
  factors: ExplanationFactor[];
  /** Natural language summary of why this was recommended */
  summary: string;
  /** Overall confidence in this recommendation (0-1) */
  confidence: number;
}

/**
 * Configuration for explanation generation
 */
export interface ExplanationConfig {
  /** Maximum number of factors to include in explanation */
  maxFactors?: number;
  /** Minimum weight threshold for including a factor */
  minWeightThreshold?: number;
  /** Include related content/user details */
  includeRelatedDetails?: boolean;
  /** Language for natural language generation */
  language?: 'en' | 'es' | 'fr' | 'de';
}

/**
 * Strategy contribution data structure
 */
export interface StrategyContribution {
  strategyName: string;
  score: number;
  metadata?: Record<string, any>;
}

/**
 * RecommendationExplainer class
 * Generates transparent, human-readable explanations for recommendations
 */
export class RecommendationExplainer {
  private config: Required<ExplanationConfig>;
  private contentCache: Map<number, any>;
  private userCache: Map<string, any>;

  constructor(config: ExplanationConfig = {}) {
    this.config = {
      maxFactors: config.maxFactors ?? 5,
      minWeightThreshold: config.minWeightThreshold ?? 0.05,
      includeRelatedDetails: config.includeRelatedDetails ?? true,
      language: config.language ?? 'en',
    };
    this.contentCache = new Map();
    this.userCache = new Map();
  }

  /**
   * Generate a complete explanation for a recommendation
   */
  public generateExplanation(
    contentId: number,
    userId: string,
    strategyContributions: Map<string, number>,
    metadata?: Record<string, any>
  ): RecommendationExplanation {
    const factors: ExplanationFactor[] = [];

    // Analyze each strategy contribution
    for (const [strategy, score] of strategyContributions.entries()) {
      const strategyFactors = this.analyzeStrategyContribution(
        strategy,
        score,
        metadata
      );
      factors.push(...strategyFactors);
    }

    // Sort factors by weight (descending)
    factors.sort((a, b) => b.weight - a.weight);

    // Filter and limit factors
    const filteredFactors = this.getTopReasons(factors, this.config.maxFactors);

    // Calculate confidence based on factor weights
    const confidence = this.calculateConfidence(filteredFactors);

    // Generate natural language summary
    const summary = this.formatNaturalLanguage(filteredFactors);

    return {
      contentId,
      factors: filteredFactors,
      summary,
      confidence,
    };
  }

  /**
   * Format explanation factors into natural language
   */
  public formatNaturalLanguage(factors: ExplanationFactor[]): string {
    if (factors.length === 0) {
      return this.getTemplate('default');
    }

    const parts: string[] = [];
    const primaryFactor = factors[0]!;

    // Primary reason
    parts.push(this.getReasonTemplate(primaryFactor));

    // Secondary reasons
    if (factors.length > 1) {
      const secondaryReasons = factors.slice(1, 3).map((f) =>
        this.getSecondaryReasonPhrase(f)
      );

      if (secondaryReasons.length === 1) {
        parts.push(`It also ${secondaryReasons[0]}.`);
      } else if (secondaryReasons.length > 1) {
        parts.push(
          `Additionally, it ${secondaryReasons.slice(0, -1).join(', ')} and ${
            secondaryReasons[secondaryReasons.length - 1]
          }.`
        );
      }
    }

    return parts.join(' ');
  }

  /**
   * Get top N explanation factors
   */
  public getTopReasons(
    factors: ExplanationFactor[],
    limit: number = 3
  ): ExplanationFactor[] {
    return factors
      .filter((f) => f.weight >= this.config.minWeightThreshold)
      .slice(0, limit);
  }

  /**
   * Analyze strategy contribution and convert to explanation factors
   */
  public analyzeStrategyContribution(
    strategy: string,
    score: number,
    metadata?: Record<string, any>
  ): ExplanationFactor[] {
    const normalizedStrategy = strategy.toLowerCase();
    const factors: ExplanationFactor[] = [];

    // Map strategy names to reason codes and generate factors
    if (normalizedStrategy.includes('collaborative')) {
      factors.push(
        this.createFactor(
          ReasonCode.SIMILAR_TO_WATCHED,
          score,
          'Similar to content enjoyed by users with similar tastes',
          metadata?.['similarContentIds'] as number[] | undefined,
          metadata?.['similarUserIds'] as string[] | undefined
        )
      );
    } else if (normalizedStrategy.includes('content-based')) {
      factors.push(
        this.createFactor(
          ReasonCode.GENRE_PREFERENCE,
          score * 0.6,
          'Matches your preferred genres',
          metadata?.['genreMatchIds'] as number[] | undefined
        ),
        this.createFactor(
          ReasonCode.ACTOR_PREFERENCE,
          score * 0.4,
          'Features actors you frequently watch',
          metadata?.['actorMatchIds'] as number[] | undefined
        )
      );
    } else if (normalizedStrategy.includes('trending')) {
      factors.push(
        this.createFactor(
          ReasonCode.TRENDING_NOW,
          score,
          'Currently trending among all viewers',
          metadata?.['trendingContentIds'] as number[] | undefined
        )
      );
    } else if (normalizedStrategy.includes('social')) {
      factors.push(
        this.createFactor(
          ReasonCode.FRIEND_RECOMMENDED,
          score,
          'Recommended by users in your network',
          metadata?.['friendContentIds'] as number[] | undefined,
          metadata?.['friendUserIds'] as string[] | undefined
        )
      );
    } else if (normalizedStrategy.includes('mood')) {
      const mood = metadata?.['mood'] as string | undefined;
      factors.push(
        this.createFactor(
          ReasonCode.MOOD_MATCH,
          score,
          `Perfect for your current ${mood || 'mood'}`,
          metadata?.['moodMatchIds'] as number[] | undefined
        )
      );
    } else if (normalizedStrategy.includes('temporal') || normalizedStrategy.includes('time')) {
      const timeOfDay = metadata?.['timeOfDay'] as string | undefined;
      factors.push(
        this.createFactor(
          ReasonCode.TIME_OF_DAY_MATCH,
          score,
          `Matches your ${timeOfDay || 'typical'} viewing preferences`,
          metadata?.['timeBasedIds'] as number[] | undefined
        )
      );
    } else if (normalizedStrategy.includes('rating')) {
      const avgRating = metadata?.['averageRating'] as number | undefined;
      factors.push(
        this.createFactor(
          ReasonCode.HIGHLY_RATED,
          score,
          `Highly rated by viewers (${avgRating?.toFixed(1) ?? 'N/A'}/5)`,
          metadata?.['highRatedIds'] as number[] | undefined
        )
      );
    } else if (normalizedStrategy.includes('regional') || normalizedStrategy.includes('geographic')) {
      const region = metadata?.['region'] as string | undefined;
      factors.push(
        this.createFactor(
          ReasonCode.POPULAR_IN_REGION,
          score,
          `Popular in ${region || 'your region'}`,
          metadata?.['regionalContentIds'] as number[] | undefined
        )
      );
    } else if (normalizedStrategy.includes('new') || normalizedStrategy.includes('release')) {
      factors.push(
        this.createFactor(
          ReasonCode.NEW_RELEASE,
          score,
          'Recently added to the platform',
          metadata?.['newReleaseIds'] as number[] | undefined
        )
      );
    } else if (normalizedStrategy.includes('completion') || normalizedStrategy.includes('pattern')) {
      factors.push(
        this.createFactor(
          ReasonCode.COMPLETION_PATTERN,
          score,
          'Based on your viewing completion patterns',
          metadata?.['completionPatternIds'] as number[] | undefined
        )
      );
    } else if (normalizedStrategy.includes('director')) {
      factors.push(
        this.createFactor(
          ReasonCode.DIRECTOR_PREFERENCE,
          score,
          'Features directors whose work you appreciate',
          metadata?.['directorMatchIds'] as number[] | undefined
        )
      );
    } else {
      // Generic fallback
      factors.push(
        this.createFactor(
          ReasonCode.SIMILAR_TO_WATCHED,
          score,
          `Recommended based on ${strategy}`,
          metadata?.['relatedContentIds'] as number[] | undefined
        )
      );
    }

    return factors;
  }

  /**
   * Create an explanation factor
   */
  private createFactor(
    reasonCode: ReasonCode,
    weight: number,
    details: string,
    relatedContentIds?: number[],
    relatedUserIds?: string[]
  ): ExplanationFactor {
    const factor: ExplanationFactor = {
      reasonCode,
      weight: Math.max(0, Math.min(1, weight)), // Clamp to [0, 1]
      details,
      relatedContentIds: undefined,
      relatedUserIds: undefined,
    };

    if (this.config.includeRelatedDetails) {
      if (relatedContentIds && relatedContentIds.length > 0) {
        factor.relatedContentIds = relatedContentIds.slice(0, 5);
      }
      if (relatedUserIds && relatedUserIds.length > 0) {
        factor.relatedUserIds = relatedUserIds.slice(0, 5);
      }
    }

    return factor;
  }

  /**
   * Get natural language template for a reason
   */
  private getReasonTemplate(factor: ExplanationFactor): string {
    const { reasonCode, details, relatedContentIds } = factor;

    const templates: Record<ReasonCode, string> = {
      [ReasonCode.SIMILAR_TO_WATCHED]:
        'Recommended because you watched similar content',
      [ReasonCode.TRENDING_NOW]:
        'This is trending now and gaining popularity',
      [ReasonCode.FRIEND_RECOMMENDED]:
        'People in your network have enjoyed this',
      [ReasonCode.MOOD_MATCH]: 'This matches your current mood perfectly',
      [ReasonCode.GENRE_PREFERENCE]:
        'This matches your preference for genres you love',
      [ReasonCode.ACTOR_PREFERENCE]:
        'Features actors you frequently watch and enjoy',
      [ReasonCode.DIRECTOR_PREFERENCE]:
        'From a director whose work you appreciate',
      [ReasonCode.COMPLETION_PATTERN]:
        'Based on content you typically finish watching',
      [ReasonCode.TIME_OF_DAY_MATCH]:
        'Perfect for your current time of day viewing',
      [ReasonCode.HIGHLY_RATED]:
        'Highly rated by viewers with similar tastes',
      [ReasonCode.NEW_RELEASE]:
        'A fresh addition you might enjoy',
      [ReasonCode.POPULAR_IN_REGION]:
        'Popular among viewers in your area',
    };

    let template = templates[reasonCode] || details;

    // Add specific details if available
    if (relatedContentIds && relatedContentIds.length > 0) {
      const firstContentId = relatedContentIds[0];
      if (firstContentId !== undefined) {
        const contentRef = this.getContentReference(firstContentId);
        if (contentRef) {
          template += ` like "${contentRef}"`;
        }
      }
    }

    return template + '.';
  }

  /**
   * Get secondary reason phrase
   */
  private getSecondaryReasonPhrase(factor: ExplanationFactor): string {
    const phrases: Record<ReasonCode, string> = {
      [ReasonCode.SIMILAR_TO_WATCHED]: 'is similar to what you watch',
      [ReasonCode.TRENDING_NOW]: 'is trending right now',
      [ReasonCode.FRIEND_RECOMMENDED]: 'was enjoyed by your network',
      [ReasonCode.MOOD_MATCH]: 'fits your mood',
      [ReasonCode.GENRE_PREFERENCE]: 'matches your genre preferences',
      [ReasonCode.ACTOR_PREFERENCE]: 'features your favorite actors',
      [ReasonCode.DIRECTOR_PREFERENCE]: 'is from a director you like',
      [ReasonCode.COMPLETION_PATTERN]: 'fits your viewing patterns',
      [ReasonCode.TIME_OF_DAY_MATCH]: 'matches your typical viewing time',
      [ReasonCode.HIGHLY_RATED]: 'is highly rated',
      [ReasonCode.NEW_RELEASE]: 'is newly released',
      [ReasonCode.POPULAR_IN_REGION]: 'is popular in your region',
    };

    return phrases[factor.reasonCode] || 'was recommended for you';
  }

  /**
   * Get default template when no factors available
   */
  private getTemplate(type: string): string {
    const templates: Record<string, string> = {
      default: 'We think you might enjoy this based on your viewing history.',
      fallback: 'Recommended for you based on your preferences.',
    };

    return templates[type] ?? templates['default'] ?? 'Recommended for you.';
  }

  /**
   * Calculate confidence score based on factors
   */
  private calculateConfidence(factors: ExplanationFactor[]): number {
    if (factors.length === 0) {
      return 0.5; // Neutral confidence
    }

    // Weighted average of top factors
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScore =
      factors.reduce((sum, f) => sum + f.weight * f.weight, 0) / totalWeight;

    // Factor in diversity of reasons
    const uniqueReasons = new Set(factors.map((f) => f.reasonCode)).size;
    const diversityBonus = Math.min(uniqueReasons * 0.05, 0.15);

    // Calculate final confidence
    const baseConfidence = weightedScore * 0.8 + diversityBonus;

    return Math.max(0.3, Math.min(0.95, baseConfidence));
  }

  /**
   * Get content reference for natural language
   */
  private getContentReference(contentId: number): string | null {
    const cached = this.contentCache.get(contentId);
    if (cached) {
      return cached.title || cached.name || `Content #${contentId}`;
    }
    return null;
  }

  /**
   * Cache content metadata for reference
   */
  public cacheContent(contentId: number, metadata: any): void {
    this.contentCache.set(contentId, metadata);
  }

  /**
   * Cache user metadata for reference
   */
  public cacheUser(userId: string, metadata: any): void {
    this.userCache.set(userId, metadata);
  }

  /**
   * Clear all caches
   */
  public clearCaches(): void {
    this.contentCache.clear();
    this.userCache.clear();
  }

  /**
   * Generate batch explanations for multiple recommendations
   */
  public generateBatchExplanations(
    recommendations: Array<{
      contentId: number;
      userId: string;
      strategyContributions: Map<string, number>;
      metadata?: Record<string, any>;
    }>
  ): RecommendationExplanation[] {
    return recommendations.map((rec) =>
      this.generateExplanation(
        rec.contentId,
        rec.userId,
        rec.strategyContributions,
        rec.metadata
      )
    );
  }

  /**
   * Export explanation as JSON
   */
  public exportExplanation(explanation: RecommendationExplanation): string {
    return JSON.stringify(explanation, null, 2);
  }

  /**
   * Compare two explanations
   */
  public compareExplanations(
    exp1: RecommendationExplanation,
    exp2: RecommendationExplanation
  ): {
    similarity: number;
    commonReasons: ReasonCode[];
    uniqueToFirst: ReasonCode[];
    uniqueToSecond: ReasonCode[];
  } {
    const reasons1 = new Set(exp1.factors.map((f) => f.reasonCode));
    const reasons2 = new Set(exp2.factors.map((f) => f.reasonCode));

    const commonReasons = Array.from(reasons1).filter((r) => reasons2.has(r));
    const uniqueToFirst = Array.from(reasons1).filter((r) => !reasons2.has(r));
    const uniqueToSecond = Array.from(reasons2).filter((r) => !reasons1.has(r));

    const similarity =
      (2 * commonReasons.length) / (reasons1.size + reasons2.size);

    return {
      similarity,
      commonReasons,
      uniqueToFirst,
      uniqueToSecond,
    };
  }
}

/**
 * ExplanationAggregator class
 * Combines multiple explanation factors into coherent, prioritized explanations
 */
export class ExplanationAggregator {
  private deduplicationThreshold: number;
  private maxFactorsPerExplanation: number;

  constructor(config: {
    deduplicationThreshold?: number;
    maxFactorsPerExplanation?: number;
  } = {}) {
    this.deduplicationThreshold = config.deduplicationThreshold ?? 0.8;
    this.maxFactorsPerExplanation = config.maxFactorsPerExplanation ?? 5;
  }

  /**
   * Aggregate multiple factors, removing redundancy
   */
  public aggregate(factors: ExplanationFactor[]): ExplanationFactor[] {
    // Group factors by reason code
    const grouped = this.groupByReasonCode(factors);

    // Merge similar factors within each group
    const merged: ExplanationFactor[] = [];
    for (const [reasonCode, factorGroup] of grouped.entries()) {
      const mergedFactor = this.mergeFactors(factorGroup);
      merged.push(mergedFactor);
    }

    // Sort by weight and limit
    merged.sort((a, b) => b.weight - a.weight);
    return merged.slice(0, this.maxFactorsPerExplanation);
  }

  /**
   * Prioritize most impactful reasons
   */
  public prioritize(factors: ExplanationFactor[]): ExplanationFactor[] {
    const priorityOrder: ReasonCode[] = [
      ReasonCode.SIMILAR_TO_WATCHED,
      ReasonCode.FRIEND_RECOMMENDED,
      ReasonCode.GENRE_PREFERENCE,
      ReasonCode.TRENDING_NOW,
      ReasonCode.HIGHLY_RATED,
      ReasonCode.MOOD_MATCH,
      ReasonCode.ACTOR_PREFERENCE,
      ReasonCode.DIRECTOR_PREFERENCE,
      ReasonCode.NEW_RELEASE,
      ReasonCode.POPULAR_IN_REGION,
      ReasonCode.TIME_OF_DAY_MATCH,
      ReasonCode.COMPLETION_PATTERN,
    ];

    return factors.sort((a, b) => {
      // First sort by weight
      const weightDiff = b.weight - a.weight;
      if (Math.abs(weightDiff) > 0.1) {
        return weightDiff;
      }

      // Then by priority order
      const aPriority = priorityOrder.indexOf(a.reasonCode);
      const bPriority = priorityOrder.indexOf(b.reasonCode);
      return (
        (aPriority === -1 ? 999 : aPriority) -
        (bPriority === -1 ? 999 : bPriority)
      );
    });
  }

  /**
   * Remove redundant explanations
   */
  public deduplicateFactors(factors: ExplanationFactor[]): ExplanationFactor[] {
    const deduplicated: ExplanationFactor[] = [];
    const seen = new Set<string>();

    for (const factor of factors) {
      const signature = this.getFactorSignature(factor);
      if (!seen.has(signature)) {
        deduplicated.push(factor);
        seen.add(signature);
      } else {
        // Merge weight with existing factor
        const existing = deduplicated.find(
          (f) => this.getFactorSignature(f) === signature
        );
        if (existing) {
          existing.weight = Math.max(existing.weight, factor.weight);
        }
      }
    }

    return deduplicated;
  }

  /**
   * Group factors by reason code
   */
  private groupByReasonCode(
    factors: ExplanationFactor[]
  ): Map<ReasonCode, ExplanationFactor[]> {
    const grouped = new Map<ReasonCode, ExplanationFactor[]>();

    for (const factor of factors) {
      const group = grouped.get(factor.reasonCode) || [];
      group.push(factor);
      grouped.set(factor.reasonCode, group);
    }

    return grouped;
  }

  /**
   * Merge similar factors
   */
  private mergeFactors(factors: ExplanationFactor[]): ExplanationFactor {
    const firstFactor = factors[0]!;
    if (factors.length === 1) {
      return firstFactor;
    }

    // Combine weights
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const avgWeight = totalWeight / factors.length;

    // Combine related content IDs
    const allContentIds = new Set<number>();
    const allUserIds = new Set<string>();

    for (const factor of factors) {
      factor.relatedContentIds?.forEach((id) => allContentIds.add(id));
      factor.relatedUserIds?.forEach((id) => allUserIds.add(id));
    }

    // Use the most specific details
    const detailedFactor = factors.find((f) => f.details.length > 20);
    const details = detailedFactor?.details ?? firstFactor.details;

    return {
      reasonCode: firstFactor.reasonCode,
      weight: avgWeight,
      details,
      relatedContentIds:
        allContentIds.size > 0 ? Array.from(allContentIds).slice(0, 10) : undefined,
      relatedUserIds:
        allUserIds.size > 0 ? Array.from(allUserIds).slice(0, 10) : undefined,
    };
  }

  /**
   * Get unique signature for factor
   */
  private getFactorSignature(factor: ExplanationFactor): string {
    return `${factor.reasonCode}:${factor.details.substring(0, 50)}`;
  }
}

/**
 * Utility function to create explanation from strategy scores
 */
export function createExplanationFromStrategies(
  contentId: number,
  userId: string,
  strategies: Record<string, number>,
  metadata?: Record<string, any>
): RecommendationExplanation {
  const explainer = new RecommendationExplainer();
  const strategyMap = new Map(Object.entries(strategies));
  return explainer.generateExplanation(contentId, userId, strategyMap, metadata);
}

/**
 * Utility function to format explanation as text
 */
export function formatExplanationAsText(
  explanation: RecommendationExplanation
): string {
  const lines: string[] = [];
  lines.push(`Recommendation for Content #${explanation.contentId}`);
  lines.push(`Confidence: ${(explanation.confidence * 100).toFixed(1)}%`);
  lines.push('');
  lines.push('Summary:');
  lines.push(explanation.summary);
  lines.push('');
  lines.push('Factors:');
  explanation.factors.forEach((factor, idx) => {
    lines.push(
      `${idx + 1}. ${factor.reasonCode} (${(factor.weight * 100).toFixed(1)}%)`
    );
    lines.push(`   ${factor.details}`);
  });
  return lines.join('\n');
}

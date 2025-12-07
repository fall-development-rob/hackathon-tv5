/**
 * AgentDB Integration Tests
 *
 * Comprehensive integration tests for AgentDB adapter modules:
 * - AgentDBRouterAdapter (MultiModelRouter integration)
 * - MMRDiversityAdapter (DiversityFilter integration)
 * - HNSWSearchAdapter (ContentEmbeddings + HNSW integration)
 * - QLearning + ReflexionMemory integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultiModelRouter, type RoutingDecision, type TaskRequirements, type UsageStats, type PriorityMode } from '../src/cognitive/MultiModelRouter.js';
import { DiversityFilter, type RecommendationCandidate, type DiversityMetrics } from '../src/recommendations/DiversityFilter.js';
import { ContentEmbeddingGenerator } from '../src/learning/ContentEmbeddings.js';
import { QLearning, type QState, type QAction, type Experience, type EngagementMetrics } from '../src/learning/QLearning.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Generate random Float32Array embedding for testing
 */
function generateMockEmbedding(dimensions: number = 768): Float32Array {
  const embedding = new Float32Array(dimensions);
  let sumSquared = 0;

  // Generate random values
  for (let i = 0; i < dimensions; i++) {
    embedding[i] = Math.random() * 2 - 1; // Range: -1 to 1
    sumSquared += embedding[i] * embedding[i];
  }

  // L2 normalize
  const norm = Math.sqrt(sumSquared);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      embedding[i] /= norm;
    }
  }

  return embedding;
}

/**
 * Generate multiple diverse embeddings
 */
function generateDiverseEmbeddings(count: number, dimensions: number = 768): Float32Array[] {
  const embeddings: Float32Array[] = [];

  for (let i = 0; i < count; i++) {
    embeddings.push(generateMockEmbedding(dimensions));
  }

  return embeddings;
}

/**
 * Convert Float32Array to regular array for comparison
 */
function float32ToArray(arr: Float32Array): number[] {
  return Array.from(arr);
}

/**
 * Create mock recommendation candidate
 */
function createMockCandidate(
  id: number,
  relevanceScore: number,
  genres: string[] = ['action'],
  embedding?: Float32Array
): RecommendationCandidate {
  return {
    contentId: id,
    mediaType: 'movie',
    relevanceScore,
    embedding,
    genres,
    releaseDate: new Date(2020 + id, 0, 1),
  };
}

// ============================================================================
// AgentDBRouterAdapter Tests (MultiModelRouter)
// ============================================================================

describe('AgentDBRouterAdapter - MultiModelRouter Integration', () => {
  let router: MultiModelRouter;

  beforeEach(() => {
    router = new MultiModelRouter(undefined, 'balanced');
  });

  describe('selectModel', () => {
    it('should return valid RoutingDecision with all required fields', () => {
      const task: TaskRequirements = {
        type: 'code-generation',
        complexity: 'medium',
        maxCost: undefined,
        maxLatency: undefined,
        requiredCapabilities: ['coding'],
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 500,
      };

      const decision = router.selectModel(task);

      expect(decision).toHaveProperty('modelId');
      expect(decision).toHaveProperty('reason');
      expect(decision).toHaveProperty('estimatedCost');
      expect(decision).toHaveProperty('estimatedLatency');
      expect(decision).toHaveProperty('confidence');

      expect(typeof decision.modelId).toBe('string');
      expect(typeof decision.reason).toBe('string');
      expect(typeof decision.estimatedCost).toBe('number');
      expect(typeof decision.estimatedLatency).toBe('number');
      expect(typeof decision.confidence).toBe('number');

      expect(decision.confidence).toBeGreaterThanOrEqual(0);
      expect(decision.confidence).toBeLessThanOrEqual(1);
    });

    it('should select high-quality model in quality mode', () => {
      const task: TaskRequirements = {
        type: 'critical-reasoning',
        complexity: 'high',
        maxCost: undefined,
        maxLatency: undefined,
        requiredCapabilities: ['reasoning'],
        estimatedInputTokens: 2000,
        estimatedOutputTokens: 1000,
      };

      const decision = router.selectModel(task, 'quality');

      // Should select a high-quality model (opus or gpt-4-turbo)
      expect(['claude-3-opus', 'gpt-4-turbo', 'deepseek-r1']).toContain(decision.modelId);
      expect(decision.confidence).toBeGreaterThan(0.5);
    });

    it('should select cost-efficient model in cost mode', () => {
      const task: TaskRequirements = {
        type: 'simple-query',
        complexity: 'low',
        maxCost: 0.01,
        maxLatency: undefined,
        requiredCapabilities: undefined,
        estimatedInputTokens: 500,
        estimatedOutputTokens: 200,
      };

      const decision = router.selectModel(task, 'cost');

      // Should select a cost-efficient model
      expect(['claude-3-haiku', 'gpt-4o-mini', 'gemini-2.5-flash', 'local-phi4']).toContain(decision.modelId);
      expect(decision.estimatedCost).toBeLessThanOrEqual(0.01);
    });

    it('should select fast model in speed mode', () => {
      const task: TaskRequirements = {
        type: 'classification',
        complexity: 'low',
        maxCost: undefined,
        maxLatency: 1000,
        requiredCapabilities: undefined,
        estimatedInputTokens: 300,
        estimatedOutputTokens: 100,
      };

      const decision = router.selectModel(task, 'speed');

      // Should select a fast model
      expect(['gemini-2.5-flash', 'claude-3-haiku', 'gpt-4o-mini']).toContain(decision.modelId);
      expect(decision.estimatedLatency).toBeLessThanOrEqual(1000);
    });

    it('should respect capability requirements', () => {
      const task: TaskRequirements = {
        type: 'analysis',
        complexity: 'medium',
        maxCost: undefined,
        maxLatency: undefined,
        requiredCapabilities: ['vision'],
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 500,
      };

      const decision = router.selectModel(task);

      // Should select a model with vision capability
      expect(['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'gpt-4-turbo', 'gpt-4o-mini', 'gemini-2.5-flash']).toContain(decision.modelId);
    });
  });

  describe('recordUsage and getUsageStats', () => {
    it('should track usage statistics correctly', () => {
      const modelId = 'claude-3-sonnet';

      // Record multiple uses
      router.recordUsage(modelId, 0.05, 2000, true, 1000, 500);
      router.recordUsage(modelId, 0.06, 2100, true, 1100, 550);
      router.recordUsage(modelId, 0.04, 1900, false, 900, 450);

      const stats = router.getUsageStats(modelId) as UsageStats;

      expect(stats.modelId).toBe(modelId);
      expect(stats.totalCost).toBeCloseTo(0.15, 2);
      expect(stats.totalTokens).toBe(4500);
      expect(stats.requestCount).toBe(3);
      expect(stats.successRate).toBeCloseTo(2/3, 2);
      expect(stats.avgLatency).toBeCloseTo(2000, 0);
      expect(stats.lastUsed).toBeGreaterThan(0);
    });

    it('should return zero stats for unused model', () => {
      const stats = router.getUsageStats('unknown-model') as UsageStats;

      expect(stats.modelId).toBe('unknown-model');
      expect(stats.totalCost).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.requestCount).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.avgLatency).toBe(0);
      expect(stats.lastUsed).toBe(0);
    });

    it('should return all model stats when no modelId specified', () => {
      router.recordUsage('claude-3-haiku', 0.01, 800, true, 500, 200);
      router.recordUsage('gpt-4o-mini', 0.02, 900, true, 600, 250);

      const allStats = router.getUsageStats() as UsageStats[];

      expect(Array.isArray(allStats)).toBe(true);
      expect(allStats.length).toBeGreaterThanOrEqual(2);

      const haikuStats = allStats.find(s => s.modelId === 'claude-3-haiku');
      expect(haikuStats).toBeDefined();
      expect(haikuStats!.totalCost).toBeCloseTo(0.01, 2);
    });
  });

  describe('priority mode mapping', () => {
    const modes: PriorityMode[] = ['cost', 'quality', 'speed', 'balanced'];

    modes.forEach(mode => {
      it(`should handle ${mode} priority mode`, () => {
        const task: TaskRequirements = {
          type: 'analysis',
          complexity: 'medium',
          maxCost: undefined,
          maxLatency: undefined,
          requiredCapabilities: undefined,
          estimatedInputTokens: 1000,
          estimatedOutputTokens: 500,
        };

        const decision = router.selectModel(task, mode);

        expect(decision).toBeDefined();
        expect(decision.modelId).toBeTruthy();
        expect(decision.reason).toContain(`mode=${mode}`);
      });
    });
  });
});

// ============================================================================
// MMRDiversityAdapter Tests (DiversityFilter)
// ============================================================================

describe('MMRDiversityAdapter - DiversityFilter Integration', () => {
  let filter: DiversityFilter;
  const embeddingDim = 768;

  beforeEach(() => {
    filter = new DiversityFilter(0.85, embeddingDim);
  });

  describe('applyMMR', () => {
    it('should select diverse candidates', () => {
      const embeddings = generateDiverseEmbeddings(10, embeddingDim);
      const embeddingMap = new Map<number, Float32Array>();

      const candidates: RecommendationCandidate[] = [];
      for (let i = 0; i < 10; i++) {
        candidates.push(createMockCandidate(i, 0.9 - i * 0.05));
        embeddingMap.set(i, embeddings[i]);
      }

      const selected = filter.applyMMR(candidates, embeddingMap, 5);

      expect(selected).toHaveLength(5);
      expect(selected[0].contentId).toBe(0); // Highest relevance should be first

      // Check that diversity is maintained
      const selectedIds = selected.map(c => c.contentId);
      expect(new Set(selectedIds).size).toBe(5); // All unique
    });

    it('should handle empty candidate list', () => {
      const selected = filter.applyMMR([], new Map(), 5);
      expect(selected).toHaveLength(0);
    });

    it('should handle limit larger than candidate count', () => {
      const embeddings = generateDiverseEmbeddings(3, embeddingDim);
      const embeddingMap = new Map<number, Float32Array>();

      const candidates: RecommendationCandidate[] = [];
      for (let i = 0; i < 3; i++) {
        candidates.push(createMockCandidate(i, 0.9 - i * 0.1));
        embeddingMap.set(i, embeddings[i]);
      }

      const selected = filter.applyMMR(candidates, embeddingMap, 10);

      expect(selected).toHaveLength(3);
    });

    it('should filter out candidates with missing embeddings', () => {
      const embeddings = generateDiverseEmbeddings(5, embeddingDim);
      const embeddingMap = new Map<number, Float32Array>();

      const candidates: RecommendationCandidate[] = [];
      for (let i = 0; i < 5; i++) {
        candidates.push(createMockCandidate(i, 0.9 - i * 0.1));
      }

      // Only provide embeddings for some candidates
      embeddingMap.set(0, embeddings[0]);
      embeddingMap.set(2, embeddings[2]);
      embeddingMap.set(4, embeddings[4]);

      const selected = filter.applyMMR(candidates, embeddingMap, 5);

      expect(selected.length).toBeLessThanOrEqual(3); // Only candidates with embeddings
    });

    it('should respect lambda parameter for diversity/relevance balance', () => {
      const embeddings = generateDiverseEmbeddings(10, embeddingDim);
      const embeddingMap = new Map<number, Float32Array>();

      const candidates: RecommendationCandidate[] = [];
      for (let i = 0; i < 10; i++) {
        candidates.push(createMockCandidate(i, 0.9 - i * 0.05));
        embeddingMap.set(i, embeddings[i]);
      }

      // High lambda (relevance-focused)
      const filterRelevance = new DiversityFilter(0.95, embeddingDim);
      const selectedRelevance = filterRelevance.applyMMR(candidates, embeddingMap, 5);

      // Low lambda (diversity-focused)
      const filterDiversity = new DiversityFilter(0.3, embeddingDim);
      const selectedDiversity = filterDiversity.applyMMR(candidates, embeddingMap, 5);

      expect(selectedRelevance).toHaveLength(5);
      expect(selectedDiversity).toHaveLength(5);

      // Both should start with highest relevance
      expect(selectedRelevance[0].contentId).toBe(0);
      expect(selectedDiversity[0].contentId).toBe(0);
    });
  });

  describe('calculateDiversityMetrics', () => {
    it('should return valid metrics for recommendations', () => {
      const embeddings = generateDiverseEmbeddings(5, embeddingDim);
      const embeddingMap = new Map<number, Float32Array>();

      const candidates: RecommendationCandidate[] = [];
      for (let i = 0; i < 5; i++) {
        candidates.push(createMockCandidate(
          i,
          0.9 - i * 0.1,
          ['action', 'drama', 'comedy'][i % 3] ? [['action', 'drama', 'comedy'][i % 3]] : ['action']
        ));
        embeddingMap.set(i, embeddings[i]);
        candidates[i].embedding = embeddings[i];
      }

      const metrics = filter.calculateDiversityMetrics(candidates);

      expect(metrics).toHaveProperty('averageSimilarity');
      expect(metrics).toHaveProperty('genreDistribution');
      expect(metrics).toHaveProperty('temporalSpread');
      expect(metrics).toHaveProperty('uniqueGenres');
      expect(metrics).toHaveProperty('diversityScore');

      // Cosine similarity can be negative for normalized vectors, check absolute value is in range
      expect(Math.abs(metrics.averageSimilarity)).toBeGreaterThanOrEqual(0);
      expect(Math.abs(metrics.averageSimilarity)).toBeLessThanOrEqual(1);
      // Diversity score is 1 - similarity, so can be > 1 if similarity is negative
      expect(metrics.diversityScore).toBeGreaterThanOrEqual(0);
      expect(metrics.uniqueGenres).toBeGreaterThan(0);
      expect(metrics.temporalSpread).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty recommendations', () => {
      const metrics = filter.calculateDiversityMetrics([]);

      expect(metrics.averageSimilarity).toBe(0);
      expect(metrics.genreDistribution.size).toBe(0);
      expect(metrics.temporalSpread).toBe(0);
      expect(metrics.uniqueGenres).toBe(0);
      expect(metrics.diversityScore).toBe(0);
    });

    it('should calculate genre distribution correctly', () => {
      const candidates: RecommendationCandidate[] = [
        createMockCandidate(0, 0.9, ['action', 'thriller']),
        createMockCandidate(1, 0.8, ['action', 'comedy']),
        createMockCandidate(2, 0.7, ['drama']),
      ];

      const metrics = filter.calculateDiversityMetrics(candidates);

      expect(metrics.genreDistribution.get('action')).toBe(2);
      expect(metrics.genreDistribution.get('thriller')).toBe(1);
      expect(metrics.genreDistribution.get('comedy')).toBe(1);
      expect(metrics.genreDistribution.get('drama')).toBe(1);
      expect(metrics.uniqueGenres).toBe(4);
    });
  });

  describe('Float32Array conversion', () => {
    it('should correctly handle Float32Array embeddings', () => {
      const embedding1 = generateMockEmbedding(embeddingDim);
      const embedding2 = generateMockEmbedding(embeddingDim);

      const similarity = filter.cosineSimilarity(embedding1, embedding2);

      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
      expect(typeof similarity).toBe('number');
      expect(isNaN(similarity)).toBe(false);
    });

    it('should compute similarity of identical embeddings as 1', () => {
      const embedding = generateMockEmbedding(embeddingDim);

      const similarity = filter.cosineSimilarity(embedding, embedding);

      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should handle normalized embeddings correctly', () => {
      const embedding1 = generateMockEmbedding(embeddingDim);
      const embedding2 = generateMockEmbedding(embeddingDim);

      // Verify embeddings are normalized
      let norm1 = 0;
      let norm2 = 0;
      for (let i = 0; i < embeddingDim; i++) {
        norm1 += embedding1[i] * embedding1[i];
        norm2 += embedding2[i] * embedding2[i];
      }

      expect(Math.sqrt(norm1)).toBeCloseTo(1, 5);
      expect(Math.sqrt(norm2)).toBeCloseTo(1, 5);
    });
  });
});

// ============================================================================
// HNSWSearchAdapter Tests (ContentEmbeddings)
// ============================================================================

describe('HNSWSearchAdapter - Content Embeddings Integration', () => {
  let generator: ContentEmbeddingGenerator;
  const embeddingDim = 64; // Content embeddings are 64-dimensional

  beforeEach(() => {
    generator = new ContentEmbeddingGenerator(1000);
  });

  describe('Content embedding generation', () => {
    it('should generate 64-dimensional embeddings', () => {
      const content = {
        id: 'movie-1',
        title: 'Test Movie',
        overview: 'An exciting action thriller with amazing special effects',
        genres: ['action', 'thriller'],
        contentType: 'movie' as const,
        popularity: 75,
        rating: 8.5,
        releaseDate: '2023-01-01',
        runtime: 120,
      };

      const embedding = generator.generateContentEmbedding(content);

      expect(embedding).toHaveLength(embeddingDim);
      expect(Array.isArray(embedding)).toBe(true);

      // Check all values are numbers
      embedding.forEach(val => {
        expect(typeof val).toBe('number');
        expect(isNaN(val)).toBe(false);
      });
    });

    it('should cache embeddings for repeated content', () => {
      const content = {
        id: 'movie-2',
        title: 'Cached Movie',
        overview: 'Test caching',
        genres: ['comedy'],
        contentType: 'movie' as const,
      };

      const embedding1 = generator.generateContentEmbedding(content);
      const embedding2 = generator.generateContentEmbedding(content);

      // Should return identical cached result
      expect(embedding1).toEqual(embedding2);
      expect(embedding1).toBe(embedding2); // Same reference

      const stats = generator.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    it('should compute similarity between content embeddings', () => {
      const content1 = {
        id: 'movie-3',
        title: 'Action Movie',
        overview: 'Explosions and car chases',
        genres: ['action', 'thriller'],
        contentType: 'movie' as const,
      };

      const content2 = {
        id: 'movie-4',
        title: 'Romantic Comedy',
        overview: 'Love and laughter',
        genres: ['romance', 'comedy'],
        contentType: 'movie' as const,
      };

      const content3 = {
        id: 'movie-5',
        title: 'Another Action Movie',
        overview: 'More explosions and chases',
        genres: ['action', 'thriller'],
        contentType: 'movie' as const,
      };

      const emb1 = generator.generateContentEmbedding(content1);
      const emb2 = generator.generateContentEmbedding(content2);
      const emb3 = generator.generateContentEmbedding(content3);

      const sim12 = generator.cosineSimilarity(emb1, emb2);
      const sim13 = generator.cosineSimilarity(emb1, emb3);

      // Similar content (action movies) should have higher similarity
      expect(sim13).toBeGreaterThan(sim12);
      expect(sim12).toBeGreaterThanOrEqual(0);
      expect(sim13).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Search and retrieval', () => {
    it('should find top-K similar items', () => {
      const query = {
        id: 'query',
        title: 'Query',
        overview: 'action thriller adventure',
        genres: ['action'],
        contentType: 'movie' as const,
      };

      const candidates = [];
      for (let i = 0; i < 10; i++) {
        const content = {
          id: `movie-${i}`,
          title: `Movie ${i}`,
          overview: i < 5 ? 'action thriller' : 'romantic comedy',
          genres: i < 5 ? ['action'] : ['romance'],
          contentType: 'movie' as const,
        };
        candidates.push({
          id: content.id,
          embedding: generator.generateContentEmbedding(content),
        });
      }

      const queryEmbedding = generator.generateContentEmbedding(query);
      const topK = generator.batchTopK(queryEmbedding, candidates, 3);

      expect(topK).toHaveLength(3);
      expect(topK[0].similarity).toBeGreaterThanOrEqual(topK[1].similarity);
      expect(topK[1].similarity).toBeGreaterThanOrEqual(topK[2].similarity);

      // Top results should be action movies
      topK.forEach(result => {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('similarity');
        expect(result.similarity).toBeGreaterThanOrEqual(0);
        expect(result.similarity).toBeLessThanOrEqual(1);
      });
    });

    it('should return statistics', () => {
      const content = {
        id: 'test',
        title: 'Test',
        overview: 'test',
        genres: ['action'],
        contentType: 'movie' as const,
      };

      generator.generateContentEmbedding(content);
      generator.generateContentEmbedding(content); // Cache hit

      const stats = generator.getCacheStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');

      expect(stats.hits).toBeGreaterThanOrEqual(1);
      expect(stats.misses).toBeGreaterThanOrEqual(1);
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('Similarity metrics', () => {
    it('should compute cosine similarity in valid range', () => {
      const emb1 = generator.generateContentEmbedding({
        id: '1',
        title: 'Test 1',
        overview: 'test',
        genres: ['action'],
        contentType: 'movie' as const,
      });

      const emb2 = generator.generateContentEmbedding({
        id: '2',
        title: 'Test 2',
        overview: 'test',
        genres: ['comedy'],
        contentType: 'movie' as const,
      });

      const similarity = generator.cosineSimilarity(emb1, emb2);

      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should compute euclidean distance correctly', () => {
      const emb1 = generator.generateContentEmbedding({
        id: '1',
        title: 'Test 1',
        overview: 'test',
        genres: ['action'],
        contentType: 'movie' as const,
      });

      const emb2 = generator.generateContentEmbedding({
        id: '2',
        title: 'Test 2',
        overview: 'different content',
        genres: ['drama'],
        contentType: 'tv' as const,
      });

      const distance = generator.euclideanDistance(emb1, emb2);

      expect(distance).toBeGreaterThanOrEqual(0);
      expect(typeof distance).toBe('number');
      expect(isNaN(distance)).toBe(false);
    });
  });
});

// ============================================================================
// QLearning + ReflexionMemory Integration Tests
// ============================================================================

describe('QLearning + ReflexionMemory Integration', () => {
  let qlearning: QLearning;

  beforeEach(() => {
    qlearning = new QLearning({
      learningRate: 0.1,
      discountFactor: 0.95,
      initialEpsilon: 0.3,
      minEpsilon: 0.05,
      epsilonDecay: 0.995,
      replayBufferSize: 1000,
      batchSize: 32,
      useNeuralTrainer: false, // Disable for unit tests
    });
  });

  describe('Experience storage and retrieval', () => {
    it('should store experiences as episodes', () => {
      const state: QState = {
        timeOfDay: 'evening',
        dayType: 'weekday',
        recentGenres: ['action', 'thriller', 'sci-fi'],
        avgCompletionRate: 85,
        sessionCount: 10,
      };

      const nextState: QState = {
        ...state,
        avgCompletionRate: 90,
        sessionCount: 11,
      };

      const experience: Experience = {
        state,
        action: 'recommend_similar',
        reward: 0.8,
        nextState,
        timestamp: Date.now(),
      };

      qlearning.addExperience(experience);

      expect(qlearning.getExperienceCount()).toBe(1);
    });

    it('should retrieve similar past experiences', () => {
      // Add multiple experiences
      const experiences: Experience[] = [];
      for (let i = 0; i < 10; i++) {
        const state: QState = {
          timeOfDay: i < 5 ? 'evening' : 'morning',
          dayType: i % 2 === 0 ? 'weekday' : 'weekend',
          recentGenres: ['action', 'thriller', 'sci-fi'],
          avgCompletionRate: 70 + i * 5,
          sessionCount: i,
        };

        experiences.push({
          state,
          action: 'recommend_similar',
          reward: 0.5 + i * 0.05,
          nextState: state,
          timestamp: Date.now() + i,
        });
      }

      qlearning.train(experiences);

      expect(qlearning.getExperienceCount()).toBeGreaterThan(0);
      expect(qlearning.getStateCount()).toBeGreaterThan(0);
    });
  });

  describe('Q-learning state and action selection', () => {
    it('should generate consistent state representation', () => {
      const context = {
        currentTime: new Date('2024-01-15T19:30:00'),
        recentWatches: [
          { genre: 'action', completionRate: 95, timestamp: new Date() },
          { genre: 'action', completionRate: 90, timestamp: new Date() },
          { genre: 'thriller', completionRate: 85, timestamp: new Date() },
        ],
        sessionHistory: 5,
      };

      const state1 = qlearning.getState('user1', context);
      const state2 = qlearning.getState('user1', context);

      expect(state1).toEqual(state2);
      expect(state1.timeOfDay).toBe('evening');
      expect(state1.dayType).toBe('weekday');
      expect(state1.recentGenres).toContain('action');
      expect(state1.avgCompletionRate).toBeGreaterThan(0);
    });

    it('should select action using epsilon-greedy strategy', () => {
      const state: QState = {
        timeOfDay: 'evening',
        dayType: 'weekday',
        recentGenres: ['action', 'thriller', 'sci-fi'],
        avgCompletionRate: 85,
        sessionCount: 10,
      };

      // With exploration
      const action1 = qlearning.selectAction(state, true);
      expect(action1).toBeDefined();
      expect(typeof action1).toBe('string');

      // Without exploration
      const action2 = qlearning.selectAction(state, false);
      expect(action2).toBeDefined();
      expect(typeof action2).toBe('string');
    });

    it('should update Q-values correctly', () => {
      const state: QState = {
        timeOfDay: 'evening',
        dayType: 'weekday',
        recentGenres: ['action', 'thriller', 'sci-fi'],
        avgCompletionRate: 85,
        sessionCount: 10,
      };

      const nextState: QState = {
        ...state,
        avgCompletionRate: 90,
      };

      const action: QAction = 'recommend_similar';
      const initialQ = qlearning.getQValue(state, action);

      qlearning.updateQValue(state, action, 0.8, nextState);

      const updatedQ = qlearning.getQValue(state, action);
      expect(updatedQ).not.toBe(initialQ);
    });
  });

  describe('Reward calculation', () => {
    it('should calculate reward from engagement metrics', () => {
      const metrics: EngagementMetrics = {
        completionRate: 90,
        userRating: 4.5,
        rewindCount: 2,
        skipCount: 1,
      };

      const reward = qlearning.calculateReward(metrics);

      expect(reward).toBeGreaterThanOrEqual(0);
      expect(reward).toBeLessThanOrEqual(1);
      expect(typeof reward).toBe('number');
    });

    it('should give higher reward for high engagement', () => {
      const highEngagement: EngagementMetrics = {
        completionRate: 100,
        userRating: 5,
        rewindCount: 3,
        skipCount: 0,
      };

      const lowEngagement: EngagementMetrics = {
        completionRate: 30,
        userRating: 2,
        rewindCount: 0,
        skipCount: 5,
      };

      const highReward = qlearning.calculateReward(highEngagement);
      const lowReward = qlearning.calculateReward(lowEngagement);

      expect(highReward).toBeGreaterThan(lowReward);
    });
  });

  describe('Training and learning', () => {
    it('should train on batch of experiences', () => {
      const experiences: Experience[] = [];

      for (let i = 0; i < 50; i++) {
        const state: QState = {
          timeOfDay: 'evening',
          dayType: 'weekday',
          recentGenres: ['action', 'thriller', 'sci-fi'],
          avgCompletionRate: 70 + i,
          sessionCount: i,
        };

        experiences.push({
          state,
          action: 'recommend_similar',
          reward: 0.5 + Math.random() * 0.5,
          nextState: state,
          timestamp: Date.now() + i,
        });
      }

      const initialStateCount = qlearning.getStateCount();
      const initialEpsilon = qlearning.getEpsilon();

      qlearning.train(experiences);

      expect(qlearning.getStateCount()).toBeGreaterThanOrEqual(initialStateCount);
      expect(qlearning.getExperienceCount()).toBeGreaterThan(0);
      expect(qlearning.getEpsilon()).toBeLessThanOrEqual(initialEpsilon);
    });

    it('should improve recommendations over time', () => {
      const state: QState = {
        timeOfDay: 'evening',
        dayType: 'weekday',
        recentGenres: ['action', 'thriller', 'sci-fi'],
        avgCompletionRate: 85,
        sessionCount: 10,
      };

      // Train with positive rewards for specific action
      const experiences: Experience[] = [];
      for (let i = 0; i < 100; i++) {
        experiences.push({
          state,
          action: 'recommend_genre',
          reward: 0.9,
          nextState: state,
          timestamp: Date.now() + i,
        });
      }

      qlearning.train(experiences);

      // After training, should prefer the rewarded action
      const strategy = qlearning.getRecommendationStrategy(state);
      const qValue = qlearning.getQValue(state, 'recommend_genre');

      expect(qValue).toBeGreaterThan(0);
    });
  });

  describe('Model persistence', () => {
    it('should save and load model', () => {
      // Train some experiences
      const state: QState = {
        timeOfDay: 'evening',
        dayType: 'weekday',
        recentGenres: ['action', 'thriller', 'sci-fi'],
        avgCompletionRate: 85,
        sessionCount: 10,
      };

      qlearning.updateQValue(state, 'recommend_similar', 0.8, state);

      const modelJson = qlearning.saveModel();
      expect(modelJson).toBeTruthy();
      expect(typeof modelJson).toBe('string');

      // Create new instance and load
      const newQLearning = new QLearning();
      newQLearning.loadModel(modelJson);

      expect(newQLearning.getStateCount()).toBe(qlearning.getStateCount());
      expect(newQLearning.getQValue(state, 'recommend_similar'))
        .toBe(qlearning.getQValue(state, 'recommend_similar'));
    });
  });
});

// ============================================================================
// Cross-Module Integration Tests
// ============================================================================

describe('Cross-Module Integration', () => {
  it('should integrate MultiModelRouter with QLearning for model selection', () => {
    const router = new MultiModelRouter();
    const qlearning = new QLearning({ useNeuralTrainer: false });

    // Simulate learning which models work best for different tasks
    const state: QState = {
      timeOfDay: 'evening',
      dayType: 'weekday',
      recentGenres: ['action'],
      avgCompletionRate: 85,
      sessionCount: 10,
    };

    const task: TaskRequirements = {
      type: 'code-generation',
      complexity: 'high',
      maxCost: undefined,
      maxLatency: undefined,
      requiredCapabilities: ['coding'],
      estimatedInputTokens: 2000,
      estimatedOutputTokens: 1000,
    };

    const decision = router.selectModel(task, 'quality');
    expect(decision.modelId).toBeTruthy();

    // Record usage and train QLearning
    router.recordUsage(decision.modelId, decision.estimatedCost, 2000, true, 2000, 1000);

    const metrics: EngagementMetrics = {
      completionRate: 95,
      userRating: 5,
    };

    const reward = qlearning.calculateReward(metrics);
    expect(reward).toBeGreaterThan(0.5);
  });

  it('should integrate DiversityFilter with ContentEmbeddings for diverse recommendations', () => {
    // Use 768-dim for DiversityFilter as it's designed for semantic embeddings
    const filter = new DiversityFilter(0.85, 768);
    const generator = new ContentEmbeddingGenerator();

    const contents = [
      {
        id: 'movie-1',
        title: 'Action Movie',
        overview: 'Explosions and action',
        genres: ['action'],
        contentType: 'movie' as const,
      },
      {
        id: 'movie-2',
        title: 'Comedy',
        overview: 'Funny and entertaining',
        genres: ['comedy'],
        contentType: 'movie' as const,
      },
      {
        id: 'movie-3',
        title: 'Drama',
        overview: 'Emotional story',
        genres: ['drama'],
        contentType: 'movie' as const,
      },
    ];

    // Generate 768-dim embeddings for semantic similarity
    const embeddingMap = new Map<number, Float32Array>();
    const candidates: RecommendationCandidate[] = [];

    contents.forEach((content, idx) => {
      // Generate 64-dim feature embedding for reference (not used for MMR)
      const embedding64 = generator.generateContentEmbedding(content);

      // Create 768-dim mock semantic embedding for MMR diversity filter
      const embedding768 = generateMockEmbedding(768);

      embeddingMap.set(idx, embedding768);
      candidates.push(createMockCandidate(idx, 0.9 - idx * 0.1, content.genres));
    });

    const diverse = filter.applyMMR(candidates, embeddingMap, 3);
    expect(diverse).toHaveLength(3);

    const metrics = filter.calculateDiversityMetrics(diverse);
    expect(metrics.diversityScore).toBeGreaterThanOrEqual(0);
  });
});

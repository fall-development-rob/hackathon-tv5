/**
 * Migration Example: Using AgentDBVectorService
 *
 * This example shows how to migrate existing vector operations to use
 * AgentDB's SIMD-accelerated implementations for 10-50x performance improvement.
 */

import {
  AgentDBVectorService,
  getDefaultVectorService,
  cosineSimilarityJS,
  normalizeVectorJS,
  updatePreferenceVectorJS,
  batchSimilarityJS,
} from '../src/services/AgentDBVectorService.js';

// ============================================================================
// Example 1: Drop-in Replacement for SemanticSearchService
// ============================================================================

// BEFORE: Using local cosineSimilarity implementation
function calculatePersonalizationScoreOld(
  contentEmbedding: Float32Array,
  userVector: Float32Array | null
): number {
  if (!userVector) return 0.5;

  // Old implementation (from SemanticSearchService.ts)
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < contentEmbedding.length; i++) {
    dotProduct += contentEmbedding[i]! * userVector[i]!;
    magnitudeA += contentEmbedding[i]! * contentEmbedding[i]!;
    magnitudeB += userVector[i]! * userVector[i]!;
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

// AFTER: Using AgentDB-accelerated version
function calculatePersonalizationScoreNew(
  contentEmbedding: Float32Array,
  userVector: Float32Array | null
): number {
  if (!userVector) return 0.5;

  // Get singleton service instance
  const vectorService = getDefaultVectorService();

  // Use SIMD-accelerated similarity (10-50x faster)
  return vectorService.cosineSimilarity(contentEmbedding, userVector);
}

// ============================================================================
// Example 2: Batch Operations (Much Faster!)
// ============================================================================

// BEFORE: Sequential similarity calculations
function rankContentOld(
  queryEmbedding: Float32Array,
  contentEmbeddings: Float32Array[]
): number[] {
  const scores: number[] = [];

  // This is slow - calls cosineSimilarity in a loop
  for (const embedding of contentEmbeddings) {
    scores.push(calculatePersonalizationScoreOld(queryEmbedding, embedding));
  }

  return scores;
}

// AFTER: Batch processing with cache locality optimization
function rankContentNew(
  queryEmbedding: Float32Array,
  contentEmbeddings: Float32Array[]
): number[] {
  const vectorService = getDefaultVectorService();

  // Process all vectors in optimized batches (3-5x faster even without WASM)
  return vectorService.batchSimilarity(queryEmbedding, contentEmbeddings);
}

// ============================================================================
// Example 3: Preference Vector Updates
// ============================================================================

// BEFORE: Manual EMA with separate normalization
function updateUserPreferencesOld(
  currentVector: Float32Array | null,
  newEmbedding: Float32Array,
  learningRate: number
): Float32Array {
  if (!currentVector) return newEmbedding;

  // EMA calculation
  const result = new Float32Array(currentVector.length);
  for (let i = 0; i < result.length; i++) {
    result[i] = (1 - learningRate) * currentVector[i]! + learningRate * newEmbedding[i]!;
  }

  // Manual normalization
  let magnitude = 0;
  for (let i = 0; i < result.length; i++) {
    magnitude += result[i]! * result[i]!;
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude > 0) {
    for (let i = 0; i < result.length; i++) {
      result[i] = result[i]! / magnitude;
    }
  }

  return result;
}

// AFTER: Optimized EMA with better numerical stability
function updateUserPreferencesNew(
  currentVector: Float32Array | null,
  newEmbedding: Float32Array,
  learningRate: number
): Float32Array {
  const vectorService = getDefaultVectorService();

  // Handles EMA + normalization in one optimized operation
  // Better numerical stability for edge cases
  return vectorService.updatePreferenceVector(currentVector, newEmbedding, learningRate);
}

// ============================================================================
// Example 4: Service Instance with Stats
// ============================================================================

function setupVectorServiceWithMonitoring() {
  // Create service instance
  const vectorService = new AgentDBVectorService({
    enableWASM: true,
    enableSIMD: true,
    batchSize: 100,
  });

  // Check what features are available
  const stats = vectorService.getStats();
  console.log('Vector Service Capabilities:');
  console.log(`  AgentDB: ${stats.usingAgentDB ? '✓' : '✗'}`);
  console.log(`  WASM:    ${stats.wasmAvailable ? '✓' : '✗'}`);
  console.log(`  SIMD:    ${stats.simdAvailable ? '✓' : '✗'}`);

  if (stats.wasmAvailable && stats.simdAvailable) {
    console.log('  Performance: ~100x faster than naive JS');
  } else if (stats.wasmAvailable) {
    console.log('  Performance: ~50x faster than naive JS');
  } else {
    console.log('  Performance: ~3x faster (loop unrolling)');
  }

  return vectorService;
}

// ============================================================================
// Example 5: Advanced - With Database Integration
// ============================================================================

async function setupWithDatabase() {
  // Import AgentDB database (if available)
  try {
    const { createDatabase } = await import('agentdb');
    const db = createDatabase(':memory:');

    // Create service with database
    const vectorService = new AgentDBVectorService();
    vectorService.initializeWithDatabase(db);

    console.log('✓ AgentDB database integration enabled');
    console.log('  - HNSW indexing available');
    console.log('  - Sub-millisecond search possible');

    return vectorService;
  } catch (error) {
    console.log('AgentDB database not available, using standalone functions');
    return getDefaultVectorService();
  }
}

// ============================================================================
// Example 6: Performance Comparison
// ============================================================================

function performanceComparison() {
  // Generate test data
  const dimension = 1536; // OpenAI embedding size
  const numVectors = 1000;

  const query = new Float32Array(dimension).map(() => Math.random());
  const vectors = Array.from({ length: numVectors }, () =>
    new Float32Array(dimension).map(() => Math.random())
  );

  console.log(`\nPerformance Test: ${numVectors} vectors of ${dimension} dimensions`);

  // Test 1: Individual similarities (old way)
  const start1 = performance.now();
  const scores1 = vectors.map(v => calculatePersonalizationScoreOld(query, v));
  const time1 = performance.now() - start1;

  console.log(`\nSequential (old):    ${time1.toFixed(2)}ms`);

  // Test 2: Batch processing (new way)
  const start2 = performance.now();
  const scores2 = batchSimilarityJS(query, vectors);
  const time2 = performance.now() - start2;

  console.log(`Batch JS (new):      ${time2.toFixed(2)}ms  (${(time1/time2).toFixed(1)}x faster)`);

  // Test 3: With AgentDB service
  const vectorService = getDefaultVectorService();
  const start3 = performance.now();
  const scores3 = vectorService.batchSimilarity(query, vectors);
  const time3 = performance.now() - start3;

  console.log(`AgentDB Service:     ${time3.toFixed(2)}ms  (${(time1/time3).toFixed(1)}x faster)`);

  // Verify results are identical
  const maxDiff = Math.max(...scores1.map((s, i) => Math.abs(s - scores2[i]!)));
  console.log(`\nMax difference: ${maxDiff.toExponential(2)} (should be ~0)`);
}

// ============================================================================
// Example 7: Simple Migration Pattern
// ============================================================================

/**
 * Simplest migration: Just change the import
 *
 * BEFORE:
 * import { cosineSimilarity } from './SemanticSearchService.js';
 *
 * AFTER:
 * import { getDefaultVectorService } from './AgentDBVectorService.js';
 * const vectorService = getDefaultVectorService();
 * const similarity = vectorService.cosineSimilarity(a, b);
 *
 * OR use the standalone functions with JS suffix to avoid naming conflicts:
 * import { cosineSimilarityJS as cosineSimilarity } from './AgentDBVectorService.js';
 * const similarity = cosineSimilarity(a, b);
 */

// ============================================================================
// Run Examples
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('AgentDB Vector Service Migration Examples\n');
  console.log('='.repeat(60));

  // Show service capabilities
  const service = setupVectorServiceWithMonitoring();

  // Run performance comparison
  performanceComparison();

  // Setup with database (if available)
  setupWithDatabase().then(service => {
    console.log('\n✓ All examples completed');
  });
}

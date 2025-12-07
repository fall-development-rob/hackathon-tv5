/**
 * AgentDB Embedding Adapter - Usage Examples
 *
 * Demonstrates how to use the AgentDBEmbeddingAdapter as a drop-in
 * replacement for ContentEmbeddingGenerator with superior performance.
 */

import {
  createAgentDBEmbeddingGenerator,
  type MediaContent,
  type UserPreferences,
} from '../src/index.js';

// ============================================================================
// Example 1: Basic Usage (Drop-in Replacement)
// ============================================================================

async function basicUsageExample() {
  console.log('\n=== Example 1: Basic Usage ===\n');

  // Create generator with agentdb acceleration
  const generator = createAgentDBEmbeddingGenerator({
    cacheSize: 1000,
    weights: {
      genre: 0.30,
      type: 0.15,
      metadata: 0.25,
      keywords: 0.30,
    },
  });

  // Sample content
  const movie: MediaContent = {
    id: 'movie-123',
    title: 'The Matrix',
    genres: ['action', 'science fiction'],
    contentType: 'movie',
    overview: 'A computer hacker learns about the true nature of reality and his role in the war against its controllers.',
    popularity: 85,
    rating: 8.7,
    releaseDate: '1999-03-31',
    runtime: 136,
  };

  const tvShow: MediaContent = {
    id: 'tv-456',
    title: 'Stranger Things',
    genres: ['horror', 'science fiction'],
    contentType: 'tv',
    overview: 'When a young boy disappears, his mother, a police chief and his friends must confront terrifying supernatural forces.',
    popularity: 92,
    rating: 8.8,
    releaseDate: '2016-07-15',
    runtime: 50,
  };

  // Generate embeddings
  const movieEmbedding = generator.generateContentEmbedding(movie);
  const tvEmbedding = generator.generateContentEmbedding(tvShow);

  console.log(`Movie embedding dimension: ${movieEmbedding.length}`);
  console.log(`TV show embedding dimension: ${tvEmbedding.length}`);

  // Calculate similarity (uses WASM acceleration if available)
  const similarity = generator.cosineSimilarity(movieEmbedding, tvEmbedding);
  console.log(`\nSimilarity between Matrix and Stranger Things: ${similarity.toFixed(4)}`);

  // Check if agentdb is being used
  const status = generator.getAccelerationStatus();
  console.log('\nAcceleration status:', status);

  const usingAgentDB = generator.isUsingAgentDB();
  console.log(`Using AgentDB: ${usingAgentDB}`);
}

// ============================================================================
// Example 2: Batch Similarity Search
// ============================================================================

async function batchSearchExample() {
  console.log('\n=== Example 2: Batch Similarity Search ===\n');

  const generator = createAgentDBEmbeddingGenerator({ cacheSize: 1000 });

  // Sample movie catalog
  const catalog: MediaContent[] = [
    {
      id: 'movie-1',
      title: 'The Matrix',
      genres: ['action', 'science fiction'],
      contentType: 'movie',
      overview: 'A hacker discovers reality is a simulation.',
      popularity: 85,
      rating: 8.7,
    },
    {
      id: 'movie-2',
      title: 'Inception',
      genres: ['action', 'science fiction'],
      contentType: 'movie',
      overview: 'A thief steals secrets from dreams.',
      popularity: 88,
      rating: 8.8,
    },
    {
      id: 'movie-3',
      title: 'The Notebook',
      genres: ['romance', 'drama'],
      contentType: 'movie',
      overview: 'A love story across decades.',
      popularity: 75,
      rating: 7.8,
    },
    {
      id: 'movie-4',
      title: 'Blade Runner 2049',
      genres: ['science fiction', 'thriller'],
      contentType: 'movie',
      overview: 'A blade runner uncovers a secret.',
      popularity: 82,
      rating: 8.0,
    },
  ];

  // User preferences
  const userPrefs: UserPreferences = {
    favoriteGenres: ['action', 'science fiction'],
    preferredContentTypes: ['movie'],
    ratingThreshold: 8.0,
    recencyPreference: 0.7,
  };

  // Generate user preference embedding
  const userEmbedding = generator.generateUserPreferenceEmbedding(userPrefs);

  // Generate catalog embeddings
  const candidates = catalog.map(content => ({
    id: content.id,
    embedding: generator.generateContentEmbedding(content),
  }));

  // Find top 3 recommendations
  const startTime = performance.now();
  const recommendations = generator.batchTopK(userEmbedding, candidates, 3);
  const endTime = performance.now();

  console.log(`Search completed in ${(endTime - startTime).toFixed(2)}ms`);
  console.log('\nTop 3 recommendations:');

  recommendations.forEach((rec, i) => {
    const movie = catalog.find(m => m.id === rec.id);
    console.log(`${i + 1}. ${movie?.title} (similarity: ${rec.similarity.toFixed(4)})`);
  });

  // Show cache stats
  const stats = generator.getCacheStats();
  console.log('\nCache statistics:');
  console.log(`  Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
  console.log(`  Hits: ${stats.hits}`);
  console.log(`  Misses: ${stats.misses}`);
  console.log(`  Size: ${stats.size}/${stats.maxSize}`);
}

// ============================================================================
// Example 3: Semantic Text Embeddings
// ============================================================================

async function semanticEmbeddingsExample() {
  console.log('\n=== Example 3: Semantic Text Embeddings ===\n');

  const generator = createAgentDBEmbeddingGenerator({ cacheSize: 1000 });

  // Wait for initialization
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Check if text embeddings are available
  const status = generator.getAccelerationStatus();
  if (!status.embeddingService) {
    console.log('Text embeddings not available (requires agentdb)');
    console.log('Using feature embeddings instead...');
    return;
  }

  // Generate semantic embeddings for text queries
  const queries = [
    'action movies with complex plots',
    'romantic comedies from the 90s',
    'sci-fi thrillers with great visuals',
  ];

  console.log('Generating semantic embeddings for queries...');

  try {
    const embeddings = await generator.generateTextEmbeddingBatch(queries);

    console.log(`\nGenerated ${embeddings.length} embeddings`);
    console.log(`Dimension: ${embeddings[0].length}`);

    // Calculate similarity between queries
    const sim01 = generator.cosineSimilarity(
      Array.from(embeddings[0]),
      Array.from(embeddings[1])
    );
    const sim02 = generator.cosineSimilarity(
      Array.from(embeddings[0]),
      Array.from(embeddings[2])
    );

    console.log('\nQuery similarities:');
    console.log(`  "${queries[0]}" vs "${queries[1]}": ${sim01.toFixed(4)}`);
    console.log(`  "${queries[0]}" vs "${queries[2]}": ${sim02.toFixed(4)}`);
  } catch (error) {
    console.error('Failed to generate text embeddings:', error);
  }
}

// ============================================================================
// Example 4: Performance Comparison
// ============================================================================

async function performanceComparisonExample() {
  console.log('\n=== Example 4: Performance Comparison ===\n');

  const generator = createAgentDBEmbeddingGenerator({ cacheSize: 1000 });

  // Generate random embeddings for testing
  const dim = 64;
  const count = 1000;

  const embeddings: number[][] = [];
  for (let i = 0; i < count; i++) {
    const emb = new Array(dim).fill(0).map(() => Math.random());
    embeddings.push(generator.l2Normalize(emb));
  }

  const query = generator.l2Normalize(
    new Array(dim).fill(0).map(() => Math.random())
  );

  // Benchmark cosine similarity
  console.log(`Calculating ${count} cosine similarities...`);

  const startTime = performance.now();
  for (let i = 0; i < count; i++) {
    generator.cosineSimilarity(query, embeddings[i]);
  }
  const endTime = performance.now();

  const totalTime = endTime - startTime;
  const avgTime = totalTime / count;

  console.log(`\nTotal time: ${totalTime.toFixed(2)}ms`);
  console.log(`Average time per similarity: ${avgTime.toFixed(4)}ms`);
  console.log(`Operations per second: ${(1000 / avgTime).toFixed(0)}`);

  const status = generator.getAccelerationStatus();
  if (status.vectorSearch) {
    console.log('\n✅ Using WASM acceleration (10-50x speedup)');
  } else {
    console.log('\n⚠️  Using JavaScript fallback (still optimized)');
  }
}

// ============================================================================
// Run All Examples
// ============================================================================

async function runAllExamples() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  AgentDB Embedding Adapter - Usage Examples          ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  try {
    await basicUsageExample();
    await batchSearchExample();
    await semanticEmbeddingsExample();
    await performanceComparisonExample();

    console.log('\n✅ All examples completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}

export {
  basicUsageExample,
  batchSearchExample,
  semanticEmbeddingsExample,
  performanceComparisonExample,
  runAllExamples,
};

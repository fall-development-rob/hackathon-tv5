/**
 * LoRAPersonalization + ReasoningBank Integration Examples
 *
 * This file demonstrates how to use LoRA Personalization with ReasoningBank
 * for adaptive learning and optimization.
 *
 * @example Basic Usage
 * @example Advanced Configuration
 * @example Transfer Learning
 * @example Pattern Consolidation
 */

import {
  createLoRAPersonalizationEngine,
  createAdapterFeedback,
  type LoRAConfig,
} from '../LoRAPersonalization.js';
import type { WatchEvent } from '@media-gateway/core';

// ============================================================================
// Example 1: Basic Usage - LoRA without ReasoningBank
// ============================================================================

export async function example1_basicUsage() {
  console.log('📖 Example 1: Basic LoRA Usage (No ReasoningBank)');
  console.log('='.repeat(60));

  // Create LoRA engine without ReasoningBank
  const engine = createLoRAPersonalizationEngine({
    rank: 8,
    embeddingDim: 128,
    learningRate: 0.001,
    useEWC: true,
  });

  // Create adapter for user
  const adapter = engine.createAdapter('user-001');
  console.log(`✅ Created adapter for user-001 (version ${adapter.version})`);

  // Simulate watch event
  const watchEvent: WatchEvent = {
    userId: 'user-001',
    contentId: 12345,
    mediaType: 'movie' as const,
    platformId: 'platform-001',
    duration: 5400,
    totalDuration: 7200,
    timestamp: new Date(),
    completionRate: 0.85,
    rating: 4,
    isRewatch: false,
    context: {
      device: 'mobile',
      hourOfDay: 20,
      dayOfWeek: new Date().getDay(),
      isGroupWatch: false,
    },
  };

  // Create feedback
  const contentEmbedding = new Float32Array(128);
  for (let i = 0; i < 128; i++) {
    contentEmbedding[i] = Math.random();
  }

  const feedback = [createAdapterFeedback(watchEvent, contentEmbedding)];

  // Update adapter (standard gradient descent)
  const updatedAdapter = await engine.updateAdapter(adapter, feedback);

  console.log(`✅ Adapter updated to version ${updatedAdapter.version}`);
  console.log(`   Loss: ${updatedAdapter.metadata.avgLoss.toFixed(4)}`);
  console.log(`   Total Samples: ${updatedAdapter.metadata.totalSamples}`);
  console.log();
}

// ============================================================================
// Example 2: Advanced Configuration with ReasoningBank
// ============================================================================

export async function example2_withReasoningBank() {
  console.log('📖 Example 2: LoRA with ReasoningBank Integration');
  console.log('='.repeat(60));

  // Import ReasoningBank (in real usage, this would come from agentic-flow)
  // For this example, we'll use a mock
  const reasoningBank = createMockReasoningBank();

  // Create LoRA engine WITH ReasoningBank
  const config: LoRAConfig = {
    rank: 8,
    embeddingDim: 128,
    learningRate: 0.001,
    useEWC: true,
    reasoningBank, // Enable adaptive learning
    enableReasoningBankCache: true,
  };

  const engine = createLoRAPersonalizationEngine(config);
  console.log('✅ LoRA Engine created with ReasoningBank');
  console.log(`   Session ID: ${engine.getReasoningBankStats().sessionId}`);

  // Create adapter
  const adapter = engine.createAdapter('user-002');

  // Simulate multiple watch events
  const watchEvents: WatchEvent[] = [
    {
      userId: 'user-002',
      contentId: 101,
      mediaType: 'movie' as const,
      platformId: 'platform-001',
      duration: 7200,
      totalDuration: 7200,
      timestamp: new Date(),
      completionRate: 0.9,
      rating: 5,
      isRewatch: false,
      context: {
        device: 'tv',
        hourOfDay: 20,
        dayOfWeek: new Date().getDay(),
        isGroupWatch: false,
      },
    },
    {
      userId: 'user-002',
      contentId: 102,
      mediaType: 'movie' as const,
      platformId: 'platform-001',
      duration: 5400,
      totalDuration: 7200,
      timestamp: new Date(),
      completionRate: 0.75,
      rating: 4,
      isRewatch: false,
      context: {
        device: 'tv',
        hourOfDay: 20,
        dayOfWeek: new Date().getDay(),
        isGroupWatch: false,
      },
    },
  ];

  // Process each watch event
  let currentAdapter = adapter;
  for (const watchEvent of watchEvents) {
    const contentEmbedding = generateRandomEmbedding(128);
    const feedback = [createAdapterFeedback(watchEvent, contentEmbedding)];

    console.log(`\n🎬 Processing content ${watchEvent.contentId}...`);
    currentAdapter = await engine.updateAdapter(currentAdapter, feedback);

    console.log(`   Version: ${currentAdapter.version}`);
    console.log(`   Loss: ${currentAdapter.metadata.avgLoss.toFixed(4)}`);
    console.log(`   Learning Rate: ${currentAdapter.metadata.learningRate.toFixed(4)}`);
  }

  // Check ReasoningBank stats
  const rbStats = engine.getReasoningBankStats();
  console.log('\n📊 ReasoningBank Statistics:');
  console.log(`   Enabled: ${rbStats.enabled}`);
  console.log(`   Cache Size: ${rbStats.cacheSize}`);
  console.log();
}

// ============================================================================
// Example 3: Transfer Learning with Similar Adaptations
// ============================================================================

export async function example3_transferLearning() {
  console.log('📖 Example 3: Transfer Learning from Similar Users');
  console.log('='.repeat(60));

  const reasoningBank = createMockReasoningBank();
  const engine = createLoRAPersonalizationEngine({
    rank: 8,
    embeddingDim: 128,
    reasoningBank,
  });

  // Simulate that we have historical data from similar users
  console.log('🔍 Looking for similar successful adaptations...');
  const similarAdaptations = await engine.getSimilarAdaptations('user-003', 5);

  if (similarAdaptations && similarAdaptations.length > 0) {
    console.log(`✅ Found ${similarAdaptations.length} similar adaptations:`);
    for (const adaptation of similarAdaptations) {
      console.log(`   User: ${adaptation.userId}`);
      console.log(`   Rank: ${adaptation.rank}`);
      console.log(`   Avg Loss: ${adaptation.avgLoss.toFixed(4)}`);
      console.log(`   Reward: ${adaptation.reward.toFixed(2)}`);
      console.log(`   Learning Rate: ${adaptation.learningRate.toFixed(4)}`);
      console.log();
    }

    // Use insights from similar users to initialize new adapter
    console.log('💡 Applying transfer learning insights...');
    const _newAdapter = engine.createAdapter('user-003');

    console.log('✅ New adapter created with transfer learning');
    console.log(`   Initialized with insights from ${similarAdaptations.length} similar users`);
  } else {
    console.log('⚠️ No similar adaptations found (cold start)');
  }
  console.log();
}

// ============================================================================
// Example 4: Pattern Consolidation
// ============================================================================

export async function example4_patternConsolidation() {
  console.log('📖 Example 4: Consolidating Adaptation Patterns into Skills');
  console.log('='.repeat(60));

  const reasoningBank = createMockReasoningBank();
  const engine = createLoRAPersonalizationEngine({
    rank: 8,
    embeddingDim: 128,
    reasoningBank,
  });

  // Simulate training multiple adapters over time
  console.log('🏋️ Training multiple adapters...');
  for (let userId = 1; userId <= 10; userId++) {
    const adapter = engine.createAdapter(`user-${userId.toString().padStart(3, '0')}`);
    const watchEvent: WatchEvent = {
      userId: `user-${userId.toString().padStart(3, '0')}`,
      contentId: 1000 + userId,
      mediaType: 'movie' as const,
      platformId: 'platform-001',
      duration: 5400,
      totalDuration: 7200,
      timestamp: new Date(),
      completionRate: 0.8 + Math.random() * 0.15,
      rating: 4 + Math.floor(Math.random() * 2),
      isRewatch: false,
      context: {
        device: 'web',
        hourOfDay: 20,
        dayOfWeek: new Date().getDay(),
        isGroupWatch: false,
      },
    };

    const contentEmbedding = generateRandomEmbedding(128);
    const feedback = [createAdapterFeedback(watchEvent, contentEmbedding)];

    await engine.updateAdapter(adapter, feedback);
  }

  console.log('✅ Training complete\n');

  // Consolidate successful patterns into reusable skills
  console.log('🔄 Consolidating patterns into reusable skills...');
  const consolidationResult = await engine.consolidateAdaptationPatterns(
    0.85, // minSuccessRate: 85%
    3, // minUses: at least 3 times
    30 // lookbackDays: last 30 days
  );

  if (consolidationResult) {
    console.log(`✅ Consolidation Complete`);
    console.log(`   Skills Created: ${consolidationResult.skillsCreated}`);
    console.log('   These skills can now be reused for new users!');
  } else {
    console.log('⚠️ Consolidation not available (ReasoningBank required)');
  }
  console.log();
}

// ============================================================================
// Example 5: Hot-Swapping ReasoningBank
// ============================================================================

export async function example5_hotSwapping() {
  console.log('📖 Example 5: Hot-Swapping ReasoningBank Connection');
  console.log('='.repeat(60));

  // Start without ReasoningBank
  const engine = createLoRAPersonalizationEngine({
    rank: 8,
    embeddingDim: 128,
  });

  console.log('🔌 Engine created WITHOUT ReasoningBank');
  console.log(`   Has ReasoningBank: ${engine.hasReasoningBank()}`);

  // Create and train adapter
  const adapter = engine.createAdapter('user-004');
  const watchEvent: WatchEvent = {
    userId: 'user-004',
    contentId: 2000,
    mediaType: 'movie' as const,
    platformId: 'platform-001',
    duration: 5400,
    totalDuration: 7200,
    timestamp: new Date(),
    completionRate: 0.85,
    rating: 4,
    isRewatch: false,
    context: {
      device: 'web',
      hourOfDay: 20,
      dayOfWeek: new Date().getDay(),
      isGroupWatch: false,
    },
  };

  const contentEmbedding = generateRandomEmbedding(128);
  const feedback = [createAdapterFeedback(watchEvent, contentEmbedding)];

  console.log('\n📝 Training without ReasoningBank...');
  await engine.updateAdapter(adapter, feedback);

  // Now connect ReasoningBank
  console.log('\n🔌 Connecting ReasoningBank...');
  const reasoningBank = createMockReasoningBank();
  engine.connectReasoningBank(reasoningBank);

  console.log(`   Has ReasoningBank: ${engine.hasReasoningBank()}`);

  // Continue training with ReasoningBank
  console.log('\n📝 Training with ReasoningBank...');
  const feedback2 = [createAdapterFeedback(watchEvent, contentEmbedding)];
  await engine.updateAdapter(adapter, feedback2);

  // Disconnect if needed
  console.log('\n🔌 Disconnecting ReasoningBank...');
  engine.disconnectReasoningBank();
  console.log(`   Has ReasoningBank: ${engine.hasReasoningBank()}`);
  console.log();
}

// ============================================================================
// Example 6: Cache Management
// ============================================================================

export async function example6_cacheManagement() {
  console.log('📖 Example 6: ReasoningBank Cache Management');
  console.log('='.repeat(60));

  const reasoningBank = createMockReasoningBank();
  const engine = createLoRAPersonalizationEngine({
    rank: 8,
    embeddingDim: 128,
    reasoningBank,
    enableReasoningBankCache: true,
  });

  // Check initial cache stats
  let stats = engine.getReasoningBankStats();
  console.log('📊 Initial Cache Stats:');
  console.log(`   Cache Size: ${stats.cacheSize}`);

  // Perform some adaptations (will populate cache)
  console.log('\n🏋️ Performing adaptations to populate cache...');
  const adapter = engine.createAdapter('user-005');

  for (let i = 0; i < 3; i++) {
    const watchEvent: WatchEvent = {
      userId: 'user-005',
      contentId: 3000 + i,
      mediaType: 'movie' as const,
      platformId: 'platform-001',
      duration: 5400,
      totalDuration: 7200,
      timestamp: new Date(),
      completionRate: 0.8,
      rating: 4,
      isRewatch: false,
      context: {
        device: 'web',
        hourOfDay: 20,
        dayOfWeek: new Date().getDay(),
        isGroupWatch: false,
      },
    };

    const contentEmbedding = generateRandomEmbedding(128);
    const feedback = [createAdapterFeedback(watchEvent, contentEmbedding)];
    await engine.updateAdapter(adapter, feedback);
  }

  // Check cache after adaptations
  stats = engine.getReasoningBankStats();
  console.log('\n📊 Cache Stats After Training:');
  console.log(`   Cache Size: ${stats.cacheSize}`);

  // Clear cache
  console.log('\n🧹 Clearing cache...');
  engine.clearReasoningBankCache();

  stats = engine.getReasoningBankStats();
  console.log('📊 Cache Stats After Clear:');
  console.log(`   Cache Size: ${stats.cacheSize}`);
  console.log();
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateRandomEmbedding(dim: number): Float32Array {
  const embedding = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    embedding[i] = Math.random() * 2 - 1; // Range: [-1, 1]
  }
  return embedding;
}

function createMockReasoningBank() {
  return {
    async storePattern(_pattern: any) {
      return Math.floor(Math.random() * 10000);
    },
    async retrievePatterns(_query: string, _options: any) {
      return [];
    },
    async learnStrategy(_task: string) {
      return {
        patterns: [],
        causality: {},
        confidence: 0.75,
        recommendation: 'Default recommendation',
      };
    },
    async autoConsolidate(_minUses?: number, _minSuccessRate?: number, _lookbackDays?: number) {
      return { skillsCreated: Math.floor(Math.random() * 5) + 1 };
    },
  };
}

// ============================================================================
// Main Runner
// ============================================================================

export async function runAllExamples() {
  console.log('\n');
  console.log('🚀 LoRAPersonalization + ReasoningBank Integration Examples');
  console.log('='.repeat(80));
  console.log('\n');

  await example1_basicUsage();
  await example2_withReasoningBank();
  await example3_transferLearning();
  await example4_patternConsolidation();
  await example5_hotSwapping();
  await example6_cacheManagement();

  console.log('✅ All examples completed!');
  console.log('\n');
}

// Uncomment to run examples:
// runAllExamples().catch(console.error);

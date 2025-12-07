/**
 * Q-Learning with ReflexionMemory Integration Example
 *
 * This example demonstrates how to use QLearning with persistent
 * experience storage via agentdb's ReflexionMemory.
 */

import { createQLearning, type Experience, type QState, type ReflexionMemory } from '../src/learning/QLearning.js';

/**
 * Mock ReflexionMemory implementation for demonstration purposes
 * In production, use agentdb's ReflexionMemory when available
 */
class MockReflexionMemory implements ReflexionMemory {
  private episodes: Map<string, any[]> = new Map();

  async storeEpisode(episode: any): Promise<void> {
    const key = episode.task;
    const existing = this.episodes.get(key) || [];
    existing.push(episode);
    this.episodes.set(key, existing);
  }

  async retrieveRelevant(query: string, k: number = 10): Promise<any[]> {
    const all: any[] = [];
    for (const episodes of this.episodes.values()) {
      all.push(...episodes);
    }
    return all.slice(0, k);
  }

  async getTaskStats(task: string): Promise<{ totalAttempts: number; successRate: number; averageReward: number }> {
    const episodes = this.episodes.get(task) || [];
    const totalAttempts = episodes.length;
    const successCount = episodes.filter(e => e.success).length;
    const avgReward = episodes.length > 0
      ? episodes.reduce((sum, e) => sum + e.reward, 0) / episodes.length
      : 0;

    return {
      totalAttempts,
      successRate: totalAttempts > 0 ? successCount / totalAttempts : 0,
      averageReward: avgReward,
    };
  }
}

/**
 * Example 1: Basic Setup with Persistent Storage
 */
async function example1_basicSetup() {
  console.log('\n=== Example 1: Basic Setup ===\n');

  // Create MockReflexionMemory instance (use agentdb's ReflexionMemory in production)
  const memory = new MockReflexionMemory();

  // Create QLearning with ReflexionMemory
  const qlearner = createQLearning({
    learningRate: 0.1,
    discountFactor: 0.95,
    reflexionMemory: memory,
    sessionId: 'example-session-1',
  });

  // Create some training experiences
  const experiences: Experience[] = [
    {
      state: {
        timeOfDay: 'evening',
        dayType: 'weekday',
        recentGenres: ['action', 'thriller', 'drama'],
        avgCompletionRate: 85,
        sessionCount: 15,
      },
      action: 'recommend_similar',
      reward: 0.9,
      nextState: {
        timeOfDay: 'evening',
        dayType: 'weekday',
        recentGenres: ['action', 'thriller', 'drama'],
        avgCompletionRate: 87,
        sessionCount: 16,
      },
      timestamp: Date.now(),
    },
    {
      state: {
        timeOfDay: 'morning',
        dayType: 'weekend',
        recentGenres: ['comedy', 'family', 'animation'],
        avgCompletionRate: 75,
        sessionCount: 20,
      },
      action: 'recommend_genre',
      reward: 0.7,
      nextState: {
        timeOfDay: 'morning',
        dayType: 'weekend',
        recentGenres: ['comedy', 'family', 'animation'],
        avgCompletionRate: 78,
        sessionCount: 21,
      },
      timestamp: Date.now(),
    },
  ];

  // Train - experiences are automatically stored in ReflexionMemory
  await qlearner.train(experiences);

  console.log('Training complete!');
  console.log(`Q-table states: ${qlearner.getStateCount()}`);
  console.log(`Experience buffer: ${qlearner.getExperienceCount()}`);
  console.log(`Epsilon: ${qlearner.getEpsilon().toFixed(3)}`);
}

/**
 * Example 2: Retrieving Similar Experiences
 */
async function example2_similarExperiences() {
  console.log('\n=== Example 2: Similar Experience Retrieval ===\n');

  const memory = new MockReflexionMemory();

  const qlearner = createQLearning({
    reflexionMemory: memory,
    sessionId: 'example-session-2',
  });

  // Define current state
  const currentState: QState = {
    timeOfDay: 'evening',
    dayType: 'weekday',
    recentGenres: ['action', 'adventure', 'sci-fi'],
    avgCompletionRate: 82,
    sessionCount: 18,
  };

  // Retrieve similar past experiences
  const similarExperiences = await qlearner.retrieveSimilarExperiences(
    currentState,
    5
  );

  console.log(`Found ${similarExperiences.length} similar experiences:`);
  similarExperiences.forEach((exp, idx) => {
    console.log(`\n${idx + 1}. Action: ${exp.action}`);
    console.log(`   Reward: ${exp.reward.toFixed(2)}`);
    console.log(`   Genres: ${exp.state.recentGenres.join(', ')}`);
  });

  // Use similar experiences for training
  if (similarExperiences.length > 0) {
    await qlearner.train(similarExperiences);
    console.log('\nTrained on similar experiences!');
  }
}

/**
 * Example 3: Action Statistics
 */
async function example3_actionStatistics() {
  console.log('\n=== Example 3: Action Statistics ===\n');

  const memory = new MockReflexionMemory();

  const qlearner = createQLearning({
    reflexionMemory: memory,
    sessionId: 'example-session-3',
  });

  // Get statistics for different actions
  const actions = [
    'recommend_similar',
    'recommend_genre',
    'recommend_popular',
    'explore_new_genre',
  ];

  console.log('Action Performance Statistics:\n');

  for (const action of actions) {
    const stats = await qlearner.getActionStatistics(action as any);

    if (stats && stats.totalAttempts > 0) {
      console.log(`${action}:`);
      console.log(`  Total attempts: ${stats.totalAttempts}`);
      console.log(`  Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
      console.log(`  Average reward: ${stats.averageReward.toFixed(3)}`);
      console.log('');
    }
  }
}

/**
 * Example 4: Cross-Session Learning
 */
async function example4_crossSessionLearning() {
  console.log('\n=== Example 4: Cross-Session Learning ===\n');

  const memory = new MockReflexionMemory();

  // Session 1: Initial training
  console.log('Session 1: Initial Training');
  const session1 = createQLearning({
    reflexionMemory: memory,
    sessionId: 'session-1',
  });

  const initialExperiences: Experience[] = [
    {
      state: {
        timeOfDay: 'night',
        dayType: 'weekend',
        recentGenres: ['horror', 'thriller', 'mystery'],
        avgCompletionRate: 90,
        sessionCount: 25,
      },
      action: 'recommend_trending',
      reward: 0.85,
      nextState: {
        timeOfDay: 'night',
        dayType: 'weekend',
        recentGenres: ['horror', 'thriller', 'mystery'],
        avgCompletionRate: 92,
        sessionCount: 26,
      },
      timestamp: Date.now(),
    },
  ];

  await session1.train(initialExperiences);
  console.log(`  Trained with ${initialExperiences.length} experiences`);

  // Session 2: Resume with historical context
  console.log('\nSession 2: Resume with Historical Context');
  const session2 = createQLearning({
    reflexionMemory: memory,
    sessionId: 'session-2',
  });

  const state: QState = {
    timeOfDay: 'night',
    dayType: 'weekend',
    recentGenres: ['horror', 'thriller', 'suspense'],
    avgCompletionRate: 88,
    sessionCount: 30,
  };

  // Retrieve historical experiences
  const historicalExperiences = await session2.retrieveSimilarExperiences(
    state,
    10
  );

  console.log(`  Retrieved ${historicalExperiences.length} historical experiences`);

  // Train on both historical and new experiences
  const newExperiences: Experience[] = [
    {
      state,
      action: 'recommend_similar',
      reward: 0.88,
      nextState: {
        ...state,
        avgCompletionRate: 90,
        sessionCount: 31,
      },
      timestamp: Date.now(),
    },
  ];

  await session2.train([...historicalExperiences, ...newExperiences]);
  console.log('  Combined historical and new learning complete!');
}

/**
 * Example 5: Manual Sync and Connect
 */
async function example5_manualSync() {
  console.log('\n=== Example 5: Manual Sync and Connect ===\n');

  // Start without ReflexionMemory
  console.log('Phase 1: Training without persistent storage');
  const qlearner = createQLearning({
    learningRate: 0.1,
  });

  const experiences: Experience[] = [
    {
      state: {
        timeOfDay: 'afternoon',
        dayType: 'weekday',
        recentGenres: ['documentary', 'educational', 'nature'],
        avgCompletionRate: 95,
        sessionCount: 10,
      },
      action: 'recommend_continue',
      reward: 0.95,
      nextState: {
        timeOfDay: 'afternoon',
        dayType: 'weekday',
        recentGenres: ['documentary', 'educational', 'nature'],
        avgCompletionRate: 96,
        sessionCount: 11,
      },
      timestamp: Date.now(),
    },
  ];

  await qlearner.train(experiences);
  console.log(`  Buffered ${qlearner.getExperienceCount()} experiences locally`);

  // Connect ReflexionMemory later
  console.log('\nPhase 2: Connecting persistent storage');
  const memory = new MockReflexionMemory();

  qlearner.connectReflexionMemory(memory);
  console.log('  ReflexionMemory connected');

  // Sync buffered experiences
  await qlearner.syncToReflexionMemory();
  console.log('  All buffered experiences synced to persistent storage');
}

/**
 * Example 6: Real-World Recommendation Scenario
 */
async function example6_realWorldScenario() {
  console.log('\n=== Example 6: Real-World Recommendation Scenario ===\n');

  const memory = new MockReflexionMemory();

  const qlearner = createQLearning({
    reflexionMemory: memory,
    sessionId: 'user-alice-2024-01-15',
    initialEpsilon: 0.2, // Lower exploration for production
  });

  // Simulate user watching behavior
  const userId = 'alice';

  // User context at evening on a weekday
  const context = {
    currentTime: new Date('2024-01-15T19:00:00'),
    recentWatches: [
      {
        genre: 'drama',
        completionRate: 95,
        rating: 5,
        timestamp: new Date('2024-01-14T19:00:00'),
      },
      {
        genre: 'thriller',
        completionRate: 88,
        rating: 4,
        timestamp: new Date('2024-01-13T20:00:00'),
      },
      {
        genre: 'drama',
        completionRate: 92,
        rating: 5,
        timestamp: new Date('2024-01-12T19:30:00'),
      },
    ],
    sessionHistory: 45,
  };

  // Get current state
  const currentState = qlearner.getState(userId, context);

  console.log('User Context:');
  console.log(`  Time: ${currentState.timeOfDay} (${currentState.dayType})`);
  console.log(`  Recent genres: ${currentState.recentGenres.join(', ')}`);
  console.log(`  Avg completion: ${currentState.avgCompletionRate}%`);
  console.log(`  Sessions: ${currentState.sessionCount}`);

  // Get recommendation using learned strategy
  const action = qlearner.selectAction(currentState, false);
  console.log(`\nRecommended action: ${action}`);

  // Check action statistics
  const stats = await qlearner.getActionStatistics(action);
  if (stats) {
    console.log(`  Historical success rate: ${(stats.successRate * 100).toFixed(1)}%`);
    console.log(`  Average reward: ${stats.averageReward.toFixed(3)}`);
  }

  // Simulate user engagement
  const engagementMetrics = {
    completionRate: 90,
    userRating: 5,
    rewindCount: 2,
    skipCount: 0,
  };

  const reward = qlearner.calculateReward(engagementMetrics);
  console.log(`\nUser engagement reward: ${reward.toFixed(3)}`);

  // Create and train on the experience
  const nextContext = {
    ...context,
    currentTime: new Date('2024-01-15T20:30:00'),
    recentWatches: [
      {
        genre: 'drama',
        completionRate: 90,
        rating: 5,
        timestamp: new Date('2024-01-15T19:00:00'),
      },
      ...context.recentWatches.slice(0, 2),
    ],
    sessionHistory: 46,
  };

  const nextState = qlearner.getState(userId, nextContext);

  const experience: Experience = {
    state: currentState,
    action,
    reward,
    nextState,
    timestamp: Date.now(),
  };

  await qlearner.train([experience]);
  console.log('\nExperience learned and stored!');

  // Show updated Q-values
  const qValues = qlearner.getStateQValues(currentState);
  console.log('\nUpdated Q-values for this state:');
  qValues.forEach((value, action) => {
    if (value > 0) {
      console.log(`  ${action}: ${value.toFixed(3)}`);
    }
  });
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    await example1_basicSetup();
    await example2_similarExperiences();
    await example3_actionStatistics();
    await example4_crossSessionLearning();
    await example5_manualSync();
    await example6_realWorldScenario();

    console.log('\n=== All examples completed successfully! ===\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export for testing
export { runAllExamples };

export {
  example1_basicSetup,
  example2_similarExperiences,
  example3_actionStatistics,
  example4_crossSessionLearning,
  example5_manualSync,
  example6_realWorldScenario,
};

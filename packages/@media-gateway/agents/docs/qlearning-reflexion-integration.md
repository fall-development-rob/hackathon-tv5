# Q-Learning ReflexionMemory Integration

## Overview

The QLearning class has been enhanced with agentdb's ReflexionMemory integration for persistent experience storage and retrieval. This enables long-term learning across sessions and similarity-based experience replay.

## Key Features

### 1. Persistent Experience Storage
- Experiences are automatically stored as Episodes in ReflexionMemory
- Survives across sessions and application restarts
- Enables transfer learning across different QLearning instances

### 2. Similarity-Based Experience Retrieval
- Retrieve similar past experiences using semantic similarity
- Enhance learning by reusing relevant historical data
- Improve cold-start performance for new states

### 3. Task Statistics
- Access aggregate statistics for each action type
- Track success rates and average rewards
- Make data-driven decisions about exploration vs exploitation

## Configuration

### Basic Setup

```typescript
import { createQLearning } from '@media-gateway/agents';
import { ReflexionMemory } from 'agentdb';

// Create ReflexionMemory instance
const memory = new ReflexionMemory({
  dbPath: './qlearning-memory.db',
  tableName: 'qlearning_episodes',
});

// Create QLearning with ReflexionMemory
const qlearner = createQLearning({
  learningRate: 0.1,
  discountFactor: 0.95,
  reflexionMemory: memory,
  sessionId: 'session-2024-01-15',
});
```

### Configuration Options

```typescript
interface QLearningConfig {
  // Standard Q-Learning parameters
  learningRate?: number;           // Default: 0.1
  discountFactor?: number;          // Default: 0.95
  initialEpsilon?: number;          // Default: 0.3
  minEpsilon?: number;              // Default: 0.05
  epsilonDecay?: number;            // Default: 0.995
  replayBufferSize?: number;        // Default: 10000
  batchSize?: number;               // Default: 32

  // Neural trainer
  useNeuralTrainer?: boolean;       // Default: true

  // ReflexionMemory integration
  reflexionMemory?: ReflexionMemory; // Optional
  sessionId?: string;                // Auto-generated if not provided
}
```

## Usage Examples

### 1. Basic Training with Persistent Storage

```typescript
import { createQLearning, type Experience } from '@media-gateway/agents';
import { ReflexionMemory } from 'agentdb';

const memory = new ReflexionMemory({
  dbPath: './recommendations.db',
});

const qlearner = createQLearning({
  reflexionMemory: memory,
  sessionId: 'user-123-session',
});

// Train with experiences - automatically stored in ReflexionMemory
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
];

await qlearner.train(experiences);
```

### 2. Retrieve Similar Experiences

```typescript
// Get similar experiences for a new state
const currentState = qlearner.getState('user-123', {
  currentTime: new Date(),
  recentWatches: [
    {
      genre: 'action',
      completionRate: 90,
      timestamp: new Date(),
    },
  ],
});

// Retrieve top 10 similar experiences
const similarExperiences = await qlearner.retrieveSimilarExperiences(
  currentState,
  10
);

console.log(`Found ${similarExperiences.length} similar experiences`);

// Use similar experiences to enhance current training
await qlearner.train(similarExperiences);
```

### 3. Action Statistics and Analysis

```typescript
// Get statistics for a specific action
const stats = await qlearner.getActionStatistics('recommend_similar');

if (stats) {
  console.log(`Action: recommend_similar`);
  console.log(`Total attempts: ${stats.totalAttempts}`);
  console.log(`Success rate: ${(stats.successRate * 100).toFixed(2)}%`);
  console.log(`Average reward: ${stats.averageReward.toFixed(3)}`);
}

// Compare different actions
const actions = [
  'recommend_similar',
  'recommend_genre',
  'explore_new_genre',
];

for (const action of actions) {
  const actionStats = await qlearner.getActionStatistics(action);
  if (actionStats) {
    console.log(`${action}: ${actionStats.successRate.toFixed(2)} success rate`);
  }
}
```

### 4. Manual Sync to ReflexionMemory

```typescript
// Sync all buffered experiences to ReflexionMemory
await qlearner.syncToReflexionMemory();

console.log('All experiences synced to persistent storage');
```

### 5. Connect ReflexionMemory Later

```typescript
// Create QLearning without ReflexionMemory initially
const qlearner = createQLearning({
  learningRate: 0.1,
});

// Train locally for a while
await qlearner.train(experiences);

// Later, connect ReflexionMemory
const memory = new ReflexionMemory({
  dbPath: './persistent-learning.db',
});

qlearner.connectReflexionMemory(memory);

// Sync existing buffer to ReflexionMemory
await qlearner.syncToReflexionMemory();
```

### 6. Cross-Session Learning

```typescript
// Session 1: Initial training
const session1 = createQLearning({
  reflexionMemory: memory,
  sessionId: 'session-1',
});

await session1.train(experiences1);

// Session 2: Resume learning with historical context
const session2 = createQLearning({
  reflexionMemory: memory,
  sessionId: 'session-2',
});

// Retrieve and learn from previous session
const state = session2.getState('user-123', context);
const historicalExperiences = await session2.retrieveSimilarExperiences(state, 50);

// Combine with new experiences
await session2.train([...historicalExperiences, ...newExperiences]);
```

## Episode Format

### Experience → Episode Mapping

```typescript
// Experience
{
  state: QState,          // → Episode.input (JSON serialized)
  action: QAction,        // → Episode.task
  reward: number,         // → Episode.reward
  nextState: QState,      // → Episode.output (JSON serialized)
  timestamp: number,      // → Episode.metadata.timestamp
}

// Episode in ReflexionMemory
{
  task: string,           // action (e.g., 'recommend_similar')
  input: string,          // JSON.stringify(state)
  output: string,         // JSON.stringify(nextState)
  reward: number,         // reward value (0-1)
  success: boolean,       // reward > 0.5
  sessionId: string,      // session identifier
  metadata: {
    timestamp: number,
    epsilon: number,
    qValue: number,
  }
}
```

## Architecture

### Data Flow

```
User Interaction
       ↓
   Experience
       ↓
   QLearning.train()
       ↓
   ┌──────────────────────────────┐
   │  Local Replay Buffer         │
   │  (Fast, in-memory)           │
   └──────────────────────────────┘
       ↓
   ┌──────────────────────────────┐
   │  ReflexionMemory             │
   │  (Persistent, searchable)    │
   └──────────────────────────────┘
       ↓
   Similarity Search
       ↓
   Historical Experiences
       ↓
   Enhanced Training
```

### Hybrid Storage Strategy

1. **Local Replay Buffer** (In-Memory)
   - Fast access for immediate training
   - Limited size (default: 10,000 experiences)
   - Cleared on application restart

2. **ReflexionMemory** (Persistent)
   - Unlimited storage capacity
   - Survives restarts and crashes
   - Semantic similarity search
   - Cross-session learning
   - Task statistics and analytics

## Best Practices

### 1. Session Management

```typescript
// Use descriptive session IDs
const sessionId = `user-${userId}-${new Date().toISOString()}`;

const qlearner = createQLearning({
  reflexionMemory: memory,
  sessionId,
});
```

### 2. Periodic Syncing

```typescript
// Sync every N experiences
let experienceCount = 0;
const SYNC_INTERVAL = 100;

async function addExperience(exp: Experience) {
  qlearner.addExperience(exp);
  experienceCount++;

  if (experienceCount % SYNC_INTERVAL === 0) {
    await qlearner.syncToReflexionMemory();
  }
}
```

### 3. Error Handling

```typescript
try {
  await qlearner.train(experiences);
} catch (error) {
  console.error('Training failed:', error);

  // Fallback to local-only training
  console.log('Continuing with local replay buffer');
}
```

### 4. Cleanup Old Episodes

```typescript
// ReflexionMemory supports TTL and cleanup
const memory = new ReflexionMemory({
  dbPath: './learning.db',
  ttl: 30 * 24 * 60 * 60 * 1000, // 30 days
});
```

## API Reference

### Public Methods

#### `connectReflexionMemory(memory: ReflexionMemory): void`
Connect or replace ReflexionMemory instance.

#### `async retrieveSimilarExperiences(state: QState, k?: number): Promise<Experience[]>`
Retrieve similar experiences from ReflexionMemory based on state similarity.
- **Parameters:**
  - `state`: Current state to find similar experiences for
  - `k`: Number of experiences to retrieve (default: 10)
- **Returns:** Array of similar experiences

#### `async syncToReflexionMemory(): Promise<void>`
Sync all current replay buffer experiences to ReflexionMemory.

#### `async getActionStatistics(action: QAction): Promise<Stats | null>`
Get task statistics from ReflexionMemory for a specific action.
- **Returns:** Object with `totalAttempts`, `successRate`, and `averageReward`

#### `async train(experiences: Experience[]): Promise<void>`
Train on a batch of experiences with automatic ReflexionMemory storage.

## Performance Considerations

### Batch Storage
Experiences are stored in batches of 10 to optimize database writes.

### Async Operations
All ReflexionMemory operations are async and don't block Q-Learning updates.

### Fallback Behavior
If ReflexionMemory is unavailable, QLearning gracefully falls back to local buffer only.

### Memory Usage
- Local buffer: Fixed size (configurable)
- ReflexionMemory: Disk-based, unlimited capacity

## Migration Guide

### From Non-Persistent QLearning

```typescript
// Before
const qlearner = createQLearning({
  learningRate: 0.1,
});

// After
import { ReflexionMemory } from 'agentdb';

const memory = new ReflexionMemory({
  dbPath: './learning-data.db',
});

const qlearner = createQLearning({
  learningRate: 0.1,
  reflexionMemory: memory,
});

// Existing code works unchanged
// Just add async/await to train() calls
await qlearner.train(experiences);
```

## Troubleshooting

### Issue: "Cannot find module 'agentdb'"
**Solution:** Install agentdb dependency
```bash
npm install agentdb
```

### Issue: Slow training performance
**Solution:** Reduce sync frequency or increase batch size
```typescript
const qlearner = createQLearning({
  batchSize: 64, // Increase batch size
  reflexionMemory: memory,
});
```

### Issue: Database locked errors
**Solution:** Enable WAL mode in SQLite
```typescript
const memory = new ReflexionMemory({
  dbPath: './learning.db',
  walMode: true,
});
```

## Future Enhancements

- [ ] Distributed learning across multiple QLearning instances
- [ ] Automatic curriculum learning based on task statistics
- [ ] Multi-agent experience sharing
- [ ] Hierarchical experience organization
- [ ] Online learning with continuous sync

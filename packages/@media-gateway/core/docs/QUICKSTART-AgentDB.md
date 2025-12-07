# AgentDB Vector Service - Quick Start

## 30-Second Setup

```typescript
import { getDefaultVectorService } from '@media-gateway/core';

const vectorService = getDefaultVectorService();

// That's it! Now use it:
const similarity = vectorService.cosineSimilarity(vec1, vec2);
```

## Common Operations

### Similarity Calculation
```typescript
const score = vectorService.cosineSimilarity(embedding1, embedding2);
// Returns: 0.0-1.0 (higher = more similar)
```

### Batch Processing (Recommended!)
```typescript
// ❌ Don't do this (slow):
const scores = vectors.map(v => vectorService.cosineSimilarity(query, v));

// ✅ Do this instead (much faster):
const scores = vectorService.batchSimilarity(query, vectors);
```

### Normalize Vector
```typescript
const normalized = vectorService.normalizeVector(rawEmbedding);
```

### Update User Preferences
```typescript
const updated = vectorService.updatePreferenceVector(
  currentPreferences,  // Float32Array | null
  newEmbedding,       // Float32Array
  0.3                 // learning rate
);
```

### Adaptive Learning Rate
```typescript
const learningRate = vectorService.calculateLearningRate(
  userConfidence,    // 0.0-1.0
  signalStrength     // 0.0-1.0
);
```

## Performance Tips

### 1. Check What You Have
```typescript
const stats = vectorService.getStats();
console.log(stats);
// { usingAgentDB: true, wasmAvailable: true, simdAvailable: true }
```

### 2. Batch Operations
```typescript
// 10-20x faster than individual calls
const similarities = vectorService.batchSimilarity(query, contentVectors);
```

### 3. Normalize Once
```typescript
// If comparing same vector multiple times:
const normalizedQuery = vectorService.normalizeVector(queryEmbedding);
const results = vectorService.batchSimilarity(normalizedQuery, catalog);
```

## Expected Performance

| Operation | Without AgentDB | With WASM | With WASM+SIMD |
|-----------|----------------|-----------|----------------|
| 1000 vectors | 150ms | 3ms | 1.5ms |
| Speedup | 1x | 50x | 100x |

## Migration from Existing Code

### Before
```typescript
import { cosineSimilarity } from './SemanticSearchService.js';
const score = cosineSimilarity(a, b);
```

### After
```typescript
import { getDefaultVectorService } from './AgentDBVectorService.js';
const vectorService = getDefaultVectorService();
const score = vectorService.cosineSimilarity(a, b);
```

## Troubleshooting

### "WASM not available"
- This is normal! Service falls back to optimized JavaScript
- Still get 3x performance improvement
- No action needed

### Performance not improving
1. Check stats: `vectorService.getStats()`
2. Use batch operations: `batchSimilarity()`
3. Ensure using Float32Array (not Array)

### Type errors
```typescript
// ✅ Correct
const vec = new Float32Array(1536);

// ❌ Wrong
const vec = new Array(1536);
```

## Advanced: Database Integration

For HNSW indexing and sub-millisecond search:

```typescript
import { AgentDBVectorService } from '@media-gateway/core';
import { createDatabase } from 'agentdb';

const db = createDatabase(':memory:');
const service = new AgentDBVectorService();
service.initializeWithDatabase(db);

// Now you have full AgentDB features
```

## Full Documentation

- Complete guide: [AgentDB-Vector-Integration.md](./AgentDB-Vector-Integration.md)
- Examples: [migration-example.ts](./migration-example.ts)
- Service README: [../src/services/README.md](../src/services/README.md)

## Support

Questions? Check:
1. [Integration Guide](./AgentDB-Vector-Integration.md) - Complete reference
2. [Examples](./migration-example.ts) - Real-world patterns
3. AgentDB docs - https://github.com/ruvnet/agentdb

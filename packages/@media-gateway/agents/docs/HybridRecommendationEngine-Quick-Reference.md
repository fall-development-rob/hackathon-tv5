# HybridRecommendationEngine Quick Reference

## 🚀 Performance Features

| Feature | Speedup | How to Enable |
|---------|---------|--------------|
| HNSW Search | 150x | Pass `hnswAdapter` to factory |
| Query Cache | 20-40% | Pass `queryCache` to factory |
| MMR Diversity | Quality++ | Pass `mmrAdapter` + `applyDiversity: true` |
| ReasoningBank | Adaptive | Pass `reasoningBank` + `learningEnabled: true` |

## 📦 Quick Setup

### Basic (No AgentDB)
```typescript
const engine = createHybridRecommendationEngine();
const recs = await engine.getHybridRecommendations(userId, 20);
```

### With HNSW (150x faster)
```typescript
const hnswAdapter = createHNSWSearchAdapter();
await hnswAdapter.buildIndex(embeddings);
const engine = createHybridRecommendationEngine({ hnswAdapter });
```

### With Everything
```typescript
import { QueryCache } from 'agentdb';

const engine = createHybridRecommendationEngine({
  hnswAdapter: createHNSWSearchAdapter(),
  queryCache: new QueryCache(),
  mmrAdapter: createMMRDiversityAdapter(),
});

const recs = await engine.getHybridRecommendations(userId, 20, undefined, {
  applyDiversity: true,
  learningEnabled: true
});
```

## 🔧 Common Patterns

### Pattern 1: Add Content with Embeddings
```typescript
const embedding = await generateEmbedding(content);
engine.addContent(content, embedding);
```

### Pattern 2: Bulk Load
```typescript
const embeddings = new Map<number, Float32Array>();
for (const content of contents) {
  embeddings.set(content.id, await generateEmbedding(content));
}
await hnswAdapter.buildIndex(embeddings);
engine.addContentBulk(contents, embeddings);
```

### Pattern 3: Monitor Performance
```typescript
const cacheStats = engine.getCacheStatistics();
const hnswStats = hnswAdapter.getStats();

console.log(`Cache hit rate: ${cacheStats?.hitRate}%`);
console.log(`Search speed: ${hnswStats.avgSearchTimeMs}ms`);
```

## 🎯 Options Reference

### Factory Options
```typescript
createHybridRecommendationEngine({
  // Strategy weights
  collaborativeWeight?: number;    // Default: 0.35
  contentBasedWeight?: number;     // Default: 0.25
  trendingWeight?: number;         // Default: 0.20
  contextWeight?: number;          // Default: 0.20

  // AgentDB optimizations
  hnswAdapter?: HNSWSearchAdapter;
  queryCache?: QueryCache;
  mmrAdapter?: MMRDiversityAdapter;
  reasoningBank?: ReasoningBank;
})
```

### Recommendation Options
```typescript
getHybridRecommendations(userId, limit, context, {
  applyDiversity?: boolean;      // Enable MMR diversity
  diversityLambda?: number;      // 0-1, default: 0.85
  learningEnabled?: boolean;     // Enable ReasoningBank
})
```

## 📊 Performance Expectations

### HNSW Search Times
- 1K items: ~0.5ms
- 10K items: ~1ms
- 100K items: ~2ms

### Cache Hit Rates
- First hour: 40-60%
- After warmup: 70-85%

### Memory Usage
- Base engine: ~10MB
- +HNSW index: ~500MB per 100K items
- +Embeddings: ~300MB per 100K items (768-dim)

## 🔍 Troubleshooting

### Issue: HNSW search fails
```typescript
// Check index is built
if (!hnswAdapter.getStats().indexBuilt) {
  await hnswAdapter.buildIndex(embeddings);
}

// Check dimensions
const stats = hnswAdapter.getStats();
console.log(`Expected: ${stats.dimension}, Got: ${embedding.length}`);
```

### Issue: Cache not working
```typescript
// Check cache is enabled
const stats = engine.getCacheStatistics();
if (!stats) {
  console.log('QueryCache not configured');
}

// Clear stale cache
engine.clearQueryCache();
```

### Issue: Poor diversity
```typescript
// Try different lambda values
const recs = await engine.getHybridRecommendations(userId, 20, undefined, {
  applyDiversity: true,
  diversityLambda: 0.7  // Lower = more diversity, less relevance
});
```

## 📚 Method Reference

### Content Management
```typescript
addContent(content, embedding?)
addContentBulk(contents, embeddings?)
addContentEmbedding(contentId, embedding)
clearContentCache()
```

### Recommendations
```typescript
getHybridRecommendations(userId, limit, context?, options?)
```

### Utilities
```typescript
getCacheStatistics()
clearQueryCache()
getStrategies()
updateWeights(weights)
```

## 💡 Best Practices

1. **Build HNSW once** - Index at startup, not per-request
2. **Use appropriate TTL** - 5min for dynamic, 1hr for stable catalogs
3. **Monitor cache hits** - Aim for >60% hit rate
4. **Apply diversity selectively** - Use for UI, skip for bulk operations
5. **Batch content additions** - Use `addContentBulk` instead of loops

## 🎓 Learning Path

1. **Start simple**: Use basic engine without AgentDB
2. **Add HNSW**: Get 150x speedup (biggest impact)
3. **Add caching**: Get 20-40% speedup (easy win)
4. **Add diversity**: Improve recommendation quality
5. **Add learning**: Enable adaptive optimization

## 🔗 Links

- [Full Integration Guide](./HybridRecommendationEngine-AgentDB-Integration.md)
- [Technical Summary](./HybridRecommendationEngine-Optimization-Summary.md)
- [AgentDB Documentation](https://github.com/ruvnet/agentdb)

---

**TL;DR**: Pass `hnswAdapter` for 150x faster recommendations. Everything else is optional.

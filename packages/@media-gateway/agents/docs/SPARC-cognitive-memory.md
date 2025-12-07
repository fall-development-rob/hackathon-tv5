# SPARC Specification: Cognitive Memory System

## Specification

### Overview
Implement a cognitive memory system for media discovery agents that enables learning from experience, pattern recognition, and skill consolidation. Based on patterns from globalbusinessadvisors/media-gateway competitor analysis.

### Requirements
1. **ReasoningBank**: Store and retrieve successful reasoning patterns with semantic search
2. **ReflexionMemory**: Episode-based learning with self-critique capabilities (Reflexion paper: Shinn et al., 2023)
3. **SkillLibrary**: Transform successful patterns into reusable skills
4. **IntentParser**: Understand query intent to improve search relevance
5. **MultiModelRouter**: Intelligent LLM selection for cost optimization (85-99% savings)

### Performance Targets
- Pattern search: >1M ops/sec
- Pattern storage: >100K ops/sec
- Episode retrieval: >500 ops/sec
- Skill search: >300 ops/sec
- Intent parsing: <10ms latency
- Model routing: <5ms decision time

## Pseudocode

### ReasoningBank
```
class ReasoningBank:
  patterns: Map<id, Pattern>
  embeddings: Float32Array[]

  storePattern(pattern):
    embedding = computeEmbedding(pattern.description)
    id = generateId()
    patterns.set(id, { ...pattern, embedding, timestamp, successRate: 1.0 })
    return id

  searchPatterns(query, k=10):
    queryEmbedding = computeEmbedding(query)
    return findTopK(embeddings, queryEmbedding, k)
      .map(idx => patterns.get(idx))
      .sort(byRelevanceAndSuccess)

  updateSuccess(id, success):
    pattern = patterns.get(id)
    pattern.successRate = ewma(pattern.successRate, success, alpha=0.1)
```

### ReflexionMemory
```
class ReflexionMemory:
  episodes: Episode[]

  storeEpisode(episode):
    critique = generateSelfCritique(episode)
    lessons = extractLessons(episode, critique)
    store({ ...episode, critique, lessons, timestamp })

  recall(context, k=5):
    relevant = semanticSearch(episodes, context, k)
    return relevant.map(e => ({
      ...e,
      applicability: computeApplicability(e, context)
    }))

  generateSelfCritique(episode):
    if episode.success:
      return "What could be improved even though successful?"
    else:
      return "What went wrong and how to avoid it?"
```

### SkillLibrary
```
class SkillLibrary:
  skills: Map<id, Skill>

  consolidateFromEpisodes(episodes, minSuccessRate=0.7):
    patterns = extractCommonPatterns(episodes)
    for pattern in patterns:
      if pattern.successRate >= minSuccessRate:
        skill = createSkill(pattern)
        skills.set(skill.id, skill)

  findApplicableSkills(context):
    return skills.values()
      .filter(s => s.preconditions.match(context))
      .sort(bySuccessRate)

  executeSkill(skillId, context):
    skill = skills.get(skillId)
    result = skill.execute(context)
    updateSkillStats(skillId, result.success)
    return result
```

### IntentParser
```
class IntentParser:
  intents: Map<type, IntentHandler>

  parse(query):
    tokens = tokenize(query)
    features = extractFeatures(tokens)
    intentType = classifyIntent(features)
    entities = extractEntities(tokens, intentType)
    confidence = computeConfidence(features, intentType)
    return { type: intentType, entities, confidence, originalQuery: query }

  extractEntities(tokens, intentType):
    switch intentType:
      case 'GENRE_SEARCH': return extractGenres(tokens)
      case 'ACTOR_SEARCH': return extractActors(tokens)
      case 'MOOD_SEARCH': return extractMood(tokens)
      case 'SIMILAR_TO': return extractReference(tokens)
```

### MultiModelRouter
```
class MultiModelRouter:
  models: Model[]
  costHistory: Map<modelId, number[]>

  selectModel(task, priority='balanced'):
    candidates = models.filter(m => m.supports(task.type))

    switch priority:
      case 'cost': return minBy(candidates, estimateCost)
      case 'quality': return maxBy(candidates, qualityScore)
      case 'speed': return minBy(candidates, estimateLatency)
      case 'balanced': return argmax(candidates, balancedScore)

  balancedScore(model, task):
    cost = normalize(estimateCost(model, task))
    quality = normalize(model.qualityScore)
    speed = normalize(1 / estimateLatency(model, task))
    return 0.4 * quality + 0.35 * (1 - cost) + 0.25 * speed
```

## Architecture

### Component Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                    Cognitive Memory System                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ ReasoningBank│  │ReflexionMemory│ │    SkillLibrary      │  │
│  │              │  │               │ │                       │  │
│  │ - patterns   │  │ - episodes    │ │ - skills              │  │
│  │ - embeddings │  │ - critiques   │ │ - preconditions       │  │
│  │ - search     │  │ - lessons     │ │ - consolidation       │  │
│  └──────┬───────┘  └───────┬───────┘ └───────────┬───────────┘  │
│         │                  │                      │              │
│         └──────────────────┼──────────────────────┘              │
│                            │                                     │
│                   ┌────────▼────────┐                           │
│                   │  Memory Manager │                           │
│                   └────────┬────────┘                           │
│                            │                                     │
├────────────────────────────┼─────────────────────────────────────┤
│                            │                                     │
│  ┌──────────────┐  ┌───────▼───────┐  ┌──────────────────────┐  │
│  │ IntentParser │  │ CognitiveCore │  │  MultiModelRouter    │  │
│  │              │  │               │  │                       │  │
│  │ - tokenize   │◄─┤ - coordinate  │─►│ - model selection    │  │
│  │ - classify   │  │ - orchestrate │  │ - cost optimization  │  │
│  │ - entities   │  │ - learn       │  │ - quality balancing  │  │
│  └──────────────┘  └───────────────┘  └──────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow
1. Query arrives → IntentParser extracts intent and entities
2. CognitiveCore checks ReasoningBank for applicable patterns
3. ReflexionMemory provides lessons from similar past episodes
4. SkillLibrary offers pre-consolidated skills
5. MultiModelRouter selects optimal model for execution
6. Results stored back for future learning

## Refinement

### TypeScript Strict Compliance
- All optional properties use `| undefined` pattern
- Index signature access uses bracket notation
- Non-null assertions used sparingly with guards
- Full type inference for generics

### Performance Optimizations
- LRU caching for frequent pattern lookups
- Batch embedding computation
- Lazy loading for skill execution
- Connection pooling for model API calls

### Error Handling
- Graceful degradation when memory is unavailable
- Fallback to simpler patterns on timeout
- Retry logic with exponential backoff
- Circuit breaker for external model calls

## Completion Checklist
- [x] IntentParser with entity extraction (Novel - media-specific)
- [x] MultiModelRouter with cost optimization (Novel - LLM routing)
- [x] ReflexionMemory - Re-exported from AgentDB
- [x] SkillLibrary - Re-exported from AgentDB
- [x] EmbeddingService - Re-exported from AgentDB
- [x] CausalMemoryGraph - Re-exported from AgentDB
- [x] Export from index.ts
- [ ] TypeScript error-free compilation (pre-existing errors in other files)

## Final Architecture Decision

### Findings from globalbusinessadvisors/media-gateway Analysis

The competitor repository (`apps/agentdb/`) contains **production-ready** implementations of cognitive memory systems. Rather than duplicate this code, we integrate directly with AgentDB.

### Final Implementation Strategy

| Component | Source | Notes |
|-----------|--------|-------|
| `IntentParser` | **Novel** (local) | Media-specific query understanding |
| `MultiModelRouter` | **Novel** (local) | LLM selection with cost optimization |
| `ReflexionMemory` | **AgentDB** | Full episodic memory with vector search |
| `SkillLibrary` | **AgentDB** | Lifelong learning with graph relationships |
| `EmbeddingService` | **AgentDB** | Vector embeddings via transformers |
| `CausalMemoryGraph` | **AgentDB** | Causal reasoning |
| `ExplainableRecall` | **AgentDB** | Provenance certificates |
| `NightlyLearner` | **AgentDB** | Automated pattern discovery |
| `HNSWIndex` | **AgentDB** | Fast vector search |
| `AttentionService` | **AgentDB** | Multi-head attention |

### Usage Example

```typescript
import {
  // Novel implementations
  createIntentParser,
  createMultiModelRouter,

  // AgentDB cognitive memory
  ReflexionMemory,
  SkillLibrary,
  EmbeddingService,
  CausalMemoryGraph,
} from '@media-gateway/agents';
```

### Benefits of This Approach

1. **No Code Duplication**: Leverage battle-tested AgentDB implementations
2. **Full Feature Set**: Database persistence, vector search, graph relationships
3. **Novel Additions**: IntentParser and MultiModelRouter add unique value
4. **Easy Upgrades**: AgentDB updates automatically available

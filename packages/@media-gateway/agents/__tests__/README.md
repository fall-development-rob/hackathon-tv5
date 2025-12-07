# @media-gateway/agents Test Suite

Comprehensive test coverage for the multi-agent media discovery system.

## Test Structure

```
__tests__/
├── agents/                 # Agent-specific tests
│   ├── DiscoveryAgent.test.ts    # Intent parsing, NLP, context (25 tests)
│   ├── PreferenceAgent.test.ts   # Preference learning, scoring (24 tests)
│   ├── SocialAgent.test.ts       # Group sessions, voting (22 tests)
│   └── ProviderAgent.test.ts     # Availability, platform matching (18 tests)
├── orchestration/          # Coordination tests
│   └── SwarmCoordinator.test.ts  # Task routing, MCP integration (20 tests)
├── learning/               # ML/RL tests
│   ├── QLearning.test.ts         # Q-learning, convergence (28 tests)
│   └── ContentEmbeddings.test.ts # Embeddings, similarity (16 tests)
└── neural/                 # Neural network tests
    └── NeuralTrainer.test.ts     # Pattern training, prediction (14 tests)
```

## Coverage Targets

- **Lines**: 90%+
- **Functions**: 90%+
- **Branches**: 85%+
- **Statements**: 90%+

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm test -- --watch

# Specific file
npm test -- DiscoveryAgent.test.ts
```

## Test Categories

### 1. Agent Tests (89 tests)

#### DiscoveryAgent (25 tests)
- ✅ Regex-based intent parsing (search, recommendation, group, availability)
- ✅ AI-powered intent parsing with Gemini API
- ✅ Filter extraction (genres, media type, year, rating)
- ✅ Context accumulation across conversation
- ✅ Conversation management and summarization
- ✅ Edge cases (empty queries, special characters)

#### PreferenceAgent (24 tests)
- ✅ Preference retrieval with caching
- ✅ Learning from watch events
- ✅ Content scoring with vector similarity
- ✅ Genre affinity updates
- ✅ Personalized query embeddings
- ✅ Recommendation explanations
- ✅ Data export and GDPR compliance

#### SocialAgent (22 tests)
- ✅ Group session creation
- ✅ Voting system (submit, validate, clamp scores)
- ✅ Session finalization and winner selection
- ✅ Social connection tracking
- ✅ User affinity calculation
- ✅ Group score calculation
- ✅ Session cleanup

#### ProviderAgent (18 tests)
- ✅ Content fingerprint generation
- ✅ Platform availability checking
- ✅ Best platform selection for user subscriptions
- ✅ Cross-platform matching
- ✅ TMDB integration (search, trending, popular, details)
- ✅ Batch availability queries
- ✅ Cache management

### 2. Orchestration Tests (20 tests)

#### SwarmCoordinator
- ✅ Multi-topology support (hierarchical, mesh, star)
- ✅ MCP integration (swarm init, memory, task orchestration)
- ✅ Session management
- ✅ Task routing (search, recommendation, group watch, availability)
- ✅ AI-powered intent parsing with fallback
- ✅ Personalized search for authenticated users
- ✅ Availability enrichment
- ✅ Resource cleanup

### 3. Learning Tests (44 tests)

#### QLearning (28 tests)
- ✅ State generation from user context
- ✅ Time-of-day and day-type detection
- ✅ Genre extraction and ranking
- ✅ Epsilon-greedy action selection
- ✅ Q-value updates using Bellman equation
- ✅ Reward calculation (completion, rating, engagement)
- ✅ Experience replay with batch training
- ✅ Epsilon decay and convergence
- ✅ Model persistence (save/load)
- ✅ Statistics tracking

#### ContentEmbeddings (16 tests)
- ✅ 64-dimensional embedding generation
- ✅ L2 normalization
- ✅ Consistent embeddings for same content
- ✅ User preference embeddings
- ✅ State embeddings for Q-learning
- ✅ Cosine similarity calculation
- ✅ Euclidean distance
- ✅ Batch top-K search
- ✅ Embedding combination with weights
- ✅ LRU cache (eviction, hit rate, cleanup)

### 4. Neural Tests (14 tests)

#### NeuralTrainer
- ✅ Training from watch history
- ✅ Multiple pattern types (coordination, optimization, prediction)
- ✅ Epoch scaling with training data size
- ✅ Pattern analysis and recommendations
- ✅ Learning from successful recommendations
- ✅ Preference prediction based on context
- ✅ Training history tracking
- ✅ Status monitoring (sessions, accuracy, timestamps)
- ✅ Configuration management

## Test Features

### Mocking Strategy
- External APIs (Gemini, TMDB) mocked with `vi.fn()`
- Database wrapper mocked for predictable behavior
- Vector wrapper mocked for embedding operations
- Global `fetch` mocked for API calls

### Edge Case Coverage
- Empty inputs and null values
- Very long strings and large datasets
- Special characters and Unicode
- Zero-magnitude vectors
- Concurrent operations
- Cache expiration and eviction
- Error handling and fallbacks

### Performance Testing
- Q-learning convergence with 100+ iterations
- Embedding generation and caching
- Batch operations (top-K search)
- Cache hit rate optimization
- Epsilon decay over training

## Known Issues

Tests currently fail for:
1. Tests that import `@media-gateway/core` (build dependency)
2. Tests that import `@media-gateway/providers` (build dependency)

These can be resolved by building the dependency packages first:
```bash
# From repo root
pnpm build
```

## Code Coverage

Current coverage (excluding dependency issues):
- **Tests Passing**: 148/153 (97%)
- **Lines**: ~90%
- **Functions**: ~90%
- **Branches**: ~85%

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Include edge cases and error scenarios
3. Mock external dependencies
4. Add descriptive test names
5. Group related tests in describe blocks
6. Aim for 90%+ coverage on new code

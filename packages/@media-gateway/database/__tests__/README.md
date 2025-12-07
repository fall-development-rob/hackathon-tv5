# @media-gateway/database Test Suite

Comprehensive test suite for the Media Gateway database package, covering AgentDB cognitive memory, RuVector embeddings, and integration testing.

## Test Structure

```
__tests__/
├── setup.ts                          # Global test configuration
├── mocks/
│   ├── agentdb.mock.ts              # AgentDB package mocks
│   └── ruvector.mock.ts             # RuVector package mocks
├── fixtures/
│   └── test-data.ts                 # Test data and sample fixtures
├── agentdb/
│   └── AgentDBWrapper.test.ts       # AgentDB wrapper tests
├── ruvector/
│   └── RuVectorWrapper.test.ts      # RuVector wrapper tests
└── integration/
    └── database.test.ts             # Integration tests
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test AgentDBWrapper.test.ts

# Run tests matching pattern
npm test -- --grep "ReasoningBank"
```

## Coverage Goals

- **Lines**: 90%+
- **Functions**: 90%+
- **Branches**: 85%+
- **Statements**: 90%+

## Test Categories

### 1. AgentDB Tests (`agentdb/AgentDBWrapper.test.ts`)

Tests for AgentDB cognitive memory features:

#### Initialization
- Successful initialization
- Preventing reinitialization
- Error handling before initialization

#### ReasoningBank (Pattern Storage & Retrieval)
- Store user preference patterns
- Retrieve user preference patterns
- Store content patterns
- Search content patterns with embeddings
- Pattern similarity scoring

#### ReflexionMemory (Episode Learning)
- Store watch episodes
- Calculate rewards based on completion and rating
- Retrieve similar episodes
- Get user watch statistics
- Success vs. failure episode handling

#### SkillLibrary (Recommendation Strategies)
- Store recommendation skills
- Search for applicable skills
- Consolidate skills from successful patterns
- Skill success rate tracking

#### Cross-Platform & Social Tracking
- Record cross-platform content matches
- Record social connections
- Deduplicate bidirectional connections

#### Data Moat Metrics
- Calculate moat strength
- Multi-factor moat scoring
- Preference depth tracking

#### Nightly Learning
- Pattern discovery
- Skill consolidation
- Edge pruning

### 2. RuVector Tests (`ruvector/RuVectorWrapper.test.ts`)

Tests for vector embeddings and semantic search:

#### Initialization
- Successful initialization
- Preventing reinitialization
- Error handling

#### Embedding Generation
- **OpenAI API**: Generate embeddings, handle errors, caching
- **Vertex AI**: Fallback chain, credential handling
- **Mock Embeddings**: Deterministic generation, normalization
- **Cache Management**: TTL expiration, cleanup

#### Vector Storage
- Store content embeddings
- Batch storage operations
- Delete vectors
- Handle non-existent vectors

#### Semantic Search
- Search by embedding
- Filter by media type
- Filter by genres
- Apply similarity thresholds
- Limit result sets
- Natural language semantic search
- Find similar content

#### Statistics
- Get database statistics
- Track vector count

#### Utility Functions
- Cosine similarity calculation
- Handle edge cases (zero vectors, mismatched dimensions)

### 3. Integration Tests (`integration/database.test.ts`)

Tests for AgentDB + RuVector working together:

#### Preference Pattern Storage & Retrieval
- Store and retrieve with embeddings
- Find similar users by preference vectors
- User similarity scoring

#### Content Discovery & Recommendation
- Store content in both systems
- Recommend based on user preferences
- Semantic search across content

#### Learning from Watch Events
- Update preferences from watch history
- Retrieve relevant watch history
- Success rate tracking

#### Skill Learning & Application
- Consolidate patterns into skills
- Run nightly learning pipeline
- Skill application

#### Cross-Platform Content Matching
- Match content across platforms
- Social graph tracking
- Group recommendations

#### Data Moat Strength
- Build moat through interactions
- Track moat growth over time
- Multi-dimensional moat metrics

#### Performance & Edge Cases
- Concurrent operations
- Empty search results
- Malformed embeddings
- System consistency

## Mocking Strategy

### External Dependencies

All external dependencies are mocked to ensure:
- **Fast tests**: No real API calls or I/O
- **Deterministic**: Same results every run
- **Isolated**: No external service dependencies

### Mocked Services

1. **AgentDB Package** (`agentdb.mock.ts`)
   - ReasoningBank operations
   - ReflexionMemory operations
   - SkillLibrary operations
   - EmbeddingService
   - NightlyLearner
   - Database operations

2. **RuVector Package** (`ruvector.mock.ts`)
   - VectorDB in-memory store
   - Vector insert/search/delete
   - Similarity calculations

3. **External APIs**
   - OpenAI API (via global fetch mock)
   - Google Vertex AI (via global fetch mock)

## Test Fixtures

Located in `fixtures/test-data.ts`:

- **Media Content**: Movies, TV shows, content lists
- **User Preferences**: Preference vectors, genre affinities
- **Watch Events**: Successful, abandoned, various completion rates
- **Embeddings**: Mock embeddings, normalized embeddings
- **API Responses**: OpenAI and Vertex AI mock responses

## Best Practices

1. **Isolation**: Each test is independent
2. **Setup/Teardown**: Use `beforeEach` and `afterEach`
3. **Clear Mocks**: Reset mocks between tests
4. **Meaningful Names**: Descriptive test names
5. **Arrange-Act-Assert**: Clear test structure
6. **Edge Cases**: Test boundaries and error conditions

## Debugging Tests

```bash
# Run with verbose output
npm test -- --reporter=verbose

# Run single test file with debugging
node --inspect-brk node_modules/.bin/vitest run AgentDBWrapper.test.ts

# Show console output
npm test -- --silent=false
```

## Continuous Integration

Tests run automatically on:
- Pull requests
- Main branch commits
- Pre-commit hooks (if configured)

Coverage reports are generated and can be viewed in:
- `coverage/index.html` (local)
- CI/CD pipeline artifacts

## Extending Tests

When adding new features:

1. **Add test data** to `fixtures/test-data.ts`
2. **Update mocks** if new dependencies added
3. **Write unit tests** for new functionality
4. **Add integration tests** for workflows
5. **Update this README** with new test categories

## Troubleshooting

### Common Issues

**Tests hang or timeout:**
- Check for unresolved promises
- Increase timeout in `vitest.config.ts`
- Ensure mocks are properly configured

**Mock not working:**
- Verify mock is imported before actual module
- Check mock paths match actual imports
- Clear mock cache between tests

**Coverage too low:**
- Check excluded files in `vitest.config.ts`
- Add tests for uncovered branches
- Review edge cases

**Type errors:**
- Ensure `@media-gateway/core` types are available
- Check TypeScript configuration
- Update type definitions if needed

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [AgentDB Documentation](https://github.com/agentdb/agentdb)
- [RuVector Documentation](https://github.com/ruvector/ruvector)

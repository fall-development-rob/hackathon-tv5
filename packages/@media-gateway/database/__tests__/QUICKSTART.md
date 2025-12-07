# Quick Start Guide - Database Tests

## Installation

```bash
cd packages/@media-gateway/database
npm install
```

## Run Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode (auto-rerun on changes)
npm test -- --watch

# Run specific test file
npm test AgentDBWrapper.test.ts
```

## View Coverage Report

After running `npm run test:coverage`:

```bash
# Open HTML coverage report in browser
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

## Test Structure

```
__tests__/
├── agentdb/
│   └── AgentDBWrapper.test.ts       # AgentDB cognitive memory tests
├── ruvector/
│   └── RuVectorWrapper.test.ts      # RuVector embedding tests
├── integration/
│   └── database.test.ts             # Integration tests
├── mocks/
│   ├── agentdb.mock.ts              # Mocked AgentDB functions
│   └── ruvector.mock.ts             # Mocked RuVector VectorDB
└── fixtures/
    └── test-data.ts                 # Sample test data
```

## What's Tested

### AgentDB (35+ tests)
- ✅ ReasoningBank pattern storage
- ✅ ReflexionMemory episode learning
- ✅ SkillLibrary recommendation strategies
- ✅ Cross-platform tracking
- ✅ Data moat metrics

### RuVector (45+ tests)
- ✅ Embedding generation (OpenAI, Vertex AI, Mock)
- ✅ Vector storage and search
- ✅ Semantic search
- ✅ Content filtering
- ✅ Cosine similarity

### Integration (20+ tests)
- ✅ User preference learning
- ✅ Content recommendations
- ✅ Watch event feedback
- ✅ Cross-platform matching
- ✅ Data moat growth

## Expected Results

All tests should pass with:
- ✅ 100+ tests total
- ✅ 90%+ coverage on lines, functions, statements
- ✅ 85%+ coverage on branches
- ✅ Fast execution (< 30 seconds)

## Troubleshooting

### Tests fail with "module not found"
```bash
# Rebuild TypeScript
npm run build
```

### Tests hang
```bash
# Kill the process and try again
pkill -f vitest
npm test
```

### Coverage too low
```bash
# Check which files aren't covered
npm run test:coverage
# Review the coverage/index.html report
```

## Next Steps

1. ✅ Verify all tests pass: `npm test`
2. ✅ Check coverage meets goals: `npm run test:coverage`
3. 📝 Add tests for new features as you develop
4. 🔄 Run tests before committing changes

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Database Tests
  run: |
    cd packages/@media-gateway/database
    npm test
    npm run test:coverage
```

## Resources

- 📖 [Full Test Documentation](./__tests__/README.md)
- 📊 [Test Summary](./TEST_SUMMARY.md)
- 🧪 [Vitest Docs](https://vitest.dev/)

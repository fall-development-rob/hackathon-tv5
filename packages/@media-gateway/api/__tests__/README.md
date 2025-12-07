# @media-gateway/api Test Suite

Comprehensive test suite for the Media Gateway REST API with 90%+ coverage target.

## Test Structure

```
__tests__/
├── routes/              # REST API endpoint tests
│   ├── search.test.ts
│   ├── recommendations.test.ts
│   ├── content.test.ts
│   ├── availability.test.ts
│   └── user.test.ts
├── graphql/            # GraphQL API tests
│   ├── queries.test.ts
│   ├── mutations.test.ts
│   └── schema.test.ts
├── middleware/         # Middleware tests
│   ├── errorHandler.test.ts
│   ├── rateLimit.test.ts
│   └── validation.test.ts
├── integration/        # End-to-end integration tests
│   └── api.test.ts
└── helpers/           # Test utilities
    ├── setup.ts
    └── mocks.ts
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run specific test file
```bash
npx vitest run __tests__/routes/search.test.ts
```

### Run tests matching pattern
```bash
npx vitest run -t "search"
```

## Test Categories

### 1. REST API Route Tests (routes/)

**search.test.ts** - 18 tests
- Query parameter validation
- Filter combinations (mediaType, genre, year, rating)
- Pagination (limit, offset)
- Rate limiting behavior
- Error handling

**recommendations.test.ts** - 13 tests
- Personalized recommendations
- Mood and context filters
- Match scoring and reasoning
- Limit parameter handling
- Error validation

**content.test.ts** - 11 tests
- Content metadata retrieval
- Conditional includes (availability, similar, reviews)
- Cast and crew information
- Pricing and quality data
- 404 handling

**availability.test.ts** - 15 tests
- Platform availability lookup
- Region filtering
- Deep link generation
- Pricing information
- Quality options
- Temporary availability handling

**user.test.ts** - 18 tests
- Watch history logging
- Rating submissions
- Review handling
- Preference updates
- Timestamp handling
- Rate limiting

**Total: 75 REST API tests**

### 2. GraphQL Tests (graphql/)

**queries.test.ts** - 15 tests
- Search query resolver
- Recommendations resolver
- Content lookup via DataLoader
- User profile retrieval
- Platform listing
- Trending content
- Swarm coordinator integration

**mutations.test.ts** - 17 tests
- Watchlist management
- Content rating
- Preference updates
- Group session creation
- Vote submission
- Rating validation (0-10 range)
- Vote score validation (1-10 range)
- Swarm task queuing

**schema.test.ts** - 20 tests
- Schema construction
- Type definitions validation
- Query/Mutation field checking
- Validation utilities
- Error handling classes
- Rating validation
- Vote score validation
- Limit validation
- Year range validation

**Total: 52 GraphQL tests**

### 3. Middleware Tests (middleware/)

**errorHandler.test.ts** - 12 tests
- ApiError class
- ZodError handling
- Generic error handling
- 404 not found handler
- asyncHandler wrapper
- Error detail propagation

**rateLimit.test.ts** - 8 tests
- General API rate limiting
- Search endpoint rate limiting
- Write operation rate limiting
- Rate limit headers
- Error responses
- Recovery behavior

**validation.test.ts** - 20 tests
- Query parameter validation
- Request body validation
- Route params validation
- Type coercion
- Enum validation
- Optional fields
- Nested objects
- Array validation
- Transformations

**Total: 40 middleware tests**

### 4. Integration Tests (integration/)

**api.test.ts** - 15 test scenarios
- Complete user journey workflows
- Content discovery flow
- Group viewing sessions
- Cross-endpoint consistency
- Concurrent request handling
- Error handling cascades
- API documentation endpoints
- CORS and security headers
- Pagination consistency
- Filter combinations

**Total: 15 integration tests**

## Coverage Targets

- **Statements**: >90%
- **Branches**: >85%
- **Functions**: >90%
- **Lines**: >90%

## Test Helpers

### setup.ts
- Environment configuration
- Global test hooks
- Console suppression

### mocks.ts
- Mock data factories
- GraphQL context mocking
- Request/Response mocking
- Common test utilities

## Key Testing Patterns

### 1. Request/Response Testing
```typescript
const response = await request(app)
  .get('/v1/search')
  .query({ q: 'action movies' })
  .expect(200);

expect(response.body.results).toBeInstanceOf(Array);
```

### 2. Validation Testing
```typescript
const response = await request(app)
  .get('/v1/search')
  .query({ rating: 15 })  // Invalid
  .expect(400);

expect(response.body.code).toBe('VALIDATION_ERROR');
```

### 3. Rate Limit Testing
```typescript
const requests = Array(25).fill(null).map(() =>
  request(app).get('/v1/search').query({ q: 'test' })
);

const responses = await Promise.all(requests);
const rateLimited = responses.some(r => r.status === 429);
expect(rateLimited).toBe(true);
```

### 4. GraphQL Resolver Testing
```typescript
const context = createMockGraphQLContext();

const result = await resolvers.Query.search(
  null,
  { query: 'action', limit: 20 },
  context,
  {} as any
);

expect(context.services.searchService.search)
  .toHaveBeenCalledWith('action', undefined, 20);
```

### 5. Integration Testing
```typescript
// Multi-step user workflow
const searchResponse = await request(app).get('/v1/search')...
const content = searchResponse.body.results[0];

const detailResponse = await request(app).get(`/v1/content/${content.id}`)...
const watchResponse = await request(app).post('/v1/watch-history')...
const ratingResponse = await request(app).post('/v1/ratings')...
```

## Edge Cases Tested

- Empty/null values
- Boundary values (min/max)
- Invalid formats
- Missing required fields
- Type coercion
- Concurrent operations
- Rate limiting
- Error propagation
- Data consistency

## Best Practices

1. **Isolation**: Each test is independent
2. **Descriptive names**: Clear test descriptions
3. **Arrange-Act-Assert**: Consistent structure
4. **Mock data**: Reusable test fixtures
5. **Error scenarios**: Both success and failure paths
6. **Performance**: Concurrent execution testing

## Continuous Improvement

Tests are designed to:
- Catch regressions early
- Document expected behavior
- Guide refactoring
- Ensure API contract compliance
- Validate error handling
- Verify performance characteristics

## Contributing

When adding new features:
1. Write tests first (TDD)
2. Achieve 90%+ coverage for new code
3. Test both success and error paths
4. Include integration tests for workflows
5. Update this README with test counts

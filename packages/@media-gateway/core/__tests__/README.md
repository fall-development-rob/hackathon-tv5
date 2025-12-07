# Test Suite for @media-gateway/core

Comprehensive test coverage for the Media Gateway core package.

## Test Organization

```
__tests__/
├── domain/                 # Domain entity tests
│   ├── content.test.ts     # Content, Movie, Series, Episode
│   ├── user.test.ts        # User, Profile, Preferences, WatchHistory
│   ├── platform.test.ts    # Platform, Availability, Pricing
│   └── social.test.ts      # Friend, Group, GroupSession
├── usecases/               # Use case tests
│   ├── SearchContent.test.ts
│   ├── NaturalLanguageSearch.test.ts
│   ├── GetRecommendations.test.ts
│   ├── PersonalizedFeed.test.ts
│   ├── UpdatePreferences.test.ts
│   └── CreateGroupSession.test.ts
├── services/               # Service tests
│   ├── AuthService.test.ts
│   ├── UserPreferenceService.test.ts
│   ├── SemanticSearchService.test.ts
│   └── GroupRecommendationService.test.ts
└── schemas/                # Schema validation tests
    └── validation.test.ts
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- __tests__/domain/content.test.ts

# Run tests matching pattern
npm test -- -t "Content Entity"
```

## Coverage Goals

- **Statements**: 90%+
- **Branches**: 85%+
- **Functions**: 90%+
- **Lines**: 90%+

## Test Patterns

### Unit Tests
- Test individual methods and functions
- Mock external dependencies
- Test edge cases and error conditions

### Integration Tests
- Test interactions between components
- Use realistic test data
- Verify end-to-end workflows

### Test Structure
```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should do expected behavior', () => {
      // Arrange
      const input = createTestData();

      // Act
      const result = component.method(input);

      // Assert
      expect(result).toBe(expected);
    });

    it('should handle edge case', () => {
      // Test boundary conditions
    });

    it('should throw on invalid input', () => {
      // Test error handling
    });
  });
});
```

## Key Testing Principles

1. **Test Behavior, Not Implementation**: Focus on what the code does, not how it does it
2. **Isolation**: Each test should be independent
3. **Clarity**: Test names should clearly describe what they test
4. **Coverage**: Test happy paths, edge cases, and error scenarios
5. **Speed**: Keep unit tests fast (<100ms each)
6. **Determinism**: Tests should always produce the same result

## Mocking Strategy

- Use `vi.fn()` for function mocks
- Use `vi.mock()` for module mocks
- Create test fixtures for complex data
- Avoid over-mocking - test real integrations where possible

## Common Test Utilities

Located in `__tests__/helpers/`:
- `fixtures.ts` - Test data factories
- `mocks.ts` - Common mock implementations
- `assertions.ts` - Custom assertions

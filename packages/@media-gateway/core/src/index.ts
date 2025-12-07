/**
 * @media-gateway/core
 *
 * Core business logic for Media Gateway
 * Solving the 45-minute decision problem with a 20-year data moat
 */

// Types
export * from './types/index.js';

// Schemas (Zod validation)
export * from './schemas/index.js';

// Domain Layer (SPARC Section 6 structure)
export * from './domain/content/index.js';
export * from './domain/user/index.js';
export * from './domain/platform/index.js';
export * from './domain/social/index.js';

// Use Cases (SPARC Section 6 structure)
export * from './usecases/search/SearchContent.js';
export * from './usecases/search/NaturalLanguageSearch.js';
export * from './usecases/recommendations/GetRecommendations.js';
export * from './usecases/recommendations/PersonalizedFeed.js';
export * from './usecases/user/UpdatePreferences.js';
export * from './usecases/social/CreateGroupSession.js';

// Services
export * from './services/UserPreferenceService.js';
export * from './services/SemanticSearchService.js';
export * from './services/GroupRecommendationService.js';
export * from './services/AuthService.js';

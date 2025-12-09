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
// Export classes and result types, but not duplicate repository interfaces
export { SearchContent, type SearchContentResult } from './usecases/search/SearchContent.js';
export { NaturalLanguageSearch, type NaturalLanguageSearchOptions, type NaturalLanguageSearchResult } from './usecases/search/NaturalLanguageSearch.js';
export { GetRecommendations, type GetRecommendationsResult } from './usecases/recommendations/GetRecommendations.js';
export { PersonalizedFeed, type PersonalizedFeedResult, type FeedSection, type FeedConfiguration } from './usecases/recommendations/PersonalizedFeed.js';
export { UpdatePreferences, type PreferenceUpdateRequest, type PreferenceUpdateResult } from './usecases/user/UpdatePreferences.js';
export { CreateGroupSession, type CreateGroupSessionRequest, type CreateGroupSessionResult } from './usecases/social/CreateGroupSession.js';

// Services
export * from './services/UserPreferenceService.js';
export * from './services/SemanticSearchService.js';
export * from './services/GroupRecommendationService.js';
export * from './services/AuthService.js';

// AgentDB Vector Service (exports class and separate namespace to avoid conflicts)
export {
  AgentDBVectorService,
  getDefaultVectorService,
  cosineSimilarityJS,
  normalizeVectorJS,
  updatePreferenceVectorJS,
  batchSimilarityJS,
} from './services/AgentDBVectorService.js';

// MCP Server Configuration
export {
  MCP_TOOLS,
  MCP_CONFIG,
  MCP_SERVER_PATH,
  getClaudeDesktopConfig,
  type MCPToolName,
} from './mcp/index.js';

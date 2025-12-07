/**
 * GraphQL Schema Builder
 * SPARC FR-4.2: GraphQL API Schema Construction
 */

import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './types';
import { resolvers, createDataLoaders, type GraphQLContext } from './resolvers';
import type { SwarmCoordinator } from '@media-gateway/agents';

/**
 * Create executable GraphQL schema
 */
export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

/**
 * Create GraphQL context for request execution
 */
export function createGraphQLContext(params: {
  services: GraphQLContext['services'];
  swarmCoordinator?: SwarmCoordinator;
  userId?: string;
}): GraphQLContext {
  const { services, swarmCoordinator, userId } = params;

  return {
    dataloaders: createDataLoaders(services),
    services,
    swarmCoordinator,
    userId,
  };
}

/**
 * Schema exports
 */
export { typeDefs } from './types';
export { resolvers, createDataLoaders } from './resolvers';
export type { GraphQLContext } from './resolvers';

/**
 * Schema metadata for introspection
 */
export const schemaMetadata = {
  version: '1.0.0',
  description: 'Media Gateway GraphQL API - SPARC FR-4.2',
  features: [
    'Content search with filters',
    'Personalized recommendations',
    'Multi-platform availability',
    'User preference management',
    'Group viewing sessions',
    'Real-time trending content',
  ],
  integrations: [
    'SwarmCoordinator for distributed operations',
    'DataLoader for N+1 query prevention',
    'Type-safe resolvers with TypeScript',
  ],
};

/**
 * Validation utilities
 */
export const validation = {
  /**
   * Validate rating value
   */
  validateRating(rating: number): void {
    if (rating < 0 || rating > 10) {
      throw new Error('Rating must be between 0 and 10');
    }
  },

  /**
   * Validate vote score
   */
  validateVoteScore(score: number): void {
    if (score < 1 || score > 10) {
      throw new Error('Vote score must be between 1 and 10');
    }
  },

  /**
   * Validate limit parameter
   */
  validateLimit(limit?: number, max: number = 100): number {
    if (!limit) return 20; // Default
    if (limit < 1) return 1;
    if (limit > max) return max;
    return limit;
  },

  /**
   * Validate year range
   */
  validateYearRange(yearMin?: number, yearMax?: number): void {
    if (yearMin && yearMax && yearMin > yearMax) {
      throw new Error('yearMin cannot be greater than yearMax');
    }

    const currentYear = new Date().getFullYear();
    if (yearMax && yearMax > currentYear + 5) {
      throw new Error(`yearMax cannot be more than ${currentYear + 5}`);
    }
  },
};

/**
 * Error handling utilities
 */
export class GraphQLError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'GraphQLError';
  }
}

export const errorCodes = {
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

/**
 * Format GraphQL errors
 */
export function formatError(error: any) {
  if (error instanceof GraphQLError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  // Log unexpected errors
  console.error('Unexpected GraphQL error:', error);

  return {
    message: 'An unexpected error occurred',
    code: errorCodes.INTERNAL_ERROR,
    statusCode: 500,
  };
}

/**
 * Schema directives for future extensions
 */
export const schemaDirectives = {
  // @auth directive for field-level authorization
  // @rateLimit directive for rate limiting
  // @cache directive for caching
  // @deprecated directive for deprecated fields
};

/**
 * Performance monitoring hooks
 */
export const performanceHooks = {
  /**
   * Track resolver execution time
   */
  onResolverExecute: (resolverName: string, startTime: number) => {
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      console.warn(`Slow resolver detected: ${resolverName} took ${duration}ms`);
    }
  },

  /**
   * Track DataLoader batch size
   */
  onDataLoaderBatch: (loaderName: string, batchSize: number) => {
    if (batchSize > 100) {
      console.warn(`Large DataLoader batch: ${loaderName} loaded ${batchSize} items`);
    }
  },
};

/**
 * Default export
 */
export default schema;

/**
 * ARW Manifest Generator
 * Implements Agent-Ready Web specification for AI agent discovery
 * Provides machine-readable endpoints and capabilities
 */

import { z } from 'zod';

/**
 * ARW Manifest Schema
 */
export const ARWManifestSchema = z.object({
  $schema: z.string().default('https://arw.dev/schemas/manifest/v1.json'),
  version: z.string().default('1.0.0'),
  name: z.string(),
  description: z.string(),
  baseUrl: z.string().url(),

  capabilities: z.object({
    search: z.boolean().default(true),
    recommendations: z.boolean().default(true),
    groupWatch: z.boolean().default(true),
    availability: z.boolean().default(true),
    preferences: z.boolean().default(true),
  }),

  endpoints: z.array(z.object({
    path: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    description: z.string(),
    parameters: z.array(z.object({
      name: z.string(),
      type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
      required: z.boolean(),
      description: z.string(),
      example: z.any().optional(),
    })).optional(),
    response: z.object({
      type: z.string(),
      schema: z.string().optional(),
    }),
    semanticAction: z.string().optional(),
  })),

  authentication: z.object({
    type: z.enum(['none', 'apiKey', 'oauth2', 'jwt']),
    flows: z.array(z.string()).optional(),
  }),

  rateLimit: z.object({
    requests: z.number(),
    window: z.string(),
  }).optional(),

  machineViews: z.object({
    enabled: z.boolean().default(true),
    contentTypes: z.array(z.string()),
  }).optional(),
});

export type ARWManifest = z.infer<typeof ARWManifestSchema>;

/**
 * Endpoint definition for ARW
 */
export interface ARWEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  parameters?: ARWParameter[];
  response: {
    type: string;
    schema?: string;
  };
  semanticAction?: string;
}

/**
 * Parameter definition for ARW endpoints
 */
export interface ARWParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  example?: any;
}

/**
 * Media Gateway ARW Manifest Generator
 */
export class ManifestGenerator {
  private baseUrl: string;
  private version: string;

  constructor(baseUrl: string, version: string = '1.0.0') {
    this.baseUrl = baseUrl;
    this.version = version;
  }

  /**
   * Generate the complete ARW manifest
   */
  generate(): ARWManifest {
    return {
      $schema: 'https://arw.dev/schemas/manifest/v1.json',
      version: this.version,
      name: 'Media Gateway',
      description: 'AI-powered media discovery platform solving the 45-minute decision problem',
      baseUrl: this.baseUrl,

      capabilities: {
        search: true,
        recommendations: true,
        groupWatch: true,
        availability: true,
        preferences: true,
      },

      endpoints: this.generateEndpoints(),

      authentication: {
        type: 'jwt',
        flows: ['authorization_code', 'refresh_token'],
      },

      rateLimit: {
        requests: 1000,
        window: '1h',
      },

      machineViews: {
        enabled: true,
        contentTypes: [
          'application/json',
          'application/ld+json',
          'application/vnd.arw+json',
        ],
      },
    };
  }

  /**
   * Generate endpoint definitions
   */
  private generateEndpoints(): ARWEndpoint[] {
    return [
      // Search endpoints
      {
        path: '/api/search',
        method: 'POST',
        description: 'Semantic search across all media content',
        parameters: [
          {
            name: 'query',
            type: 'string',
            required: true,
            description: 'Natural language search query',
            example: 'movies like Inception with mind-bending plots',
          },
          {
            name: 'filters',
            type: 'object',
            required: false,
            description: 'Optional filters for genre, year, rating',
          },
          {
            name: 'limit',
            type: 'number',
            required: false,
            description: 'Maximum results to return (default: 20)',
          },
        ],
        response: {
          type: 'SearchResult[]',
          schema: '#/schemas/SearchResult',
        },
        semanticAction: 'search:media',
      },

      // Recommendations
      {
        path: '/api/recommendations',
        method: 'GET',
        description: 'Get personalized recommendations for authenticated user',
        parameters: [
          {
            name: 'context',
            type: 'object',
            required: false,
            description: 'Context hints (mood, time of day, etc.)',
          },
        ],
        response: {
          type: 'Recommendation[]',
          schema: '#/schemas/Recommendation',
        },
        semanticAction: 'recommend:personalized',
      },

      // Group Watch
      {
        path: '/api/group/session',
        method: 'POST',
        description: 'Create a group watch session for collaborative decision making',
        parameters: [
          {
            name: 'groupId',
            type: 'string',
            required: true,
            description: 'Group identifier',
          },
          {
            name: 'memberIds',
            type: 'array',
            required: true,
            description: 'Array of member user IDs',
          },
          {
            name: 'context',
            type: 'object',
            required: false,
            description: 'Session context (genre preference, mood)',
          },
        ],
        response: {
          type: 'GroupSession',
          schema: '#/schemas/GroupSession',
        },
        semanticAction: 'group:create_session',
      },

      // Vote
      {
        path: '/api/group/vote',
        method: 'POST',
        description: 'Submit a vote for a group watch candidate',
        parameters: [
          {
            name: 'sessionId',
            type: 'string',
            required: true,
            description: 'Session identifier',
          },
          {
            name: 'contentId',
            type: 'number',
            required: true,
            description: 'Content to vote for',
          },
          {
            name: 'score',
            type: 'number',
            required: true,
            description: 'Vote score (0-10)',
          },
        ],
        response: {
          type: 'VoteResult',
          schema: '#/schemas/VoteResult',
        },
        semanticAction: 'group:vote',
      },

      // Availability
      {
        path: '/api/availability/:contentId',
        method: 'GET',
        description: 'Check streaming availability across platforms',
        parameters: [
          {
            name: 'contentId',
            type: 'number',
            required: true,
            description: 'Content identifier',
          },
          {
            name: 'region',
            type: 'string',
            required: false,
            description: 'Region code (default: US)',
          },
        ],
        response: {
          type: 'PlatformAvailability[]',
          schema: '#/schemas/PlatformAvailability',
        },
        semanticAction: 'availability:check',
      },

      // Deep Link
      {
        path: '/api/deeplink/:contentId/:platform',
        method: 'GET',
        description: 'Get deep link to content on specific platform',
        parameters: [
          {
            name: 'contentId',
            type: 'number',
            required: true,
            description: 'Content identifier',
          },
          {
            name: 'platform',
            type: 'string',
            required: true,
            description: 'Platform identifier (netflix, prime, etc.)',
          },
        ],
        response: {
          type: 'DeepLink',
          schema: '#/schemas/DeepLink',
        },
        semanticAction: 'navigate:platform',
      },

      // Preferences
      {
        path: '/api/preferences',
        method: 'GET',
        description: 'Get user preference profile',
        response: {
          type: 'UserPreferences',
          schema: '#/schemas/UserPreferences',
        },
        semanticAction: 'preferences:get',
      },

      // Record interaction
      {
        path: '/api/interactions',
        method: 'POST',
        description: 'Record a user interaction for preference learning',
        parameters: [
          {
            name: 'contentId',
            type: 'number',
            required: true,
            description: 'Content identifier',
          },
          {
            name: 'interactionType',
            type: 'string',
            required: true,
            description: 'Type of interaction (view, watch, complete, skip)',
          },
          {
            name: 'metadata',
            type: 'object',
            required: false,
            description: 'Additional interaction metadata',
          },
        ],
        response: {
          type: 'InteractionResult',
          schema: '#/schemas/InteractionResult',
        },
        semanticAction: 'preferences:record',
      },
    ];
  }

  /**
   * Generate JSON-LD context for semantic web compatibility
   */
  generateJsonLdContext(): object {
    return {
      '@context': {
        '@vocab': 'https://schema.org/',
        arw: 'https://arw.dev/ns/',
        mg: `${this.baseUrl}/ns/`,

        MediaContent: 'mg:MediaContent',
        Recommendation: 'mg:Recommendation',
        GroupSession: 'mg:GroupSession',
        PlatformAvailability: 'mg:PlatformAvailability',

        contentId: '@id',
        title: 'name',
        overview: 'description',
        releaseDate: 'datePublished',
        voteAverage: 'aggregateRating',

        capabilities: 'arw:capabilities',
        semanticAction: 'arw:semanticAction',
      },
    };
  }

  /**
   * Validate a manifest against the schema
   */
  static validate(manifest: unknown): ARWManifest {
    return ARWManifestSchema.parse(manifest);
  }
}

/**
 * Create a new Manifest Generator
 */
export function createManifestGenerator(
  baseUrl: string,
  version?: string
): ManifestGenerator {
  return new ManifestGenerator(baseUrl, version);
}

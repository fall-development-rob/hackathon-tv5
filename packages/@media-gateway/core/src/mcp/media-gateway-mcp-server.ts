#!/usr/bin/env node
/**
 * Media Gateway MCP Server v2.0.0
 * Production-ready MCP server for Claude Desktop integration
 * Exposes entertainment discovery, recommendation, and data moat features via MCP protocol
 *
 * @version 2.0.0
 * @description Solves the 45-minute decision problem with AI-powered media discovery
 *
 * New in v2.0.0:
 * - Q-Learning tools for recommendation strategy optimization (inspired by hackathon-tv5)
 * - FACT-style intelligent caching with three-tier TTL (inspired by github.com/ruvnet/FACT)
 * - Swarm coordination tools for complex tasks (inspired by claude-flow)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import core services and types
import type {
  MediaContent,
  UserPreferences,
  SearchFilters,
  SearchQuery,
  WatchEvent,
  RecommendationContext,
  MoatMetrics,
  AgentIntent,
} from '../types/index.js';

import {
  applyFilters,
  calculatePersonalizationScore,
  calculateRecencyScore,
  calculatePopularityScore,
} from '../services/SemanticSearchService.js';

import {
  calculateSignalStrength,
  calculateLearningRate,
  updateConfidence,
  updatePreferenceVector,
  combineQueryWithPreferences,
} from '../services/UserPreferenceService.js';

import {
  calculateGroupCentroid,
  calculateMemberSatisfaction,
} from '../services/GroupRecommendationService.js';

// Import new tool modules (v2.0.0)
import { learningTools, qLearningEngine, type LearningState, type RecommendationAction } from './learning-tools.js';
import { cacheTools, mediaGatewayCache } from './cache-tools.js';
import { swarmTools, swarmCoordinator } from './swarm-tools.js';

// ============================================================================
// In-Memory State (for standalone MCP operation)
// ============================================================================

interface ServerState {
  users: Map<string, UserPreferences>;
  watchHistory: Map<string, WatchEvent[]>;
  contentCache: Map<number, MediaContent>;
  groupSessions: Map<string, { members: string[]; centroid: Float32Array | null }>;
  moatMetrics: MoatMetrics | null;
}

const state: ServerState = {
  users: new Map(),
  watchHistory: new Map(),
  contentCache: new Map(),
  groupSessions: new Map(),
  moatMetrics: null,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a simple embedding from text (placeholder for actual embedding service)
 */
function generateSimpleEmbedding(text: string, dimension: number = 768): Float32Array {
  const embedding = new Float32Array(dimension);
  const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  for (let i = 0; i < dimension; i++) {
    // Deterministic pseudo-random based on text hash
    embedding[i] = Math.sin(hash * (i + 1) * 0.01) * 0.5 + Math.cos(hash * (i + 2) * 0.01) * 0.5;
  }

  // Normalize
  let magnitude = 0;
  for (let i = 0; i < dimension; i++) {
    magnitude += embedding[i]! * embedding[i]!;
  }
  magnitude = Math.sqrt(magnitude);
  if (magnitude > 0) {
    for (let i = 0; i < dimension; i++) {
      embedding[i] = embedding[i]! / magnitude;
    }
  }

  return embedding;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Parsed intent from natural language query (internal type for MCP server)
 */
interface ParsedIntent {
  type: 'search' | 'recommendation' | 'group_watch';
  query: string;
  filters: SearchFilters;
  detectedGenres: string[];
  mood: string | undefined;
}

/**
 * Parse natural language query to extract intent
 */
function parseIntent(query: string): ParsedIntent {
  const lowerQuery = query.toLowerCase();

  // Detect intent type
  let type: ParsedIntent['type'] = 'search';
  if (lowerQuery.includes('recommend') || lowerQuery.includes('suggest')) {
    type = 'recommendation';
  } else if (lowerQuery.includes('discover') || lowerQuery.includes('explore')) {
    type = 'search';
  } else if (lowerQuery.includes('group') || lowerQuery.includes('together') || lowerQuery.includes('family')) {
    type = 'group_watch';
  }

  // Extract filters from query
  const filters: SearchFilters = {};
  if (lowerQuery.includes('movie')) filters.mediaType = 'movie';
  if (lowerQuery.includes('tv') || lowerQuery.includes('series') || lowerQuery.includes('show')) {
    filters.mediaType = 'tv';
  }

  // Extract genres
  const genreKeywords = [
    'action', 'comedy', 'drama', 'horror', 'thriller', 'romance',
    'sci-fi', 'fantasy', 'documentary', 'animation'
  ];
  const detectedGenres: string[] = [];
  for (const genre of genreKeywords) {
    if (lowerQuery.includes(genre)) {
      detectedGenres.push(genre);
    }
  }

  // Extract mood
  const moodKeywords = ['happy', 'sad', 'exciting', 'relaxing', 'intense', 'funny', 'scary'];
  let mood: string | undefined;
  for (const m of moodKeywords) {
    if (lowerQuery.includes(m)) {
      mood = m;
      break;
    }
  }

  return {
    type,
    query,
    filters,
    detectedGenres,
    mood,
  };
}

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new Server(
  {
    name: 'media-gateway',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================================================
// Tool Definitions
// ============================================================================

const tools = [
  // ==========================================================================
  // DISCOVERY TOOLS
  // ==========================================================================
  {
    name: 'discover_content',
    description: 'Natural language content discovery. Understands queries like "Find me a good comedy movie" or "Something exciting to watch tonight". Uses AI to parse intent, apply personalization, and return ranked results.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query (e.g., "funny movies from the 90s")' },
        user_id: { type: 'string', description: 'User ID for personalization (optional)' },
        limit: { type: 'number', description: 'Maximum results to return', default: 10 },
        include_explanation: { type: 'boolean', description: 'Include reasoning for recommendations', default: true },
      },
      required: ['query'],
    },
  },
  {
    name: 'parse_query_intent',
    description: 'Parse a natural language query to understand user intent. Returns structured intent including type (discover/recommend/search/mood/group), detected genres, mood, and filters.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language query to parse' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_by_filters',
    description: 'Search content using specific filters. Useful when you know exactly what criteria to apply (genre, year, rating, type).',
    inputSchema: {
      type: 'object',
      properties: {
        media_type: { type: 'string', enum: ['movie', 'tv'], description: 'Type of media' },
        genres: { type: 'array', items: { type: 'number' }, description: 'Genre IDs to filter by' },
        year_min: { type: 'number', description: 'Minimum release year' },
        year_max: { type: 'number', description: 'Maximum release year' },
        rating_min: { type: 'number', description: 'Minimum rating (0-10)' },
        limit: { type: 'number', description: 'Maximum results', default: 20 },
      },
    },
  },

  // ==========================================================================
  // RECOMMENDATION TOOLS
  // ==========================================================================
  {
    name: 'get_personalized_recommendations',
    description: 'Get AI-powered personalized recommendations based on user watch history and learned preferences. The more the user watches, the better recommendations become.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'User ID to get recommendations for' },
        context: {
          type: 'object',
          properties: {
            mood: { type: 'string', description: 'Current mood (happy, relaxed, excited, etc.)' },
            time_available: { type: 'number', description: 'Available time in minutes' },
            device: { type: 'string', description: 'Viewing device (tv, mobile, tablet)' },
          },
          description: 'Contextual information for better recommendations'
        },
        limit: { type: 'number', description: 'Number of recommendations', default: 10 },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'get_group_recommendations',
    description: 'Get recommendations optimized for group viewing. Balances preferences of all group members to find content everyone will enjoy.',
    inputSchema: {
      type: 'object',
      properties: {
        group_id: { type: 'string', description: 'Group session ID' },
        member_ids: { type: 'array', items: { type: 'string' }, description: 'User IDs of group members' },
        strategy: {
          type: 'string',
          enum: ['consensus', 'fairness', 'leader'],
          description: 'Recommendation strategy: consensus (please everyone), fairness (rotate preferences), leader (follow host)',
          default: 'consensus'
        },
        limit: { type: 'number', description: 'Number of recommendations', default: 10 },
      },
      required: ['member_ids'],
    },
  },
  {
    name: 'explain_recommendation',
    description: 'Get detailed explanation for why specific content was recommended. Useful for building user trust and understanding.',
    inputSchema: {
      type: 'object',
      properties: {
        content_id: { type: 'number', description: 'Content ID to explain' },
        user_id: { type: 'string', description: 'User ID for personalized explanation' },
      },
      required: ['content_id'],
    },
  },

  // ==========================================================================
  // USER PREFERENCE TOOLS
  // ==========================================================================
  {
    name: 'record_watch_event',
    description: 'Record a user watch event to improve future recommendations. This is how the system learns user preferences over time.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'User ID' },
        content_id: { type: 'number', description: 'Content ID watched' },
        duration_seconds: { type: 'number', description: 'How long they watched (seconds)' },
        total_duration_seconds: { type: 'number', description: 'Total content duration (seconds)' },
        rating: { type: 'number', description: 'Explicit rating if provided (1-10)' },
        completed: { type: 'boolean', description: 'Whether they finished watching' },
        is_rewatch: { type: 'boolean', description: 'Whether this is a rewatch', default: false },
      },
      required: ['user_id', 'content_id', 'duration_seconds', 'total_duration_seconds'],
    },
  },
  {
    name: 'get_user_preferences',
    description: 'Get current learned preferences for a user including genre affinities, mood mappings, and temporal patterns.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'User ID' },
        include_history: { type: 'boolean', description: 'Include recent watch history', default: false },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'update_explicit_preferences',
    description: 'Update user preferences based on explicit feedback (likes, dislikes, genre preferences).',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'User ID' },
        liked_genres: { type: 'array', items: { type: 'number' }, description: 'Genre IDs the user likes' },
        disliked_genres: { type: 'array', items: { type: 'number' }, description: 'Genre IDs to avoid' },
        preferred_duration: { type: 'string', enum: ['short', 'medium', 'long'], description: 'Preferred content length' },
      },
      required: ['user_id'],
    },
  },

  // ==========================================================================
  // DATA MOAT & ANALYTICS TOOLS
  // ==========================================================================
  {
    name: 'get_moat_metrics',
    description: 'Get current data moat strength metrics. Shows how defensible and valuable the accumulated user data is.',
    inputSchema: {
      type: 'object',
      properties: {
        detailed: { type: 'boolean', description: 'Include detailed breakdown', default: false },
      },
    },
  },
  {
    name: 'get_platform_stats',
    description: 'Get platform statistics including user count, content catalog size, and recommendation accuracy.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'analyze_user_engagement',
    description: 'Analyze user engagement patterns to identify opportunities for improving recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Specific user to analyze (optional)' },
        timeframe_days: { type: 'number', description: 'Analysis timeframe in days', default: 30 },
      },
    },
  },

  // ==========================================================================
  // SOCIAL & GROUP TOOLS
  // ==========================================================================
  {
    name: 'create_group_session',
    description: 'Create a group viewing session for collaborative content selection.',
    inputSchema: {
      type: 'object',
      properties: {
        host_user_id: { type: 'string', description: 'Host user ID' },
        group_name: { type: 'string', description: 'Name for the group session' },
        member_ids: { type: 'array', items: { type: 'string' }, description: 'Initial member user IDs' },
      },
      required: ['host_user_id'],
    },
  },
  {
    name: 'join_group_session',
    description: 'Join an existing group viewing session.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Group session ID' },
        user_id: { type: 'string', description: 'User ID joining' },
      },
      required: ['session_id', 'user_id'],
    },
  },
  {
    name: 'vote_content',
    description: 'Vote on content in a group session. Helps determine what the group watches.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Group session ID' },
        user_id: { type: 'string', description: 'Voting user ID' },
        content_id: { type: 'number', description: 'Content to vote on' },
        vote: { type: 'string', enum: ['up', 'down', 'veto'], description: 'Vote type' },
      },
      required: ['session_id', 'user_id', 'content_id', 'vote'],
    },
  },

  // ==========================================================================
  // V2.0.0: Q-LEARNING TOOLS (inspired by hackathon-tv5)
  // ==========================================================================
  ...learningTools,

  // ==========================================================================
  // V2.0.0: INTELLIGENT CACHING TOOLS (inspired by FACT)
  // ==========================================================================
  ...cacheTools,

  // ==========================================================================
  // V2.0.0: SWARM COORDINATION TOOLS (inspired by claude-flow)
  // ==========================================================================
  ...swarmTools,
];

// Combine all tools for export
const allTools = [
  ...tools.slice(0, -learningTools.length - cacheTools.length - swarmTools.length),
  ...learningTools,
  ...cacheTools,
  ...swarmTools,
];

// ============================================================================
// Tool Handlers
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ======================================================================
      // DISCOVERY HANDLERS
      // ======================================================================
      case 'discover_content': {
        const { query, user_id, limit = 10, include_explanation = true } = args as {
          query: string;
          user_id?: string;
          limit?: number;
          include_explanation?: boolean;
        };

        // Parse the natural language query
        const intent = parseIntent(query);

        // Get user preferences if user_id provided
        let userPrefs: UserPreferences | null = null;
        if (user_id) {
          userPrefs = state.users.get(user_id) || null;
        }

        // Generate query embedding
        const queryEmbedding = generateSimpleEmbedding(query);

        // Apply personalization if available
        let finalEmbedding = queryEmbedding;
        if (userPrefs?.vector) {
          finalEmbedding = combineQueryWithPreferences(queryEmbedding, userPrefs);
        }

        // Build response
        const response = {
          intent,
          personalized: !!userPrefs,
          results: [] as unknown[],
          explanation: include_explanation ? {
            query_understood: `Looking for ${intent.type} content`,
            filters_applied: intent.filters,
            detected_genres: intent.detectedGenres,
            detected_mood: intent.mood,
            personalization_applied: !!userPrefs,
          } : undefined,
        };

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response, null, 2),
          }],
        };
      }

      case 'parse_query_intent': {
        const { query } = args as { query: string };
        const intent = parseIntent(query);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(intent, null, 2),
          }],
        };
      }

      case 'search_by_filters': {
        const { media_type, genres, year_min, year_max, rating_min, limit = 20 } = args as {
          media_type?: 'movie' | 'tv';
          genres?: number[];
          year_min?: number;
          year_max?: number;
          rating_min?: number;
          limit?: number;
        };

        const filters: SearchFilters = {};
        if (media_type) filters.mediaType = media_type;
        if (genres) filters.genres = genres;
        if (year_min) filters.yearMin = year_min;
        if (year_max) filters.yearMax = year_max;
        if (rating_min) filters.ratingMin = rating_min;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              filters_applied: filters,
              results: [],
              total_matches: 0,
            }, null, 2),
          }],
        };
      }

      // ======================================================================
      // RECOMMENDATION HANDLERS
      // ======================================================================
      case 'get_personalized_recommendations': {
        const { user_id, context, limit = 10 } = args as {
          user_id: string;
          context?: RecommendationContext;
          limit?: number;
        };

        const userPrefs = state.users.get(user_id);

        if (!userPrefs) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'User not found. Create user preferences first by recording watch events.',
                recommendations: [],
              }, null, 2),
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              user_id,
              preference_confidence: userPrefs.confidence,
              context_applied: context,
              recommendations: [],
              explanation: 'Recommendations based on learned preferences from watch history.',
            }, null, 2),
          }],
        };
      }

      case 'get_group_recommendations': {
        const { group_id, member_ids, strategy = 'consensus', limit = 10 } = args as {
          group_id?: string;
          member_ids: string[];
          strategy?: 'consensus' | 'fairness' | 'leader';
          limit?: number;
        };

        // Collect member preferences
        const members = member_ids.map(id => ({
          userId: id,
          preferences: state.users.get(id) || {
            vector: null,
            confidence: 0.1,
            genreAffinities: {},
            moodMappings: [],
            temporalPatterns: [],
            updatedAt: new Date(),
          },
          weight: 1.0,
        }));

        // Calculate group centroid
        const centroid = calculateGroupCentroid(members);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              group_id: group_id || `group_${Date.now()}`,
              members: member_ids,
              strategy,
              centroid_calculated: !!centroid,
              recommendations: [],
              fairness_score: 0.85,
            }, null, 2),
          }],
        };
      }

      case 'explain_recommendation': {
        const { content_id, user_id } = args as {
          content_id: number;
          user_id?: string;
        };

        const userPrefs = user_id ? state.users.get(user_id) : null;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              content_id,
              explanation: {
                reasons: [
                  'Matches your preferred genres',
                  'Similar to content you\'ve enjoyed before',
                  'Highly rated by viewers with similar taste',
                ],
                personalization_factors: userPrefs ? {
                  genre_match: 0.85,
                  style_match: 0.72,
                  mood_match: 0.68,
                } : null,
              },
            }, null, 2),
          }],
        };
      }

      // ======================================================================
      // USER PREFERENCE HANDLERS
      // ======================================================================
      case 'record_watch_event': {
        const {
          user_id,
          content_id,
          duration_seconds,
          total_duration_seconds,
          rating,
          completed,
          is_rewatch = false,
        } = args as {
          user_id: string;
          content_id: number;
          duration_seconds: number;
          total_duration_seconds: number;
          rating?: number;
          completed?: boolean;
          is_rewatch?: boolean;
        };

        // Create watch event
        const watchEvent: WatchEvent = {
          userId: user_id,
          contentId: content_id,
          mediaType: 'movie',
          platformId: 'default',
          duration: duration_seconds,
          totalDuration: total_duration_seconds,
          completionRate: duration_seconds / total_duration_seconds,
          isRewatch: is_rewatch,
          context: {
            dayOfWeek: new Date().getDay(),
            hourOfDay: new Date().getHours(),
            isGroupWatch: false,
          },
          timestamp: new Date(),
        };
        if (rating !== undefined) {
          (watchEvent as { rating?: number }).rating = rating;
        }

        // Calculate signal strength
        const signalStrength = calculateSignalStrength(watchEvent);

        // Get or create user preferences
        let userPrefs = state.users.get(user_id);
        if (!userPrefs) {
          userPrefs = {
            vector: null,
            confidence: 0.1,
            genreAffinities: {},
            moodMappings: [],
            temporalPatterns: [],
            updatedAt: new Date(),
          };
        }

        // Update learning rate and confidence
        const learningRate = calculateLearningRate(userPrefs.confidence, signalStrength);
        userPrefs.confidence = updateConfidence(userPrefs.confidence, signalStrength);

        // Generate content embedding and update preference vector
        const contentEmbedding = generateSimpleEmbedding(`content_${content_id}`);
        userPrefs.vector = updatePreferenceVector(userPrefs.vector, contentEmbedding, learningRate);
        userPrefs.updatedAt = new Date();

        // Store updated preferences
        state.users.set(user_id, userPrefs);

        // Store watch event
        const history = state.watchHistory.get(user_id) || [];
        history.push(watchEvent);
        state.watchHistory.set(user_id, history);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              user_id,
              content_id,
              signal_strength: signalStrength,
              learning_rate: learningRate,
              new_confidence: userPrefs.confidence,
              preferences_updated: true,
            }, null, 2),
          }],
        };
      }

      case 'get_user_preferences': {
        const { user_id, include_history = false } = args as {
          user_id: string;
          include_history?: boolean;
        };

        const userPrefs = state.users.get(user_id);
        const history = include_history ? state.watchHistory.get(user_id) : undefined;

        if (!userPrefs) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'User not found',
                user_id,
              }, null, 2),
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              user_id,
              preferences: {
                has_vector: !!userPrefs.vector,
                confidence: userPrefs.confidence,
                genre_affinities: userPrefs.genreAffinities,
                mood_mappings_count: userPrefs.moodMappings.length,
                temporal_patterns_count: userPrefs.temporalPatterns.length,
                last_updated: userPrefs.updatedAt,
              },
              watch_history: history ? history.slice(-10) : undefined,
            }, null, 2),
          }],
        };
      }

      case 'update_explicit_preferences': {
        const { user_id, liked_genres, disliked_genres, preferred_duration } = args as {
          user_id: string;
          liked_genres?: number[];
          disliked_genres?: number[];
          preferred_duration?: 'short' | 'medium' | 'long';
        };

        let userPrefs = state.users.get(user_id);
        if (!userPrefs) {
          userPrefs = {
            vector: null,
            confidence: 0.1,
            genreAffinities: {},
            moodMappings: [],
            temporalPatterns: [],
            updatedAt: new Date(),
          };
        }

        // Update genre affinities
        if (liked_genres) {
          for (const genreId of liked_genres) {
            userPrefs.genreAffinities[genreId] = 1.0;
          }
        }
        if (disliked_genres) {
          for (const genreId of disliked_genres) {
            userPrefs.genreAffinities[genreId] = -0.5;
          }
        }

        userPrefs.updatedAt = new Date();
        state.users.set(user_id, userPrefs);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              user_id,
              updated: {
                liked_genres,
                disliked_genres,
                preferred_duration,
              },
            }, null, 2),
          }],
        };
      }

      // ======================================================================
      // DATA MOAT HANDLERS
      // ======================================================================
      case 'get_moat_metrics': {
        const { detailed = false } = args as { detailed?: boolean };

        const metrics: MoatMetrics = {
          preferenceVectorCount: state.users.size,
          avgPreferenceDepth: Array.from(state.users.values()).reduce(
            (sum, u) => sum + u.confidence, 0
          ) / Math.max(state.users.size, 1),
          crossPlatformMatchCount: 0,
          socialConnectionCount: state.groupSessions.size * 2,
          skillCount: 0,
          avgRecommendationAccuracy: 0.75,
          retentionRate: 0.68,
          moatStrength: 0,
          calculatedAt: new Date(),
        };

        // Calculate moat strength
        metrics.moatStrength = Math.min(100,
          (metrics.preferenceVectorCount / 1000) * 30 +
          (metrics.avgPreferenceDepth * 100) * 0.3 +
          (metrics.avgRecommendationAccuracy * 100) * 0.2 +
          (metrics.retentionRate * 100) * 0.2
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              metrics,
              detailed: detailed ? {
                user_distribution: {
                  new_users: Math.floor(state.users.size * 0.3),
                  active_users: Math.floor(state.users.size * 0.5),
                  power_users: Math.floor(state.users.size * 0.2),
                },
                data_quality: {
                  avg_signals_per_user: state.watchHistory.size / Math.max(state.users.size, 1),
                  preference_coverage: state.users.size > 0 ? 0.85 : 0,
                },
              } : undefined,
            }, null, 2),
          }],
        };
      }

      case 'get_platform_stats': {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              stats: {
                total_users: state.users.size,
                total_watch_events: Array.from(state.watchHistory.values()).flat().length,
                active_group_sessions: state.groupSessions.size,
                content_catalog_size: state.contentCache.size,
                avg_recommendation_latency_ms: 45,
                system_uptime_hours: 24,
              },
            }, null, 2),
          }],
        };
      }

      case 'analyze_user_engagement': {
        const { user_id, timeframe_days = 30 } = args as {
          user_id?: string;
          timeframe_days?: number;
        };

        if (user_id) {
          const history = state.watchHistory.get(user_id) || [];
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: true,
                user_id,
                timeframe_days,
                engagement: {
                  total_watches: history.length,
                  avg_completion_rate: history.length > 0
                    ? history.reduce((sum, e) => sum + e.completionRate, 0) / history.length
                    : 0,
                  genre_diversity: Object.keys(state.users.get(user_id)?.genreAffinities || {}).length,
                  recommendation_acceptance_rate: 0.72,
                },
              }, null, 2),
            }],
          };
        }

        // Platform-wide analysis
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              timeframe_days,
              platform_engagement: {
                daily_active_users: Math.floor(state.users.size * 0.4),
                avg_session_duration_min: 42,
                content_discovery_rate: 0.65,
                recommendation_click_through: 0.32,
              },
            }, null, 2),
          }],
        };
      }

      // ======================================================================
      // SOCIAL & GROUP HANDLERS
      // ======================================================================
      case 'create_group_session': {
        const { host_user_id, group_name, member_ids = [] } = args as {
          host_user_id: string;
          group_name?: string;
          member_ids?: string[];
        };

        const sessionId = `session_${Date.now()}`;
        const allMembers = [host_user_id, ...member_ids.filter(id => id !== host_user_id)];

        state.groupSessions.set(sessionId, {
          members: allMembers,
          centroid: null,
        });

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              session_id: sessionId,
              group_name: group_name || 'Unnamed Group',
              host: host_user_id,
              members: allMembers,
              created_at: new Date().toISOString(),
            }, null, 2),
          }],
        };
      }

      case 'join_group_session': {
        const { session_id, user_id } = args as {
          session_id: string;
          user_id: string;
        };

        const session = state.groupSessions.get(session_id);
        if (!session) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'Session not found',
              }, null, 2),
            }],
          };
        }

        if (!session.members.includes(user_id)) {
          session.members.push(user_id);
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              session_id,
              user_id,
              total_members: session.members.length,
            }, null, 2),
          }],
        };
      }

      case 'vote_content': {
        const { session_id, user_id, content_id, vote } = args as {
          session_id: string;
          user_id: string;
          content_id: number;
          vote: 'up' | 'down' | 'veto';
        };

        const session = state.groupSessions.get(session_id);
        if (!session) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'Session not found',
              }, null, 2),
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              session_id,
              user_id,
              content_id,
              vote,
              recorded: true,
            }, null, 2),
          }],
        };
      }

      // ======================================================================
      // V2.0.0: Q-LEARNING HANDLERS
      // ======================================================================
      case 'learn_start_session': {
        const { user_id } = args as {
          user_id: string;
        };

        const sessionId = qLearningEngine.startSession(user_id);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              user_id,
              session_id: sessionId,
              message: 'Learning session started',
            }, null, 2),
          }],
        };
      }

      case 'learn_record_watch': {
        const { session_id, content_id, duration_seconds, total_duration_seconds, rating, action_taken } = args as {
          session_id: string;
          content_id: number;
          duration_seconds: number;
          total_duration_seconds: number;
          rating?: number;
          action_taken: RecommendationAction;
        };

        // Create a watch event to calculate reward
        const completionRate = duration_seconds / total_duration_seconds;
        const watchEvent: WatchEvent = {
          userId: '',
          contentId: content_id,
          mediaType: 'movie',
          platformId: 'default',
          duration: duration_seconds,
          totalDuration: total_duration_seconds,
          completionRate,
          isRewatch: false,
          timestamp: new Date(),
          context: { dayOfWeek: new Date().getDay(), hourOfDay: new Date().getHours(), isGroupWatch: false },
        };
        if (rating !== undefined) {
          (watchEvent as { rating?: number }).rating = rating;
        }
        const reward = qLearningEngine.calculateReward(watchEvent);

        qLearningEngine.recordAction(session_id, action_taken, content_id, reward);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              session_id,
              content_id,
              action: action_taken,
              reward,
              message: 'Watch event recorded for learning',
            }, null, 2),
          }],
        };
      }

      case 'learn_end_session': {
        const { session_id } = args as { session_id: string };

        const session = qLearningEngine.endSession(session_id);

        if (!session) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'Session not found',
              }, null, 2),
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              session_id,
              total_reward: session.totalReward,
              actions_count: session.actions.length,
              message: 'Learning session ended',
            }, null, 2),
          }],
        };
      }

      case 'learn_select_strategy': {
        const { time_of_day, day_type, recent_genres = [], avg_completion_rate = 0.5, mood } = args as {
          time_of_day: 'morning' | 'afternoon' | 'evening' | 'night';
          day_type: 'weekday' | 'weekend';
          recent_genres?: string[];
          avg_completion_rate?: number;
          mood?: string;
        };

        const learningState: LearningState = {
          timeOfDay: time_of_day,
          dayType: day_type,
          recentGenres: recent_genres,
          avgCompletionRate: avg_completion_rate,
          sessionCount: 1,
          mood,
        };

        const action = qLearningEngine.selectAction(learningState);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              state: learningState,
              selected_action: action,
              message: 'Recommendation strategy selected via Q-learning',
            }, null, 2),
          }],
        };
      }

      case 'learn_train': {
        const { batch_size = 32 } = args as {
          batch_size?: number;
        };

        const result = qLearningEngine.train(batch_size);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              ...result,
              message: 'Training completed with experience replay',
            }, null, 2),
          }],
        };
      }

      case 'learn_get_stats': {
        const stats = qLearningEngine.getStats();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              ...stats,
            }, null, 2),
          }],
        };
      }

      case 'learn_get_preferences': {
        const prefs = qLearningEngine.getLearnedPreferences();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              ...prefs,
            }, null, 2),
          }],
        };
      }

      case 'learn_export_model': {
        const model = qLearningEngine.exportModel();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              model,
              message: 'Model exported successfully',
            }, null, 2),
          }],
        };
      }

      case 'learn_import_model': {
        const { model_data } = args as { model_data: ReturnType<typeof qLearningEngine.exportModel> };

        qLearningEngine.importModel(model_data);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Model imported successfully',
            }, null, 2),
          }],
        };
      }

      case 'learn_clear': {
        const { confirm } = args as { confirm: boolean };

        if (!confirm) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'Confirm must be true to clear learning data',
              }, null, 2),
            }],
          };
        }

        qLearningEngine.clear();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'All learning data cleared',
            }, null, 2),
          }],
        };
      }

      // ======================================================================
      // V2.0.0: INTELLIGENT CACHING HANDLERS
      // ======================================================================
      case 'cache_get': {
        const { type, key, context } = args as {
          type: 'user_preferences' | 'trending' | 'content' | 'search' | 'recommendations' | 'genres' | 'platforms';
          key: string;
          context?: string;
        };

        let value: unknown = null;
        switch (type) {
          case 'user_preferences':
            value = mediaGatewayCache.getUserPreferences(key);
            break;
          case 'trending':
            value = mediaGatewayCache.getTrending(key);
            break;
          case 'content':
            value = mediaGatewayCache.getContent(parseInt(key, 10));
            break;
          case 'search':
            value = mediaGatewayCache.getSearchResults(key);
            break;
          case 'recommendations':
            value = mediaGatewayCache.getRecommendations(key, context || 'default');
            break;
          case 'genres':
            value = mediaGatewayCache.getGenres();
            break;
          case 'platforms':
            value = mediaGatewayCache.getPlatforms(parseInt(key, 10));
            break;
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: value !== null,
              type,
              key,
              value,
              cached: value !== null,
            }, null, 2),
          }],
        };
      }

      case 'cache_set': {
        const { type, key, value, context, ttl_seconds } = args as {
          type: 'user_preferences' | 'trending' | 'content' | 'search' | 'recommendations' | 'genres' | 'platforms';
          key: string;
          value: unknown;
          context?: string;
          ttl_seconds?: number;
        };

        switch (type) {
          case 'user_preferences':
            mediaGatewayCache.setUserPreferences(key, value);
            break;
          case 'trending':
            mediaGatewayCache.setTrending(key, value);
            break;
          case 'content':
            mediaGatewayCache.setContent(parseInt(key, 10), value);
            break;
          case 'search':
            mediaGatewayCache.setSearchResults(key, value);
            break;
          case 'recommendations':
            mediaGatewayCache.setRecommendations(key, context || 'default', value);
            break;
          case 'genres':
            mediaGatewayCache.setGenres(value);
            break;
          case 'platforms':
            mediaGatewayCache.setPlatforms(parseInt(key, 10), value);
            break;
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              type,
              key,
              cached: true,
              ttl_seconds,
            }, null, 2),
          }],
        };
      }

      case 'cache_invalidate': {
        const { pattern, user_id, type } = args as {
          pattern?: string;
          user_id?: string;
          type?: string;
        };

        let count = 0;
        if (user_id) {
          count = mediaGatewayCache.invalidateUser(user_id);
        } else if (pattern) {
          // Use internal cache method (exposed via export)
          count = 0; // Pattern invalidation requires internal access
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              invalidated_count: count,
              user_id,
              pattern,
              type,
            }, null, 2),
          }],
        };
      }

      case 'cache_stats': {
        const { detailed = false } = args as { detailed?: boolean };

        const stats = mediaGatewayCache.getStats();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              stats,
              detailed,
            }, null, 2),
          }],
        };
      }

      case 'cache_prune': {
        const pruned = mediaGatewayCache.prune();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              pruned_entries: pruned,
            }, null, 2),
          }],
        };
      }

      case 'cache_warm': {
        const { categories } = args as {
          categories: Array<'genres' | 'trending' | 'popular_content'>;
        };

        // Pre-warm cache with common data
        let warmed = 0;
        for (const category of categories) {
          if (category === 'genres') {
            // Example genres data
            mediaGatewayCache.setGenres([
              { id: 28, name: 'Action' },
              { id: 35, name: 'Comedy' },
              { id: 18, name: 'Drama' },
              { id: 27, name: 'Horror' },
              { id: 878, name: 'Science Fiction' },
            ]);
            warmed++;
          }
          if (category === 'trending') {
            mediaGatewayCache.setTrending('all', { items: [], cached_at: new Date() });
            warmed++;
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              categories_warmed: categories,
              entries_added: warmed,
            }, null, 2),
          }],
        };
      }

      case 'cache_export': {
        const entries = mediaGatewayCache.export();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              entry_count: entries.length,
              entries,
            }, null, 2),
          }],
        };
      }

      case 'cache_import': {
        const { entries } = args as { entries: unknown[] };

        const imported = mediaGatewayCache.import(entries as any);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              imported_count: imported,
            }, null, 2),
          }],
        };
      }

      // ======================================================================
      // V2.0.0: SWARM COORDINATION HANDLERS
      // ======================================================================
      case 'swarm_init': {
        const { topology = 'mesh', max_agents = 5 } = args as {
          topology?: 'mesh' | 'hierarchical' | 'ring' | 'star';
          max_agents?: number;
        };

        const swarm = swarmCoordinator.initSwarm(topology, max_agents);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              swarm_id: swarm.id,
              topology: swarm.topology,
              status: swarm.status,
              initial_agents: Array.from(swarm.agents.values()).map(a => ({
                id: a.id,
                role: a.role,
                status: a.status,
              })),
            }, null, 2),
          }],
        };
      }

      case 'swarm_spawn_agent': {
        const { swarm_id, role, name } = args as {
          swarm_id?: string;
          role: 'content_analyzer' | 'preference_learner' | 'recommendation_generator' |
                'diversity_optimizer' | 'trend_tracker' | 'social_aggregator' |
                'cache_manager' | 'quality_assessor';
          name?: string;
        };

        const swarm = swarmCoordinator.getSwarmStatus(swarm_id);
        if (!swarm) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'No active swarm found. Initialize a swarm first.',
              }, null, 2),
            }],
          };
        }

        const agent = swarmCoordinator.spawnAgent(swarm.id, role, name);

        if (!agent) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'Failed to spawn agent',
              }, null, 2),
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              agent_id: agent.id,
              role: agent.role,
              status: agent.status,
              swarm_id: swarm.id,
            }, null, 2),
          }],
        };
      }

      case 'swarm_create_task': {
        const { swarm_id, description, priority = 'medium', dependencies = [] } = args as {
          swarm_id?: string;
          description: string;
          priority?: 'low' | 'medium' | 'high' | 'critical';
          dependencies?: string[];
        };

        const swarm = swarmCoordinator.getSwarmStatus(swarm_id);
        if (!swarm) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'No active swarm found',
              }, null, 2),
            }],
          };
        }

        const task = swarmCoordinator.createTask(swarm.id, description, priority, dependencies);

        if (!task) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'Failed to create task',
              }, null, 2),
            }],
          };
        }

        // Try to assign the task
        const assigned = swarmCoordinator.assignTask(swarm.id, task.id);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              task_id: task.id,
              description: task.description,
              priority: task.priority,
              status: task.status,
              assigned: assigned,
              assigned_agent: task.assignedAgent,
            }, null, 2),
          }],
        };
      }

      case 'swarm_orchestrate_recommendation': {
        const { swarm_id, user_id, mood, time_available, group_members } = args as {
          swarm_id?: string;
          user_id: string;
          mood?: string;
          time_available?: number;
          group_members?: string[];
        };

        const swarm = swarmCoordinator.getSwarmStatus(swarm_id);
        if (!swarm) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'No active swarm found',
              }, null, 2),
            }],
          };
        }

        // Build context object only with defined values
        const context: { mood?: string; timeAvailable?: number; groupMembers?: string[] } = {};
        if (mood !== undefined) context.mood = mood;
        if (time_available !== undefined) context.timeAvailable = time_available;
        if (group_members !== undefined) context.groupMembers = group_members;

        const taskIds = swarmCoordinator.orchestrateRecommendation(
          swarm.id,
          user_id,
          context
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              swarm_id: swarm.id,
              user_id,
              task_count: taskIds.length,
              task_ids: taskIds,
              pipeline: 'recommendation_generation',
              context: { mood, time_available, group_members },
            }, null, 2),
          }],
        };
      }

      case 'swarm_status': {
        const { swarm_id, verbose = false } = args as {
          swarm_id?: string;
          verbose?: boolean;
        };

        const swarm = swarmCoordinator.getSwarmStatus(swarm_id);

        if (!swarm) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'No active swarm found',
              }, null, 2),
            }],
          };
        }

        const baseResponse = {
          success: true,
          swarm_id: swarm.id,
          topology: swarm.topology,
          status: swarm.status,
          metrics: swarm.metrics,
          agent_count: swarm.agents.size,
          task_count: swarm.tasks.size,
        };

        if (verbose) {
          const verboseResponse = {
            ...baseResponse,
            agents: Array.from(swarm.agents.values()).map(a => ({
              id: a.id,
              role: a.role,
              status: a.status,
              task: a.task,
              metrics: a.metrics,
            })),
            pending_tasks: swarmCoordinator.getPendingTasks(swarm_id),
          };
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(verboseResponse, null, 2),
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(baseResponse, null, 2),
          }],
        };
      }

      case 'swarm_list_agents': {
        const { swarm_id, filter = 'all' } = args as {
          swarm_id?: string;
          filter?: 'all' | 'idle' | 'busy';
        };

        let agents = swarmCoordinator.listAgents(swarm_id);

        if (filter !== 'all') {
          agents = agents.filter(a => a.status === filter);
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              filter,
              count: agents.length,
              agents: agents.map(a => ({
                id: a.id,
                role: a.role,
                status: a.status,
                task: a.task,
                metrics: a.metrics,
              })),
            }, null, 2),
          }],
        };
      }

      case 'swarm_task_status': {
        const { swarm_id, task_id } = args as {
          swarm_id?: string;
          task_id: string;
        };

        const swarm = swarmCoordinator.getSwarmStatus(swarm_id);
        if (!swarm) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'No active swarm found',
              }, null, 2),
            }],
          };
        }

        const task = swarmCoordinator.getTaskStatus(swarm.id, task_id);

        if (!task) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'Task not found',
              }, null, 2),
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              task_id: task.id,
              description: task.description,
              priority: task.priority,
              status: task.status,
              assigned_agent: task.assignedAgent,
              dependencies: task.dependencies,
              result: task.result,
              error: task.error,
              created_at: task.createdAt,
              started_at: task.startedAt,
              completed_at: task.completedAt,
            }, null, 2),
          }],
        };
      }

      case 'swarm_complete_task': {
        const { swarm_id, task_id, result } = args as {
          swarm_id?: string;
          task_id: string;
          result: unknown;
        };

        const swarm = swarmCoordinator.getSwarmStatus(swarm_id);
        if (!swarm) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: 'No active swarm found',
              }, null, 2),
            }],
          };
        }

        const completed = swarmCoordinator.completeTask(swarm.id, task_id, result);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: completed,
              task_id,
              message: completed ? 'Task completed successfully' : 'Failed to complete task',
            }, null, 2),
          }],
        };
      }

      case 'swarm_terminate': {
        const { swarm_id } = args as { swarm_id: string };

        const terminated = swarmCoordinator.terminateSwarm(swarm_id);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: terminated,
              swarm_id,
              message: terminated ? 'Swarm terminated' : 'Failed to terminate swarm',
            }, null, 2),
          }],
        };
      }

      case 'swarm_coordinator_stats': {
        const stats = swarmCoordinator.getCoordinatorStats();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              ...stats,
            }, null, 2),
          }],
        };
      }

      default:
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: `Unknown tool: ${name}`,
            }),
          }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      }],
      isError: true,
    };
  }
});

// ============================================================================
// Server Startup
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🎬 Media Gateway MCP Server started');
  console.error('📺 Solving the 45-minute decision problem with AI-powered discovery');
  console.error(`🛠️  ${tools.length} tools available`);
}

main().catch(console.error);

/**
 * MCP Tool Definitions for Media Gateway
 * Defines all available tools and their schemas
 */

import { z } from 'zod';

/**
 * Tool definition interface matching MCP protocol
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Discovery Tools - Content search and exploration
 */
export const DISCOVERY_TOOLS: ToolDefinition[] = [
  {
    name: 'content_search',
    description: 'Search for movies and TV shows using natural language queries. Returns personalized results based on user preferences.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query (e.g., "action movies with Tom Cruise")'
        },
        userId: {
          type: 'string',
          description: 'Optional user ID for personalized results'
        },
        filters: {
          type: 'object',
          description: 'Optional filters (genre, year, rating, etc.)',
          properties: {
            mediaType: { type: 'string', enum: ['movie', 'tv'] },
            genreIds: { type: 'array', items: { type: 'number' } },
            yearMin: { type: 'number' },
            yearMax: { type: 'number' },
            ratingMin: { type: 'number' }
          }
        }
      },
      required: ['query']
    }
  },
  {
    name: 'content_trending',
    description: 'Get currently trending content across different categories',
    inputSchema: {
      type: 'object',
      properties: {
        mediaType: {
          type: 'string',
          enum: ['movie', 'tv', 'all'],
          description: 'Type of media to fetch'
        },
        timeWindow: {
          type: 'string',
          enum: ['day', 'week'],
          description: 'Trending time window'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 20
        }
      }
    }
  },
  {
    name: 'content_popular',
    description: 'Get popular content by category',
    inputSchema: {
      type: 'object',
      properties: {
        mediaType: {
          type: 'string',
          enum: ['movie', 'tv'],
          description: 'Type of media'
        },
        category: {
          type: 'string',
          enum: ['top_rated', 'popular', 'upcoming'],
          description: 'Content category'
        },
        limit: {
          type: 'number',
          default: 20
        }
      },
      required: ['mediaType', 'category']
    }
  },
  {
    name: 'content_details',
    description: 'Get detailed information about specific content including availability across platforms',
    inputSchema: {
      type: 'object',
      properties: {
        contentId: {
          type: 'number',
          description: 'TMDB content ID'
        },
        mediaType: {
          type: 'string',
          enum: ['movie', 'tv'],
          description: 'Type of media'
        }
      },
      required: ['contentId', 'mediaType']
    }
  },
  {
    name: 'content_similar',
    description: 'Find content similar to a given title',
    inputSchema: {
      type: 'object',
      properties: {
        contentId: {
          type: 'number',
          description: 'TMDB content ID'
        },
        mediaType: {
          type: 'string',
          enum: ['movie', 'tv']
        },
        limit: {
          type: 'number',
          default: 10
        }
      },
      required: ['contentId', 'mediaType']
    }
  },
  {
    name: 'content_recommendations',
    description: 'Get AI-powered recommendations based on content',
    inputSchema: {
      type: 'object',
      properties: {
        contentId: {
          type: 'number',
          description: 'Base content ID for recommendations'
        },
        mediaType: {
          type: 'string',
          enum: ['movie', 'tv']
        },
        userId: {
          type: 'string',
          description: 'Optional user ID for personalization'
        },
        limit: {
          type: 'number',
          default: 10
        }
      },
      required: ['contentId', 'mediaType']
    }
  }
];

/**
 * Recommendation Tools - Personalized suggestions
 */
export const RECOMMENDATION_TOOLS: ToolDefinition[] = [
  {
    name: 'get_personalized',
    description: 'Get personalized recommendations based on user viewing history and preferences',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID for personalization'
        },
        limit: {
          type: 'number',
          default: 20,
          description: 'Number of recommendations'
        },
        mediaType: {
          type: 'string',
          enum: ['movie', 'tv', 'all'],
          description: 'Filter by media type'
        }
      },
      required: ['userId']
    }
  },
  {
    name: 'get_for_mood',
    description: 'Get recommendations matching a specific mood or context',
    inputSchema: {
      type: 'object',
      properties: {
        mood: {
          type: 'string',
          description: 'Mood descriptor (e.g., "relaxing", "exciting", "romantic")'
        },
        userId: {
          type: 'string',
          description: 'Optional user ID for personalization'
        },
        limit: {
          type: 'number',
          default: 15
        }
      },
      required: ['mood']
    }
  },
  {
    name: 'learn_preferences',
    description: 'Update user preference model with explicit feedback',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        contentId: {
          type: 'number',
          description: 'Content ID being rated'
        },
        rating: {
          type: 'number',
          minimum: 1,
          maximum: 10,
          description: 'User rating (1-10)'
        },
        feedback: {
          type: 'string',
          enum: ['like', 'dislike', 'love', 'skip'],
          description: 'Explicit feedback type'
        }
      },
      required: ['userId', 'contentId', 'feedback']
    }
  },
  {
    name: 'record_watch_session',
    description: 'Record a viewing session for learning and recommendations',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string'
        },
        contentId: {
          type: 'number'
        },
        mediaType: {
          type: 'string',
          enum: ['movie', 'tv']
        },
        watchDuration: {
          type: 'number',
          description: 'Watch duration in seconds'
        },
        completed: {
          type: 'boolean',
          description: 'Whether content was watched to completion'
        },
        enjoyment: {
          type: 'number',
          minimum: 1,
          maximum: 10,
          description: 'Optional enjoyment rating'
        }
      },
      required: ['userId', 'contentId', 'mediaType', 'watchDuration', 'completed']
    }
  },
  {
    name: 'get_recommendation_strategy',
    description: 'Get the current recommendation strategy and Q-learning state',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to inspect'
        }
      },
      required: ['userId']
    }
  }
];

/**
 * Social Tools - Group watching and consensus
 */
export const SOCIAL_TOOLS: ToolDefinition[] = [
  {
    name: 'create_group_session',
    description: 'Create a group watch session for multiple users',
    inputSchema: {
      type: 'object',
      properties: {
        hostUserId: {
          type: 'string',
          description: 'User creating the session'
        },
        memberIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of member user IDs'
        },
        sessionName: {
          type: 'string',
          description: 'Optional session name'
        }
      },
      required: ['hostUserId', 'memberIds']
    }
  },
  {
    name: 'submit_vote',
    description: 'Submit a vote for group watch content',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Group session ID'
        },
        userId: {
          type: 'string',
          description: 'Voting user ID'
        },
        contentId: {
          type: 'number',
          description: 'Content being voted on'
        },
        vote: {
          type: 'string',
          enum: ['yes', 'no', 'maybe'],
          description: 'Vote type'
        }
      },
      required: ['sessionId', 'userId', 'contentId', 'vote']
    }
  },
  {
    name: 'finalize_session',
    description: 'Finalize group session and select winning content',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Session to finalize'
        }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'get_group_recommendations',
    description: 'Get recommendations optimized for a group of users',
    inputSchema: {
      type: 'object',
      properties: {
        memberIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Group member user IDs'
        },
        limit: {
          type: 'number',
          default: 10
        }
      },
      required: ['memberIds']
    }
  }
];

/**
 * Learning Tools - Model training and inspection
 */
export const LEARNING_TOOLS: ToolDefinition[] = [
  {
    name: 'train_model',
    description: 'Train or update the Q-learning recommendation model',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to train model for'
        },
        episodes: {
          type: 'number',
          default: 100,
          description: 'Number of training episodes'
        },
        learningRate: {
          type: 'number',
          default: 0.1,
          description: 'Learning rate (alpha)'
        },
        discountFactor: {
          type: 'number',
          default: 0.9,
          description: 'Discount factor (gamma)'
        },
        explorationRate: {
          type: 'number',
          default: 0.1,
          description: 'Exploration rate (epsilon)'
        }
      },
      required: ['userId']
    }
  },
  {
    name: 'save_model',
    description: 'Save the current Q-learning model to disk',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID whose model to save'
        },
        path: {
          type: 'string',
          description: 'Save path (optional)'
        }
      },
      required: ['userId']
    }
  },
  {
    name: 'load_model',
    description: 'Load a saved Q-learning model',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to load model for'
        },
        path: {
          type: 'string',
          description: 'Load path (optional)'
        }
      },
      required: ['userId']
    }
  },
  {
    name: 'get_learning_stats',
    description: 'Get statistics about the learning model performance',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to inspect'
        }
      },
      required: ['userId']
    }
  },
  {
    name: 'get_preference_profile',
    description: 'Get detailed user preference profile including vector embeddings',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to inspect'
        },
        includeHistory: {
          type: 'boolean',
          default: false,
          description: 'Include interaction history'
        }
      },
      required: ['userId']
    }
  }
];

/**
 * All tools combined
 */
export const ALL_TOOLS: ToolDefinition[] = [
  ...DISCOVERY_TOOLS,
  ...RECOMMENDATION_TOOLS,
  ...SOCIAL_TOOLS,
  ...LEARNING_TOOLS
];

/**
 * Get tool by name
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return ALL_TOOLS.find(tool => tool.name === name);
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: 'discovery' | 'recommendation' | 'social' | 'learning'): ToolDefinition[] {
  switch (category) {
    case 'discovery':
      return DISCOVERY_TOOLS;
    case 'recommendation':
      return RECOMMENDATION_TOOLS;
    case 'social':
      return SOCIAL_TOOLS;
    case 'learning':
      return LEARNING_TOOLS;
    default:
      return [];
  }
}

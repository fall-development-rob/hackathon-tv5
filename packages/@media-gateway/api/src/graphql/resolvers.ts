/**
 * GraphQL Resolvers
 * SPARC FR-4.2: GraphQL API Implementation
 */

import DataLoader from 'dataloader';
import type { IResolvers } from '@graphql-tools/utils';
import type { SwarmCoordinator } from '@media-gateway/agents';

// Types for resolver context and arguments
export interface GraphQLContext {
  dataloaders: {
    content: DataLoader<string, Content>;
    user: DataLoader<string, User>;
    platform: DataLoader<string, Platform>;
    availability: DataLoader<string, PlatformAvailability[]>;
  };
  services: {
    searchService: any;
    recommendationService: any;
    userService: any;
    platformService: any;
    groupSessionService: any;
  };
  swarmCoordinator?: SwarmCoordinator;
  userId?: string;
}

export interface Content {
  id: string;
  title: string;
  overview?: string;
  mediaType: 'MOVIE' | 'TV' | 'DOCUMENTARY';
  genres: string[];
  rating?: number;
  releaseDate?: string;
  posterPath?: string;
  backdropPath?: string;
  availability: PlatformAvailability[];
}

export interface User {
  id: string;
  username: string;
  email: string;
  preferences: UserPreferences;
  watchHistory: Content[];
}

export interface UserPreferences {
  genres: string[];
  moods: string[];
  preferredPlatforms: string[];
}

export interface Platform {
  id: string;
  name: string;
  logoPath?: string;
  deepLinkTemplate: string;
}

export interface PlatformAvailability {
  platform: Platform;
  type: 'SUBSCRIPTION' | 'RENT' | 'BUY' | 'FREE';
  price?: number;
  quality?: string;
  deepLink: string;
}

export interface Recommendation {
  content: Content;
  score: number;
  reason: string;
  confidence: number;
}

export interface GroupSession {
  id: string;
  groupId: string;
  initiatorId: string;
  votes: GroupVote[];
  createdAt: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

export interface GroupVote {
  userId: string;
  contentId: string;
  score: number;
}

export interface SearchFiltersInput {
  mediaType?: 'MOVIE' | 'TV' | 'DOCUMENTARY';
  genres?: string[];
  yearMin?: number;
  yearMax?: number;
  ratingMin?: number;
}

export interface PreferencesInput {
  genres?: string[];
  moods?: string[];
  preferredPlatforms?: string[];
}

/**
 * Create DataLoaders to prevent N+1 query problems
 */
export function createDataLoaders(services: GraphQLContext['services']) {
  return {
    content: new DataLoader<string, Content>(async (ids) => {
      const contents = await services.searchService.getContentByIds(ids);
      const contentMap = new Map(contents.map((c: Content) => [c.id, c]));
      return ids.map((id) => contentMap.get(id) || null);
    }),

    user: new DataLoader<string, User>(async (ids) => {
      const users = await services.userService.getUsersByIds(ids);
      const userMap = new Map(users.map((u: User) => [u.id, u]));
      return ids.map((id) => userMap.get(id) || null);
    }),

    platform: new DataLoader<string, Platform>(async (ids) => {
      const platforms = await services.platformService.getPlatformsByIds(ids);
      const platformMap = new Map(platforms.map((p: Platform) => [p.id, p]));
      return ids.map((id) => platformMap.get(id) || null);
    }),

    availability: new DataLoader<string, PlatformAvailability[]>(async (contentIds) => {
      const availabilities = await services.platformService.getAvailabilityByContentIds(contentIds);
      const availabilityMap = new Map(
        contentIds.map((id) => [id, availabilities.filter((a: any) => a.contentId === id)])
      );
      return contentIds.map((id) => availabilityMap.get(id) || []);
    }),
  };
}

/**
 * GraphQL Resolvers Implementation
 */
export const resolvers: IResolvers<any, GraphQLContext> = {
  Query: {
    /**
     * Search for content with filters
     */
    async search(_parent, args, context) {
      const { query, filters, limit = 20 } = args;

      // Use swarm coordinator for distributed search if available
      if (context.swarmCoordinator) {
        return await context.swarmCoordinator.executeTask({
          type: 'search',
          query,
          filters,
          limit,
        });
      }

      return await context.services.searchService.search(query, filters, limit);
    },

    /**
     * Get personalized recommendations
     */
    async recommendations(_parent, args, context) {
      const { userId = context.userId, limit = 10 } = args;

      if (!userId) {
        throw new Error('User ID is required for personalized recommendations');
      }

      // Use swarm coordinator for ML-based recommendations
      if (context.swarmCoordinator) {
        return await context.swarmCoordinator.executeTask({
          type: 'recommendations',
          userId,
          limit,
        });
      }

      return await context.services.recommendationService.getRecommendations(userId, limit);
    },

    /**
     * Get content by ID
     */
    async content(_parent, args, context) {
      const { id } = args;
      return await context.dataloaders.content.load(id);
    },

    /**
     * Get user profile
     */
    async user(_parent, args, context) {
      const { id = context.userId } = args;

      if (!id) {
        throw new Error('User ID is required');
      }

      return await context.dataloaders.user.load(id);
    },

    /**
     * List all platforms
     */
    async platforms(_parent, _args, context) {
      return await context.services.platformService.getAllPlatforms();
    },

    /**
     * Get trending content
     */
    async trending(_parent, args, context) {
      const { mediaType, timeWindow = 'WEEK' } = args;

      // Use swarm coordinator for distributed trending calculation
      if (context.swarmCoordinator) {
        return await context.swarmCoordinator.executeTask({
          type: 'trending',
          mediaType,
          timeWindow,
        });
      }

      return await context.services.searchService.getTrending(mediaType, timeWindow);
    },
  },

  Mutation: {
    /**
     * Add content to watchlist
     */
    async addToWatchlist(_parent, args, context) {
      const { userId, contentId } = args;
      return await context.services.userService.addToWatchlist(userId, contentId);
    },

    /**
     * Remove content from watchlist
     */
    async removeFromWatchlist(_parent, args, context) {
      const { userId, contentId } = args;
      return await context.services.userService.removeFromWatchlist(userId, contentId);
    },

    /**
     * Rate content
     */
    async rateContent(_parent, args, context) {
      const { userId, contentId, rating } = args;

      if (rating < 0 || rating > 10) {
        throw new Error('Rating must be between 0 and 10');
      }

      const result = await context.services.userService.rateContent(userId, contentId, rating);

      // Trigger recommendation model retraining via swarm
      if (context.swarmCoordinator) {
        context.swarmCoordinator.queueTask({
          type: 'retrain_recommendations',
          userId,
        });
      }

      return result;
    },

    /**
     * Update user preferences
     */
    async updatePreferences(_parent, args, context) {
      const { userId, input } = args;

      const updatedUser = await context.services.userService.updatePreferences(userId, input);

      // Trigger recommendation refresh via swarm
      if (context.swarmCoordinator) {
        context.swarmCoordinator.queueTask({
          type: 'refresh_recommendations',
          userId,
        });
      }

      return updatedUser;
    },

    /**
     * Create group viewing session
     */
    async createGroupSession(_parent, args, context) {
      const { groupId, initiatorId } = args;
      return await context.services.groupSessionService.createSession(groupId, initiatorId);
    },

    /**
     * Submit vote in group session
     */
    async submitVote(_parent, args, context) {
      const { sessionId, userId, contentId, score } = args;

      if (score < 1 || score > 10) {
        throw new Error('Vote score must be between 1 and 10');
      }

      const result = await context.services.groupSessionService.submitVote(
        sessionId,
        userId,
        contentId,
        score
      );

      // Trigger group recommendation calculation via swarm
      if (context.swarmCoordinator) {
        context.swarmCoordinator.queueTask({
          type: 'calculate_group_consensus',
          sessionId,
        });
      }

      return result;
    },
  },

  Content: {
    /**
     * Resolve availability using DataLoader
     */
    async availability(parent, _args, context) {
      return await context.dataloaders.availability.load(parent.id);
    },
  },

  User: {
    /**
     * Resolve watch history with pagination
     */
    async watchHistory(parent, _args, context) {
      const contentIds = await context.services.userService.getWatchHistory(parent.id);
      return await Promise.all(
        contentIds.map((id: string) => context.dataloaders.content.load(id))
      );
    },
  },

  PlatformAvailability: {
    /**
     * Resolve platform using DataLoader
     */
    async platform(parent, _args, context) {
      // Parent already has platform data from availability loader
      if (parent.platform && typeof parent.platform === 'object') {
        return parent.platform;
      }

      // If only platform ID is available, load it
      const platformId = typeof parent.platform === 'string' ? parent.platform : parent.platform.id;
      return await context.dataloaders.platform.load(platformId);
    },
  },

  Recommendation: {
    /**
     * Resolve content using DataLoader
     */
    async content(parent, _args, context) {
      // Parent already has content data
      if (parent.content && typeof parent.content === 'object') {
        return parent.content;
      }

      // If only content ID is available, load it
      const contentId = typeof parent.content === 'string' ? parent.content : parent.content.id;
      return await context.dataloaders.content.load(contentId);
    },
  },
};

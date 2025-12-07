/**
 * GraphQL Query Tests
 * Tests all GraphQL query resolvers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resolvers } from '../../src/graphql/resolvers';
import { createMockGraphQLContext } from '../helpers/mocks';

describe('GraphQL Queries', () => {
  let context: ReturnType<typeof createMockGraphQLContext>;

  beforeEach(() => {
    context = createMockGraphQLContext();
  });

  describe('search', () => {
    it('should execute search query', async () => {
      const result = await resolvers.Query.search(
        null,
        { query: 'action movies', limit: 20 },
        context,
        {} as any
      );

      expect(result).toBeDefined();
      expect(context.services.searchService.search).toHaveBeenCalledWith(
        'action movies',
        undefined,
        20
      );
    });

    it('should use swarm coordinator if available', async () => {
      const swarmCoordinator = {
        executeTask: vi.fn().mockResolvedValue([]),
      };
      context.swarmCoordinator = swarmCoordinator;

      await resolvers.Query.search(
        null,
        { query: 'thriller', filters: { mediaType: 'MOVIE' } },
        context,
        {} as any
      );

      expect(swarmCoordinator.executeTask).toHaveBeenCalledWith({
        type: 'search',
        query: 'thriller',
        filters: { mediaType: 'MOVIE' },
        limit: 20,
      });
    });

    it('should apply search filters', async () => {
      const filters = {
        mediaType: 'MOVIE',
        genres: ['Action', 'Thriller'],
        yearMin: 2020,
        yearMax: 2024,
        ratingMin: 7.0,
      };

      await resolvers.Query.search(
        null,
        { query: 'movies', filters, limit: 10 },
        context,
        {} as any
      );

      expect(context.services.searchService.search).toHaveBeenCalledWith(
        'movies',
        filters,
        10
      );
    });
  });

  describe('recommendations', () => {
    it('should get personalized recommendations', async () => {
      const result = await resolvers.Query.recommendations(
        null,
        { userId: 'user-123', limit: 10 },
        context,
        {} as any
      );

      expect(result).toBeDefined();
      expect(context.services.recommendationService.getRecommendations).toHaveBeenCalledWith(
        'user-123',
        10
      );
    });

    it('should use context userId if not provided', async () => {
      await resolvers.Query.recommendations(
        null,
        { limit: 5 },
        context,
        {} as any
      );

      expect(context.services.recommendationService.getRecommendations).toHaveBeenCalledWith(
        'user-123',
        5
      );
    });

    it('should throw error if no userId available', async () => {
      context.userId = undefined;

      await expect(
        resolvers.Query.recommendations(null, {}, context, {} as any)
      ).rejects.toThrow('User ID is required');
    });

    it('should use swarm coordinator for ML recommendations', async () => {
      const swarmCoordinator = {
        executeTask: vi.fn().mockResolvedValue([]),
      };
      context.swarmCoordinator = swarmCoordinator;

      await resolvers.Query.recommendations(
        null,
        { userId: 'user-456', limit: 15 },
        context,
        {} as any
      );

      expect(swarmCoordinator.executeTask).toHaveBeenCalledWith({
        type: 'recommendations',
        userId: 'user-456',
        limit: 15,
      });
    });
  });

  describe('content', () => {
    it('should fetch content by ID using DataLoader', async () => {
      const result = await resolvers.Query.content(
        null,
        { id: 'content-123' },
        context,
        {} as any
      );

      expect(result).toBeDefined();
      expect(context.dataloaders.content.load).toHaveBeenCalledWith('content-123');
    });

    it('should return content details', async () => {
      const result = await resolvers.Query.content(
        null,
        { id: 'content-123' },
        context,
        {} as any
      );

      expect(result).toMatchObject({
        id: 'content-123',
        title: expect.any(String),
        mediaType: expect.any(String),
      });
    });
  });

  describe('user', () => {
    it('should fetch user by ID using DataLoader', async () => {
      const result = await resolvers.Query.user(
        null,
        { id: 'user-456' },
        context,
        {} as any
      );

      expect(result).toBeDefined();
      expect(context.dataloaders.user.load).toHaveBeenCalledWith('user-456');
    });

    it('should use context userId if not provided', async () => {
      await resolvers.Query.user(
        null,
        {},
        context,
        {} as any
      );

      expect(context.dataloaders.user.load).toHaveBeenCalledWith('user-123');
    });

    it('should throw error if no userId available', async () => {
      context.userId = undefined;

      await expect(
        resolvers.Query.user(null, {}, context, {} as any)
      ).rejects.toThrow('User ID is required');
    });
  });

  describe('platforms', () => {
    it('should fetch all platforms', async () => {
      const result = await resolvers.Query.platforms(
        null,
        {},
        context,
        {} as any
      );

      expect(result).toBeDefined();
      expect(context.services.platformService.getAllPlatforms).toHaveBeenCalled();
    });
  });

  describe('trending', () => {
    it('should get trending content with default time window', async () => {
      await resolvers.Query.trending(
        null,
        {},
        context,
        {} as any
      );

      expect(context.services.searchService.getTrending).toHaveBeenCalledWith(
        undefined,
        'WEEK'
      );
    });

    it('should filter trending by media type', async () => {
      await resolvers.Query.trending(
        null,
        { mediaType: 'MOVIE', timeWindow: 'DAY' },
        context,
        {} as any
      );

      expect(context.services.searchService.getTrending).toHaveBeenCalledWith(
        'MOVIE',
        'DAY'
      );
    });

    it('should use swarm coordinator for distributed trending calculation', async () => {
      const swarmCoordinator = {
        executeTask: vi.fn().mockResolvedValue([]),
      };
      context.swarmCoordinator = swarmCoordinator;

      await resolvers.Query.trending(
        null,
        { mediaType: 'TV', timeWindow: 'MONTH' },
        context,
        {} as any
      );

      expect(swarmCoordinator.executeTask).toHaveBeenCalledWith({
        type: 'trending',
        mediaType: 'TV',
        timeWindow: 'MONTH',
      });
    });
  });
});

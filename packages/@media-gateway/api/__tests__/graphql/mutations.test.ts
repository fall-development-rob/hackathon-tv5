/**
 * GraphQL Mutation Tests
 * Tests all GraphQL mutation resolvers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resolvers } from '../../src/graphql/resolvers';
import { createMockGraphQLContext } from '../helpers/mocks';

describe('GraphQL Mutations', () => {
  let context: ReturnType<typeof createMockGraphQLContext>;

  beforeEach(() => {
    context = createMockGraphQLContext();
  });

  describe('addToWatchlist', () => {
    it('should add content to watchlist', async () => {
      const result = await resolvers.Mutation.addToWatchlist(
        null,
        { userId: 'user-123', contentId: 'content-456' },
        context,
        {} as any
      );

      expect(result).toBe(true);
      expect(context.services.userService.addToWatchlist).toHaveBeenCalledWith(
        'user-123',
        'content-456'
      );
    });
  });

  describe('removeFromWatchlist', () => {
    it('should remove content from watchlist', async () => {
      const result = await resolvers.Mutation.removeFromWatchlist(
        null,
        { userId: 'user-123', contentId: 'content-456' },
        context,
        {} as any
      );

      expect(result).toBe(true);
      expect(context.services.userService.removeFromWatchlist).toHaveBeenCalledWith(
        'user-123',
        'content-456'
      );
    });
  });

  describe('rateContent', () => {
    it('should rate content successfully', async () => {
      const result = await resolvers.Mutation.rateContent(
        null,
        { userId: 'user-123', contentId: 'content-456', rating: 8.5 },
        context,
        {} as any
      );

      expect(result).toBe(true);
      expect(context.services.userService.rateContent).toHaveBeenCalledWith(
        'user-123',
        'content-456',
        8.5
      );
    });

    it('should trigger recommendation retraining via swarm', async () => {
      const swarmCoordinator = {
        queueTask: vi.fn(),
      };
      context.swarmCoordinator = swarmCoordinator;

      await resolvers.Mutation.rateContent(
        null,
        { userId: 'user-123', contentId: 'content-456', rating: 9.0 },
        context,
        {} as any
      );

      expect(swarmCoordinator.queueTask).toHaveBeenCalledWith({
        type: 'retrain_recommendations',
        userId: 'user-123',
      });
    });

    it('should reject rating below 0', async () => {
      await expect(
        resolvers.Mutation.rateContent(
          null,
          { userId: 'user-123', contentId: 'content-456', rating: -1 },
          context,
          {} as any
        )
      ).rejects.toThrow('Rating must be between 0 and 10');
    });

    it('should reject rating above 10', async () => {
      await expect(
        resolvers.Mutation.rateContent(
          null,
          { userId: 'user-123', contentId: 'content-456', rating: 11 },
          context,
          {} as any
        )
      ).rejects.toThrow('Rating must be between 0 and 10');
    });

    it('should accept rating of 0', async () => {
      const result = await resolvers.Mutation.rateContent(
        null,
        { userId: 'user-123', contentId: 'content-456', rating: 0 },
        context,
        {} as any
      );

      expect(result).toBe(true);
    });

    it('should accept rating of 10', async () => {
      const result = await resolvers.Mutation.rateContent(
        null,
        { userId: 'user-123', contentId: 'content-456', rating: 10 },
        context,
        {} as any
      );

      expect(result).toBe(true);
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences', async () => {
      const input = {
        genres: ['Action', 'Sci-Fi'],
        moods: ['excited', 'adventurous'],
        preferredPlatforms: ['netflix', 'amazon-prime'],
      };

      const result = await resolvers.Mutation.updatePreferences(
        null,
        { userId: 'user-123', input },
        context,
        {} as any
      );

      expect(result).toBeDefined();
      expect(context.services.userService.updatePreferences).toHaveBeenCalledWith(
        'user-123',
        input
      );
    });

    it('should trigger recommendation refresh via swarm', async () => {
      const swarmCoordinator = {
        queueTask: vi.fn(),
      };
      context.swarmCoordinator = swarmCoordinator;

      const input = { genres: ['Drama'] };

      await resolvers.Mutation.updatePreferences(
        null,
        { userId: 'user-123', input },
        context,
        {} as any
      );

      expect(swarmCoordinator.queueTask).toHaveBeenCalledWith({
        type: 'refresh_recommendations',
        userId: 'user-123',
      });
    });

    it('should handle partial preference updates', async () => {
      const input = { genres: ['Horror'] };

      await resolvers.Mutation.updatePreferences(
        null,
        { userId: 'user-123', input },
        context,
        {} as any
      );

      expect(context.services.userService.updatePreferences).toHaveBeenCalledWith(
        'user-123',
        input
      );
    });
  });

  describe('createGroupSession', () => {
    it('should create group viewing session', async () => {
      const result = await resolvers.Mutation.createGroupSession(
        null,
        { groupId: 'group-123', initiatorId: 'user-123' },
        context,
        {} as any
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('session-123');
      expect(context.services.groupSessionService.createSession).toHaveBeenCalledWith(
        'group-123',
        'user-123'
      );
    });
  });

  describe('submitVote', () => {
    it('should submit vote in group session', async () => {
      const result = await resolvers.Mutation.submitVote(
        null,
        {
          sessionId: 'session-123',
          userId: 'user-123',
          contentId: 'content-456',
          score: 8,
        },
        context,
        {} as any
      );

      expect(result).toBe(true);
      expect(context.services.groupSessionService.submitVote).toHaveBeenCalledWith(
        'session-123',
        'user-123',
        'content-456',
        8
      );
    });

    it('should trigger group consensus calculation via swarm', async () => {
      const swarmCoordinator = {
        queueTask: vi.fn(),
      };
      context.swarmCoordinator = swarmCoordinator;

      await resolvers.Mutation.submitVote(
        null,
        {
          sessionId: 'session-123',
          userId: 'user-123',
          contentId: 'content-456',
          score: 7,
        },
        context,
        {} as any
      );

      expect(swarmCoordinator.queueTask).toHaveBeenCalledWith({
        type: 'calculate_group_consensus',
        sessionId: 'session-123',
      });
    });

    it('should reject score below 1', async () => {
      await expect(
        resolvers.Mutation.submitVote(
          null,
          {
            sessionId: 'session-123',
            userId: 'user-123',
            contentId: 'content-456',
            score: 0,
          },
          context,
          {} as any
        )
      ).rejects.toThrow('Vote score must be between 1 and 10');
    });

    it('should reject score above 10', async () => {
      await expect(
        resolvers.Mutation.submitVote(
          null,
          {
            sessionId: 'session-123',
            userId: 'user-123',
            contentId: 'content-456',
            score: 11,
          },
          context,
          {} as any
        )
      ).rejects.toThrow('Vote score must be between 1 and 10');
    });

    it('should accept minimum score of 1', async () => {
      const result = await resolvers.Mutation.submitVote(
        null,
        {
          sessionId: 'session-123',
          userId: 'user-123',
          contentId: 'content-456',
          score: 1,
        },
        context,
        {} as any
      );

      expect(result).toBe(true);
    });

    it('should accept maximum score of 10', async () => {
      const result = await resolvers.Mutation.submitVote(
        null,
        {
          sessionId: 'session-123',
          userId: 'user-123',
          contentId: 'content-456',
          score: 10,
        },
        context,
        {} as any
      );

      expect(result).toBe(true);
    });
  });
});

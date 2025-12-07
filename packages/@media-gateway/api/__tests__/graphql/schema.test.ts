/**
 * GraphQL Schema Tests
 * Tests GraphQL schema validation and structure
 */

import { describe, it, expect } from 'vitest';
import { schema, validation, GraphQLError, errorCodes } from '../../src/graphql/schema';
import { typeDefs } from '../../src/graphql/types';

describe('GraphQL Schema', () => {
  describe('Schema Construction', () => {
    it('should create executable schema', () => {
      expect(schema).toBeDefined();
      expect(schema.getQueryType()).toBeDefined();
      expect(schema.getMutationType()).toBeDefined();
    });

    it('should include type definitions', () => {
      expect(typeDefs).toBeDefined();
      expect(typeof typeDefs).toBe('string');
      expect(typeDefs).toContain('type Query');
      expect(typeDefs).toContain('type Mutation');
    });

    it('should have required query fields', () => {
      const queryType = schema.getQueryType();
      const fields = queryType?.getFields();

      expect(fields).toHaveProperty('search');
      expect(fields).toHaveProperty('recommendations');
      expect(fields).toHaveProperty('content');
      expect(fields).toHaveProperty('user');
      expect(fields).toHaveProperty('platforms');
      expect(fields).toHaveProperty('trending');
    });

    it('should have required mutation fields', () => {
      const mutationType = schema.getMutationType();
      const fields = mutationType?.getFields();

      expect(fields).toHaveProperty('addToWatchlist');
      expect(fields).toHaveProperty('removeFromWatchlist');
      expect(fields).toHaveProperty('rateContent');
      expect(fields).toHaveProperty('updatePreferences');
      expect(fields).toHaveProperty('createGroupSession');
      expect(fields).toHaveProperty('submitVote');
    });
  });

  describe('Validation Utilities', () => {
    describe('validateRating', () => {
      it('should accept valid ratings', () => {
        expect(() => validation.validateRating(0)).not.toThrow();
        expect(() => validation.validateRating(5)).not.toThrow();
        expect(() => validation.validateRating(10)).not.toThrow();
      });

      it('should reject ratings below 0', () => {
        expect(() => validation.validateRating(-1)).toThrow('Rating must be between 0 and 10');
      });

      it('should reject ratings above 10', () => {
        expect(() => validation.validateRating(11)).toThrow('Rating must be between 0 and 10');
      });
    });

    describe('validateVoteScore', () => {
      it('should accept valid vote scores', () => {
        expect(() => validation.validateVoteScore(1)).not.toThrow();
        expect(() => validation.validateVoteScore(5)).not.toThrow();
        expect(() => validation.validateVoteScore(10)).not.toThrow();
      });

      it('should reject scores below 1', () => {
        expect(() => validation.validateVoteScore(0)).toThrow('Vote score must be between 1 and 10');
      });

      it('should reject scores above 10', () => {
        expect(() => validation.validateVoteScore(11)).toThrow('Vote score must be between 1 and 10');
      });
    });

    describe('validateLimit', () => {
      it('should return default limit when undefined', () => {
        expect(validation.validateLimit()).toBe(20);
      });

      it('should return provided limit when valid', () => {
        expect(validation.validateLimit(10)).toBe(10);
        expect(validation.validateLimit(50)).toBe(50);
      });

      it('should enforce minimum limit of 1', () => {
        expect(validation.validateLimit(0)).toBe(1);
        expect(validation.validateLimit(-5)).toBe(1);
      });

      it('should enforce maximum limit', () => {
        expect(validation.validateLimit(150)).toBe(100);
        expect(validation.validateLimit(200, 50)).toBe(50);
      });
    });

    describe('validateYearRange', () => {
      it('should accept valid year ranges', () => {
        expect(() => validation.validateYearRange(2020, 2024)).not.toThrow();
        expect(() => validation.validateYearRange(1990, 2000)).not.toThrow();
      });

      it('should throw when yearMin > yearMax', () => {
        expect(() => validation.validateYearRange(2024, 2020)).toThrow(
          'yearMin cannot be greater than yearMax'
        );
      });

      it('should reject future years beyond threshold', () => {
        const currentYear = new Date().getFullYear();
        expect(() => validation.validateYearRange(undefined, currentYear + 10)).toThrow();
      });

      it('should allow undefined values', () => {
        expect(() => validation.validateYearRange()).not.toThrow();
        expect(() => validation.validateYearRange(2020)).not.toThrow();
        expect(() => validation.validateYearRange(undefined, 2024)).not.toThrow();
      });
    });
  });

  describe('Error Handling', () => {
    it('should create GraphQLError with code and status', () => {
      const error = new GraphQLError('Test error', 'TEST_ERROR', 400);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(400);
    });

    it('should use default status code 400', () => {
      const error = new GraphQLError('Test error', 'TEST_ERROR');
      expect(error.statusCode).toBe(400);
    });

    it('should have error codes defined', () => {
      expect(errorCodes.AUTHENTICATION_REQUIRED).toBe('AUTHENTICATION_REQUIRED');
      expect(errorCodes.INVALID_INPUT).toBe('INVALID_INPUT');
      expect(errorCodes.NOT_FOUND).toBe('NOT_FOUND');
      expect(errorCodes.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
      expect(errorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    });
  });

  describe('Type System', () => {
    it('should have Content type', () => {
      const contentType = schema.getType('Content');
      expect(contentType).toBeDefined();
    });

    it('should have User type', () => {
      const userType = schema.getType('User');
      expect(userType).toBeDefined();
    });

    it('should have Platform type', () => {
      const platformType = schema.getType('Platform');
      expect(platformType).toBeDefined();
    });

    it('should have PlatformAvailability type', () => {
      const availabilityType = schema.getType('PlatformAvailability');
      expect(availabilityType).toBeDefined();
    });

    it('should have Recommendation type', () => {
      const recommendationType = schema.getType('Recommendation');
      expect(recommendationType).toBeDefined();
    });

    it('should have MediaType enum', () => {
      const mediaTypeEnum = schema.getType('MediaType');
      expect(mediaTypeEnum).toBeDefined();
    });

    it('should have AvailabilityType enum', () => {
      const availabilityTypeEnum = schema.getType('AvailabilityType');
      expect(availabilityTypeEnum).toBeDefined();
    });
  });
});

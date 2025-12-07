/**
 * Machine Views Tests
 * AI agent compatibility validation
 */

import { describe, it, expect } from 'vitest';
import {
  MachineViewGenerator,
  createMachineViewGenerator,
  getMachineViewHeaders,
  type ViewFormat,
} from '../src/views/index.js';
import type { MediaContent, Recommendation, GroupSession } from '@media-gateway/core';

const mockContent: MediaContent = {
  id: 12345,
  title: 'Test Movie',
  overview: 'A thrilling test movie about testing',
  mediaType: 'movie',
  genreIds: [28, 12, 878],
  voteAverage: 8.5,
  voteCount: 2500,
  releaseDate: '2024-06-15',
  posterPath: '/poster123.jpg',
  backdropPath: '/backdrop123.jpg',
  popularity: 150.5,
};

const mockAvailability = [
  {
    platformId: 'netflix',
    platformName: 'Netflix',
    available: true,
    type: 'subscription' as const,
    deepLink: 'https://netflix.com/title/12345',
  },
  {
    platformId: 'prime',
    platformName: 'Amazon Prime Video',
    available: true,
    type: 'subscription' as const,
    deepLink: 'https://amazon.com/video/12345',
  },
];

describe('MachineViewGenerator', () => {
  describe('JSON format', () => {
    it('should generate plain JSON view', () => {
      const generator = createMachineViewGenerator({
        format: 'json',
        baseUrl: 'https://media-gateway.io',
      });

      const view = generator.generateContentView(mockContent) as any;

      expect(view.id).toBe(mockContent.id);
      expect(view.title).toBe(mockContent.title);
      expect(view.mediaType).toBe('movie');
    });

    it('should include availability when configured', () => {
      const generator = createMachineViewGenerator({
        format: 'json',
        baseUrl: 'https://media-gateway.io',
        includeAvailability: true,
      });

      const view = generator.generateContentView(mockContent, mockAvailability) as any;

      expect(view.availability).toBeDefined();
      expect(view.availability).toHaveLength(2);
    });
  });

  describe('JSON-LD format', () => {
    it('should generate JSON-LD with schema.org context', () => {
      const generator = createMachineViewGenerator({
        format: 'json-ld',
        baseUrl: 'https://media-gateway.io',
      });

      const view = generator.generateContentView(mockContent) as any;

      expect(view['@context']).toBe('https://schema.org');
      expect(view['@type']).toBe('Movie');
      expect(view['@id']).toContain('/content/12345');
    });

    it('should include aggregateRating', () => {
      const generator = createMachineViewGenerator({
        format: 'json-ld',
        baseUrl: 'https://media-gateway.io',
      });

      const view = generator.generateContentView(mockContent) as any;

      expect(view.aggregateRating).toBeDefined();
      expect(view.aggregateRating.ratingValue).toBe(8.5);
      expect(view.aggregateRating.bestRating).toBe(10);
    });

    it('should add WatchAction for availability', () => {
      const generator = createMachineViewGenerator({
        format: 'json-ld',
        baseUrl: 'https://media-gateway.io',
      });

      const view = generator.generateContentView(mockContent, mockAvailability) as any;

      expect(view.potentialAction).toBeDefined();
      expect(view.potentialAction).toHaveLength(2);
      expect(view.potentialAction[0]['@type']).toBe('WatchAction');
    });

    it('should handle TV series correctly', () => {
      const tvContent = { ...mockContent, mediaType: 'tv' as const };
      const generator = createMachineViewGenerator({
        format: 'json-ld',
        baseUrl: 'https://media-gateway.io',
      });

      const view = generator.generateContentView(tvContent) as any;

      expect(view['@type']).toBe('TVSeries');
    });
  });

  describe('ARW format', () => {
    it('should generate ARW-specific view', () => {
      const generator = createMachineViewGenerator({
        format: 'arw',
        baseUrl: 'https://media-gateway.io',
      });

      const view = generator.generateContentView(mockContent) as any;

      expect(view.$arw).toBeDefined();
      expect(view.$arw.version).toBe('1.0.0');
      expect(view.$arw.type).toBe('media:content');
      expect(view.$arw.actions).toContain('search:similar');
    });

    it('should include meta with timestamp and TTL', () => {
      const generator = createMachineViewGenerator({
        format: 'arw',
        baseUrl: 'https://media-gateway.io',
      });

      const view = generator.generateContentView(mockContent) as any;

      expect(view.meta).toBeDefined();
      expect(view.meta.generated).toBeDefined();
      expect(view.meta.ttl).toBeGreaterThan(0);
      expect(view.meta.source).toBe('https://media-gateway.io');
    });
  });

  describe('recommendations view', () => {
    const mockRecommendations: Recommendation[] = [
      {
        content: mockContent,
        score: 0.95,
        reason: 'Based on your preferences',
        personalizationScore: 0.9,
      },
    ];

    it('should generate JSON-LD ItemList for recommendations', () => {
      const generator = createMachineViewGenerator({
        format: 'json-ld',
        baseUrl: 'https://media-gateway.io',
      });

      const view = generator.generateRecommendationsView(mockRecommendations) as any;

      expect(view['@type']).toBe('ItemList');
      expect(view.itemListElement).toHaveLength(1);
      expect(view.itemListElement[0].position).toBe(1);
    });

    it('should generate ARW view for recommendations', () => {
      const generator = createMachineViewGenerator({
        format: 'arw',
        baseUrl: 'https://media-gateway.io',
      });

      const view = generator.generateRecommendationsView(mockRecommendations) as any;

      expect(view.$arw.type).toBe('media:recommendations');
      expect(view.data.items).toHaveLength(1);
      expect(view.data.items[0].score).toBe(0.95);
    });
  });

  describe('group session view', () => {
    const mockSession: GroupSession = {
      id: 'session123',
      groupId: 'group456',
      status: 'voting',
      initiatorId: 'user789',
      context: { mood: 'fun' },
      candidates: [
        {
          content: mockContent,
          groupScore: 0.85,
          fairnessScore: 0.9,
          memberScores: { user1: 0.9, user2: 0.8 },
          votes: {},
        },
      ],
      createdAt: new Date(),
    };

    it('should generate ARW view for group session', () => {
      const generator = createMachineViewGenerator({
        format: 'arw',
        baseUrl: 'https://media-gateway.io',
      });

      const view = generator.generateGroupSessionView(mockSession) as any;

      expect(view.$arw.type).toBe('group:session');
      expect(view.$arw.actions).toContain('group:vote');
      expect(view.data.id).toBe('session123');
      expect(view.data.status).toBe('voting');
    });
  });
});

describe('getMachineViewHeaders', () => {
  it('should return correct headers for JSON format', () => {
    const headers = getMachineViewHeaders('json');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('should return correct headers for JSON-LD format', () => {
    const headers = getMachineViewHeaders('json-ld');
    expect(headers['Content-Type']).toBe('application/ld+json');
    expect(headers['X-ARW-Format']).toBe('json-ld');
  });

  it('should return correct headers for ARW format', () => {
    const headers = getMachineViewHeaders('arw');
    expect(headers['Content-Type']).toBe('application/vnd.arw+json');
    expect(headers['X-ARW-Version']).toBe('1.0.0');
  });
});

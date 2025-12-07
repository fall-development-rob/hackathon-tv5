/**
 * Discovery Agent Tests
 * Tests intent parsing, NLP, and context management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DiscoveryAgent, createDiscoveryAgent } from '../../src/agents/DiscoveryAgent.js';
import type { AgentIntent, AgentContext } from '@media-gateway/core';

// Mock Gemini API
global.fetch = vi.fn();

describe('DiscoveryAgent', () => {
  let agent: DiscoveryAgent;

  beforeEach(() => {
    agent = createDiscoveryAgent('test-session-123', 'user-456');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Intent Parsing (Regex-based)', () => {
    it('should parse search intent correctly', () => {
      const intent = agent.parseIntent('find action movies from the 90s');

      expect(intent.type).toBe('search');
      expect(intent.query).toContain('action');
      expect(intent.filters?.genres).toContain(28); // Action genre ID
      expect(intent.filters?.yearMin).toBe(1990);
      expect(intent.filters?.yearMax).toBe(1999);
    });

    it('should parse recommendation intent', () => {
      const intent = agent.parseIntent('what should I watch tonight?');

      expect(intent.type).toBe('recommendation');
      expect(intent.context).toBeDefined();
    });

    it('should parse group watch intent', () => {
      const intent = agent.parseIntent('movie night with my friends');

      expect(intent.type).toBe('group_watch');
      expect(intent.groupId).toBe('default');
    });

    it('should parse availability check intent', () => {
      const intent = agent.parseIntent('where can I watch Inception?');

      expect(intent.type).toBe('availability_check');
      expect(intent.mediaType).toBe('movie');
    });

    it('should default to search for unknown queries', () => {
      const intent = agent.parseIntent('random query text');

      expect(intent.type).toBe('search');
      expect(intent.query).toBe('random query text');
    });
  });

  describe('Filter Extraction', () => {
    it('should extract genre filters', () => {
      const filters = agent.extractFilters('horror thriller movies');

      expect(filters.genres).toContain(27); // Horror
      expect(filters.genres).toContain(53); // Thriller
    });

    it('should extract media type filters', () => {
      const filters = agent.extractFilters('tv shows about comedy');

      expect(filters.mediaType).toBe('tv');
      expect(filters.genres).toContain(35); // Comedy
    });

    it('should extract year filters for recent content', () => {
      const filters = agent.extractFilters('recent movies');

      expect(filters.yearMin).toBeGreaterThan(2020);
    });

    it('should extract year filters for classic content', () => {
      const filters = agent.extractFilters('classic films');

      expect(filters.yearMax).toBe(2000);
    });

    it('should extract rating filters', () => {
      const filters = agent.extractFilters('highly rated action movies');

      expect(filters.ratingMin).toBe(7.5);
      expect(filters.genres).toContain(28); // Action
    });

    it('should handle multiple genres', () => {
      const filters = agent.extractFilters('sci-fi action comedy');

      expect(filters.genres?.length).toBeGreaterThan(1);
      expect(filters.genres).toContain(878); // Sci-Fi
      expect(filters.genres).toContain(28); // Action
    });

    it('should return empty filters for no matches', () => {
      const filters = agent.extractFilters('xyz abc 123');

      expect(Object.keys(filters)).toHaveLength(0);
    });
  });

  describe('Context Management', () => {
    it('should extract mood from query', () => {
      const intent = agent.parseIntent('recommend something fun and happy');

      if (intent.type === 'recommendation') {
        expect(intent.context?.mood).toBe('happy');
      }
    });

    it('should extract time constraints', () => {
      const intent = agent.parseIntent('something to watch for 2 hours');

      if (intent.type === 'recommendation') {
        expect(intent.context?.availableTime).toBe(120);
      }
    });

    it('should accumulate filters across conversation', () => {
      agent.addTurn('user', 'I like action movies');
      agent.addTurn('user', 'show me something from the 90s');

      const context = agent.getContext();
      const filters = context.accumulatedFilters;

      expect(filters.genres).toContain(28); // Action
      expect(filters.yearMin).toBeDefined();
    });

    it('should maintain conversation history', () => {
      agent.addTurn('user', 'find comedy movies');
      agent.addTurn('assistant', 'Here are some comedy movies...');
      agent.addTurn('user', 'show me more');

      const context = agent.getContext();

      expect(context.conversationHistory).toHaveLength(3);
      expect(context.conversationHistory[0].role).toBe('user');
      expect(context.conversationHistory[1].role).toBe('assistant');
    });

    it('should clear context correctly', () => {
      agent.addTurn('user', 'test query');
      agent.clearContext();

      const context = agent.getContext();

      expect(context.conversationHistory).toHaveLength(0);
      expect(Object.keys(context.accumulatedFilters)).toHaveLength(0);
    });

    it('should generate conversation summary', () => {
      agent.addTurn('user', 'find action movies');
      agent.addTurn('assistant', 'Here are results');
      agent.addTurn('user', 'show more');

      const summary = agent.getSummary();

      expect(summary).toContain('user: find action movies');
      expect(summary).toContain('assistant: Here are results');
    });
  });

  describe('AI-Powered Intent Parsing (Gemini)', () => {
    it('should parse intent using Gemini API when available', async () => {
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                type: 'search',
                query: 'action movies',
                filters: { genres: [28], yearMin: 1990, yearMax: 1999 }
              })
            }]
          }
        }]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // Set API key
      process.env.GOOGLE_GEMINI_API_KEY = 'test-key';

      const intent = await agent.parseIntentWithAI('find action movies from the 90s');

      expect(intent.type).toBe('search');
      expect(intent.query).toBe('action movies');
      expect(intent.filters?.genres).toContain(28);

      delete process.env.GOOGLE_GEMINI_API_KEY;
    });

    it('should fallback to regex when Gemini API fails', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('API error'));

      process.env.GOOGLE_GEMINI_API_KEY = 'test-key';

      const intent = await agent.parseIntentWithAI('find action movies');

      expect(intent.type).toBe('search');

      delete process.env.GOOGLE_GEMINI_API_KEY;
    });

    it('should fallback when API key is missing', async () => {
      delete process.env.GOOGLE_GEMINI_API_KEY;

      const intent = await agent.parseIntentWithAI('find movies');

      expect(intent.type).toBe('search');
    });

    it('should handle malformed Gemini responses', async () => {
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: 'Invalid JSON response'
            }]
          }
        }]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      process.env.GOOGLE_GEMINI_API_KEY = 'test-key';

      const intent = await agent.parseIntentWithAI('test query');

      expect(intent.type).toBe('search');

      delete process.env.GOOGLE_GEMINI_API_KEY;
    });

    it('should use addTurnWithAI for AI-powered conversation', async () => {
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                type: 'recommendation',
                filters: { ratingMin: 8 }
              })
            }]
          }
        }]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      process.env.GOOGLE_GEMINI_API_KEY = 'test-key';

      await agent.addTurnWithAI('user', 'recommend something good');

      const context = agent.getContext();

      expect(context.conversationHistory).toHaveLength(1);
      expect(context.conversationHistory[0].intent?.type).toBe('recommendation');

      delete process.env.GOOGLE_GEMINI_API_KEY;
    });
  });

  describe('Available AI Providers', () => {
    it('should list available AI providers', () => {
      const providers = agent.getAvailableAIProviders();

      expect(providers).toHaveLength(3);
      expect(providers[0].provider).toContain('Google Gemini');
      expect(providers[1].provider).toContain('Vercel AI SDK');
      expect(providers[2].provider).toContain('Regex Fallback');
      expect(providers[2].available).toBe(true); // Fallback always available
    });

    it('should indicate Gemini availability based on API key', () => {
      process.env.GOOGLE_GEMINI_API_KEY = 'test-key';

      const providers = agent.getAvailableAIProviders();

      expect(providers[0].available).toBe(true);

      delete process.env.GOOGLE_GEMINI_API_KEY;
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty queries', () => {
      const intent = agent.parseIntent('');

      expect(intent.type).toBe('search');
      expect(intent.query).toBe('');
    });

    it('should handle queries with special characters', () => {
      const intent = agent.parseIntent('find "action" movies @2023 #trending!');

      expect(intent.type).toBe('search');
    });

    it('should handle very long queries', () => {
      const longQuery = 'find '.repeat(100) + 'movies';
      const intent = agent.parseIntent(longQuery);

      expect(intent.type).toBe('search');
    });

    it('should handle case-insensitive genre matching', () => {
      const filters1 = agent.extractFilters('ACTION MOVIES');
      const filters2 = agent.extractFilters('action movies');

      expect(filters1.genres).toEqual(filters2.genres);
    });

    it('should handle multiple spaces and whitespace', () => {
      const intent = agent.parseIntent('find    action     movies');

      expect(intent.type).toBe('search');
    });
  });

  describe('Factory Function', () => {
    it('should create agent with factory function', () => {
      const newAgent = createDiscoveryAgent('session-1');

      expect(newAgent).toBeInstanceOf(DiscoveryAgent);
    });

    it('should initialize with correct session and user IDs', () => {
      const newAgent = createDiscoveryAgent('session-123', 'user-456');
      const context = newAgent.getContext();

      expect(context.sessionId).toBe('session-123');
      expect(context.userId).toBe('user-456');
    });
  });
});

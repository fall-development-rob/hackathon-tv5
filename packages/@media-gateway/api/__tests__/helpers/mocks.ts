/**
 * Mock Data and Helpers
 */

import { vi } from 'vitest';

// Mock content data
export const mockContent = {
  id: 'content-123',
  title: 'Test Movie',
  mediaType: 'movie',
  year: 2024,
  genre: ['Action', 'Thriller'],
  rating: 8.5,
  duration: 120,
  description: 'A thrilling action movie',
  releaseDate: '2024-01-15',
  cast: [
    { name: 'Actor One', role: 'Lead' },
    { name: 'Actor Two', role: 'Supporting' },
  ],
  crew: [
    { name: 'Director Name', role: 'Director' },
  ],
  metadata: {
    language: 'en',
    country: 'US',
    certification: 'PG-13',
  },
};

export const mockAvailability = [
  {
    platform: 'Netflix',
    platformId: 'netflix',
    type: 'subscription',
    deepLink: 'https://netflix.com/watch/content-123',
    price: null,
    quality: ['HD', '4K'],
    available: true,
    availableUntil: null,
  },
  {
    platform: 'Amazon Prime Video',
    platformId: 'amazon-prime',
    type: 'rent',
    deepLink: 'https://amazon.com/rent/content-123',
    price: {
      amount: 3.99,
      currency: 'USD',
      rentalPeriod: '48 hours',
    },
    quality: ['HD'],
    available: true,
  },
];

export const mockUser = {
  id: 'user-123',
  username: 'testuser',
  email: 'test@example.com',
  preferences: {
    genres: ['Action', 'Sci-Fi'],
    moods: ['excited', 'adventurous'],
    preferredPlatforms: ['netflix', 'amazon-prime'],
  },
  watchHistory: [mockContent.id],
};

export const mockRecommendations = [
  {
    id: 'rec-1',
    title: 'Recommended Movie',
    mediaType: 'movie',
    year: 2024,
    genre: ['Drama'],
    rating: 9.0,
    matchScore: 0.95,
    reasoning: [
      'Based on your viewing history',
      'Similar to movies you rated highly',
    ],
    availability: mockAvailability,
  },
];

// Mock GraphQL context
export const createMockGraphQLContext = () => ({
  dataloaders: {
    content: {
      load: vi.fn().mockResolvedValue(mockContent),
      loadMany: vi.fn().mockResolvedValue([mockContent]),
    },
    user: {
      load: vi.fn().mockResolvedValue(mockUser),
      loadMany: vi.fn().mockResolvedValue([mockUser]),
    },
    platform: {
      load: vi.fn(),
      loadMany: vi.fn(),
    },
    availability: {
      load: vi.fn().mockResolvedValue(mockAvailability),
      loadMany: vi.fn().mockResolvedValue([mockAvailability]),
    },
  },
  services: {
    searchService: {
      search: vi.fn().mockResolvedValue([mockContent]),
      getContentByIds: vi.fn().mockResolvedValue([mockContent]),
      getTrending: vi.fn().mockResolvedValue([mockContent]),
    },
    recommendationService: {
      getRecommendations: vi.fn().mockResolvedValue(mockRecommendations),
    },
    userService: {
      getUsersByIds: vi.fn().mockResolvedValue([mockUser]),
      addToWatchlist: vi.fn().mockResolvedValue(true),
      removeFromWatchlist: vi.fn().mockResolvedValue(true),
      rateContent: vi.fn().mockResolvedValue(true),
      updatePreferences: vi.fn().mockResolvedValue(mockUser),
      getWatchHistory: vi.fn().mockResolvedValue([mockContent.id]),
    },
    platformService: {
      getAllPlatforms: vi.fn().mockResolvedValue([]),
      getPlatformsByIds: vi.fn().mockResolvedValue([]),
      getAvailabilityByContentIds: vi.fn().mockResolvedValue(mockAvailability),
    },
    groupSessionService: {
      createSession: vi.fn().mockResolvedValue({ id: 'session-123' }),
      submitVote: vi.fn().mockResolvedValue(true),
    },
  },
  swarmCoordinator: null,
  userId: 'user-123',
});

// Helper to wait for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to create mock request
export const createMockRequest = (overrides = {}) => ({
  query: {},
  params: {},
  body: {},
  headers: {},
  ...overrides,
});

// Helper to create mock response
export const createMockResponse = () => {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
};

// Helper to create mock next function
export const createMockNext = () => vi.fn();

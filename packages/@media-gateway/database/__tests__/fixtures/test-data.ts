/**
 * Test fixtures and sample data
 */

import type {
  MediaContent,
  UserPreferences,
  WatchEvent,
  WatchContext,
} from '@media-gateway/core';

// Sample Media Content
export const mockMovie: MediaContent = {
  id: 550,
  title: 'Fight Club',
  overview: 'A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy.',
  mediaType: 'movie',
  genreIds: [18, 53],
  voteAverage: 8.4,
  voteCount: 26000,
  releaseDate: '1999-10-15',
  posterPath: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
  backdropPath: '/fCayJrkfRaCRCTh8GqN30f8oyQF.jpg',
  popularity: 63.869,
};

export const mockTVShow: MediaContent = {
  id: 1396,
  title: 'Breaking Bad',
  overview: 'When Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and given a prognosis of only two years left to live.',
  mediaType: 'tv',
  genreIds: [18, 80],
  voteAverage: 8.9,
  voteCount: 13000,
  releaseDate: '2008-01-20',
  posterPath: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
  backdropPath: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
  popularity: 329.547,
};

export const mockContentList: MediaContent[] = [
  mockMovie,
  mockTVShow,
  {
    id: 603,
    title: 'The Matrix',
    overview: 'Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth.',
    mediaType: 'movie',
    genreIds: [28, 878],
    voteAverage: 8.2,
    voteCount: 24000,
    releaseDate: '1999-03-31',
    posterPath: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
    backdropPath: '/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg',
    popularity: 85.123,
  },
];

// Sample User Preferences
export const mockUserPreferences: UserPreferences = {
  vector: new Float32Array(768).fill(0.5),
  confidence: 0.85,
  genreAffinities: {
    18: 0.9,  // Drama
    53: 0.7,  // Thriller
    878: 0.6, // Sci-Fi
  },
  moodMappings: [
    {
      mood: 'excited',
      contentVector: new Float32Array(768).fill(0.6),
      strength: 0.8,
    },
  ],
  temporalPatterns: [
    {
      dayOfWeek: 5, // Friday
      hourOfDay: 20,
      preferredGenres: [28, 878], // Action, Sci-Fi
      avgWatchDuration: 7200, // 2 hours
    },
  ],
  updatedAt: new Date('2024-01-15T10:00:00Z'),
};

// Sample Watch Events
export const mockWatchContext: WatchContext = {
  dayOfWeek: 5,
  hourOfDay: 20,
  device: 'smart_tv',
  isGroupWatch: false,
};

export const mockWatchEvent: WatchEvent = {
  userId: 'user-123',
  contentId: 550,
  mediaType: 'movie',
  platformId: 'netflix',
  duration: 5400, // 90 minutes
  totalDuration: 7200, // 2 hours
  completionRate: 0.75,
  rating: 8,
  isRewatch: false,
  context: mockWatchContext,
  timestamp: new Date('2024-01-15T20:00:00Z'),
};

export const mockSuccessfulWatchEvent: WatchEvent = {
  ...mockWatchEvent,
  completionRate: 0.95,
  rating: 9,
};

export const mockAbandonedWatchEvent: WatchEvent = {
  ...mockWatchEvent,
  contentId: 1234,
  completionRate: 0.15,
  rating: undefined,
};

// Mock Embeddings
export function createMockEmbedding(seed: number = 0, dimensions: number = 768): Float32Array {
  const embedding = new Float32Array(dimensions);
  for (let i = 0; i < dimensions; i++) {
    embedding[i] = Math.sin(i + seed) * 0.5 + 0.5;
  }
  return embedding;
}

export function createNormalizedEmbedding(text: string, dimensions: number = 768): Float32Array {
  const embedding = new Float32Array(dimensions);

  // Generate from text
  for (let i = 0; i < text.length && i < dimensions; i++) {
    embedding[i] = text.charCodeAt(i) / 255;
  }

  // Normalize
  let magnitude = 0;
  for (let i = 0; i < embedding.length; i++) {
    magnitude += embedding[i]! * embedding[i]!;
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = embedding[i]! / magnitude;
    }
  }

  return embedding;
}

// Mock OpenAI API Response
export const mockOpenAIEmbeddingResponse = {
  object: 'list',
  data: [
    {
      object: 'embedding',
      embedding: Array.from(createMockEmbedding(42, 768)),
      index: 0,
    },
  ],
  model: 'text-embedding-3-small',
  usage: {
    prompt_tokens: 8,
    total_tokens: 8,
  },
};

// Mock Vertex AI Response
export const mockVertexAIEmbeddingResponse = {
  predictions: [
    {
      embeddings: {
        values: Array.from(createMockEmbedding(42, 768)),
      },
    },
  ],
};

# @media-gateway/providers

Streaming provider adapters for cross-platform content matching and availability.

## Installation

```bash
pnpm add @media-gateway/providers
```

## Supported Platforms

- Netflix
- Amazon Prime Video
- Disney+
- Max (HBO)
- Hulu
- Apple TV+
- Peacock
- Paramount+
- Apple iTunes
- Google Play
- Amazon Video

## Usage

### TMDB Adapter

```typescript
import { createTMDBAdapter } from '@media-gateway/providers';

const tmdb = createTMDBAdapter({ apiKey: process.env.TMDB_API_KEY });

// Search
const movies = await tmdb.searchMovies('inception');

// Trending
const trending = await tmdb.getTrending('movie', 'week');

// Discover with filters
const scifi = await tmdb.discoverMovies({
  genres: [878],
  yearMin: 2020,
  ratingMin: 7
});
```

### Availability Service

```typescript
import { createAvailabilityService } from '@media-gateway/providers';

const availability = createAvailabilityService({
  tmdbApiKey: process.env.TMDB_API_KEY
});

// Check where content is streaming
const platforms = await availability.getAvailability(content, 'US');

// Find best platform for user
const best = await availability.findBestPlatform(
  content,
  userSubscriptions, // ['netflix', 'prime']
  'US'
);
```

## Environment Variables

```bash
TMDB_API_KEY=your-tmdb-api-key
```

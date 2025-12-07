/**
 * Media Gateway Demo Script
 * Demonstrates end-to-end functionality with real TMDB API
 */

import 'dotenv/config';
import { createTMDBAdapter, createAvailabilityService } from '@media-gateway/providers';

async function main() {
  console.log('🎬 Media Gateway Demo\n');
  console.log('='.repeat(50));

  // Check for API key
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.error('❌ TMDB_API_KEY not found in environment');
    process.exit(1);
  }

  console.log('✅ TMDB API key found\n');

  // Initialize services
  const tmdb = createTMDBAdapter({ apiKey });
  const availability = createAvailabilityService({ tmdbApiKey: apiKey });

  // 1. Test Search
  console.log('📍 Testing Search...');
  console.log('-'.repeat(50));

  const searchResults = await tmdb.searchMovies('inception');
  console.log(`Found ${searchResults.length} results for "inception"`);
  if (searchResults[0]) {
    console.log(`Top result: ${searchResults[0].title} (${searchResults[0].releaseDate})`);
    console.log(`Rating: ${searchResults[0].voteAverage}/10`);
  }

  // 2. Test Trending
  console.log('\n📍 Testing Trending...');
  console.log('-'.repeat(50));

  const trending = await tmdb.getTrending('movie', 'week');
  console.log(`Found ${trending.length} trending movies`);
  trending.slice(0, 3).forEach((movie, i) => {
    console.log(`${i + 1}. ${movie.title} (${movie.voteAverage}/10)`);
  });

  // 3. Test Availability
  console.log('\n📍 Testing Availability...');
  console.log('-'.repeat(50));

  if (searchResults[0]) {
    const availData = await availability.getAvailability(searchResults[0], 'US');
    console.log(`Availability for "${searchResults[0].title}":`);
    console.log(`Source: ${availData.source}`);
    console.log(`Platforms: ${availData.platforms.map(p => p.platformName).join(', ') || 'None found'}`);
  }

  // 4. Test Discover with filters
  console.log('\n📍 Testing Discover with Filters...');
  console.log('-'.repeat(50));

  const sciFiMovies = await tmdb.discoverMovies({
    genres: [878], // Sci-Fi
    yearMin: 2020,
    ratingMin: 7,
  });
  console.log(`Found ${sciFiMovies.length} sci-fi movies from 2020+ with 7+ rating`);
  sciFiMovies.slice(0, 3).forEach((movie, i) => {
    console.log(`${i + 1}. ${movie.title} (${movie.releaseDate}) - ${movie.voteAverage}/10`);
  });

  console.log('\n' + '='.repeat(50));
  console.log('✅ Demo completed successfully!');
}

main().catch(console.error);

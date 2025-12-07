# Media Gateway Demo Scripts

## demo.ts

Demonstrates the Media Gateway functionality with real TMDB API integration.

### Prerequisites

1. **TMDB API Key**: Get your free API key from [The Movie Database](https://www.themoviedb.org/settings/api)
2. **Environment Setup**: Add your API key to `.env` in the project root:

```bash
TMDB_API_KEY=your_api_key_here
```

### Usage

Run the demo script:

```bash
pnpm demo
```

Or using tsx directly:

```bash
tsx scripts/demo.ts
```

### What It Tests

The demo script tests the following Media Gateway features:

1. **Search Functionality**: Searches for "inception" movies
2. **Trending Content**: Retrieves weekly trending movies
3. **Availability Checking**: Checks where content is available to stream
4. **Discover with Filters**: Finds sci-fi movies from 2020+ with 7+ rating

### Expected Output

```
🎬 Media Gateway Demo

==================================================
✅ TMDB API key found

📍 Testing Search...
--------------------------------------------------
Found X results for "inception"
Top result: Inception (2010-07-16)
Rating: 8.4/10

📍 Testing Trending...
--------------------------------------------------
Found X trending movies
1. Movie Name (8.5/10)
2. Movie Name (8.2/10)
3. Movie Name (8.1/10)

📍 Testing Availability...
--------------------------------------------------
Availability for "Inception":
Source: tmdb
Platforms: Netflix, Amazon Prime Video, ...

📍 Testing Discover with Filters...
--------------------------------------------------
Found X sci-fi movies from 2020+ with 7+ rating
1. Dune (2021-09-15) - 7.8/10
2. The Matrix Resurrections (2021-12-22) - 6.8/10
3. Tenet (2020-08-26) - 7.2/10

==================================================
✅ Demo completed successfully!
```

### Troubleshooting

**Error: TMDB_API_KEY not found in environment**
- Ensure you have created a `.env` file in the project root
- Verify the API key is correctly set in the `.env` file
- The key should be: `TMDB_API_KEY=your_api_key_here` (no quotes)

**Import errors**
- Run `pnpm build` to build all packages
- Ensure all dependencies are installed: `pnpm install`

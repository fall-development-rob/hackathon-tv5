# AI Media Discovery - Search Interface

## Purpose
Natural language search for movies and TV shows across all streaming platforms.

## Capabilities
- Semantic search understanding mood, themes, and preferences
- Filter by genre, year, rating, and media type
- Cross-platform availability checking
- Personalized results based on user history

## API Endpoint
POST /api/search

## Request Schema
```json
{
  "query": "string - natural language search query",
  "filters": {
    "mediaType": "movie | tv | all",
    "ratingMin": "number 0-10",
    "genres": "array of genre IDs",
    "yearMin": "number",
    "yearMax": "number"
  },
  "explain": "boolean - include AI explanations"
}
```

## Example Queries
- "exciting sci-fi movies like Inception"
- "heartwarming comedy for family movie night"
- "dark thriller with plot twists"
- "something to watch when I feel adventurous"
- "critically acclaimed dramas from the 2010s"

## Response Format
Returns array of MediaContent with:
- id, title, overview, mediaType
- voteAverage, voteCount, releaseDate
- genreIds, posterPath, backdropPath
- availability (which platforms have it)
- explanation (if requested)

## Rate Limits
- Authenticated: 1000/minute
- Unauthenticated: 100/minute

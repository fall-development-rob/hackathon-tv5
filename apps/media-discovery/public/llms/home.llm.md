# AI Media Discovery - Homepage

## Site Overview
AI-powered media discovery platform solving the 45-minute decision problem.
Find what to watch across Netflix, Prime, Disney+, HBO Max, Hulu, Apple TV+, Peacock, and Paramount+.

## Key Features
1. **Semantic Search** - Natural language queries understand mood and context
2. **Personalized Recommendations** - Learns your preferences over time
3. **Group Watch** - Find content everyone will enjoy
4. **Cross-Platform Availability** - See where content is streaming

## Available Actions

### 1. Search (POST /api/search)
Find content using natural language.
Example: "exciting movies like The Matrix"

### 2. Recommendations (POST /api/recommendations)
Get personalized suggestions based on preferences.

### 3. Discover (GET /api/discover)
Browse trending and popular content.

### 4. Availability (GET /api/availability/:id)
Check which platforms have specific content.

## Navigation
- /search - Natural language search interface
- /discover - Browse by category and genre
- /movie/[id] - Movie details and availability
- /tv/[id] - TV show details and availability

## For AI Agents
This site implements ARW (Agent-Ready Web) specification.
- Manifest: /.well-known/arw-manifest.json
- Machine views: /llms/*.llm.md
- All endpoints return structured JSON
- Rate limits: 1000 req/min authenticated

## Attribution
Powered by TMDB for content metadata.

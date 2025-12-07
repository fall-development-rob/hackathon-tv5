# AI Media Discovery - Browse Interface

## Purpose
Browse trending, popular, and curated content collections.

## Capabilities
- Trending content (daily/weekly)
- Popular movies and TV shows
- Genre-based discovery
- Personalized recommendations

## API Endpoint
GET /api/discover

## Query Parameters
- category: trending | popular | discover (default: trending)
- type: movie | tv | all (default: all)
- genres: comma-separated genre IDs
- page: pagination (default: 1)

## Available Genres
| ID | Genre |
|----|-------|
| 28 | Action |
| 12 | Adventure |
| 16 | Animation |
| 35 | Comedy |
| 80 | Crime |
| 99 | Documentary |
| 18 | Drama |
| 10751 | Family |
| 14 | Fantasy |
| 36 | History |
| 27 | Horror |
| 10402 | Music |
| 9648 | Mystery |
| 10749 | Romance |
| 878 | Science Fiction |
| 53 | Thriller |
| 10752 | War |
| 37 | Western |

## Example Requests
- GET /api/discover?category=trending&type=movie
- GET /api/discover?category=popular&genres=28,878
- GET /api/discover?category=discover&type=tv&page=2

## Response Format
Returns paginated array of MediaContent with availability info.

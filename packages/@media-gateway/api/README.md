# @media-gateway/api

REST API server for ARW (Adaptive Recommendation Workflow) compliance per SPARC FR-4.1.

## Features

- ✅ RESTful API design with Express.js
- ✅ OpenAPI/Swagger documentation
- ✅ Request validation with Zod
- ✅ Rate limiting middleware
- ✅ Comprehensive error handling
- ✅ CORS and security headers
- ✅ TypeScript support
- ✅ Ready for SwarmCoordinator integration

## API Endpoints

### Search
- `GET /v1/search` - Natural language content search with filters

### Recommendations
- `GET /v1/recommendations` - Personalized content recommendations

### Content
- `GET /v1/content/:id` - Content metadata and details

### Availability
- `GET /v1/availability/:contentId` - Platform availability with deep links

### User Activity
- `POST /v1/watch-history` - Log viewing activity
- `POST /v1/ratings` - Submit user ratings and reviews

### System
- `GET /v1/health` - Health check endpoint
- `GET /v1/docs` - Interactive API documentation

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Run Production

```bash
npm start
```

## Testing

```bash
npm test
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
```

## API Documentation

Interactive API documentation is available at:
- Development: http://localhost:3000/v1/docs
- OpenAPI JSON: http://localhost:3000/v1/openapi.json

## Architecture

```
src/
├── routes/           # API route handlers
├── middleware/       # Express middleware
├── schemas/          # Zod validation schemas
├── utils/            # Utility functions
└── server.ts         # Main server file
```

## REST Conventions

- JSON request/response bodies
- Standard HTTP status codes
- Pagination with limit/offset
- Error format: `{ error, code, details? }`
- Rate limiting per endpoint type

## Rate Limits

- General API: 100 requests per 15 minutes
- Search: 20 requests per minute
- Write operations: 50 requests per 5 minutes

## Next Steps

- [ ] Integrate SwarmCoordinator for intelligent search
- [ ] Add database layer (PostgreSQL)
- [ ] Implement caching (Redis)
- [ ] Add authentication/authorization
- [ ] Connect to external APIs (TMDB, JustWatch)
- [ ] Add comprehensive test suite
- [ ] Set up CI/CD pipeline

## License

MIT

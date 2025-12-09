import { Router } from 'express';
import type { Router as IRouter } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateQuery } from '../middleware/validation';
import { searchRateLimit } from '../middleware/rateLimit';
import { SearchQuerySchema } from '../schemas';

const router: IRouter = Router();

/**
 * Typed query parameters for search endpoint
 */
interface SearchQueryParams {
  q: string;
  mediaType?: string;
  genre?: string;
  year?: number;
  rating?: number;
  limit?: number;
  offset?: number;
}

/**
 * @openapi
 * /v1/search:
 *   get:
 *     summary: Natural language content search
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (natural language)
 *       - in: query
 *         name: mediaType
 *         schema:
 *           type: string
 *           enum: [movie, series, documentary, sports, all]
 *         description: Filter by media type
 *       - in: query
 *         name: genre
 *         schema:
 *           type: string
 *         description: Filter by genre
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Filter by release year
 *       - in: query
 *         name: rating
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 10
 *         description: Minimum rating
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Results per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: Search results with availability
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     limit: { type: integer }
 *                     offset: { type: integer }
 *                     hasMore: { type: boolean }
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 */
router.get(
  '/',
  searchRateLimit,
  validateQuery(SearchQuerySchema),
  asyncHandler(async (req, res) => {
    const { q, mediaType, genre, year, rating, limit, offset } = req.query as unknown as SearchQueryParams;

    // TODO: Integrate with SwarmCoordinator for intelligent search
    // This is a placeholder implementation
    const results = [
      {
        id: 'content-1',
        title: 'Example Movie',
        mediaType: 'movie',
        year: 2024,
        genre: ['Action', 'Thriller'],
        rating: 8.5,
        description: 'An example movie matching your search',
        availability: [
          {
            platform: 'Netflix',
            region: 'US',
            type: 'subscription',
            deepLink: 'https://netflix.com/watch/...',
          },
        ],
      },
    ];

    res.json({
      results,
      pagination: {
        total: 1,
        limit,
        offset,
        hasMore: false,
      },
      query: {
        q,
        filters: { mediaType, genre, year, rating },
      },
    });
  })
);

export default router;

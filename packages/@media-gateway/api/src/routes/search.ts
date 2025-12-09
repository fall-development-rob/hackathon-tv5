import { Router } from "express";
import type { Router as IRouter } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { validateQuery } from "../middleware/validation";
import { searchRateLimit } from "../middleware/rateLimit";
import { SearchQuerySchema } from "../schemas";
import { getMediaGatewayService } from "../services/MediaGatewayService";

const router: IRouter = Router();

/**
 * Typed query parameters for search endpoint
 */
interface SearchQueryParams {
  q: string;
  mediaType?: "movie" | "tv" | "all";
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
  "/",
  searchRateLimit,
  validateQuery(SearchQuerySchema),
  asyncHandler(async (req, res) => {
    const {
      q,
      mediaType,
      genre,
      year,
      rating,
      limit = 20,
      offset = 0,
    } = req.query as unknown as SearchQueryParams;

    // Use MediaGatewayService for search (integrates TMDB, RuVector, etc.)
    const service = getMediaGatewayService();
    const { results, pagination, source } = await service.search(q, {
      mediaType: mediaType as "movie" | "tv" | "all",
      genre,
      year,
      rating,
      limit,
      offset,
    });

    // Transform results to API response format
    const transformedResults = results.map((item) => ({
      id: `${item.mediaType}-${item.id}`,
      title: item.title,
      mediaType: item.mediaType,
      year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : null,
      genre: item.genreIds?.map((id) => getGenreName(id)) || [],
      rating: item.voteAverage,
      description: item.overview,
      posterPath: item.posterPath,
      popularity: item.popularity,
    }));

    // Get availability for each result
    const resultsWithAvailability = await Promise.all(
      transformedResults.map(async (item) => {
        const availability = await service.getAvailability(item.id);
        return {
          ...item,
          availability: availability.platforms.map((p) => ({
            platform: p.platform,
            region: availability.region,
            type: p.type,
            price: p.price,
            deepLink: p.deepLink,
          })),
        };
      }),
    );

    res.json({
      results: resultsWithAvailability,
      pagination,
      query: {
        q,
        filters: { mediaType, genre, year, rating },
      },
      meta: {
        source, // 'tmdb' or 'fallback'
        serviceStatus: service.getStatus(),
      },
    });
  }),
);

/**
 * Genre ID to name mapping (TMDB)
 */
function getGenreName(id: number): string {
  const genres: Record<number, string> = {
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    878: "Sci-Fi",
    53: "Thriller",
    10752: "War",
    37: "Western",
  };
  return genres[id] || "Unknown";
}

export default router;

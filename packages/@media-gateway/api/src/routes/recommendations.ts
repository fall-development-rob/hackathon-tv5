import { Router } from "express";
import type { Router as IRouter } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { validateQuery } from "../middleware/validation";
import { RecommendationsQuerySchema } from "../schemas";
import { getMediaGatewayService } from "../services/MediaGatewayService";

const router: IRouter = Router();

/**
 * Typed query parameters for recommendations endpoint
 */
interface RecommendationsQueryParams {
  userId: string;
  mood?: string;
  context?: string;
  limit?: number;
}

/**
 * Genre ID to name mapping
 */
const GENRE_NAMES: Record<number, string> = {
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

/**
 * @openapi
 * /v1/recommendations:
 *   get:
 *     summary: Get personalized content recommendations
 *     tags: [Recommendations]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User identifier
 *       - in: query
 *         name: mood
 *         schema:
 *           type: string
 *           enum: [relaxed, excited, thoughtful, social, adventurous]
 *         description: User's current mood
 *       - in: query
 *         name: context
 *         schema:
 *           type: string
 *           enum: [solo, family, date, party, background]
 *         description: Viewing context
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of recommendations
 *     responses:
 *       200:
 *         description: Personalized recommendations with reasoning
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recommendations:
 *                   type: array
 *                   items:
 *                     type: object
 *                 metadata:
 *                   type: object
 *       400:
 *         description: Validation error
 */
router.get(
  "/",
  validateQuery(RecommendationsQuerySchema),
  asyncHandler(async (req, res) => {
    const {
      userId,
      mood,
      context,
      limit = 10,
    } = req.query as unknown as RecommendationsQueryParams;

    // Use MediaGatewayService for recommendations (integrates TMDB, HybridEngine, etc.)
    const service = getMediaGatewayService();
    const { recommendations, source } = await service.getRecommendations({
      userId,
      mood,
      context,
      limit,
    });

    // Transform to API response format
    const transformedRecommendations = await Promise.all(
      recommendations.map(async (item) => {
        const availability = await service.getAvailability(
          `${item.mediaType}-${item.id}`,
        );
        return {
          id: `${item.mediaType}-${item.id}`,
          title: item.title,
          mediaType: item.mediaType,
          year: item.releaseDate
            ? new Date(item.releaseDate).getFullYear()
            : null,
          genre: item.genreIds?.map((id) => GENRE_NAMES[id] || "Unknown") || [],
          rating: item.voteAverage,
          posterPath: item.posterPath,
          description: item.overview,
          matchScore: item.matchScore,
          reasoning: item.reasoning,
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
      recommendations: transformedRecommendations,
      metadata: {
        userId,
        mood,
        context,
        generatedAt: new Date().toISOString(),
        algorithm: source === "tmdb" ? "tmdb-trending-v1" : "hybrid-rrf-v2",
        source,
        serviceStatus: service.getStatus(),
      },
    });
  }),
);

export default router;

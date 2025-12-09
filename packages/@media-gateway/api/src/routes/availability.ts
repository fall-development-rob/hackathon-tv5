import { Router } from "express";
import type { Router as IRouter } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { validateParams, validateQuery } from "../middleware/validation";
import { AvailabilityQuerySchema } from "../schemas";
import { z } from "zod";
import { getMediaGatewayService } from "../services/MediaGatewayService";

const router: IRouter = Router();

/**
 * Typed query parameters for availability endpoint
 */
interface AvailabilityQueryParams {
  region?: string;
}

/**
 * @openapi
 * /v1/availability/{contentId}:
 *   get:
 *     summary: Get platform availability for content
 *     tags: [Availability]
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Content identifier
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *           default: US
 *         description: 2-letter country code
 *     responses:
 *       200:
 *         description: List of platforms with deep links and pricing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 contentId: { type: string }
 *                 region: { type: string }
 *                 platforms:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       platform: { type: string }
 *                       type: { type: string }
 *                       deepLink: { type: string }
 *                       price: { type: object }
 *       404:
 *         description: Content not found
 */
router.get(
  "/:contentId",
  validateParams(z.object({ contentId: z.string().min(1) })),
  validateQuery(AvailabilityQuerySchema),
  asyncHandler(async (req, res) => {
    const { contentId } = req.params;
    const { region = "US" } = req.query as AvailabilityQueryParams;

    // Use MediaGatewayService for availability (integrates TMDB watch providers)
    const service = getMediaGatewayService();
    const availability = await service.getAvailability(contentId, region);

    // Enrich platforms with additional data
    const enrichedPlatforms = availability.platforms.map((p) => ({
      platform: p.platform,
      platformId: p.platform.toLowerCase().replace(/\s+/g, "-"),
      type: p.type,
      deepLink: p.deepLink || generateDeepLink(p.platform, contentId),
      price: p.price
        ? {
            amount: p.price.amount,
            currency: p.price.currency,
            ...(p.type === "rent" ? { rentalPeriod: "48 hours" } : {}),
          }
        : null,
      quality: getQualityOptions(p.platform),
      available: true,
      availableUntil: null,
    }));

    res.json({
      contentId: availability.contentId,
      region: availability.region,
      platforms: enrichedPlatforms,
      lastUpdated: new Date().toISOString(),
      metadata: {
        totalPlatforms: enrichedPlatforms.length,
        subscriptionOptions: enrichedPlatforms.filter(
          (p) => p.type === "subscription",
        ).length,
        rentOptions: enrichedPlatforms.filter((p) => p.type === "rent").length,
        buyOptions: enrichedPlatforms.filter((p) => p.type === "buy").length,
        freeOptions: enrichedPlatforms.filter((p) => p.type === "free").length,
        serviceStatus: service.getStatus(),
      },
    });
  }),
);

/**
 * Generate deep link for platform
 */
function generateDeepLink(platform: string, contentId: string): string {
  const platformLinks: Record<string, string> = {
    Netflix: `https://netflix.com/watch/${contentId}`,
    "Amazon Prime Video": `https://amazon.com/gp/video/detail/${contentId}`,
    "Disney+": `https://disneyplus.com/movies/${contentId}`,
    "Apple TV": `https://tv.apple.com/movie/${contentId}`,
    Hulu: `https://hulu.com/watch/${contentId}`,
    "HBO Max": `https://max.com/movies/${contentId}`,
    "Paramount+": `https://paramountplus.com/movies/${contentId}`,
    Peacock: `https://peacocktv.com/watch/${contentId}`,
  };
  return (
    platformLinks[platform] ||
    `https://streaming.example.com/watch/${contentId}`
  );
}

/**
 * Get quality options for platform
 */
function getQualityOptions(platform: string): string[] {
  const qualityMap: Record<string, string[]> = {
    Netflix: ["HD", "4K", "HDR", "Dolby Atmos"],
    "Amazon Prime Video": ["HD", "4K", "HDR10+"],
    "Disney+": ["HD", "4K", "IMAX Enhanced", "Dolby Vision"],
    "Apple TV": ["HD", "4K", "Dolby Vision", "Dolby Atmos"],
    "HBO Max": ["HD", "4K", "Dolby Vision"],
    Hulu: ["HD", "4K"],
    "Paramount+": ["HD", "4K", "Dolby Vision"],
    Peacock: ["HD", "4K"],
  };
  return qualityMap[platform] || ["HD"];
}

export default router;

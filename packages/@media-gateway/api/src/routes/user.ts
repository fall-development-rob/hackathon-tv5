import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validation';
import { writeRateLimit } from '../middleware/rateLimit';
import { WatchHistorySchema, RatingSchema } from '../schemas';

const router = Router();

/**
 * @openapi
 * /v1/watch-history:
 *   post:
 *     summary: Log user viewing activity
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, contentId, watchedSeconds, completionRate]
 *             properties:
 *               userId: { type: string }
 *               contentId: { type: string }
 *               watchedSeconds: { type: integer, minimum: 0 }
 *               completionRate: { type: number, minimum: 0, maximum: 1 }
 *               timestamp: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Watch history recorded, preferences updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 watchHistoryId: { type: string }
 *                 preferencesUpdated: { type: boolean }
 *       400:
 *         description: Validation error
 */
router.post(
  '/watch-history',
  writeRateLimit,
  validateBody(WatchHistorySchema),
  asyncHandler(async (req, res) => {
    const { userId, contentId, watchedSeconds, completionRate, timestamp } = req.body;

    // TODO: Integrate with SwarmCoordinator to update user preferences
    const watchHistoryId = `wh-${Date.now()}-${userId}`;

    // Simulate preference update based on completion rate
    const preferencesUpdated = completionRate > 0.7; // Update preferences if >70% watched

    res.status(201).json({
      success: true,
      watchHistoryId,
      preferencesUpdated,
      message: preferencesUpdated
        ? 'Watch history recorded and preferences updated'
        : 'Watch history recorded',
      data: {
        userId,
        contentId,
        watchedSeconds,
        completionRate,
        timestamp: timestamp || new Date().toISOString(),
      },
    });
  })
);

/**
 * @openapi
 * /v1/ratings:
 *   post:
 *     summary: Submit user feedback and rating
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, contentId, rating]
 *             properties:
 *               userId: { type: string }
 *               contentId: { type: string }
 *               rating: { type: number, minimum: 0, maximum: 10 }
 *               review: { type: string, maxLength: 1000 }
 *               timestamp: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Rating submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 ratingId: { type: string }
 *       400:
 *         description: Validation error
 */
router.post(
  '/ratings',
  writeRateLimit,
  validateBody(RatingSchema),
  asyncHandler(async (req, res) => {
    const { userId, contentId, rating, review, timestamp } = req.body;

    // TODO: Integrate with SwarmCoordinator to update recommendations
    const ratingId = `rating-${Date.now()}-${userId}`;

    res.status(201).json({
      success: true,
      ratingId,
      message: 'Rating submitted successfully',
      data: {
        userId,
        contentId,
        rating,
        review: review || null,
        timestamp: timestamp || new Date().toISOString(),
      },
    });
  })
);

export default router;

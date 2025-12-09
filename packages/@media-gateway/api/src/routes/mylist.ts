import { Router } from "express";
import type { Router as IRouter } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { validateBody, validateParams } from "../middleware/validation";
import { writeRateLimit } from "../middleware/rateLimit";
import { authenticateToken } from "../middleware/auth";
import { AddToMyListSchema, MyListContentIdSchema } from "../schemas";
import { getMyListService } from "../services/MyListService";
import { ApiError } from "../middleware/errorHandler";

const router: IRouter = Router();

/**
 * @openapi
 * /v1/my-list:
 *   get:
 *     summary: Get user's My List
 *     tags: [My List]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       userId: { type: string }
 *                       contentId: { type: string }
 *                       title: { type: string }
 *                       mediaType: { type: string, enum: [movie, tv] }
 *                       posterPath: { type: string, nullable: true }
 *                       addedAt: { type: string, format: date-time }
 *                 total: { type: number }
 *       401:
 *         description: Unauthorized - authentication required
 */
router.get(
  "/",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const service = getMyListService();

    const items = await service.getUserList(userId);

    res.json({
      items,
      total: items.length,
    });
  }),
);

/**
 * @openapi
 * /v1/my-list:
 *   post:
 *     summary: Add item to My List
 *     tags: [My List]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contentId, title, mediaType]
 *             properties:
 *               contentId: { type: string }
 *               title: { type: string }
 *               mediaType: { type: string, enum: [movie, tv] }
 *               posterPath: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Item added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 item:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     userId: { type: string }
 *                     contentId: { type: string }
 *                     title: { type: string }
 *                     mediaType: { type: string, enum: [movie, tv] }
 *                     posterPath: { type: string, nullable: true }
 *                     addedAt: { type: string, format: date-time }
 *       400:
 *         description: Validation error or list full
 *       401:
 *         description: Unauthorized - authentication required
 */
router.post(
  "/",
  authenticateToken,
  writeRateLimit,
  validateBody(AddToMyListSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const { contentId, title, mediaType, posterPath } = req.body;
    const service = getMyListService();

    try {
      const item = await service.addItem(userId, {
        contentId,
        title,
        mediaType,
        posterPath: posterPath || null,
      });

      res.status(201).json({
        success: true,
        item,
        message: "Item added to My List",
      });
    } catch (error: any) {
      if (error.message.includes("My List is full")) {
        throw new ApiError(400, "LIST_FULL", error.message);
      }
      throw error;
    }
  }),
);

/**
 * @openapi
 * /v1/my-list/{contentId}:
 *   delete:
 *     summary: Remove item from My List
 *     tags: [My List]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Content identifier to remove
 *     responses:
 *       200:
 *         description: Item removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *       404:
 *         description: Item not found in list
 *       401:
 *         description: Unauthorized - authentication required
 */
router.delete(
  "/:contentId",
  authenticateToken,
  writeRateLimit,
  validateParams(MyListContentIdSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const { contentId } = req.params;
    const service = getMyListService();

    const removed = await service.removeItem(userId, contentId);

    if (!removed) {
      throw new ApiError(404, "NOT_FOUND", "Item not found in My List");
    }

    res.json({
      success: true,
      message: "Item removed from My List",
    });
  }),
);

/**
 * @openapi
 * /v1/my-list/check/{contentId}:
 *   get:
 *     summary: Check if item is in My List
 *     tags: [My List]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Content identifier to check
 *     responses:
 *       200:
 *         description: Check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 inList: { type: boolean }
 *                 contentId: { type: string }
 *       401:
 *         description: Unauthorized - authentication required
 */
router.get(
  "/check/:contentId",
  authenticateToken,
  validateParams(MyListContentIdSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    const { contentId } = req.params;
    const service = getMyListService();

    const inList = await service.isInList(userId, contentId);

    res.json({
      inList,
      contentId,
    });
  }),
);

export default router;

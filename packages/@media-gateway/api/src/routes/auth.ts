import { Router } from "express";
import type { Router as IRouter } from "express";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { validateBody } from "../middleware/validation";
import { authenticateToken, generateToken } from "../middleware/auth";
import { RegisterSchema, LoginSchema } from "../schemas";
import { getService } from "../services/UserService";

const router: IRouter = Router();

/**
 * @openapi
 * /v1/auth/register:
 *   post:
 *     summary: Register a new user account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *                 example: john.doe@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: User password (min 8 characters)
 *                 example: SecurePass123!
 *               name:
 *                 type: string
 *                 description: User full name
 *                 example: John Doe
 *     responses:
 *       201:
 *         description: User successfully registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: 550e8400-e29b-41d4-a716-446655440000
 *                     email:
 *                       type: string
 *                       example: john.doe@example.com
 *                     name:
 *                       type: string
 *                       example: John Doe
 *                 token:
 *                   type: string
 *                   description: JWT authentication token (expires in 7 days)
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already registered
 */
router.post(
  "/register",
  validateBody(RegisterSchema),
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;

    const userService = getService();

    try {
      // Create user with UserService
      const user = await userService.createUser(email, password, name);

      // Generate JWT token (7 days expiration)
      const token = generateToken(
        { userId: user.id, email: user.email, name: user.name },
        "7d",
      );

      res.status(201).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        token,
      });
    } catch (error: any) {
      // Handle duplicate email error
      if (error.message === "Email already exists") {
        throw new ApiError(409, "DUPLICATE_EMAIL", "Email already registered");
      }
      // Re-throw other errors
      throw error;
    }
  }),
);

/**
 * @openapi
 * /v1/auth/login:
 *   post:
 *     summary: Authenticate user and get token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email address
 *                 example: john.doe@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User password
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                 token:
 *                   type: string
 *                   description: JWT authentication token (expires in 7 days)
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid credentials
 */
router.post(
  "/login",
  validateBody(LoginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const userService = getService();

    // Find user by email
    const user = await userService.findByEmail(email);

    if (!user) {
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password",
      );
    }

    // Validate password
    const isValidPassword = await userService.validatePassword(user, password);

    if (!isValidPassword) {
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password",
      );
    }

    // Generate JWT token (7 days expiration)
    const token = generateToken(
      { userId: user.id, email: user.email, name: user.name },
      "7d",
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  }),
);

/**
 * @openapi
 * /v1/auth/logout:
 *   post:
 *     summary: Logout user (stateless - client should discard token)
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logout acknowledged
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logout successful. Please discard your token.
 */
router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    // Stateless JWT - no server-side session to destroy
    // Client should discard the token
    res.json({
      success: true,
      message: "Logout successful. Please discard your token.",
    });
  }),
);

/**
 * @openapi
 * /v1/auth/me:
 *   get:
 *     summary: Get current authenticated user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *         description: Bearer token
 *         example: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: User profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Token expired
 */
router.get(
  "/me",
  authenticateToken,
  asyncHandler(async (req, res) => {
    // User info is attached by authenticateToken middleware
    const userId = req.user?.userId;

    if (!userId) {
      throw new ApiError(401, "UNAUTHORIZED", "User not authenticated");
    }

    const userService = getService();

    // Fetch full user profile from database
    const user = await userService.findById(userId);

    if (!user) {
      throw new ApiError(404, "USER_NOT_FOUND", "User not found");
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    });
  }),
);

export default router;

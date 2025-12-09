import { z } from "zod";

// Common schemas
export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const CursorPaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

// Search schemas
export const SearchQuerySchema = z
  .object({
    q: z.string().min(1, "Query is required"),
    mediaType: z
      .enum(["movie", "series", "documentary", "sports", "all"])
      .optional(),
    genre: z.string().optional(),
    year: z.coerce
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear() + 5)
      .optional(),
    rating: z.coerce.number().min(0).max(10).optional(),
  })
  .merge(PaginationSchema);

// Recommendations schemas
export const RecommendationsQuerySchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  mood: z
    .enum(["relaxed", "excited", "thoughtful", "social", "adventurous"])
    .optional(),
  context: z.enum(["solo", "family", "date", "party", "background"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// Content schemas
export const ContentQuerySchema = z.object({
  include: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",") : [])),
});

export const ContentIdSchema = z.object({
  id: z.string().min(1, "Content ID is required"),
});

// Availability schemas
export const AvailabilityQuerySchema = z.object({
  region: z
    .string()
    .length(2, "Region must be a 2-letter country code")
    .default("US"),
});

// Watch history schemas
export const WatchHistorySchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  contentId: z.string().min(1, "Content ID is required"),
  watchedSeconds: z.number().int().min(0),
  completionRate: z.number().min(0).max(1),
  timestamp: z.string().datetime().optional(),
});

// Rating schemas
export const RatingSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  contentId: z.string().min(1, "Content ID is required"),
  rating: z.number().min(0).max(10),
  review: z.string().max(1000).optional(),
  timestamp: z.string().datetime().optional(),
});

// My List schemas
export const AddToMyListSchema = z.object({
  contentId: z.string().min(1, "Content ID is required"),
  title: z.string().min(1, "Title is required").max(500),
  mediaType: z.enum(["movie", "tv"], {
    errorMap: () => ({ message: 'Media type must be "movie" or "tv"' }),
  }),
  posterPath: z.string().nullable().optional(),
});

export const MyListContentIdSchema = z.object({
  contentId: z.string().min(1, "Content ID is required"),
});

// Authentication schemas
export const RegisterSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  name: z.string().min(1, "Name is required").max(255),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Response types
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type RecommendationsQuery = z.infer<typeof RecommendationsQuerySchema>;
export type ContentQuery = z.infer<typeof ContentQuerySchema>;
export type AvailabilityQuery = z.infer<typeof AvailabilityQuerySchema>;
export type WatchHistory = z.infer<typeof WatchHistorySchema>;
export type Rating = z.infer<typeof RatingSchema>;
export type AddToMyList = z.infer<typeof AddToMyListSchema>;
export type MyListContentId = z.infer<typeof MyListContentIdSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.any().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

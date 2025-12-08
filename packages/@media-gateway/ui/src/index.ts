/**
 * @media-gateway/ui
 * Shadcn-style UI component library for Media Gateway
 *
 * @example
 * import { Button, MediaCard, cn } from "@media-gateway/ui";
 *
 * // Using base UI components
 * <Button variant="primary" size="lg">Watch Now</Button>
 *
 * // Using media-specific components
 * <MediaCard media={movie} onPlay={handlePlay} />
 *
 * // Using the cn utility
 * <div className={cn("p-4", isActive && "bg-primary")} />
 */

// Utility functions
export { cn, formatDuration, formatRating, truncateText, getYear, getPlaceholderImage } from "./lib/utils.js";

// Types
export type {
  MediaType,
  MediaItem,
  Platform,
  WatchProvider,
  GenreAffinity,
  UserPreference,
  GroupMember,
  GroupSession,
} from "./types/index.js";

// Base UI Components
export {
  Button,
  buttonVariants,
  type ButtonProps,
} from "./components/ui/button.js";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./components/ui/card.js";

export {
  Input,
  type InputProps,
} from "./components/ui/input.js";

export {
  Badge,
  badgeVariants,
  type BadgeProps,
} from "./components/ui/badge.js";

export { Skeleton } from "./components/ui/skeleton.js";

// Media Components
export {
  MediaCard,
  MediaCardSkeleton,
  type MediaCardProps,
} from "./components/media/media-card.js";

export {
  MediaGrid,
  type MediaGridProps,
} from "./components/media/media-grid.js";

export {
  MediaCarousel,
  type MediaCarouselProps,
} from "./components/media/media-carousel.js";

export {
  RatingStars,
  type RatingStarsProps,
} from "./components/media/rating-stars.js";

export {
  ProgressBar,
  progressVariants,
  progressIndicatorVariants,
  type ProgressBarProps,
} from "./components/media/progress-bar.js";

export {
  PlatformBadge,
  PlatformList,
  platformBadgeVariants,
  type PlatformBadgeProps,
  type PlatformListProps,
} from "./components/media/platform-badge.js";

// Hooks
export {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  usePrefersDarkMode,
  usePrefersReducedMotion,
} from "./hooks/use-media-query.js";

export { useLocalStorage } from "./hooks/use-local-storage.js";

export { useDebounce, useDebouncedCallback } from "./hooks/use-debounce.js";

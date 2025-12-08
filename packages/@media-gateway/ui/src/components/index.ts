/**
 * Components Index
 * Re-exports all components from UI and Media
 */

// Base UI Components
export {
  Button,
  buttonVariants,
  type ButtonProps,
} from "./ui/button.js";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./ui/card.js";

export {
  Input,
  type InputProps,
} from "./ui/input.js";

export {
  Badge,
  badgeVariants,
  type BadgeProps,
} from "./ui/badge.js";

export { Skeleton } from "./ui/skeleton.js";

// Media Components
export {
  MediaCard,
  MediaCardSkeleton,
  type MediaCardProps,
} from "./media/media-card.js";

export {
  MediaGrid,
  type MediaGridProps,
} from "./media/media-grid.js";

export {
  MediaCarousel,
  type MediaCarouselProps,
} from "./media/media-carousel.js";

export {
  RatingStars,
  type RatingStarsProps,
} from "./media/rating-stars.js";

export {
  ProgressBar,
  progressVariants,
  progressIndicatorVariants,
  type ProgressBarProps,
} from "./media/progress-bar.js";

export {
  PlatformBadge,
  PlatformList,
  platformBadgeVariants,
  type PlatformBadgeProps,
  type PlatformListProps,
} from "./media/platform-badge.js";

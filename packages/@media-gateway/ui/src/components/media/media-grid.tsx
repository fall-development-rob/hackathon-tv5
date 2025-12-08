/**
 * MediaGrid Component
 * Responsive grid layout for displaying multiple media items
 */

import * as React from "react";
import { cn } from "../../lib/utils.js";
import { MediaCard, MediaCardSkeleton, type MediaCardProps } from "./media-card.js";
import type { MediaItem } from "../../types/index.js";

export interface MediaGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Array of media items to display */
  items: MediaItem[];
  /** Number of columns at different breakpoints */
  columns?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  /** Gap between items */
  gap?: "sm" | "md" | "lg";
  /** Card variant to use */
  cardVariant?: MediaCardProps["variant"];
  /** Whether to show play button on hover */
  showPlayButton?: boolean;
  /** Handler when a media item is clicked */
  onMediaClick?: (media: MediaItem) => void;
  /** Image base URL */
  imageBaseUrl?: string;
  /** Loading state - shows skeletons */
  loading?: boolean;
  /** Number of skeleton items to show when loading */
  skeletonCount?: number;
  /** Empty state message */
  emptyMessage?: string;
}

const gapClasses = {
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
};

const MediaGrid = React.forwardRef<HTMLDivElement, MediaGridProps>(
  (
    {
      className,
      items,
      columns = { default: 2, sm: 3, md: 4, lg: 5, xl: 6 },
      gap = "md",
      cardVariant = "default",
      showPlayButton = true,
      onMediaClick,
      imageBaseUrl,
      loading = false,
      skeletonCount = 12,
      emptyMessage = "No media items found",
      ...props
    },
    ref
  ) => {
    const gridColsClass = cn(
      columns.default && `grid-cols-${columns.default}`,
      columns.sm && `sm:grid-cols-${columns.sm}`,
      columns.md && `md:grid-cols-${columns.md}`,
      columns.lg && `lg:grid-cols-${columns.lg}`,
      columns.xl && `xl:grid-cols-${columns.xl}`
    );

    if (loading) {
      return (
        <div
          ref={ref}
          className={cn(
            "grid",
            "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
            gapClasses[gap],
            className
          )}
          {...props}
        >
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <MediaCardSkeleton key={index} variant={cardVariant} />
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div
          ref={ref}
          className={cn(
            "flex items-center justify-center p-8 text-muted-foreground",
            className
          )}
          {...props}
        >
          <p>{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "grid",
          "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
          gridColsClass,
          gapClasses[gap],
          className
        )}
        {...props}
      >
        {items.map((item) => (
          <MediaCard
            key={item.id}
            media={item}
            variant={cardVariant}
            showPlayButton={showPlayButton}
            onMediaClick={onMediaClick}
            imageBaseUrl={imageBaseUrl}
          />
        ))}
      </div>
    );
  }
);
MediaGrid.displayName = "MediaGrid";

export { MediaGrid };

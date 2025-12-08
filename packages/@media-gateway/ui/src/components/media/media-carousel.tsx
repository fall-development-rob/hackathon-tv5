/**
 * MediaCarousel Component
 * Horizontal scrolling carousel for media items
 */

import * as React from "react";
import { ChevronLeft, ChevronRight } from "../ui/icons.js";
import { cn } from "../../lib/utils.js";
import { Button } from "../ui/button.js";
import { MediaCard, MediaCardSkeleton, type MediaCardProps } from "./media-card.js";
import type { MediaItem } from "../../types/index.js";

export interface MediaCarouselProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Array of media items to display */
  items: MediaItem[];
  /** Title for the carousel section */
  title?: string;
  /** Subtitle or description */
  subtitle?: string;
  /** Card variant to use */
  cardVariant?: MediaCardProps["variant"];
  /** Show navigation arrows */
  showArrows?: boolean;
  /** Auto-scroll interval in ms (0 to disable) */
  autoScrollInterval?: number;
  /** Gap between items */
  gap?: "sm" | "md" | "lg";
  /** Handler when a media item is clicked */
  onMediaClick?: (media: MediaItem) => void;
  /** Image base URL */
  imageBaseUrl?: string;
  /** Loading state */
  loading?: boolean;
  /** Number of skeleton items */
  skeletonCount?: number;
  /** Action button slot (e.g., "View All") */
  action?: React.ReactNode;
}

const gapClasses = {
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
};

const MediaCarousel = React.forwardRef<HTMLDivElement, MediaCarouselProps>(
  (
    {
      className,
      items,
      title,
      subtitle,
      cardVariant = "default",
      showArrows = true,
      autoScrollInterval = 0,
      gap = "md",
      onMediaClick,
      imageBaseUrl,
      loading = false,
      skeletonCount = 6,
      action,
      ...props
    },
    ref
  ) => {
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = React.useState(false);
    const [canScrollRight, setCanScrollRight] = React.useState(true);

    const checkScrollButtons = React.useCallback(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(
        container.scrollLeft < container.scrollWidth - container.clientWidth - 1
      );
    }, []);

    React.useEffect(() => {
      checkScrollButtons();
      const container = scrollContainerRef.current;
      if (!container) return;

      container.addEventListener("scroll", checkScrollButtons);
      window.addEventListener("resize", checkScrollButtons);

      return () => {
        container.removeEventListener("scroll", checkScrollButtons);
        window.removeEventListener("resize", checkScrollButtons);
      };
    }, [checkScrollButtons, items]);

    React.useEffect(() => {
      if (autoScrollInterval <= 0) return;

      const interval = setInterval(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        if (
          container.scrollLeft >=
          container.scrollWidth - container.clientWidth - 1
        ) {
          container.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          container.scrollBy({ left: 300, behavior: "smooth" });
        }
      }, autoScrollInterval);

      return () => clearInterval(interval);
    }, [autoScrollInterval]);

    const scroll = (direction: "left" | "right") => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const scrollAmount = container.clientWidth * 0.8;
      container.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    };

    return (
      <div ref={ref} className={cn("relative", className)} {...props}>
        {(title || subtitle || action) && (
          <div className="flex items-center justify-between mb-4">
            <div>
              {title && <h2 className="text-xl font-semibold">{title}</h2>}
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
            {action}
          </div>
        )}

        <div className="relative group">
          {showArrows && canScrollLeft && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              onClick={() => scroll("left")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          <div
            ref={scrollContainerRef}
            className={cn(
              "flex overflow-x-auto scrollbar-hide scroll-smooth",
              gapClasses[gap],
              "pb-2"
            )}
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {loading
              ? Array.from({ length: skeletonCount }).map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex-shrink-0",
                      cardVariant === "detailed" ? "w-80" : "w-40"
                    )}
                  >
                    <MediaCardSkeleton variant={cardVariant} />
                  </div>
                ))
              : items.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex-shrink-0",
                      cardVariant === "detailed" ? "w-80" : "w-40"
                    )}
                  >
                    <MediaCard
                      media={item}
                      variant={cardVariant}
                      onMediaClick={onMediaClick}
                      imageBaseUrl={imageBaseUrl}
                    />
                  </div>
                ))}
          </div>

          {showArrows && canScrollRight && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              onClick={() => scroll("right")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }
);
MediaCarousel.displayName = "MediaCarousel";

export { MediaCarousel };

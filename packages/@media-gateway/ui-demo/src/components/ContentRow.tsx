import React, { useRef, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronRight as ArrowRight,
} from "lucide-react";
import { ContentCard } from "./ContentCard";

interface ContentRowItem {
  id: string;
  title: string;
  posterPath: string | null;
  rating: number;
  year?: number;
  mediaType: "movie" | "tv";
  runtime?: number;
  genres?: string[];
  matchScore?: number;
  isInList?: boolean;
}

interface ContentRowProps {
  title: string;
  subtitle?: string;
  items: ContentRowItem[];
  onItemClick?: (item: ContentRowItem) => void;
  onAddToList?: (item: ContentRowItem) => void;
  onSeeAll?: () => void;
  imageBaseUrl?: string;
  showRanking?: boolean;
  seeAllText?: string;
  emptyStateText?: string;
}

export const ContentRow: React.FC<ContentRowProps> = ({
  title,
  subtitle,
  items,
  onItemClick,
  onAddToList,
  onSeeAll,
  imageBaseUrl,
  showRanking = false,
  seeAllText = "See All",
  emptyStateText = "No content available",
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Update scroll button visibility
  const updateScrollButtons = () => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 1,
    );
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateScrollButtons();
    container.addEventListener("scroll", updateScrollButtons);
    window.addEventListener("resize", updateScrollButtons);

    return () => {
      container.removeEventListener("scroll", updateScrollButtons);
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, [items]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollAmount = container.clientWidth * 0.8; // Scroll 80% of visible width

    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isFocused) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      scroll("left");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      scroll("right");
    }
  };

  // Empty state
  if (!items || items.length === 0) {
    return (
      <section className="py-8">
        <div className="mb-4 flex items-baseline justify-between px-4 md:px-8">
          <h2 className="text-xl font-bold text-white md:text-2xl">{title}</h2>
          {subtitle && (
            <span className="text-sm text-gray-400">{subtitle}</span>
          )}
        </div>
        <div className="px-4 py-12 md:px-8">
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-gray-800/30 py-12">
            <p className="text-gray-400">{emptyStateText}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8">
      {/* Header */}
      <div className="mb-4 flex items-baseline justify-between px-4 md:px-8">
        <div className="flex items-baseline gap-3">
          <h2 className="text-xl font-bold text-white md:text-2xl">{title}</h2>
          {subtitle && (
            <span className="text-sm text-gray-400">{subtitle}</span>
          )}
        </div>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="group flex items-center gap-1 text-sm font-medium text-gray-300 transition-colors hover:text-white"
            aria-label={`${seeAllText} ${title}`}
          >
            <span>{seeAllText}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        )}
      </div>

      {/* Scrollable Row with Navigation */}
      <div
        className="group relative"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="region"
        aria-label={`${title} content row`}
      >
        {/* Left Navigation Arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 bottom-0 z-10 hidden w-12 items-center justify-center bg-gradient-to-r from-black/90 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 hover:from-black md:flex"
            aria-label="Scroll left"
            tabIndex={-1}
          >
            <ChevronLeft className="h-8 w-8 text-white drop-shadow-lg" />
          </button>
        )}

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          className="scrollbar-hide flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-4 md:gap-3 md:px-8"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {items.map((item, index) => (
            <div
              key={item.id}
              className="relative w-[calc(50%-4px)] flex-shrink-0 snap-start md:w-[calc(25%-9px)] lg:w-[calc(16.666%-10px)]"
            >
              {/* Ranking Number */}
              {showRanking && (
                <div className="absolute -left-2 top-0 z-20 flex h-full items-center md:-left-4">
                  <span
                    className="text-stroke text-6xl font-black text-gray-900 opacity-90 md:text-7xl lg:text-8xl"
                    style={{
                      WebkitTextStroke: "2px #1f2937",
                      textShadow: "0 0 20px rgba(0, 0, 0, 0.8)",
                    }}
                  >
                    {index + 1}
                  </span>
                </div>
              )}

              {/* Content Card */}
              <div className={showRanking ? "relative z-10" : ""}>
                <ContentCard
                  item={item}
                  onClick={() => onItemClick?.(item)}
                  onAddToList={
                    onAddToList ? () => onAddToList(item) : undefined
                  }
                  imageBaseUrl={imageBaseUrl}
                  runtime={item.runtime}
                  genres={item.genres}
                  matchScore={item.matchScore}
                  isInList={item.isInList}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Right Navigation Arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 bottom-0 z-10 hidden w-12 items-center justify-center bg-gradient-to-l from-black/90 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 hover:from-black md:flex"
            aria-label="Scroll right"
            tabIndex={-1}
          >
            <ChevronRight className="h-8 w-8 text-white drop-shadow-lg" />
          </button>
        )}

        {/* Edge Gradient Overlays (for fade effect) */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black to-transparent md:w-12" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black to-transparent md:w-12" />
      </div>

      {/* Custom scrollbar hiding styles */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
};

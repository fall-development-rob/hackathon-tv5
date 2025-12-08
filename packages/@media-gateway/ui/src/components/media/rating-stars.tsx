/**
 * RatingStars Component
 * Interactive and display-only star rating
 */

import * as React from "react";
import { Star } from "../ui/icons.js";
import { cn } from "../../lib/utils.js";

export interface RatingStarsProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Current rating value (0-10 scale, will be converted to 5-star display) */
  value: number;
  /** Maximum rating value for the scale (default 10) */
  maxValue?: number;
  /** Number of stars to display */
  starCount?: number;
  /** Size of the stars */
  size?: "sm" | "md" | "lg";
  /** Whether the rating is interactive */
  interactive?: boolean;
  /** Callback when rating changes */
  onChange?: (value: number) => void;
  /** Show numeric value next to stars */
  showValue?: boolean;
  /** Color of filled stars */
  color?: "yellow" | "gold" | "orange";
  /** Show half stars */
  showHalfStars?: boolean;
}

const sizeClasses = {
  sm: "w-3 h-3",
  md: "w-4 h-4",
  lg: "w-6 h-6",
};

const colorClasses = {
  yellow: "fill-yellow-400 text-yellow-400",
  gold: "fill-amber-500 text-amber-500",
  orange: "fill-orange-500 text-orange-500",
};

const RatingStars = React.forwardRef<HTMLDivElement, RatingStarsProps>(
  (
    {
      className,
      value,
      maxValue = 10,
      starCount = 5,
      size = "md",
      interactive = false,
      onChange,
      showValue = false,
      color = "yellow",
      showHalfStars = true,
      ...props
    },
    ref
  ) => {
    const [hoverValue, setHoverValue] = React.useState<number | null>(null);

    // Convert value to star scale
    const normalizedValue = (value / maxValue) * starCount;
    const displayValue =
      hoverValue !== null ? hoverValue : Math.round(normalizedValue * 2) / 2;

    const handleClick = (starIndex: number) => {
      if (!interactive || !onChange) return;
      // Convert star index back to original scale
      const newValue = ((starIndex + 1) / starCount) * maxValue;
      onChange(newValue);
    };

    const handleMouseEnter = (starIndex: number) => {
      if (!interactive) return;
      setHoverValue(starIndex + 1);
    };

    const handleMouseLeave = () => {
      if (!interactive) return;
      setHoverValue(null);
    };

    const renderStar = (index: number) => {
      const fillLevel = Math.max(0, Math.min(1, displayValue - index));
      const isHalf = showHalfStars && fillLevel > 0 && fillLevel < 1;
      const isFull = fillLevel >= 1;

      return (
        <button
          key={index}
          type="button"
          className={cn(
            "relative",
            interactive && "cursor-pointer hover:scale-110 transition-transform",
            !interactive && "cursor-default"
          )}
          onClick={() => handleClick(index)}
          onMouseEnter={() => handleMouseEnter(index)}
          onMouseLeave={handleMouseLeave}
          disabled={!interactive}
        >
          {/* Empty star background */}
          <Star className={cn(sizeClasses[size], "text-muted-foreground/30")} />

          {/* Filled star overlay */}
          {(isFull || isHalf) && (
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: isHalf ? "50%" : "100%" }}
            >
              <Star
                className={cn(sizeClasses[size], colorClasses[color])}
                fill="currentColor"
              />
            </div>
          )}
        </button>
      );
    };

    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-0.5", className)}
        {...props}
      >
        {Array.from({ length: starCount }, (_, i) => renderStar(i))}
        {showValue && (
          <span className="ml-2 text-sm text-muted-foreground">
            {value.toFixed(1)}
          </span>
        )}
      </div>
    );
  }
);
RatingStars.displayName = "RatingStars";

export { RatingStars };

/**
 * Skeleton Component
 * Loading placeholder with shimmer animation
 */

import * as React from "react";
import { cn } from "../../lib/utils.js";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether to animate the skeleton */
  animate?: boolean;
}

function Skeleton({ className, animate = true, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-primary/10",
        animate && "animate-pulse",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };

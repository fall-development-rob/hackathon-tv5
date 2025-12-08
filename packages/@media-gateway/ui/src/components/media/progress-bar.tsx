/**
 * ProgressBar Component
 * Display progress for watch status, loading states, etc.
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils.js";

const progressVariants = cva(
  "relative w-full overflow-hidden rounded-full bg-primary/20",
  {
    variants: {
      size: {
        sm: "h-1",
        md: "h-2",
        lg: "h-3",
        xl: "h-4",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

const progressIndicatorVariants = cva(
  "h-full transition-all duration-300 ease-in-out rounded-full",
  {
    variants: {
      variant: {
        default: "bg-primary",
        success: "bg-green-500",
        warning: "bg-yellow-500",
        danger: "bg-red-500",
        gradient: "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface ProgressBarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressVariants>,
    VariantProps<typeof progressIndicatorVariants> {
  /** Progress value (0-100) */
  value: number;
  /** Maximum value (default 100) */
  max?: number;
  /** Show percentage label */
  showLabel?: boolean;
  /** Label position */
  labelPosition?: "inside" | "right" | "above";
  /** Custom label format */
  formatLabel?: (value: number, max: number) => string;
  /** Animate on mount */
  animate?: boolean;
  /** Indeterminate state (for loading) */
  indeterminate?: boolean;
}

const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      className,
      value,
      max = 100,
      size,
      variant,
      showLabel = false,
      labelPosition = "right",
      formatLabel,
      animate = true,
      indeterminate = false,
      ...props
    },
    ref
  ) => {
    const [mounted, setMounted] = React.useState(!animate);
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    React.useEffect(() => {
      if (animate) {
        const timer = setTimeout(() => setMounted(true), 50);
        return () => clearTimeout(timer);
      }
    }, [animate]);

    const label = formatLabel
      ? formatLabel(value, max)
      : `${Math.round(percentage)}%`;

    if (indeterminate) {
      return (
        <div
          ref={ref}
          className={cn(progressVariants({ size }), className)}
          {...props}
        >
          <div
            className={cn(
              progressIndicatorVariants({ variant }),
              "w-1/3 animate-indeterminate"
            )}
          />
        </div>
      );
    }

    const progressBar = (
      <div
        ref={ref}
        className={cn(progressVariants({ size }), className)}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        {...props}
      >
        <div
          className={cn(progressIndicatorVariants({ variant }))}
          style={{ width: mounted ? `${percentage}%` : "0%" }}
        />
        {showLabel && labelPosition === "inside" && size !== "sm" && (
          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white mix-blend-difference">
            {label}
          </span>
        )}
      </div>
    );

    if (showLabel && labelPosition === "above") {
      return (
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{label}</span>
          </div>
          {progressBar}
        </div>
      );
    }

    if (showLabel && labelPosition === "right") {
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1">{progressBar}</div>
          <span className="text-sm font-medium min-w-[3ch]">{label}</span>
        </div>
      );
    }

    return progressBar;
  }
);
ProgressBar.displayName = "ProgressBar";

export { ProgressBar, progressVariants, progressIndicatorVariants };

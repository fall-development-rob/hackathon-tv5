/**
 * PlatformBadge Component
 * Display streaming platform availability badges
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils.js";
import type { Platform, WatchProvider } from "../../types/index.js";

const platformBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        stream: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        rent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        buy: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      },
      size: {
        sm: "text-xs px-1.5 py-0.5",
        md: "text-xs px-2 py-1",
        lg: "text-sm px-2.5 py-1.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface PlatformBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof platformBadgeVariants> {
  /** Platform information */
  platform: Platform;
  /** Provider type (determines styling) */
  type?: WatchProvider["type"];
  /** Show platform logo */
  showLogo?: boolean;
  /** Show price if available */
  price?: number;
  /** Currency for price display */
  currency?: string;
}

const PlatformBadge = React.forwardRef<HTMLDivElement, PlatformBadgeProps>(
  (
    {
      className,
      platform,
      type = "stream",
      variant,
      size,
      showLogo = true,
      price,
      currency = "$",
      ...props
    },
    ref
  ) => {
    const badgeVariant = variant || type;

    return (
      <div
        ref={ref}
        className={cn(
          platformBadgeVariants({ variant: badgeVariant, size }),
          className
        )}
        {...props}
      >
        {showLogo && platform.logo && (
          <img
            src={platform.logo}
            alt={platform.name}
            className={cn(
              "rounded",
              size === "sm" && "w-3 h-3",
              size === "md" && "w-4 h-4",
              size === "lg" && "w-5 h-5"
            )}
          />
        )}
        <span>{platform.name}</span>
        {price !== undefined && (
          <span className="opacity-75">
            {currency}
            {price.toFixed(2)}
          </span>
        )}
      </div>
    );
  }
);
PlatformBadge.displayName = "PlatformBadge";

export interface PlatformListProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** List of watch providers */
  providers: WatchProvider[];
  /** Maximum providers to show before "more" indicator */
  maxVisible?: number;
  /** Size of badges */
  size?: "sm" | "md" | "lg";
  /** Group by provider type */
  grouped?: boolean;
}

const PlatformList = React.forwardRef<HTMLDivElement, PlatformListProps>(
  (
    {
      className,
      providers,
      maxVisible = 5,
      size = "md",
      grouped = false,
      ...props
    },
    ref
  ) => {
    if (grouped) {
      const streamProviders = providers.filter((p) => p.type === "stream");
      const rentProviders = providers.filter((p) => p.type === "rent");
      const buyProviders = providers.filter((p) => p.type === "buy");

      return (
        <div ref={ref} className={cn("space-y-2", className)} {...props}>
          {streamProviders.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground mb-1 block">
                Stream
              </span>
              <div className="flex flex-wrap gap-1">
                {streamProviders.map((provider) => (
                  <PlatformBadge
                    key={provider.platform.id}
                    platform={provider.platform}
                    type="stream"
                    size={size}
                  />
                ))}
              </div>
            </div>
          )}
          {rentProviders.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground mb-1 block">
                Rent
              </span>
              <div className="flex flex-wrap gap-1">
                {rentProviders.map((provider) => (
                  <PlatformBadge
                    key={provider.platform.id}
                    platform={provider.platform}
                    type="rent"
                    price={provider.price}
                    size={size}
                  />
                ))}
              </div>
            </div>
          )}
          {buyProviders.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground mb-1 block">
                Buy
              </span>
              <div className="flex flex-wrap gap-1">
                {buyProviders.map((provider) => (
                  <PlatformBadge
                    key={provider.platform.id}
                    platform={provider.platform}
                    type="buy"
                    price={provider.price}
                    size={size}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    const visibleProviders = providers.slice(0, maxVisible);
    const remaining = providers.length - maxVisible;

    return (
      <div ref={ref} className={cn("flex flex-wrap gap-1", className)} {...props}>
        {visibleProviders.map((provider) => (
          <PlatformBadge
            key={provider.platform.id}
            platform={provider.platform}
            type={provider.type}
            price={provider.price}
            size={size}
          />
        ))}
        {remaining > 0 && (
          <div
            className={cn(
              "inline-flex items-center justify-center rounded-md bg-muted text-muted-foreground",
              size === "sm" && "text-xs px-1.5 py-0.5",
              size === "md" && "text-xs px-2 py-1",
              size === "lg" && "text-sm px-2.5 py-1.5"
            )}
          >
            +{remaining}
          </div>
        )}
      </div>
    );
  }
);
PlatformList.displayName = "PlatformList";

export { PlatformBadge, PlatformList, platformBadgeVariants };

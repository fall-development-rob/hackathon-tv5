/**
 * Icon Components
 * Wrapper for lucide-react icons to handle React types version mismatch
 * between React 18 and React 19 in monorepo environments
 */

import * as React from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import {
  Star as StarIcon,
  Play as PlayIcon,
  Clock as ClockIcon,
  Calendar as CalendarIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";

// Type-safe icon wrapper that handles React version mismatch
function createIconWrapper(IconComponent: LucideIcon) {
  const WrappedIcon = React.forwardRef<SVGSVGElement, LucideProps>(
    (props, ref) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Icon = IconComponent as any;
      return <Icon ref={ref} {...props} />;
    }
  );
  WrappedIcon.displayName = IconComponent.displayName || "Icon";
  return WrappedIcon;
}

export const Star = createIconWrapper(StarIcon);
export const Play = createIconWrapper(PlayIcon);
export const Clock = createIconWrapper(ClockIcon);
export const Calendar = createIconWrapper(CalendarIcon);
export const ChevronLeft = createIconWrapper(ChevronLeftIcon);
export const ChevronRight = createIconWrapper(ChevronRightIcon);

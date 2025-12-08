/**
 * Utility functions for shadcn-style component library
 * Following the cn() pattern from shadcn/ui
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names with Tailwind CSS class merging
 * Prevents conflicting Tailwind classes and allows conditional classes
 *
 * @example
 * cn("px-4 py-2", "bg-blue-500", isActive && "bg-blue-700")
 * cn("text-sm", className) // Allows consumer overrides
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format duration in seconds to human-readable string
 * @example formatDuration(3661) => "1h 1m"
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * Format a rating number to display string
 * @example formatRating(8.5) => "8.5"
 */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Get year from date string or Date object
 */
export function getYear(date: string | Date): number {
  return new Date(date).getFullYear();
}

/**
 * Generate placeholder image URL for media
 */
export function getPlaceholderImage(
  width: number,
  height: number,
  text?: string
): string {
  const encodedText = encodeURIComponent(text || "No Image");
  return `https://via.placeholder.com/${width}x${height}?text=${encodedText}`;
}

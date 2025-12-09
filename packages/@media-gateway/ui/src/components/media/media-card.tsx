/**
 * MediaCard Component
 * Display media items (movies, TV shows, anime) with poster, title, and metadata
 */

import * as React from "react";
import { Star, Play, Clock, Calendar } from "../ui/icons.js";
import { cn, formatDuration, formatRating, getYear } from "../../lib/utils.js";
import { Card, CardContent } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import { Skeleton } from "../ui/skeleton.js";
import type { MediaItem, MediaType } from "../../types/index.js";

export interface MediaCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onPlay"> {
  /** Media item data */
  media: MediaItem;
  /** Card display variant */
  variant?: "default" | "compact" | "detailed";
  /** Show play button overlay on hover */
  showPlayButton?: boolean;
  /** Click handler for the card */
  onMediaClick?: (media: MediaItem) => void;
  /** Image base URL for poster paths */
  imageBaseUrl?: string;
  /** Loading state */
  loading?: boolean;
}

const mediaTypeColors: Record<MediaType, string> = {
  movie: "bg-blue-500",
  tv: "bg-purple-500",
};

const mediaTypeLabels: Record<MediaType, string> = {
  movie: "Movie",
  tv: "TV Series",
};

const MediaCard = React.forwardRef<HTMLDivElement, MediaCardProps>(
  (
    {
      className,
      media,
      variant = "default",
      showPlayButton = true,
      onMediaClick,
      imageBaseUrl = "https://image.tmdb.org/t/p/w500",
      loading = false,
      ...props
    },
    ref
  ) => {
    if (loading) {
      return <MediaCardSkeleton variant={variant} />;
    }

    const posterUrl = media.posterPath
      ? `${imageBaseUrl}${media.posterPath}`
      : null;

    const handleClick = () => {
      onMediaClick?.(media);
    };

    if (variant === "compact") {
      return (
        <Card
          ref={ref}
          className={cn(
            "group relative overflow-hidden cursor-pointer transition-transform hover:scale-105",
            className
          )}
          onClick={handleClick}
          {...props}
        >
          <div className="aspect-[2/3] relative">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={media.title}
                className="object-cover w-full h-full"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <span className="text-muted-foreground text-sm">No Image</span>
              </div>
            )}
            {showPlayButton && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play className="w-12 h-12 text-white" fill="currentColor" />
              </div>
            )}
            <div className="absolute top-2 right-2">
              <Badge
                variant="secondary"
                className="bg-black/70 text-white text-xs"
              >
                <Star className="w-3 h-3 mr-1 fill-yellow-400 text-yellow-400" />
                {formatRating(media.voteAverage)}
              </Badge>
            </div>
          </div>
        </Card>
      );
    }

    if (variant === "detailed") {
      return (
        <Card
          ref={ref}
          className={cn(
            "group relative overflow-hidden cursor-pointer",
            className
          )}
          onClick={handleClick}
          {...props}
        >
          <div className="flex">
            <div className="w-32 flex-shrink-0">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={media.title}
                  className="object-cover w-full h-full"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center min-h-48">
                  <span className="text-muted-foreground text-sm">
                    No Image
                  </span>
                </div>
              )}
            </div>
            <CardContent className="flex-1 p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg line-clamp-2">
                  {media.title}
                </h3>
                <Badge
                  className={cn(
                    "ml-2 flex-shrink-0",
                    mediaTypeColors[media.mediaType]
                  )}
                >
                  {mediaTypeLabels[media.mediaType]}
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span>{formatRating(media.voteAverage)}</span>
                </div>
                {media.releaseDate && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{getYear(media.releaseDate)}</span>
                  </div>
                )}
                {media.runtime && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{formatDuration(media.runtime * 60)}</span>
                  </div>
                )}
              </div>

              {media.overview && (
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {media.overview}
                </p>
              )}

              {media.genres && media.genres.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {media.genres.slice(0, 3).map((genre) => (
                    <Badge key={genre.id} variant="outline" className="text-xs">
                      {genre.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </div>
        </Card>
      );
    }

    // Default variant
    return (
      <Card
        ref={ref}
        className={cn(
          "group relative overflow-hidden cursor-pointer transition-transform hover:scale-105",
          className
        )}
        onClick={handleClick}
        {...props}
      >
        <div className="aspect-[2/3] relative">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={media.title}
              className="object-cover w-full h-full"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="text-muted-foreground text-sm">No Image</span>
            </div>
          )}
          {showPlayButton && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Play className="w-12 h-12 text-white" fill="currentColor" />
            </div>
          )}
          <div className="absolute top-2 left-2">
            <Badge className={cn("text-xs", mediaTypeColors[media.mediaType])}>
              {mediaTypeLabels[media.mediaType]}
            </Badge>
          </div>
          <div className="absolute top-2 right-2">
            <Badge
              variant="secondary"
              className="bg-black/70 text-white text-xs"
            >
              <Star className="w-3 h-3 mr-1 fill-yellow-400 text-yellow-400" />
              {formatRating(media.voteAverage)}
            </Badge>
          </div>
        </div>
        <CardContent className="p-3">
          <h3 className="font-medium text-sm line-clamp-1">{media.title}</h3>
          {media.releaseDate && (
            <p className="text-xs text-muted-foreground mt-1">
              {getYear(media.releaseDate)}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }
);
MediaCard.displayName = "MediaCard";

interface MediaCardSkeletonProps {
  variant?: "default" | "compact" | "detailed";
}

function MediaCardSkeleton({ variant = "default" }: MediaCardSkeletonProps) {
  if (variant === "compact") {
    return (
      <Card className="overflow-hidden">
        <Skeleton className="aspect-[2/3]" />
      </Card>
    );
  }

  if (variant === "detailed") {
    return (
      <Card className="overflow-hidden">
        <div className="flex">
          <Skeleton className="w-32 h-48 flex-shrink-0" />
          <div className="flex-1 p-4 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-16 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-[2/3]" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </Card>
  );
}

export { MediaCard, MediaCardSkeleton };

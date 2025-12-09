import React from "react";
import { Play, Star, Plus, Check } from "lucide-react";

interface ContentCardProps {
  item: {
    id: string;
    title: string;
    posterPath: string | null;
    rating: number;
    year?: number;
    mediaType: "movie" | "tv";
    runtime?: number; // in minutes
    genres?: string[];
    matchScore?: number; // 0-100
    isInList?: boolean;
  };
  onClick?: () => void;
  onAddToList?: (id: string) => void;
  imageBaseUrl?: string;
}

export const ContentCard: React.FC<ContentCardProps> = ({
  item,
  onClick,
  onAddToList,
  imageBaseUrl = "https://image.tmdb.org/t/p/w500",
}) => {
  const posterUrl = item.posterPath
    ? `${imageBaseUrl}${item.posterPath}`
    : "/placeholder-poster.png";

  // Format runtime as "1h 30m" or "45m"
  const formatRuntime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  // Handle add to list click
  const handleAddToList = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddToList) {
      onAddToList(item.id);
    }
  };

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer transition-transform duration-300 hover:scale-105"
    >
      {/* Poster Image Container */}
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-gray-800">
        <img
          src={posterUrl}
          alt={item.title}
          className="h-full w-full object-cover transition-opacity duration-300"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "/placeholder-poster.png";
          }}
        />

        {/* Media Type Badge */}
        <div className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 backdrop-blur-sm">
          <span className="text-xs font-semibold uppercase text-white">
            {item.mediaType === "movie" ? "Movie" : "TV"}
          </span>
        </div>

        {/* Rating Badge */}
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 backdrop-blur-sm">
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          <span className="text-xs font-semibold text-white">
            {item.rating.toFixed(1)}
          </span>
        </div>

        {/* Match Score Badge (if available) */}
        {item.matchScore !== undefined && (
          <div className="absolute bottom-2 right-2 rounded bg-green-600/90 px-2 py-0.5 backdrop-blur-sm">
            <span className="text-xs font-bold text-white">
              {Math.round(item.matchScore)}% Match
            </span>
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          {/* Play Button */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 transition-transform duration-200 group-hover:scale-110">
              <Play className="ml-0.5 h-6 w-6 fill-black text-black" />
            </div>
          </div>

          {/* Add to List Button */}
          {onAddToList && (
            <button
              onClick={handleAddToList}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/80 bg-black/60 backdrop-blur-sm transition-all duration-200 hover:scale-110 hover:border-white hover:bg-black/80"
              aria-label={item.isInList ? "Remove from list" : "Add to list"}
            >
              {item.isInList ? (
                <Check className="h-4 w-4 text-white" />
              ) : (
                <Plus className="h-4 w-4 text-white" />
              )}
            </button>
          )}

          {/* Title and Info */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="mb-2 line-clamp-2 text-sm font-bold text-white">
              {item.title}
            </h3>

            {/* Runtime and Year */}
            <div className="mb-2 flex items-center gap-2 text-xs text-gray-300">
              {item.year && <span>{item.year}</span>}
              {item.runtime && (
                <>
                  <span>•</span>
                  <span>{formatRuntime(item.runtime)}</span>
                </>
              )}
            </div>

            {/* Genre Pills (max 2) */}
            {item.genres && item.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.genres.slice(0, 2).map((genre, index) => (
                  <span
                    key={index}
                    className="rounded-full bg-gray-700/80 px-2 py-0.5 text-xs text-gray-200"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

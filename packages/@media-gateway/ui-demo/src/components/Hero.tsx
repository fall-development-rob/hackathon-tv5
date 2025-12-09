import { useState, useEffect } from "react";

interface HeroProps {
  item: {
    id: string;
    title: string;
    description: string;
    backdropPath: string | null;
    posterPath: string | null;
    year: number;
    genre: string[];
    rating: number;
    matchScore?: number;
  };
  onPlay?: () => void;
  onMoreInfo?: () => void;
  imageBaseUrl?: string;
}

export const Hero: React.FC<HeroProps> = ({
  item,
  onPlay,
  onMoreInfo,
  imageBaseUrl = "https://image.tmdb.org/t/p/original",
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Trigger fade-in animation after component mounts
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, [item.id]);

  const backdropUrl = item.backdropPath
    ? `${imageBaseUrl}${item.backdropPath}`
    : null;

  const fallbackGradient = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Backdrop Image or Fallback Gradient */}
      <div
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        style={{
          backgroundImage: backdropUrl
            ? `url(${backdropUrl})`
            : fallbackGradient,
        }}
        aria-hidden="true"
      />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />

      {/* Bottom Gradient for Text Readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

      {/* Content Container */}
      <div
        className={`relative z-10 flex h-full items-end pb-32 px-8 md:px-16 transition-all duration-1000 ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="max-w-2xl space-y-6">
          {/* Match Score Badge */}
          {item.matchScore !== undefined && (
            <div className="inline-flex items-center gap-2">
              <div className="inline-flex items-center px-3 py-1 bg-green-600 rounded-md">
                <span className="text-white font-bold text-sm">
                  {item.matchScore}% Match
                </span>
              </div>
            </div>
          )}

          {/* Title */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight drop-shadow-2xl">
            {item.title}
          </h1>

          {/* Metadata: Year and Genres */}
          <div className="flex items-center gap-3 text-white/90">
            <span className="text-lg font-semibold">{item.year}</span>
            <span className="text-white/50">•</span>
            <div className="flex flex-wrap gap-2">
              {item.genre.slice(0, 3).map((genre, index) => (
                <span key={index} className="text-lg">
                  {genre}
                  {index < Math.min(item.genre.length, 3) - 1 && (
                    <span className="text-white/50 ml-2">•</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Description */}
          <p className="text-lg md:text-xl text-white/90 line-clamp-3 leading-relaxed max-w-xl drop-shadow-lg">
            {item.description}
          </p>

          {/* CTA Buttons */}
          <div className="flex items-center gap-4 pt-2">
            {/* Play Button */}
            <button
              onClick={onPlay}
              className="inline-flex items-center gap-3 px-8 py-4 bg-white text-black font-bold text-lg rounded-md hover:bg-white/90 transition-all duration-200 shadow-lg hover:scale-105 active:scale-95"
              aria-label={`Play ${item.title}`}
            >
              <svg
                className="w-6 h-6 fill-current"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Play</span>
            </button>

            {/* More Info Button */}
            <button
              onClick={onMoreInfo}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gray-500/70 text-white font-bold text-lg rounded-md border border-white/30 hover:bg-gray-500/50 transition-all duration-200 backdrop-blur-sm hover:scale-105 active:scale-95"
              aria-label={`More information about ${item.title}`}
            >
              <svg
                className="w-6 h-6 stroke-current"
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <path
                  d="M12 16v-4m0-4h.01"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span>More Info</span>
            </button>
          </div>

          {/* Rating Badge */}
          {item.rating > 0 && (
            <div className="flex items-center gap-2 pt-2">
              <div className="flex items-center gap-1">
                <svg
                  className="w-5 h-5 fill-yellow-400"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <span className="text-white font-semibold text-lg">
                  {item.rating.toFixed(1)}
                </span>
                <span className="text-white/60 text-sm">/10</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fade to content below */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-slate-900 pointer-events-none" />
    </div>
  );
};

export default Hero;

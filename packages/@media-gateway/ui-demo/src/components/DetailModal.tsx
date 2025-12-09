import React, { useEffect, useRef } from "react";
import {
  X,
  Play,
  Plus,
  Check,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Clock,
  Film,
  Tv,
  Globe,
  Calendar,
  Users,
  Award,
} from "lucide-react";

interface SimilarTitle {
  id: string;
  title: string;
  posterPath: string | null;
  rating: number;
  year: number;
}

interface DetailModalProps {
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
    availability?: Array<{
      platform: string;
      type: "subscription" | "rent" | "buy" | "free";
      price?: { amount: number; currency: string };
      deepLink: string;
    }>;
    runtime?: number;
    contentRating?: string;
    cast?: string[];
    director?: string;
    mediaType: "movie" | "tv";
    seasons?: number;
    episodes?: number;
    tagline?: string;
    originalLanguage?: string;
    status?: string;
    networks?: string[];
    similarTitles?: SimilarTitle[];
    budget?: number;
    revenue?: number;
    isInList?: boolean;
  };
  isOpen: boolean;
  onClose: () => void;
  onToggleMyList?: () => void;
  imageBaseUrl?: string;
}

const platformStyles: Record<string, { bg: string; text: string }> = {
  Netflix: { bg: "bg-red-600", text: "text-white" },
  "Disney+": { bg: "bg-blue-600", text: "text-white" },
  "Amazon Prime": { bg: "bg-cyan-500", text: "text-white" },
  "Apple TV": { bg: "bg-gray-800", text: "text-white" },
  Hulu: { bg: "bg-green-500", text: "text-white" },
  HBO: { bg: "bg-purple-700", text: "text-white" },
  Paramount: { bg: "bg-blue-500", text: "text-white" },
  Peacock: { bg: "bg-yellow-500", text: "text-gray-900" },
};

const getAvailabilityLabel = (
  type: "subscription" | "rent" | "buy" | "free",
  price?: { amount: number; currency: string },
): string => {
  switch (type) {
    case "subscription":
      return "Included";
    case "free":
      return "Free";
    case "rent":
      return price ? `$${price.amount.toFixed(2)} Rent` : "Rent";
    case "buy":
      return price ? `$${price.amount.toFixed(2)} Buy` : "Buy";
    default:
      return "Available";
  }
};

const getLanguageFlag = (langCode: string): string => {
  const languageFlags: Record<string, string> = {
    en: "🇺🇸",
    es: "🇪🇸",
    fr: "🇫🇷",
    de: "🇩🇪",
    it: "🇮🇹",
    pt: "🇵🇹",
    ja: "🇯🇵",
    ko: "🇰🇷",
    zh: "🇨🇳",
    ru: "🇷🇺",
    ar: "🇸🇦",
    hi: "🇮🇳",
    nl: "🇳🇱",
    sv: "🇸🇪",
    no: "🇳🇴",
    da: "🇩🇰",
    fi: "🇫🇮",
    pl: "🇵🇱",
    tr: "🇹🇷",
    th: "🇹🇭",
  };
  return languageFlags[langCode] || "🌐";
};

const getLanguageName = (langCode: string): string => {
  const languageNames: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ru: "Russian",
    ar: "Arabic",
    hi: "Hindi",
    nl: "Dutch",
    sv: "Swedish",
    no: "Norwegian",
    da: "Danish",
    fi: "Finnish",
    pl: "Polish",
    tr: "Turkish",
    th: "Thai",
  };
  return languageNames[langCode] || langCode.toUpperCase();
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const DetailModal: React.FC<DetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onToggleMyList,
  imageBaseUrl = "https://image.tmdb.org/t/p",
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Focus close button when modal opens
      setTimeout(() => closeButtonRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener("keydown", handleTab as any);
    return () => modal.removeEventListener("keydown", handleTab as any);
  }, [isOpen]);

  // Click outside to close
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const backdropUrl = item.backdropPath
    ? `${imageBaseUrl}/original${item.backdropPath}`
    : item.posterPath
      ? `${imageBaseUrl}/original${item.posterPath}`
      : null;

  const formatRuntime = (minutes?: number): string => {
    if (!minutes) return "";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-200"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 rounded-lg shadow-2xl transform transition-all duration-200 scale-100"
        style={{
          animation: "modalSlideIn 0.2s ease-out",
        }}
      >
        {/* Header Section with Backdrop Image */}
        <div className="relative h-[450px] overflow-hidden">
          {backdropUrl ? (
            <>
              <img
                src={backdropUrl}
                alt={item.title}
                className="w-full h-full object-cover"
              />
              {/* Gradient overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-gray-900/80 via-transparent to-transparent" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-900/50 to-blue-900/50" />
          )}

          {/* Close Button */}
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-gray-900/80 hover:bg-gray-800 rounded-full transition-colors duration-200"
            aria-label="Close modal"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Title and Actions */}
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <h2
              id="modal-title"
              className="text-4xl font-bold text-white mb-2 drop-shadow-lg"
            >
              {item.title}
            </h2>

            {/* Tagline */}
            {item.tagline && (
              <p className="text-lg text-gray-300 italic mb-4 drop-shadow-md">
                "{item.tagline}"
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button className="flex items-center gap-2 px-6 py-2.5 bg-white text-black font-semibold rounded hover:bg-gray-200 transition-colors duration-200">
                <Play className="w-5 h-5 fill-current" />
                Play
              </button>
              {onToggleMyList && (
                <button
                  onClick={onToggleMyList}
                  className={`flex items-center gap-2 px-4 py-2.5 border rounded transition-all duration-200 ${
                    item.isInList
                      ? "bg-white text-gray-900 border-white hover:bg-gray-200"
                      : "bg-gray-800/80 hover:bg-gray-700 border-gray-600 text-white"
                  }`}
                  aria-label={
                    item.isInList ? "Remove from my list" : "Add to my list"
                  }
                  title={
                    item.isInList ? "Remove from My List" : "Add to My List"
                  }
                >
                  {item.isInList ? (
                    <>
                      <Check className="w-5 h-5" />
                      <span className="font-medium">In My List</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      <span className="font-medium">My List</span>
                    </>
                  )}
                </button>
              )}
              <button
                className="w-10 h-10 flex items-center justify-center bg-gray-800/80 hover:bg-gray-700 border border-gray-600 rounded-full transition-colors duration-200"
                aria-label="Like"
              >
                <ThumbsUp className="w-5 h-5 text-white" />
              </button>
              <button
                className="w-10 h-10 flex items-center justify-center bg-gray-800/80 hover:bg-gray-700 border border-gray-600 rounded-full transition-colors duration-200"
                aria-label="Dislike"
              >
                <ThumbsDown className="w-5 h-5 text-white" />
              </button>
              <button
                className="w-10 h-10 flex items-center justify-center bg-gray-800/80 hover:bg-gray-700 border border-gray-600 rounded-full transition-colors duration-200"
                aria-label="Share"
              >
                <Share2 className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-8">
          {/* Meta Information Pills */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {item.matchScore !== undefined && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full font-semibold text-sm">
                <Award className="w-4 h-4" />
                {Math.round(item.matchScore)}% Match
              </span>
            )}

            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-sm">
              {item.mediaType === "movie" ? (
                <Film className="w-4 h-4" />
              ) : (
                <Tv className="w-4 h-4" />
              )}
              {item.mediaType === "movie" ? "Movie" : "TV Series"}
            </span>

            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-gray-300 rounded-full text-sm">
              <Calendar className="w-4 h-4" />
              {item.year}
            </span>

            {item.contentRating && (
              <span className="px-3 py-1.5 border-2 border-gray-500 text-gray-300 rounded text-sm font-semibold">
                {item.contentRating}
              </span>
            )}

            {item.mediaType === "movie" && item.runtime && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-gray-300 rounded-full text-sm">
                <Clock className="w-4 h-4" />
                {formatRuntime(item.runtime)}
              </span>
            )}

            {item.mediaType === "tv" && item.seasons !== undefined && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-full text-sm">
                <Tv className="w-4 h-4" />
                {item.seasons} Season{item.seasons !== 1 ? "s" : ""}
              </span>
            )}

            {item.mediaType === "tv" && item.episodes !== undefined && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-full text-sm">
                {item.episodes} Episode{item.episodes !== 1 ? "s" : ""}
              </span>
            )}

            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-full text-sm">
              <span className="text-yellow-400">★</span>
              {item.rating.toFixed(1)}
            </span>

            {item.originalLanguage && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-gray-300 rounded-full text-sm">
                <Globe className="w-4 h-4" />
                {getLanguageFlag(item.originalLanguage)}{" "}
                {getLanguageName(item.originalLanguage)}
              </span>
            )}

            {item.status && item.mediaType === "tv" && (
              <span className="px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded-full text-sm">
                {item.status}
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-gray-300 text-base leading-relaxed mb-6">
            {item.description}
          </p>

          {/* Genres */}
          {item.genre && item.genre.length > 0 && (
            <div className="mb-6">
              <span className="text-gray-400 text-sm">Genres: </span>
              <span className="text-white text-sm">
                {item.genre.join(", ")}
              </span>
            </div>
          )}

          {/* Additional Movie Info */}
          {item.mediaType === "movie" && (item.budget || item.revenue) && (
            <div className="mb-6 grid grid-cols-2 gap-4">
              {item.budget && item.budget > 0 && (
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-gray-400 text-xs mb-1">Budget</div>
                  <div className="text-white font-semibold">
                    {formatCurrency(item.budget)}
                  </div>
                </div>
              )}
              {item.revenue && item.revenue > 0 && (
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-gray-400 text-xs mb-1">Box Office</div>
                  <div className="text-white font-semibold">
                    {formatCurrency(item.revenue)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TV Networks */}
          {item.mediaType === "tv" &&
            item.networks &&
            item.networks.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Tv className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400 text-sm font-semibold">
                    Networks
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.networks.map((network, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-800 text-white rounded text-sm"
                    >
                      {network}
                    </span>
                  ))}
                </div>
              </div>
            )}

          {/* Cast & Crew */}
          {(item.cast || item.director) && (
            <div className="mb-6 space-y-3">
              {item.director && (
                <div className="bg-gray-800/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Film className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-400 text-sm font-semibold">
                      Director
                    </span>
                  </div>
                  <span className="text-white">{item.director}</span>
                </div>
              )}
              {item.cast && item.cast.length > 0 && (
                <div className="bg-gray-800/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-400 text-sm font-semibold">
                      Cast
                    </span>
                  </div>
                  <span className="text-white">
                    {item.cast.slice(0, 5).join(", ")}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Platform Availability */}
          {item.availability && item.availability.length > 0 && (
            <div className="border-t border-gray-800 pt-6 mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Where to Watch
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {item.availability.map((avail, index) => {
                  const style = platformStyles[avail.platform] || {
                    bg: "bg-gray-700",
                    text: "text-white",
                  };
                  const label = getAvailabilityLabel(avail.type, avail.price);

                  return (
                    <a
                      key={index}
                      href={avail.deepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center justify-between px-4 py-3 ${style.bg} ${style.text} rounded-lg hover:opacity-90 transition-opacity duration-200`}
                    >
                      <span className="font-semibold">{avail.platform}</span>
                      <span className="text-sm opacity-90">{label}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Similar Titles */}
          {item.similarTitles && item.similarTitles.length > 0 && (
            <div className="border-t border-gray-800 pt-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                More Like This
              </h3>
              <div className="overflow-x-auto -mx-4 px-4">
                <div className="flex gap-4 pb-4">
                  {item.similarTitles.map((similar) => {
                    const posterUrl = similar.posterPath
                      ? `${imageBaseUrl}/w342${similar.posterPath}`
                      : null;

                    return (
                      <div
                        key={similar.id}
                        className="flex-shrink-0 w-36 group cursor-pointer"
                      >
                        <div className="relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden mb-2">
                          {posterUrl ? (
                            <img
                              src={posterUrl}
                              alt={similar.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-600">
                              <Film className="w-12 h-12" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
                            <Play className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                          </div>
                        </div>
                        <h4 className="text-white text-sm font-medium line-clamp-2 mb-1">
                          {similar.title}
                        </h4>
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>{similar.year}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-yellow-500">★</span>
                            <span>{similar.rating.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2, Clock } from "lucide-react";

export interface SearchResult {
  id: string;
  title: string;
  year?: number;
  mediaType: "movie" | "tv";
  posterPath?: string | null;
  overview?: string;
  voteAverage?: number;
}

export interface SearchBarProps {
  onSearch: (query: string) => void;
  onResultClick?: (result: SearchResult) => void;
  placeholder?: string;
  className?: string;
  /**
   * Function to fetch search results based on query
   * Should return a promise that resolves to an array of SearchResult
   */
  fetchResults?: (query: string) => Promise<SearchResult[]>;
  /**
   * Debounce delay in milliseconds for search input
   * Default: 300ms
   */
  debounceMs?: number;
  /**
   * Maximum number of recent searches to store
   * Default: 5
   */
  maxRecentSearches?: number;
  /**
   * Base URL for poster images
   * Default: "https://image.tmdb.org/t/p/w200"
   */
  imageBaseUrl?: string;
}

const RECENT_SEARCHES_KEY = "media-gateway-recent-searches";

export function SearchBar({
  onSearch,
  onResultClick,
  placeholder = "Search movies, shows...",
  className = "",
  fetchResults,
  debounceMs = 300,
  maxRecentSearches = 5,
  imageBaseUrl = "https://image.tmdb.org/t/p/w200",
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecentSearches(Array.isArray(parsed) ? parsed : []);
      }
    } catch (err) {
      console.error("Failed to load recent searches:", err);
    }
  }, []);

  // Save recent searches to localStorage
  const saveRecentSearch = useCallback(
    (searchTerm: string) => {
      const trimmed = searchTerm.trim();
      if (!trimmed) return;

      setRecentSearches((prev) => {
        // Remove duplicates and add to front
        const updated = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(
          0,
          maxRecentSearches,
        );
        try {
          localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        } catch (err) {
          console.error("Failed to save recent searches:", err);
        }
        return updated;
      });
    },
    [maxRecentSearches],
  );

  // Handle search with debouncing
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Clear previous timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    setLoading(true);

    // Set new timeout for debounced search
    debounceTimeout.current = setTimeout(async () => {
      if (fetchResults) {
        try {
          const searchResults = await fetchResults(query);
          setResults(searchResults);
        } catch (err) {
          console.error("Search failed:", err);
          setResults([]);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [query, fetchResults, debounceMs]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalResults = results.length;
    const hasResults = totalResults > 0 && query.trim();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (hasResults) {
          setSelectedIndex((prev) =>
            prev < totalResults - 1 ? prev + 1 : prev,
          );
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        if (hasResults) {
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        }
        break;

      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultClick(results[selectedIndex]);
        } else if (query.trim()) {
          handleSearch();
        }
        break;

      case "Escape":
        e.preventDefault();
        setShowDropdown(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;

      default:
        break;
    }
  };

  const handleSearch = () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    saveRecentSearch(trimmed);
    onSearch(trimmed);
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  const handleResultClick = (result: SearchResult) => {
    saveRecentSearch(result.title);
    setQuery("");
    setResults([]);
    setShowDropdown(false);
    setSelectedIndex(-1);
    onResultClick?.(result);
  };

  const handleRecentSearchClick = (searchTerm: string) => {
    setQuery(searchTerm);
    inputRef.current?.focus();
    onSearch(searchTerm);
  };

  const handleClearQuery = () => {
    setQuery("");
    setResults([]);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const showRecentSearches = !query && recentSearches.length > 0;
  const showResults = query.trim() && results.length > 0;
  const showNoResults = query.trim() && !loading && results.length === 0;
  const shouldShowDropdown =
    showDropdown && (showRecentSearches || showResults || showNoResults);

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="flex items-center bg-black/50 border border-gray-600 rounded-full px-4 py-2 focus-within:border-white transition-colors hover:border-gray-400">
        <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          className="bg-transparent border-none outline-none text-white ml-3 w-full placeholder:text-gray-500"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          aria-label="Search"
          aria-autocomplete="list"
          aria-controls="search-results"
          aria-expanded={shouldShowDropdown}
        />
        {loading && (
          <Loader2 className="w-5 h-5 animate-spin text-gray-400 flex-shrink-0 ml-2" />
        )}
        {query && !loading && (
          <button
            onClick={handleClearQuery}
            className="ml-2 flex-shrink-0 hover:bg-gray-700 rounded-full p-1 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4 text-gray-400 hover:text-white" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {shouldShowDropdown && (
        <div
          id="search-results"
          className="absolute top-full mt-2 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-2xl max-h-96 overflow-y-auto z-50"
          role="listbox"
        >
          {/* Recent Searches */}
          {showRecentSearches && (
            <div className="p-3 border-b border-gray-700">
              <h4 className="text-xs text-gray-500 uppercase mb-2 font-semibold">
                Recent Searches
              </h4>
              {recentSearches.map((term, index) => (
                <button
                  key={`recent-${index}`}
                  className="flex items-center w-full text-left py-2 px-3 hover:bg-gray-800 rounded transition-colors text-gray-300"
                  onClick={() => handleRecentSearchClick(term)}
                  role="option"
                  aria-selected={false}
                >
                  <Clock className="inline w-4 h-4 mr-2 text-gray-500 flex-shrink-0" />
                  <span className="truncate">{term}</span>
                </button>
              ))}
            </div>
          )}

          {/* Search Results */}
          {showResults &&
            results.map((result, index) => {
              const isSelected = selectedIndex === index;
              const posterUrl =
                result.posterPath && imageBaseUrl
                  ? `${imageBaseUrl}${result.posterPath}`
                  : null;

              return (
                <button
                  key={result.id}
                  className={`flex items-center gap-3 w-full p-3 hover:bg-gray-800 transition-colors ${
                    isSelected ? "bg-gray-800" : ""
                  }`}
                  onClick={() => handleResultClick(result)}
                  role="option"
                  aria-selected={isSelected}
                >
                  {/* Poster Image */}
                  {posterUrl ? (
                    <img
                      src={posterUrl}
                      alt={result.title}
                      className="w-12 h-16 object-cover rounded flex-shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-12 h-16 bg-gray-800 rounded flex items-center justify-center flex-shrink-0">
                      <Search className="w-6 h-6 text-gray-600" />
                    </div>
                  )}

                  {/* Result Info */}
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-white font-medium truncate">
                      {result.title}
                    </p>
                    <p className="text-sm text-gray-400">
                      {result.year && `${result.year} • `}
                      {result.mediaType === "movie" ? "Movie" : "TV Series"}
                      {result.voteAverage && (
                        <span className="ml-2">
                          ⭐ {result.voteAverage.toFixed(1)}
                        </span>
                      )}
                    </p>
                  </div>
                </button>
              );
            })}

          {/* No Results */}
          {showNoResults && (
            <div className="p-6 text-center text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-2 text-gray-600" />
              <p className="font-medium">No results found</p>
              <p className="text-sm text-gray-500 mt-1">
                Try a different search term
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

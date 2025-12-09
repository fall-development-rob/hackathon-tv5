import { useState, useEffect, useRef } from "react";
import { useSearch, useRecommendations, useTrending } from "./hooks";
import { Hero } from "./components/Hero";
import { ContentRow } from "./components/ContentRow";
import { DetailModal } from "./components/DetailModal";
import { SearchBar } from "./components/SearchBar";
import { Bell, User, ChevronDown } from "lucide-react";

const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/original";

type MediaFilter = "all" | "movie" | "tv";

function App() {
  // State
  const [selectedMedia, setSelectedMedia] = useState<any | null>(null);
  const [featuredItem, setFeaturedItem] = useState<any | null>(null);
  const [activeFilter, setActiveFilter] = useState<MediaFilter>("all");
  const [myList, setMyList] = useState<any[]>([]);

  // Refs
  const myListRef = useRef<HTMLDivElement>(null);

  // Hooks
  const { trending, loading: trendingLoading } = useTrending({
    autoFetch: true,
  });
  const { recommendations, loading: recsLoading } = useRecommendations({
    userId: "demo-user",
    autoFetch: true,
  });
  const { query, setQuery, results, loading: searchLoading } = useSearch();

  // Load My List from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("media-gateway-my-list");
    if (saved) {
      try {
        setMyList(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved list:", e);
      }
    }
  }, []);

  // Save My List to localStorage
  useEffect(() => {
    localStorage.setItem("media-gateway-my-list", JSON.stringify(myList));
  }, [myList]);

  // Set featured item from trending
  useEffect(() => {
    if (trending.length > 0 && !featuredItem) {
      setFeaturedItem(trending[0]);
    }
  }, [trending, featuredItem]);

  // Navigation handlers
  const handleNavClick = (filter: MediaFilter) => {
    if (filter === "all" && myList.length > 0) {
      // "My List" click - scroll to My List section
      myListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      setActiveFilter(filter);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Add/Remove from My List
  const toggleMyList = (item: any) => {
    setMyList((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      if (exists) {
        return prev.filter((i) => i.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const isInMyList = (itemId: number) => myList.some((i) => i.id === itemId);

  // Filter content by media type
  const filterByType = (items: any[]) => {
    if (activeFilter === "all") return items;
    return items.filter((item) => item.mediaType === activeFilter);
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between px-8 py-4">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold text-red-600">MEDIA GATEWAY</h1>
            <nav className="hidden md:flex gap-6">
              <button
                onClick={() => handleNavClick("all")}
                className={`text-sm hover:text-gray-300 transition-colors ${
                  activeFilter === "all"
                    ? "font-bold text-white"
                    : "text-gray-400"
                }`}
              >
                Home
              </button>
              <button
                onClick={() => handleNavClick("tv")}
                className={`text-sm hover:text-gray-300 transition-colors ${
                  activeFilter === "tv"
                    ? "font-bold text-white"
                    : "text-gray-400"
                }`}
              >
                TV Shows
              </button>
              <button
                onClick={() => handleNavClick("movie")}
                className={`text-sm hover:text-gray-300 transition-colors ${
                  activeFilter === "movie"
                    ? "font-bold text-white"
                    : "text-gray-400"
                }`}
              >
                Movies
              </button>
              <button
                onClick={() => handleNavClick("all")}
                className={`text-sm hover:text-gray-300 transition-colors ${
                  myList.length > 0 ? "text-gray-400" : "text-gray-600"
                }`}
                disabled={myList.length === 0}
              >
                My List {myList.length > 0 && `(${myList.length})`}
              </button>
            </nav>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            <SearchBar
              onSearch={setQuery}
              onResultClick={(result) => setSelectedMedia(result)}
              imageBaseUrl={IMAGE_BASE_URL}
            />
            <Bell className="w-5 h-5 cursor-pointer hover:text-gray-300 transition-colors" />
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      {featuredItem ? (
        <Hero
          item={{
            id: featuredItem.id,
            title: featuredItem.title,
            description:
              featuredItem.description || featuredItem.overview || "",
            backdropPath: featuredItem.backdropPath || featuredItem.posterPath,
            posterPath: featuredItem.posterPath,
            year:
              featuredItem.year ||
              (featuredItem.releaseDate
                ? new Date(featuredItem.releaseDate).getFullYear()
                : new Date().getFullYear()),
            genre: featuredItem.genre || [],
            rating: featuredItem.rating || featuredItem.voteAverage || 0,
            matchScore: featuredItem.matchScore
              ? Math.round(featuredItem.matchScore * 100)
              : undefined,
          }}
          onMoreInfo={() => setSelectedMedia(featuredItem)}
          imageBaseUrl={BACKDROP_BASE_URL}
        />
      ) : (
        // Loading skeleton for hero
        <div className="relative h-screen w-full bg-gradient-to-b from-gray-800 to-black animate-pulse">
          <div className="absolute bottom-32 left-8 md:left-16 space-y-4">
            <div className="h-12 w-96 bg-gray-700 rounded"></div>
            <div className="h-6 w-64 bg-gray-700 rounded"></div>
            <div className="h-20 w-full max-w-xl bg-gray-700 rounded"></div>
          </div>
        </div>
      )}

      {/* Content Rows */}
      <main className="relative z-10 -mt-32 pb-20 space-y-8">
        {/* My List Row */}
        {myList.length > 0 && (
          <div ref={myListRef}>
            <ContentRow
              title="My List"
              subtitle={`${myList.length} ${myList.length === 1 ? "item" : "items"}`}
              items={myList.map((item) => ({
                id: item.id,
                title: item.title,
                posterPath: item.posterPath,
                rating: item.rating || 0,
                year: item.year,
                mediaType: item.mediaType,
              }))}
              onItemClick={setSelectedMedia}
              imageBaseUrl={IMAGE_BASE_URL}
            />
          </div>
        )}

        {/* Search Results Row (when searching) */}
        {query && results.length > 0 && (
          <ContentRow
            title={`Search Results for "${query}"`}
            items={results.map((item) => ({
              id: item.id,
              title: item.title,
              posterPath: item.posterPath || null,
              rating: item.rating || 0,
              year: item.year,
              mediaType: item.mediaType,
            }))}
            onItemClick={setSelectedMedia}
            imageBaseUrl={IMAGE_BASE_URL}
          />
        )}

        {/* Search Loading State */}
        {query && searchLoading && (
          <div className="py-8 px-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-6 w-48 bg-gray-800 rounded animate-pulse"></div>
            </div>
            <div className="flex gap-3 overflow-hidden">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="w-[200px] flex-shrink-0">
                  <div className="aspect-[2/3] bg-gray-800 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trending Row */}
        {trending.length > 0 && filterByType(trending).length > 0 ? (
          <ContentRow
            title={
              activeFilter === "tv"
                ? "Trending TV Shows"
                : activeFilter === "movie"
                  ? "Trending Movies"
                  : "Trending Now"
            }
            subtitle="Updated daily"
            items={filterByType(trending).map((item) => ({
              id: item.id,
              title: item.title,
              posterPath: item.posterPath,
              rating: item.rating || item.voteAverage || 0,
              year: item.year,
              mediaType: item.mediaType,
            }))}
            onItemClick={setSelectedMedia}
            imageBaseUrl={IMAGE_BASE_URL}
          />
        ) : trendingLoading && activeFilter === "all" ? (
          // Loading skeleton for trending
          <div className="py-8 px-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-6 w-48 bg-gray-800 rounded animate-pulse"></div>
            </div>
            <div className="flex gap-3 overflow-hidden">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="w-[200px] flex-shrink-0">
                  <div className="aspect-[2/3] bg-gray-800 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Recommendations Row */}
        {recommendations.length > 0 &&
        filterByType(recommendations).length > 0 ? (
          <ContentRow
            title={
              activeFilter === "tv"
                ? "Recommended TV Shows"
                : activeFilter === "movie"
                  ? "Recommended Movies"
                  : "Recommended For You"
            }
            subtitle="Based on your viewing history"
            items={filterByType(recommendations).map((item) => ({
              id: item.id,
              title: item.title,
              posterPath: item.posterPath,
              rating: item.rating || item.voteAverage || 0,
              year: item.year,
              mediaType: item.mediaType,
            }))}
            onItemClick={setSelectedMedia}
            imageBaseUrl={IMAGE_BASE_URL}
          />
        ) : recsLoading && activeFilter === "all" ? (
          // Loading skeleton for recommendations
          <div className="py-8 px-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-6 w-64 bg-gray-800 rounded animate-pulse"></div>
            </div>
            <div className="flex gap-3 overflow-hidden">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="w-[200px] flex-shrink-0">
                  <div className="aspect-[2/3] bg-gray-800 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Action & Adventure Row */}
        {filterByType(
          recommendations.filter((r) =>
            r.genre?.some((g) => ["Action", "Adventure"].includes(g)),
          ),
        ).length > 0 && (
          <ContentRow
            title="Action & Adventure"
            items={filterByType(
              recommendations.filter((r) =>
                r.genre?.some((g) => ["Action", "Adventure"].includes(g)),
              ),
            ).map((item) => ({
              id: item.id,
              title: item.title,
              posterPath: item.posterPath,
              rating: item.rating || 0,
              year: item.year,
              mediaType: item.mediaType,
            }))}
            onItemClick={setSelectedMedia}
            imageBaseUrl={IMAGE_BASE_URL}
          />
        )}

        {/* Comedy Row */}
        {filterByType(
          recommendations.filter((r) => r.genre?.some((g) => g === "Comedy")),
        ).length > 0 && (
          <ContentRow
            title="Comedy Picks"
            items={filterByType(
              recommendations.filter((r) =>
                r.genre?.some((g) => g === "Comedy"),
              ),
            ).map((item) => ({
              id: item.id,
              title: item.title,
              posterPath: item.posterPath,
              rating: item.rating || 0,
              year: item.year,
              mediaType: item.mediaType,
            }))}
            onItemClick={setSelectedMedia}
            imageBaseUrl={IMAGE_BASE_URL}
          />
        )}

        {/* Drama Row */}
        {filterByType(
          recommendations.filter((r) => r.genre?.some((g) => g === "Drama")),
        ).length > 0 && (
          <ContentRow
            title="Drama Collection"
            items={filterByType(
              recommendations.filter((r) =>
                r.genre?.some((g) => g === "Drama"),
              ),
            ).map((item) => ({
              id: item.id,
              title: item.title,
              posterPath: item.posterPath,
              rating: item.rating || 0,
              year: item.year,
              mediaType: item.mediaType,
            }))}
            onItemClick={setSelectedMedia}
            imageBaseUrl={IMAGE_BASE_URL}
          />
        )}

        {/* TV Shows Specific Rows */}
        {activeFilter === "tv" && filterByType(trending).length > 0 && (
          <>
            <ContentRow
              title="Popular Series"
              subtitle="Most watched TV shows"
              items={filterByType(trending)
                .slice(0, 10)
                .map((item) => ({
                  id: item.id,
                  title: item.title,
                  posterPath: item.posterPath,
                  rating: item.rating || item.voteAverage || 0,
                  year: item.year,
                  mediaType: item.mediaType,
                }))}
              onItemClick={setSelectedMedia}
              imageBaseUrl={IMAGE_BASE_URL}
            />
          </>
        )}

        {/* Movies Specific Rows */}
        {activeFilter === "movie" && filterByType(trending).length > 0 && (
          <>
            <ContentRow
              title="Box Office Hits"
              subtitle="Top rated movies"
              items={filterByType(trending)
                .slice(0, 10)
                .map((item) => ({
                  id: item.id,
                  title: item.title,
                  posterPath: item.posterPath,
                  rating: item.rating || item.voteAverage || 0,
                  year: item.year,
                  mediaType: item.mediaType,
                }))}
              onItemClick={setSelectedMedia}
              imageBaseUrl={IMAGE_BASE_URL}
            />
          </>
        )}

        {/* Empty State - No Content for Filter */}
        {!trendingLoading &&
          !recsLoading &&
          filterByType(trending).length === 0 &&
          filterByType(recommendations).length === 0 &&
          !query &&
          activeFilter !== "all" && (
            <div className="py-20 px-8 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <div className="text-6xl">📺</div>
                <h2 className="text-2xl font-bold">
                  No {activeFilter === "tv" ? "TV Shows" : "Movies"} available
                </h2>
                <p className="text-gray-400">
                  Try switching to a different category or search for specific
                  content.
                </p>
              </div>
            </div>
          )}

        {/* Empty State - No Content */}
        {!trendingLoading &&
          !recsLoading &&
          trending.length === 0 &&
          recommendations.length === 0 &&
          !query &&
          activeFilter === "all" && (
            <div className="py-20 px-8 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <div className="text-6xl">🎬</div>
                <h2 className="text-2xl font-bold">No content available</h2>
                <p className="text-gray-400">
                  Start exploring by searching for movies and TV shows above.
                </p>
              </div>
            </div>
          )}

        {/* Empty State - No Search Results */}
        {query && !searchLoading && results.length === 0 && (
          <div className="py-20 px-8 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <div className="text-6xl">🔍</div>
              <h2 className="text-2xl font-bold">No results found</h2>
              <p className="text-gray-400">
                Try searching for something else or check your spelling.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Detail Modal */}
      <DetailModal
        item={
          selectedMedia
            ? {
                id: selectedMedia.id,
                title: selectedMedia.title,
                description:
                  selectedMedia.description || selectedMedia.overview || "",
                backdropPath:
                  selectedMedia.backdropPath || selectedMedia.posterPath,
                posterPath: selectedMedia.posterPath,
                year:
                  selectedMedia.year ||
                  (selectedMedia.releaseDate
                    ? new Date(selectedMedia.releaseDate).getFullYear()
                    : new Date().getFullYear()),
                genre: selectedMedia.genre || [],
                rating: selectedMedia.rating || selectedMedia.voteAverage || 0,
                matchScore: selectedMedia.matchScore
                  ? Math.round(selectedMedia.matchScore * 100)
                  : undefined,
                availability: selectedMedia.availability || [],
                isInList: isInMyList(selectedMedia.id),
                mediaType: selectedMedia.mediaType || "movie",
              }
            : null
        }
        isOpen={!!selectedMedia}
        onClose={() => setSelectedMedia(null)}
        onToggleMyList={() => selectedMedia && toggleMyList(selectedMedia)}
        imageBaseUrl={BACKDROP_BASE_URL}
      />
    </div>
  );
}

export default App;

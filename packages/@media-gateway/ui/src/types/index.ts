/**
 * Shared types for UI components
 */

export type MediaType = "movie" | "tv" | "anime";

export interface MediaItem {
  id: number;
  title: string;
  posterPath: string | null;
  backdropPath?: string | null;
  overview?: string;
  releaseDate?: string;
  voteAverage: number;
  voteCount?: number;
  mediaType: MediaType;
  genreIds?: number[];
  genres?: { id: number; name: string }[];
  runtime?: number;
  status?: string;
  tagline?: string;
}

export interface Platform {
  id: string;
  name: string;
  logo?: string;
  url?: string;
}

export interface WatchProvider {
  platform: Platform;
  type: "stream" | "rent" | "buy";
  price?: number;
}

export interface GenreAffinity {
  genreId: number;
  genreName: string;
  affinity: number;
}

export interface UserPreference {
  userId: string;
  favoriteGenres: GenreAffinity[];
  watchHistory: number[];
  ratings: Record<number, number>;
}

export interface GroupMember {
  userId: string;
  displayName: string;
  avatar?: string;
  isHost?: boolean;
}

export interface GroupSession {
  sessionId: string;
  name: string;
  members: GroupMember[];
  currentContent?: MediaItem;
  votes: Record<string, "yes" | "no" | "maybe">;
}

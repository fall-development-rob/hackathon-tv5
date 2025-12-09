/**
 * Shared types for UI components
 * Aligned with @media-gateway/core types
 */

import type { MediaContent, Content, Movie, Series } from '@media-gateway/core';

// Re-export core MediaType to ensure alignment
export type { MediaType, MediaContent, Genre } from '@media-gateway/core';

/**
 * UI MediaItem interface
 * Extended version of MediaContent for UI display purposes
 */
export interface MediaItem {
  id: number;
  title: string;
  posterPath: string | null;
  backdropPath?: string | null;
  overview?: string;
  releaseDate?: string;
  voteAverage: number;
  voteCount?: number;
  mediaType: 'movie' | 'tv';
  genreIds?: number[];
  genres?: { id: number; name: string }[];
  runtime?: number;
  status?: string;
  tagline?: string;
  popularity?: number;
}

/**
 * Type adapter utilities for converting between core and UI types
 */

/**
 * Convert core Content entity to UI MediaItem
 */
export function contentToMediaItem(content: Content): MediaItem {
  return {
    id: content.id,
    title: content.title,
    posterPath: content.posterPath,
    backdropPath: content.backdropPath,
    overview: content.overview,
    releaseDate: content.releaseDate,
    voteAverage: content.voteAverage,
    voteCount: content.voteCount,
    mediaType: content.mediaType,
    genreIds: content.genreIds,
    popularity: content.popularity,
  };
}

/**
 * Convert core Movie entity to UI MediaItem with movie-specific fields
 */
export function movieToMediaItem(movie: Movie): MediaItem {
  return {
    ...contentToMediaItem(movie),
    runtime: movie.runtime,
    status: movie.status,
    tagline: movie.tagline,
  };
}

/**
 * Convert core Series entity to UI MediaItem with series-specific fields
 */
export function seriesToMediaItem(series: Series): MediaItem {
  return {
    ...contentToMediaItem(series),
    status: series.status,
  };
}

/**
 * Convert core MediaContent interface to UI MediaItem
 */
export function mediaContentToMediaItem(content: MediaContent): MediaItem {
  return {
    id: content.id,
    title: content.title,
    posterPath: content.posterPath,
    backdropPath: content.backdropPath,
    overview: content.overview,
    releaseDate: content.releaseDate,
    voteAverage: content.voteAverage,
    voteCount: content.voteCount,
    mediaType: content.mediaType,
    genreIds: content.genreIds,
    popularity: content.popularity,
  };
}

/**
 * Convert UI MediaItem back to core MediaContent
 */
export function mediaItemToContent(item: MediaItem): MediaContent {
  return {
    id: item.id,
    title: item.title,
    overview: item.overview ?? '',
    mediaType: item.mediaType,
    genreIds: item.genreIds ?? [],
    voteAverage: item.voteAverage,
    voteCount: item.voteCount ?? 0,
    releaseDate: item.releaseDate ?? '',
    posterPath: item.posterPath,
    backdropPath: item.backdropPath ?? null,
    popularity: item.popularity ?? 0,
  };
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

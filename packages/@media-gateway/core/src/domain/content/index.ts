/**
 * Content Domain Layer
 *
 * Domain entities and value objects for media content.
 * Contains Content, Movie, Series, Episode types and related entities.
 */

// Re-export content-related types from existing types
export type {
  MediaType,
  MediaContent,
  MediaDetails,
  Genre,
  CastMember,
  Language,
  ProductionCompany,
  ContentFingerprint,
} from '../../types/index.js';

/**
 * Content Entity
 * Base entity for all media content with business logic
 */
export class Content {
  constructor(
    public readonly id: number,
    public readonly title: string,
    public readonly overview: string,
    public readonly mediaType: 'movie' | 'tv',
    public readonly genreIds: number[],
    public readonly voteAverage: number,
    public readonly voteCount: number,
    public readonly releaseDate: string,
    public readonly posterPath: string | null,
    public readonly backdropPath: string | null,
    public readonly popularity: number
  ) {}

  /**
   * Check if content is highly rated
   */
  isHighlyRated(): boolean {
    return this.voteAverage >= 7.0 && this.voteCount >= 100;
  }

  /**
   * Check if content is popular
   */
  isPopular(): boolean {
    return this.popularity >= 50;
  }

  /**
   * Get content age in days
   */
  getAgeInDays(): number {
    const releaseDate = new Date(this.releaseDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - releaseDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if content is recent (released within last 90 days)
   */
  isRecent(): boolean {
    return this.getAgeInDays() <= 90;
  }

  /**
   * Get poster URL for display
   */
  getPosterUrl(baseUrl: string = 'https://image.tmdb.org/t/p/w500'): string | null {
    return this.posterPath ? `${baseUrl}${this.posterPath}` : null;
  }

  /**
   * Get backdrop URL for display
   */
  getBackdropUrl(baseUrl: string = 'https://image.tmdb.org/t/p/original'): string | null {
    return this.backdropPath ? `${baseUrl}${this.backdropPath}` : null;
  }
}

/**
 * Movie Entity
 * Extends Content with movie-specific properties and behavior
 */
export class Movie extends Content {
  constructor(
    id: number,
    title: string,
    overview: string,
    genreIds: number[],
    voteAverage: number,
    voteCount: number,
    releaseDate: string,
    posterPath: string | null,
    backdropPath: string | null,
    popularity: number,
    public readonly runtime?: number,
    public readonly budget?: number,
    public readonly revenue?: number,
    public readonly status?: string,
    public readonly tagline?: string
  ) {
    super(id, title, overview, 'movie', genreIds, voteAverage, voteCount, releaseDate, posterPath, backdropPath, popularity);
  }

  /**
   * Check if movie is a blockbuster (high budget and revenue)
   */
  isBlockbuster(): boolean {
    return (this.budget ?? 0) >= 100_000_000 && (this.revenue ?? 0) >= 500_000_000;
  }

  /**
   * Get runtime in hours and minutes
   */
  getRuntimeFormatted(): string | null {
    if (!this.runtime) return null;
    const hours = Math.floor(this.runtime / 60);
    const minutes = this.runtime % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  /**
   * Check if movie is profitable
   */
  isProfitable(): boolean {
    return (this.revenue ?? 0) > (this.budget ?? 0);
  }

  /**
   * Get profit margin
   */
  getProfitMargin(): number | null {
    if (!this.budget || !this.revenue || this.budget === 0) return null;
    return ((this.revenue - this.budget) / this.budget) * 100;
  }
}

/**
 * Series Entity
 * Extends Content with TV series-specific properties
 */
export class Series extends Content {
  constructor(
    id: number,
    title: string,
    overview: string,
    genreIds: number[],
    voteAverage: number,
    voteCount: number,
    releaseDate: string,
    posterPath: string | null,
    backdropPath: string | null,
    popularity: number,
    public readonly numberOfSeasons?: number,
    public readonly numberOfEpisodes?: number,
    public readonly status?: 'Returning Series' | 'Ended' | 'Canceled',
    public readonly networks?: string[]
  ) {
    super(id, title, overview, 'tv', genreIds, voteAverage, voteCount, releaseDate, posterPath, backdropPath, popularity);
  }

  /**
   * Check if series is still airing
   */
  isOngoing(): boolean {
    return this.status === 'Returning Series';
  }

  /**
   * Check if series has ended
   */
  hasEnded(): boolean {
    return this.status === 'Ended' || this.status === 'Canceled';
  }

  /**
   * Get average episodes per season
   */
  getAverageEpisodesPerSeason(): number | null {
    if (!this.numberOfSeasons || !this.numberOfEpisodes) return null;
    return Math.round(this.numberOfEpisodes / this.numberOfSeasons);
  }

  /**
   * Check if series is a limited series (single season)
   */
  isLimitedSeries(): boolean {
    return (this.numberOfSeasons ?? 0) === 1;
  }
}

/**
 * Episode Entity
 * Represents an individual episode of a TV series
 */
export class Episode {
  constructor(
    public readonly id: number,
    public readonly seriesId: number,
    public readonly seasonNumber: number,
    public readonly episodeNumber: number,
    public readonly name: string,
    public readonly overview: string,
    public readonly airDate: string,
    public readonly runtime?: number,
    public readonly voteAverage?: number,
    public readonly stillPath?: string | null
  ) {}

  /**
   * Get episode identifier string (e.g., "S01E05")
   */
  getEpisodeCode(): string {
    const season = String(this.seasonNumber).padStart(2, '0');
    const episode = String(this.episodeNumber).padStart(2, '0');
    return `S${season}E${episode}`;
  }

  /**
   * Check if episode has aired
   */
  hasAired(): boolean {
    const airDate = new Date(this.airDate);
    const today = new Date();
    return airDate <= today;
  }

  /**
   * Get still image URL
   */
  getStillUrl(baseUrl: string = 'https://image.tmdb.org/t/p/w500'): string | null {
    return this.stillPath ? `${baseUrl}${this.stillPath}` : null;
  }

  /**
   * Check if episode is highly rated
   */
  isHighlyRated(): boolean {
    return (this.voteAverage ?? 0) >= 8.0;
  }
}

/**
 * Genre Value Object
 * Represents a content genre with immutable properties
 */
export class GenreEntity {
  constructor(
    public readonly id: number,
    public readonly name: string
  ) {}

  /**
   * Check if genre matches another genre
   */
  equals(other: GenreEntity): boolean {
    return this.id === other.id;
  }

  /**
   * Get normalized genre name (lowercase)
   */
  getNormalizedName(): string {
    return this.name.toLowerCase();
  }
}

/**
 * TMDB Adapter
 * Integrates with The Movie Database API for content metadata
 * Provides unified interface for movie and TV show data
 */

import type { MediaContent } from '@media-gateway/core';

/**
 * TMDB API Configuration
 */
export interface TMDBConfig {
  apiKey: string;
  baseUrl?: string;
  imageBaseUrl?: string;
  language?: string;
  region?: string;
}

/**
 * TMDB Movie Response
 */
interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  poster_path: string | null;
  backdrop_path: string | null;
  adult: boolean;
  original_language: string;
  original_title: string;
}

/**
 * TMDB TV Show Response
 */
interface TMDBTVShow {
  id: number;
  name: string;
  overview: string;
  first_air_date: string;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  poster_path: string | null;
  backdrop_path: string | null;
  origin_country: string[];
  original_language: string;
  original_name: string;
}

/**
 * TMDB Search Response
 */
interface TMDBSearchResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

/**
 * TMDB Watch Provider Response
 */
interface TMDBWatchProvider {
  display_priority: number;
  logo_path: string;
  provider_id: number;
  provider_name: string;
}

/**
 * TMDB Watch Providers Result
 */
interface TMDBWatchProvidersResult {
  results: {
    [countryCode: string]: {
      link: string;
      flatrate?: TMDBWatchProvider[];
      rent?: TMDBWatchProvider[];
      buy?: TMDBWatchProvider[];
      free?: TMDBWatchProvider[];
    };
  };
}

/**
 * TMDB Adapter class
 * Handles all TMDB API interactions
 */
export class TMDBAdapter {
  private config: Required<TMDBConfig>;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly cacheTTL = 3600000; // 1 hour

  constructor(config: TMDBConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? 'https://api.themoviedb.org/3',
      imageBaseUrl: config.imageBaseUrl ?? 'https://image.tmdb.org/t/p',
      language: config.language ?? 'en-US',
      region: config.region ?? 'US',
    };
  }

  /**
   * Make authenticated request to TMDB API
   */
  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data as T;
    }

    const url = new URL(`${this.config.baseUrl}${endpoint}`);
    url.searchParams.set('api_key', this.config.apiKey);
    url.searchParams.set('language', this.config.language);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as T;

    this.cache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  }

  /**
   * Search for movies
   */
  async searchMovies(query: string, page: number = 1): Promise<MediaContent[]> {
    const response = await this.request<TMDBSearchResponse<TMDBMovie>>(
      '/search/movie',
      { query, page: page.toString() }
    );

    return response.results.map(movie => this.transformMovie(movie));
  }

  /**
   * Search for TV shows
   */
  async searchTVShows(query: string, page: number = 1): Promise<MediaContent[]> {
    const response = await this.request<TMDBSearchResponse<TMDBTVShow>>(
      '/search/tv',
      { query, page: page.toString() }
    );

    return response.results.map(show => this.transformTVShow(show));
  }

  /**
   * Search for both movies and TV shows
   */
  async searchMulti(query: string, page: number = 1): Promise<MediaContent[]> {
    const [movies, shows] = await Promise.all([
      this.searchMovies(query, page),
      this.searchTVShows(query, page),
    ]);

    // Merge and sort by popularity
    return [...movies, ...shows].sort((a, b) => b.popularity - a.popularity);
  }

  /**
   * Get movie details
   */
  async getMovie(id: number): Promise<MediaContent> {
    const movie = await this.request<TMDBMovie & {
      runtime: number;
      genres: Array<{ id: number; name: string }>;
      production_companies: Array<{ id: number; name: string }>;
    }>(`/movie/${id}`);

    return this.transformMovie(movie);
  }

  /**
   * Get TV show details
   */
  async getTVShow(id: number): Promise<MediaContent> {
    const show = await this.request<TMDBTVShow & {
      episode_run_time: number[];
      genres: Array<{ id: number; name: string }>;
      networks: Array<{ id: number; name: string }>;
      number_of_seasons: number;
      number_of_episodes: number;
    }>(`/tv/${id}`);

    return this.transformTVShow(show);
  }

  /**
   * Get trending content
   */
  async getTrending(
    mediaType: 'movie' | 'tv' | 'all' = 'all',
    timeWindow: 'day' | 'week' = 'week'
  ): Promise<MediaContent[]> {
    const response = await this.request<TMDBSearchResponse<TMDBMovie | TMDBTVShow>>(
      `/trending/${mediaType}/${timeWindow}`
    );

    return response.results.map(item => {
      if ('title' in item) {
        return this.transformMovie(item as TMDBMovie);
      }
      return this.transformTVShow(item as TMDBTVShow);
    });
  }

  /**
   * Get popular movies
   */
  async getPopularMovies(page: number = 1): Promise<MediaContent[]> {
    const response = await this.request<TMDBSearchResponse<TMDBMovie>>(
      '/movie/popular',
      { page: page.toString() }
    );

    return response.results.map(movie => this.transformMovie(movie));
  }

  /**
   * Get popular TV shows
   */
  async getPopularTVShows(page: number = 1): Promise<MediaContent[]> {
    const response = await this.request<TMDBSearchResponse<TMDBTVShow>>(
      '/tv/popular',
      { page: page.toString() }
    );

    return response.results.map(show => this.transformTVShow(show));
  }

  /**
   * Discover movies with filters
   */
  async discoverMovies(filters: {
    genres?: number[];
    yearMin?: number;
    yearMax?: number;
    ratingMin?: number;
    sortBy?: string;
    page?: number;
  }): Promise<MediaContent[]> {
    const params: Record<string, string> = {
      page: (filters.page ?? 1).toString(),
      sort_by: filters.sortBy ?? 'popularity.desc',
    };

    if (filters.genres?.length) {
      params['with_genres'] = filters.genres.join(',');
    }
    if (filters.yearMin) {
      params['primary_release_date.gte'] = `${filters.yearMin}-01-01`;
    }
    if (filters.yearMax) {
      params['primary_release_date.lte'] = `${filters.yearMax}-12-31`;
    }
    if (filters.ratingMin) {
      params['vote_average.gte'] = filters.ratingMin.toString();
    }

    const response = await this.request<TMDBSearchResponse<TMDBMovie>>(
      '/discover/movie',
      params
    );

    return response.results.map(movie => this.transformMovie(movie));
  }

  /**
   * Get watch providers for content
   */
  async getWatchProviders(
    id: number,
    mediaType: 'movie' | 'tv'
  ): Promise<TMDBWatchProvidersResult> {
    return this.request<TMDBWatchProvidersResult>(
      `/${mediaType}/${id}/watch/providers`
    );
  }

  /**
   * Get similar content
   */
  async getSimilar(
    id: number,
    mediaType: 'movie' | 'tv',
    page: number = 1
  ): Promise<MediaContent[]> {
    const response = await this.request<TMDBSearchResponse<TMDBMovie | TMDBTVShow>>(
      `/${mediaType}/${id}/similar`,
      { page: page.toString() }
    );

    return response.results.map(item => {
      if ('title' in item) {
        return this.transformMovie(item as TMDBMovie);
      }
      return this.transformTVShow(item as TMDBTVShow);
    });
  }

  /**
   * Get recommendations based on content
   */
  async getRecommendations(
    id: number,
    mediaType: 'movie' | 'tv',
    page: number = 1
  ): Promise<MediaContent[]> {
    const response = await this.request<TMDBSearchResponse<TMDBMovie | TMDBTVShow>>(
      `/${mediaType}/${id}/recommendations`,
      { page: page.toString() }
    );

    return response.results.map(item => {
      if ('title' in item) {
        return this.transformMovie(item as TMDBMovie);
      }
      return this.transformTVShow(item as TMDBTVShow);
    });
  }

  /**
   * Transform TMDB movie to MediaContent
   */
  private transformMovie(movie: TMDBMovie): MediaContent {
    return {
      id: movie.id,
      title: movie.title,
      overview: movie.overview,
      mediaType: 'movie',
      genreIds: movie.genre_ids,
      voteAverage: movie.vote_average,
      voteCount: movie.vote_count,
      releaseDate: movie.release_date,
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
      popularity: movie.popularity,
    };
  }

  /**
   * Transform TMDB TV show to MediaContent
   */
  private transformTVShow(show: TMDBTVShow): MediaContent {
    return {
      id: show.id,
      title: show.name,
      overview: show.overview,
      mediaType: 'tv',
      genreIds: show.genre_ids,
      voteAverage: show.vote_average,
      voteCount: show.vote_count,
      releaseDate: show.first_air_date,
      posterPath: show.poster_path,
      backdropPath: show.backdrop_path,
      popularity: show.popularity,
    };
  }

  /**
   * Get image URL
   */
  getImageUrl(path: string | null, size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'): string | null {
    if (!path) return null;
    return `${this.config.imageBaseUrl}/${size}${path}`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clean expired cache entries
   */
  cleanCache(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.cache) {
      if (now - value.timestamp > this.cacheTTL) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

/**
 * Create a new TMDB Adapter instance
 */
export function createTMDBAdapter(config: TMDBConfig): TMDBAdapter {
  return new TMDBAdapter(config);
}

/**
 * Content Ingestion Service
 * Handles ingestion of content from TMDB into vector database
 * Builds the content fingerprint database for the data moat
 */

import type { MediaContent } from '@media-gateway/core';
import { TMDBAdapter, type TMDBConfig } from '../adapters/TMDBAdapter.js';

/**
 * Ingestion configuration
 */
export interface IngestionConfig {
  tmdb: TMDBConfig;
  batchSize?: number;
  delayMs?: number;
  maxPages?: number;
}

/**
 * Ingestion progress callback
 */
export type IngestionProgressCallback = (progress: {
  total: number;
  processed: number;
  current: string;
  errors: number;
}) => void;

/**
 * Ingestion result
 */
export interface IngestionResult {
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  duration: number;
  errors: Array<{ id: number; error: string }>;
}

/**
 * Vector store interface for ingestion
 */
export interface VectorStore {
  upsertContent(content: MediaContent, embedding: Float32Array): Promise<void>;
  generateEmbedding(text: string): Promise<Float32Array | null>;
}

/**
 * Content Ingestion Service class
 * Manages bulk import of content into the system
 */
export class ContentIngestionService {
  private tmdbAdapter: TMDBAdapter;
  private config: Required<IngestionConfig>;

  constructor(config: IngestionConfig) {
    this.tmdbAdapter = new TMDBAdapter(config.tmdb);
    this.config = {
      tmdb: config.tmdb,
      batchSize: config.batchSize ?? 20,
      delayMs: config.delayMs ?? 250,
      maxPages: config.maxPages ?? 100,
    };
  }

  /**
   * Ingest popular movies
   */
  async ingestPopularMovies(
    vectorStore: VectorStore,
    onProgress?: IngestionProgressCallback
  ): Promise<IngestionResult> {
    return this.ingestContent(
      async (page) => this.tmdbAdapter.getPopularMovies(page),
      vectorStore,
      'Popular Movies',
      onProgress
    );
  }

  /**
   * Ingest popular TV shows
   */
  async ingestPopularTVShows(
    vectorStore: VectorStore,
    onProgress?: IngestionProgressCallback
  ): Promise<IngestionResult> {
    return this.ingestContent(
      async (page) => this.tmdbAdapter.getPopularTVShows(page),
      vectorStore,
      'Popular TV Shows',
      onProgress
    );
  }

  /**
   * Ingest trending content
   */
  async ingestTrending(
    vectorStore: VectorStore,
    mediaType: 'movie' | 'tv' | 'all' = 'all',
    onProgress?: IngestionProgressCallback
  ): Promise<IngestionResult> {
    return this.ingestContent(
      async (_page) => this.tmdbAdapter.getTrending(mediaType, 'week'),
      vectorStore,
      `Trending ${mediaType}`,
      onProgress,
      1 // Trending only has 1 page
    );
  }

  /**
   * Ingest content by genre
   */
  async ingestByGenre(
    vectorStore: VectorStore,
    genreIds: number[],
    onProgress?: IngestionProgressCallback
  ): Promise<IngestionResult> {
    return this.ingestContent(
      async (page) => this.tmdbAdapter.discoverMovies({ genres: genreIds, page }),
      vectorStore,
      `Genre ${genreIds.join(',')}`,
      onProgress
    );
  }

  /**
   * Generic content ingestion
   */
  private async ingestContent(
    fetcher: (page: number) => Promise<MediaContent[]>,
    vectorStore: VectorStore,
    source: string,
    onProgress?: IngestionProgressCallback,
    maxPages?: number
  ): Promise<IngestionResult> {
    const startTime = Date.now();
    const errors: Array<{ id: number; error: string }> = [];
    let totalProcessed = 0;
    let successCount = 0;
    let errorCount = 0;
    const pages = maxPages ?? this.config.maxPages;

    for (let page = 1; page <= pages; page++) {
      try {
        const contents = await fetcher(page);

        if (contents.length === 0) {
          break; // No more content
        }

        // Process in batches
        for (let i = 0; i < contents.length; i += this.config.batchSize) {
          const batch = contents.slice(i, i + this.config.batchSize);

          await Promise.all(
            batch.map(async (content) => {
              try {
                const embeddingText = this.createEmbeddingText(content);
                const embedding = await vectorStore.generateEmbedding(embeddingText);

                if (embedding) {
                  await vectorStore.upsertContent(content, embedding);
                  successCount++;
                } else {
                  errorCount++;
                  errors.push({ id: content.id, error: 'Failed to generate embedding' });
                }
              } catch (error) {
                errorCount++;
                errors.push({
                  id: content.id,
                  error: (error as Error).message,
                });
              }

              totalProcessed++;

              if (onProgress) {
                onProgress({
                  total: page * 20,
                  processed: totalProcessed,
                  current: `${source} - Page ${page}`,
                  errors: errorCount,
                });
              }
            })
          );

          // Delay between batches to avoid rate limiting
          await this.delay(this.config.delayMs);
        }

        // Delay between pages
        await this.delay(this.config.delayMs * 2);
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error);
        // Continue with next page
      }
    }

    return {
      totalProcessed,
      successCount,
      errorCount,
      duration: Date.now() - startTime,
      errors: errors.slice(0, 100), // Limit error list
    };
  }

  /**
   * Create embedding text from content
   */
  private createEmbeddingText(content: MediaContent): string {
    const genreNames = content.genreIds.map(id => this.getGenreName(id)).join(', ');

    return [
      content.title,
      content.overview,
      genreNames,
      content.mediaType === 'movie' ? 'Movie' : 'TV Series',
      content.releaseDate?.substring(0, 4) ?? '',
    ].filter(Boolean).join(' | ');
  }

  /**
   * Get genre name from ID
   */
  private getGenreName(id: number): string {
    const genres: Record<number, string> = {
      28: 'Action',
      12: 'Adventure',
      16: 'Animation',
      35: 'Comedy',
      80: 'Crime',
      99: 'Documentary',
      18: 'Drama',
      10751: 'Family',
      14: 'Fantasy',
      36: 'History',
      27: 'Horror',
      10402: 'Music',
      9648: 'Mystery',
      10749: 'Romance',
      878: 'Science Fiction',
      10770: 'TV Movie',
      53: 'Thriller',
      10752: 'War',
      37: 'Western',
      // TV genres
      10759: 'Action & Adventure',
      10762: 'Kids',
      10763: 'News',
      10764: 'Reality',
      10765: 'Sci-Fi & Fantasy',
      10766: 'Soap',
      10767: 'Talk',
      10768: 'War & Politics',
    };
    return genres[id] ?? 'Unknown';
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Ingest full catalog (all content types)
   */
  async ingestFullCatalog(
    vectorStore: VectorStore,
    onProgress?: IngestionProgressCallback
  ): Promise<{
    movies: IngestionResult;
    tvShows: IngestionResult;
    trending: IngestionResult;
    total: IngestionResult;
  }> {
    const results = {
      movies: await this.ingestPopularMovies(vectorStore, onProgress),
      tvShows: await this.ingestPopularTVShows(vectorStore, onProgress),
      trending: await this.ingestTrending(vectorStore, 'all', onProgress),
      total: {
        totalProcessed: 0,
        successCount: 0,
        errorCount: 0,
        duration: 0,
        errors: [] as Array<{ id: number; error: string }>,
      },
    };

    // Aggregate totals
    results.total = {
      totalProcessed: results.movies.totalProcessed + results.tvShows.totalProcessed + results.trending.totalProcessed,
      successCount: results.movies.successCount + results.tvShows.successCount + results.trending.successCount,
      errorCount: results.movies.errorCount + results.tvShows.errorCount + results.trending.errorCount,
      duration: results.movies.duration + results.tvShows.duration + results.trending.duration,
      errors: [
        ...results.movies.errors,
        ...results.tvShows.errors,
        ...results.trending.errors,
      ].slice(0, 100),
    };

    return results;
  }
}

/**
 * Create a new Content Ingestion Service instance
 */
export function createContentIngestionService(
  config: IngestionConfig
): ContentIngestionService {
  return new ContentIngestionService(config);
}

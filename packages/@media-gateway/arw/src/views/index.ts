/**
 * ARW Machine Views
 * Generates machine-readable views of content for AI agents
 * Supports JSON-LD, structured data, and ARW-specific formats
 */

import type { MediaContent, Recommendation, GroupSession, PlatformAvailability } from '@media-gateway/core';

/**
 * View format types
 */
export type ViewFormat = 'json' | 'json-ld' | 'arw';

/**
 * Machine view configuration
 */
export interface MachineViewConfig {
  format: ViewFormat;
  includeEmbeddings?: boolean;
  includeAvailability?: boolean;
  baseUrl?: string;
}

/**
 * JSON-LD structured content
 */
export interface JsonLdContent {
  '@context': string | object;
  '@type': string;
  '@id': string;
  [key: string]: any;
}

/**
 * ARW-specific view with semantic annotations
 */
export interface ARWView {
  $arw: {
    version: string;
    type: string;
    actions: string[];
  };
  data: any;
  meta: {
    generated: string;
    ttl: number;
    source: string;
  };
}

/**
 * Machine View Generator
 */
export class MachineViewGenerator {
  private config: MachineViewConfig;
  private baseUrl: string;

  constructor(config: MachineViewConfig) {
    this.config = {
      format: 'json',
      includeEmbeddings: false,
      includeAvailability: true,
      ...config,
    };
    this.baseUrl = config.baseUrl ?? 'https://media-gateway.io';
  }

  /**
   * Generate machine view for media content
   */
  generateContentView(content: MediaContent, availability?: PlatformAvailability[]): JsonLdContent | ARWView | object {
    switch (this.config.format) {
      case 'json-ld':
        return this.generateJsonLdContent(content, availability);
      case 'arw':
        return this.generateARWContent(content, availability);
      default:
        return this.generateJsonContent(content, availability);
    }
  }

  /**
   * Generate JSON-LD view for content
   */
  private generateJsonLdContent(content: MediaContent, availability?: PlatformAvailability[]): JsonLdContent {
    const isMovie = content.mediaType === 'movie';

    return {
      '@context': 'https://schema.org',
      '@type': isMovie ? 'Movie' : 'TVSeries',
      '@id': `${this.baseUrl}/content/${content.id}`,
      name: content.title,
      description: content.overview,
      datePublished: content.releaseDate,
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: content.voteAverage,
        ratingCount: content.voteCount,
        bestRating: 10,
        worstRating: 0,
      },
      image: content.posterPath
        ? `https://image.tmdb.org/t/p/w500${content.posterPath}`
        : undefined,
      genre: content.genreIds.map(id => this.mapGenreId(id)),
      ...(availability && {
        potentialAction: availability.map(a => ({
          '@type': 'WatchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: a.deepLink,
            actionPlatform: `https://${a.platformId}.com`,
          },
          provider: {
            '@type': 'Organization',
            name: a.platformName,
          },
        })),
      }),
    };
  }

  /**
   * Generate ARW-specific view
   */
  private generateARWContent(content: MediaContent, availability?: PlatformAvailability[]): ARWView {
    return {
      $arw: {
        version: '1.0.0',
        type: 'media:content',
        actions: [
          'search:similar',
          'recommend:based_on',
          'availability:check',
          'group:add_candidate',
        ],
      },
      data: {
        id: content.id,
        title: content.title,
        overview: content.overview,
        mediaType: content.mediaType,
        releaseDate: content.releaseDate,
        rating: {
          average: content.voteAverage,
          count: content.voteCount,
        },
        genres: content.genreIds,
        popularity: content.popularity,
        images: {
          poster: content.posterPath,
          backdrop: content.backdropPath,
        },
        availability: availability ?? [],
      },
      meta: {
        generated: new Date().toISOString(),
        ttl: 3600,
        source: this.baseUrl,
      },
    };
  }

  /**
   * Generate plain JSON view
   */
  private generateJsonContent(content: MediaContent, availability?: PlatformAvailability[]): object {
    return {
      id: content.id,
      title: content.title,
      overview: content.overview,
      mediaType: content.mediaType,
      releaseDate: content.releaseDate,
      voteAverage: content.voteAverage,
      voteCount: content.voteCount,
      genreIds: content.genreIds,
      popularity: content.popularity,
      posterPath: content.posterPath,
      backdropPath: content.backdropPath,
      ...(this.config.includeAvailability && availability && { availability }),
    };
  }

  /**
   * Generate machine view for recommendations
   */
  generateRecommendationsView(recommendations: Recommendation[]): JsonLdContent | ARWView | object {
    switch (this.config.format) {
      case 'json-ld':
        return {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          '@id': `${this.baseUrl}/recommendations`,
          name: 'Personalized Recommendations',
          itemListElement: recommendations.map((rec, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: this.generateJsonLdContent(rec.content),
          })),
        };
      case 'arw':
        return {
          $arw: {
            version: '1.0.0',
            type: 'media:recommendations',
            actions: ['preferences:feedback', 'search:refine'],
          },
          data: {
            items: recommendations.map(rec => ({
              content: rec.content,
              score: rec.score,
              reason: rec.reason,
              personalizationScore: rec.personalizationScore,
            })),
          },
          meta: {
            generated: new Date().toISOString(),
            ttl: 1800,
            source: this.baseUrl,
          },
        };
      default:
        return recommendations;
    }
  }

  /**
   * Generate machine view for group session
   */
  generateGroupSessionView(session: GroupSession): JsonLdContent | ARWView | object {
    switch (this.config.format) {
      case 'arw':
        return {
          $arw: {
            version: '1.0.0',
            type: 'group:session',
            actions: ['group:vote', 'group:finalize', 'group:leave'],
          },
          data: {
            id: session.id,
            groupId: session.groupId,
            status: session.status,
            initiatorId: session.initiatorId,
            candidates: session.candidates.map(c => ({
              contentId: c.content.id,
              title: c.content.title,
              groupScore: c.groupScore,
              fairnessScore: c.fairnessScore,
              votes: c.votes,
            })),
            selectedContentId: session.selectedContentId,
            context: session.context,
          },
          meta: {
            generated: new Date().toISOString(),
            ttl: 300,
            source: this.baseUrl,
          },
        };
      default:
        return session;
    }
  }

  /**
   * Map TMDB genre IDs to names
   */
  private mapGenreId(id: number): string {
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
    };
    return genres[id] ?? 'Unknown';
  }
}

/**
 * Create a new Machine View Generator
 */
export function createMachineViewGenerator(config: MachineViewConfig): MachineViewGenerator {
  return new MachineViewGenerator(config);
}

/**
 * Response headers for machine views
 */
export function getMachineViewHeaders(format: ViewFormat): Record<string, string> {
  switch (format) {
    case 'json-ld':
      return {
        'Content-Type': 'application/ld+json',
        'X-ARW-Format': 'json-ld',
      };
    case 'arw':
      return {
        'Content-Type': 'application/vnd.arw+json',
        'X-ARW-Version': '1.0.0',
      };
    default:
      return {
        'Content-Type': 'application/json',
      };
  }
}

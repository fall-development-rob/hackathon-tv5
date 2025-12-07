/**
 * Content Domain Layer Tests
 *
 * Tests for Content, Movie, Series, Episode, and GenreEntity domain entities
 */

import { describe, it, expect } from 'vitest';
import { Content, Movie, Series, Episode, GenreEntity } from '../../src/domain/content/index.js';

describe('Content Entity', () => {
  const createTestContent = () => new Content(
    1,
    'Test Movie',
    'A test movie description',
    'movie',
    [28, 12, 80],
    7.5,
    1000,
    '2023-06-15',
    '/poster.jpg',
    '/backdrop.jpg',
    85.5
  );

  describe('isHighlyRated', () => {
    it('should return true for content with vote average >= 7.0 and vote count >= 100', () => {
      const content = createTestContent();
      expect(content.isHighlyRated()).toBe(true);
    });

    it('should return false if vote average is below 7.0', () => {
      const content = new Content(1, 'Test', 'Desc', 'movie', [], 6.9, 1000, '2023-01-01', null, null, 50);
      expect(content.isHighlyRated()).toBe(false);
    });

    it('should return false if vote count is below 100', () => {
      const content = new Content(1, 'Test', 'Desc', 'movie', [], 8.0, 99, '2023-01-01', null, null, 50);
      expect(content.isHighlyRated()).toBe(false);
    });
  });

  describe('isPopular', () => {
    it('should return true when popularity >= 50', () => {
      const content = createTestContent();
      expect(content.isPopular()).toBe(true);
    });

    it('should return false when popularity < 50', () => {
      const content = new Content(1, 'Test', 'Desc', 'movie', [], 7.0, 100, '2023-01-01', null, null, 49.9);
      expect(content.isPopular()).toBe(false);
    });
  });

  describe('getAgeInDays', () => {
    it('should calculate correct age for old content', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 365); // 1 year ago
      const content = new Content(1, 'Test', 'Desc', 'movie', [], 7.0, 100, oldDate.toISOString().split('T')[0]!, null, null, 50);
      const age = content.getAgeInDays();
      expect(age).toBeGreaterThanOrEqual(365);
      expect(age).toBeLessThanOrEqual(366);
    });

    it('should return small number for recent content', () => {
      const today = new Date().toISOString().split('T')[0]!;
      const content = new Content(1, 'Test', 'Desc', 'movie', [], 7.0, 100, today, null, null, 50);
      expect(content.getAgeInDays()).toBeLessThanOrEqual(1);
    });
  });

  describe('isRecent', () => {
    it('should return true for content released within 90 days', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);
      const content = new Content(1, 'Test', 'Desc', 'movie', [], 7.0, 100, recentDate.toISOString().split('T')[0]!, null, null, 50);
      expect(content.isRecent()).toBe(true);
    });

    it('should return false for content older than 90 days', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 91);
      const content = new Content(1, 'Test', 'Desc', 'movie', [], 7.0, 100, oldDate.toISOString().split('T')[0]!, null, null, 50);
      expect(content.isRecent()).toBe(false);
    });
  });

  describe('getPosterUrl', () => {
    it('should return full URL with default base', () => {
      const content = createTestContent();
      expect(content.getPosterUrl()).toBe('https://image.tmdb.org/t/p/w500/poster.jpg');
    });

    it('should return full URL with custom base', () => {
      const content = createTestContent();
      expect(content.getPosterUrl('https://custom.cdn.com')).toBe('https://custom.cdn.com/poster.jpg');
    });

    it('should return null when poster path is null', () => {
      const content = new Content(1, 'Test', 'Desc', 'movie', [], 7.0, 100, '2023-01-01', null, null, 50);
      expect(content.getPosterUrl()).toBeNull();
    });
  });

  describe('getBackdropUrl', () => {
    it('should return full URL with default base', () => {
      const content = createTestContent();
      expect(content.getBackdropUrl()).toBe('https://image.tmdb.org/t/p/original/backdrop.jpg');
    });

    it('should return null when backdrop path is null', () => {
      const content = new Content(1, 'Test', 'Desc', 'movie', [], 7.0, 100, '2023-01-01', null, null, 50);
      expect(content.getBackdropUrl()).toBeNull();
    });
  });
});

describe('Movie Entity', () => {
  const createTestMovie = () => new Movie(
    1,
    'Inception',
    'Dream heist thriller',
    [28, 878, 53],
    8.8,
    25000,
    '2010-07-16',
    '/inception.jpg',
    '/inception-backdrop.jpg',
    150,
    148,
    160000000,
    829895144,
    'Released',
    'Your mind is the scene of the crime'
  );

  describe('isBlockbuster', () => {
    it('should return true for high budget and high revenue', () => {
      const movie = createTestMovie();
      expect(movie.isBlockbuster()).toBe(true);
    });

    it('should return false if budget is below threshold', () => {
      const movie = new Movie(1, 'Indie', 'Desc', [], 7.0, 100, '2023-01-01', null, null, 50, 90, 50000000, 600000000);
      expect(movie.isBlockbuster()).toBe(false);
    });

    it('should return false if revenue is below threshold', () => {
      const movie = new Movie(1, 'Flop', 'Desc', [], 7.0, 100, '2023-01-01', null, null, 50, 90, 150000000, 100000000);
      expect(movie.isBlockbuster()).toBe(false);
    });

    it('should return false if budget or revenue is undefined', () => {
      const movie = new Movie(1, 'Unknown', 'Desc', [], 7.0, 100, '2023-01-01', null, null, 50);
      expect(movie.isBlockbuster()).toBe(false);
    });
  });

  describe('getRuntimeFormatted', () => {
    it('should format runtime with hours and minutes', () => {
      const movie = createTestMovie();
      expect(movie.getRuntimeFormatted()).toBe('2h 28m');
    });

    it('should format runtime with only minutes when less than 60', () => {
      const movie = new Movie(1, 'Short', 'Desc', [], 7.0, 100, '2023-01-01', null, null, 50, 45);
      expect(movie.getRuntimeFormatted()).toBe('45m');
    });

    it('should return null when runtime is undefined', () => {
      const movie = new Movie(1, 'No Runtime', 'Desc', [], 7.0, 100, '2023-01-01', null, null, 50);
      expect(movie.getRuntimeFormatted()).toBeNull();
    });
  });

  describe('isProfitable', () => {
    it('should return true when revenue exceeds budget', () => {
      const movie = createTestMovie();
      expect(movie.isProfitable()).toBe(true);
    });

    it('should return false when revenue is less than budget', () => {
      const movie = new Movie(1, 'Loss', 'Desc', [], 7.0, 100, '2023-01-01', null, null, 50, 90, 100000000, 50000000);
      expect(movie.isProfitable()).toBe(false);
    });

    it('should return false when budget or revenue is undefined', () => {
      const movie = new Movie(1, 'Unknown', 'Desc', [], 7.0, 100, '2023-01-01', null, null, 50);
      expect(movie.isProfitable()).toBe(false);
    });
  });

  describe('getProfitMargin', () => {
    it('should calculate correct profit margin', () => {
      const movie = createTestMovie();
      const margin = movie.getProfitMargin();
      expect(margin).toBeCloseTo(418.68, 1); // ~418.68% profit
    });

    it('should return null when budget is zero', () => {
      const movie = new Movie(1, 'Free', 'Desc', [], 7.0, 100, '2023-01-01', null, null, 50, 90, 0, 1000000);
      expect(movie.getProfitMargin()).toBeNull();
    });

    it('should return null when budget or revenue is undefined', () => {
      const movie = new Movie(1, 'Unknown', 'Desc', [], 7.0, 100, '2023-01-01', null, null, 50);
      expect(movie.getProfitMargin()).toBeNull();
    });
  });
});

describe('Series Entity', () => {
  const createTestSeries = () => new Series(
    1,
    'Breaking Bad',
    'Chemistry teacher turns drug kingpin',
    [18, 80],
    9.5,
    15000,
    '2008-01-20',
    '/bb.jpg',
    '/bb-backdrop.jpg',
    120,
    5,
    62,
    'Ended',
    ['AMC']
  );

  describe('isOngoing', () => {
    it('should return true for returning series', () => {
      const series = new Series(1, 'Ongoing', 'Desc', [], 7.0, 100, '2023-01-01', null, null, 50, 3, 30, 'Returning Series');
      expect(series.isOngoing()).toBe(true);
    });

    it('should return false for ended series', () => {
      const series = createTestSeries();
      expect(series.isOngoing()).toBe(false);
    });
  });

  describe('hasEnded', () => {
    it('should return true for ended series', () => {
      const series = createTestSeries();
      expect(series.hasEnded()).toBe(true);
    });

    it('should return true for canceled series', () => {
      const series = new Series(1, 'Canceled', 'Desc', [], 7.0, 100, '2023-01-01', null, null, 50, 1, 10, 'Canceled');
      expect(series.hasEnded()).toBe(true);
    });

    it('should return false for returning series', () => {
      const series = new Series(1, 'Active', 'Desc', [], 7.0, 100, '2023-01-01', null, null, 50, 2, 20, 'Returning Series');
      expect(series.hasEnded()).toBe(false);
    });
  });

  describe('getAverageEpisodesPerSeason', () => {
    it('should calculate correct average', () => {
      const series = createTestSeries();
      expect(series.getAverageEpisodesPerSeason()).toBe(12); // 62/5 = 12.4 rounded
    });

    it('should return null when data is missing', () => {
      const series = new Series(1, 'Unknown', 'Desc', [], 7.0, 100, '2023-01-01', null, null, 50);
      expect(series.getAverageEpisodesPerSeason()).toBeNull();
    });
  });

  describe('isLimitedSeries', () => {
    it('should return true for single season series', () => {
      const series = new Series(1, 'Limited', 'Desc', [], 7.0, 100, '2023-01-01', null, null, 50, 1, 8);
      expect(series.isLimitedSeries()).toBe(true);
    });

    it('should return false for multi-season series', () => {
      const series = createTestSeries();
      expect(series.isLimitedSeries()).toBe(false);
    });

    it('should return false when season count is undefined', () => {
      const series = new Series(1, 'Unknown', 'Desc', [], 7.0, 100, '2023-01-01', null, null, 50);
      expect(series.isLimitedSeries()).toBe(false);
    });
  });
});

describe('Episode Entity', () => {
  const createTestEpisode = () => new Episode(
    101,
    1,
    1,
    5,
    'Ozymandias',
    'Events spiral out of control',
    '2013-09-15',
    47,
    9.9,
    '/still.jpg'
  );

  describe('getEpisodeCode', () => {
    it('should format episode code correctly', () => {
      const episode = createTestEpisode();
      expect(episode.getEpisodeCode()).toBe('S01E05');
    });

    it('should pad single digits with zeros', () => {
      const episode = new Episode(1, 1, 2, 3, 'Test', 'Desc', '2023-01-01');
      expect(episode.getEpisodeCode()).toBe('S02E03');
    });

    it('should handle double digit numbers', () => {
      const episode = new Episode(1, 1, 12, 24, 'Test', 'Desc', '2023-01-01');
      expect(episode.getEpisodeCode()).toBe('S12E24');
    });
  });

  describe('hasAired', () => {
    it('should return true for past air dates', () => {
      const episode = createTestEpisode();
      expect(episode.hasAired()).toBe(true);
    });

    it('should return false for future air dates', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const episode = new Episode(1, 1, 1, 1, 'Future', 'Desc', futureDate.toISOString().split('T')[0]!);
      expect(episode.hasAired()).toBe(false);
    });
  });

  describe('getStillUrl', () => {
    it('should return full URL with default base', () => {
      const episode = createTestEpisode();
      expect(episode.getStillUrl()).toBe('https://image.tmdb.org/t/p/w500/still.jpg');
    });

    it('should return null when still path is null', () => {
      const episode = new Episode(1, 1, 1, 1, 'Test', 'Desc', '2023-01-01', undefined, undefined, null);
      expect(episode.getStillUrl()).toBeNull();
    });
  });

  describe('isHighlyRated', () => {
    it('should return true for vote average >= 8.0', () => {
      const episode = createTestEpisode();
      expect(episode.isHighlyRated()).toBe(true);
    });

    it('should return false for vote average < 8.0', () => {
      const episode = new Episode(1, 1, 1, 1, 'Test', 'Desc', '2023-01-01', undefined, 7.9);
      expect(episode.isHighlyRated()).toBe(false);
    });

    it('should return false when vote average is undefined', () => {
      const episode = new Episode(1, 1, 1, 1, 'Test', 'Desc', '2023-01-01');
      expect(episode.isHighlyRated()).toBe(false);
    });
  });
});

describe('GenreEntity', () => {
  describe('equals', () => {
    it('should return true for genres with same ID', () => {
      const genre1 = new GenreEntity(28, 'Action');
      const genre2 = new GenreEntity(28, 'Action');
      expect(genre1.equals(genre2)).toBe(true);
    });

    it('should return false for genres with different IDs', () => {
      const genre1 = new GenreEntity(28, 'Action');
      const genre2 = new GenreEntity(35, 'Comedy');
      expect(genre1.equals(genre2)).toBe(false);
    });
  });

  describe('getNormalizedName', () => {
    it('should return lowercase name', () => {
      const genre = new GenreEntity(28, 'Action');
      expect(genre.getNormalizedName()).toBe('action');
    });

    it('should handle already lowercase names', () => {
      const genre = new GenreEntity(35, 'comedy');
      expect(genre.getNormalizedName()).toBe('comedy');
    });

    it('should handle mixed case names', () => {
      const genre = new GenreEntity(878, 'Science Fiction');
      expect(genre.getNormalizedName()).toBe('science fiction');
    });
  });
});

/**
 * @media-gateway/providers
 *
 * Streaming provider adapters for cross-platform content matching and availability
 * Core component of the content fingerprinting data moat
 */

// TMDB Adapter
export {
  TMDBAdapter,
  createTMDBAdapter,
  type TMDBConfig,
} from './adapters/TMDBAdapter.js';

// Availability Service
export {
  AvailabilityService,
  createAvailabilityService,
  type AvailabilityConfig,
  type AggregatedAvailability,
} from './services/AvailabilityService.js';

// Content Ingestion Service
export {
  ContentIngestionService,
  createContentIngestionService,
  type IngestionConfig,
  type IngestionResult,
  type IngestionProgressCallback,
  type VectorStore,
} from './services/ContentIngestionService.js';

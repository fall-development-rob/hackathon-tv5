/**
 * @media-gateway/database
 *
 * Database layer with AgentDB cognitive memory and RuVector embeddings
 * Foundation of the 20-year data moat strategy
 *
 * Supports:
 * - SQLite-based AgentDB for local development
 * - In-memory RuVector for testing
 * - PostgreSQL with ruvector/postgres:latest for production (150x faster HNSW)
 */

// AgentDB integration (SQLite-based cognitive memory)
export { AgentDBWrapper, createAgentDB } from './agentdb/index.js';

// RuVector integration (embedding generation and search)
export { RuVectorWrapper, createRuVector, cosineSimilarity } from './ruvector/index.js';

// PostgreSQL integration (production-ready with HNSW indexes)
export {
  PostgreSQLConnectionPool,
  VectorStorage,
  AgentDBPostgreSQLAdapter,
  createPostgreSQLAdapter,
  vectorToSQL,
  type PostgreSQLConfig,
  type VectorSearchOptions,
  type VectorSearchResult,
} from './postgres/index.js';

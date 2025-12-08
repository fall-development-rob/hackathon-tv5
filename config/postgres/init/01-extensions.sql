-- PostgreSQL Vector Extensions Initialization
-- Media Gateway Database - Vector Support Setup
-- This script enables the vector extension for RuVector/pgvector compatibility

-- =============================================================================
-- Enable Vector Extension
-- =============================================================================
-- Creates the vector data type and operators for similarity search
-- Required for storing embeddings and performing k-NN searches

CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- Verify Extension Installation
-- =============================================================================
-- Validates that the vector extension is properly loaded and functional

DO $$
DECLARE
  ext_count INTEGER;
  ext_version TEXT;
BEGIN
  -- Check if vector extension exists
  SELECT COUNT(*), MAX(extversion)
  INTO ext_count, ext_version
  FROM pg_extension
  WHERE extname = 'vector';

  IF ext_count = 0 THEN
    RAISE EXCEPTION 'FATAL: Vector extension failed to load. RuVector PostgreSQL may not be properly configured.';
  END IF;

  -- Log successful initialization
  RAISE NOTICE 'Vector extension loaded successfully (version: %)', ext_version;

  -- Display available vector operators
  RAISE NOTICE 'Available vector operators:';
  RAISE NOTICE '  - <-> : Euclidean distance (L2)';
  RAISE NOTICE '  - <#> : Negative inner product';
  RAISE NOTICE '  - <=> : Cosine distance (1 - cosine similarity)';

END $$;

-- =============================================================================
-- Extension Configuration Verification
-- =============================================================================
-- Verify that HNSW indexing is available

DO $$
DECLARE
  hnsw_available BOOLEAN;
BEGIN
  -- Check if HNSW access method exists
  SELECT EXISTS(
    SELECT 1 FROM pg_am WHERE amname = 'hnsw'
  ) INTO hnsw_available;

  IF hnsw_available THEN
    RAISE NOTICE 'HNSW indexing is available for vector operations';
  ELSE
    RAISE WARNING 'HNSW indexing not detected. Vector searches may use brute-force methods.';
  END IF;
END $$;

-- =============================================================================
-- Database Statistics Extension (Optional)
-- =============================================================================
-- Enable pg_stat_statements for query performance monitoring

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

RAISE NOTICE 'PostgreSQL vector extensions initialized successfully';
RAISE NOTICE 'Database ready for AgentDB and RuVector operations';

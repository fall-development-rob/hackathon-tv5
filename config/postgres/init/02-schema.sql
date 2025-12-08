-- Media Gateway Database Schema
-- PostgreSQL + RuVector Integration
-- Supports AgentDB cognitive memory and RuVector content embeddings

-- =============================================================================
-- TABLE: user_preferences
-- =============================================================================
-- Stores user preference vectors for personalized recommendations
-- Vector dimension: 384 (AgentDB standard)
-- Uses HNSW indexing for fast k-NN similarity search

CREATE TABLE IF NOT EXISTS user_preferences (
  -- Primary Key
  id SERIAL PRIMARY KEY,

  -- User Identification
  user_id VARCHAR(255) NOT NULL UNIQUE,

  -- Preference Vector (384-dim for AgentDB)
  -- Stores learned user preferences as embedding
  vector vector(384),

  -- Confidence Metrics
  confidence FLOAT DEFAULT 0.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),

  -- Genre Affinity Weights
  -- JSON structure: {"action": 0.9, "scifi": 0.8, "drama": 0.3}
  genre_affinities JSONB DEFAULT '{}'::jsonb,

  -- Temporal Viewing Patterns
  -- JSON structure: {"weekday_morning": 0.2, "weekend_evening": 0.9}
  temporal_patterns JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user_preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id
  ON user_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_user_preferences_confidence
  ON user_preferences(confidence);

-- HNSW Index for Vector Similarity Search
-- Parameters: m=16 (max connections), ef_construction=64 (build quality)
-- Optimized for balanced recall and performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_vector_hnsw
  ON user_preferences
  USING hnsw (vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- =============================================================================
-- TABLE: content_vectors
-- =============================================================================
-- Stores content embeddings for movies and TV shows
-- Vector dimension: 768 (RuVector standard)
-- Supports semantic search and content recommendations

CREATE TABLE IF NOT EXISTS content_vectors (
  -- Primary Key
  id SERIAL PRIMARY KEY,

  -- Content Identification
  content_id INTEGER NOT NULL,
  media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('movie', 'tv')),

  -- Content Metadata
  title TEXT NOT NULL,
  overview TEXT,

  -- Content Embedding (768-dim for RuVector)
  -- Generated from title + overview + genre information
  vector vector(768),

  -- Genre Classification
  genre_ids INTEGER[] DEFAULT ARRAY[]::INTEGER[],

  -- Quality Metrics
  vote_average FLOAT CHECK (vote_average >= 0.0 AND vote_average <= 10.0),

  -- Temporal Information
  release_date DATE,

  -- Media Assets
  poster_path TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Uniqueness Constraint
  UNIQUE(content_id, media_type)
);

-- Indexes for content_vectors
CREATE INDEX IF NOT EXISTS idx_content_vectors_media_type
  ON content_vectors(media_type);

CREATE INDEX IF NOT EXISTS idx_content_vectors_vote_average
  ON content_vectors(vote_average);

CREATE INDEX IF NOT EXISTS idx_content_vectors_release_date
  ON content_vectors(release_date);

CREATE INDEX IF NOT EXISTS idx_content_vectors_genre_ids
  ON content_vectors USING GIN(genre_ids);

-- HNSW Index for Content Vector Similarity Search
CREATE INDEX IF NOT EXISTS idx_content_vectors_vector_hnsw
  ON content_vectors
  USING hnsw (vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- =============================================================================
-- TABLE: reasoning_patterns
-- =============================================================================
-- AgentDB ReasoningBank storage
-- Stores successful reasoning patterns for task-specific approaches
-- Vector dimension: 384 (AgentDB standard)

CREATE TABLE IF NOT EXISTS reasoning_patterns (
  -- Primary Key
  id SERIAL PRIMARY KEY,

  -- Pattern Classification
  task_type VARCHAR(100) NOT NULL,

  -- Reasoning Approach
  approach TEXT NOT NULL,

  -- Performance Metrics
  success_rate FLOAT DEFAULT 0.0 CHECK (success_rate >= 0.0 AND success_rate <= 1.0),

  -- Pattern Metadata
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Pattern Embedding (384-dim)
  -- Generated from task_type + approach for semantic retrieval
  embedding vector(384),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for reasoning_patterns
CREATE INDEX IF NOT EXISTS idx_reasoning_patterns_task_type
  ON reasoning_patterns(task_type);

CREATE INDEX IF NOT EXISTS idx_reasoning_patterns_success_rate
  ON reasoning_patterns(success_rate);

CREATE INDEX IF NOT EXISTS idx_reasoning_patterns_tags
  ON reasoning_patterns USING GIN(tags);

-- HNSW Index for Pattern Similarity Search
CREATE INDEX IF NOT EXISTS idx_reasoning_patterns_embedding_hnsw
  ON reasoning_patterns
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- =============================================================================
-- TABLE: reflexion_episodes
-- =============================================================================
-- AgentDB ReflexionMemory storage
-- Stores agent learning episodes with rewards, critiques, and performance metrics

CREATE TABLE IF NOT EXISTS reflexion_episodes (
  -- Primary Key
  id SERIAL PRIMARY KEY,

  -- Session Tracking
  session_id VARCHAR(255) NOT NULL,

  -- Task Information
  task TEXT NOT NULL,

  -- Reinforcement Learning Metrics
  reward FLOAT NOT NULL,
  success BOOLEAN NOT NULL,

  -- Learning Feedback
  critique TEXT,

  -- Task I/O
  input TEXT,
  output TEXT,

  -- Performance Metrics
  latency_ms INTEGER CHECK (latency_ms >= 0),
  tokens_used INTEGER CHECK (tokens_used >= 0),

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for reflexion_episodes
CREATE INDEX IF NOT EXISTS idx_reflexion_episodes_session_id
  ON reflexion_episodes(session_id);

CREATE INDEX IF NOT EXISTS idx_reflexion_episodes_task
  ON reflexion_episodes(task);

CREATE INDEX IF NOT EXISTS idx_reflexion_episodes_success
  ON reflexion_episodes(success);

CREATE INDEX IF NOT EXISTS idx_reflexion_episodes_reward
  ON reflexion_episodes(reward);

CREATE INDEX IF NOT EXISTS idx_reflexion_episodes_created_at
  ON reflexion_episodes(created_at);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_reflexion_episodes_session_task
  ON reflexion_episodes(session_id, task);

-- =============================================================================
-- TABLE: skill_library
-- =============================================================================
-- AgentDB SkillLibrary storage
-- Stores reusable agent skills with performance tracking
-- Vector dimension: 384 (AgentDB standard)

CREATE TABLE IF NOT EXISTS skill_library (
  -- Primary Key
  id SERIAL PRIMARY KEY,

  -- Skill Identification
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,

  -- Skill Definition
  signature JSONB, -- Function signature and parameters
  code TEXT,       -- Executable skill code

  -- Performance Metrics
  success_rate FLOAT DEFAULT 0.0 CHECK (success_rate >= 0.0 AND success_rate <= 1.0),
  uses INTEGER DEFAULT 0 CHECK (uses >= 0),
  avg_reward FLOAT,
  avg_latency_ms INTEGER CHECK (avg_latency_ms >= 0),

  -- Skill Embedding (384-dim)
  -- Generated from name + description for semantic retrieval
  embedding vector(384),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for skill_library
CREATE INDEX IF NOT EXISTS idx_skill_library_name
  ON skill_library(name);

CREATE INDEX IF NOT EXISTS idx_skill_library_success_rate
  ON skill_library(success_rate);

CREATE INDEX IF NOT EXISTS idx_skill_library_uses
  ON skill_library(uses);

-- HNSW Index for Skill Similarity Search
CREATE INDEX IF NOT EXISTS idx_skill_library_embedding_hnsw
  ON skill_library
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- =============================================================================
-- Update Trigger for Timestamps
-- =============================================================================
-- Automatically updates updated_at timestamp on row modifications

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to relevant tables
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reasoning_patterns_updated_at
  BEFORE UPDATE ON reasoning_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skill_library_updated_at
  BEFORE UPDATE ON skill_library
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Schema Validation
-- =============================================================================

DO $$
DECLARE
  table_count INTEGER;
  index_count INTEGER;
BEGIN
  -- Count created tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'user_preferences',
      'content_vectors',
      'reasoning_patterns',
      'reflexion_episodes',
      'skill_library'
    );

  -- Count HNSW indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname LIKE '%_hnsw';

  -- Validation
  IF table_count < 5 THEN
    RAISE WARNING 'Expected 5 tables, found %', table_count;
  END IF;

  IF index_count < 4 THEN
    RAISE WARNING 'Expected 4 HNSW indexes, found %', index_count;
  END IF;

  -- Success message
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Media Gateway Database Schema Initialized';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Tables created: %', table_count;
  RAISE NOTICE 'HNSW indexes created: %', index_count;
  RAISE NOTICE 'Schema ready for AgentDB and RuVector integration';
  RAISE NOTICE '================================================';
END $$;

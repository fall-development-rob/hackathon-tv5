-- =============================================================================
-- RuVector PostgreSQL Initialization Script
-- =============================================================================
-- This script initializes the PostgreSQL database with vector extensions
-- and creates the necessary schemas for the Media Gateway application.
--
-- Execution Order: This runs automatically when the container first starts
-- Place additional initialization scripts with higher numbers (02-, 03-, etc.)
-- =============================================================================

-- Enable required extensions
-- =============================================================================

-- pgvector extension for vector similarity search
-- Enables storage and querying of embedding vectors
CREATE EXTENSION IF NOT EXISTS vector;

-- UUID generation for unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Full-text search capabilities
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Timestamp utilities
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =============================================================================
-- Create Application Schemas
-- =============================================================================

-- Main schema for media gateway data
CREATE SCHEMA IF NOT EXISTS media_gateway;

-- Schema for vector embeddings and semantic search
CREATE SCHEMA IF NOT EXISTS vectors;

-- Schema for agent state and coordination
CREATE SCHEMA IF NOT EXISTS agents;

-- Schema for audit logging and analytics
CREATE SCHEMA IF NOT EXISTS analytics;

-- =============================================================================
-- Grant Permissions
-- =============================================================================

-- Grant usage on schemas to the application user
GRANT USAGE ON SCHEMA media_gateway TO CURRENT_USER;
GRANT USAGE ON SCHEMA vectors TO CURRENT_USER;
GRANT USAGE ON SCHEMA agents TO CURRENT_USER;
GRANT USAGE ON SCHEMA analytics TO CURRENT_USER;

-- Grant create privileges
GRANT CREATE ON SCHEMA media_gateway TO CURRENT_USER;
GRANT CREATE ON SCHEMA vectors TO CURRENT_USER;
GRANT CREATE ON SCHEMA agents TO CURRENT_USER;
GRANT CREATE ON SCHEMA analytics TO CURRENT_USER;

-- =============================================================================
-- Create Helper Functions
-- =============================================================================

-- Function to calculate cosine similarity between vectors
CREATE OR REPLACE FUNCTION vectors.cosine_similarity(a vector, b vector)
RETURNS float8
AS $$
    SELECT 1 - (a <=> b);
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;

-- Function to calculate euclidean distance between vectors
CREATE OR REPLACE FUNCTION vectors.euclidean_distance(a vector, b vector)
RETURNS float8
AS $$
    SELECT a <-> b;
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Create Core Tables
-- =============================================================================

-- Media content table (movies, TV shows, etc.)
CREATE TABLE IF NOT EXISTS media_gateway.content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(255) NOT NULL,
    content_type VARCHAR(50) NOT NULL, -- 'movie', 'tv_show', 'episode', etc.
    title VARCHAR(500) NOT NULL,
    description TEXT,
    release_date DATE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indices for content table
CREATE INDEX IF NOT EXISTS idx_content_external_id ON media_gateway.content(external_id);
CREATE INDEX IF NOT EXISTS idx_content_type ON media_gateway.content(content_type);
CREATE INDEX IF NOT EXISTS idx_content_metadata ON media_gateway.content USING GIN(metadata);

-- Content embeddings table
CREATE TABLE IF NOT EXISTS vectors.content_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID REFERENCES media_gateway.content(id) ON DELETE CASCADE,
    embedding_model VARCHAR(100) NOT NULL,
    embedding vector(768), -- Adjust dimension based on VECTOR_DIMENSION env var
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(content_id, embedding_model)
);

-- Create HNSW index for fast vector similarity search
-- Note: Build index after loading data for better performance
CREATE INDEX IF NOT EXISTS idx_content_embeddings_vector
ON vectors.content_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Agent sessions table for multi-agent coordination
CREATE TABLE IF NOT EXISTS agents.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    agent_type VARCHAR(100) NOT NULL,
    state JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agents.sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_expires ON agents.sessions(expires_at);

-- Agent memory/knowledge base
CREATE TABLE IF NOT EXISTS agents.knowledge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID,
    key VARCHAR(255) NOT NULL,
    value JSONB NOT NULL,
    embedding vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_knowledge_key ON agents.knowledge(key);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_agent ON agents.knowledge(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_embedding
ON agents.knowledge
USING hnsw (embedding vector_cosine_ops);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID,
    session_id UUID,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics.events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics.events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_properties ON analytics.events USING GIN(properties);

-- =============================================================================
-- Create Triggers
-- =============================================================================

-- Automatically update updated_at timestamp
CREATE TRIGGER update_content_updated_at
    BEFORE UPDATE ON media_gateway.content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_sessions_updated_at
    BEFORE UPDATE ON agents.sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_knowledge_updated_at
    BEFORE UPDATE ON agents.knowledge
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Create Views
-- =============================================================================

-- View combining content with embeddings
CREATE OR REPLACE VIEW media_gateway.content_with_embeddings AS
SELECT
    c.*,
    ce.embedding_model,
    ce.embedding,
    ce.created_at as embedding_created_at
FROM media_gateway.content c
LEFT JOIN vectors.content_embeddings ce ON c.id = ce.content_id;

-- =============================================================================
-- Insert Sample Data (Optional - for testing)
-- =============================================================================

-- Uncomment to insert sample data for testing
/*
INSERT INTO media_gateway.content (external_id, content_type, title, description, release_date, metadata)
VALUES
    ('tmdb-12345', 'movie', 'Sample Movie', 'A great movie about AI and technology', '2024-01-01', '{"genre": ["sci-fi", "drama"], "rating": 8.5}'),
    ('tmdb-67890', 'tv_show', 'Sample TV Show', 'An exciting series about agentic AI', '2024-02-01', '{"genre": ["tech", "documentary"], "seasons": 2}');
*/

-- =============================================================================
-- Configuration Settings
-- =============================================================================

-- Optimize for vector operations
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements,auto_explain';
ALTER SYSTEM SET pg_stat_statements.track = 'all';

-- =============================================================================
-- Completion Message
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'RuVector PostgreSQL initialization complete!';
    RAISE NOTICE 'Database: %', current_database();
    RAISE NOTICE 'Schemas created: media_gateway, vectors, agents, analytics';
    RAISE NOTICE 'Extensions enabled: vector, uuid-ossp, pg_trgm, btree_gist';
    RAISE NOTICE '=============================================================================';
END $$;

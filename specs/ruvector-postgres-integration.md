# SPARC Specification: RuVector PostgreSQL Integration

**Project**: Media Gateway Database Layer Migration
**Version**: 1.0.0
**Date**: 2025-12-08
**Status**: Draft Specification

---

## Table of Contents

1. [S: Specification](#specification)
2. [P: Pseudocode](#pseudocode)
3. [A: Architecture](#architecture)
4. [R: Refinement](#refinement)
5. [C: Completion](#completion)

---

## Specification

### 1.1 Executive Summary

Migrate media-gateway database layer from in-memory/SQLite-based vector storage to production-ready PostgreSQL with ruvector/postgres:latest Docker image, enabling persistent, scalable, high-performance vector operations with HNSW indexing and horizontal scaling via Raft consensus.

### 1.2 Functional Requirements

#### FR-001: Docker Infrastructure
- **Priority**: High
- **Description**: Deploy ruvector/postgres:latest as primary database container
- **Acceptance Criteria**:
  - Docker Compose configuration with ruvector/postgres:latest
  - PostgreSQL accessible on port 5432
  - Vector extensions loaded and functional
  - Health checks validate database readiness
  - Persistent volume for data storage
  - Environment-based configuration (credentials, ports)

#### FR-002: Database Connection Layer
- **Priority**: High
- **Description**: PostgreSQL connection pool with vector operation support
- **Acceptance Criteria**:
  - Connection pool with configurable limits (min: 2, max: 10)
  - Automatic reconnection on failure
  - Connection timeout handling (30s)
  - SSL/TLS support for production
  - Query timeout enforcement (10s default)
  - Transaction management utilities

#### FR-003: Vector Storage Migration
- **Priority**: High
- **Description**: Replace in-memory vector storage with PostgreSQL vector tables
- **Acceptance Criteria**:
  - Schema supports 384-dim (AgentDB) and 768-dim (RuVector) embeddings
  - HNSW indexes created for vector similarity search
  - Metadata storage for content, preferences, patterns
  - Batch insert/update operations (100+ vectors/sec)
  - Foreign key constraints for data integrity
  - Indexes on frequently queried fields

#### FR-004: Vector Search Operations
- **Priority**: High
- **Description**: Implement 53+ SQL vector functions for similarity search
- **Acceptance Criteria**:
  - Cosine similarity search (<50ms p95 latency)
  - Euclidean distance search
  - Inner product search
  - Hybrid filtering (vector + metadata)
  - k-NN search with HNSW index (150x faster than brute-force)
  - Batch similarity calculations
  - Distance threshold filtering

#### FR-005: AgentDB Integration
- **Priority**: High
- **Description**: Persist AgentDB cognitive memory to PostgreSQL
- **Acceptance Criteria**:
  - ReasoningBank patterns stored in vector tables
  - ReflexionMemory episodes persisted
  - SkillLibrary stored with vector embeddings
  - Cross-session state persistence
  - Nightly learning job writes to PostgreSQL
  - ACID compliance for critical operations

#### FR-006: RuVector Integration
- **Priority**: High
- **Description**: Persist RuVector content embeddings to PostgreSQL
- **Acceptance Criteria**:
  - Content embeddings stored in vector tables
  - Semantic search queries use PostgreSQL
  - Similar content queries use HNSW index
  - Embedding cache backed by PostgreSQL
  - Batch embedding operations supported

#### FR-007: Migration Tooling
- **Priority**: Medium
- **Description**: Tools to migrate existing data to PostgreSQL
- **Acceptance Criteria**:
  - Migration script for AgentDB SQLite → PostgreSQL
  - Validation of migrated data integrity
  - Rollback capability
  - Progress reporting
  - Dry-run mode for testing

### 1.3 Non-Functional Requirements

#### NFR-001: Performance
- **Category**: Performance
- **Description**: Vector search performance with HNSW indexing
- **Measurement**:
  - p50 latency: <20ms for k=10 similarity search
  - p95 latency: <50ms for k=10 similarity search
  - p99 latency: <100ms for k=10 similarity search
  - Throughput: 1000+ queries/sec at 10k vector scale
- **Validation**: Performance benchmarks with 10k, 100k, 1M vectors

#### NFR-002: Scalability
- **Category**: Scalability
- **Description**: Horizontal scaling via Raft consensus
- **Measurement**:
  - Support 1M+ vectors per node
  - 3-node Raft cluster for high availability
  - Automatic failover <5 seconds
  - Read replica support
- **Validation**: Load testing with simulated user growth

#### NFR-003: Reliability
- **Category**: Reliability
- **Description**: Data durability and consistency
- **Measurement**:
  - 99.9% uptime SLA
  - Zero data loss on node failure
  - ACID transaction compliance
  - Automatic backup every 24 hours
- **Validation**: Fault injection testing, backup/restore drills

#### NFR-004: Maintainability
- **Category**: Maintainability
- **Description**: Operational simplicity and observability
- **Measurement**:
  - Docker Compose one-command startup
  - Structured logging to stdout
  - Prometheus metrics endpoint
  - Health check endpoints
  - Database migration version tracking
- **Validation**: Developer setup time <5 minutes

#### NFR-005: Security
- **Category**: Security
- **Description**: Production-grade security hardening
- **Measurement**:
  - SSL/TLS for connections
  - Environment-based secrets (no hardcoded passwords)
  - Role-based access control (RBAC)
  - SQL injection protection via prepared statements
  - Security audit logs
- **Validation**: Security scan with OWASP ZAP

### 1.4 Constraints

#### Technical Constraints
- Must maintain compatibility with existing AgentDB API (version ^2.0.0-alpha.2.18)
- Must maintain compatibility with existing RuVector API (version ^0.1.31)
- PostgreSQL version: 16.x (latest stable)
- Docker Compose version: 2.x
- Node.js runtime: >=20.0.0
- Must support both SQLite (dev) and PostgreSQL (production)

#### Business Constraints
- Migration must not cause data loss
- Zero downtime migration strategy required for production
- Development environment setup time: <5 minutes
- Production deployment budget: Infrastructure costs only

#### Regulatory Constraints
- GDPR compliance: Data retention policies
- User data encryption at rest (PostgreSQL TDE)
- Audit logging for compliance

### 1.5 Use Cases

#### UC-001: Developer Local Setup
- **Actor**: Developer
- **Preconditions**:
  - Docker Desktop installed
  - Repository cloned
  - Node.js 20+ installed
- **Flow**:
  1. Run `docker compose up -d` in project root
  2. ruvector/postgres container starts with health checks
  3. System auto-applies database migrations
  4. Run `npm run dev` to start application
  5. Application connects to PostgreSQL successfully
  6. Developer can query vector data via API
- **Postconditions**:
  - PostgreSQL running with vector extensions
  - Sample data loaded (optional)
  - Application connected and functional
- **Exceptions**:
  - Port 5432 conflict: Error with alternative port suggestion
  - Migration failure: Rollback with error details
  - Connection timeout: Retry with exponential backoff

#### UC-002: Store User Preference Vector
- **Actor**: Recommendation Engine
- **Preconditions**:
  - User exists in system
  - New watch event processed
  - Embedding generated (384-dim or 768-dim)
- **Flow**:
  1. Engine calculates preference vector
  2. System begins database transaction
  3. UPSERT preference vector to `user_preferences` table
  4. Update HNSW index for fast retrieval
  5. Store associated metadata (confidence, genre affinities)
  6. Commit transaction
  7. Log success metrics
- **Postconditions**:
  - Preference vector persisted
  - HNSW index updated
  - Queryable for similarity search
- **Exceptions**:
  - Transaction conflict: Retry with exponential backoff (max 3 attempts)
  - Connection loss: Queue for retry, return error to caller
  - Constraint violation: Log and return validation error

#### UC-003: Semantic Content Search
- **Actor**: End User via API
- **Preconditions**:
  - Content embeddings indexed in PostgreSQL
  - HNSW index built
  - User authenticated
- **Flow**:
  1. User submits natural language query
  2. System generates query embedding (768-dim)
  3. Execute HNSW-accelerated k-NN search (k=20)
  4. Apply metadata filters (genre, release date, rating)
  5. Hybrid re-rank combining vector similarity + metadata
  6. Return top 10 results with similarity scores
- **Postconditions**:
  - Results returned in <50ms (p95)
  - Results sorted by relevance
  - User interaction logged
- **Exceptions**:
  - Empty results: Return trending content
  - Timeout: Return cached popular results
  - Invalid query: Return 400 with helpful message

#### UC-004: Nightly Learning Job
- **Actor**: Scheduled Task (Cron)
- **Preconditions**:
  - Watch events collected for past 24 hours
  - AgentDB initialized
  - PostgreSQL healthy
- **Flow**:
  1. Cron triggers nightly learning at 2:00 AM UTC
  2. NightlyLearner loads watch episodes from PostgreSQL
  3. Discover new patterns (min 3 attempts, 60% success)
  4. Consolidate successful patterns into skills
  5. Prune low-confidence edges (>90 days old)
  6. Update ReasoningBank in PostgreSQL
  7. Rebuild HNSW indexes if needed
  8. Generate metrics report
  9. Commit all changes in transaction
- **Postconditions**:
  - New patterns discovered and stored
  - Skills consolidated
  - Old data pruned
  - Metrics logged
- **Exceptions**:
  - Database lock: Wait and retry (max 10 min)
  - Disk space low: Alert ops team, skip pruning
  - Transaction failure: Rollback, alert, retry next night

#### UC-005: Database Migration
- **Actor**: DevOps Engineer
- **Preconditions**:
  - Existing SQLite database with data
  - PostgreSQL container running
  - Migration script available
- **Flow**:
  1. Engineer runs `npm run migrate:to-postgres -- --dry-run`
  2. System validates data integrity
  3. Preview shows migration plan
  4. Engineer confirms and runs `npm run migrate:to-postgres`
  5. System exports data from SQLite
  6. Create tables in PostgreSQL
  7. Batch insert data (1000 rows/batch)
  8. Build HNSW indexes
  9. Validate row counts match
  10. Update application config to use PostgreSQL
  11. Restart application
  12. Archive SQLite database
- **Postconditions**:
  - All data migrated successfully
  - Application uses PostgreSQL
  - SQLite backed up
- **Exceptions**:
  - Validation failure: Rollback, log discrepancies
  - Duplicate keys: Skip with warning, continue
  - Connection failure: Pause, auto-resume on reconnect

### 1.6 Data Model

#### Entity: user_preferences
```sql
CREATE TABLE user_preferences (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  vector vector(384),  -- AgentDB dimension
  confidence FLOAT DEFAULT 0.0,
  genre_affinities JSONB,
  temporal_patterns JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_preferences_vector_hnsw
  ON user_preferences
  USING hnsw (vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

#### Entity: content_vectors
```sql
CREATE TABLE content_vectors (
  id SERIAL PRIMARY KEY,
  content_id INTEGER NOT NULL,
  media_type VARCHAR(10) NOT NULL,
  title TEXT NOT NULL,
  overview TEXT,
  vector vector(768),  -- RuVector dimension
  genre_ids INTEGER[],
  vote_average FLOAT,
  release_date DATE,
  poster_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(content_id, media_type)
);

CREATE INDEX idx_content_vectors_vector_hnsw
  ON content_vectors
  USING hnsw (vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_content_vectors_media_type
  ON content_vectors(media_type);
```

#### Entity: reasoning_patterns
```sql
CREATE TABLE reasoning_patterns (
  id SERIAL PRIMARY KEY,
  task_type VARCHAR(100) NOT NULL,
  approach TEXT NOT NULL,
  success_rate FLOAT DEFAULT 0.0,
  tags TEXT[],
  metadata JSONB,
  embedding vector(384),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reasoning_patterns_embedding_hnsw
  ON reasoning_patterns
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

#### Entity: reflexion_episodes
```sql
CREATE TABLE reflexion_episodes (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  task TEXT NOT NULL,
  reward FLOAT NOT NULL,
  success BOOLEAN NOT NULL,
  critique TEXT,
  input TEXT,
  output TEXT,
  latency_ms INTEGER,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reflexion_episodes_session_task
  ON reflexion_episodes(session_id, task);
```

#### Entity: skill_library
```sql
CREATE TABLE skill_library (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  signature JSONB,
  code TEXT,
  success_rate FLOAT DEFAULT 0.0,
  uses INTEGER DEFAULT 0,
  avg_reward FLOAT,
  avg_latency_ms INTEGER,
  embedding vector(384),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_skill_library_embedding_hnsw
  ON skill_library
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### 1.7 API Specification

#### Vector Search API
```typescript
interface VectorSearchOptions {
  vector: Float32Array;
  k: number;
  threshold?: number;
  filters?: {
    mediaType?: 'movie' | 'tv';
    genreIds?: number[];
    minRating?: number;
    releaseDateRange?: { start: Date; end: Date };
  };
}

interface VectorSearchResult {
  id: number;
  contentId: number;
  mediaType: string;
  title: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

async function searchVectors(
  options: VectorSearchOptions
): Promise<VectorSearchResult[]>;
```

#### SQL Vector Functions
```sql
-- Cosine similarity (SIMD-accelerated)
SELECT id, title, vector <=> query_vector AS distance
FROM content_vectors
ORDER BY distance
LIMIT 10;

-- Hybrid search (vector + metadata)
SELECT id, title, vector <=> query_vector AS distance
FROM content_vectors
WHERE media_type = 'movie'
  AND vote_average >= 7.0
  AND release_date >= '2020-01-01'
ORDER BY distance
LIMIT 10;

-- Batch similarity
SELECT id, title, vector <=> $1 AS distance
FROM content_vectors
WHERE id = ANY($2)
ORDER BY distance;
```

### 1.8 Acceptance Criteria

#### AC-001: Docker Infrastructure
- [ ] `docker compose up -d` starts PostgreSQL with ruvector extensions
- [ ] Health check passes within 30 seconds
- [ ] Vector extensions loaded: `SELECT * FROM pg_extension WHERE extname LIKE '%vector%';`
- [ ] HNSW indexing available: `SELECT * FROM pg_am WHERE amname = 'hnsw';`
- [ ] Persistent volume mounted at `/var/lib/postgresql/data`

#### AC-002: Database Connection
- [ ] Connection pool established with min 2, max 10 connections
- [ ] SSL/TLS connection succeeds in production mode
- [ ] Connection timeout triggers after 30 seconds
- [ ] Auto-reconnect on connection loss (max 3 retries)
- [ ] Query timeout enforced at 10 seconds

#### AC-003: Vector Operations
- [ ] Insert 100 vectors in <1 second (batch operation)
- [ ] k-NN search (k=10) completes in <50ms p95
- [ ] HNSW index build completes for 10k vectors in <2 minutes
- [ ] Cosine similarity matches reference implementation (tolerance: 1e-6)
- [ ] Hybrid filtering (vector + metadata) works correctly

#### AC-004: AgentDB Integration
- [ ] ReasoningBank patterns persist across restarts
- [ ] ReflexionMemory episodes queryable by session
- [ ] SkillLibrary searchable by semantic similarity
- [ ] Nightly learning job commits to PostgreSQL
- [ ] No data loss on application restart

#### AC-005: RuVector Integration
- [ ] Content embeddings persisted to PostgreSQL
- [ ] Semantic search returns relevant results
- [ ] Similar content queries use HNSW index
- [ ] Embedding cache backed by PostgreSQL

#### AC-006: Migration
- [ ] Migration script migrates all tables without data loss
- [ ] Row counts match before/after migration
- [ ] Foreign key constraints validated
- [ ] Rollback capability tested

---

## Pseudocode

### 2.1 PostgreSQL Connection Pool

```python
class PostgreSQLConnectionPool:
    """
    Connection pool for PostgreSQL with vector operations support
    """

    def __init__(config):
        self.host = config.host
        self.port = config.port
        self.database = config.database
        self.user = config.user
        self.password = config.password
        self.ssl = config.ssl
        self.minConnections = config.minConnections || 2
        self.maxConnections = config.maxConnections || 10
        self.connectionTimeout = config.connectionTimeout || 30000
        self.queryTimeout = config.queryTimeout || 10000
        self.pool = null

    async def initialize():
        """Initialize connection pool with vector extensions"""
        try:
            # Create connection pool
            self.pool = await pg.createPool({
                host: self.host,
                port: self.port,
                database: self.database,
                user: self.user,
                password: self.password,
                ssl: self.ssl,
                min: self.minConnections,
                max: self.maxConnections,
                connectionTimeoutMillis: self.connectionTimeout,
                query_timeout: self.queryTimeout,
                idleTimeoutMillis: 60000
            })

            # Verify vector extensions loaded
            result = await self.query(
                "SELECT * FROM pg_extension WHERE extname LIKE '%vector%'"
            )

            if result.rows.length == 0:
                throw Error("Vector extensions not loaded in PostgreSQL")

            log.info("PostgreSQL connection pool initialized with vector support")

        catch error:
            log.error("Failed to initialize connection pool", error)
            throw error

    async def query(sql, params = []):
        """Execute query with timeout"""
        try:
            client = await self.pool.connect()
            try:
                result = await client.query(sql, params)
                return result
            finally:
                client.release()
        catch error:
            if error.code == '57014':  # Query timeout
                log.warn("Query timeout exceeded", {sql, timeout: self.queryTimeout})
            throw error

    async def transaction(callback):
        """Execute operations in transaction"""
        client = await self.pool.connect()
        try:
            await client.query('BEGIN')
            result = await callback(client)
            await client.query('COMMIT')
            return result
        catch error:
            await client.query('ROLLBACK')
            throw error
        finally:
            client.release()

    async def close():
        """Close all connections"""
        if self.pool:
            await self.pool.end()
```

### 2.2 Vector Storage Operations

```python
class VectorStorage:
    """
    High-performance vector storage with HNSW indexing
    """

    def __init__(pool):
        self.pool = pool

    async def storeUserPreference(userId, vector, metadata):
        """
        Store or update user preference vector
        Uses UPSERT for idempotency
        """
        sql = """
            INSERT INTO user_preferences (
                user_id, vector, confidence,
                genre_affinities, temporal_patterns, updated_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET
                vector = EXCLUDED.vector,
                confidence = EXCLUDED.confidence,
                genre_affinities = EXCLUDED.genre_affinities,
                temporal_patterns = EXCLUDED.temporal_patterns,
                updated_at = NOW()
            RETURNING id
        """

        params = [
            userId,
            vectorToSQL(vector),  # Convert Float32Array to PostgreSQL vector type
            metadata.confidence,
            JSON.stringify(metadata.genreAffinities),
            JSON.stringify(metadata.temporalPatterns)
        ]

        result = await self.pool.query(sql, params)
        return result.rows[0].id

    async def storeContentVector(content, embedding):
        """
        Store content embedding with metadata
        """
        sql = """
            INSERT INTO content_vectors (
                content_id, media_type, title, overview,
                vector, genre_ids, vote_average,
                release_date, poster_path
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (content_id, media_type)
            DO UPDATE SET
                vector = EXCLUDED.vector,
                title = EXCLUDED.title,
                overview = EXCLUDED.overview,
                genre_ids = EXCLUDED.genre_ids,
                vote_average = EXCLUDED.vote_average,
                release_date = EXCLUDED.release_date,
                poster_path = EXCLUDED.poster_path
            RETURNING id
        """

        params = [
            content.id,
            content.mediaType,
            content.title,
            content.overview,
            vectorToSQL(embedding),
            content.genreIds,
            content.voteAverage,
            content.releaseDate,
            content.posterPath
        ]

        result = await self.pool.query(sql, params)
        return result.rows[0].id

    async def batchStoreContentVectors(items):
        """
        Batch insert content vectors for efficiency
        Uses PostgreSQL COPY or multi-value INSERT
        """
        return await self.pool.transaction(async (client) => {
            count = 0

            # Batch into chunks of 100
            for chunk in chunks(items, 100):
                values = []
                params = []
                paramIndex = 1

                for item in chunk:
                    values.push(`(
                        $${paramIndex++}, $${paramIndex++},
                        $${paramIndex++}, $${paramIndex++},
                        $${paramIndex++}, $${paramIndex++},
                        $${paramIndex++}, $${paramIndex++},
                        $${paramIndex++}
                    )`)

                    params.extend([
                        item.content.id,
                        item.content.mediaType,
                        item.content.title,
                        item.content.overview,
                        vectorToSQL(item.embedding),
                        item.content.genreIds,
                        item.content.voteAverage,
                        item.content.releaseDate,
                        item.content.posterPath
                    ])

                sql = `
                    INSERT INTO content_vectors (
                        content_id, media_type, title, overview,
                        vector, genre_ids, vote_average,
                        release_date, poster_path
                    ) VALUES ${values.join(', ')}
                    ON CONFLICT (content_id, media_type) DO NOTHING
                `

                result = await client.query(sql, params)
                count += result.rowCount

            return count
        })

    async def searchVectorsSimilar(queryVector, k, threshold, filters):
        """
        k-NN vector similarity search with HNSW index
        Supports hybrid filtering (vector + metadata)
        """
        # Build WHERE clause for filters
        whereClauses = []
        params = [vectorToSQL(queryVector), k]
        paramIndex = 3

        if filters.mediaType:
            whereClauses.push(`media_type = $${paramIndex}`)
            params.push(filters.mediaType)
            paramIndex++

        if filters.genreIds and filters.genreIds.length > 0:
            whereClauses.push(`genre_ids && $${paramIndex}`)
            params.push(filters.genreIds)
            paramIndex++

        if filters.minRating:
            whereClauses.push(`vote_average >= $${paramIndex}`)
            params.push(filters.minRating)
            paramIndex++

        whereClause = whereClauses.length > 0
            ? `WHERE ${whereClauses.join(' AND ')}`
            : ''

        # Use HNSW index for fast k-NN search
        # <=> is cosine distance operator (1 - cosine_similarity)
        sql = `
            SELECT
                id,
                content_id,
                media_type,
                title,
                overview,
                genre_ids,
                vote_average,
                release_date,
                poster_path,
                1 - (vector <=> $1) AS similarity
            FROM content_vectors
            ${whereClause}
            ORDER BY vector <=> $1
            LIMIT $2
        `

        result = await self.pool.query(sql, params)

        # Filter by threshold if specified
        if threshold:
            return result.rows.filter(row => row.similarity >= threshold)

        return result.rows

    async def createHNSWIndex(tableName, vectorColumn):
        """
        Create HNSW index for fast approximate nearest neighbor search
        Parameters:
        - m: max connections per layer (default: 16, higher = better recall)
        - ef_construction: candidates during build (default: 64, higher = better quality)
        """
        indexName = `idx_${tableName}_${vectorColumn}_hnsw`

        sql = `
            CREATE INDEX IF NOT EXISTS ${indexName}
            ON ${tableName}
            USING hnsw (${vectorColumn} vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
        `

        log.info(`Creating HNSW index ${indexName}...`)
        startTime = Date.now()

        await self.pool.query(sql)

        duration = Date.now() - startTime
        log.info(`HNSW index created in ${duration}ms`)
```

### 2.3 AgentDB PostgreSQL Adapter

```python
class AgentDBPostgreSQLAdapter:
    """
    Adapter to persist AgentDB cognitive memory to PostgreSQL
    """

    def __init__(pool, embedder):
        self.pool = pool
        self.embedder = embedder
        self.initialized = false

    async def initialize():
        """Create AgentDB tables in PostgreSQL"""
        await self.createTables()
        self.initialized = true

    async def createTables():
        """Create schema for AgentDB cognitive memory"""
        await self.pool.query(`
            CREATE TABLE IF NOT EXISTS reasoning_patterns (
                id SERIAL PRIMARY KEY,
                task_type VARCHAR(100) NOT NULL,
                approach TEXT NOT NULL,
                success_rate FLOAT DEFAULT 0.0,
                tags TEXT[],
                metadata JSONB,
                embedding vector(384),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `)

        await self.pool.query(`
            CREATE INDEX IF NOT EXISTS idx_reasoning_patterns_embedding_hnsw
            ON reasoning_patterns
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
        `)

        await self.pool.query(`
            CREATE TABLE IF NOT EXISTS reflexion_episodes (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) NOT NULL,
                task TEXT NOT NULL,
                reward FLOAT NOT NULL,
                success BOOLEAN NOT NULL,
                critique TEXT,
                input TEXT,
                output TEXT,
                latency_ms INTEGER,
                tokens_used INTEGER,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `)

        await self.pool.query(`
            CREATE INDEX IF NOT EXISTS idx_reflexion_episodes_session_task
            ON reflexion_episodes(session_id, task)
        `)

        await self.pool.query(`
            CREATE TABLE IF NOT EXISTS skill_library (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                description TEXT,
                signature JSONB,
                code TEXT,
                success_rate FLOAT DEFAULT 0.0,
                uses INTEGER DEFAULT 0,
                avg_reward FLOAT,
                avg_latency_ms INTEGER,
                embedding vector(384),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `)

        await self.pool.query(`
            CREATE INDEX IF NOT EXISTS idx_skill_library_embedding_hnsw
            ON skill_library
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
        `)

    async def storePattern(pattern):
        """Store reasoning pattern (ReasoningBank)"""
        sql = `
            INSERT INTO reasoning_patterns (
                task_type, approach, success_rate,
                tags, metadata, embedding
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `

        params = [
            pattern.taskType,
            pattern.approach,
            pattern.successRate,
            pattern.tags || [],
            JSON.stringify(pattern.metadata || {}),
            pattern.embedding ? vectorToSQL(pattern.embedding) : null
        ]

        result = await self.pool.query(sql, params)
        return result.rows[0].id

    async def searchPatterns(query):
        """Search patterns by semantic similarity"""
        whereClauses = []
        params = []
        paramIndex = 1

        if query.filters?.taskType:
            whereClauses.push(`task_type = $${paramIndex}`)
            params.push(query.filters.taskType)
            paramIndex++

        if query.threshold:
            whereClauses.push(`1 - (embedding <=> $${paramIndex}) >= $${paramIndex + 1}`)
            params.push(vectorToSQL(query.embedding))
            params.push(query.threshold)
            paramIndex += 2

        whereClause = whereClauses.length > 0
            ? `WHERE ${whereClauses.join(' AND ')}`
            : ''

        sql = `
            SELECT
                id, task_type, approach, success_rate,
                tags, metadata, embedding,
                1 - (embedding <=> $1) AS similarity
            FROM reasoning_patterns
            ${whereClause}
            ORDER BY embedding <=> $1
            LIMIT $2
        `

        params.unshift(vectorToSQL(query.embedding))
        params.push(query.k)

        result = await self.pool.query(sql, params)
        return result.rows

    async def storeEpisode(episode):
        """Store reflexion episode (ReflexionMemory)"""
        sql = `
            INSERT INTO reflexion_episodes (
                session_id, task, reward, success,
                critique, input, output,
                latency_ms, tokens_used
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `

        params = [
            episode.sessionId,
            episode.task,
            episode.reward,
            episode.success,
            episode.critique,
            episode.input,
            episode.output,
            episode.latencyMs,
            episode.tokensUsed
        ]

        result = await self.pool.query(sql, params)
        return result.rows[0].id

    async def retrieveRelevantEpisodes(options):
        """Retrieve relevant episodes for learning"""
        whereClauses = [`session_id = $1`]
        params = [options.sessionId]
        paramIndex = 2

        if options.task:
            whereClauses.push(`task LIKE $${paramIndex}`)
            params.push(`%${options.task}%`)
            paramIndex++

        if options.onlySuccesses:
            whereClauses.push(`success = true`)

        sql = `
            SELECT *
            FROM reflexion_episodes
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY created_at DESC
            LIMIT $${paramIndex}
        `

        params.push(options.k)

        result = await self.pool.query(sql, params)
        return result.rows

    async def createSkill(skill):
        """Create skill in library"""
        sql = `
            INSERT INTO skill_library (
                name, description, signature, code,
                success_rate, embedding
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `

        # Generate embedding for skill
        embedding = await self.embedder.generateEmbedding(
            `${skill.name}: ${skill.description}`
        )

        params = [
            skill.name,
            skill.description,
            JSON.stringify(skill.signature),
            skill.code,
            skill.successRate,
            vectorToSQL(embedding)
        ]

        result = await self.pool.query(sql, params)
        return result.rows[0].id

    async def searchSkills(query):
        """Search skills by semantic similarity"""
        queryEmbedding = await self.embedder.generateEmbedding(query.task)

        sql = `
            SELECT
                id, name, description, signature, code,
                success_rate, uses, avg_reward, avg_latency_ms,
                1 - (embedding <=> $1) AS similarity
            FROM skill_library
            WHERE success_rate >= $2
            ORDER BY embedding <=> $1
            LIMIT $3
        `

        params = [
            vectorToSQL(queryEmbedding),
            query.minSuccessRate,
            query.k
        ]

        result = await self.pool.query(sql, params)
        return result.rows
```

### 2.4 Migration Script

```python
class SQLiteToPostgreSQLMigrator:
    """
    Migrate data from SQLite (AgentDB) to PostgreSQL
    """

    def __init__(sqlitePath, postgresPool):
        self.sqlitePath = sqlitePath
        self.postgresPool = postgresPool
        self.dryRun = false

    async def migrate(options):
        """Execute migration with validation"""
        self.dryRun = options.dryRun || false

        log.info("Starting SQLite → PostgreSQL migration")
        log.info(`Dry run: ${self.dryRun}`)

        # Open SQLite database
        sqlite = await openSQLiteDB(self.sqlitePath)

        try:
            # Migrate tables
            stats = {
                reasoningPatterns: await self.migrateReasoningPatterns(sqlite),
                reflexionEpisodes: await self.migrateReflexionEpisodes(sqlite),
                skillLibrary: await self.migrateSkillLibrary(sqlite)
            }

            # Validate migration
            if not self.dryRun:
                await self.validateMigration(sqlite, stats)

            log.info("Migration completed successfully", stats)
            return stats

        finally:
            await sqlite.close()

    async def migrateReasoningPatterns(sqlite):
        """Migrate reasoning_patterns table"""
        # Export from SQLite
        rows = await sqlite.all(`
            SELECT * FROM reasoning_bank
        `)

        if self.dryRun:
            log.info(`[DRY RUN] Would migrate ${rows.length} reasoning patterns`)
            return {exported: rows.length, imported: 0}

        # Import to PostgreSQL in batches
        imported = 0
        for chunk in chunks(rows, 100):
            await self.postgresPool.transaction(async (client) => {
                for row in chunk:
                    await client.query(`
                        INSERT INTO reasoning_patterns (
                            task_type, approach, success_rate,
                            tags, metadata, embedding, created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT DO NOTHING
                    `, [
                        row.task_type,
                        row.approach,
                        row.success_rate,
                        parseJSON(row.tags),
                        row.metadata,
                        parseVector(row.embedding),
                        row.created_at
                    ])
                    imported++
            })

        return {exported: rows.length, imported}

    async def migrateReflexionEpisodes(sqlite):
        """Migrate reflexion_episodes table"""
        rows = await sqlite.all(`
            SELECT * FROM reflexion_episodes
        `)

        if self.dryRun:
            log.info(`[DRY RUN] Would migrate ${rows.length} reflexion episodes`)
            return {exported: rows.length, imported: 0}

        imported = 0
        for chunk in chunks(rows, 100):
            await self.postgresPool.transaction(async (client) => {
                for row in chunk:
                    await client.query(`
                        INSERT INTO reflexion_episodes (
                            session_id, task, reward, success,
                            critique, input, output,
                            latency_ms, tokens_used, created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    `, [
                        row.session_id,
                        row.task,
                        row.reward,
                        row.success,
                        row.critique,
                        row.input,
                        row.output,
                        row.latency_ms,
                        row.tokens_used,
                        row.created_at
                    ])
                    imported++
            })

        return {exported: rows.length, imported}

    async def migrateSkillLibrary(sqlite):
        """Migrate skill_library table"""
        rows = await sqlite.all(`
            SELECT * FROM skills
        `)

        if self.dryRun:
            log.info(`[DRY RUN] Would migrate ${rows.length} skills`)
            return {exported: rows.length, imported: 0}

        imported = 0
        for chunk in chunks(rows, 100):
            await self.postgresPool.transaction(async (client) => {
                for row in chunk:
                    await client.query(`
                        INSERT INTO skill_library (
                            name, description, signature, code,
                            success_rate, uses, avg_reward,
                            avg_latency_ms, embedding, created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        ON CONFLICT (name) DO NOTHING
                    `, [
                        row.name,
                        row.description,
                        row.signature,
                        row.code,
                        row.success_rate,
                        row.uses,
                        row.avg_reward,
                        row.avg_latency_ms,
                        parseVector(row.embedding),
                        row.created_at
                    ])
                    imported++
            })

        return {exported: rows.length, imported}

    async def validateMigration(sqlite, stats):
        """Validate row counts match"""
        log.info("Validating migration...")

        # Check reasoning_patterns
        sqliteCount = await sqlite.get(`SELECT COUNT(*) as count FROM reasoning_bank`)
        pgCount = await self.postgresPool.query(`SELECT COUNT(*) as count FROM reasoning_patterns`)

        if sqliteCount.count != pgCount.rows[0].count:
            throw Error(`
                Reasoning patterns count mismatch:
                SQLite=${sqliteCount.count}, PostgreSQL=${pgCount.rows[0].count}
            `)

        # Check reflexion_episodes
        sqliteCount = await sqlite.get(`SELECT COUNT(*) as count FROM reflexion_episodes`)
        pgCount = await self.postgresPool.query(`SELECT COUNT(*) as count FROM reflexion_episodes`)

        if sqliteCount.count != pgCount.rows[0].count:
            throw Error(`
                Reflexion episodes count mismatch:
                SQLite=${sqliteCount.count}, PostgreSQL=${pgCount.rows[0].count}
            `)

        # Check skill_library
        sqliteCount = await sqlite.get(`SELECT COUNT(*) as count FROM skills`)
        pgCount = await self.postgresPool.query(`SELECT COUNT(*) as count FROM skill_library`)

        if sqliteCount.count != pgCount.rows[0].count:
            throw Error(`
                Skills count mismatch:
                SQLite=${sqliteCount.count}, PostgreSQL=${pgCount.rows[0].count}
            `)

        log.info("✅ Validation passed - all row counts match")
```

---

## Architecture

### 3.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Media Gateway Application                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────┐        ┌──────────────────┐                        │
│  │  Recommendation │        │  User Preference │                        │
│  │     Engine      │◄──────►│     Service      │                        │
│  └────────┬────────┘        └────────┬─────────┘                        │
│           │                          │                                   │
│           │                          │                                   │
│  ┌────────▼──────────────────────────▼─────────┐                        │
│  │        AgentDB Vector Service               │                        │
│  │  (SIMD-accelerated vector operations)       │                        │
│  └────────┬──────────────────────────┬─────────┘                        │
│           │                          │                                   │
│           │                          │                                   │
│  ┌────────▼──────────┐      ┌───────▼──────────┐                        │
│  │  AgentDB Wrapper  │      │  RuVector        │                        │
│  │  - ReasoningBank  │      │  Wrapper         │                        │
│  │  - ReflexionMem   │      │  - Embeddings    │                        │
│  │  - SkillLibrary   │      │  - Semantic      │                        │
│  └────────┬──────────┘      └───────┬──────────┘                        │
│           │                          │                                   │
└───────────┼──────────────────────────┼───────────────────────────────────┘
            │                          │
            │                          │
            │  ┌───────────────────────▼───────────────────────┐
            │  │   PostgreSQL Connection Pool                  │
            │  │   - Min: 2, Max: 10 connections               │
            │  │   - SSL/TLS support                           │
            │  │   - Auto-reconnect with backoff               │
            │  │   - Query timeout: 10s                        │
            │  │   - Transaction management                    │
            │  └───────────────────────┬───────────────────────┘
            │                          │
            └──────────────────────────┼────────────────────────┐
                                       │                        │
                                       │                        │
       ┌───────────────────────────────▼────────────────────────▼─────────┐
       │                    ruvector/postgres:latest                      │
       │                    Docker Container                              │
       ├──────────────────────────────────────────────────────────────────┤
       │                                                                   │
       │  ┌────────────────────────────────────────────────────────────┐  │
       │  │              PostgreSQL 16.x with Extensions                │  │
       │  ├────────────────────────────────────────────────────────────┤  │
       │  │  • pgvector: Vector data type and operations               │  │
       │  │  • 53+ SQL vector functions (drop-in pgvector replacement) │  │
       │  │  • HNSW indexing (150x faster than brute-force)            │  │
       │  │  • IVFFlat indexing                                        │  │
       │  │  • GNN self-learning indexes                               │  │
       │  │  • SIMD acceleration (AVX-512/AVX2/NEON)                   │  │
       │  │  • Hyperbolic embedding support                            │  │
       │  │  • Raft consensus for horizontal scaling                   │  │
       │  └────────────────────────────────────────────────────────────┘  │
       │                                                                   │
       │  ┌────────────────────────────────────────────────────────────┐  │
       │  │                    Database Schema                          │  │
       │  ├────────────────────────────────────────────────────────────┤  │
       │  │  Tables:                                                    │  │
       │  │  • user_preferences (vector(384) + HNSW)                   │  │
       │  │  • content_vectors (vector(768) + HNSW)                    │  │
       │  │  • reasoning_patterns (vector(384) + HNSW)                 │  │
       │  │  • reflexion_episodes                                      │  │
       │  │  • skill_library (vector(384) + HNSW)                      │  │
       │  └────────────────────────────────────────────────────────────┘  │
       │                                                                   │
       │  ┌────────────────────────────────────────────────────────────┐  │
       │  │              Persistent Volume Mount                        │  │
       │  │              /var/lib/postgresql/data                       │  │
       │  └────────────────────────────────────────────────────────────┘  │
       │                                                                   │
       └───────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          WRITE PATH                                  │
└─────────────────────────────────────────────────────────────────────┘

User Watch Event
      │
      ▼
┌─────────────────┐
│ Event Processor │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐         ┌──────────────────────┐
│ Generate Embedding  │────────►│  Embedding Cache     │
│ (OpenAI/VertexAI)   │         │  (5-min TTL)         │
└────────┬────────────┘         └──────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Update Preference Vector (EMA)     │
│  new = (1-α)*old + α*embedding      │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  PostgreSQL Transaction BEGIN       │
└────────┬────────────────────────────┘
         │
         ├──► UPSERT user_preferences (vector, confidence, metadata)
         │
         ├──► INSERT reflexion_episodes (reward, success, critique)
         │
         ├──► UPDATE reasoning_patterns (success_rate)
         │
         ▼
┌─────────────────────────────────────┐
│  COMMIT Transaction                 │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  HNSW Index Auto-Updated            │
│  (PostgreSQL internal)              │
└─────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                          READ PATH                                   │
└─────────────────────────────────────────────────────────────────────┘

User Query ("sci-fi movies like Interstellar")
      │
      ▼
┌─────────────────┐
│ Generate Query  │
│ Embedding       │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL k-NN Search with HNSW Index                         │
│                                                                  │
│  SELECT id, title, 1 - (vector <=> $1) AS similarity            │
│  FROM content_vectors                                           │
│  WHERE media_type = 'movie'                                     │
│    AND genre_ids && ARRAY[878]  -- Sci-Fi                       │
│    AND vote_average >= 7.0                                      │
│  ORDER BY vector <=> $1                                         │
│  LIMIT 20                                                       │
│                                                                  │
│  Index Scan: idx_content_vectors_vector_hnsw                    │
│  Filter: metadata conditions                                    │
│  Execution: <50ms p95                                           │
└────────┬────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Hybrid Re-Ranking                  │
│  - Vector similarity: 70%           │
│  - Metadata boost: 30%              │
│    (vote_average, recency, etc)     │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Return Top 10 Results              │
│  - Content metadata                 │
│  - Similarity scores                │
│  - Explanation (genre match, etc)   │
└─────────────────────────────────────┘
```

### 3.3 Deployment Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                      DEVELOPMENT ENVIRONMENT                       │
└───────────────────────────────────────────────────────────────────┘

Developer Laptop
├── Docker Desktop
│   └── docker-compose.yml
│       ├── ruvector/postgres:latest (port 5432)
│       │   └── Volume: ./data/postgres
│       └── (optional) pgAdmin (port 5050)
│
└── Node.js Application
    ├── @media-gateway/database
    │   ├── AgentDBWrapper → PostgreSQL
    │   └── RuVectorWrapper → PostgreSQL
    └── Connection: postgresql://localhost:5432/mediagateway


┌───────────────────────────────────────────────────────────────────┐
│                     PRODUCTION ENVIRONMENT                         │
└───────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Load Balancer (HTTPS)                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐     ┌────▼────┐    ┌────▼────┐
    │  App    │     │  App    │    │  App    │
    │  Node 1 │     │  Node 2 │    │  Node 3 │
    └────┬────┘     └────┬────┘    └────┬────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
              ┌──────────▼──────────┐
              │  PgBouncer Pool     │
              │  (Connection Pool)  │
              └──────────┬──────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐     ┌────▼────┐    ┌────▼────┐
    │ PG      │     │ PG      │    │ PG      │
    │ Primary │────►│ Replica │    │ Replica │
    │ (Write) │     │ (Read)  │    │ (Read)  │
    └────┬────┘     └─────────┘    └─────────┘
         │
         │  Raft Consensus
         ▼
    Persistent Storage
    (AWS EBS / GCP PD)
```

### 3.4 Technology Stack

```
┌──────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                         │
├──────────────────────────────────────────────────────────────┤
│  Runtime:        Node.js 20+ (ES Modules)                    │
│  Language:       TypeScript 5.6+                             │
│  Package Mgr:    pnpm 9.0+                                   │
│  Framework:      Express.js (API server)                     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                           │
├──────────────────────────────────────────────────────────────┤
│  Database:       PostgreSQL 16.x                             │
│  Vector Ext:     ruvector (pgvector-compatible)              │
│  Connection:     node-postgres (pg) 8.x                      │
│  Pool:           pg.Pool (min: 2, max: 10)                   │
│  ORM:            Raw SQL (performance-critical)              │
│  Migration:      Custom TypeScript scripts                   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                      VECTOR LAYER                             │
├──────────────────────────────────────────────────────────────┤
│  AgentDB:        ^2.0.0-alpha.2.18                           │
│  RuVector:       ^0.1.31                                     │
│  Embeddings:     OpenAI text-embedding-3-small (768-dim)     │
│                  Google Vertex AI text-embedding-004         │
│                  Xenova/all-MiniLM-L6-v2 (384-dim)           │
│  SIMD:           AVX-512 / AVX2 / NEON                       │
│  Indexing:       HNSW (m=16, ef_construction=64)             │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                     INFRASTRUCTURE                            │
├──────────────────────────────────────────────────────────────┤
│  Container:      Docker 24+                                  │
│  Orchestration:  Docker Compose 2.x (dev)                    │
│                  Kubernetes 1.28+ (prod)                     │
│  Image:          ruvector/postgres:latest                    │
│  Storage:        Persistent volumes (local / cloud)          │
│  Networking:     Bridge network (dev), overlay (prod)        │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   OBSERVABILITY                               │
├──────────────────────────────────────────────────────────────┤
│  Logging:        Pino (structured JSON logs)                 │
│  Metrics:        PostgreSQL pg_stat_statements               │
│                  Custom Prometheus exporter                  │
│  Tracing:        OpenTelemetry (optional)                    │
│  Monitoring:     Grafana dashboards                          │
│  Alerting:       PagerDuty / Slack webhooks                  │
└──────────────────────────────────────────────────────────────┘
```

---

## Refinement

### 4.1 Performance Optimization

#### 4.1.1 HNSW Index Tuning

**Problem**: Default HNSW parameters may not be optimal for our use case.

**Analysis**:
- `m` (max connections per layer): Higher = better recall, more memory
- `ef_construction` (build-time candidates): Higher = better index quality, slower build
- `ef_search` (query-time candidates): Higher = better recall, slower search

**Recommendations**:
```sql
-- For high-recall use case (content recommendations)
CREATE INDEX idx_content_hnsw ON content_vectors
USING hnsw (vector vector_cosine_ops)
WITH (m = 32, ef_construction = 128);

-- For balanced use case (user preferences)
CREATE INDEX idx_user_hnsw ON user_preferences
USING hnsw (vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- For speed-critical use case (realtime search)
CREATE INDEX idx_realtime_hnsw ON reasoning_patterns
USING hnsw (vector vector_cosine_ops)
WITH (m = 8, ef_construction = 32);
```

**Runtime tuning**:
```sql
-- Increase ef_search for better recall (per-query)
SET hnsw.ef_search = 100;

-- Or set globally
ALTER DATABASE mediagateway SET hnsw.ef_search = 100;
```

#### 4.1.2 Connection Pool Optimization

**Problem**: Too few connections = queue buildup, too many = overhead.

**Recommendations**:
- **Development**: min=2, max=5 (low concurrency)
- **Staging**: min=5, max=20 (moderate load)
- **Production**: min=10, max=50 (high concurrency)
- Use PgBouncer for connection pooling in production

**Configuration**:
```typescript
const poolConfig = {
  min: parseInt(process.env.DB_POOL_MIN || '2'),
  max: parseInt(process.env.DB_POOL_MAX || '10'),
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 60000,
  maxUses: 7500, // Recycle connections after 7500 uses
  allowExitOnIdle: true, // Allow Node.js to exit when idle
};
```

#### 4.1.3 Batch Operations

**Problem**: One-by-one inserts are slow for large datasets.

**Solution**: Batch insert with multi-value INSERT:
```sql
-- Instead of 100 separate INSERTs
INSERT INTO content_vectors (...) VALUES (...);  -- x100

-- Use single multi-value INSERT
INSERT INTO content_vectors (...)
VALUES (...), (...), (...), ...;  -- 100 rows in one statement
```

**Benchmark target**: >100 vectors/sec insertion rate.

#### 4.1.4 Query Optimization

**Problem**: Metadata filters after vector search is inefficient.

**Solution**: Push filters down to WHERE clause:
```sql
-- ❌ BAD: Scan all vectors, then filter
SELECT * FROM (
  SELECT *, vector <=> $1 AS dist
  FROM content_vectors
  ORDER BY dist
  LIMIT 100
) WHERE media_type = 'movie';

-- ✅ GOOD: Filter first, then vector search
SELECT *, vector <=> $1 AS dist
FROM content_vectors
WHERE media_type = 'movie'
  AND vote_average >= 7.0
ORDER BY dist
LIMIT 20;
```

Create composite indexes for common filters:
```sql
CREATE INDEX idx_content_type_rating
ON content_vectors(media_type, vote_average);
```

### 4.2 Scalability Considerations

#### 4.2.1 Horizontal Scaling with Raft

**Architecture**: 3-node Raft cluster for high availability.

```yaml
# docker-compose.raft.yml
services:
  postgres-1:
    image: ruvector/postgres:latest
    environment:
      RAFT_NODE_ID: 1
      RAFT_CLUSTER: "1:postgres-1:5432,2:postgres-2:5432,3:postgres-3:5432"
      RAFT_ROLE: leader

  postgres-2:
    image: ruvector/postgres:latest
    environment:
      RAFT_NODE_ID: 2
      RAFT_CLUSTER: "1:postgres-1:5432,2:postgres-2:5432,3:postgres-3:5432"
      RAFT_ROLE: follower

  postgres-3:
    image: ruvector/postgres:latest
    environment:
      RAFT_NODE_ID: 3
      RAFT_CLUSTER: "1:postgres-1:5432,2:postgres-2:5432,3:postgres-3:5432"
      RAFT_ROLE: follower
```

**Connection routing**:
- Writes → Primary (Raft leader)
- Reads → Replicas (round-robin)

#### 4.2.2 Read Replicas

**Strategy**: Separate read and write traffic.

```typescript
// Write pool (primary)
const writePool = new Pool({
  host: 'postgres-primary',
  port: 5432,
  max: 10,
});

// Read pool (replicas)
const readPool = new Pool({
  host: 'postgres-replicas',  // Load balancer DNS
  port: 5432,
  max: 50,
});

// Usage
async function search(query) {
  return readPool.query('SELECT ...', [query]);
}

async function update(userId, vector) {
  return writePool.query('UPDATE ...', [userId, vector]);
}
```

#### 4.2.3 Partitioning Strategy

**When**: >10M vectors per table.

**Strategy**: Partition by mediaType or userId:
```sql
-- Partition content_vectors by media_type
CREATE TABLE content_vectors (
  id SERIAL,
  content_id INTEGER,
  media_type VARCHAR(10),
  vector vector(768),
  ...
) PARTITION BY LIST (media_type);

CREATE TABLE content_vectors_movie
PARTITION OF content_vectors
FOR VALUES IN ('movie');

CREATE TABLE content_vectors_tv
PARTITION OF content_vectors
FOR VALUES IN ('tv');

-- Indexes on each partition
CREATE INDEX idx_movie_vector_hnsw
ON content_vectors_movie USING hnsw (vector vector_cosine_ops);

CREATE INDEX idx_tv_vector_hnsw
ON content_vectors_tv USING hnsw (vector vector_cosine_ops);
```

### 4.3 Reliability & Fault Tolerance

#### 4.3.1 Retry Logic

**Transient failures**: Network blips, temporary unavailability.

```typescript
async function queryWithRetry<T>(
  pool: Pool,
  sql: string,
  params: any[],
  maxRetries = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await pool.query(sql, params);
      return result.rows as T;
    } catch (error) {
      lastError = error;

      // Retry on connection errors
      if (
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === '57P03'  // Server shutting down
      ) {
        const backoff = Math.pow(2, attempt) * 100;  // Exponential backoff
        await sleep(backoff);
        continue;
      }

      // Don't retry on application errors
      throw error;
    }
  }

  throw lastError;
}
```

#### 4.3.2 Circuit Breaker

**Problem**: Cascading failures when database is down.

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold = 5,
    private timeout = 60000  // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure! > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}
```

#### 4.3.3 Health Checks

**Docker health check**:
```yaml
services:
  postgres:
    image: ruvector/postgres:latest
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
```

**Application health check**:
```typescript
async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT 1');
    return result.rowCount === 1;
  } catch {
    return false;
  }
}

// HTTP endpoint
app.get('/health', async (req, res) => {
  const dbHealthy = await checkDatabaseHealth();

  if (dbHealthy) {
    res.status(200).json({ status: 'healthy', database: 'connected' });
  } else {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
  }
});
```

### 4.4 Security Hardening

#### 4.4.1 SSL/TLS Connections

**Production requirement**: All connections encrypted.

```typescript
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca-cert.pem'),
  } : false,
});
```

#### 4.4.2 Prepared Statements

**Protection**: SQL injection prevention.

```typescript
// ✅ GOOD: Parameterized query
const result = await pool.query(
  'SELECT * FROM users WHERE email = $1',
  [userEmail]
);

// ❌ BAD: String concatenation
const result = await pool.query(
  `SELECT * FROM users WHERE email = '${userEmail}'`
);
```

#### 4.4.3 Role-Based Access Control

```sql
-- Create read-only role for analytics
CREATE ROLE analytics_reader WITH LOGIN PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE mediagateway TO analytics_reader;
GRANT USAGE ON SCHEMA public TO analytics_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO analytics_reader;

-- Create application role with limited permissions
CREATE ROLE app_user WITH LOGIN PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE mediagateway TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Revoke DELETE from application (use soft deletes)
REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM app_user;
```

### 4.5 Operational Excellence

#### 4.5.1 Monitoring & Observability

**Key metrics to track**:
- Query latency (p50, p95, p99)
- Connection pool utilization
- Vector search performance
- Index size and build time
- Replication lag (if using replicas)

**Prometheus exporter**:
```typescript
import { Counter, Histogram } from 'prom-client';

const queryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

const queryErrors = new Counter({
  name: 'db_query_errors_total',
  help: 'Total database query errors',
  labelNames: ['operation', 'error_code'],
});

// Instrument queries
async function instrumentedQuery(sql, params, labels) {
  const timer = queryDuration.startTimer(labels);
  try {
    const result = await pool.query(sql, params);
    timer();
    return result;
  } catch (error) {
    queryErrors.inc({ ...labels, error_code: error.code });
    throw error;
  }
}
```

#### 4.5.2 Backup & Recovery

**Strategy**: Automated daily backups with point-in-time recovery.

```bash
# Automated backup script
#!/bin/bash
BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mediagateway_$TIMESTAMP.dump"

# Perform backup
pg_dump -h localhost -U postgres -Fc mediagateway > $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Upload to cloud storage (S3, GCS, etc.)
aws s3 cp $BACKUP_FILE.gz s3://my-bucket/backups/

# Cleanup old backups (keep last 30 days)
find $BACKUP_DIR -name "*.dump.gz" -mtime +30 -delete
```

**Recovery**:
```bash
# Restore from backup
pg_restore -h localhost -U postgres -d mediagateway -c $BACKUP_FILE
```

#### 4.5.3 Schema Migrations

**Version control**: Track schema changes in Git.

```typescript
// migrations/001_initial_schema.ts
export async function up(pool: Pool) {
  await pool.query(`
    CREATE TABLE user_preferences (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL UNIQUE,
      vector vector(384),
      confidence FLOAT DEFAULT 0.0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX idx_user_preferences_vector_hnsw
    ON user_preferences
    USING hnsw (vector vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
  `);
}

export async function down(pool: Pool) {
  await pool.query('DROP TABLE IF EXISTS user_preferences CASCADE');
}
```

**Migration runner**:
```typescript
async function runMigrations(pool: Pool, direction: 'up' | 'down') {
  const migrations = [
    require('./001_initial_schema'),
    require('./002_add_content_vectors'),
    require('./003_add_reasoning_patterns'),
  ];

  for (const migration of migrations) {
    console.log(`Running migration: ${migration.name}`);
    await migration[direction](pool);
  }
}
```

---

## Completion

### 5.1 Definition of Done

The integration is considered **complete** when all of the following criteria are met:

#### 5.1.1 Functional Completeness
- [ ] Docker Compose starts ruvector/postgres container successfully
- [ ] All database tables created with correct schema
- [ ] HNSW indexes built on all vector columns
- [ ] AgentDB wrapper persists to PostgreSQL instead of SQLite
- [ ] RuVector wrapper persists to PostgreSQL instead of in-memory
- [ ] Migration script successfully transfers existing data
- [ ] All unit tests pass (>90% coverage)
- [ ] All integration tests pass
- [ ] End-to-end tests validate complete workflow

#### 5.1.2 Performance Requirements
- [ ] k-NN search (k=10) completes in <50ms p95
- [ ] Batch insert >100 vectors/sec
- [ ] HNSW index build <2 minutes for 10k vectors
- [ ] Connection pool handles 100 concurrent requests
- [ ] No memory leaks over 24-hour stress test

#### 5.1.3 Reliability Requirements
- [ ] Application survives PostgreSQL restart
- [ ] Data persists across container restarts
- [ ] Automatic reconnection on connection loss
- [ ] Circuit breaker prevents cascading failures
- [ ] Health checks validate system status

#### 5.1.4 Security Requirements
- [ ] SSL/TLS connections in production mode
- [ ] No hardcoded credentials (environment variables)
- [ ] Prepared statements prevent SQL injection
- [ ] Role-based access control configured
- [ ] Security scan passes (OWASP ZAP)

#### 5.1.5 Documentation
- [ ] Architecture diagram reviewed and approved
- [ ] API documentation updated
- [ ] README includes setup instructions
- [ ] Migration guide for developers
- [ ] Runbook for operations team

### 5.2 Validation Plan

#### 5.2.1 Unit Tests
```typescript
describe('PostgreSQLConnectionPool', () => {
  it('should establish connection pool', async () => {
    const pool = new PostgreSQLConnectionPool(config);
    await pool.initialize();

    const result = await pool.query('SELECT 1');
    expect(result.rows[0]).toEqual({ '?column?': 1 });

    await pool.close();
  });

  it('should handle connection timeout', async () => {
    const pool = new PostgreSQLConnectionPool({
      ...config,
      connectionTimeout: 100,
    });

    await expect(pool.initialize()).rejects.toThrow('timeout');
  });
});

describe('VectorStorage', () => {
  it('should store and retrieve user preference vector', async () => {
    const storage = new VectorStorage(pool);
    const vector = new Float32Array(384).fill(0.1);

    const id = await storage.storeUserPreference('user123', vector, {
      confidence: 0.85,
      genreAffinities: { action: 0.9, scifi: 0.8 },
    });

    expect(id).toBeGreaterThan(0);

    const result = await pool.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      ['user123']
    );

    expect(result.rows[0].confidence).toBe(0.85);
  });

  it('should perform k-NN search with HNSW', async () => {
    const storage = new VectorStorage(pool);
    const queryVector = new Float32Array(768).fill(0.1);

    const results = await storage.searchVectorsSimilar(queryVector, 10, 0.5, {
      mediaType: 'movie',
    });

    expect(results.length).toBeLessThanOrEqual(10);
    expect(results[0].similarity).toBeGreaterThanOrEqual(0.5);
  });
});
```

#### 5.2.2 Integration Tests
```typescript
describe('AgentDB Integration', () => {
  it('should persist ReasoningBank patterns', async () => {
    const wrapper = new AgentDBWrapper('./test.db');
    await wrapper.initialize();

    const adapter = new AgentDBPostgreSQLAdapter(pool, embedder);
    await adapter.initialize();

    // Store pattern
    const pattern = {
      taskType: 'user_preference',
      approach: 'Test pattern',
      successRate: 0.9,
      tags: ['test'],
      embedding: new Float32Array(384).fill(0.1),
    };

    const id = await adapter.storePattern(pattern);

    // Verify persistence
    const result = await pool.query(
      'SELECT * FROM reasoning_patterns WHERE id = $1',
      [id]
    );

    expect(result.rows[0].task_type).toBe('user_preference');
    expect(result.rows[0].success_rate).toBe(0.9);
  });
});

describe('Migration', () => {
  it('should migrate SQLite to PostgreSQL without data loss', async () => {
    // Setup: Create SQLite with test data
    const sqlite = await createTestSQLite();
    await sqlite.query('INSERT INTO reasoning_bank ...');

    // Execute migration
    const migrator = new SQLiteToPostgreSQLMigrator(
      './test.db',
      pool
    );
    const stats = await migrator.migrate({ dryRun: false });

    // Verify row counts
    const sqliteCount = await sqlite.query('SELECT COUNT(*) FROM reasoning_bank');
    const pgCount = await pool.query('SELECT COUNT(*) FROM reasoning_patterns');

    expect(pgCount.rows[0].count).toBe(sqliteCount.rows[0].count);
  });
});
```

#### 5.2.3 Performance Benchmarks
```typescript
describe('Performance Benchmarks', () => {
  it('should achieve <50ms p95 latency for k-NN search', async () => {
    const storage = new VectorStorage(pool);
    const latencies: number[] = [];

    for (let i = 0; i < 1000; i++) {
      const queryVector = new Float32Array(768).map(() => Math.random());

      const start = Date.now();
      await storage.searchVectorsSimilar(queryVector, 10, 0.5, {});
      const duration = Date.now() - start;

      latencies.push(duration);
    }

    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)];

    expect(p95).toBeLessThan(50);
  });

  it('should insert >100 vectors/sec', async () => {
    const storage = new VectorStorage(pool);
    const vectors = Array.from({ length: 1000 }, (_, i) => ({
      content: createMockContent(i),
      embedding: new Float32Array(768).map(() => Math.random()),
    }));

    const start = Date.now();
    await storage.batchStoreContentVectors(vectors);
    const duration = (Date.now() - start) / 1000;  // seconds

    const throughput = vectors.length / duration;
    expect(throughput).toBeGreaterThan(100);
  });
});
```

### 5.3 Success Metrics

#### 5.3.1 Technical Metrics
- **Vector search latency**: p95 <50ms (target: <20ms)
- **Write throughput**: >100 vectors/sec (target: >500 vectors/sec)
- **Index build time**: <2 minutes for 10k vectors
- **Connection pool utilization**: 50-80% during peak load
- **Error rate**: <0.1% of queries
- **Uptime**: >99.9% (< 43 minutes downtime/month)

#### 5.3.2 Business Metrics
- **Setup time**: Developer <5 minutes to running system
- **Migration downtime**: <1 hour for production cutover
- **Data loss**: 0 rows lost during migration
- **Team satisfaction**: >8/10 developer experience rating

### 5.4 Rollout Plan

#### Phase 1: Development (Week 1-2)
- [ ] Implement PostgreSQL connection pool
- [ ] Create database schema and migrations
- [ ] Implement AgentDB PostgreSQL adapter
- [ ] Implement RuVector PostgreSQL adapter
- [ ] Write unit tests (>90% coverage)
- [ ] Docker Compose configuration
- [ ] Developer documentation

#### Phase 2: Testing (Week 3)
- [ ] Integration tests
- [ ] Performance benchmarks
- [ ] Load testing (1k, 10k, 100k vectors)
- [ ] Security testing
- [ ] Migration script validation
- [ ] Peer code review

#### Phase 3: Staging (Week 4)
- [ ] Deploy to staging environment
- [ ] Migrate staging data
- [ ] Validation testing
- [ ] Performance tuning
- [ ] Monitoring setup
- [ ] Operations runbook

#### Phase 4: Production (Week 5)
- [ ] Blue-green deployment preparation
- [ ] Production migration dry-run
- [ ] Go/no-go decision
- [ ] Execute migration
- [ ] Validate data integrity
- [ ] Monitor for 48 hours
- [ ] Decommission old SQLite storage

### 5.5 Rollback Plan

If critical issues arise during production rollout:

1. **Immediate rollback** (<5 minutes):
   - Revert application code to previous version
   - Switch database connection back to SQLite
   - Restore from latest backup if needed

2. **Data preservation**:
   - All PostgreSQL data remains intact
   - SQLite backup retained for 30 days
   - Can resume migration after issue resolution

3. **Triggers for rollback**:
   - Data loss detected (row count mismatch >0.1%)
   - Performance degradation (p95 latency >200ms)
   - Error rate >1%
   - Critical security vulnerability

### 5.6 Post-Launch Monitoring

#### Week 1: Intensive monitoring
- Real-time dashboard monitoring
- Daily performance reports
- On-call engineer assigned

#### Week 2-4: Active monitoring
- Daily automated reports
- Weekly review meetings
- Performance trend analysis

#### Month 2+: Standard monitoring
- Weekly automated reports
- Monthly review meetings
- Continuous optimization

---

## Appendices

### A. Environment Variables

```bash
# PostgreSQL Connection
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mediagateway
DB_USER=postgres
DB_PASSWORD=secure_password_here
DB_SSL=false  # true in production

# Connection Pool
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_CONNECTION_TIMEOUT=30000
DB_QUERY_TIMEOUT=10000

# Vector Dimensions
AGENTDB_VECTOR_DIM=384
RUVECTOR_VECTOR_DIM=768

# HNSW Parameters
HNSW_M=16
HNSW_EF_CONSTRUCTION=64
HNSW_EF_SEARCH=40

# Embedding Providers
OPENAI_API_KEY=sk-...
GOOGLE_VERTEX_PROJECT_ID=my-project
GOOGLE_ACCESS_TOKEN=ya29...
```

### B. Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: ruvector/postgres:latest
    container_name: media-gateway-postgres
    restart: unless-stopped

    environment:
      POSTGRES_DB: ${DB_NAME:-mediagateway}
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:?Database password required}
      POSTGRES_INITDB_ARGS: "-E UTF8 --locale=en_US.UTF-8"

    ports:
      - "${DB_PORT:-5432}:5432"

    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/01-init.sql

    healthcheck:
      test: ["CMD", "pg_isready", "-U", "${DB_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

    networks:
      - media-gateway

volumes:
  postgres_data:
    driver: local

networks:
  media-gateway:
    driver: bridge
```

### C. Initial Schema Script

```sql
-- scripts/init.sql
-- Executed on first container startup

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify vector extension loaded
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE EXCEPTION 'Vector extension not loaded';
  END IF;
END $$;

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  vector vector(384),
  confidence FLOAT DEFAULT 0.0,
  genre_affinities JSONB,
  temporal_patterns JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create HNSW index on user_preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_vector_hnsw
ON user_preferences
USING hnsw (vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create content_vectors table
CREATE TABLE IF NOT EXISTS content_vectors (
  id SERIAL PRIMARY KEY,
  content_id INTEGER NOT NULL,
  media_type VARCHAR(10) NOT NULL,
  title TEXT NOT NULL,
  overview TEXT,
  vector vector(768),
  genre_ids INTEGER[],
  vote_average FLOAT,
  release_date DATE,
  poster_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(content_id, media_type)
);

-- Create HNSW index on content_vectors
CREATE INDEX IF NOT EXISTS idx_content_vectors_vector_hnsw
ON content_vectors
USING hnsw (vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create metadata indexes
CREATE INDEX IF NOT EXISTS idx_content_vectors_media_type
ON content_vectors(media_type);

CREATE INDEX IF NOT EXISTS idx_content_vectors_vote_average
ON content_vectors(vote_average);

-- Log successful initialization
DO $$
BEGIN
  RAISE NOTICE 'Media Gateway schema initialized successfully';
END $$;
```

### D. Useful SQL Queries

```sql
-- Check vector extension version
SELECT * FROM pg_extension WHERE extname LIKE '%vector%';

-- Verify HNSW index exists
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname LIKE '%hnsw%';

-- Check index size
SELECT
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_indexes
WHERE indexname LIKE '%hnsw%';

-- Get table row counts
SELECT
  schemaname,
  tablename,
  n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- Monitor query performance
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time,
  stddev_exec_time
FROM pg_stat_statements
WHERE query LIKE '%vector%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check connection pool usage
SELECT
  datname,
  count(*) as connections,
  max_conn,
  round(100.0 * count(*) / max_conn, 2) as pct_used
FROM pg_stat_activity
CROSS JOIN (SELECT setting::int as max_conn FROM pg_settings WHERE name = 'max_connections') mc
GROUP BY datname, max_conn;
```

---

## References

1. **RuVector Documentation**: https://github.com/ruvnet/ruvector
2. **AgentDB Documentation**: https://github.com/ruvnet/agentdb
3. **PostgreSQL pgvector**: https://github.com/pgvector/pgvector
4. **HNSW Algorithm**: https://arxiv.org/abs/1603.09320
5. **Node.js pg Driver**: https://node-postgres.com/
6. **Docker Compose**: https://docs.docker.com/compose/

---

**Document Status**: Draft Specification
**Next Steps**: Review → Approve → Implement → Test → Deploy
**Owner**: Media Gateway Engineering Team
**Last Updated**: 2025-12-08

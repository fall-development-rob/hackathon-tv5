/**
 * PostgreSQL Vector Adapter for Media Gateway
 * Implements production-ready vector storage with pgvector/ruvector extensions
 * Based on SPARC specification: ruvector-postgres-integration.md
 */

import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';

// =========================================================================
// Type Definitions
// =========================================================================

export interface PostgreSQLConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | { rejectUnauthorized: boolean; ca?: string };
  minConnections?: number;
  maxConnections?: number;
  connectionTimeout?: number;
  queryTimeout?: number;
}

export interface UserPreferenceData {
  userId: string;
  vector: Float32Array;
  confidence: number;
  genreAffinities?: Record<string, number>;
  temporalPatterns?: any;
}

export interface ContentVectorData {
  contentId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  overview: string;
  vector: Float32Array;
  genreIds: number[];
  voteAverage: number;
  releaseDate: string;
  posterPath: string | null;
}

export interface VectorSearchOptions {
  queryVector: Float32Array;
  k: number;
  threshold?: number;
  filters?: {
    mediaType?: 'movie' | 'tv';
    genreIds?: number[];
    minRating?: number;
    releaseDateRange?: { start: Date; end: Date };
  };
}

export interface VectorSearchResult {
  id: number;
  contentId: number;
  content_id?: number;
  mediaType: string;
  media_type?: string;
  title: string;
  overview: string;
  similarity: number;
  genre_ids?: number[];
  vote_average?: number;
  release_date?: string;
  poster_path?: string | null;
  metadata: Record<string, unknown>;
}

export interface ReasoningPattern {
  taskType: string;
  approach: string;
  successRate: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  embedding?: Float32Array;
}

export interface ReflexionEpisode {
  sessionId: string;
  task: string;
  reward: number;
  success: boolean;
  critique?: string;
  input: string;
  output: string;
  latencyMs?: number;
  tokensUsed?: number;
}

export interface SkillDefinition {
  name: string;
  description: string;
  signature: Record<string, unknown>;
  code: string;
  successRate: number;
}

// =========================================================================
// Utility Functions
// =========================================================================

/**
 * Convert Float32Array to PostgreSQL vector format
 * @param vector - Float32Array to convert
 * @returns PostgreSQL vector string format: '[0.1,0.2,0.3,...]'
 */
export function vectorToSQL(vector: Float32Array): string {
  return `[${Array.from(vector).join(',')}]`;
}

/**
 * Parse PostgreSQL vector string to Float32Array
 * @param vectorString - PostgreSQL vector format string
 * @returns Float32Array
 */
export function sqlToVector(vectorString: string): Float32Array {
  const cleaned = vectorString.replace(/[\[\]]/g, '');
  const values = cleaned.split(',').map(v => parseFloat(v.trim()));
  return new Float32Array(values);
}

// =========================================================================
// PostgreSQL Connection Pool
// =========================================================================

export class PostgreSQLConnectionPool {
  private pool: Pool | null = null;
  private config: PostgreSQLConfig;
  private initialized: boolean = false;

  constructor(config: PostgreSQLConfig) {
    this.config = {
      minConnections: 2,
      maxConnections: 10,
      connectionTimeout: 30000,
      queryTimeout: 10000,
      ...config,
    };
  }

  /**
   * Initialize connection pool with vector extensions
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const poolConfig: PoolConfig = {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        ssl: this.config.ssl,
        min: this.config.minConnections,
        max: this.config.maxConnections,
        connectionTimeoutMillis: this.config.connectionTimeout,
        query_timeout: this.config.queryTimeout,
        idleTimeoutMillis: 60000,
      };

      this.pool = new Pool(poolConfig);

      // Verify vector extensions loaded
      const result = await this.query(
        "SELECT * FROM pg_extension WHERE extname LIKE '%vector%'"
      );

      if (result.rows.length === 0) {
        console.warn('Vector extension not loaded in PostgreSQL');
      }

      this.initialized = true;
      console.log('✅ PostgreSQL connection pool initialized with vector support');
    } catch (error) {
      console.error('Failed to initialize PostgreSQL connection pool:', error);
      throw error;
    }
  }

  /**
   * Execute query with timeout
   */
  async query<T extends QueryResultRow = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('PostgreSQL pool not initialized');
    }

    try {
      const result = await this.pool.query<T>(sql, params);
      return result;
    } catch (error: any) {
      if (error.code === '57014') {
        console.warn('Query timeout exceeded', { sql, timeout: this.config.queryTimeout });
      }
      throw error;
    }
  }

  /**
   * Execute operations in transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('PostgreSQL pool not initialized');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.initialized = false;
      console.log('PostgreSQL connection pool closed');
    }
  }

  /**
   * Check if pool is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// =========================================================================
// Vector Storage Operations
// =========================================================================

export class VectorStorage {
  constructor(private pool: PostgreSQLConnectionPool) {}

  /**
   * Store or update user preference vector
   * Uses UPSERT for idempotency
   */
  async storeUserPreference(
    userId: string,
    vector: Float32Array,
    metadata: {
      confidence: number;
      genreAffinities?: Record<string, number>;
      temporalPatterns?: any;
    }
  ): Promise<number> {
    const sql = `
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
    `;

    const params = [
      userId,
      vectorToSQL(vector),
      metadata.confidence,
      JSON.stringify(metadata.genreAffinities || {}),
      JSON.stringify(metadata.temporalPatterns || {}),
    ];

    const result = await this.pool.query<{ id: number }>(sql, params);
    return result.rows[0]?.id ?? 0;
  }

  /**
   * Store content embedding with metadata
   */
  async storeContentVector(
    content: ContentVectorData,
    embedding: Float32Array
  ): Promise<number> {
    const sql = `
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
    `;

    const params = [
      content.contentId,
      content.mediaType,
      content.title,
      content.overview,
      vectorToSQL(embedding),
      content.genreIds,
      content.voteAverage,
      content.releaseDate,
      content.posterPath,
    ];

    const result = await this.pool.query<{ id: number }>(sql, params);
    return result.rows[0]?.id ?? 0;
  }

  /**
   * Batch insert content vectors for efficiency
   */
  async batchStoreContentVectors(
    items: Array<{ content: ContentVectorData; embedding: Float32Array }>
  ): Promise<number> {
    return await this.pool.transaction(async (client) => {
      let count = 0;

      // Process in chunks of 100
      const chunkSize = 100;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const values: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        for (const item of chunk) {
          values.push(`(
            $${paramIndex++}, $${paramIndex++},
            $${paramIndex++}, $${paramIndex++},
            $${paramIndex++}, $${paramIndex++},
            $${paramIndex++}, $${paramIndex++},
            $${paramIndex++}
          )`);

          params.push(
            item.content.contentId,
            item.content.mediaType,
            item.content.title,
            item.content.overview,
            vectorToSQL(item.embedding),
            item.content.genreIds,
            item.content.voteAverage,
            item.content.releaseDate,
            item.content.posterPath
          );
        }

        const sql = `
          INSERT INTO content_vectors (
            content_id, media_type, title, overview,
            vector, genre_ids, vote_average,
            release_date, poster_path
          ) VALUES ${values.join(', ')}
          ON CONFLICT (content_id, media_type) DO NOTHING
        `;

        const result = await client.query(sql, params);
        count += result.rowCount || 0;
      }

      return count;
    });
  }

  /**
   * k-NN vector similarity search with HNSW index
   * Supports hybrid filtering (vector + metadata)
   */
  async searchVectorsSimilar(
    queryVector: Float32Array,
    k: number,
    threshold?: number,
    filters?: {
      mediaType?: 'movie' | 'tv';
      genreIds?: number[];
      minRating?: number;
      releaseDateRange?: { start: Date; end: Date };
    }
  ): Promise<VectorSearchResult[]> {
    const whereClauses: string[] = [];
    const params: any[] = [vectorToSQL(queryVector), k];
    let paramIndex = 3;

    if (filters?.mediaType) {
      whereClauses.push(`media_type = $${paramIndex}`);
      params.push(filters.mediaType);
      paramIndex++;
    }

    if (filters?.genreIds && filters.genreIds.length > 0) {
      whereClauses.push(`genre_ids && $${paramIndex}`);
      params.push(filters.genreIds);
      paramIndex++;
    }

    if (filters?.minRating !== undefined) {
      whereClauses.push(`vote_average >= $${paramIndex}`);
      params.push(filters.minRating);
      paramIndex++;
    }

    if (filters?.releaseDateRange) {
      whereClauses.push(`release_date >= $${paramIndex}`);
      params.push(filters.releaseDateRange.start.toISOString().split('T')[0]);
      paramIndex++;

      whereClauses.push(`release_date <= $${paramIndex}`);
      params.push(filters.releaseDateRange.end.toISOString().split('T')[0]);
      paramIndex++;
    }

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    // Use HNSW index for fast k-NN search
    // <=> is cosine distance operator (1 - cosine_similarity)
    const sql = `
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
    `;

    const result = await this.pool.query<VectorSearchResult>(sql, params);

    // Filter by threshold if specified
    if (threshold !== undefined) {
      return result.rows.filter(row => row.similarity >= threshold);
    }

    return result.rows.map(row => ({
      ...row,
      metadata: {
        genreIds: row.genre_ids,
        voteAverage: row.vote_average,
        releaseDate: row.release_date,
        posterPath: row.poster_path,
      },
    }));
  }

  /**
   * Create HNSW index for fast approximate nearest neighbor search
   */
  async createHNSWIndex(
    tableName: string,
    vectorColumn: string,
    options: { m?: number; efConstruction?: number } = {}
  ): Promise<void> {
    const m = options.m || 16;
    const efConstruction = options.efConstruction || 64;
    const indexName = `idx_${tableName}_${vectorColumn}_hnsw`;

    const sql = `
      CREATE INDEX IF NOT EXISTS ${indexName}
      ON ${tableName}
      USING hnsw (${vectorColumn} vector_cosine_ops)
      WITH (m = ${m}, ef_construction = ${efConstruction})
    `;

    console.log(`Creating HNSW index ${indexName}...`);
    const startTime = Date.now();

    await this.pool.query(sql);

    const duration = Date.now() - startTime;
    console.log(`✅ HNSW index created in ${duration}ms`);
  }
}

// =========================================================================
// AgentDB PostgreSQL Adapter
// =========================================================================

export class AgentDBPostgreSQLAdapter {
  private initialized: boolean = false;

  constructor(
    private pool: PostgreSQLConnectionPool,
    private embedder?: any
  ) {}

  /**
   * Create AgentDB tables in PostgreSQL
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.createTables();
    this.initialized = true;
    console.log('✅ AgentDB PostgreSQL adapter initialized');
  }

  /**
   * Create schema for AgentDB cognitive memory
   */
  private async createTables(): Promise<void> {
    // Create reasoning_patterns table
    await this.pool.query(`
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
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_reasoning_patterns_embedding_hnsw
      ON reasoning_patterns
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_reasoning_patterns_task_type
      ON reasoning_patterns(task_type)
    `);

    // Create reflexion_episodes table
    await this.pool.query(`
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
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_reflexion_episodes_session_task
      ON reflexion_episodes(session_id, task)
    `);

    // Create skill_library table
    await this.pool.query(`
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
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_skill_library_embedding_hnsw
      ON skill_library
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);
  }

  /**
   * Store reasoning pattern (ReasoningBank)
   */
  async storePattern(pattern: ReasoningPattern): Promise<number> {
    const sql = `
      INSERT INTO reasoning_patterns (
        task_type, approach, success_rate,
        tags, metadata, embedding
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const params = [
      pattern.taskType,
      pattern.approach,
      pattern.successRate,
      pattern.tags || [],
      JSON.stringify(pattern.metadata || {}),
      pattern.embedding ? vectorToSQL(pattern.embedding) : null,
    ];

    const result = await this.pool.query<{ id: number }>(sql, params);
    return result.rows[0]?.id ?? 0;
  }

  /**
   * Search patterns by semantic similarity
   */
  async searchPatterns(query: {
    embedding: Float32Array;
    k: number;
    threshold?: number;
    filters?: { taskType?: string };
  }): Promise<any[]> {
    const whereClauses: string[] = [];
    const params: any[] = [vectorToSQL(query.embedding)];
    let paramIndex = 2;

    if (query.filters?.taskType) {
      whereClauses.push(`task_type = $${paramIndex}`);
      params.push(query.filters.taskType);
      paramIndex++;
    }

    if (query.threshold !== undefined) {
      whereClauses.push(`1 - (embedding <=> $1) >= $${paramIndex}`);
      params.push(query.threshold);
      paramIndex++;
    }

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    params.push(query.k);

    const sql = `
      SELECT
        id, task_type, approach, success_rate,
        tags, metadata, embedding,
        1 - (embedding <=> $1) AS similarity
      FROM reasoning_patterns
      ${whereClause}
      ORDER BY embedding <=> $1
      LIMIT $${paramIndex}
    `;

    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  /**
   * Store reflexion episode (ReflexionMemory)
   */
  async storeEpisode(episode: ReflexionEpisode): Promise<number> {
    const sql = `
      INSERT INTO reflexion_episodes (
        session_id, task, reward, success,
        critique, input, output,
        latency_ms, tokens_used
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;

    const params = [
      episode.sessionId,
      episode.task,
      episode.reward,
      episode.success,
      episode.critique,
      episode.input,
      episode.output,
      episode.latencyMs,
      episode.tokensUsed,
    ];

    const result = await this.pool.query<{ id: number }>(sql, params);
    return result.rows[0]?.id ?? 0;
  }

  /**
   * Retrieve relevant episodes for learning
   */
  async retrieveRelevantEpisodes(options: {
    sessionId: string;
    task?: string;
    k: number;
    onlySuccesses?: boolean;
  }): Promise<ReflexionEpisode[]> {
    const whereClauses = ['session_id = $1'];
    const params: any[] = [options.sessionId];
    let paramIndex = 2;

    if (options.task) {
      whereClauses.push(`task LIKE $${paramIndex}`);
      params.push(`%${options.task}%`);
      paramIndex++;
    }

    if (options.onlySuccesses) {
      whereClauses.push('success = true');
    }

    params.push(options.k);

    const sql = `
      SELECT *
      FROM reflexion_episodes
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex}
    `;

    const result = await this.pool.query<ReflexionEpisode>(sql, params);
    return result.rows;
  }

  /**
   * Create skill in library
   */
  async createSkill(skill: SkillDefinition): Promise<number> {
    const sql = `
      INSERT INTO skill_library (
        name, description, signature, code,
        success_rate, embedding
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    // Generate embedding for skill if embedder is available
    let embedding: Float32Array | null = null;
    if (this.embedder) {
      const text = `${skill.name}: ${skill.description}`;
      embedding = await this.embedder.generateEmbedding(text);
    }

    const params = [
      skill.name,
      skill.description,
      JSON.stringify(skill.signature),
      skill.code,
      skill.successRate,
      embedding ? vectorToSQL(embedding) : null,
    ];

    const result = await this.pool.query<{ id: number }>(sql, params);
    return result.rows[0]?.id ?? 0;
  }

  /**
   * Search skills by semantic similarity
   */
  async searchSkills(query: {
    task: string;
    k: number;
    minSuccessRate?: number;
  }): Promise<any[]> {
    if (!this.embedder) {
      throw new Error('Embedder not configured for skill search');
    }

    const queryEmbedding = await this.embedder.generateEmbedding(query.task);

    const sql = `
      SELECT
        id, name, description, signature, code,
        success_rate, uses, avg_reward, avg_latency_ms,
        1 - (embedding <=> $1) AS similarity
      FROM skill_library
      WHERE success_rate >= $2
      ORDER BY embedding <=> $1
      LIMIT $3
    `;

    const params = [
      vectorToSQL(queryEmbedding),
      query.minSuccessRate || 0.0,
      query.k,
    ];

    const result = await this.pool.query(sql, params);
    return result.rows;
  }
}

// =========================================================================
// Factory Functions
// =========================================================================

/**
 * Create and initialize PostgreSQL adapter
 */
export async function createPostgreSQLAdapter(
  config: PostgreSQLConfig
): Promise<{
  pool: PostgreSQLConnectionPool;
  vectorStorage: VectorStorage;
  agentdbAdapter: AgentDBPostgreSQLAdapter;
}> {
  const pool = new PostgreSQLConnectionPool(config);
  await pool.initialize();

  const vectorStorage = new VectorStorage(pool);
  const agentdbAdapter = new AgentDBPostgreSQLAdapter(pool);
  await agentdbAdapter.initialize();

  return {
    pool,
    vectorStorage,
    agentdbAdapter,
  };
}

/**
 * Create PostgreSQL adapter with environment variables
 */
export async function createPostgreSQLAdapterFromEnv(): Promise<{
  pool: PostgreSQLConnectionPool;
  vectorStorage: VectorStorage;
  agentdbAdapter: AgentDBPostgreSQLAdapter;
}> {
  const config: PostgreSQLConfig = {
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432'),
    database: process.env['DB_NAME'] || 'mediagateway',
    user: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || '',
    ssl: process.env['DB_SSL'] === 'true' ? { rejectUnauthorized: false } : false,
    minConnections: parseInt(process.env['DB_POOL_MIN'] || '2'),
    maxConnections: parseInt(process.env['DB_POOL_MAX'] || '10'),
    connectionTimeout: parseInt(process.env['DB_CONNECTION_TIMEOUT'] || '30000'),
    queryTimeout: parseInt(process.env['DB_QUERY_TIMEOUT'] || '10000'),
  };

  return createPostgreSQLAdapter(config);
}

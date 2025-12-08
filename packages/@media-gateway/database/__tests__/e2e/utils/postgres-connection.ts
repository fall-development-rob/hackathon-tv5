import pg from "pg";

const { Pool } = pg;

/**
 * PostgreSQL connection configuration for E2E tests
 */
export interface PostgresConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * Get PostgreSQL configuration from environment variables with fallback defaults
 */
export function getPostgresConfig(): PostgresConfig {
  return {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    user: process.env.POSTGRES_USER || "mediagateway",
    password: process.env.POSTGRES_PASSWORD || "changeme123",
    database: process.env.POSTGRES_DB || "media_gateway",
  };
}

/**
 * Create a PostgreSQL connection pool for testing
 *
 * @returns pg.Pool connected to the test database
 * @throws Error if connection fails
 */
export function getTestConnection(): pg.Pool {
  const config = getPostgresConfig();

  try {
    const pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      max: 10, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 5000, // Fail fast if connection takes > 5 seconds
    });

    // Handle pool errors
    pool.on("error", (err: Error) => {
      console.error("Unexpected error on idle PostgreSQL client", err);
    });

    return pool;
  } catch (error) {
    const err = error as Error;
    throw new Error(
      `Failed to create PostgreSQL connection pool: ${err.message}\n` +
        `Config: ${config.host}:${config.port}/${config.database}`,
    );
  }
}

/**
 * Properly close a PostgreSQL connection pool
 *
 * @param pool - The pg.Pool to close
 */
export async function closeConnection(pool: pg.Pool): Promise<void> {
  try {
    await pool.end();
  } catch (error) {
    const err = error as Error;
    console.error("Error closing PostgreSQL connection pool:", err.message);
    throw error;
  }
}

/**
 * Test database connection and return connection info
 *
 * @param pool - The pg.Pool to test
 * @returns Connection status and version info
 * @throws Error if connection test fails
 */
export async function testConnection(pool: pg.Pool): Promise<{
  connected: boolean;
  version: string;
  database: string;
}> {
  try {
    const result = await pool.query(
      "SELECT version() as version, current_database() as database",
    );

    return {
      connected: true,
      version: result.rows[0].version,
      database: result.rows[0].database,
    };
  } catch (error) {
    const err = error as Error;
    throw new Error(`Connection test failed: ${err.message}`);
  }
}

/**
 * Setup test schema with ruvector extension and test tables
 *
 * @param pool - The pg.Pool to use for setup
 * @throws Error if schema setup fails
 */
export async function setupTestSchema(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();

  try {
    // Start transaction
    await client.query("BEGIN");

    // Create ruvector extension if not exists
    await client.query("CREATE EXTENSION IF NOT EXISTS ruvector");

    // Create test table for vector operations using ruvector type
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_vectors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        embedding ruvector(768),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create HNSW index for vector similarity search
    await client.query(`
      CREATE INDEX IF NOT EXISTS test_vectors_embedding_idx
      ON test_vectors
      USING hnsw (embedding)
    `);

    // Create test table for general testing
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_data (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Commit transaction
    await client.query("COMMIT");
  } catch (error) {
    // Rollback on error
    await client.query("ROLLBACK");
    const err = error as Error;
    throw new Error(`Failed to setup test schema: ${err.message}`);
  } finally {
    client.release();
  }
}

/**
 * Clean up test data by truncating test tables
 *
 * @param pool - The pg.Pool to use for cleanup
 * @throws Error if cleanup fails
 */
export async function cleanupTestData(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();

  try {
    // Truncate test tables and reset sequences
    await client.query(`
      TRUNCATE TABLE test_vectors, test_data
      RESTART IDENTITY CASCADE
    `);
  } catch (error) {
    const err = error as Error;
    throw new Error(`Failed to cleanup test data: ${err.message}`);
  } finally {
    client.release();
  }
}

/**
 * Drop test schema and tables (for teardown)
 *
 * @param pool - The pg.Pool to use for teardown
 * @throws Error if teardown fails
 */
export async function teardownTestSchema(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();

  try {
    // Start transaction
    await client.query("BEGIN");

    // Drop test tables
    await client.query("DROP TABLE IF EXISTS test_vectors CASCADE");
    await client.query("DROP TABLE IF EXISTS test_data CASCADE");

    // Note: We don't drop the ruvector extension as it might be used by other tests

    // Commit transaction
    await client.query("COMMIT");
  } catch (error) {
    // Rollback on error
    await client.query("ROLLBACK");
    const err = error as Error;
    throw new Error(`Failed to teardown test schema: ${err.message}`);
  } finally {
    client.release();
  }
}

/**
 * Wait for PostgreSQL to be ready (useful for CI/CD environments)
 *
 * @param maxAttempts - Maximum number of connection attempts
 * @param delayMs - Delay between attempts in milliseconds
 * @returns The connected pool
 * @throws Error if connection fails after max attempts
 */
export async function waitForPostgres(
  maxAttempts: number = 10,
  delayMs: number = 1000,
): Promise<pg.Pool> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const pool = getTestConnection();
      const result = await pool.query("SELECT 1");

      if (result.rows.length === 1) {
        console.log(`PostgreSQL ready after ${attempt} attempt(s)`);
        return pool;
      }
    } catch (error) {
      lastError = error as Error;
      console.log(
        `PostgreSQL not ready (attempt ${attempt}/${maxAttempts}): ${lastError.message}`,
      );

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error(
    `PostgreSQL not ready after ${maxAttempts} attempts. Last error: ${lastError?.message}`,
  );
}

/**
 * Test script for PostgreSQL/RuVector integration
 * Run with: npx tsx scripts/test-postgres.ts
 */

import { PostgreSQLConnectionPool, VectorStorage, createPostgreSQLAdapter, vectorToSQL } from '@media-gateway/database/postgres';

// Test configuration matching docker-compose.yml
const config = {
  host: process.env['POSTGRES_HOST'] || 'localhost',
  port: parseInt(process.env['POSTGRES_PORT'] || '5432', 10),
  database: process.env['POSTGRES_DB'] || 'media_gateway',
  user: process.env['POSTGRES_USER'] || 'mediagateway',
  password: process.env['POSTGRES_PASSWORD'] || 'mediagateway_secure_password',
  ssl: false,
  minConnections: 2,
  maxConnections: 10,
};

async function testConnection(): Promise<boolean> {
  console.log('Testing PostgreSQL connection...');
  console.log(`Host: ${config.host}:${config.port}`);
  console.log(`Database: ${config.database}`);

  const pool = new PostgreSQLConnectionPool(config);

  try {
    await pool.connect();
    console.log('✅ Connection successful!');

    // Test basic query
    const result = await pool.query('SELECT version()');
    console.log('PostgreSQL version:', result.rows[0]?.version?.split(' ').slice(0, 2).join(' '));

    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error instanceof Error ? error.message : error);
    return false;
  } finally {
    await pool.disconnect();
  }
}

async function testVectorExtension(): Promise<boolean> {
  console.log('\nTesting pgvector extension...');

  const pool = new PostgreSQLConnectionPool(config);

  try {
    await pool.connect();

    // Check if vector extension is installed
    const result = await pool.query(`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname LIKE '%vector%'
    `);

    if (result.rows.length === 0) {
      console.warn('⚠️ No vector extensions found. Installing...');
      await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
      console.log('✅ Vector extension installed');
    } else {
      for (const row of result.rows) {
        console.log(`✅ Extension: ${row.extname} v${row.extversion}`);
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Vector extension test failed:', error instanceof Error ? error.message : error);
    return false;
  } finally {
    await pool.disconnect();
  }
}

async function testVectorOperations(): Promise<boolean> {
  console.log('\nTesting vector operations...');

  const pool = new PostgreSQLConnectionPool(config);
  const storage = new VectorStorage(pool, 768);

  try {
    await pool.connect();
    await storage.initialize();
    console.log('✅ VectorStorage initialized');

    // Create a test vector
    const testVector = new Float32Array(768).fill(0.1);
    testVector[0] = 0.5;
    testVector[1] = 0.3;

    // Store vector
    const id = await storage.insertVector(testVector, {
      contentId: 1,
      mediaType: 'movie',
      title: 'Test Movie',
      overview: 'A test movie for vector operations',
    });
    console.log(`✅ Stored vector with ID: ${id}`);

    // Search for similar vectors
    const results = await storage.searchSimilar(testVector, 5, 0.0);
    console.log(`✅ Found ${results.length} similar vectors`);

    if (results.length > 0) {
      console.log(`  - Top result: ${results[0]?.title} (similarity: ${results[0]?.similarity.toFixed(4)})`);
    }

    // Cleanup test data
    await pool.query('DELETE FROM content_vectors WHERE metadata->>\'title\' = $1', ['Test Movie']);
    console.log('✅ Cleaned up test data');

    return true;
  } catch (error) {
    console.error('❌ Vector operations failed:', error instanceof Error ? error.message : error);
    return false;
  } finally {
    await pool.disconnect();
  }
}

async function testSchema(): Promise<boolean> {
  console.log('\nTesting database schema...');

  const pool = new PostgreSQLConnectionPool(config);

  try {
    await pool.connect();

    // Check for required tables
    const tables = ['user_preferences', 'content_vectors', 'reasoning_patterns', 'reflexion_episodes', 'skill_library'];

    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        )
      `, [table]);

      const exists = result.rows[0]?.exists;
      if (exists) {
        console.log(`✅ Table: ${table}`);
      } else {
        console.log(`⚠️ Table missing: ${table}`);
      }
    }

    // Check HNSW indexes
    const indexResult = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE indexdef LIKE '%hnsw%'
    `);

    console.log(`\nHNSW Indexes: ${indexResult.rows.length}`);
    for (const row of indexResult.rows) {
      console.log(`  - ${row.indexname}`);
    }

    return true;
  } catch (error) {
    console.error('❌ Schema test failed:', error instanceof Error ? error.message : error);
    return false;
  } finally {
    await pool.disconnect();
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('RuVector PostgreSQL Integration Test');
  console.log('='.repeat(60));

  const results = {
    connection: false,
    extension: false,
    schema: false,
    operations: false,
  };

  // Test connection
  results.connection = await testConnection();
  if (!results.connection) {
    console.log('\n❌ Cannot proceed without database connection');
    console.log('\nMake sure Docker is running:');
    console.log('  docker compose up -d ruvector-postgres');
    process.exit(1);
  }

  // Test vector extension
  results.extension = await testVectorExtension();

  // Test schema
  results.schema = await testSchema();

  // Test vector operations
  results.operations = await testVectorOperations();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Connection:  ${results.connection ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Extension:   ${results.extension ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Schema:      ${results.schema ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Operations:  ${results.operations ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = Object.values(results).every(r => r);
  console.log(`\nOverall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);

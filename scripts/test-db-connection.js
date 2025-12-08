#!/usr/bin/env node

/**
 * Database Connection Test Script
 * Tests connection to RuVector PostgreSQL and verifies vector capabilities
 */

const { Pool } = require('pg');
require('dotenv').config();

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`),
};

// Database configuration
const config = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'media_gateway',
  user: process.env.POSTGRES_USER || 'mediagateway',
  password: process.env.POSTGRES_PASSWORD || 'changeme123',
};

const pool = new Pool(config);

async function testConnection() {
  log.header('Testing Database Connection');

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT version()');
    log.success(`Connected to PostgreSQL`);
    log.info(`Version: ${result.rows[0].version.split(',')[0]}`);
    client.release();
    return true;
  } catch (error) {
    log.error(`Connection failed: ${error.message}`);
    return false;
  }
}

async function testExtensions() {
  log.header('Checking Extensions');

  try {
    const result = await pool.query(`
      SELECT extname, extversion
      FROM pg_extension
      WHERE extname IN ('vector', 'uuid-ossp', 'pg_trgm', 'btree_gist')
      ORDER BY extname
    `);

    const expectedExtensions = ['vector', 'uuid-ossp', 'pg_trgm', 'btree_gist'];
    const installedExtensions = result.rows.map(row => row.extname);

    for (const ext of expectedExtensions) {
      const installed = installedExtensions.includes(ext);
      if (installed) {
        const version = result.rows.find(row => row.extname === ext).extversion;
        log.success(`${ext} extension installed (v${version})`);
      } else {
        log.error(`${ext} extension not installed`);
      }
    }

    return installedExtensions.length === expectedExtensions.length;
  } catch (error) {
    log.error(`Extension check failed: ${error.message}`);
    return false;
  }
}

async function testSchemas() {
  log.header('Checking Schemas');

  try {
    const result = await pool.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name IN ('media_gateway', 'vectors', 'agents', 'analytics')
      ORDER BY schema_name
    `);

    const expectedSchemas = ['agents', 'analytics', 'media_gateway', 'vectors'];
    const installedSchemas = result.rows.map(row => row.schema_name);

    for (const schema of expectedSchemas) {
      if (installedSchemas.includes(schema)) {
        log.success(`${schema} schema exists`);
      } else {
        log.error(`${schema} schema not found`);
      }
    }

    return installedSchemas.length === expectedSchemas.length;
  } catch (error) {
    log.error(`Schema check failed: ${error.message}`);
    return false;
  }
}

async function testTables() {
  log.header('Checking Tables');

  try {
    const result = await pool.query(`
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname IN ('media_gateway', 'vectors', 'agents', 'analytics')
      ORDER BY schemaname, tablename
    `);

    if (result.rows.length === 0) {
      log.warning('No tables found - database may need initialization');
      return false;
    }

    const tablesBySchema = {};
    for (const row of result.rows) {
      if (!tablesBySchema[row.schemaname]) {
        tablesBySchema[row.schemaname] = [];
      }
      tablesBySchema[row.schemaname].push(row.tablename);
    }

    for (const [schema, tables] of Object.entries(tablesBySchema)) {
      log.success(`${schema}: ${tables.join(', ')}`);
    }

    return true;
  } catch (error) {
    log.error(`Table check failed: ${error.message}`);
    return false;
  }
}

async function testVectorOperations() {
  log.header('Testing Vector Operations');

  try {
    // Test vector creation
    await pool.query('SELECT array[1,2,3,4,5]::vector(5)');
    log.success('Vector creation works');

    // Test cosine similarity
    const result = await pool.query(`
      SELECT vectors.cosine_similarity(
        array[1,2,3,4,5]::vector(5),
        array[1,2,3,4,5]::vector(5)
      ) as similarity
    `);

    const similarity = parseFloat(result.rows[0].similarity);
    if (Math.abs(similarity - 1.0) < 0.001) {
      log.success(`Cosine similarity function works (result: ${similarity.toFixed(4)})`);
    } else {
      log.warning(`Cosine similarity unexpected result: ${similarity}`);
    }

    // Test euclidean distance
    const distResult = await pool.query(`
      SELECT vectors.euclidean_distance(
        array[0,0,0]::vector(3),
        array[1,1,1]::vector(3)
      ) as distance
    `);

    const distance = parseFloat(distResult.rows[0].distance);
    log.success(`Euclidean distance function works (result: ${distance.toFixed(4)})`);

    return true;
  } catch (error) {
    log.error(`Vector operations failed: ${error.message}`);
    return false;
  }
}

async function testPerformance() {
  log.header('Performance Test');

  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const duration = Date.now() - start;

    if (duration < 10) {
      log.success(`Query latency: ${duration}ms (excellent)`);
    } else if (duration < 50) {
      log.success(`Query latency: ${duration}ms (good)`);
    } else {
      log.warning(`Query latency: ${duration}ms (slow - check network/configuration)`);
    }

    return true;
  } catch (error) {
    log.error(`Performance test failed: ${error.message}`);
    return false;
  }
}

async function displayStats() {
  log.header('Database Statistics');

  try {
    // Database size
    const sizeResult = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    log.info(`Database size: ${sizeResult.rows[0].size}`);

    // Connection count
    const connResult = await pool.query(`
      SELECT count(*) as connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);
    log.info(`Active connections: ${connResult.rows[0].connections}`);

    // Table count
    const tableResult = await pool.query(`
      SELECT count(*) as tables
      FROM pg_tables
      WHERE schemaname IN ('media_gateway', 'vectors', 'agents', 'analytics')
    `);
    log.info(`Total tables: ${tableResult.rows[0].tables}`);

    return true;
  } catch (error) {
    log.error(`Stats retrieval failed: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}   RuVector PostgreSQL Connection Test${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);

  log.info(`Host: ${config.host}:${config.port}`);
  log.info(`Database: ${config.database}`);
  log.info(`User: ${config.user}`);

  const tests = [
    { name: 'Connection', fn: testConnection },
    { name: 'Extensions', fn: testExtensions },
    { name: 'Schemas', fn: testSchemas },
    { name: 'Tables', fn: testTables },
    { name: 'Vector Operations', fn: testVectorOperations },
    { name: 'Performance', fn: testPerformance },
    { name: 'Statistics', fn: displayStats },
  ];

  const results = [];

  for (const test of tests) {
    try {
      const passed = await test.fn();
      results.push({ name: test.name, passed });
    } catch (error) {
      log.error(`${test.name} test crashed: ${error.message}`);
      results.push({ name: test.name, passed: false });
    }
  }

  log.header('Test Summary');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  for (const result of results) {
    if (result.passed) {
      log.success(result.name);
    } else {
      log.error(result.name);
    }
  }

  console.log('');
  if (passed === total) {
    log.success(`All tests passed (${passed}/${total})`);
  } else {
    log.warning(`Some tests failed (${passed}/${total})`);
  }

  await pool.end();

  process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests().catch((error) => {
  log.error(`Fatal error: ${error.message}`);
  process.exit(1);
});

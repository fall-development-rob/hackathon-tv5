# RuVector/Postgres Integration - Quick Reference Card

**Date:** 2025-12-08
**Status:** Ready for Implementation

---

## TL;DR

Replace **in-memory JavaScript vector database** with **PostgreSQL + RuVector** for:
- 150x faster queries
- Unlimited scalability (10M+ vectors)
- Self-learning capabilities
- Production-grade reliability

**Effort:** 6 weeks | **Cost:** $0-200/month | **Risk:** Low (feature flags)

---

## What Changes

| Component | Current | After | Status |
|-----------|---------|-------|--------|
| **AgentDB** | SQLite cognitive memory | SQLite cognitive memory | ✅ NO CHANGE |
| **RuVector** | In-memory JavaScript | PostgreSQL-backed | 🔄 REPLACE |
| **Embeddings** | OpenAI/Vertex AI | OpenAI/Vertex AI | ✅ NO CHANGE |
| **Tests** | In-memory mocks | PostgreSQL containers | 🔄 UPDATE |
| **Docker** | Not used | ruvector/postgres:latest | ✨ NEW |

---

## 7 Files to Modify

1. `packages/@media-gateway/database/src/ruvector/index.ts` - Rewrite for SQL
2. `packages/@media-gateway/database/package.json` - Add `pg` dependency
3. `packages/@media-gateway/database/__tests__/ruvector/*.test.ts` - Update tests
4. `packages/@media-gateway/database/__tests__/integration/database.test.ts` - Update
5. `packages/@media-gateway/core/src/services/AgentDBVectorService.ts` - Update
6. `packages/@media-gateway/agents/src/learning/ContentEmbeddings.ts` - Update
7. `docker-compose.yml` - Add PostgreSQL service

---

## Quick Start Commands

### 1. Start PostgreSQL

```bash
# docker-compose.yml
docker-compose up -d ruvector-postgres

# Or standalone
docker run -d \
  -e POSTGRES_PASSWORD=changeme \
  -p 5432:5432 \
  -v $(pwd)/data/postgres:/var/lib/postgresql/data \
  ruvector/postgres:latest
```

### 2. Install Dependencies

```bash
cd packages/@media-gateway/database
pnpm add pg@^8.11.0
pnpm add -D @types/pg testcontainers
```

### 3. Create Schema

```sql
-- packages/@media-gateway/database/migrations/001_initial_schema.sql

CREATE TABLE content_vectors (
  id TEXT PRIMARY KEY,
  vector vector(768) NOT NULL,
  metadata JSONB NOT NULL
);

CREATE INDEX content_vectors_hnsw_idx
  ON content_vectors
  USING hnsw (vector vector_cosine_ops);
```

### 4. Update Code

```typescript
// Before (In-Memory)
import { VectorDB } from 'ruvector';
const db = new VectorDB({ dimensions: 768 });

// After (PostgreSQL)
import { Pool } from 'pg';
const pool = new Pool({
  host: 'localhost',
  database: 'media_vectors',
  user: 'media_gateway',
  password: process.env.POSTGRES_PASSWORD
});
```

### 5. Run Tests

```bash
docker-compose up -d  # Start PostgreSQL
pnpm test             # All tests should pass
```

---

## SQL Cheat Sheet

### Insert Vector

```sql
INSERT INTO content_vectors (id, vector, metadata)
VALUES ($1, $2::vector, $3::jsonb);
```

### Search Similar (Top K)

```sql
SELECT
  id,
  metadata,
  1 - (vector <=> $1::vector) as similarity
FROM content_vectors
ORDER BY vector <=> $1
LIMIT 10;
```

### Filtered Search

```sql
SELECT * FROM content_vectors
WHERE
  metadata->>'media_type' = 'movie'
  AND 1 - (vector <=> $1::vector) > 0.5
ORDER BY vector <=> $1
LIMIT 20;
```

### Create HNSW Index

```sql
CREATE INDEX content_vectors_hnsw_idx
  ON content_vectors
  USING hnsw (vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### Get Statistics

```sql
SELECT
  COUNT(*) as vector_count,
  pg_size_pretty(pg_table_size('content_vectors')) as table_size,
  pg_size_pretty(pg_indexes_size('content_vectors')) as index_size
FROM content_vectors;
```

---

## Environment Variables

```env
# .env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=media_vectors
POSTGRES_USER=media_gateway
POSTGRES_PASSWORD=your-secure-password

# Backend selection (for gradual rollout)
RUVECTOR_BACKEND=postgres  # 'memory' or 'postgres'

# Connection pool
POSTGRES_POOL_MIN=2
POSTGRES_POOL_MAX=20
```

---

## Connection Pool Setup

```typescript
// packages/@media-gateway/database/src/ruvector/postgres-pool.ts

import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'media_vectors',
  user: process.env.POSTGRES_USER || 'media_gateway',
  password: process.env.POSTGRES_PASSWORD,
  min: 2,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
```

---

## Feature Flag Pattern

```typescript
// Abstraction for gradual rollout

class RuVectorWrapper {
  private backend: 'memory' | 'postgres';

  constructor(config?: { backend?: 'memory' | 'postgres' }) {
    this.backend = config?.backend ||
                   process.env.RUVECTOR_BACKEND as any ||
                   'memory';
  }

  async searchByEmbedding(query, k, threshold) {
    if (this.backend === 'postgres') {
      return this.searchPostgres(query, k, threshold);
    } else {
      return this.searchMemory(query, k, threshold);
    }
  }
}

// Usage
const ruVector = new RuVectorWrapper({ backend: 'postgres' });
```

---

## Migration Script (Pseudo-code)

```typescript
// scripts/migrate-to-postgres.ts

async function migrate() {
  // 1. Export from memory
  const vectors = await memoryDB.exportAll();
  console.log(`Exporting ${vectors.length} vectors`);

  // 2. Import to PostgreSQL
  await pool.query('BEGIN');
  try {
    for (const batch of chunk(vectors, 1000)) {
      await pool.query(
        `INSERT INTO content_vectors (id, vector, metadata)
         VALUES ${batch.map((_, i) => `($${i*3+1}, $${i*3+2}, $${i*3+3})`).join(', ')}`,
        batch.flatMap(v => [v.id, v.vector, v.metadata])
      );
    }
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }

  // 3. Validate
  const { rows } = await pool.query('SELECT COUNT(*) FROM content_vectors');
  assert(rows[0].count === vectors.length, 'Count mismatch!');

  console.log('Migration successful ✅');
}
```

---

## Performance Benchmarks

```typescript
// __tests__/benchmarks/vector-search.bench.ts

import { describe, it, expect } from 'vitest';

describe('Vector Search Performance', () => {
  it('should search 100K vectors in <1ms', async () => {
    const query = createRandomVector(768);
    const start = performance.now();

    const results = await ruVector.searchByEmbedding(query, 10, 0.5);

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1); // <1ms
    expect(results).toHaveLength(10);
  });

  it('should handle 1M vectors in <5ms', async () => {
    // ... similar test for 1M vectors
  });
});
```

---

## Monitoring Queries

### Active Connections

```sql
SELECT
  datname,
  count(*) as connections,
  sum(case when state = 'active' then 1 else 0 end) as active
FROM pg_stat_activity
WHERE datname = 'media_vectors'
GROUP BY datname;
```

### Slow Queries

```sql
SELECT
  query,
  calls,
  total_exec_time / 1000 as total_seconds,
  mean_exec_time as avg_ms,
  max_exec_time as max_ms
FROM pg_stat_statements
WHERE query LIKE '%content_vectors%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Table Size

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename = 'content_vectors';
```

### Index Usage

```sql
SELECT
  indexrelname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexrelname LIKE '%content_vectors%';
```

---

## Rollback Plan

### Step 1: Stop New PostgreSQL Connections

```bash
export RUVECTOR_BACKEND=memory
# Restart application
```

### Step 2: Restore from Backup

```bash
pg_restore -d media_vectors \
  -c \
  backup-$(date -d yesterday +%Y%m%d).dump
```

### Step 3: Verify

```bash
npm run test:integration
# All tests should pass
```

---

## Common Issues & Solutions

### Issue: Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Start if needed
docker-compose up -d ruvector-postgres

# Check logs
docker logs media-gateway-vectors
```

### Issue: Password Authentication Failed

```
Error: password authentication failed for user "media_gateway"
```

**Solution:**
```bash
# Check .env file
cat .env | grep POSTGRES

# Recreate container with correct password
docker-compose down -v
docker-compose up -d
```

### Issue: Vector Extension Not Found

```
Error: type "vector" does not exist
```

**Solution:**
```sql
-- Connect to database
psql -U media_gateway -d media_vectors

-- Verify RuVector extension
\dx

-- Should show:
-- vector | 0.5.0 | public | vector data type and functions
```

### Issue: Slow Queries

```
SELECT taking >100ms
```

**Solution:**
```sql
-- Check if HNSW index exists
SELECT indexname FROM pg_indexes
WHERE tablename = 'content_vectors';

-- Rebuild if needed
REINDEX INDEX content_vectors_hnsw_idx;

-- Tune HNSW parameters
ALTER INDEX content_vectors_hnsw_idx
SET (ef_search = 40);
```

---

## Testing Checklist

Before deploying to production:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Performance benchmarks meet targets (<1ms search)
- [ ] Migration script tested with sample data
- [ ] Rollback script tested
- [ ] Monitoring dashboards configured
- [ ] Alert rules set up
- [ ] Documentation updated
- [ ] Team trained on new system
- [ ] Backup/restore procedures tested

---

## Useful Links

- **Full Analysis:** [ruvector-postgres-integration-analysis.md](./ruvector-postgres-integration-analysis.md)
- **Architecture:** [ARCHITECTURE_DIAGRAM.md](./ARCHITECTURE_DIAGRAM.md)
- **Executive Summary:** [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md)
- **RuVector GitHub:** https://github.com/ruvnet/ruvector
- **Docker Image:** https://hub.docker.com/r/ruvector/postgres
- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **pgvector Extension:** https://github.com/pgvector/pgvector

---

## Support Contacts

- **Database Issues:** [Create GitHub issue](https://github.com/ruvnet/ruvector/issues)
- **PostgreSQL:** #postgresql on team Slack
- **Docker:** #devops on team Slack

---

**Quick Reference Version:** 1.0
**Last Updated:** 2025-12-08
**Status:** Ready for Implementation

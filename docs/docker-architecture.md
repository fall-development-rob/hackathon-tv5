# Docker Compose Architecture - Media Gateway with RuVector PostgreSQL

## Overview

This document describes the Docker Compose architecture for the Media Gateway project, integrating **ruvector/postgres:latest** as the primary vector database for semantic search, embeddings storage, and multi-agent AI coordination.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Media Gateway Stack                          │
│                                                                 │
│  ┌─────────────────┐      ┌──────────────────┐                │
│  │  Media API      │◄────►│  ruvector-postgres│                │
│  │  (Node.js)      │      │  (PostgreSQL +    │                │
│  │                 │      │   pgvector)       │                │
│  └────────┬────────┘      └────────┬─────────┘                │
│           │                        │                            │
│           │                        ▼                            │
│           │               ┌─────────────────┐                  │
│           │               │  Persistent     │                  │
│           │               │  Volumes        │                  │
│           │               │  - postgres_data│                  │
│           │               │  - vector_data  │                  │
│           │               └─────────────────┘                  │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                          │
│  │  Redis Cache    │ (Optional)                               │
│  │  (Rate limiting,│                                          │
│  │   sessions)     │                                          │
│  └─────────────────┘                                          │
│                                                                 │
│  ┌─────────────────┐                                          │
│  │  pgAdmin        │ (Optional - Admin UI)                    │
│  │  Web Interface  │                                          │
│  └─────────────────┘                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
           │
           ▼
    ┌──────────────┐
    │   Network    │
    │  172.28.0.0/16│
    └──────────────┘
```

## Components

### 1. RuVector PostgreSQL Service

**Image:** `ruvector/postgres:latest`

**Purpose:**
- Primary data storage for media content, user data, and metadata
- Vector embeddings storage using pgvector extension
- Semantic search capabilities
- Multi-agent state management

**Key Features:**
- PostgreSQL 15+ with pgvector extension
- HNSW indexing for fast similarity search
- Full-text search with pg_trgm
- UUID support for distributed systems
- Optimized for vector operations

**Configuration:**
- Port: 5432 (configurable)
- Vector Dimension: 768 (default, configurable)
- Memory: 2GB recommended minimum
- CPU: 2 cores recommended

**Environment Variables:**
- `POSTGRES_USER`: Database username
- `POSTGRES_PASSWORD`: Database password
- `POSTGRES_DB`: Database name (media_gateway)
- `VECTOR_DIMENSION`: Embedding vector dimension (768)
- Performance tuning variables (see .env.example)

**Volumes:**
- `postgres_data`: Main database storage
- `vector_data`: Optimized vector storage
- `./config/postgres/init`: Initialization SQL scripts
- `./config/postgres/postgresql.conf`: Custom configuration
- `./backups/postgres`: Database backups

**Health Check:**
- Command: `pg_isready`
- Interval: 10s
- Timeout: 5s
- Retries: 5

### 2. pgAdmin Service (Optional)

**Image:** `dpage/pgadmin4:latest`

**Purpose:**
- Web-based database administration
- Query execution and debugging
- Schema visualization
- Performance monitoring

**Access:**
- URL: http://localhost:5050
- Default credentials in .env.example

**Profile:** `admin` (start with `docker-compose --profile admin up`)

### 3. Redis Service (Optional)

**Image:** `redis:7-alpine`

**Purpose:**
- API response caching
- Session storage
- Rate limiting
- Temporary data storage

**Configuration:**
- Port: 6379
- Max Memory: 256MB (configurable)
- Eviction Policy: allkeys-lru
- Persistence: AOF enabled

**Profile:** `cache` (start with `docker-compose --profile cache up`)

### 4. Media API Service (Template)

**Status:** Commented out - ready for implementation

**Purpose:**
- RESTful API for media discovery
- Natural language search
- Agent coordination
- Integration with TMDB, Gemini, etc.

**Configuration:**
- Port: 3000
- Auto-connects to PostgreSQL
- Optional Redis integration

## Network Architecture

### Internal Network

**Name:** `media-gateway-network`

**Type:** Bridge network

**Subnet:** `172.28.0.0/16` (configurable)

**Purpose:**
- Isolates services from host network
- Enables service-to-service communication
- DNS resolution between containers

**Service Communication:**
- Services communicate using container names as hostnames
- Example: `postgresql://ruvector-postgres:5432/media_gateway`

## Data Persistence

### Volume Strategy

**Named Volumes:**
- Production-ready persistent storage
- Survives container recreation
- Can be backed up and migrated
- Independent lifecycle from containers

**Volume Definitions:**

1. **postgres_data**
   - PostgreSQL main data directory
   - Contains all tables, indices, and metadata
   - Critical for data persistence

2. **vector_data**
   - Optimized storage for vector indices
   - HNSW index data
   - Separate for performance optimization

3. **pgadmin_data**
   - pgAdmin configuration and settings
   - Saved queries and preferences

4. **redis_data**
   - Redis persistence (AOF/RDB)
   - Session and cache data

### Backup Strategy

**Location:** `./backups/postgres`

**Methods:**

1. **SQL Dump:**
   ```bash
   docker-compose exec ruvector-postgres pg_dump -U mediagateway media_gateway > backup.sql
   ```

2. **Custom Format:**
   ```bash
   docker-compose exec ruvector-postgres pg_dump -U mediagateway -Fc media_gateway > backup.dump
   ```

3. **Volume Backup:**
   ```bash
   docker run --rm -v media-gateway-postgres-data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/postgres-data.tar.gz /data
   ```

## Security Considerations

### Development

- Default credentials in .env.example
- No SSL/TLS enabled
- Open CORS policy
- Detailed logging enabled

### Production Recommendations

1. **Credentials:**
   - Use strong, randomly generated passwords
   - Store secrets in secret management system (Vault, AWS Secrets Manager)
   - Rotate credentials regularly

2. **Network:**
   - Remove port mappings for internal services
   - Use reverse proxy (nginx, traefik)
   - Enable SSL/TLS for PostgreSQL
   - Restrict CORS origins

3. **Access Control:**
   - Implement role-based access control (RBAC)
   - Use connection pooling (PgBouncer)
   - Enable PostgreSQL authentication methods
   - Firewall rules for database access

4. **Monitoring:**
   - Enable OpenTelemetry
   - Set up alerts for anomalies
   - Monitor resource usage
   - Track slow queries

## Performance Optimization

### PostgreSQL Tuning

**Memory Allocation:**
- `shared_buffers`: 25% of total RAM
- `effective_cache_size`: 50-75% of total RAM
- `work_mem`: Depends on concurrent connections
- `maintenance_work_mem`: For bulk operations

**Vector Operations:**
- HNSW index parameters (m, ef_construction)
- Parallel workers for large datasets
- Query optimization with EXPLAIN ANALYZE

**Monitoring:**
```sql
-- Check index usage
SELECT * FROM pg_stat_user_indexes;

-- Check table statistics
SELECT * FROM pg_stat_user_tables;

-- Check slow queries
SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
```

### Connection Pooling

**PgBouncer (recommended for production):**
```yaml
pgbouncer:
  image: pgbouncer/pgbouncer:latest
  environment:
    DATABASES_HOST: ruvector-postgres
    DATABASES_PORT: 5432
    DATABASES_DBNAME: media_gateway
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 1000
    DEFAULT_POOL_SIZE: 20
```

## Database Schema

### Core Schemas

1. **media_gateway**
   - Main application data
   - Content metadata
   - User information

2. **vectors**
   - Embedding storage
   - Similarity indices
   - Vector operations

3. **agents**
   - Agent session state
   - Knowledge base
   - Coordination data

4. **analytics**
   - Event tracking
   - Usage statistics
   - Performance metrics

### Key Tables

**media_gateway.content:**
- Media content metadata
- External ID references (TMDB, etc.)
- JSONB for flexible metadata

**vectors.content_embeddings:**
- Vector embeddings (768-dimensional)
- Model tracking
- HNSW index for similarity search

**agents.sessions:**
- Active agent sessions
- State management
- Expiration tracking

**agents.knowledge:**
- Agent memory/knowledge base
- Searchable with vector similarity
- JSONB for flexible schema

## Usage Examples

### Starting the Stack

**Basic (PostgreSQL only):**
```bash
docker-compose up -d
```

**With Admin Tools:**
```bash
docker-compose --profile admin up -d
```

**Full Stack (with Redis):**
```bash
docker-compose --profile admin --profile cache up -d
```

### Database Operations

**Connect to PostgreSQL:**
```bash
# From host
psql -h localhost -p 5432 -U mediagateway -d media_gateway

# From container
docker-compose exec ruvector-postgres psql -U mediagateway -d media_gateway
```

**Run SQL Script:**
```bash
docker-compose exec -T ruvector-postgres psql -U mediagateway -d media_gateway < script.sql
```

**Create Backup:**
```bash
docker-compose exec ruvector-postgres pg_dump -U mediagateway media_gateway > backup.sql
```

**Restore from Backup:**
```bash
docker-compose exec -T ruvector-postgres psql -U mediagateway -d media_gateway < backup.sql
```

### Monitoring

**Check Service Health:**
```bash
docker-compose ps
```

**View Logs:**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f ruvector-postgres

# Last 100 lines
docker-compose logs --tail=100 ruvector-postgres
```

**Resource Usage:**
```bash
docker stats
```

## Troubleshooting

### Common Issues

**1. Port Already in Use:**
```bash
# Change port in .env
POSTGRES_PORT=5433
```

**2. Connection Refused:**
```bash
# Check service is running
docker-compose ps

# Check health
docker-compose exec ruvector-postgres pg_isready
```

**3. Out of Memory:**
```bash
# Reduce memory limits in .env
POSTGRES_MEMORY_LIMIT=1G
POSTGRES_SHARED_BUFFERS=128MB
```

**4. Slow Queries:**
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT ...;

-- Check indices
\di

-- Rebuild indices
REINDEX TABLE table_name;
```

**5. Volume Permissions:**
```bash
# Fix ownership
docker-compose exec ruvector-postgres chown -R postgres:postgres /var/lib/postgresql/data
```

## Migration Path

### From SQLite to PostgreSQL

1. Export SQLite data
2. Transform schema for PostgreSQL
3. Import data using COPY or INSERT
4. Create vector embeddings
5. Build HNSW indices
6. Update application connection strings

### Scaling Considerations

**Vertical Scaling:**
- Increase CPU and memory allocations
- Optimize PostgreSQL configuration
- Use faster storage (SSD/NVMe)

**Horizontal Scaling:**
- Read replicas for queries
- Write-ahead log streaming
- Connection pooling
- Caching layer (Redis)

**Cloud Migration:**
- Google Cloud SQL for PostgreSQL
- AWS RDS with pgvector
- Azure Database for PostgreSQL
- Managed vector databases (Pinecone, Weaviate)

## References

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [pgvector GitHub](https://github.com/pgvector/pgvector)
- [RuVector Documentation](https://github.com/ruvnet/ruvector)
- [Docker Compose Specification](https://docs.docker.com/compose/compose-file/)
- [Media Gateway Project](../README.md)

## Support

For issues and questions:
- GitHub Issues: [hackathon-tv5](https://github.com/agenticsorg/hackathon-tv5/issues)
- Discord: [discord.agentics.org](https://discord.agentics.org)
- Documentation: [agentics.org/hackathon](https://agentics.org/hackathon)

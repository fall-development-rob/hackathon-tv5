# Docker Quick Start Guide - Media Gateway

This guide will help you quickly get the Media Gateway stack running with RuVector PostgreSQL.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum
- 10GB disk space

## Quick Start

### 1. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and update the following critical variables:
# - POSTGRES_PASSWORD (change from default!)
# - API keys for TMDB, Google Gemini, etc.
nano .env
```

### 2. Start the Database

```bash
# Start PostgreSQL with RuVector
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f ruvector-postgres
```

### 3. Verify Installation

```bash
# Check database is ready
docker-compose exec ruvector-postgres pg_isready

# Connect to database
docker-compose exec ruvector-postgres psql -U mediagateway -d media_gateway

# Inside psql, verify extensions:
\dx
# You should see: vector, uuid-ossp, pg_trgm, btree_gist

# List schemas:
\dn
# You should see: media_gateway, vectors, agents, analytics

# Exit psql
\q
```

### 4. (Optional) Start Admin Tools

```bash
# Start with pgAdmin
docker-compose --profile admin up -d

# Access pgAdmin at http://localhost:5050
# Login with credentials from .env:
# Email: admin@mediagateway.local
# Password: admin123
```

### 5. (Optional) Start with Redis Cache

```bash
# Start full stack with caching
docker-compose --profile admin --profile cache up -d
```

## Testing Vector Search

### Create Sample Data

```bash
# Connect to database
docker-compose exec ruvector-postgres psql -U mediagateway -d media_gateway
```

```sql
-- Insert sample content
INSERT INTO media_gateway.content (external_id, content_type, title, description, release_date, metadata)
VALUES
    ('tmdb-550', 'movie', 'Fight Club', 'An insomniac office worker and a devil-may-care soap maker form an underground fight club.', '1999-10-15', '{"genre": ["drama", "thriller"], "rating": 8.8}'),
    ('tmdb-13', 'movie', 'Forrest Gump', 'The presidencies of Kennedy and Johnson, the Vietnam War, and other historical events unfold from the perspective of an Alabama man.', '1994-07-06', '{"genre": ["drama", "romance"], "rating": 8.8}'),
    ('tmdb-278', 'movie', 'The Shawshank Redemption', 'Two imprisoned men bond over a number of years, finding solace and eventual redemption.', '1994-09-23', '{"genre": ["drama"], "rating": 9.3}');

-- Generate sample embeddings (random for demo - use real embeddings in production)
INSERT INTO vectors.content_embeddings (content_id, embedding_model, embedding)
SELECT
    id,
    'demo-model',
    array_agg(random())::vector(768)
FROM media_gateway.content, generate_series(1, 768)
GROUP BY id;

-- Test similarity search
SELECT
    c.title,
    c.description,
    vectors.cosine_similarity(ce1.embedding, ce2.embedding) as similarity
FROM vectors.content_embeddings ce1
CROSS JOIN vectors.content_embeddings ce2
JOIN media_gateway.content c ON ce2.content_id = c.id
WHERE ce1.content_id = (SELECT id FROM media_gateway.content WHERE title = 'Fight Club')
  AND ce1.content_id != ce2.content_id
ORDER BY similarity DESC
LIMIT 5;
```

## Common Commands

### Service Management

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart services
docker-compose restart

# Remove everything (including volumes)
docker-compose down -v

# View status
docker-compose ps

# View resource usage
docker stats
```

### Database Operations

```bash
# Connect to database
docker-compose exec ruvector-postgres psql -U mediagateway -d media_gateway

# Run SQL file
docker-compose exec -T ruvector-postgres psql -U mediagateway -d media_gateway < script.sql

# Create backup
docker-compose exec ruvector-postgres pg_dump -U mediagateway media_gateway > backup-$(date +%Y%m%d).sql

# Restore backup
docker-compose exec -T ruvector-postgres psql -U mediagateway -d media_gateway < backup.sql

# View database size
docker-compose exec ruvector-postgres psql -U mediagateway -d media_gateway -c "SELECT pg_size_pretty(pg_database_size('media_gateway'));"

# View table sizes
docker-compose exec ruvector-postgres psql -U mediagateway -d media_gateway -c "\dt+"
```

### Logs and Monitoring

```bash
# Follow all logs
docker-compose logs -f

# Follow specific service
docker-compose logs -f ruvector-postgres

# Last 100 lines
docker-compose logs --tail=100 ruvector-postgres

# Search logs
docker-compose logs ruvector-postgres | grep ERROR

# Export logs
docker-compose logs --no-color > logs-$(date +%Y%m%d).txt
```

## Database Connection Strings

### From Host Machine

```bash
# psql
psql -h localhost -p 5432 -U mediagateway -d media_gateway

# Connection URL
postgresql://mediagateway:changeme123@localhost:5432/media_gateway
```

### From Docker Container

```bash
# Connection URL
postgresql://mediagateway:changeme123@ruvector-postgres:5432/media_gateway
```

### From Node.js Application

```javascript
// Using pg library
const { Pool } = require('pg');

const pool = new Pool({
  host: 'ruvector-postgres',
  port: 5432,
  database: 'media_gateway',
  user: 'mediagateway',
  password: 'changeme123',
});

// Or using DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs ruvector-postgres

# Check if port is in use
lsof -i :5432
# or
netstat -an | grep 5432

# Change port in .env if needed
POSTGRES_PORT=5433
```

### Connection Refused

```bash
# Check service is running
docker-compose ps

# Check health
docker-compose exec ruvector-postgres pg_isready

# Wait for service to be ready
docker-compose up -d
sleep 10
docker-compose exec ruvector-postgres pg_isready
```

### Out of Disk Space

```bash
# Check volume usage
docker system df

# Clean up unused resources
docker system prune

# Remove old volumes
docker volume prune
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Adjust memory in .env
POSTGRES_MEMORY_LIMIT=4G
POSTGRES_SHARED_BUFFERS=512MB

# Restart with new limits
docker-compose down
docker-compose up -d
```

### Reset Everything

```bash
# Stop and remove all containers, networks, and volumes
docker-compose down -v

# Verify volumes are removed
docker volume ls

# Start fresh
docker-compose up -d
```

## Next Steps

1. **Configure API Keys**
   - Update .env with your TMDB, Gemini, and OpenAI keys

2. **Load Real Data**
   - Import media content from TMDB
   - Generate embeddings using Vertex AI or OpenAI

3. **Deploy Application**
   - Uncomment media-api service in docker-compose.yml
   - Build and deploy your Node.js application

4. **Enable Monitoring**
   - Set up OpenTelemetry
   - Configure logging aggregation
   - Set up alerting

5. **Production Hardening**
   - Change all default passwords
   - Enable SSL/TLS
   - Configure backups
   - Set up replication

## Resources

- [Full Architecture Documentation](./docker-architecture.md)
- [PostgreSQL Official Docs](https://www.postgresql.org/docs/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Media Gateway README](../README.md)

## Support

Need help?
- GitHub Issues: https://github.com/agenticsorg/hackathon-tv5/issues
- Discord: https://discord.agentics.org
- Documentation: https://agentics.org/hackathon

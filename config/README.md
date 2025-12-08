# Configuration Directory

This directory contains configuration files for the Media Gateway Docker stack.

## Directory Structure

```
config/
├── postgres/           # PostgreSQL configuration
│   ├── init/          # Initialization SQL scripts
│   │   └── 01-init-vector-extensions.sql
│   └── postgresql.conf # Custom PostgreSQL configuration
│
└── pgadmin/           # pgAdmin configuration
    └── servers.json   # Pre-configured server connections
```

## PostgreSQL Configuration

### Initialization Scripts (`postgres/init/`)

SQL scripts in this directory are executed automatically when the PostgreSQL container first starts. Files are executed in alphabetical order.

**01-init-vector-extensions.sql**:
- Enables pgvector and other required extensions
- Creates application schemas (media_gateway, vectors, agents, analytics)
- Creates base tables for content, embeddings, and agent data
- Sets up HNSW indices for vector similarity search
- Defines helper functions for vector operations

To add custom initialization:
1. Create a new file with a number prefix (e.g., `02-custom-init.sql`)
2. Place it in `config/postgres/init/`
3. Recreate the database container: `docker-compose down -v && docker-compose up -d`

### PostgreSQL Configuration (`postgres/postgresql.conf`)

Custom PostgreSQL settings optimized for:
- Vector operations and AI workloads
- Query performance
- Connection pooling
- Logging and monitoring

Key optimizations:
- `shared_buffers`: Increased for better caching
- `work_mem`: Optimized for complex queries
- `max_parallel_workers`: Enabled for vector operations
- Query logging for performance analysis

To modify:
1. Edit `postgresql.conf`
2. Restart PostgreSQL: `docker-compose restart ruvector-postgres`

## pgAdmin Configuration

### Server Definitions (`pgadmin/servers.json`)

Pre-configured connection to the RuVector PostgreSQL database. When pgAdmin starts, this server will be automatically available in the UI.

**Pre-configured server:**
- Name: Media Gateway - RuVector PostgreSQL
- Host: ruvector-postgres (Docker internal hostname)
- Port: 5432
- Database: media_gateway
- User: mediagateway

To add more servers:
1. Edit `servers.json`
2. Add new server definition with incremented ID
3. Restart pgAdmin: `docker-compose restart pgadmin`

## Environment Variables

Configuration values can be overridden using environment variables in `.env`:

### PostgreSQL
- `POSTGRES_USER` - Database username
- `POSTGRES_PASSWORD` - Database password
- `POSTGRES_DB` - Database name
- `VECTOR_DIMENSION` - Vector embedding dimension (default: 768)
- `POSTGRES_MAX_CONNECTIONS` - Max connections (default: 200)
- `POSTGRES_SHARED_BUFFERS` - Shared buffer size (default: 256MB)

### pgAdmin
- `PGADMIN_EMAIL` - Admin email
- `PGADMIN_PASSWORD` - Admin password
- `PGADMIN_PORT` - Web UI port (default: 5050)

## Customization Examples

### Add Custom Schema

Create `config/postgres/init/02-custom-schema.sql`:

```sql
-- Create custom schema
CREATE SCHEMA IF NOT EXISTS my_custom_schema;

-- Grant permissions
GRANT USAGE ON SCHEMA my_custom_schema TO CURRENT_USER;
GRANT CREATE ON SCHEMA my_custom_schema TO CURRENT_USER;
```

### Create Custom Tables

Create `config/postgres/init/03-custom-tables.sql`:

```sql
-- Custom table with vector support
CREATE TABLE my_custom_schema.my_vectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    embedding vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create HNSW index
CREATE INDEX idx_my_vectors_embedding
ON my_custom_schema.my_vectors
USING hnsw (embedding vector_cosine_ops);
```

### Override PostgreSQL Settings

Edit `config/postgres/postgresql.conf` to tune for your workload:

```conf
# Increase for larger datasets
shared_buffers = 512MB
effective_cache_size = 2GB

# More parallel workers for complex queries
max_parallel_workers_per_gather = 8
max_worker_processes = 16
```

## Troubleshooting

### Initialization Scripts Not Running

**Problem**: SQL scripts in `init/` directory not executed

**Solution**:
1. Scripts only run on first container start
2. To re-run: `docker-compose down -v` (WARNING: deletes data)
3. Then: `docker-compose up -d`

### Configuration Changes Not Applied

**Problem**: Changes to `postgresql.conf` not reflected

**Solution**:
1. Ensure file is mounted correctly (check docker-compose.yml)
2. Restart container: `docker-compose restart ruvector-postgres`
3. Check logs: `docker-compose logs ruvector-postgres`

### Permission Errors

**Problem**: PostgreSQL can't read configuration files

**Solution**:
```bash
# Fix file permissions
chmod 644 config/postgres/postgresql.conf
chmod 644 config/postgres/init/*.sql
```

## Best Practices

1. **Version Control**
   - Commit configuration files to git
   - Document custom changes
   - Use environment variables for sensitive data

2. **Testing**
   - Test initialization scripts before production
   - Validate PostgreSQL configuration syntax
   - Monitor logs after configuration changes

3. **Security**
   - Never commit passwords or secrets
   - Use strong passwords in .env
   - Restrict file permissions on sensitive configs
   - Enable SSL/TLS in production

4. **Performance**
   - Monitor query performance after config changes
   - Adjust based on actual workload patterns
   - Use EXPLAIN ANALYZE for slow queries
   - Regular VACUUM and ANALYZE

## Resources

- [PostgreSQL Configuration](https://www.postgresql.org/docs/current/runtime-config.html)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [pgAdmin Documentation](https://www.pgadmin.org/docs/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)

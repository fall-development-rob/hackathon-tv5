# RuVector PostgreSQL Extension Research

## Overview

RuVector is a PostgreSQL extension for high-performance vector operations, supporting dense vectors, sparse vectors, graph databases, and AI agent routing capabilities.

**Version**: 0.2.5
**SIMD Support**: AVX2, FMA, SSE4.2 (8 floats per operation)

## Data Types

### Primary Type: `ruvector`

- **Syntax**: `ruvector(dimensions)`
- **Example**: `ruvector(768)` for 768-dimensional vectors
- **Storage**: Optimized binary format with SIMD acceleration
- **Type Array**: `ruvector[]` for arrays of vectors

### Working with Vectors

```sql
-- Vector literals use array notation
'[0.1, 0.2, 0.3]'::ruvector(768)

-- Can work with partial dimensions (auto-padded with zeros)
'[0.1, 0.2, 0.3]'::ruvector(768)  -- Only 3 values, rest are zeros
```

## Distance Functions

### Function-Based Distance Metrics

| Function                         | Description                             | Use Case                             |
| -------------------------------- | --------------------------------------- | ------------------------------------ |
| `ruvector_cosine_distance(a, b)` | Cosine distance (1 - cosine similarity) | Text embeddings, semantic similarity |
| `ruvector_l2_distance(a, b)`     | Euclidean (L2) distance                 | General similarity, image vectors    |
| `ruvector_l1_distance(a, b)`     | Manhattan (L1) distance                 | Sparse data, feature matching        |
| `ruvector_inner_product(a, b)`   | Dot product (negative for similarity)   | Maximum inner product search         |

### Operator-Based Distance (for ORDER BY)

| Operator | Equivalent Function        | Description              |
| -------- | -------------------------- | ------------------------ |
| `<=>`    | `ruvector_cosine_distance` | Cosine distance          |
| `<->`    | `ruvector_l2_distance`     | L2 (Euclidean) distance  |
| `<#>`    | `ruvector_inner_product`   | Inner product (negative) |

### Array-Based Functions (real[] arrays)

| Function                      | Description                       |
| ----------------------------- | --------------------------------- |
| `cosine_distance_arr(a, b)`   | Cosine distance for real[] arrays |
| `l2_distance_arr(a, b)`       | L2 distance for real[] arrays     |
| `l1_distance_arr(a, b)`       | L1 distance for real[] arrays     |
| `inner_product_arr(a, b)`     | Inner product for real[] arrays   |
| `cosine_similarity_arr(a, b)` | Cosine similarity (not distance)  |

## Vector Operations

### Basic Operations

```sql
-- Addition
SELECT ruvector_add(vec1, vec2);
SELECT vec1 + vec2;  -- Operator form

-- Subtraction
SELECT ruvector_sub(vec1, vec2);
SELECT vec1 - vec2;  -- Operator form

-- Scalar multiplication
SELECT ruvector_mul_scalar(vec, 2.5);

-- Normalization
SELECT ruvector_normalize(vec);

-- Norm (magnitude)
SELECT ruvector_norm(vec);

-- Dimensions
SELECT ruvector_dims(vec);
```

### Utility Functions

```sql
-- Get vector dimensions
SELECT vector_dims(ARRAY[0.1,0.2,0.3]::real[]);

-- Normalize array
SELECT vector_normalize(ARRAY[1.0,2.0,3.0]::real[]);

-- Vector norm
SELECT vector_norm(ARRAY[3.0,4.0]::real[]);
```

## Creating Tables with Vectors

### Basic Table Creation

```sql
CREATE TABLE embeddings (
    id SERIAL PRIMARY KEY,
    embedding ruvector(768),
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Inserting Vectors

```sql
-- Insert from array literal
INSERT INTO embeddings (embedding, content)
VALUES ('[0.1,0.2,0.3,...]'::ruvector(768), 'Sample text');

-- Insert from real[] array
INSERT INTO embeddings (embedding, content)
VALUES (
    (SELECT ARRAY[0.1,0.2,0.3]::real[])::text::ruvector(768),
    'Sample text'
);

-- Batch insert
INSERT INTO embeddings (embedding, content) VALUES
    ('[0.1,0.2,0.3]'::ruvector(768), 'text1'),
    ('[0.4,0.5,0.6]'::ruvector(768), 'text2'),
    ('[0.7,0.8,0.9]'::ruvector(768), 'text3');
```

## Similarity Search

### Cosine Similarity (Most Common for Embeddings)

```sql
-- Using operator (recommended for ORDER BY)
SELECT id, content, embedding <=> $1::ruvector(768) AS distance
FROM embeddings
ORDER BY distance
LIMIT 10;

-- Using function
SELECT id, content, ruvector_cosine_distance(embedding, $1::ruvector(768)) AS distance
FROM embeddings
ORDER BY distance
LIMIT 10;
```

### L2 Distance (Euclidean)

```sql
SELECT id, content, embedding <-> $1::ruvector(768) AS distance
FROM embeddings
ORDER BY distance
LIMIT 10;
```

### Inner Product (Maximum Similarity)

```sql
-- Note: Returns negative values, so DESC for maximum similarity
SELECT id, content, -(embedding <#> $1::ruvector(768)) AS similarity
FROM embeddings
ORDER BY similarity DESC
LIMIT 10;
```

### With WHERE Clause Filters

```sql
SELECT id, content, embedding <=> $1::ruvector(768) AS distance
FROM embeddings
WHERE metadata->>'category' = 'tech'
    AND created_at > NOW() - INTERVAL '7 days'
ORDER BY distance
LIMIT 10;
```

## Advanced Features

### Auto-Tuning

```sql
-- Analyze table and optimize search parameters
SELECT ruvector_auto_tune('embeddings', 'balanced');

-- Options: 'balanced', 'speed', 'accuracy'
SELECT ruvector_auto_tune('embeddings', 'speed');
```

### Learning and Optimization

```sql
-- Enable learning for query optimization
SELECT ruvector_enable_learning('embeddings');

-- Record user feedback for learning
SELECT ruvector_record_feedback(
    'embeddings',
    $1::real[],  -- query vector
    ARRAY[1,2,3]::bigint[],  -- relevant IDs
    ARRAY[4,5]::bigint[]     -- irrelevant IDs
);

-- Get learning statistics
SELECT ruvector_learning_stats('embeddings');

-- Extract learned patterns
SELECT ruvector_extract_patterns('embeddings', 10);

-- Clear learning data
SELECT ruvector_clear_learning('embeddings');
```

### Memory Statistics

```sql
SELECT ruvector_memory_stats();
-- Returns: {"index_memory_mb", "vector_cache_mb", "total_extension_mb", "quantization_tables_mb"}
```

## Sparse Vectors

### Sparse Vector Format

Sparse vectors use a text-based format: `{index:value, index:value, ...}`

```sql
-- Sparse cosine similarity
SELECT ruvector_sparse_cosine('{1:0.5,3:0.8}', '{1:0.6,2:0.3,3:0.7}');

-- Sparse dot product
SELECT ruvector_sparse_dot('{1:0.5,3:0.8}', '{1:0.6,2:0.3,3:0.7}');

-- Sparse euclidean distance
SELECT ruvector_sparse_euclidean('{1:0.5,3:0.8}', '{1:0.6,2:0.3,3:0.7}');

-- Get sparse vector dimensions
SELECT ruvector_sparse_dim('{1:0.5,3:0.8}');

-- Get number of non-zero elements
SELECT ruvector_sparse_nnz('{1:0.5,3:0.8}');

-- Get top-k values
SELECT ruvector_sparse_top_k('{1:0.5,2:0.1,3:0.8}', 2);

-- Prune small values
SELECT ruvector_sparse_prune('{1:0.5,2:0.01,3:0.8}', 0.1);
```

### BM25 Text Scoring

```sql
SELECT ruvector_sparse_bm25(
    'search query',      -- query text
    'document text',     -- document text
    100,                 -- document length
    75.0,                -- average document length
    1.2,                 -- k1 parameter (term frequency saturation)
    0.75                 -- b parameter (length normalization)
);
```

## Graph Database Features

### Graph Creation

```sql
-- Create a graph
SELECT ruvector_create_graph('knowledge_graph');

-- Add nodes
SELECT ruvector_add_node('knowledge_graph',
    ARRAY['Person', 'Employee'],
    '{"name": "Alice", "age": 30, "role": "Engineer"}'::jsonb
);

SELECT ruvector_add_node('knowledge_graph',
    ARRAY['Person', 'Manager'],
    '{"name": "Bob", "age": 35, "role": "Manager"}'::jsonb
);

-- Add edges
SELECT ruvector_add_edge('knowledge_graph',
    1,  -- source node ID
    2,  -- target node ID
    'REPORTS_TO',
    '{"since": "2023-01-01"}'::jsonb
);
```

### Graph Queries

```sql
-- Get graph statistics
SELECT ruvector_graph_stats('knowledge_graph');
-- Returns: {"name", "node_count", "edge_count", "labels", "edge_types"}

-- List all graphs
SELECT ruvector_list_graphs();

-- Find shortest path
SELECT ruvector_shortest_path('knowledge_graph', 1, 5, 10);
```

### Cypher Query Support

```sql
-- Execute Cypher queries
SELECT * FROM ruvector_cypher('knowledge_graph',
    'MATCH (p:Person)-[:KNOWS]->(friend:Person) RETURN p, friend',
    '{}'::jsonb
);

-- With parameters
SELECT * FROM ruvector_cypher('knowledge_graph',
    'MATCH (p:Person {name: $name}) RETURN p',
    '{"name": "Alice"}'::jsonb
);
```

### Graph Deletion

```sql
SELECT ruvector_delete_graph('knowledge_graph');
```

## AI Agent Routing

### Register Agents

```sql
-- Register an agent
SELECT ruvector_register_agent(
    'gpt-4',                    -- agent name
    'llm',                      -- agent type
    ARRAY['text', 'code'],      -- capabilities
    0.03,                       -- cost per request
    500.0,                      -- avg latency ms
    0.95                        -- quality score
);

-- Register with full config
SELECT ruvector_register_agent_full('{
    "name": "claude-3",
    "type": "llm",
    "capabilities": ["text", "reasoning", "code"],
    "cost_per_request": 0.025,
    "avg_latency_ms": 400.0,
    "quality_score": 0.97,
    "max_tokens": 100000
}'::jsonb);
```

### Agent Management

```sql
-- List all agents
SELECT * FROM ruvector_list_agents();

-- Get specific agent
SELECT ruvector_get_agent('gpt-4');

-- Find agents by capability
SELECT * FROM ruvector_find_agents_by_capability('code', 5);

-- Set agent active/inactive
SELECT ruvector_set_agent_active('gpt-4', false);

-- Update agent metrics
SELECT ruvector_update_agent_metrics(
    'gpt-4',    -- agent name
    520.0,      -- latency ms
    true,       -- success
    0.92        -- quality score
);

-- Remove agent
SELECT ruvector_remove_agent('gpt-4');

-- Clear all agents
SELECT ruvector_clear_agents();
```

### Agent Routing

```sql
-- Route request to best agent
SELECT ruvector_route(
    ARRAY[0.1,0.2,0.3]::real[],  -- embedding/context vector
    'balanced',                   -- optimize for: 'cost', 'latency', 'quality', 'balanced'
    '{"max_cost": 0.05}'::jsonb  -- constraints
);
-- Returns: {"agent_name", "score", "reason"}

-- Get routing statistics
SELECT ruvector_routing_stats();
```

## Hyperbolic Geometry Functions

RuVector includes functions for hyperbolic space operations, useful for hierarchical embeddings:

```sql
-- Poincaré ball distance
SELECT ruvector_poincare_distance(
    ARRAY[0.1,0.2]::real[],
    ARRAY[0.3,0.4]::real[],
    -1.0  -- curvature
);

-- Lorentz model distance
SELECT ruvector_lorentz_distance(
    ARRAY[0.1,0.2,0.3]::real[],
    ARRAY[0.4,0.5,0.6]::real[],
    -1.0  -- curvature
);

-- Möbius addition
SELECT ruvector_mobius_add(
    ARRAY[0.1,0.2]::real[],
    ARRAY[0.3,0.4]::real[],
    -1.0  -- curvature
);

-- Exponential map
SELECT ruvector_exp_map(
    ARRAY[0.0,0.0]::real[],  -- base point
    ARRAY[0.1,0.2]::real[],  -- tangent vector
    -1.0                     -- curvature
);

-- Logarithmic map
SELECT ruvector_log_map(
    ARRAY[0.0,0.0]::real[],  -- base point
    ARRAY[0.1,0.2]::real[],  -- target point
    -1.0                     -- curvature
);
```

## Quantization Functions

```sql
-- Binary quantization (1-bit)
SELECT binary_quantize_arr(ARRAY[0.1,-0.2,0.3]::real[]);

-- Scalar quantization (8-bit)
SELECT scalar_quantize_arr(ARRAY[0.1,0.5,0.9]::real[]);
```

## Temporal Vector Operations

```sql
-- Calculate velocity between vectors over time
SELECT temporal_velocity(
    ARRAY[0.1,0.2]::real[],  -- previous vector
    ARRAY[0.15,0.25]::real[], -- current vector
    1.0                       -- time delta
);

-- Exponential moving average
SELECT temporal_ema_update(
    ARRAY[0.1,0.2]::real[],  -- old average
    ARRAY[0.15,0.25]::real[], -- new value
    0.9                       -- alpha (smoothing factor)
);

-- Drift detection
SELECT temporal_drift(
    ARRAY[0.1,0.2]::real[],  -- baseline
    ARRAY[0.5,0.6]::real[],  -- current
    0.1                       -- threshold
);
```

## Attention Mechanism Functions

```sql
-- Initialize attention scores
SELECT attention_init(10);  -- sequence length

-- Calculate attention score
SELECT attention_score(
    ARRAY[0.1,0.2,0.3]::real[],  -- query
    ARRAY[0.4,0.5,0.6]::real[]   -- key
);

-- Softmax normalization
SELECT attention_softmax(ARRAY[2.3,1.5,0.8]::real[]);

-- Weighted addition
SELECT attention_weighted_add(
    ARRAY[0.1,0.2,0.3]::real[],  -- accumulator
    ARRAY[0.4,0.5,0.6]::real[],  -- values
    0.7                           -- attention weight
);
```

## Graph Neural Network Functions

```sql
-- Graph Convolutional Network (GCN) forward pass
SELECT ruvector_gcn_forward(
    ARRAY[0.1,0.2,0.3,0.4]::real[],  -- node features (flattened)
    ARRAY[0,1,2]::integer[],          -- source nodes
    ARRAY[1,2,3]::integer[],          -- target nodes
    ARRAY[0.5,0.5,0.5]::real[],      -- edge weights
    2                                 -- output dimensions
);

-- GraphSAGE forward pass
SELECT ruvector_graphsage_forward(
    ARRAY[0.1,0.2,0.3,0.4]::real[],  -- node features
    ARRAY[0,1]::integer[],            -- source nodes
    ARRAY[1,2]::integer[],            -- target nodes
    2,                                -- output dimensions
    5                                 -- sample size
);
```

## Graph Algorithm Functions

```sql
-- PageRank base initialization
SELECT graph_pagerank_base(10, 0.85);  -- num_nodes, damping_factor

-- PageRank contribution
SELECT graph_pagerank_contribution(0.5, 3, 0.85);  -- score, out_degree, damping

-- Edge similarity
SELECT graph_edge_similarity(
    ARRAY[0.1,0.2,0.3]::real[],
    ARRAY[0.15,0.25,0.35]::real[]
);

-- Check if graph is connected
SELECT graph_is_connected(
    ARRAY[0.1,0.2]::real[],  -- node1
    ARRAY[0.15,0.25]::real[], -- node2
    0.5                       -- threshold
);

-- Bipartite graph scoring
SELECT graph_bipartite_score(
    ARRAY[0.1,0.2]::real[],  -- left node
    ARRAY[0.3,0.4]::real[],  -- right node
    0.7                       -- edge weight
);
```

## System Information

```sql
-- Check extension version
SELECT ruvector_version();

-- Check SIMD capabilities
SELECT ruvector_simd_info();
-- Returns: architecture, active SIMD, available features, floats per operation
```

## Comparison with pgvector

| Feature             | pgvector            | ruvector               |
| ------------------- | ------------------- | ---------------------- |
| Dense vectors       | ✅ `vector(n)`      | ✅ `ruvector(n)`       |
| Sparse vectors      | ❌                  | ✅ Text format         |
| Distance operators  | `<=>`, `<->`, `<#>` | `<=>`, `<->`, `<#>`    |
| SIMD acceleration   | ✅                  | ✅ AVX2/FMA/SSE4.2     |
| Indexing            | IVFFlat, HNSW       | None (sequential scan) |
| Graph database      | ❌                  | ✅ Cypher queries      |
| AI agent routing    | ❌                  | ✅ Built-in            |
| Auto-tuning         | ❌                  | ✅ Adaptive learning   |
| Hyperbolic geometry | ❌                  | ✅ Poincaré/Lorentz    |
| GNN support         | ❌                  | ✅ GCN, GraphSAGE      |
| BM25 text scoring   | ❌                  | ✅ Built-in            |

## Key Differences from pgvector

1. **No Custom Indexes**: RuVector doesn't have IVFFlat or HNSW indexes yet. All queries use sequential scan.
2. **Graph Database**: Built-in graph database with Cypher query support.
3. **AI Agent Routing**: Native support for routing requests to AI agents based on embeddings.
4. **Advanced Math**: Hyperbolic geometry, GNN operations, attention mechanisms.
5. **Auto-Learning**: Can learn from feedback and optimize search parameters automatically.
6. **Sparse Vectors**: Native support for sparse vector operations and BM25 scoring.

## Integration Test Recommendations

### Basic Vector Operations

```typescript
test("should create table with ruvector column", async () => {
  await pool.query(`
    CREATE TABLE test_embeddings (
      id SERIAL PRIMARY KEY,
      embedding ruvector(768),
      content TEXT
    )
  `);
});

test("should insert and query vectors", async () => {
  const embedding = Array(768).fill(0.1);
  await pool.query(
    "INSERT INTO test_embeddings (embedding, content) VALUES ($1::ruvector(768), $2)",
    [`[${embedding.join(",")}]`, "test content"],
  );

  const result = await pool.query(
    "SELECT id, content FROM test_embeddings ORDER BY embedding <=> $1::ruvector(768) LIMIT 10",
    [`[${embedding.join(",")}]`],
  );
  expect(result.rows).toHaveLength(1);
});
```

### Advanced Features

```typescript
test("should enable learning and get stats", async () => {
  await pool.query("SELECT ruvector_enable_learning('test_embeddings')");
  const stats = await pool.query(
    "SELECT ruvector_learning_stats('test_embeddings')",
  );
  expect(stats.rows[0]).toBeDefined();
});

test("should perform graph operations", async () => {
  await pool.query("SELECT ruvector_create_graph('test_graph')");
  const nodeId = await pool.query(
    "SELECT ruvector_add_node('test_graph', ARRAY['Label'], '{}'::jsonb)",
  );
  expect(nodeId.rows[0]).toBeDefined();
});
```

## Performance Notes

- **SIMD Acceleration**: AVX2 provides 8-way parallelism for float operations
- **No Indexing Yet**: All similarity searches use sequential scans (may be slower than pgvector for large datasets)
- **Learning Overhead**: Auto-tuning and learning features add computational overhead
- **Graph Operations**: Efficient for small to medium graphs, may need optimization for very large graphs

## Version Information

- **Extension Version**: 0.2.5
- **Tested PostgreSQL**: 17.2
- **Docker Image**: ruvnet/ruvector-postgres

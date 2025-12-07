# @media-gateway/mcp-server

MCP (Model Context Protocol) server implementation for Media Gateway with dual transport support (STDIO and SSE).

## Features

- **Dual Transport Support**:
  - STDIO for CLI usage
  - SSE (Server-Sent Events) for web clients

- **Tool Categories**:
  - Discovery: Content search, trending, popular
  - Recommendations: Personalized suggestions with Q-learning
  - Social: Group watching and consensus
  - Learning: Model training and inspection

- **Integration**:
  - SwarmCoordinator for multi-agent orchestration
  - Q-Learning for adaptive recommendations
  - AgentDB for federated learning

## Installation

```bash
pnpm install
pnpm build
```

## Usage

### STDIO Transport (CLI)

```bash
# Start STDIO transport
pnpm start:stdio

# Or use the binary
media-gateway-mcp stdio
```

### SSE Transport (Web)

```bash
# Start SSE transport on port 3100
pnpm start:sse

# Or specify custom port
media-gateway-mcp sse 3200
```

### Endpoints (SSE Mode)

- `POST /rpc` - JSON-RPC endpoint
- `GET /events` - SSE streaming endpoint
- `GET /health` - Health check

## Available Tools

### Discovery Tools

- `content_search` - Search for content with natural language
- `content_trending` - Get trending content
- `content_popular` - Get popular content by category
- `content_details` - Get detailed content information
- `content_similar` - Find similar content
- `content_recommendations` - Get AI-powered recommendations

### Recommendation Tools

- `get_personalized` - Get personalized recommendations
- `get_for_mood` - Get mood-based recommendations
- `learn_preferences` - Update user preference model
- `record_watch_session` - Record viewing session
- `get_recommendation_strategy` - Get Q-learning strategy

### Social Tools

- `create_group_session` - Create group watch session
- `submit_vote` - Submit group vote
- `finalize_session` - Finalize group session
- `get_group_recommendations` - Get group recommendations

### Learning Tools

- `train_model` - Train Q-learning model
- `save_model` - Save model to disk
- `load_model` - Load saved model
- `get_learning_stats` - Get learning statistics
- `get_preference_profile` - Get user preference profile

## Example Usage

### Using with Claude Code

```bash
# Add to Claude MCP config
claude mcp add media-gateway npx @media-gateway/mcp-server stdio
```

### Using HTTP Client

```bash
# Search for content
curl -X POST http://localhost:3100/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "content_search",
      "arguments": {
        "query": "action movies with Tom Cruise",
        "userId": "user123"
      }
    }
  }'

# Get personalized recommendations
curl -X POST http://localhost:3100/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "get_personalized",
      "arguments": {
        "userId": "user123",
        "limit": 10
      }
    }
  }'
```

## Architecture

```
┌─────────────────────────────────────────┐
│         MCP Server (index.ts)           │
│  ┌────────────────┬─────────────────┐   │
│  │ STDIO Transport│  SSE Transport  │   │
│  └────────┬───────┴────────┬────────┘   │
│           │                │             │
│      ┌────┴────────────────┴────┐        │
│      │    MCPServer (server.ts) │        │
│      │  - JSON-RPC 2.0 Handler  │        │
│      │  - Tool Routing          │        │
│      └────────────┬─────────────┘        │
│                   │                      │
│      ┌────────────┴─────────────┐        │
│      │  Tool Handlers (tools.ts)│        │
│      └────────────┬─────────────┘        │
└───────────────────┼──────────────────────┘
                    │
        ┌───────────┴──────────┐
        │  SwarmCoordinator    │
        │  - Multi-agent       │
        │  - MCP Memory        │
        │  - Q-Learning        │
        └──────────────────────┘
```

## Integration with SwarmCoordinator

The MCP server integrates with SwarmCoordinator for:

1. **Multi-Agent Orchestration**: Routes tool calls through appropriate agents
2. **MCP Memory**: Stores user preferences, sessions, and learning state
3. **Q-Learning**: Adaptive recommendation strategies
4. **Task Coordination**: Parallel execution of discovery and recommendation tasks

## Result Pattern

All tool calls return a consistent result pattern:

```typescript
interface ToolResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

## License

Apache-2.0

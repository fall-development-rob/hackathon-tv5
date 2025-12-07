#!/usr/bin/env node

/**
 * MCP Server Entry Point
 * Supports dual transport: STDIO and SSE (Server-Sent Events)
 */

import { createServer } from 'http';
import express, { Request, Response } from 'express';
import { MCPServer } from './server.js';
import { createSwarmCoordinator } from '@media-gateway/agents';
import type { SwarmCoordinator } from '@media-gateway/agents';

/**
 * STDIO Transport
 * Reads JSON-RPC requests from stdin and writes responses to stdout
 */
async function startStdioTransport(server: MCPServer): Promise<void> {
  console.error('[MCP] Starting STDIO transport...');

  let buffer = '';

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (chunk: string) => {
    buffer += chunk;

    // Process complete JSON objects
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const request = JSON.parse(line);
        const response = await server.processRequest(request);

        // Write response to stdout
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (error) {
        console.error('[MCP] Error processing request:', error);
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error'
          }
        }) + '\n');
      }
    }
  });

  process.stdin.on('end', () => {
    console.error('[MCP] STDIO transport closed');
    process.exit(0);
  });

  console.error('[MCP] STDIO transport ready');
}

/**
 * SSE (Server-Sent Events) Transport
 * HTTP endpoint for web-based MCP clients
 */
async function startSSETransport(server: MCPServer, port: number = 3100): Promise<void> {
  const app = express();

  app.use(express.json());

  // CORS headers for web clients
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'healthy', transport: 'sse' });
  });

  // JSON-RPC endpoint
  app.post('/rpc', async (req: Request, res: Response) => {
    try {
      const request = req.body;
      const response = await server.processRequest(request);
      res.json(response);
    } catch (error) {
      res.status(500).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error'
        }
      });
    }
  });

  // SSE endpoint for streaming responses
  app.get('/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write('data: {"type":"connected"}\n\n');

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write('data: {"type":"ping"}\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });
  });

  // Start HTTP server
  const httpServer = createServer(app);

  httpServer.listen(port, () => {
    console.error(`[MCP] SSE transport listening on http://localhost:${port}`);
    console.error(`[MCP] JSON-RPC endpoint: http://localhost:${port}/rpc`);
    console.error(`[MCP] SSE endpoint: http://localhost:${port}/events`);
    console.error(`[MCP] Health check: http://localhost:${port}/health`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.error('[MCP] Shutting down SSE transport...');
    httpServer.close(() => {
      console.error('[MCP] SSE transport closed');
      process.exit(0);
    });
  });
}

/**
 * Initialize SwarmCoordinator with mock wrappers
 * In production, these would be real database/vector instances
 */
function createMockWrappers() {
  // Mock database wrapper
  const dbWrapper = {
    query: async (sql: string, params: any[]) => {
      console.error('[Mock DB] Query:', sql);
      return [];
    },
    execute: async (sql: string, params: any[]) => {
      console.error('[Mock DB] Execute:', sql);
      return { affectedRows: 0 };
    }
  };

  // Mock vector wrapper
  const vectorWrapper = {
    generateEmbedding: async (text: string) => {
      console.error('[Mock Vector] Generating embedding for:', text);
      return new Float32Array(384).fill(0.1);
    },
    searchByEmbedding: async (embedding: Float32Array, limit: number, threshold: number, filters?: any) => {
      console.error('[Mock Vector] Searching with filters:', filters);
      return [];
    },
    insertContent: async (content: any) => {
      console.error('[Mock Vector] Inserting content:', content.title);
      return true;
    }
  };

  return { dbWrapper, vectorWrapper };
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const transport = args[0] || 'stdio';

  // Create MCP server
  const mcpServer = new MCPServer({
    name: '@media-gateway/mcp-server',
    version: '0.1.0',
    description: 'MCP server for Media Gateway with SwarmCoordinator and Q-Learning integration'
  });

  // Initialize SwarmCoordinator
  console.error('[MCP] Initializing SwarmCoordinator...');
  const { dbWrapper, vectorWrapper } = createMockWrappers();

  const swarmCoordinator = createSwarmCoordinator(
    dbWrapper,
    vectorWrapper,
    { topology: 'hierarchical', maxConcurrentTasks: 10 },
    { enableMCP: true, memoryNamespace: 'media-gateway' }
  );

  // Initialize MCP swarm
  await swarmCoordinator.initializeMCP();

  // Set SwarmCoordinator in MCP server
  mcpServer.setSwarmCoordinator(swarmCoordinator);
  mcpServer.enableQLearning();

  console.error('[MCP] SwarmCoordinator initialized');

  // Start appropriate transport
  if (transport === 'sse') {
    const port = parseInt(args[1] || '3100', 10);
    await startSSETransport(mcpServer, port);
  } else {
    await startStdioTransport(mcpServer);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[MCP] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[MCP] Unhandled rejection:', reason);
  process.exit(1);
});

// Run main
main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});

/**
 * MCP Server Exports for Media Gateway
 * Provides Model Context Protocol integration for Claude Desktop
 */

// Re-export the server path for CLI usage
export const MCP_SERVER_PATH = './media-gateway-mcp-server.js';

// Export tool list for documentation/testing
export const MCP_TOOLS = [
  // Discovery Tools
  'discover_content',
  'parse_query_intent',
  'search_by_filters',

  // Recommendation Tools
  'get_personalized_recommendations',
  'get_group_recommendations',
  'explain_recommendation',

  // User Preference Tools
  'record_watch_event',
  'get_user_preferences',
  'update_explicit_preferences',

  // Data Moat Tools
  'get_moat_metrics',
  'get_platform_stats',
  'analyze_user_engagement',

  // Social & Group Tools
  'create_group_session',
  'join_group_session',
  'vote_content',
] as const;

export type MCPToolName = (typeof MCP_TOOLS)[number];

/**
 * MCP Server configuration for Claude Desktop
 */
export const MCP_CONFIG = {
  name: 'media-gateway',
  version: '1.0.0',
  description: 'AI-powered entertainment discovery solving the 45-minute decision problem',
  command: 'npx',
  args: ['@media-gateway/core', 'mcp'],
  transportType: 'stdio' as const,
};

/**
 * Get the Claude Desktop configuration snippet
 */
export function getClaudeDesktopConfig(): object {
  return {
    mcpServers: {
      'media-gateway': {
        command: 'node',
        args: ['./dist/mcp/media-gateway-mcp-server.js'],
        cwd: '${workspaceFolder}/packages/@media-gateway/core',
      },
    },
  };
}

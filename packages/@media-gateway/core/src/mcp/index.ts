/**
 * MCP Server Exports for Media Gateway v2.0.0
 * Provides Model Context Protocol integration for Claude Desktop
 *
 * v2.0.0 adds:
 * - Q-Learning tools for recommendation strategy optimization
 * - FACT-style intelligent caching with three-tier TTL
 * - Swarm coordination tools for complex multi-agent tasks
 */

// Re-export the server path for CLI usage
export const MCP_SERVER_PATH = './media-gateway-mcp-server.js';

// Re-export modules for programmatic access
export { learningTools, qLearningEngine, QLearningEngine } from './learning-tools.js';
export type { LearningState, RecommendationAction, LearningSession, QTableEntry, LearnerStats } from './learning-tools.js';

export { cacheTools, mediaGatewayCache, IntelligentCache, MediaGatewayCache } from './cache-tools.js';
export type { CacheTier, CacheEntry, CacheStats } from './cache-tools.js';

export { swarmTools, swarmCoordinator, SwarmCoordinator } from './swarm-tools.js';
export type { AgentRole, SwarmTopology, SwarmAgent, SwarmTask, Swarm } from './swarm-tools.js';

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

  // V2.0.0: Q-Learning Tools
  'learn_start_session',
  'learn_record_watch',
  'learn_end_session',
  'learn_select_strategy',
  'learn_train',
  'learn_get_stats',
  'learn_get_preferences',
  'learn_export_model',
  'learn_import_model',
  'learn_clear',

  // V2.0.0: Intelligent Caching Tools
  'cache_get',
  'cache_set',
  'cache_invalidate',
  'cache_stats',
  'cache_prune',
  'cache_warm',
  'cache_export',
  'cache_import',

  // V2.0.0: Swarm Coordination Tools
  'swarm_init',
  'swarm_spawn_agent',
  'swarm_create_task',
  'swarm_orchestrate_recommendation',
  'swarm_status',
  'swarm_list_agents',
  'swarm_task_status',
  'swarm_complete_task',
  'swarm_terminate',
  'swarm_coordinator_stats',
] as const;

export type MCPToolName = (typeof MCP_TOOLS)[number];

// Tool categories for documentation
export const MCP_TOOL_CATEGORIES = {
  discovery: ['discover_content', 'parse_query_intent', 'search_by_filters'],
  recommendation: ['get_personalized_recommendations', 'get_group_recommendations', 'explain_recommendation'],
  preferences: ['record_watch_event', 'get_user_preferences', 'update_explicit_preferences'],
  analytics: ['get_moat_metrics', 'get_platform_stats', 'analyze_user_engagement'],
  social: ['create_group_session', 'join_group_session', 'vote_content'],
  learning: ['learn_start_session', 'learn_record_watch', 'learn_end_session', 'learn_select_strategy', 'learn_train', 'learn_get_stats', 'learn_get_preferences', 'learn_export_model', 'learn_import_model', 'learn_clear'],
  caching: ['cache_get', 'cache_set', 'cache_invalidate', 'cache_stats', 'cache_prune', 'cache_warm', 'cache_export', 'cache_import'],
  swarm: ['swarm_init', 'swarm_spawn_agent', 'swarm_create_task', 'swarm_orchestrate_recommendation', 'swarm_status', 'swarm_list_agents', 'swarm_task_status', 'swarm_complete_task', 'swarm_terminate', 'swarm_coordinator_stats'],
} as const;

/**
 * MCP Server configuration for Claude Desktop
 */
export const MCP_CONFIG = {
  name: 'media-gateway',
  version: '2.0.0',
  description: 'AI-powered entertainment discovery with Q-learning, intelligent caching, and swarm coordination',
  command: 'npx',
  args: ['@media-gateway/core', 'mcp'],
  transportType: 'stdio' as const,
  toolCount: MCP_TOOLS.length,
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

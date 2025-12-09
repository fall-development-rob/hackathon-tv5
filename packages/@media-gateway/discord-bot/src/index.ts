/**
 * Discord Bot with MCP Client Integration
 * Entry point for the Media Gateway Discord Bot
 */

export { MediaGatewayAgent, createMediaGatewayAgent } from "./mcp-client";
export { ConversationalAgent } from "./services/agent";
export { BriefGenerator } from "./services/brief-generator";
export * from "./types";

// Re-export configuration types
export type { MediaGatewayConfig } from "./mcp-client";
export type { BriefGeneratorConfig } from "./services/brief-generator";

/**
 * @media-gateway/agents
 *
 * Multi-agent system for media discovery
 * Uses collaborative AI agents with orchestration
 */

// Agents
export { DiscoveryAgent, createDiscoveryAgent } from './agents/DiscoveryAgent.js';
export { PreferenceAgent, createPreferenceAgent } from './agents/PreferenceAgent.js';
export { SocialAgent, createSocialAgent } from './agents/SocialAgent.js';
export {
  ProviderAgent,
  createProviderAgent,
  type ProviderAgentConfig,
} from './agents/ProviderAgent.js';

// Orchestration
export { SwarmCoordinator, createSwarmCoordinator } from './orchestration/SwarmCoordinator.js';

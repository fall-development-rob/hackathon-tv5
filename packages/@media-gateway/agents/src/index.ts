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

// Neural Training
export {
  NeuralTrainer,
  createNeuralTrainer,
  type PatternType,
  type NeuralTrainingConfig,
  type TrainingResult,
  type PatternAnalysis,
} from './neural/NeuralTrainer.js';

// Q-Learning
export {
  QLearning,
  createQLearning,
  createExperience,
  type QAction,
  type Experience,
  type UserContext,
  type EngagementMetrics,
  type QLearningConfig,
} from './learning/QLearning.js';

// Content Embeddings & Caching
export {
  ContentEmbeddingGenerator,
  LRUCache,
  createContentEmbeddingGenerator,
  createLRUCache,
  type MediaContent,
  type UserPreferences,
  type QState,
  type CacheEntry,
  type CacheStats,
  type EmbeddingWeights,
} from './learning/ContentEmbeddings.js';

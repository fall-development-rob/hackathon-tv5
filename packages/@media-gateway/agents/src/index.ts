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

// LoRA Personalization
export {
  LoRAPersonalizationEngine,
  createLoRAPersonalizationEngine,
  createAdapterFeedback,
  type UserLoRAAdapter,
  type AdapterMetadata,
  type LoRAConfig,
  type AdapterFeedback,
} from './learning/LoRAPersonalization.js';

// Hybrid Recommendation Engine (RRF)
export {
  HybridRecommendationEngine,
  createHybridRecommendationEngine,
  CollaborativeFilteringStrategy,
  ContentBasedStrategy,
  TrendingStrategy,
  ContextAwareStrategy,
  type RecommendationStrategy,
  type RankedItem,
  type FusedResult,
  type HybridRecommendation,
  type StrategyContribution as HybridStrategyContribution,
} from './recommendations/HybridRecommendationEngine.js';

// Diversity Filter (MMR)
export {
  DiversityFilter,
  GenreDiversifier,
  createDiversityFilter,
  createGenreDiversifier,
  type RecommendationCandidate,
  type DiversityMetrics,
  type GenreDiversityConfig,
} from './recommendations/DiversityFilter.js';

// Recommendation Explainer
export {
  RecommendationExplainer,
  ExplanationAggregator,
  createExplanationFromStrategies,
  formatExplanationAsText,
  ReasonCode,
  type ExplanationFactor,
  type RecommendationExplanation,
  type ExplanationConfig,
  type StrategyContribution,
} from './recommendations/RecommendationExplainer.js';

// Context-Aware Filter
export {
  ContextAwareFilter,
  createViewingContext,
  GENRE_IDS,
  type ViewingContext,
  type ContentCandidate,
} from './recommendations/ContextAwareFilter.js';

// Intent Parser (Novel implementation for media discovery)
export {
  createIntentParser,
  type IntentParser,
  type IntentType,
  type EntityType,
  type Entity,
  type IntentMetadata,
  type ParsedIntent,
  type Token,
} from './cognitive/IntentParser.js';

// Multi-Model Router (Novel implementation for cost optimization)
export {
  MultiModelRouter,
  createMultiModelRouter,
  type ModelProfile,
  type RoutingDecision,
  type TaskRequirements,
  type UsageStats,
  type PriorityMode,
} from './cognitive/MultiModelRouter.js';

// =============================================================================
// AgentDB Re-exports
// For full-featured cognitive memory with database persistence, vector search,
// and graph relationships, these come from the agentdb package.
// =============================================================================

// Re-export AgentDB controllers for cognitive memory
export {
  ReflexionMemory,
  type Episode as ReflexionEpisode,
  type EpisodeWithEmbedding,
  type ReflexionQuery,
} from 'agentdb/controllers/ReflexionMemory';

export {
  SkillLibrary,
  type Skill,
  type SkillLink,
  type SkillQuery,
} from 'agentdb/controllers/SkillLibrary';

// Additional AgentDB features for advanced use cases
export { EmbeddingService } from 'agentdb/controllers/EmbeddingService';
export { CausalMemoryGraph } from 'agentdb/controllers/CausalMemoryGraph';
export { ExplainableRecall } from 'agentdb/controllers/ExplainableRecall';
export { NightlyLearner } from 'agentdb/controllers/NightlyLearner';
export { HNSWIndex } from 'agentdb/controllers/HNSWIndex';
export { AttentionService } from 'agentdb/controllers/AttentionService';

/**
 * @media-gateway/agents
 *
 * Multi-agent system for media discovery
 * Uses collaborative AI agents with orchestration
 *
 * Architecture:
 * - Local agents: Domain-specific media discovery agents
 * - agentdb: Cognitive memory (ReflexionMemory, SkillLibrary, etc.)
 * - @media-gateway/database: RuVector for embeddings, AgentDB wrapper
 * - agentic-flow: Swarm coordination, neural training (via MCP)
 *
 * Novel implementations in this package:
 * - IntentParser: Media-specific query understanding
 * - MultiModelRouter: LLM selection with cost optimization
 * - ContentEmbeddingGenerator: Lightweight feature embeddings for Q-learning
 * - HybridRecommendationEngine: RRF fusion algorithm
 * - DiversityFilter: MMR algorithm
 * - LoRAPersonalizationEngine: LoRA adapters for personalization
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
// Package Integration Notes
// =============================================================================
//
// For production vector operations:
//   import { RuVectorWrapper, createRuVector } from '@media-gateway/database';
//   const ruvector = await createRuVector('./vectors.db');
//   const embedding = await ruvector.generateEmbedding('action movies');
//
// For cognitive memory (episode learning, skill consolidation):
//   import { ReflexionMemory } from 'agentdb/controllers/ReflexionMemory';
//   import { SkillLibrary } from 'agentdb/controllers/SkillLibrary';
//
// For lightweight feature embeddings (Q-learning, offline):
//   import { ContentEmbeddingGenerator } from '@media-gateway/agents';
//
// For LLM cost optimization:
//   import { MultiModelRouter, createMultiModelRouter } from '@media-gateway/agents';
//
// Note: AgentDB controllers are imported directly from agentdb package.
// See agentdb docs for: ReflexionMemory, SkillLibrary, CausalMemoryGraph,
// EmbeddingService, HNSWIndex, AttentionService, NightlyLearner, etc.
//

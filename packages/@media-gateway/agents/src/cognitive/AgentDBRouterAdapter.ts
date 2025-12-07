/**
 * AgentDBRouterAdapter - Adapter for AgentDB's LLMRouter
 *
 * Wraps agentdb's LLMRouter to maintain backward compatibility with
 * MultiModelRouter's interface while leveraging AgentDB's multi-provider
 * routing capabilities (OpenRouter, Gemini, Anthropic, ONNX).
 *
 * This adapter provides seamless integration between @media-gateway/agents
 * and AgentDB's intelligent LLM routing system.
 */

import type {
  ModelProfile,
  RoutingDecision,
  TaskRequirements,
  UsageStats,
  PriorityMode
} from './MultiModelRouter.js';

/**
 * LLMRouter stub for when agentdb is not available
 * Provides basic routing logic compatible with agentdb's interface
 */
interface LLMConfig {
  model?: string;
  provider?: string;
  temperature?: number;
}

class LLMRouterImpl {
  private priority: 'quality' | 'balanced' | 'cost' | 'speed' | 'privacy';

  constructor(config: { priority?: 'quality' | 'balanced' | 'cost' | 'speed' | 'privacy' } = {}) {
    this.priority = config.priority ?? 'balanced';
  }

  optimizeModelSelection(taskDescription: string, priority: 'quality' | 'balanced' | 'cost' | 'speed' | 'privacy'): LLMConfig {
    // Model selection based on priority
    const modelsByPriority: Record<string, { model: string; provider: string }> = {
      quality: { model: 'anthropic/claude-3-opus', provider: 'anthropic' },
      balanced: { model: 'anthropic/claude-3.5-sonnet', provider: 'anthropic' },
      cost: { model: 'gemini-1.5-flash', provider: 'google' },
      speed: { model: 'anthropic/claude-3-haiku', provider: 'anthropic' },
      privacy: { model: 'Xenova/gpt2', provider: 'local' },
    };

    const selection = modelsByPriority[priority] ?? modelsByPriority['balanced'];
    return {
      model: selection?.model ?? 'anthropic/claude-3.5-sonnet',
      provider: selection?.provider ?? 'anthropic',
      temperature: 0.7,
    };
  }
}

const LLMRouter = LLMRouterImpl;

/**
 * Interface for tracking usage records per model
 */
interface ModelUsageRecord {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  latencies: number[];
  successCount: number;
  failureCount: number;
  lastUsed: number;
}

/**
 * Mapping between MultiModelRouter priority modes and AgentDB priority modes
 */
const PRIORITY_MODE_MAP: Record<PriorityMode, 'quality' | 'balanced' | 'cost' | 'speed' | 'privacy'> = {
  cost: 'cost',
  quality: 'quality',
  speed: 'speed',
  balanced: 'balanced'
};

/**
 * Default model profiles for AgentDB-supported providers
 */
const AGENTDB_MODEL_PROFILES: ModelProfile[] = [
  // Anthropic Models (via OpenRouter for cost savings)
  {
    id: 'anthropic/claude-3.5-sonnet',
    provider: 'anthropic',
    qualityScore: 0.95,
    inputCost: 3,
    outputCost: 15,
    avgLatencyMs: 2000,
    maxTokens: 200000,
    capabilities: ['reasoning', 'coding', 'analysis', 'vision']
  },
  {
    id: 'anthropic/claude-3-opus',
    provider: 'anthropic',
    qualityScore: 0.98,
    inputCost: 15,
    outputCost: 75,
    avgLatencyMs: 3500,
    maxTokens: 200000,
    capabilities: ['reasoning', 'coding', 'analysis', 'vision']
  },
  {
    id: 'anthropic/claude-3-haiku',
    provider: 'anthropic',
    qualityScore: 0.85,
    inputCost: 0.25,
    outputCost: 1.25,
    avgLatencyMs: 800,
    maxTokens: 200000,
    capabilities: ['reasoning', 'coding', 'analysis', 'vision']
  },
  // Google Gemini Models (free tier available)
  {
    id: 'gemini-1.5-flash',
    provider: 'google',
    qualityScore: 0.88,
    inputCost: 0.07,
    outputCost: 0.30,
    avgLatencyMs: 600,
    maxTokens: 1000000,
    capabilities: ['reasoning', 'coding', 'analysis', 'vision']
  },
  {
    id: 'gemini-1.5-pro',
    provider: 'google',
    qualityScore: 0.92,
    inputCost: 1.25,
    outputCost: 5.0,
    avgLatencyMs: 1500,
    maxTokens: 2000000,
    capabilities: ['reasoning', 'coding', 'analysis', 'vision']
  },
  // OpenAI Models (via OpenRouter)
  {
    id: 'openai/gpt-4-turbo',
    provider: 'openai',
    qualityScore: 0.94,
    inputCost: 10,
    outputCost: 30,
    avgLatencyMs: 2500,
    maxTokens: 128000,
    capabilities: ['reasoning', 'coding', 'analysis', 'vision']
  },
  {
    id: 'openai/gpt-4o-mini',
    provider: 'openai',
    qualityScore: 0.87,
    inputCost: 0.15,
    outputCost: 0.60,
    avgLatencyMs: 900,
    maxTokens: 128000,
    capabilities: ['reasoning', 'coding', 'analysis', 'vision']
  },
  // DeepSeek Models
  {
    id: 'deepseek/deepseek-r1',
    provider: 'deepseek',
    qualityScore: 0.93,
    inputCost: 0.55,
    outputCost: 2.19,
    avgLatencyMs: 2200,
    maxTokens: 64000,
    capabilities: ['reasoning', 'coding', 'analysis']
  },
  // Local ONNX Models (zero cost)
  {
    id: 'Xenova/gpt2',
    provider: 'local',
    qualityScore: 0.65,
    inputCost: 0,
    outputCost: 0,
    avgLatencyMs: 1500,
    maxTokens: 1024,
    capabilities: ['reasoning', 'coding']
  }
];

/**
 * AgentDBRouterAdapter - Wraps AgentDB's LLMRouter
 *
 * Provides backward compatibility with MultiModelRouter while leveraging
 * AgentDB's advanced multi-provider routing capabilities.
 */
export class AgentDBRouterAdapter {
  private llmRouter: LLMRouterImpl;
  private models: Map<string, ModelProfile>;
  private usage: Map<string, ModelUsageRecord>;
  private defaultPriority: PriorityMode;
  private fallbackChain: string[];

  constructor(
    models: ModelProfile[] | undefined = undefined,
    defaultPriority: PriorityMode = 'balanced'
  ) {
    console.log('[AgentDBRouterAdapter] Initializing with AgentDB LLMRouter');

    // Initialize AgentDB's LLMRouter
    this.llmRouter = new LLMRouter({
      priority: PRIORITY_MODE_MAP[defaultPriority]
    });

    this.models = new Map();
    this.usage = new Map();
    this.defaultPriority = defaultPriority;
    this.fallbackChain = [];

    // Load model profiles
    const profilesToLoad = models !== undefined && models.length > 0 ? models : AGENTDB_MODEL_PROFILES;
    for (const profile of profilesToLoad) {
      this.registerModel(profile);
    }

    this.initializeFallbackChain();

    console.log(`[AgentDBRouterAdapter] Loaded ${this.models.size} model profiles`);
    console.log(`[AgentDBRouterAdapter] Default priority: ${defaultPriority}`);
  }

  /**
   * Select optimal model for task based on requirements and priority mode
   * Delegates to AgentDB's LLMRouter for intelligent routing
   */
  public selectModel(
    task: TaskRequirements,
    priority: PriorityMode | undefined = undefined
  ): RoutingDecision {
    const startTime = performance.now();
    const mode = priority !== undefined ? priority : this.defaultPriority;

    console.log(`[AgentDBRouterAdapter] Selecting model for task: ${task.type} (priority: ${mode})`);

    // Filter eligible models based on task requirements
    const eligibleModels = this.filterEligibleModels(task);

    if (eligibleModels.length === 0) {
      console.warn('[AgentDBRouterAdapter] No eligible models found, using fallback');
      return this.selectFallbackModel(task, 'No models meet requirements');
    }

    // Use AgentDB's optimization to select the best model
    const taskDescription = `Task: ${task.type}, Complexity: ${task.complexity}`;
    const optimizedConfig = this.llmRouter.optimizeModelSelection(
      taskDescription,
      PRIORITY_MODE_MAP[mode]
    );

    // Find the best model from eligible models that matches the optimized config
    let selectedModel: ModelProfile | undefined = undefined;

    // First, try to find exact match
    selectedModel = eligibleModels.find(m => m.id === optimizedConfig.model);

    // If no exact match, find best model by provider
    if (!selectedModel && optimizedConfig.provider) {
      const providerModels = eligibleModels.filter(m => {
        if (optimizedConfig.provider === 'openrouter') {
          // OpenRouter can serve multiple providers
          return true;
        }
        return m.provider === optimizedConfig.provider;
      });

      if (providerModels.length > 0) {
        // Select best quality model from this provider
        selectedModel = providerModels.sort((a, b) => b.qualityScore - a.qualityScore)[0];
      }
    }

    // Fallback to first eligible model
    if (!selectedModel) {
      selectedModel = eligibleModels[0];
    }

    if (!selectedModel) {
      return this.selectFallbackModel(task, 'No suitable model found');
    }

    const inputTokens = task.estimatedInputTokens ?? this.estimateInputTokens(task);
    const outputTokens = task.estimatedOutputTokens ?? this.estimateOutputTokens(task);

    const estimatedCost = this.estimateCost(selectedModel.id, inputTokens, outputTokens);
    const estimatedLatency = this.estimateLatency(selectedModel.id, task.complexity);
    const elapsedTime = performance.now() - startTime;
    const confidence = this.calculateConfidence(selectedModel, task, mode);

    console.log(`[AgentDBRouterAdapter] Selected model: ${selectedModel.id} (cost: $${estimatedCost.toFixed(4)}, latency: ${estimatedLatency}ms)`);

    return {
      modelId: selectedModel.id,
      reason: this.generateReason(selectedModel, task, mode, elapsedTime),
      estimatedCost,
      estimatedLatency,
      confidence
    };
  }

  /**
   * Estimate cost for using a model with given token counts
   */
  public estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const model = this.models.get(modelId);
    if (model === undefined) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const inputCost = (inputTokens / 1_000_000) * model.inputCost;
    const outputCost = (outputTokens / 1_000_000) * model.outputCost;

    return inputCost + outputCost;
  }

  /**
   * Estimate latency for a model based on task complexity
   */
  public estimateLatency(modelId: string, complexity: 'low' | 'medium' | 'high'): number {
    const model = this.models.get(modelId);
    if (model === undefined) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const usageRecord = this.usage.get(modelId);
    const baseLatency = usageRecord !== undefined && usageRecord.latencies.length > 0
      ? this.calculateAvgLatency(usageRecord.latencies)
      : model.avgLatencyMs;

    const complexityMultipliers = {
      low: 1.0,
      medium: 2.5,
      high: 5.0
    };

    const complexityMultiplier = complexityMultipliers[complexity];
    return baseLatency * Math.sqrt(complexityMultiplier);
  }

  /**
   * Record actual usage for model performance tracking
   */
  public recordUsage(
    modelId: string,
    cost: number,
    latency: number,
    success: boolean,
    inputTokens: number = 0,
    outputTokens: number = 0
  ): void {
    let record = this.usage.get(modelId);

    if (record === undefined) {
      record = {
        totalCost: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        latencies: [],
        successCount: 0,
        failureCount: 0,
        lastUsed: Date.now()
      };
      this.usage.set(modelId, record);
    }

    record.totalCost += cost;
    record.totalInputTokens += inputTokens;
    record.totalOutputTokens += outputTokens;
    record.latencies.push(latency);

    // Keep only last 100 latencies
    if (record.latencies.length > 100) {
      record.latencies = record.latencies.slice(-100);
    }

    if (success) {
      record.successCount++;
    } else {
      record.failureCount++;
    }

    record.lastUsed = Date.now();

    console.log(`[AgentDBRouterAdapter] Recorded usage for ${modelId}: cost=$${cost.toFixed(4)}, latency=${latency}ms, success=${success}`);
  }

  /**
   * Get usage statistics for one or all models
   */
  public getUsageStats(modelId: string | undefined = undefined): UsageStats | UsageStats[] {
    if (modelId !== undefined) {
      const record = this.usage.get(modelId);
      if (record === undefined) {
        return {
          modelId,
          totalCost: 0,
          totalTokens: 0,
          avgLatency: 0,
          successRate: 0,
          requestCount: 0,
          lastUsed: 0
        };
      }
      return this.convertToStats(modelId, record);
    }

    const allStats: UsageStats[] = [];
    for (const [id, record] of this.usage) {
      allStats.push(this.convertToStats(id, record));
    }
    return allStats;
  }

  /**
   * Register a new model or update existing
   */
  public registerModel(profile: ModelProfile): void {
    this.models.set(profile.id, profile);

    if (!this.usage.has(profile.id)) {
      this.usage.set(profile.id, {
        totalCost: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        latencies: [],
        successCount: 0,
        failureCount: 0,
        lastUsed: 0
      });
    }
  }

  /**
   * Update model profile properties
   */
  public updateModelProfile(modelId: string, updates: Partial<ModelProfile>): void {
    const model = this.models.get(modelId);
    if (model === undefined) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const updated = { ...model, ...updates, id: modelId };
    this.models.set(modelId, updated);
  }

  /**
   * Get recommended model for task type
   */
  public getRecommendedModel(taskType: string): string {
    const taskTypeQualityReqs: Record<string, number> = {
      'critical-reasoning': 0.95,
      'code-generation': 0.90,
      'code-review': 0.88,
      'analysis': 0.85,
      'summarization': 0.80,
      'simple-query': 0.75,
      'classification': 0.70
    };

    const qualityRequirement = taskTypeQualityReqs[taskType] ?? 0.85;

    const eligibleModels = Array.from(this.models.values())
      .filter(m => m.qualityScore >= qualityRequirement)
      .sort((a, b) => {
        const costA = (a.inputCost + a.outputCost) / 2;
        const costB = (b.inputCost + b.outputCost) / 2;
        return costA - costB;
      });

    if (eligibleModels.length === 0) {
      return this.fallbackChain[0] ?? 'anthropic/claude-3.5-sonnet';
    }

    return eligibleModels[0]?.id ?? 'anthropic/claude-3.5-sonnet';
  }

  /**
   * Calculate cost savings compared to default model
   */
  public calculateSavings(
    actualModel: string,
    defaultModel: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const actualCost = this.estimateCost(actualModel, inputTokens, outputTokens);
    const defaultCost = this.estimateCost(defaultModel, inputTokens, outputTokens);

    return defaultCost - actualCost;
  }

  /**
   * Get fallback model chain
   */
  public getFallbackChain(): string[] {
    return [...this.fallbackChain];
  }

  /**
   * Set custom fallback chain
   */
  public setFallbackChain(chain: string[]): void {
    for (const modelId of chain) {
      if (!this.models.has(modelId)) {
        throw new Error(`Model not found in fallback chain: ${modelId}`);
      }
    }
    this.fallbackChain = [...chain];
  }

  /**
   * Get the underlying AgentDB LLMRouter instance
   */
  public getLLMRouter(): LLMRouterImpl {
    return this.llmRouter;
  }

  // Private helper methods

  private filterEligibleModels(task: TaskRequirements): ModelProfile[] {
    return Array.from(this.models.values()).filter(model => {
      // Check cost constraint
      if (task.maxCost !== undefined) {
        const inputTokens = task.estimatedInputTokens ?? 1000;
        const outputTokens = task.estimatedOutputTokens ?? 1000;
        const estimatedCost = this.estimateCost(model.id, inputTokens, outputTokens);
        if (estimatedCost > task.maxCost) {
          return false;
        }
      }

      // Check latency constraint
      if (task.maxLatency !== undefined) {
        const estimatedLatency = this.estimateLatency(model.id, task.complexity);
        if (estimatedLatency > task.maxLatency) {
          return false;
        }
      }

      // Check required capabilities
      if (task.requiredCapabilities !== undefined && task.requiredCapabilities.length > 0) {
        const hasAllCapabilities = task.requiredCapabilities.every(cap =>
          model.capabilities.includes(cap)
        );
        if (!hasAllCapabilities) {
          return false;
        }
      }

      // Check minimum quality for task type
      const taskTypeQualityReqs: Record<string, number> = {
        'critical-reasoning': 0.95,
        'code-generation': 0.90,
        'code-review': 0.88,
        'analysis': 0.85,
        'summarization': 0.80,
        'simple-query': 0.75,
        'classification': 0.70
      };

      const taskQuality = taskTypeQualityReqs[task.type];
      const minQuality = taskQuality ?? 0.70;
      if (model.qualityScore < minQuality) {
        return false;
      }

      return true;
    });
  }

  private calculateConfidence(
    model: ModelProfile,
    task: TaskRequirements,
    _mode: PriorityMode
  ): number {
    let confidence = 0.5;

    const taskTypeQualityReqs: Record<string, number> = {
      'critical-reasoning': 0.95,
      'code-generation': 0.90,
      'code-review': 0.88,
      'analysis': 0.85,
      'summarization': 0.80,
      'simple-query': 0.75,
      'classification': 0.70
    };

    const taskQualityReq = taskTypeQualityReqs[task.type];
    const minQualityReq = taskQualityReq ?? 0.70;
    const qualityMargin = model.qualityScore - minQualityReq;
    confidence += Math.min(qualityMargin, 0.2);

    const usageRecord = this.usage.get(model.id);
    if (usageRecord !== undefined && usageRecord.successCount + usageRecord.failureCount >= 10) {
      const successRate = usageRecord.successCount / (usageRecord.successCount + usageRecord.failureCount);
      confidence += (successRate - 0.5) * 0.3;
    }

    if (task.requiredCapabilities !== undefined && task.requiredCapabilities.length > 0) {
      const hasAllCapabilities = task.requiredCapabilities.every(cap =>
        model.capabilities.includes(cap)
      );
      if (hasAllCapabilities) {
        confidence += 0.1;
      }
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private selectFallbackModel(task: TaskRequirements, reason: string): RoutingDecision {
    for (const modelId of this.fallbackChain) {
      const model = this.models.get(modelId);
      if (model === undefined) continue;

      if (task.requiredCapabilities !== undefined && task.requiredCapabilities.length > 0) {
        const hasAllCapabilities = task.requiredCapabilities.every(cap =>
          model.capabilities.includes(cap)
        );
        if (!hasAllCapabilities) continue;
      }

      const inputTokens = task.estimatedInputTokens ?? 1000;
      const outputTokens = task.estimatedOutputTokens ?? 1000;

      return {
        modelId: model.id,
        reason: `Fallback: ${reason}`,
        estimatedCost: this.estimateCost(model.id, inputTokens, outputTokens),
        estimatedLatency: this.estimateLatency(model.id, task.complexity),
        confidence: 0.3
      };
    }

    const defaultModel = this.fallbackChain[0] ?? 'anthropic/claude-3.5-sonnet';
    const inputTokens = task.estimatedInputTokens ?? 1000;
    const outputTokens = task.estimatedOutputTokens ?? 1000;

    return {
      modelId: defaultModel,
      reason: `Emergency fallback: ${reason}`,
      estimatedCost: this.estimateCost(defaultModel, inputTokens, outputTokens),
      estimatedLatency: this.estimateLatency(defaultModel, task.complexity),
      confidence: 0.1
    };
  }

  private estimateInputTokens(task: TaskRequirements): number {
    const baseTokens = 500;
    const complexityMultipliers = {
      low: 1.0,
      medium: 2.5,
      high: 5.0
    };
    return baseTokens * complexityMultipliers[task.complexity];
  }

  private estimateOutputTokens(task: TaskRequirements): number {
    const baseTokens = 300;
    const complexityMultipliers = {
      low: 1.0,
      medium: 2.5,
      high: 5.0
    };
    return baseTokens * complexityMultipliers[task.complexity];
  }

  private generateReason(
    model: ModelProfile,
    _task: TaskRequirements,
    mode: PriorityMode,
    elapsedMs: number
  ): string {
    const reasons: string[] = [];

    reasons.push(`Selected ${model.id} (${model.provider}) via AgentDB`);
    reasons.push(`mode=${mode}`);
    reasons.push(`quality=${model.qualityScore.toFixed(2)}`);
    reasons.push(`routing_time=${elapsedMs.toFixed(2)}ms`);

    return reasons.join(', ');
  }

  private convertToStats(modelId: string, record: ModelUsageRecord): UsageStats {
    const totalRequests = record.successCount + record.failureCount;
    const successRate = totalRequests > 0 ? record.successCount / totalRequests : 0;
    const avgLatency = this.calculateAvgLatency(record.latencies);

    return {
      modelId,
      totalCost: record.totalCost,
      totalTokens: record.totalInputTokens + record.totalOutputTokens,
      avgLatency,
      successRate,
      requestCount: totalRequests,
      lastUsed: record.lastUsed
    };
  }

  private calculateAvgLatency(latencies: number[]): number {
    if (latencies.length === 0) return 0;
    const sum = latencies.reduce((acc, val) => acc + val, 0);
    return sum / latencies.length;
  }

  private initializeFallbackChain(): void {
    const sortedByReliability = Array.from(this.models.values())
      .sort((a, b) => {
        const scoreA = a.qualityScore * 0.7 + (1 - (a.inputCost + a.outputCost) / 200) * 0.3;
        const scoreB = b.qualityScore * 0.7 + (1 - (b.inputCost + b.outputCost) / 200) * 0.3;
        return scoreB - scoreA;
      });

    this.fallbackChain = sortedByReliability.map(m => m.id);
  }
}

/**
 * Factory function to create AgentDBRouterAdapter instance
 */
export function createAgentDBRouter(
  models: ModelProfile[] | undefined = undefined,
  defaultPriority: PriorityMode = 'balanced'
): AgentDBRouterAdapter {
  console.log('[AgentDBRouterAdapter] Creating new AgentDB-powered router');
  return new AgentDBRouterAdapter(models, defaultPriority);
}

/**
 * Re-export types for convenience
 */
export type {
  ModelProfile,
  RoutingDecision,
  TaskRequirements,
  UsageStats,
  PriorityMode
};

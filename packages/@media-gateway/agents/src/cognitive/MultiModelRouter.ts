/**
 * MultiModelRouter - Intelligent LLM selection based on cost/quality/speed tradeoffs
 *
 * Routes tasks to optimal models with automatic fallback and cost tracking.
 * Target: <5ms routing decision time with 85-99% cost optimization.
 */

export interface ModelProfile {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'deepseek' | 'local';
  qualityScore: number; // 0-1 scale
  inputCost: number; // USD per 1M tokens
  outputCost: number; // USD per 1M tokens
  avgLatencyMs: number;
  maxTokens: number;
  capabilities: string[];
}

export interface RoutingDecision {
  modelId: string;
  reason: string;
  estimatedCost: number;
  estimatedLatency: number;
  confidence: number; // 0-1 scale
}

export interface TaskRequirements {
  type: string;
  complexity: 'low' | 'medium' | 'high';
  maxCost: number | undefined;
  maxLatency: number | undefined;
  requiredCapabilities: string[] | undefined;
  estimatedInputTokens: number | undefined;
  estimatedOutputTokens: number | undefined;
}

export interface UsageStats {
  modelId: string;
  totalCost: number;
  totalTokens: number;
  avgLatency: number;
  successRate: number;
  requestCount: number;
  lastUsed: number;
}

export type PriorityMode = 'cost' | 'quality' | 'speed' | 'balanced';

interface ModelUsageRecord {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  latencies: number[];
  successCount: number;
  failureCount: number;
  lastUsed: number;
}

interface ScoringWeights {
  quality: number;
  cost: number;
  speed: number;
}

const PRIORITY_WEIGHTS: Record<PriorityMode, ScoringWeights> = {
  cost: { quality: 0.1, cost: 0.8, speed: 0.1 },
  quality: { quality: 0.9, cost: 0.05, speed: 0.05 },
  speed: { quality: 0.1, cost: 0.1, speed: 0.8 },
  balanced: { quality: 0.4, cost: 0.35, speed: 0.25 }
};

const DEFAULT_MODEL_PROFILES: ModelProfile[] = [
  {
    id: 'claude-3-opus',
    provider: 'anthropic',
    qualityScore: 0.98,
    inputCost: 15,
    outputCost: 75,
    avgLatencyMs: 3500,
    maxTokens: 200000,
    capabilities: ['reasoning', 'coding', 'analysis', 'vision']
  },
  {
    id: 'claude-3-sonnet',
    provider: 'anthropic',
    qualityScore: 0.92,
    inputCost: 3,
    outputCost: 15,
    avgLatencyMs: 2000,
    maxTokens: 200000,
    capabilities: ['reasoning', 'coding', 'analysis', 'vision']
  },
  {
    id: 'claude-3-haiku',
    provider: 'anthropic',
    qualityScore: 0.85,
    inputCost: 0.25,
    outputCost: 1.25,
    avgLatencyMs: 800,
    maxTokens: 200000,
    capabilities: ['reasoning', 'coding', 'analysis', 'vision']
  },
  {
    id: 'gpt-4-turbo',
    provider: 'openai',
    qualityScore: 0.95,
    inputCost: 10,
    outputCost: 30,
    avgLatencyMs: 2500,
    maxTokens: 128000,
    capabilities: ['reasoning', 'coding', 'analysis', 'vision']
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    qualityScore: 0.88,
    inputCost: 0.15,
    outputCost: 0.60,
    avgLatencyMs: 900,
    maxTokens: 128000,
    capabilities: ['reasoning', 'coding', 'analysis', 'vision']
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'google',
    qualityScore: 0.90,
    inputCost: 0.07,
    outputCost: 0.30,
    avgLatencyMs: 600,
    maxTokens: 1000000,
    capabilities: ['reasoning', 'coding', 'analysis', 'vision']
  },
  {
    id: 'deepseek-r1',
    provider: 'deepseek',
    qualityScore: 0.94,
    inputCost: 0.55,
    outputCost: 2.19,
    avgLatencyMs: 2200,
    maxTokens: 64000,
    capabilities: ['reasoning', 'coding', 'analysis']
  },
  {
    id: 'local-phi4',
    provider: 'local',
    qualityScore: 0.75,
    inputCost: 0,
    outputCost: 0,
    avgLatencyMs: 1500,
    maxTokens: 16000,
    capabilities: ['reasoning', 'coding']
  }
];

const COMPLEXITY_TOKEN_MULTIPLIERS = {
  low: 1.0,
  medium: 2.5,
  high: 5.0
};

const TASK_TYPE_QUALITY_REQUIREMENTS: Record<string, number> = {
  'critical-reasoning': 0.95,
  'code-generation': 0.90,
  'code-review': 0.88,
  'analysis': 0.85,
  'summarization': 0.80,
  'simple-query': 0.75,
  'classification': 0.70
};

export class MultiModelRouter {
  private models: Map<string, ModelProfile>;
  private usage: Map<string, ModelUsageRecord>;
  private defaultPriority: PriorityMode;
  private fallbackChain: string[];

  constructor(
    models: ModelProfile[] | undefined = undefined,
    defaultPriority: PriorityMode = 'balanced'
  ) {
    this.models = new Map();
    this.usage = new Map();
    this.defaultPriority = defaultPriority;
    this.fallbackChain = [];

    const profilesToLoad = models !== undefined && models.length > 0 ? models : DEFAULT_MODEL_PROFILES;
    for (const profile of profilesToLoad) {
      this.registerModel(profile);
    }

    this.initializeFallbackChain();
  }

  /**
   * Select optimal model for task based on requirements and priority mode
   */
  public selectModel(
    task: TaskRequirements,
    priority: PriorityMode | undefined = undefined
  ): RoutingDecision {
    const startTime = performance.now();
    const mode = priority !== undefined ? priority : this.defaultPriority;

    const eligibleModels = this.filterEligibleModels(task);

    if (eligibleModels.length === 0) {
      return this.selectFallbackModel(task, 'No models meet requirements');
    }

    const inputTokens = task.estimatedInputTokens !== undefined ? task.estimatedInputTokens : this.estimateInputTokens(task);
    const outputTokens = task.estimatedOutputTokens !== undefined ? task.estimatedOutputTokens : this.estimateOutputTokens(task);

    let bestModel: ModelProfile | undefined = undefined;
    let bestScore = -Infinity;
    let bestCost = 0;
    let bestLatency = 0;

    for (const model of eligibleModels) {
      const score = this.calculateModelScore(model, task, mode, inputTokens, outputTokens);

      if (score > bestScore) {
        bestScore = score;
        bestModel = model;
        bestCost = this.estimateCost(model.id, inputTokens, outputTokens);
        bestLatency = this.estimateLatency(model.id, task.complexity);
      }
    }

    if (bestModel === undefined) {
      return this.selectFallbackModel(task, 'No suitable model found');
    }

    const elapsedTime = performance.now() - startTime;
    const confidence = this.calculateConfidence(bestModel, task, mode);

    return {
      modelId: bestModel.id,
      reason: this.generateReason(bestModel, task, mode, elapsedTime),
      estimatedCost: bestCost,
      estimatedLatency: bestLatency,
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

    const complexityMultiplier = COMPLEXITY_TOKEN_MULTIPLIERS[complexity];
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

    if (record.latencies.length > 100) {
      record.latencies = record.latencies.slice(-100);
    }

    if (success) {
      record.successCount++;
    } else {
      record.failureCount++;
    }

    record.lastUsed = Date.now();
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
    const qualityRequirement = TASK_TYPE_QUALITY_REQUIREMENTS[taskType] !== undefined
      ? TASK_TYPE_QUALITY_REQUIREMENTS[taskType]
      : 0.85;

    const eligibleModels = Array.from(this.models.values())
      .filter(m => m.qualityScore >= qualityRequirement)
      .sort((a, b) => {
        const costA = (a.inputCost + a.outputCost) / 2;
        const costB = (b.inputCost + b.outputCost) / 2;
        return costA - costB;
      });

    if (eligibleModels.length === 0) {
      return this.fallbackChain[0] !== undefined ? this.fallbackChain[0] : 'claude-3-sonnet';
    }

    const firstModel = eligibleModels[0];
    return firstModel !== undefined ? firstModel.id : 'claude-3-sonnet';
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

  private filterEligibleModels(task: TaskRequirements): ModelProfile[] {
    return Array.from(this.models.values()).filter(model => {
      if (task.maxCost !== undefined) {
        const inputTokens = task.estimatedInputTokens !== undefined ? task.estimatedInputTokens : 1000;
        const outputTokens = task.estimatedOutputTokens !== undefined ? task.estimatedOutputTokens : 1000;
        const estimatedCost = this.estimateCost(model.id, inputTokens, outputTokens);
        if (estimatedCost > task.maxCost) {
          return false;
        }
      }

      if (task.maxLatency !== undefined) {
        const estimatedLatency = this.estimateLatency(model.id, task.complexity);
        if (estimatedLatency > task.maxLatency) {
          return false;
        }
      }

      if (task.requiredCapabilities !== undefined && task.requiredCapabilities.length > 0) {
        const hasAllCapabilities = task.requiredCapabilities.every(cap =>
          model.capabilities.includes(cap)
        );
        if (!hasAllCapabilities) {
          return false;
        }
      }

      const taskQuality = TASK_TYPE_QUALITY_REQUIREMENTS[task.type];
      const minQuality = taskQuality !== undefined ? taskQuality : 0.70;
      if (model.qualityScore < minQuality) {
        return false;
      }

      return true;
    });
  }

  private calculateModelScore(
    model: ModelProfile,
    task: TaskRequirements,
    mode: PriorityMode,
    inputTokens: number,
    outputTokens: number
  ): number {
    const weights = PRIORITY_WEIGHTS[mode];

    const qualityScore = model.qualityScore;

    const estimatedCost = this.estimateCost(model.id, inputTokens, outputTokens);
    const maxCost = 1.0;
    const costScore = 1 - Math.min(estimatedCost / maxCost, 1);

    const estimatedLatency = this.estimateLatency(model.id, task.complexity);
    const maxLatency = 5000;
    const speedScore = 1 - Math.min(estimatedLatency / maxLatency, 1);

    const usageRecord = this.usage.get(model.id);
    const computedSuccessRate = usageRecord !== undefined && usageRecord.successCount + usageRecord.failureCount > 0
      ? usageRecord.successCount / (usageRecord.successCount + usageRecord.failureCount)
      : 0;
    const successBonus = usageRecord !== undefined && usageRecord.successCount > 0
      ? Math.min(computedSuccessRate * 0.1, 0.1)
      : 0;

    const score = (
      weights.quality * qualityScore +
      weights.cost * costScore +
      weights.speed * speedScore +
      successBonus
    );

    return score;
  }

  private calculateConfidence(
    model: ModelProfile,
    task: TaskRequirements,
    _mode: PriorityMode
  ): number {
    let confidence = 0.5;

    const taskQualityReq = TASK_TYPE_QUALITY_REQUIREMENTS[task.type];
    const minQualityReq = taskQualityReq !== undefined ? taskQualityReq : 0.70;
    const qualityMargin = model.qualityScore - minQualityReq;
    confidence += Math.min(qualityMargin, 0.2);

    const usageRecord = this.usage.get(model.id);
    if (usageRecord !== undefined && usageRecord.successCount + usageRecord.failureCount >= 10) {
      const computedRate = usageRecord.successCount / (usageRecord.successCount + usageRecord.failureCount);
      confidence += (computedRate - 0.5) * 0.3;
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

      const inputTokens = task.estimatedInputTokens !== undefined ? task.estimatedInputTokens : 1000;
      const outputTokens = task.estimatedOutputTokens !== undefined ? task.estimatedOutputTokens : 1000;

      return {
        modelId: model.id,
        reason: `Fallback: ${reason}`,
        estimatedCost: this.estimateCost(model.id, inputTokens, outputTokens),
        estimatedLatency: this.estimateLatency(model.id, task.complexity),
        confidence: 0.3
      };
    }

    const defaultModel = this.fallbackChain[0] !== undefined ? this.fallbackChain[0] : 'claude-3-sonnet';
    const inputTokens = task.estimatedInputTokens !== undefined ? task.estimatedInputTokens : 1000;
    const outputTokens = task.estimatedOutputTokens !== undefined ? task.estimatedOutputTokens : 1000;

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
    return baseTokens * COMPLEXITY_TOKEN_MULTIPLIERS[task.complexity];
  }

  private estimateOutputTokens(task: TaskRequirements): number {
    const baseTokens = 300;
    return baseTokens * COMPLEXITY_TOKEN_MULTIPLIERS[task.complexity];
  }

  private generateReason(
    model: ModelProfile,
    _task: TaskRequirements,
    mode: PriorityMode,
    elapsedMs: number
  ): string {
    const reasons: string[] = [];

    reasons.push(`Selected ${model.id} (${model.provider})`);
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
 * Factory function to create MultiModelRouter instance
 */
export function createMultiModelRouter(
  models: ModelProfile[] | undefined = undefined,
  defaultPriority: PriorityMode = 'balanced'
): MultiModelRouter {
  return new MultiModelRouter(models, defaultPriority);
}

/**
 * Calculate success rate from usage record
 */
Object.defineProperty(Object.getPrototypeOf({}), 'successRate', {
  get(this: ModelUsageRecord): number {
    const total = this.successCount + this.failureCount;
    return total > 0 ? this.successCount / total : 0;
  },
  enumerable: false,
  configurable: true
});

declare global {
  interface ModelUsageRecord {
    readonly successRate: number;
  }
}

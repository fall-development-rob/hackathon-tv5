/**
 * LoRAPersonalization + ReasoningBank Integration Tests
 *
 * Tests the adaptive learning capabilities when ReasoningBank is integrated.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LoRAPersonalizationEngine,
  createLoRAPersonalizationEngine,
  createAdapterFeedback,
  type UserLoRAAdapter,
} from '../LoRAPersonalization';
import type { WatchEvent } from '@media-gateway/core';

// Mock ReasoningBank implementation for testing
class MockReasoningBank {
  private patterns: any[] = [];
  private nextId = 1;

  async storePattern(pattern: any): Promise<number> {
    const id = this.nextId++;
    this.patterns.push({ id, ...pattern });
    return id;
  }

  async retrievePatterns(query: string, options: any = {}): Promise<any[]> {
    let results = this.patterns.filter((p) =>
      p.task.toLowerCase().includes(query.toLowerCase())
    );

    if (options.onlySuccesses) {
      results = results.filter((p) => p.success);
    }
    if (options.minReward) {
      results = results.filter((p) => p.reward >= options.minReward);
    }

    return results.slice(0, options.k || 5);
  }

  async learnStrategy(task: string): Promise<any> {
    const relevantPatterns = await this.retrievePatterns(task, {
      k: 10,
      onlySuccesses: true,
    });

    // Simulate strategy learning
    const avgReward =
      relevantPatterns.length > 0
        ? relevantPatterns.reduce((sum, p) => sum + p.reward, 0) /
          relevantPatterns.length
        : 0.5;

    let recommendation = 'Default recommendation';
    if (avgReward < 0.6) {
      recommendation = 'Reduce learning rate to 0.0005 for better convergence';
    } else if (avgReward > 0.9) {
      recommendation = 'Increase learning rate to 0.002 for faster training';
    }

    return {
      patterns: relevantPatterns,
      causality: {
        recommendation: 'EWC regularization helps prevent catastrophic forgetting',
      },
      confidence: avgReward,
      recommendation,
    };
  }

  async autoConsolidate(
    minUses?: number,
    minSuccessRate?: number,
    lookbackDays?: number
  ): Promise<{ skillsCreated: number }> {
    const successfulPatterns = this.patterns.filter(
      (p) => p.success && p.reward >= (minSuccessRate || 0.8)
    );

    // Group patterns by task and count occurrences
    const taskCounts = new Map<string, number>();
    for (const pattern of successfulPatterns) {
      taskCounts.set(pattern.task, (taskCounts.get(pattern.task) || 0) + 1);
    }

    // Create skills from frequently used patterns
    const skillsCreated = Array.from(taskCounts.values()).filter(
      (count) => count >= (minUses || 3)
    ).length;

    return { skillsCreated };
  }

  // Test helper: get all patterns
  getAllPatterns(): any[] {
    return [...this.patterns];
  }

  // Test helper: reset patterns
  reset(): void {
    this.patterns = [];
    this.nextId = 1;
  }
}

describe('LoRAPersonalizationEngine + ReasoningBank Integration', () => {
  let engine: LoRAPersonalizationEngine;
  let reasoningBank: MockReasoningBank;
  let adapter: UserLoRAAdapter;

  beforeEach(() => {
    reasoningBank = new MockReasoningBank();
    engine = createLoRAPersonalizationEngine({
      rank: 4,
      embeddingDim: 64,
      learningRate: 0.001,
      reasoningBank: reasoningBank as any,
      enableReasoningBankCache: true,
    });

    adapter = engine.createAdapter('test-user-001');
  });

  describe('Basic Integration', () => {
    it('should create engine without ReasoningBank', () => {
      const engineWithoutRB = createLoRAPersonalizationEngine();
      expect(engineWithoutRB.hasReasoningBank()).toBe(false);
    });

    it('should create engine with ReasoningBank', () => {
      expect(engine.hasReasoningBank()).toBe(true);
    });

    it('should connect ReasoningBank after creation', () => {
      const engineWithoutRB = createLoRAPersonalizationEngine();
      expect(engineWithoutRB.hasReasoningBank()).toBe(false);

      engineWithoutRB.connectReasoningBank(reasoningBank as any);
      expect(engineWithoutRB.hasReasoningBank()).toBe(true);
    });

    it('should disconnect ReasoningBank', () => {
      expect(engine.hasReasoningBank()).toBe(true);
      engine.disconnectReasoningBank();
      expect(engine.hasReasoningBank()).toBe(false);
    });
  });

  describe('Adapter Update with ReasoningBank', () => {
    it('should store training episode to ReasoningBank', async () => {
      const watchEvent: WatchEvent = {
        userId: 'test-user-001',
        contentId: 123,
        timestamp: new Date(),
        completionRate: 0.8,
        rating: 4,
        isRewatch: false,
        watchDurationSeconds: 3600,
        deviceType: 'web',
      };

      const baseEmbedding = new Float32Array(64).fill(0.5);
      const feedback = [createAdapterFeedback(watchEvent, baseEmbedding)];

      const updatedAdapter = await engine.updateAdapter(adapter, feedback);

      expect(updatedAdapter.version).toBe(adapter.version + 1);

      // Check that pattern was stored
      const patterns = reasoningBank.getAllPatterns();
      expect(patterns.length).toBeGreaterThan(0);

      const storedPattern = patterns[0];
      expect(storedPattern.task).toContain('lora_adaptation');
      expect(storedPattern.task).toContain('test-user-001');
      expect(storedPattern.success).toBeDefined();
      expect(storedPattern.reward).toBeGreaterThanOrEqual(0);
      expect(storedPattern.reward).toBeLessThanOrEqual(1);
    });

    it('should apply ReasoningBank learning rate hints', async () => {
      // First, create a few successful adaptations with low reward
      // to trigger learning rate reduction
      for (let i = 0; i < 5; i++) {
        await reasoningBank.storePattern({
          sessionId: 'test-session',
          task: `lora_adaptation_user_test-user-001_rank_4_samples_1`,
          success: true,
          reward: 0.5, // Low reward to trigger learning rate reduction
        });
      }

      const watchEvent: WatchEvent = {
        userId: 'test-user-001',
        contentId: 456,
        timestamp: new Date(),
        completionRate: 0.9,
        rating: 5,
        isRewatch: false,
        watchDurationSeconds: 3600,
        deviceType: 'web',
      };

      const baseEmbedding = new Float32Array(64).fill(0.5);
      const feedback = [createAdapterFeedback(watchEvent, baseEmbedding)];

      // Spy on console.log to check for ReasoningBank hints
      const consoleSpy = vi.spyOn(console, 'log');

      const updatedAdapter = await engine.updateAdapter(adapter, feedback);

      expect(updatedAdapter).toBeDefined();

      // Check that ReasoningBank was queried and hints were applied
      const logCalls = consoleSpy.mock.calls.map((call) => call.join(' '));
      const hasReasoningBankLogs = logCalls.some(
        (log) =>
          log.includes('ReasoningBank') ||
          log.includes('Adjusted learning rate') ||
          log.includes('Strategy confidence')
      );

      expect(hasReasoningBankLogs).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should cache ReasoningBank queries for performance', async () => {
      const watchEvent: WatchEvent = {
        userId: 'test-user-001',
        contentId: 789,
        timestamp: new Date(),
        completionRate: 0.85,
        rating: 4,
        isRewatch: false,
        watchDurationSeconds: 3600,
        deviceType: 'web',
      };

      const baseEmbedding = new Float32Array(64).fill(0.5);
      const feedback = [createAdapterFeedback(watchEvent, baseEmbedding)];

      // First update (should query ReasoningBank)
      await engine.updateAdapter(adapter, feedback);

      const stats1 = engine.getReasoningBankStats();
      const cacheSize1 = stats1.cacheSize;

      // Second update with same parameters (should use cache)
      const adapter2 = await engine.updateAdapter(adapter, feedback);

      const stats2 = engine.getReasoningBankStats();
      const cacheSize2 = stats2.cacheSize;

      expect(adapter2).toBeDefined();
      expect(cacheSize2).toBeGreaterThanOrEqual(cacheSize1);
    });

    it('should work without ReasoningBank (graceful degradation)', async () => {
      const engineWithoutRB = createLoRAPersonalizationEngine({
        rank: 4,
        embeddingDim: 64,
      });

      const adapterWithoutRB = engineWithoutRB.createAdapter('test-user-002');

      const watchEvent: WatchEvent = {
        userId: 'test-user-002',
        contentId: 999,
        timestamp: new Date(),
        completionRate: 0.75,
        rating: 3,
        isRewatch: false,
        watchDurationSeconds: 3600,
        deviceType: 'web',
      };

      const baseEmbedding = new Float32Array(64).fill(0.5);
      const feedback = [createAdapterFeedback(watchEvent, baseEmbedding)];

      // Should work fine without ReasoningBank
      const updatedAdapter = await engineWithoutRB.updateAdapter(
        adapterWithoutRB,
        feedback
      );

      expect(updatedAdapter.version).toBe(adapterWithoutRB.version + 1);
    });
  });

  describe('Pattern Consolidation', () => {
    it('should consolidate successful adaptation patterns', async () => {
      // Create multiple successful adaptations
      for (let i = 0; i < 10; i++) {
        await reasoningBank.storePattern({
          sessionId: 'test-session',
          task: 'lora_adaptation_user_test-user-001_rank_4_samples_1',
          success: true,
          reward: 0.9,
        });
      }

      const result = await engine.consolidateAdaptationPatterns(0.85, 3, 30);

      expect(result).not.toBeNull();
      expect(result!.skillsCreated).toBeGreaterThan(0);
    });

    it('should return null when ReasoningBank not available', async () => {
      const engineWithoutRB = createLoRAPersonalizationEngine();
      const result = await engineWithoutRB.consolidateAdaptationPatterns();

      expect(result).toBeNull();
    });
  });

  describe('Similar Adaptations Retrieval', () => {
    it('should retrieve similar successful adaptations', async () => {
      // Store some successful adaptations
      for (let i = 0; i < 5; i++) {
        await reasoningBank.storePattern({
          sessionId: 'test-session',
          task: `lora_adaptation_user_test-user-001_rank_4_samples_${i + 1}`,
          input: JSON.stringify({
            userId: 'test-user-001',
            rank: 4,
            learningRate: 0.001,
          }),
          output: JSON.stringify({
            avgLoss: 0.1,
          }),
          success: true,
          reward: 0.85 + i * 0.02,
        });
      }

      const similarAdaptations = await engine.getSimilarAdaptations(
        'test-user-001',
        5
      );

      expect(similarAdaptations).not.toBeNull();
      expect(similarAdaptations!.length).toBeGreaterThan(0);
      expect(similarAdaptations![0].userId).toBe('test-user-001');
      expect(similarAdaptations![0].rank).toBe(4);
    });

    it('should return null when ReasoningBank not available', async () => {
      const engineWithoutRB = createLoRAPersonalizationEngine();
      const result = await engineWithoutRB.getSimilarAdaptations(
        'test-user-001'
      );

      expect(result).toBeNull();
    });
  });

  describe('Cache Management', () => {
    it('should track cache statistics', () => {
      const stats = engine.getReasoningBankStats();

      expect(stats.enabled).toBe(true);
      expect(stats.sessionId).toBeDefined();
      expect(stats.cacheSize).toBe(0); // Initially empty
    });

    it('should clear cache', async () => {
      // Populate cache
      const watchEvent: WatchEvent = {
        userId: 'test-user-001',
        contentId: 111,
        timestamp: new Date(),
        completionRate: 0.8,
        rating: 4,
        isRewatch: false,
        watchDurationSeconds: 3600,
        deviceType: 'web',
      };

      const baseEmbedding = new Float32Array(64).fill(0.5);
      const feedback = [createAdapterFeedback(watchEvent, baseEmbedding)];
      await engine.updateAdapter(adapter, feedback);

      const stats1 = engine.getReasoningBankStats();
      const cacheSize1 = stats1.cacheSize;

      // Clear cache
      engine.clearReasoningBankCache();

      const stats2 = engine.getReasoningBankStats();
      expect(stats2.cacheSize).toBe(0);
      expect(stats2.cacheSize).toBeLessThanOrEqual(cacheSize1);
    });
  });

  describe('Configuration', () => {
    it('should include ReasoningBank in configuration', () => {
      const config = engine.getConfig();

      expect(config.reasoningBank).toBeDefined();
      expect(config.enableReasoningBankCache).toBe(true);
    });

    it('should support disabling cache', () => {
      const engineNoCache = createLoRAPersonalizationEngine({
        reasoningBank: reasoningBank as any,
        enableReasoningBankCache: false,
      });

      const config = engineNoCache.getConfig();
      expect(config.enableReasoningBankCache).toBe(false);
    });
  });
});

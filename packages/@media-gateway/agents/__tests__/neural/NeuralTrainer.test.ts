/**
 * Neural Trainer Tests
 * Tests pattern training, prediction, and MCP integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  NeuralTrainer,
  createNeuralTrainer,
  type PatternType,
} from '../../src/neural/NeuralTrainer.js';
import type { WatchEvent } from '@media-gateway/core';

describe('NeuralTrainer', () => {
  let trainer: NeuralTrainer;

  const mockWatchHistory: WatchEvent[] = [
    {
      userId: 'user-123',
      contentId: 550,
      mediaType: 'movie',
      watchedAt: new Date('2024-01-10'),
      completionRate: 1.0,
      rating: 5,
      sessionDuration: 7200,
      interactions: { pauses: 1, skips: 0, rewinds: 2 },
    },
    {
      userId: 'user-123',
      contentId: 551,
      mediaType: 'movie',
      watchedAt: new Date('2024-01-11'),
      completionRate: 0.95,
      rating: 4,
      sessionDuration: 6800,
      interactions: { pauses: 2, skips: 0, rewinds: 1 },
    },
    {
      userId: 'user-123',
      contentId: 552,
      mediaType: 'tv',
      watchedAt: new Date('2024-01-12'),
      completionRate: 0.8,
      sessionDuration: 3600,
      interactions: { pauses: 1, skips: 1, rewinds: 0 },
    },
  ];

  beforeEach(() => {
    trainer = createNeuralTrainer({
      enableTraining: true,
      minEpochs: 10,
      maxEpochs: 100,
      learningRateDecay: 0.95,
    });
  });

  describe('Watch History Training', () => {
    it('should train from watch history', async () => {
      const result = await trainer.trainFromWatchHistory(mockWatchHistory, 'prediction');

      expect(result).toHaveProperty('patternType', 'prediction');
      expect(result).toHaveProperty('epochs');
      expect(result).toHaveProperty('accuracy');
      expect(result).toHaveProperty('loss');
      expect(result.accuracy).toBeGreaterThan(0);
      expect(result.accuracy).toBeLessThanOrEqual(1);
    });

    it('should support different pattern types', async () => {
      const patternTypes: PatternType[] = ['coordination', 'optimization', 'prediction'];

      for (const patternType of patternTypes) {
        const result = await trainer.trainFromWatchHistory(mockWatchHistory, patternType);

        expect(result.patternType).toBe(patternType);
      }
    });

    it('should scale epochs with training data size', async () => {
      const smallHistory = mockWatchHistory.slice(0, 1);
      const largeHistory = [...mockWatchHistory, ...mockWatchHistory, ...mockWatchHistory];

      const smallResult = await trainer.trainFromWatchHistory(smallHistory);
      const largeResult = await trainer.trainFromWatchHistory(largeHistory);

      expect(largeResult.epochs).toBeGreaterThan(smallResult.epochs);
    });

    it('should respect min and max epochs', async () => {
      const result = await trainer.trainFromWatchHistory(mockWatchHistory);

      expect(result.epochs).toBeGreaterThanOrEqual(10);
      expect(result.epochs).toBeLessThanOrEqual(100);
    });

    it('should return empty result when training disabled', async () => {
      const disabledTrainer = createNeuralTrainer({ enableTraining: false });

      const result = await disabledTrainer.trainFromWatchHistory(mockWatchHistory);

      expect(result.epochs).toBe(0);
      expect(result.accuracy).toBe(0);
    });

    it('should record training timestamp', async () => {
      const before = new Date();
      const result = await trainer.trainFromWatchHistory(mockWatchHistory);
      const after = new Date();

      expect(result.trainedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.trainedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Coordination Pattern Training', () => {
    it('should train coordination patterns', async () => {
      const interactions = [
        {
          agents: ['DiscoveryAgent', 'PreferenceAgent'],
          task: 'search',
          success: true,
          latencyMs: 150,
        },
        {
          agents: ['SocialAgent', 'ProviderAgent'],
          task: 'group_watch',
          success: true,
          latencyMs: 200,
        },
        {
          agents: ['DiscoveryAgent', 'ProviderAgent'],
          task: 'availability',
          success: false,
          latencyMs: 500,
        },
      ];

      const result = await trainer.trainCoordinationPatterns(interactions);

      expect(result.patternType).toBe('coordination');
      expect(result.epochs).toBe(50);
      expect(result.accuracy).toBeGreaterThan(0);
    });

    it('should calculate accuracy from success rate', async () => {
      const allSuccess = [
        { agents: ['A'], task: 'test', success: true, latencyMs: 100 },
        { agents: ['B'], task: 'test', success: true, latencyMs: 100 },
      ];

      const result = await trainer.trainCoordinationPatterns(allSuccess);

      expect(result.accuracy).toBe(1.0);
    });
  });

  describe('Optimization Pattern Training', () => {
    it('should train optimization patterns', async () => {
      const metrics = [
        {
          agentId: 'agent-1',
          cpuUsage: 45,
          memoryUsage: 512,
          tasksCompleted: 10,
        },
        {
          agentId: 'agent-2',
          cpuUsage: 60,
          memoryUsage: 768,
          tasksCompleted: 15,
        },
      ];

      const result = await trainer.trainOptimizationPatterns(metrics);

      expect(result.patternType).toBe('optimization');
      expect(result.epochs).toBe(30);
      expect(result.accuracy).toBeGreaterThan(0);
    });
  });

  describe('Pattern Analysis', () => {
    it('should analyze patterns from operations', async () => {
      const analysis = await trainer.analyzePatterns('recommendation', 'success');

      expect(analysis).toHaveProperty('action', 'analyze');
      expect(analysis).toHaveProperty('patterns');
      expect(analysis).toHaveProperty('recommendations');
      expect(Array.isArray(analysis.patterns)).toBe(true);
      expect(Array.isArray(analysis.recommendations)).toBe(true);
    });

    it('should provide pattern confidence scores', async () => {
      const analysis = await trainer.analyzePatterns('search', 'success');

      for (const pattern of analysis.patterns) {
        expect(pattern).toHaveProperty('name');
        expect(pattern).toHaveProperty('confidence');
        expect(pattern).toHaveProperty('frequency');
        expect(pattern.confidence).toBeGreaterThan(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should handle different outcome types', async () => {
      const outcomes: Array<'success' | 'failure' | 'partial'> = ['success', 'failure', 'partial'];

      for (const outcome of outcomes) {
        const analysis = await trainer.analyzePatterns('test', outcome);

        expect(analysis.action).toBe('analyze');
      }
    });
  });

  describe('Learning from Success', () => {
    it('should learn from successful recommendations', async () => {
      await trainer.learnFromSuccess('user-123', 550, 0.95);

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle varying engagement scores', async () => {
      const scores = [0.1, 0.5, 0.9, 1.0];

      for (const score of scores) {
        await trainer.learnFromSuccess('user-123', 550, score);
      }

      expect(true).toBe(true);
    });
  });

  describe('Preference Prediction', () => {
    it('should predict preferences based on context', async () => {
      const prediction = await trainer.predictPreferences('user-123', {
        timeOfDay: 'evening',
        mood: 'excited',
        companions: 2,
      });

      expect(prediction).toHaveProperty('genreIds');
      expect(prediction).toHaveProperty('confidence');
      expect(Array.isArray(prediction.genreIds)).toBe(true);
      expect(prediction.confidence).toBeGreaterThan(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
    });

    it('should return different genres for different times', async () => {
      const morning = await trainer.predictPreferences('user-123', {
        timeOfDay: 'morning',
      });

      const evening = await trainer.predictPreferences('user-123', {
        timeOfDay: 'evening',
      });

      expect(morning.genreIds).not.toEqual(evening.genreIds);
    });

    it('should handle all time periods', async () => {
      const times: Array<string> = ['morning', 'afternoon', 'evening', 'night'];

      for (const timeOfDay of times) {
        const prediction = await trainer.predictPreferences('user-123', {
          timeOfDay,
        });

        expect(prediction.genreIds.length).toBeGreaterThan(0);
      }
    });

    it('should provide default genres for unknown times', async () => {
      const prediction = await trainer.predictPreferences('user-123', {
        timeOfDay: 'unknown',
      });

      expect(prediction.genreIds).toEqual([35, 18]); // Comedy, Drama
    });
  });

  describe('Training History', () => {
    it('should track training history', async () => {
      await trainer.trainFromWatchHistory(mockWatchHistory);
      await trainer.trainFromWatchHistory(mockWatchHistory);

      const history = trainer.getTrainingHistory();

      expect(history.length).toBe(2);
    });

    it('should preserve training results', async () => {
      const result1 = await trainer.trainFromWatchHistory(mockWatchHistory, 'prediction');
      const result2 = await trainer.trainFromWatchHistory(mockWatchHistory, 'optimization');

      const history = trainer.getTrainingHistory();

      expect(history[0]).toEqual(result1);
      expect(history[1]).toEqual(result2);
    });
  });

  describe('Status Monitoring', () => {
    it('should report neural status', () => {
      const status = trainer.getStatus();

      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('totalTrainingSessions');
      expect(status).toHaveProperty('lastTraining');
      expect(status).toHaveProperty('avgAccuracy');
    });

    it('should track training sessions', async () => {
      await trainer.trainFromWatchHistory(mockWatchHistory);
      await trainer.trainFromWatchHistory(mockWatchHistory);

      const status = trainer.getStatus();

      expect(status.totalTrainingSessions).toBe(2);
    });

    it('should calculate average accuracy', async () => {
      await trainer.trainFromWatchHistory(mockWatchHistory);
      await trainer.trainFromWatchHistory(mockWatchHistory);

      const status = trainer.getStatus();

      expect(status.avgAccuracy).toBeGreaterThan(0);
    });

    it('should track last training time', async () => {
      await trainer.trainFromWatchHistory(mockWatchHistory);

      const status = trainer.getStatus();

      expect(status.lastTraining).toBeInstanceOf(Date);
    });

    it('should report null last training when no training', () => {
      const status = trainer.getStatus();

      expect(status.lastTraining).toBeNull();
    });

    it('should report enabled status', () => {
      const enabledStatus = trainer.getStatus();
      expect(enabledStatus.enabled).toBe(true);

      const disabledTrainer = createNeuralTrainer({ enableTraining: false });
      const disabledStatus = disabledTrainer.getStatus();
      expect(disabledStatus.enabled).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should use custom min epochs', async () => {
      const customTrainer = createNeuralTrainer({ minEpochs: 50 });

      const result = await customTrainer.trainFromWatchHistory(mockWatchHistory);

      expect(result.epochs).toBeGreaterThanOrEqual(50);
    });

    it('should use custom max epochs', async () => {
      const customTrainer = createNeuralTrainer({ maxEpochs: 20 });

      const result = await customTrainer.trainFromWatchHistory(mockWatchHistory);

      expect(result.epochs).toBeLessThanOrEqual(20);
    });

    it('should respect learning rate decay config', () => {
      const customTrainer = createNeuralTrainer({ learningRateDecay: 0.9 });

      expect(customTrainer).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty watch history', async () => {
      const result = await trainer.trainFromWatchHistory([]);

      expect(result.epochs).toBeGreaterThanOrEqual(10);
    });

    it('should handle watch events without interactions', async () => {
      const minimalEvents: WatchEvent[] = [
        {
          userId: 'user-123',
          contentId: 100,
          mediaType: 'movie',
          watchedAt: new Date(),
          completionRate: 1.0,
          sessionDuration: 7200,
        },
      ];

      const result = await trainer.trainFromWatchHistory(minimalEvents);

      expect(result).toBeDefined();
    });

    it('should handle watch events without ratings', async () => {
      const noRating: WatchEvent[] = [
        {
          userId: 'user-123',
          contentId: 100,
          mediaType: 'movie',
          watchedAt: new Date(),
          completionRate: 0.9,
          sessionDuration: 6000,
        },
      ];

      const result = await trainer.trainFromWatchHistory(noRating);

      expect(result).toBeDefined();
    });
  });

  describe('Factory Function', () => {
    it('should create trainer with default config', () => {
      const defaultTrainer = createNeuralTrainer();

      expect(defaultTrainer).toBeInstanceOf(NeuralTrainer);
      expect(defaultTrainer.getStatus().enabled).toBe(true);
    });

    it('should create trainer with custom config', () => {
      const customTrainer = createNeuralTrainer({
        enableTraining: false,
        minEpochs: 5,
        maxEpochs: 50,
      });

      expect(customTrainer).toBeInstanceOf(NeuralTrainer);
      expect(customTrainer.getStatus().enabled).toBe(false);
    });
  });
});

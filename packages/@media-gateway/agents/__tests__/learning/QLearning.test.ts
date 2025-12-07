/**
 * Q-Learning Tests
 * Tests Q-value updates, action selection, training convergence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  QLearning,
  createQLearning,
  createExperience,
  type QState,
  type QAction,
  type Experience,
  type EngagementMetrics,
  type UserContext,
} from '../../src/learning/QLearning.js';

describe('QLearning', () => {
  let learner: QLearning;

  const mockUserContext: UserContext = {
    currentTime: new Date('2024-01-15T20:00:00'),
    recentWatches: [
      { genre: 'action', completionRate: 95, rating: 5, timestamp: new Date() },
      { genre: 'action', completionRate: 100, rating: 4, timestamp: new Date() },
      { genre: 'comedy', completionRate: 80, timestamp: new Date() },
    ],
    sessionHistory: 10,
  };

  beforeEach(() => {
    learner = createQLearning({
      learningRate: 0.1,
      discountFactor: 0.95,
      initialEpsilon: 0.3,
      minEpsilon: 0.05,
      epsilonDecay: 0.995,
      replayBufferSize: 1000,
      batchSize: 32,
    });
  });

  describe('State Generation', () => {
    it('should generate state from user context', () => {
      const state = learner.getState('user-123', mockUserContext);

      expect(state).toHaveProperty('timeOfDay');
      expect(state).toHaveProperty('dayType');
      expect(state).toHaveProperty('recentGenres');
      expect(state).toHaveProperty('avgCompletionRate');
      expect(state).toHaveProperty('sessionCount');
    });

    it('should determine time of day correctly', () => {
      const contexts = [
        { currentTime: new Date('2024-01-15T08:00:00'), expected: 'morning' },
        { currentTime: new Date('2024-01-15T14:00:00'), expected: 'afternoon' },
        { currentTime: new Date('2024-01-15T19:00:00'), expected: 'evening' },
        { currentTime: new Date('2024-01-15T23:00:00'), expected: 'night' },
      ];

      for (const { currentTime, expected } of contexts) {
        const state = learner.getState('user-123', { currentTime });
        expect(state.timeOfDay).toBe(expected);
      }
    });

    it('should determine day type correctly', () => {
      const weekday = new Date('2024-01-15T20:00:00'); // Monday
      const weekend = new Date('2024-01-20T20:00:00'); // Saturday

      const weekdayState = learner.getState('user-123', { currentTime: weekday });
      const weekendState = learner.getState('user-123', { currentTime: weekend });

      expect(weekdayState.dayType).toBe('weekday');
      expect(weekendState.dayType).toBe('weekend');
    });

    it('should extract top 3 recent genres', () => {
      const state = learner.getState('user-123', mockUserContext);

      expect(state.recentGenres).toHaveLength(3);
      expect(state.recentGenres[0]).toBe('action'); // Most frequent
    });

    it('should pad genres if less than 3', () => {
      const context: UserContext = {
        recentWatches: [{ genre: 'action', completionRate: 100, timestamp: new Date() }],
      };

      const state = learner.getState('user-123', context);

      expect(state.recentGenres).toHaveLength(3);
      expect(state.recentGenres[0]).toBe('action');
      expect(state.recentGenres[1]).toBe('unknown');
    });

    it('should calculate average completion rate', () => {
      const state = learner.getState('user-123', mockUserContext);

      expect(state.avgCompletionRate).toBeCloseTo(91, 0); // (95+100+80)/3 ≈ 92
    });

    it('should handle empty watch history', () => {
      const state = learner.getState('user-123', {});

      expect(state.avgCompletionRate).toBe(0);
      expect(state.sessionCount).toBe(0);
    });
  });

  describe('Action Selection', () => {
    it('should select action using epsilon-greedy', () => {
      const state = learner.getState('user-123', mockUserContext);

      const action = learner.selectAction(state);

      expect(action).toBeDefined();
      expect(typeof action).toBe('string');
    });

    it('should explore with probability epsilon', () => {
      const state = learner.getState('user-123', mockUserContext);
      const actions = new Set<QAction>();

      // Run multiple times to test exploration
      for (let i = 0; i < 100; i++) {
        const action = learner.selectAction(state, true);
        actions.add(action);
      }

      // Should have tried multiple actions due to exploration
      expect(actions.size).toBeGreaterThan(1);
    });

    it('should exploit when explore=false', () => {
      const state = learner.getState('user-123', mockUserContext);

      // Train to establish best action
      for (let i = 0; i < 10; i++) {
        learner.updateQValue(state, 'recommend_similar', 0.9, state);
      }

      const action = learner.selectAction(state, false);

      expect(action).toBe('recommend_similar');
    });

    it('should choose best action from Q-table', () => {
      const state = learner.getState('user-123', mockUserContext);

      // Set up Q-values
      learner.updateQValue(state, 'recommend_similar', 0.9, state);
      learner.updateQValue(state, 'recommend_genre', 0.5, state);

      const epsilon = learner.getEpsilon();
      // Temporarily set epsilon to 0 for deterministic exploitation
      vi.spyOn(learner as any, 'epsilon', 'get').mockReturnValue(0);

      const action = learner.selectAction(state, true);

      expect(action).toBe('recommend_similar');
    });
  });

  describe('Q-Value Updates', () => {
    it('should update Q-values using Bellman equation', () => {
      const state = learner.getState('user-123', mockUserContext);
      const nextState = learner.getState('user-123', mockUserContext);

      const initialQ = learner.getQValue(state, 'recommend_similar');

      learner.updateQValue(state, 'recommend_similar', 0.8, nextState);

      const updatedQ = learner.getQValue(state, 'recommend_similar');

      expect(updatedQ).not.toBe(initialQ);
    });

    it('should increase Q-value with positive reward', () => {
      const state = learner.getState('user-123', mockUserContext);

      const initialQ = learner.getQValue(state, 'recommend_similar');

      for (let i = 0; i < 10; i++) {
        learner.updateQValue(state, 'recommend_similar', 1.0, state);
      }

      const finalQ = learner.getQValue(state, 'recommend_similar');

      expect(finalQ).toBeGreaterThan(initialQ);
    });

    it('should decrease Q-value with negative reward', () => {
      const state = learner.getState('user-123', mockUserContext);

      // First establish a positive Q-value
      learner.updateQValue(state, 'recommend_similar', 1.0, state);
      const initialQ = learner.getQValue(state, 'recommend_similar');

      // Then apply negative rewards
      for (let i = 0; i < 10; i++) {
        learner.updateQValue(state, 'recommend_similar', 0.0, state);
      }

      const finalQ = learner.getQValue(state, 'recommend_similar');

      expect(finalQ).toBeLessThan(initialQ);
    });

    it('should learn from future rewards (temporal difference)', () => {
      const state1 = learner.getState('user-123', mockUserContext);
      const state2 = learner.getState('user-123', {
        ...mockUserContext,
        sessionHistory: 11,
      });

      // Set high Q-value for next state
      learner.updateQValue(state2, 'recommend_similar', 1.0, state2);

      // Update current state
      learner.updateQValue(state1, 'recommend_similar', 0.5, state2);

      const q1 = learner.getQValue(state1, 'recommend_similar');

      // Should be influenced by future reward
      expect(q1).toBeGreaterThan(0);
    });

    it('should get all Q-values for a state', () => {
      const state = learner.getState('user-123', mockUserContext);

      learner.updateQValue(state, 'recommend_similar', 0.8, state);
      learner.updateQValue(state, 'recommend_genre', 0.6, state);

      const qValues = learner.getStateQValues(state);

      expect(qValues instanceof Map).toBe(true);
      expect(qValues.size).toBeGreaterThan(0);
    });
  });

  describe('Reward Calculation', () => {
    it('should calculate reward from engagement metrics', () => {
      const metrics: EngagementMetrics = {
        completionRate: 100,
        userRating: 5,
        rewindCount: 2,
        skipCount: 0,
      };

      const reward = learner.calculateReward(metrics);

      expect(reward).toBeGreaterThan(0);
      expect(reward).toBeLessThanOrEqual(1.0);
    });

    it('should weight completion rate at 50%', () => {
      const fullCompletion: EngagementMetrics = {
        completionRate: 100,
      };

      const reward = learner.calculateReward(fullCompletion);

      expect(reward).toBeCloseTo(0.5, 1);
    });

    it('should weight rating at 30%', () => {
      const perfectRating: EngagementMetrics = {
        completionRate: 0,
        userRating: 5,
      };

      const reward = learner.calculateReward(perfectRating);

      expect(reward).toBeCloseTo(0.3, 1);
    });

    it('should boost reward for rewinds', () => {
      const withRewinds: EngagementMetrics = {
        completionRate: 50,
        rewindCount: 5,
      };

      const withoutRewinds: EngagementMetrics = {
        completionRate: 50,
      };

      const rewardWith = learner.calculateReward(withRewinds);
      const rewardWithout = learner.calculateReward(withoutRewinds);

      expect(rewardWith).toBeGreaterThan(rewardWithout);
    });

    it('should penalize reward for skips', () => {
      const withSkips: EngagementMetrics = {
        completionRate: 50,
        skipCount: 5,
      };

      const withoutSkips: EngagementMetrics = {
        completionRate: 50,
      };

      const rewardWith = learner.calculateReward(withSkips);
      const rewardWithout = learner.calculateReward(withoutSkips);

      expect(rewardWith).toBeLessThan(rewardWithout);
    });

    it('should clamp reward between 0 and 1', () => {
      const extreme: EngagementMetrics = {
        completionRate: 100,
        userRating: 5,
        rewindCount: 100,
        skipCount: 0,
      };

      const reward = learner.calculateReward(extreme);

      expect(reward).toBeLessThanOrEqual(1.0);
      expect(reward).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Experience Replay', () => {
    it('should add experiences to replay buffer', () => {
      const experience: Experience = {
        state: learner.getState('user-123', mockUserContext),
        action: 'recommend_similar',
        reward: 0.8,
        nextState: learner.getState('user-123', mockUserContext),
        timestamp: Date.now(),
      };

      learner.addExperience(experience);

      expect(learner.getExperienceCount()).toBe(1);
    });

    it('should train from experience batch', () => {
      const experiences: Experience[] = [];
      const state = learner.getState('user-123', mockUserContext);

      for (let i = 0; i < 10; i++) {
        experiences.push({
          state,
          action: 'recommend_similar',
          reward: 0.8,
          nextState: state,
          timestamp: Date.now(),
        });
      }

      learner.train(experiences);

      expect(learner.getExperienceCount()).toBeGreaterThan(0);
    });

    it('should limit replay buffer size', () => {
      const smallLearner = createQLearning({ replayBufferSize: 10 });

      for (let i = 0; i < 20; i++) {
        smallLearner.addExperience({
          state: smallLearner.getState('user-123', {}),
          action: 'recommend_similar',
          reward: 0.5,
          nextState: smallLearner.getState('user-123', {}),
          timestamp: Date.now(),
        });
      }

      expect(smallLearner.getExperienceCount()).toBeLessThanOrEqual(10);
    });

    it('should decay epsilon during training', () => {
      const initialEpsilon = learner.getEpsilon();

      const experiences: Experience[] = [];
      const state = learner.getState('user-123', {});

      for (let i = 0; i < 10; i++) {
        experiences.push({
          state,
          action: 'recommend_similar',
          reward: 0.5,
          nextState: state,
          timestamp: Date.now(),
        });
      }

      learner.train(experiences);

      expect(learner.getEpsilon()).toBeLessThan(initialEpsilon);
    });

    it('should respect minimum epsilon', () => {
      const experiences: Experience[] = [];
      const state = learner.getState('user-123', {});

      for (let i = 0; i < 1000; i++) {
        experiences.push({
          state,
          action: 'recommend_similar',
          reward: 0.5,
          nextState: state,
          timestamp: Date.now(),
        });
        learner.train([experiences[experiences.length - 1]]);
      }

      expect(learner.getEpsilon()).toBeGreaterThanOrEqual(0.05);
    });
  });

  describe('Convergence', () => {
    it('should converge to optimal policy with training', () => {
      const state = learner.getState('user-123', mockUserContext);
      const experiences: Experience[] = [];

      // Simulate successful recommendations
      for (let i = 0; i < 100; i++) {
        experiences.push({
          state,
          action: 'recommend_similar',
          reward: 0.9,
          nextState: state,
          timestamp: Date.now(),
        });
      }

      learner.train(experiences);

      const strategy = learner.getRecommendationStrategy(state);

      expect(strategy).toBe('recommend_similar');
    });

    it('should learn different strategies for different contexts', () => {
      const morningState = learner.getState('user-123', {
        currentTime: new Date('2024-01-15T08:00:00'),
      });
      const eveningState = learner.getState('user-123', {
        currentTime: new Date('2024-01-15T20:00:00'),
      });

      // Train morning preference
      for (let i = 0; i < 50; i++) {
        learner.updateQValue(morningState, 'recommend_continue', 0.9, morningState);
      }

      // Train evening preference
      for (let i = 0; i < 50; i++) {
        learner.updateQValue(eveningState, 'recommend_trending', 0.9, eveningState);
      }

      const morningStrategy = learner.getRecommendationStrategy(morningState);
      const eveningStrategy = learner.getRecommendationStrategy(eveningState);

      expect(morningStrategy).toBe('recommend_continue');
      expect(eveningStrategy).toBe('recommend_trending');
    });
  });

  describe('Model Persistence', () => {
    it('should save model to JSON', () => {
      const state = learner.getState('user-123', mockUserContext);
      learner.updateQValue(state, 'recommend_similar', 0.8, state);

      const modelJson = learner.saveModel();

      expect(typeof modelJson).toBe('string');
      expect(JSON.parse(modelJson)).toHaveProperty('qTable');
      expect(JSON.parse(modelJson)).toHaveProperty('epsilon');
    });

    it('should load model from JSON', () => {
      const state = learner.getState('user-123', mockUserContext);
      learner.updateQValue(state, 'recommend_similar', 0.8, state);

      const modelJson = learner.saveModel();
      const newLearner = createQLearning();
      newLearner.loadModel(modelJson);

      const qValue = newLearner.getQValue(state, 'recommend_similar');

      expect(qValue).toBeCloseTo(learner.getQValue(state, 'recommend_similar'), 5);
    });

    it('should handle invalid model JSON', () => {
      expect(() => {
        learner.loadModel('invalid json');
      }).toThrow();
    });
  });

  describe('Statistics', () => {
    it('should track Q-table size', () => {
      const state1 = learner.getState('user-123', mockUserContext);
      const state2 = learner.getState('user-456', mockUserContext);

      learner.updateQValue(state1, 'recommend_similar', 0.5, state1);
      learner.updateQValue(state2, 'recommend_genre', 0.6, state2);

      expect(learner.getStateCount()).toBeGreaterThan(0);
    });

    it('should track experience count', () => {
      learner.addExperience({
        state: learner.getState('user-123', {}),
        action: 'recommend_similar',
        reward: 0.5,
        nextState: learner.getState('user-123', {}),
        timestamp: Date.now(),
      });

      expect(learner.getExperienceCount()).toBe(1);
    });
  });

  describe('Reset', () => {
    it('should reset learning state', () => {
      const state = learner.getState('user-123', mockUserContext);
      learner.updateQValue(state, 'recommend_similar', 0.8, state);
      learner.addExperience({
        state,
        action: 'recommend_similar',
        reward: 0.8,
        nextState: state,
        timestamp: Date.now(),
      });

      learner.reset();

      expect(learner.getStateCount()).toBe(0);
      expect(learner.getExperienceCount()).toBe(0);
      expect(learner.getEpsilon()).toBe(0.3);
    });
  });

  describe('Helper Functions', () => {
    it('should create experience from user interaction', () => {
      const previousState = learner.getState('user-123', mockUserContext);
      const metrics: EngagementMetrics = {
        completionRate: 95,
        userRating: 5,
      };

      const experience = createExperience(
        'user-123',
        previousState,
        'recommend_similar',
        metrics,
        mockUserContext,
        learner
      );

      expect(experience).toHaveProperty('state');
      expect(experience).toHaveProperty('action');
      expect(experience).toHaveProperty('reward');
      expect(experience).toHaveProperty('nextState');
      expect(experience.reward).toBeGreaterThan(0);
    });
  });

  describe('Factory Function', () => {
    it('should create learner with default config', () => {
      const defaultLearner = createQLearning();

      expect(defaultLearner).toBeInstanceOf(QLearning);
    });

    it('should create learner with custom config', () => {
      const customLearner = createQLearning({
        learningRate: 0.2,
        discountFactor: 0.9,
      });

      expect(customLearner).toBeDefined();
    });
  });
});

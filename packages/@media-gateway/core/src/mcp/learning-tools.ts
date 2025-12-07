/**
 * Q-Learning MCP Tools for Media Gateway
 * Inspired by Samsung TV Integration patterns from hackathon-tv5
 *
 * Implements reinforcement learning for recommendation strategy optimization
 * @see https://github.com/agenticsorg/hackathon-tv5
 */

import type { WatchEvent, MediaContent, UserPreferences } from '../types/index.js';

// ============================================================================
// Q-Learning State & Action Types
// ============================================================================

export interface LearningState {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayType: 'weekday' | 'weekend';
  recentGenres: string[];
  avgCompletionRate: number;
  sessionCount: number;
  mood: string | undefined;
}

export type RecommendationAction =
  | 'recommend_similar'
  | 'recommend_trending'
  | 'recommend_genre'
  | 'recommend_diverse'
  | 'recommend_classic'
  | 'recommend_new_release'
  | 'recommend_social'
  | 'recommend_mood_based';

export interface QTableEntry {
  stateHash: string;
  action: RecommendationAction;
  qValue: number;
  visits: number;
  lastUpdated: Date;
}

export interface LearningSession {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  actions: Array<{
    action: RecommendationAction;
    contentId: number;
    reward: number;
    timestamp: Date;
  }>;
  totalReward: number;
}

export interface LearnerStats {
  totalEpisodes: number;
  totalReward: number;
  avgReward: number;
  actionDistribution: Record<RecommendationAction, number>;
  explorationRate: number;
  learningProgress: number;
}

// ============================================================================
// Q-Learning Engine
// ============================================================================

export class QLearningEngine {
  private qTable: Map<string, QTableEntry> = new Map();
  private sessions: Map<string, LearningSession> = new Map();
  private experiences: Array<{
    state: LearningState;
    action: RecommendationAction;
    reward: number;
    nextState: LearningState;
  }> = [];

  // Hyperparameters (matching hackathon-tv5 patterns)
  private learningRate = 0.1; // α
  private discountFactor = 0.95; // γ
  private explorationRate = 0.3; // ε (initial)
  private explorationDecay = 0.995;
  private minExplorationRate = 0.05;

  private totalEpisodes = 0;
  private totalReward = 0;

  /**
   * Hash state to string for Q-table lookup
   */
  private hashState(state: LearningState): string {
    return `${state.timeOfDay}_${state.dayType}_${state.recentGenres.slice(0, 3).join(',')}_${Math.round(state.avgCompletionRate * 10)}`;
  }

  /**
   * Get Q-value for state-action pair
   */
  getQValue(state: LearningState, action: RecommendationAction): number {
    const key = `${this.hashState(state)}:${action}`;
    return this.qTable.get(key)?.qValue ?? 0;
  }

  /**
   * Update Q-value using temporal difference learning
   */
  updateQValue(
    state: LearningState,
    action: RecommendationAction,
    reward: number,
    nextState: LearningState
  ): void {
    const stateHash = this.hashState(state);
    const key = `${stateHash}:${action}`;

    const currentQ = this.getQValue(state, action);
    const maxNextQ = this.getMaxQValue(nextState);

    // TD Update: Q(s,a) = Q(s,a) + α * (r + γ * max(Q(s',a')) - Q(s,a))
    const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);

    const existing = this.qTable.get(key);
    this.qTable.set(key, {
      stateHash,
      action,
      qValue: newQ,
      visits: (existing?.visits ?? 0) + 1,
      lastUpdated: new Date(),
    });

    // Store experience for replay
    this.experiences.push({ state, action, reward, nextState });
    if (this.experiences.length > 10000) {
      this.experiences.shift(); // Keep buffer bounded
    }
  }

  /**
   * Get maximum Q-value for a state (across all actions)
   */
  private getMaxQValue(state: LearningState): number {
    const actions: RecommendationAction[] = [
      'recommend_similar',
      'recommend_trending',
      'recommend_genre',
      'recommend_diverse',
      'recommend_classic',
      'recommend_new_release',
      'recommend_social',
      'recommend_mood_based',
    ];

    return Math.max(...actions.map(a => this.getQValue(state, a)));
  }

  /**
   * Select action using ε-greedy policy
   */
  selectAction(state: LearningState): RecommendationAction {
    const actions: RecommendationAction[] = [
      'recommend_similar',
      'recommend_trending',
      'recommend_genre',
      'recommend_diverse',
      'recommend_classic',
      'recommend_new_release',
      'recommend_social',
      'recommend_mood_based',
    ];

    // Explore with probability ε
    if (Math.random() < this.explorationRate) {
      return actions[Math.floor(Math.random() * actions.length)]!;
    }

    // Exploit: choose best action
    let bestAction = actions[0]!;
    let bestQ = this.getQValue(state, bestAction);

    for (const action of actions.slice(1)) {
      const q = this.getQValue(state, action);
      if (q > bestQ) {
        bestQ = q;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Calculate reward from watch event
   * Weighted: completion (0.5) + rating (0.3) + engagement (0.2)
   */
  calculateReward(event: WatchEvent): number {
    let reward = 0;

    // Completion rate (0-0.5)
    reward += event.completionRate * 0.5;

    // Explicit rating if provided (0-0.3)
    if (event.rating !== undefined) {
      reward += (event.rating / 10) * 0.3;
    } else if (event.completionRate > 0.8) {
      // Infer positive rating from high completion
      reward += 0.15;
    }

    // Engagement: rewatch bonus (0-0.2)
    if (event.isRewatch) {
      reward += 0.2;
    } else {
      // Duration-based engagement
      const durationRatio = Math.min(event.duration / event.totalDuration, 1);
      reward += durationRatio * 0.2;
    }

    return Math.min(reward, 1);
  }

  /**
   * Start a new learning session
   */
  startSession(userId: string): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.sessions.set(sessionId, {
      sessionId,
      userId,
      startTime: new Date(),
      actions: [],
      totalReward: 0,
    });
    return sessionId;
  }

  /**
   * Record an action in a session
   */
  recordAction(
    sessionId: string,
    action: RecommendationAction,
    contentId: number,
    reward: number
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.actions.push({
        action,
        contentId,
        reward,
        timestamp: new Date(),
      });
      session.totalReward += reward;
    }
  }

  /**
   * End a session and trigger learning
   */
  endSession(sessionId: string): LearningSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.endTime = new Date();
    this.totalEpisodes++;
    this.totalReward += session.totalReward;

    // Decay exploration rate
    this.explorationRate = Math.max(
      this.minExplorationRate,
      this.explorationRate * this.explorationDecay
    );

    return session;
  }

  /**
   * Train on experience replay buffer
   */
  train(batchSize: number = 32): { episodesTrained: number; avgLoss: number } {
    if (this.experiences.length === 0) {
      return { episodesTrained: 0, avgLoss: 0 };
    }

    const sampleSize = Math.min(batchSize, this.experiences.length);
    const samples: typeof this.experiences = [];

    // Random sampling from experience buffer
    for (let i = 0; i < sampleSize; i++) {
      const idx = Math.floor(Math.random() * this.experiences.length);
      samples.push(this.experiences[idx]!);
    }

    let totalLoss = 0;
    for (const exp of samples) {
      const oldQ = this.getQValue(exp.state, exp.action);
      this.updateQValue(exp.state, exp.action, exp.reward, exp.nextState);
      const newQ = this.getQValue(exp.state, exp.action);
      totalLoss += Math.abs(newQ - oldQ);
    }

    return {
      episodesTrained: sampleSize,
      avgLoss: totalLoss / sampleSize,
    };
  }

  /**
   * Get learner statistics
   */
  getStats(): LearnerStats {
    const actionDistribution: Record<RecommendationAction, number> = {
      recommend_similar: 0,
      recommend_trending: 0,
      recommend_genre: 0,
      recommend_diverse: 0,
      recommend_classic: 0,
      recommend_new_release: 0,
      recommend_social: 0,
      recommend_mood_based: 0,
    };

    for (const entry of this.qTable.values()) {
      actionDistribution[entry.action] += entry.visits;
    }

    return {
      totalEpisodes: this.totalEpisodes,
      totalReward: this.totalReward,
      avgReward: this.totalEpisodes > 0 ? this.totalReward / this.totalEpisodes : 0,
      actionDistribution,
      explorationRate: this.explorationRate,
      learningProgress: Math.min(this.totalEpisodes / 1000, 1), // Progress to "trained"
    };
  }

  /**
   * Get learned preferences for a user
   */
  getLearnedPreferences(): {
    topStrategies: Array<{ action: RecommendationAction; avgQ: number }>;
    explorationRate: number;
    trainingProgress: number;
  } {
    const actionScores: Record<RecommendationAction, { total: number; count: number }> = {
      recommend_similar: { total: 0, count: 0 },
      recommend_trending: { total: 0, count: 0 },
      recommend_genre: { total: 0, count: 0 },
      recommend_diverse: { total: 0, count: 0 },
      recommend_classic: { total: 0, count: 0 },
      recommend_new_release: { total: 0, count: 0 },
      recommend_social: { total: 0, count: 0 },
      recommend_mood_based: { total: 0, count: 0 },
    };

    for (const entry of this.qTable.values()) {
      actionScores[entry.action].total += entry.qValue;
      actionScores[entry.action].count++;
    }

    const topStrategies = Object.entries(actionScores)
      .map(([action, { total, count }]) => ({
        action: action as RecommendationAction,
        avgQ: count > 0 ? total / count : 0,
      }))
      .sort((a, b) => b.avgQ - a.avgQ);

    return {
      topStrategies,
      explorationRate: this.explorationRate,
      trainingProgress: Math.min(this.totalEpisodes / 1000, 1),
    };
  }

  /**
   * Export model state for persistence
   */
  exportModel(): {
    qTable: Array<QTableEntry>;
    hyperparameters: {
      learningRate: number;
      discountFactor: number;
      explorationRate: number;
    };
    stats: LearnerStats;
  } {
    return {
      qTable: Array.from(this.qTable.values()),
      hyperparameters: {
        learningRate: this.learningRate,
        discountFactor: this.discountFactor,
        explorationRate: this.explorationRate,
      },
      stats: this.getStats(),
    };
  }

  /**
   * Import model state from persistence
   */
  importModel(data: ReturnType<typeof this.exportModel>): void {
    this.qTable.clear();
    for (const entry of data.qTable) {
      const key = `${entry.stateHash}:${entry.action}`;
      this.qTable.set(key, entry);
    }
    this.learningRate = data.hyperparameters.learningRate;
    this.discountFactor = data.hyperparameters.discountFactor;
    this.explorationRate = data.hyperparameters.explorationRate;
    this.totalEpisodes = data.stats.totalEpisodes;
    this.totalReward = data.stats.totalReward;
  }

  /**
   * Clear all learned data
   */
  clear(): void {
    this.qTable.clear();
    this.sessions.clear();
    this.experiences = [];
    this.totalEpisodes = 0;
    this.totalReward = 0;
    this.explorationRate = 0.3;
  }
}

// ============================================================================
// MCP Tool Definitions for Learning
// ============================================================================

export const learningTools = [
  {
    name: 'learn_start_session',
    description: 'Start a new learning session to track user interactions and improve recommendations. Returns a session ID to use with other learning tools.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'User ID to track learning for' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'learn_record_watch',
    description: 'Record a watch event to the learning system. This trains the recommendation engine to understand user preferences.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Active learning session ID' },
        content_id: { type: 'number', description: 'Content that was watched' },
        duration_seconds: { type: 'number', description: 'How long they watched' },
        total_duration_seconds: { type: 'number', description: 'Total content duration' },
        rating: { type: 'number', description: 'Explicit rating (1-10) if provided' },
        action_taken: {
          type: 'string',
          enum: [
            'recommend_similar',
            'recommend_trending',
            'recommend_genre',
            'recommend_diverse',
            'recommend_classic',
            'recommend_new_release',
            'recommend_social',
            'recommend_mood_based',
          ],
          description: 'Which recommendation strategy led to this selection',
        },
      },
      required: ['session_id', 'content_id', 'duration_seconds', 'total_duration_seconds', 'action_taken'],
    },
  },
  {
    name: 'learn_end_session',
    description: 'End a learning session and trigger model update. Returns session summary with rewards.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Session ID to end' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'learn_select_strategy',
    description: 'Let the AI select the optimal recommendation strategy for the current context using learned Q-values.',
    inputSchema: {
      type: 'object',
      properties: {
        time_of_day: {
          type: 'string',
          enum: ['morning', 'afternoon', 'evening', 'night'],
          description: 'Current time of day',
        },
        day_type: {
          type: 'string',
          enum: ['weekday', 'weekend'],
          description: 'Type of day',
        },
        recent_genres: {
          type: 'array',
          items: { type: 'string' },
          description: 'Recently watched genres',
        },
        avg_completion_rate: {
          type: 'number',
          description: 'Average completion rate (0-1)',
        },
        mood: { type: 'string', description: 'Current mood if known' },
      },
      required: ['time_of_day', 'day_type'],
    },
  },
  {
    name: 'learn_train',
    description: 'Trigger training on experience replay buffer. Call periodically to improve the model.',
    inputSchema: {
      type: 'object',
      properties: {
        batch_size: { type: 'number', description: 'Number of experiences to train on', default: 32 },
      },
    },
  },
  {
    name: 'learn_get_stats',
    description: 'Get statistics about the learning system including total episodes, average reward, and action distribution.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'learn_get_preferences',
    description: 'Get learned recommendation strategy preferences. Shows which strategies work best.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'learn_export_model',
    description: 'Export the learned Q-table and hyperparameters for persistence or transfer.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'learn_import_model',
    description: 'Import a previously exported model state.',
    inputSchema: {
      type: 'object',
      properties: {
        model_data: { type: 'object', description: 'Exported model data from learn_export_model' },
      },
      required: ['model_data'],
    },
  },
  {
    name: 'learn_clear',
    description: 'Clear all learned data and reset the model to initial state.',
    inputSchema: {
      type: 'object',
      properties: {
        confirm: { type: 'boolean', description: 'Must be true to confirm clearing' },
      },
      required: ['confirm'],
    },
  },
];

// Singleton instance
export const qLearningEngine = new QLearningEngine();

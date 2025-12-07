/**
 * Q-Learning Preference Learning System
 *
 * Implements reinforcement learning for personalized content recommendations
 * using Q-Learning algorithm with experience replay and epsilon-greedy exploration.
 */

import { NeuralTrainer, createNeuralTrainer } from '../neural/NeuralTrainer.js';

/**
 * ReflexionMemory interface for persistent experience storage
 * Compatible with agentdb's ReflexionMemory controller
 */
export interface Episode {
  task: string;
  input: string;
  output: string;
  reward: number;
  success: boolean;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface ReflexionMemory {
  storeEpisode(episode: Episode): Promise<void>;
  retrieveRelevant(query: string, k?: number): Promise<Episode[]>;
  getTaskStats(task: string): Promise<{
    totalAttempts: number;
    successRate: number;
    averageReward: number;
  }>;
}

/**
 * State representation for Q-Learning
 */
export interface QState {
  /** Time of day context */
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  /** Day type context */
  dayType: 'weekday' | 'weekend';
  /** Top 3 most watched genres recently */
  recentGenres: string[];
  /** Average completion rate (0-100%) */
  avgCompletionRate: number;
  /** Number of viewing sessions */
  sessionCount: number;
}

/**
 * Available recommendation actions
 */
export type QAction =
  | 'recommend_similar'      // Match previous content
  | 'recommend_genre'        // Genre preference
  | 'recommend_popular'      // Popular content
  | 'recommend_trending'     // Trending now
  | 'recommend_continue'     // Continue watching
  | 'recommend_new_release'  // New releases
  | 'recommend_time_based'   // Time-aware recommendations
  | 'explore_new_genre'      // Discovery mode
  | 'explore_new_type';      // Type exploration

/**
 * Experience tuple for replay buffer
 */
export interface Experience {
  state: QState;
  action: QAction;
  reward: number;
  nextState: QState;
  timestamp: number;
}

/**
 * User context for state generation
 */
export interface UserContext {
  currentTime?: Date;
  recentWatches?: Array<{
    genre: string;
    completionRate: number;
    rating?: number;
    timestamp: Date;
  }>;
  sessionHistory?: number;
}

/**
 * Engagement metrics for reward calculation
 */
export interface EngagementMetrics {
  completionRate: number;  // 0-100%
  userRating?: number;      // 1-5
  rewindCount?: number;
  skipCount?: number;
  pauseCount?: number;
}

/**
 * Q-Learning configuration
 */
export interface QLearningConfig {
  /** Learning rate (alpha) */
  learningRate?: number;
  /** Discount factor (gamma) */
  discountFactor?: number;
  /** Initial exploration rate */
  initialEpsilon?: number;
  /** Minimum exploration rate */
  minEpsilon?: number;
  /** Epsilon decay rate */
  epsilonDecay?: number;
  /** Experience replay buffer size */
  replayBufferSize?: number;
  /** Batch size for training */
  batchSize?: number;
  /** Enable neural trainer integration */
  useNeuralTrainer?: boolean;
  /** Optional ReflexionMemory for persistent experience storage */
  reflexionMemory?: ReflexionMemory;
  /** Session ID for episode tracking */
  sessionId?: string;
}

/**
 * Q-Learning Preference Learning System
 *
 * Uses reinforcement learning to learn optimal recommendation strategies
 * based on user behavior and feedback.
 */
export class QLearning {
  private qTable: Map<string, Map<QAction, number>>;
  private replayBuffer: Experience[];
  private epsilon: number;
  private neuralTrainer?: NeuralTrainer;
  private reflexionMemory?: ReflexionMemory;
  private sessionId: string;

  private readonly learningRate: number;
  private readonly discountFactor: number;
  private readonly minEpsilon: number;
  private readonly epsilonDecay: number;
  private readonly replayBufferSize: number;
  private readonly batchSize: number;

  private readonly actions: QAction[] = [
    'recommend_similar',
    'recommend_genre',
    'recommend_popular',
    'recommend_trending',
    'recommend_continue',
    'recommend_new_release',
    'recommend_time_based',
    'explore_new_genre',
    'explore_new_type',
  ];

  constructor(config: QLearningConfig = {}) {
    this.learningRate = config.learningRate ?? 0.1;
    this.discountFactor = config.discountFactor ?? 0.95;
    this.epsilon = config.initialEpsilon ?? 0.3;
    this.minEpsilon = config.minEpsilon ?? 0.05;
    this.epsilonDecay = config.epsilonDecay ?? 0.995;
    this.replayBufferSize = config.replayBufferSize ?? 10000;
    this.batchSize = config.batchSize ?? 32;

    this.qTable = new Map();
    this.replayBuffer = [];
    if (config.reflexionMemory !== undefined) {
      this.reflexionMemory = config.reflexionMemory;
    }
    this.sessionId = config.sessionId ?? `qlearning-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    if (config.useNeuralTrainer !== false) {
      this.neuralTrainer = createNeuralTrainer({});
    }
  }

  /**
   * Generate state representation from user context
   */
  getState(userId: string, context: UserContext = {}): QState {
    const now = context.currentTime || new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    // Determine time of day
    let timeOfDay: QState['timeOfDay'];
    if (hour >= 5 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
    else timeOfDay = 'night';

    // Determine day type
    const dayType: QState['dayType'] =
      dayOfWeek === 0 || dayOfWeek === 6 ? 'weekend' : 'weekday';

    // Extract recent genres (top 3)
    const genreCounts = new Map<string, number>();
    const recentWatches = context.recentWatches || [];

    recentWatches.forEach(watch => {
      genreCounts.set(watch.genre, (genreCounts.get(watch.genre) || 0) + 1);
    });

    const recentGenres = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre);

    // Pad with empty strings if needed
    while (recentGenres.length < 3) {
      recentGenres.push('unknown');
    }

    // Calculate average completion rate
    const avgCompletionRate = recentWatches.length > 0
      ? recentWatches.reduce((sum, w) => sum + w.completionRate, 0) / recentWatches.length
      : 0;

    return {
      timeOfDay,
      dayType,
      recentGenres,
      avgCompletionRate: Math.round(avgCompletionRate),
      sessionCount: context.sessionHistory || 0,
    };
  }

  /**
   * Select action using epsilon-greedy strategy
   */
  selectAction(state: QState, explore: boolean = true): QAction {
    const stateKey = this.getStateKey(state);

    // Exploration: random action
    if (explore && Math.random() < this.epsilon) {
      const randomAction = this.actions[Math.floor(Math.random() * this.actions.length)];
      return randomAction ?? 'recommend_similar';
    }

    // Exploitation: best known action
    const qValues = this.getQValues(stateKey);
    const firstAction = this.actions[0] ?? 'recommend_similar';
    let bestAction: QAction = firstAction;
    let bestValue = qValues.get(bestAction) || 0;

    for (const action of this.actions) {
      const value = qValues.get(action) || 0;
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Update Q-value using Bellman equation
   */
  updateQValue(
    state: QState,
    action: QAction,
    reward: number,
    nextState: QState
  ): void {
    const stateKey = this.getStateKey(state);
    const nextStateKey = this.getStateKey(nextState);

    const qValues = this.getQValues(stateKey);
    const nextQValues = this.getQValues(nextStateKey);

    // Get current Q-value
    const currentQ = qValues.get(action) || 0;

    // Get max Q-value for next state
    let maxNextQ = 0;
    for (const nextAction of this.actions) {
      const nextQ = nextQValues.get(nextAction) || 0;
      if (nextQ > maxNextQ) {
        maxNextQ = nextQ;
      }
    }

    // Bellman equation: Q(s,a) = Q(s,a) + α * (r + γ * max(Q(s',a')) - Q(s,a))
    const newQ = currentQ + this.learningRate * (
      reward + this.discountFactor * maxNextQ - currentQ
    );

    qValues.set(action, newQ);
    this.qTable.set(stateKey, qValues);

    // Store in neural trainer for pattern learning
    if (this.neuralTrainer) {
      void this.neuralTrainer.trackPattern('qlearning', {
        state: stateKey,
        action,
        reward,
        qValue: newQ,
      });
    }
  }

  /**
   * Calculate reward from engagement metrics
   *
   * Multi-factor reward (max 1.0):
   * - Completion rate: 50%
   * - User rating: 30%
   * - Engagement score: 20%
   */
  calculateReward(metrics: EngagementMetrics): number {
    // Completion rate contribution (0-0.5)
    const completionReward = (metrics.completionRate / 100) * 0.5;

    // Rating contribution (0-0.3)
    const ratingReward = metrics.userRating
      ? (metrics.userRating / 5) * 0.3
      : 0;

    // Engagement contribution (0-0.2)
    let engagementScore = 0;
    if (metrics.rewindCount) {
      engagementScore += metrics.rewindCount * 0.02; // Rewinding shows interest
    }
    if (metrics.skipCount) {
      engagementScore -= metrics.skipCount * 0.02; // Skipping shows disinterest
    }

    // Clamp engagement score
    engagementScore = Math.max(-0.2, Math.min(0.2, engagementScore));

    // Total reward (0-1.0)
    const totalReward = completionReward + ratingReward + engagementScore;

    return Math.max(0, Math.min(1.0, totalReward));
  }

  /**
   * Train on a batch of experiences (experience replay)
   */
  async train(experiences: Experience[]): Promise<void> {
    // Add to replay buffer
    this.replayBuffer.push(...experiences);

    // Store experiences in ReflexionMemory if available
    if (this.reflexionMemory) {
      await this.storeExperiencesAsEpisodes(experiences);
    }

    // Trim buffer if too large
    if (this.replayBuffer.length > this.replayBufferSize) {
      this.replayBuffer = this.replayBuffer.slice(-this.replayBufferSize);
    }

    // Sample random batch for training
    const batchSize = Math.min(this.batchSize, this.replayBuffer.length);
    const batch: Experience[] = [];

    for (let i = 0; i < batchSize; i++) {
      const index = Math.floor(Math.random() * this.replayBuffer.length);
      const experience = this.replayBuffer[index];
      if (experience) {
        batch.push(experience);
      }
    }

    // Update Q-values for batch
    for (const exp of batch) {
      this.updateQValue(exp.state, exp.action, exp.reward, exp.nextState);
    }

    // Decay epsilon
    this.epsilon = Math.max(
      this.minEpsilon,
      this.epsilon * this.epsilonDecay
    );

    // Train neural patterns
    if (this.neuralTrainer && batch.length > 0) {
      void this.neuralTrainer.trainPattern('qlearning', batch.map(exp => ({
        state: this.getStateKey(exp.state),
        action: exp.action,
        reward: exp.reward,
      })));
    }
  }

  /**
   * Get optimal recommendation strategy for current state
   */
  getRecommendationStrategy(state: QState): QAction {
    return this.selectAction(state, false); // No exploration, pure exploitation
  }

  /**
   * Add experience to replay buffer
   */
  addExperience(experience: Experience): void {
    this.replayBuffer.push(experience);

    if (this.replayBuffer.length > this.replayBufferSize) {
      this.replayBuffer.shift();
    }
  }

  /**
   * Save model to JSON
   */
  saveModel(): string {
    const model = {
      qTable: Array.from(this.qTable.entries()).map(([state, actions]) => ({
        state,
        actions: Array.from(actions.entries()),
      })),
      epsilon: this.epsilon,
      replayBuffer: this.replayBuffer,
      timestamp: new Date().toISOString(),
    };

    return JSON.stringify(model, null, 2);
  }

  /**
   * Load model from JSON
   */
  loadModel(modelJson: string): void {
    try {
      const model = JSON.parse(modelJson);

      // Restore Q-table
      this.qTable.clear();
      for (const { state, actions } of model.qTable) {
        this.qTable.set(state, new Map(actions));
      }

      // Restore epsilon
      this.epsilon = model.epsilon || this.epsilon;

      // Restore replay buffer
      this.replayBuffer = model.replayBuffer || [];

    } catch (error) {
      console.error('Failed to load Q-Learning model:', error);
      throw new Error('Invalid model format');
    }
  }

  /**
   * Get current exploration rate
   */
  getEpsilon(): number {
    return this.epsilon;
  }

  /**
   * Get Q-table size (number of states learned)
   */
  getStateCount(): number {
    return this.qTable.size;
  }

  /**
   * Get experience buffer size
   */
  getExperienceCount(): number {
    return this.replayBuffer.length;
  }

  /**
   * Get Q-value for specific state-action pair
   */
  getQValue(state: QState, action: QAction): number {
    const stateKey = this.getStateKey(state);
    const qValues = this.getQValues(stateKey);
    return qValues.get(action) || 0;
  }

  /**
   * Get all Q-values for a state
   */
  getStateQValues(state: QState): Map<QAction, number> {
    const stateKey = this.getStateKey(state);
    return new Map(this.getQValues(stateKey));
  }

  /**
   * Reset learning (clear Q-table and replay buffer)
   */
  reset(): void {
    this.qTable.clear();
    this.replayBuffer = [];
    this.epsilon = 0.3; // Reset to initial epsilon
  }

  /**
   * Connect or replace ReflexionMemory instance
   */
  connectReflexionMemory(memory: ReflexionMemory): void {
    this.reflexionMemory = memory;
  }

  /**
   * Retrieve similar experiences from ReflexionMemory based on state similarity
   */
  async retrieveSimilarExperiences(state: QState, k: number = 10): Promise<Experience[]> {
    if (!this.reflexionMemory) {
      return [];
    }

    try {
      // Create query text from state for similarity search
      const stateQuery = this.stateToQueryText(state);

      // Retrieve relevant episodes from ReflexionMemory
      const episodes = await this.reflexionMemory.retrieveRelevant(stateQuery, k);

      // Convert episodes back to experiences
      return episodes.map((ep) => this.episodeToExperience(ep)).filter((exp): exp is Experience => exp !== null);
    } catch (error) {
      console.error('Failed to retrieve similar experiences:', error);
      return [];
    }
  }

  /**
   * Sync all current replay buffer experiences to ReflexionMemory
   */
  async syncToReflexionMemory(): Promise<void> {
    if (!this.reflexionMemory || this.replayBuffer.length === 0) {
      return;
    }

    try {
      await this.storeExperiencesAsEpisodes(this.replayBuffer);
    } catch (error) {
      console.error('Failed to sync experiences to ReflexionMemory:', error);
      throw error;
    }
  }

  /**
   * Get task statistics from ReflexionMemory for a specific action
   */
  async getActionStatistics(action: QAction): Promise<{
    totalAttempts: number;
    successRate: number;
    averageReward: number;
  } | null> {
    if (!this.reflexionMemory) {
      return null;
    }

    try {
      const stats = await this.reflexionMemory.getTaskStats(action);
      return stats;
    } catch (error) {
      console.error('Failed to get action statistics:', error);
      return null;
    }
  }

  /**
   * Store experiences as episodes in ReflexionMemory
   */
  private async storeExperiencesAsEpisodes(experiences: Experience[]): Promise<void> {
    if (!this.reflexionMemory) {
      return;
    }

    const episodes: Episode[] = experiences.map(exp => this.experienceToEpisode(exp));

    // Store episodes in parallel batches to avoid overwhelming the database
    const batchSize = 10;
    for (let i = 0; i < episodes.length; i += batchSize) {
      const batch = episodes.slice(i, i + batchSize);
      await Promise.all(
        batch.map(episode => this.reflexionMemory!.storeEpisode(episode))
      );
    }
  }

  /**
   * Convert Experience to Episode for ReflexionMemory storage
   */
  private experienceToEpisode(experience: Experience): Episode {
    const success = experience.reward > 0.5;

    return {
      task: experience.action,
      input: JSON.stringify(experience.state),
      output: JSON.stringify(experience.nextState),
      reward: experience.reward,
      success,
      sessionId: this.sessionId,
      metadata: {
        timestamp: experience.timestamp,
        epsilon: this.epsilon,
        qValue: this.getQValue(experience.state, experience.action),
      },
    };
  }

  /**
   * Convert Episode back to Experience
   */
  private episodeToExperience(episode: Episode): Experience | null {
    try {
      const state = JSON.parse(episode.input) as QState;
      const nextState = JSON.parse(episode.output) as QState;
      const action = episode.task as QAction;

      return {
        state,
        action,
        reward: episode.reward,
        nextState,
        timestamp: (episode.metadata?.['timestamp'] as number) ?? Date.now(),
      };
    } catch (error) {
      console.error('Failed to parse episode:', error);
      return null;
    }
  }

  /**
   * Convert state to query text for similarity search
   */
  private stateToQueryText(state: QState): string {
    return `${state.timeOfDay} ${state.dayType} genres:${state.recentGenres.join(',')} completion:${state.avgCompletionRate}% sessions:${state.sessionCount}`;
  }

  /**
   * Get state key for Q-table lookup
   */
  private getStateKey(state: QState): string {
    return JSON.stringify({
      t: state.timeOfDay,
      d: state.dayType,
      g: state.recentGenres.sort(),
      c: Math.floor(state.avgCompletionRate / 10) * 10, // Round to nearest 10%
      s: Math.floor(state.sessionCount / 5) * 5, // Round to nearest 5 sessions
    });
  }

  /**
   * Get Q-values for a state, initializing if needed
   */
  private getQValues(stateKey: string): Map<QAction, number> {
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Map());
    }
    return this.qTable.get(stateKey)!;
  }
}

/**
 * Factory function to create Q-Learning instance
 */
export function createQLearning(config?: QLearningConfig): QLearning {
  return new QLearning(config);
}

/**
 * Helper function to create experience from user interaction
 */
export function createExperience(
  userId: string,
  previousState: QState,
  action: QAction,
  metrics: EngagementMetrics,
  currentContext: UserContext,
  learner: QLearning
): Experience {
  const nextState = learner.getState(userId, currentContext);
  const reward = learner.calculateReward(metrics);

  return {
    state: previousState,
    action,
    reward,
    nextState,
    timestamp: Date.now(),
  };
}

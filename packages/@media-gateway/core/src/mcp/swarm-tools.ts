/**
 * Swarm Coordination MCP Tools for Media Gateway
 * Inspired by https://github.com/ruvnet/claude-flow
 *
 * Enables multi-agent orchestration for complex recommendation tasks
 */

// ============================================================================
// Swarm Types
// ============================================================================

export type AgentRole =
  | 'content_analyzer'
  | 'preference_learner'
  | 'recommendation_generator'
  | 'diversity_optimizer'
  | 'trend_tracker'
  | 'social_aggregator'
  | 'cache_manager'
  | 'quality_assessor';

export type SwarmTopology = 'mesh' | 'hierarchical' | 'ring' | 'star';

export interface SwarmAgent {
  id: string;
  role: AgentRole;
  status: 'idle' | 'busy' | 'completed' | 'error';
  task: string | undefined;
  result: unknown | undefined;
  createdAt: Date;
  completedAt: Date | undefined;
  metrics: {
    tasksCompleted: number;
    avgLatencyMs: number;
    successRate: number;
  };
}

export interface SwarmTask {
  id: string;
  description: string;
  assignedAgent?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];
  result?: unknown;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface Swarm {
  id: string;
  topology: SwarmTopology;
  agents: Map<string, SwarmAgent>;
  tasks: Map<string, SwarmTask>;
  status: 'initializing' | 'active' | 'paused' | 'completed' | 'terminated';
  createdAt: Date;
  completedAt?: Date;
  metrics: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    avgTaskLatencyMs: number;
  };
}

// ============================================================================
// Swarm Coordinator
// ============================================================================

export class SwarmCoordinator {
  private swarms: Map<string, Swarm> = new Map();
  private activeSwarmId: string | null = null;

  /**
   * Initialize a new swarm
   */
  initSwarm(topology: SwarmTopology = 'mesh', maxAgents: number = 5): Swarm {
    const swarmId = `swarm_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const swarm: Swarm = {
      id: swarmId,
      topology,
      agents: new Map(),
      tasks: new Map(),
      status: 'initializing',
      createdAt: new Date(),
      metrics: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        avgTaskLatencyMs: 0,
      },
    };

    this.swarms.set(swarmId, swarm);
    this.activeSwarmId = swarmId;

    // Auto-spawn initial agents based on topology
    const initialAgents: AgentRole[] = [
      'content_analyzer',
      'preference_learner',
      'recommendation_generator',
    ];

    for (const role of initialAgents.slice(0, Math.min(maxAgents, 3))) {
      this.spawnAgent(swarmId, role);
    }

    swarm.status = 'active';
    return swarm;
  }

  /**
   * Spawn a new agent in a swarm
   */
  spawnAgent(swarmId: string, role: AgentRole, name?: string): SwarmAgent | null {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) return null;

    const agentId = `${role}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const agent: SwarmAgent = {
      id: agentId,
      role,
      status: 'idle',
      task: undefined,
      result: undefined,
      createdAt: new Date(),
      completedAt: undefined,
      metrics: {
        tasksCompleted: 0,
        avgLatencyMs: 0,
        successRate: 1,
      },
    };

    swarm.agents.set(agentId, agent);
    return agent;
  }

  /**
   * Create a task for the swarm
   */
  createTask(
    swarmId: string,
    description: string,
    priority: SwarmTask['priority'] = 'medium',
    dependencies: string[] = []
  ): SwarmTask | null {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) return null;

    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const task: SwarmTask = {
      id: taskId,
      description,
      priority,
      status: 'pending',
      dependencies,
      createdAt: new Date(),
    };

    swarm.tasks.set(taskId, task);
    swarm.metrics.totalTasks++;

    return task;
  }

  /**
   * Assign a task to an available agent
   */
  assignTask(swarmId: string, taskId: string): boolean {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) return false;

    const task = swarm.tasks.get(taskId);
    if (!task || task.status !== 'pending') return false;

    // Check dependencies
    for (const depId of task.dependencies) {
      const dep = swarm.tasks.get(depId);
      if (!dep || dep.status !== 'completed') {
        return false; // Dependencies not met
      }
    }

    // Find idle agent (role matching based on task description)
    let bestAgent: SwarmAgent | null = null;
    for (const agent of swarm.agents.values()) {
      if (agent.status === 'idle') {
        bestAgent = agent;
        break;
      }
    }

    if (!bestAgent) return false;

    task.assignedAgent = bestAgent.id;
    task.status = 'in_progress';
    task.startedAt = new Date();
    bestAgent.status = 'busy';
    bestAgent.task = task.description;

    return true;
  }

  /**
   * Complete a task
   */
  completeTask(swarmId: string, taskId: string, result: unknown): boolean {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) return false;

    const task = swarm.tasks.get(taskId);
    if (!task || task.status !== 'in_progress') return false;

    task.status = 'completed';
    task.result = result;
    task.completedAt = new Date();

    // Update agent metrics
    if (task.assignedAgent) {
      const agent = swarm.agents.get(task.assignedAgent);
      if (agent) {
        agent.status = 'idle';
        agent.task = undefined;
        agent.metrics.tasksCompleted++;

        const latency = task.completedAt.getTime() - (task.startedAt?.getTime() ?? 0);
        agent.metrics.avgLatencyMs =
          (agent.metrics.avgLatencyMs * (agent.metrics.tasksCompleted - 1) + latency) /
          agent.metrics.tasksCompleted;
      }
    }

    swarm.metrics.completedTasks++;

    // Update average task latency
    const latency = task.completedAt.getTime() - (task.startedAt?.getTime() ?? 0);
    swarm.metrics.avgTaskLatencyMs =
      (swarm.metrics.avgTaskLatencyMs * (swarm.metrics.completedTasks - 1) + latency) /
      swarm.metrics.completedTasks;

    return true;
  }

  /**
   * Fail a task
   */
  failTask(swarmId: string, taskId: string, error: string): boolean {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) return false;

    const task = swarm.tasks.get(taskId);
    if (!task) return false;

    task.status = 'failed';
    task.error = error;
    task.completedAt = new Date();

    // Update agent
    if (task.assignedAgent) {
      const agent = swarm.agents.get(task.assignedAgent);
      if (agent) {
        agent.status = 'idle';
        agent.task = undefined;
        agent.metrics.successRate =
          agent.metrics.tasksCompleted / (agent.metrics.tasksCompleted + 1);
      }
    }

    swarm.metrics.failedTasks++;
    return true;
  }

  /**
   * Orchestrate a complex recommendation task
   */
  orchestrateRecommendation(
    swarmId: string,
    userId: string,
    context: {
      mood?: string;
      timeAvailable?: number;
      groupMembers?: string[];
    }
  ): string[] {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) return [];

    const taskIds: string[] = [];

    // Create orchestrated task pipeline
    const analyzeTask = this.createTask(
      swarmId,
      `Analyze user ${userId} preferences and history`,
      'high'
    );
    if (analyzeTask) taskIds.push(analyzeTask.id);

    if (context.mood) {
      const moodTask = this.createTask(
        swarmId,
        `Find content matching mood: ${context.mood}`,
        'medium',
        analyzeTask ? [analyzeTask.id] : []
      );
      if (moodTask) taskIds.push(moodTask.id);
    }

    if (context.groupMembers && context.groupMembers.length > 0) {
      const groupTask = this.createTask(
        swarmId,
        `Aggregate preferences for group: ${context.groupMembers.join(', ')}`,
        'high',
        analyzeTask ? [analyzeTask.id] : []
      );
      if (groupTask) taskIds.push(groupTask.id);
    }

    const generateTask = this.createTask(
      swarmId,
      'Generate personalized recommendations',
      'critical',
      taskIds
    );
    if (generateTask) taskIds.push(generateTask.id);

    const diversifyTask = this.createTask(
      swarmId,
      'Apply diversity optimization (MMR)',
      'medium',
      generateTask ? [generateTask.id] : []
    );
    if (diversifyTask) taskIds.push(diversifyTask.id);

    return taskIds;
  }

  /**
   * Get swarm status
   */
  getSwarmStatus(swarmId?: string): Swarm | null {
    const id = swarmId ?? this.activeSwarmId;
    if (!id) return null;
    return this.swarms.get(id) ?? null;
  }

  /**
   * List all agents in a swarm
   */
  listAgents(swarmId?: string): SwarmAgent[] {
    const id = swarmId ?? this.activeSwarmId;
    if (!id) return [];

    const swarm = this.swarms.get(id);
    if (!swarm) return [];

    return Array.from(swarm.agents.values());
  }

  /**
   * Get task status
   */
  getTaskStatus(swarmId: string, taskId: string): SwarmTask | null {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) return null;
    return swarm.tasks.get(taskId) ?? null;
  }

  /**
   * Get all pending tasks
   */
  getPendingTasks(swarmId?: string): SwarmTask[] {
    const id = swarmId ?? this.activeSwarmId;
    if (!id) return [];

    const swarm = this.swarms.get(id);
    if (!swarm) return [];

    return Array.from(swarm.tasks.values()).filter(t => t.status === 'pending');
  }

  /**
   * Terminate a swarm
   */
  terminateSwarm(swarmId: string): boolean {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) return false;

    swarm.status = 'terminated';
    swarm.completedAt = new Date();

    if (this.activeSwarmId === swarmId) {
      this.activeSwarmId = null;
    }

    return true;
  }

  /**
   * Get overall coordinator stats
   */
  getCoordinatorStats(): {
    activeSwarms: number;
    totalAgents: number;
    totalTasks: number;
    completedTasks: number;
  } {
    let totalAgents = 0;
    let totalTasks = 0;
    let completedTasks = 0;

    for (const swarm of this.swarms.values()) {
      if (swarm.status === 'active') {
        totalAgents += swarm.agents.size;
        totalTasks += swarm.metrics.totalTasks;
        completedTasks += swarm.metrics.completedTasks;
      }
    }

    return {
      activeSwarms: Array.from(this.swarms.values()).filter(s => s.status === 'active').length,
      totalAgents,
      totalTasks,
      completedTasks,
    };
  }
}

// ============================================================================
// MCP Tool Definitions for Swarm Coordination
// ============================================================================

export const swarmTools = [
  {
    name: 'swarm_init',
    description: 'Initialize a new agent swarm for complex recommendation tasks. Creates a coordinated group of specialized agents.',
    inputSchema: {
      type: 'object',
      properties: {
        topology: {
          type: 'string',
          enum: ['mesh', 'hierarchical', 'ring', 'star'],
          description: 'Swarm topology (mesh for peer-to-peer, hierarchical for queen-led)',
          default: 'mesh',
        },
        max_agents: { type: 'number', description: 'Maximum number of agents', default: 5 },
      },
    },
  },
  {
    name: 'swarm_spawn_agent',
    description: 'Spawn a new specialized agent in the swarm.',
    inputSchema: {
      type: 'object',
      properties: {
        swarm_id: { type: 'string', description: 'Swarm ID (uses active swarm if not provided)' },
        role: {
          type: 'string',
          enum: [
            'content_analyzer',
            'preference_learner',
            'recommendation_generator',
            'diversity_optimizer',
            'trend_tracker',
            'social_aggregator',
            'cache_manager',
            'quality_assessor',
          ],
          description: 'Agent specialization',
        },
        name: { type: 'string', description: 'Custom agent name' },
      },
      required: ['role'],
    },
  },
  {
    name: 'swarm_create_task',
    description: 'Create a task for the swarm to execute.',
    inputSchema: {
      type: 'object',
      properties: {
        swarm_id: { type: 'string', description: 'Swarm ID' },
        description: { type: 'string', description: 'Task description' },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          default: 'medium',
        },
        dependencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Task IDs this task depends on',
        },
      },
      required: ['description'],
    },
  },
  {
    name: 'swarm_orchestrate_recommendation',
    description: 'Orchestrate a full recommendation pipeline using the swarm. Creates and coordinates multiple tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        swarm_id: { type: 'string', description: 'Swarm ID' },
        user_id: { type: 'string', description: 'User to generate recommendations for' },
        mood: { type: 'string', description: 'Current mood' },
        time_available: { type: 'number', description: 'Available time in minutes' },
        group_members: {
          type: 'array',
          items: { type: 'string' },
          description: 'Group member user IDs for group recommendations',
        },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'swarm_status',
    description: 'Get the status of a swarm including agents and task progress.',
    inputSchema: {
      type: 'object',
      properties: {
        swarm_id: { type: 'string', description: 'Swarm ID (uses active swarm if not provided)' },
        verbose: { type: 'boolean', description: 'Include detailed agent info', default: false },
      },
    },
  },
  {
    name: 'swarm_list_agents',
    description: 'List all agents in a swarm with their current status.',
    inputSchema: {
      type: 'object',
      properties: {
        swarm_id: { type: 'string', description: 'Swarm ID' },
        filter: {
          type: 'string',
          enum: ['all', 'idle', 'busy'],
          default: 'all',
        },
      },
    },
  },
  {
    name: 'swarm_task_status',
    description: 'Get the status of a specific task.',
    inputSchema: {
      type: 'object',
      properties: {
        swarm_id: { type: 'string', description: 'Swarm ID' },
        task_id: { type: 'string', description: 'Task ID' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'swarm_complete_task',
    description: 'Mark a task as completed with its result.',
    inputSchema: {
      type: 'object',
      properties: {
        swarm_id: { type: 'string', description: 'Swarm ID' },
        task_id: { type: 'string', description: 'Task ID' },
        result: { type: 'object', description: 'Task result' },
      },
      required: ['task_id', 'result'],
    },
  },
  {
    name: 'swarm_terminate',
    description: 'Terminate a swarm and release all resources.',
    inputSchema: {
      type: 'object',
      properties: {
        swarm_id: { type: 'string', description: 'Swarm ID to terminate' },
      },
      required: ['swarm_id'],
    },
  },
  {
    name: 'swarm_coordinator_stats',
    description: 'Get overall coordinator statistics across all swarms.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Singleton instance
export const swarmCoordinator = new SwarmCoordinator();

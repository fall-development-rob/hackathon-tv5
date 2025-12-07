# SPARC Completion: Media Gateway Implementation Roadmap

**Project:** Agentics Foundation TV5 Hackathon - Media Gateway
**Phase:** Completion (Implementation & Integration)
**Date:** 2025-12-06
**Agent:** SPARC Completion Agent

---

## Executive Summary

This document provides the comprehensive implementation roadmap for the Media Gateway solution - an intelligent media discovery and recommendation platform with a 20-year data moat strategy. The system leverages AgentDB for cognitive memory, RuVector for semantic search, and ARW specification for agent integration, solving the fundamental problem: "What should we watch tonight?" across fragmented streaming platforms.

### Core Value Proposition
- **Unified Discovery**: Natural language search across all streaming platforms
- **Personalized Intelligence**: AI agents that learn individual and group preferences over time
- **Cross-Platform**: Seamless content matching and deep-linking across providers
- **Data Moat**: Accumulating preference data creates exponentially improving recommendations
- **Agent-Ready**: ARW-compliant API for integration with AI assistants and autonomous agents

---

## 1. Monorepo Architecture

### 1.1 Repository Structure

```
hackathon-tv5/
├── package.json                          # Root package with workspaces
├── turbo.json                            # Turborepo build orchestration
├── tsconfig.base.json                    # Shared TypeScript configuration
├── .env.example                          # Environment variables template
├── .gitignore                            # Git ignore patterns
├── docker-compose.yml                    # Local development environment
├── .github/
│   └── workflows/
│       ├── ci.yml                        # Continuous Integration
│       ├── deploy-api.yml                # API deployment
│       └── deploy-web.yml                # Web deployment
├── docs/
│   ├── ARCHITECTURE.md                   # System architecture
│   ├── API.md                            # API documentation
│   ├── AGENTS.md                         # Agent documentation
│   └── ARW.md                            # ARW integration guide
├── specs/
│   ├── SPARC-SPECIFICATION.md            # Requirements (existing)
│   ├── SPARC-PSEUDOCODE.md               # Algorithms (existing)
│   ├── SPARC-ARCHITECTURE.md             # Architecture (existing)
│   ├── SPARC-REFINEMENT.md               # TDD refinement (existing)
│   └── SPARC-COMPLETION.md               # This document
├── apps/
│   ├── web/                              # Main web application
│   │   ├── src/
│   │   │   ├── app/                      # Next.js app router
│   │   │   ├── components/               # React components
│   │   │   ├── lib/                      # Client utilities
│   │   │   └── styles/                   # CSS/Tailwind
│   │   ├── public/                       # Static assets
│   │   ├── package.json
│   │   └── next.config.js
│   ├── api/                              # API server
│   │   ├── src/
│   │   │   ├── routes/                   # API routes
│   │   │   ├── middleware/               # Express/Hono middleware
│   │   │   ├── mcp/                      # MCP server implementation
│   │   │   └── index.ts                  # Server entry point
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── media-discovery/                  # Enhanced existing app
│   │   ├── src/
│   │   └── package.json
│   └── cli/                              # Enhanced existing CLI
│       ├── src/
│       └── package.json
└── packages/
    ├── @media-gateway/core/              # Core business logic
    │   ├── src/
    │   │   ├── services/
    │   │   │   ├── UserPreferenceService.ts
    │   │   │   ├── SemanticSearchService.ts
    │   │   │   ├── GroupRecommendationService.ts
    │   │   │   └── ContentMatchingService.ts
    │   │   ├── types/
    │   │   ├── utils/
    │   │   └── index.ts
    │   ├── tests/
    │   └── package.json
    ├── @media-gateway/database/          # Database layer
    │   ├── src/
    │   │   ├── agentdb/
    │   │   │   ├── index.ts
    │   │   │   ├── ReasoningBank.ts
    │   │   │   ├── ReflexionMemory.ts
    │   │   │   └── SkillLibrary.ts
    │   │   ├── ruvector/
    │   │   │   ├── index.ts
    │   │   │   └── VectorStore.ts
    │   │   └── repositories/
    │   │       ├── UserPreferenceRepository.ts
    │   │       ├── ContentRepository.ts
    │   │       └── SocialGraphRepository.ts
    │   ├── migrations/
    │   ├── tests/
    │   └── package.json
    ├── @media-gateway/agents/            # AI agents
    │   ├── src/
    │   │   ├── DiscoveryAgent.ts
    │   │   ├── PreferenceAgent.ts
    │   │   ├── SocialAgent.ts
    │   │   ├── ProviderAgent.ts
    │   │   └── orchestration/
    │   │       ├── SwarmCoordinator.ts
    │   │       └── AgentMemory.ts
    │   ├── tests/
    │   └── package.json
    ├── @media-gateway/arw/               # ARW specification
    │   ├── src/
    │   │   ├── manifest/
    │   │   │   └── generator.ts
    │   │   ├── machine-views/
    │   │   │   ├── search.ts
    │   │   │   ├── recommend.ts
    │   │   │   └── availability.ts
    │   │   ├── actions/
    │   │   │   └── definitions.ts
    │   │   └── middleware/
    │   │       └── arw-middleware.ts
    │   ├── tests/
    │   └── package.json
    ├── @media-gateway/providers/         # Provider integrations
    │   ├── src/
    │   │   ├── adapters/
    │   │   │   ├── TMDBAdapter.ts
    │   │   │   ├── NetflixAdapter.ts
    │   │   │   ├── PrimeAdapter.ts
    │   │   │   ├── DisneyAdapter.ts
    │   │   │   └── BaseAdapter.ts
    │   │   ├── availability/
    │   │   │   └── AvailabilityService.ts
    │   │   ├── deep-links/
    │   │   │   └── DeepLinkGenerator.ts
    │   │   └── index.ts
    │   ├── tests/
    │   └── package.json
    ├── @media-gateway/ui/                # Shared UI components
    │   ├── src/
    │   │   ├── components/
    │   │   ├── hooks/
    │   │   └── utils/
    │   ├── tests/
    │   └── package.json
    └── @media-gateway/sdk/               # Client SDK
        ├── src/
        │   ├── client/
        │   │   └── MediaGatewayClient.ts
        │   ├── types/
        │   └── index.ts
        ├── tests/
        └── package.json
```

### 1.2 Workspace Configuration

**Root package.json**
```json
{
  "name": "hackathon-tv5",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean && rm -rf node_modules",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "prepare": "husky install"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "@typescript-eslint/parser": "^6.19.0",
    "eslint": "^8.56.0",
    "husky": "^8.0.3",
    "prettier": "^3.2.4",
    "turbo": "^1.12.0",
    "typescript": "^5.3.3",
    "vitest": "^1.2.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=9.0.0"
  }
}
```

**turbo.json**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  }
}
```

**tsconfig.base.json**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@media-gateway/core": ["packages/@media-gateway/core/src"],
      "@media-gateway/database": ["packages/@media-gateway/database/src"],
      "@media-gateway/agents": ["packages/@media-gateway/agents/src"],
      "@media-gateway/arw": ["packages/@media-gateway/arw/src"],
      "@media-gateway/providers": ["packages/@media-gateway/providers/src"],
      "@media-gateway/ui": ["packages/@media-gateway/ui/src"],
      "@media-gateway/sdk": ["packages/@media-gateway/sdk/src"]
    }
  },
  "exclude": ["node_modules", "dist", ".next", "coverage"]
}
```

---

## 2. Implementation Phases

### Phase 1: Foundation (Days 1-2)

**Objective:** Establish monorepo structure, shared configurations, and database layer

#### Task Breakdown

**Day 1 Morning: Monorepo Setup**
- [ ] Initialize Turborepo with `npx create-turbo@latest`
- [ ] Configure workspaces in root package.json
- [ ] Set up shared TypeScript configuration
- [ ] Configure ESLint and Prettier
- [ ] Set up Git hooks with Husky
- [ ] Create CI/CD workflows for GitHub Actions

**Day 1 Afternoon: Core Package**
- [ ] Create `packages/@media-gateway/core` structure
- [ ] Implement TypeScript types and interfaces
- [ ] Set up Vitest for testing
- [ ] Create utility functions
- [ ] Document package API

**Day 2 Morning: Database Layer**
- [ ] Create `packages/@media-gateway/database` structure
- [ ] Integrate AgentDB with SQLite backend
- [ ] Implement ReasoningBank wrapper
- [ ] Implement ReflexionMemory wrapper
- [ ] Implement SkillLibrary wrapper
- [ ] Create database migrations

**Day 2 Afternoon: ARW Package**
- [ ] Create `packages/@media-gateway/arw` structure
- [ ] Implement manifest generator
- [ ] Define machine-readable views
- [ ] Create action definitions
- [ ] Implement ARW middleware
- [ ] Write ARW compliance tests

#### Key Deliverables

**packages/@media-gateway/core/src/types/index.ts**
```typescript
// User and Preference Types
export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  userId: string;
  genres: GenrePreference[];
  actors: ActorPreference[];
  directors: DirectorPreference[];
  moods: MoodPreference[];
  languages: string[];
  contentTypes: ContentType[];
  preferenceVector: number[]; // 768-dimensional embedding
  lastUpdated: Date;
}

export interface GenrePreference {
  genre: string;
  affinity: number; // -1.0 to 1.0
  confidence: number; // 0.0 to 1.0
}

// Content Types
export interface Content {
  id: string;
  type: ContentType;
  title: string;
  originalTitle?: string;
  description: string;
  releaseDate: Date;
  genres: string[];
  cast: Person[];
  crew: Person[];
  rating: number;
  runtime?: number;
  language: string;
  contentVector: number[]; // 768-dimensional embedding
  metadata: Record<string, unknown>;
}

export enum ContentType {
  MOVIE = 'movie',
  TV_SHOW = 'tv_show',
  DOCUMENTARY = 'documentary',
  ANIME = 'anime'
}

export interface Person {
  id: string;
  name: string;
  role: 'actor' | 'director' | 'writer' | 'producer';
  character?: string;
}

// Provider Types
export interface StreamingProvider {
  id: string;
  name: string;
  logoUrl: string;
  baseUrl: string;
  supportedRegions: string[];
}

export interface ProviderAvailability {
  contentId: string;
  providerId: string;
  region: string;
  type: 'subscription' | 'rent' | 'buy' | 'free';
  price?: number;
  currency?: string;
  deepLink: string;
  quality: 'SD' | 'HD' | 'UHD' | '4K';
  lastChecked: Date;
}

// Search and Recommendation Types
export interface SearchQuery {
  query: string;
  userId?: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
}

export interface SearchFilters {
  contentTypes?: ContentType[];
  genres?: string[];
  releaseYearMin?: number;
  releaseYearMax?: number;
  ratingMin?: number;
  languages?: string[];
  providers?: string[];
  region?: string;
}

export interface SearchResult {
  content: Content;
  score: number;
  availability: ProviderAvailability[];
  explanation?: string;
}

export interface RecommendationRequest {
  userId: string;
  context?: RecommendationContext;
  limit?: number;
  excludeWatched?: boolean;
}

export interface RecommendationContext {
  mood?: string;
  occasion?: string;
  companions?: string[]; // User IDs for group recommendations
  timeAvailable?: number; // Minutes
}

export interface Recommendation {
  content: Content;
  score: number;
  reasons: string[];
  availability: ProviderAvailability[];
  matchedPreferences: string[];
}

// Group Decision Types
export interface GroupSession {
  id: string;
  name: string;
  creatorId: string;
  memberIds: string[];
  createdAt: Date;
  expiresAt: Date;
  status: 'active' | 'completed' | 'cancelled';
}

export interface GroupRecommendation {
  sessionId: string;
  content: Content;
  aggregateScore: number;
  memberScores: Record<string, number>; // userId -> score
  consensus: number; // 0.0 to 1.0
  reasons: string[];
  availability: ProviderAvailability[];
}

// Watch Event Types
export interface WatchEvent {
  id: string;
  userId: string;
  contentId: string;
  type: 'started' | 'completed' | 'abandoned' | 'rated' | 'saved';
  progress?: number; // 0.0 to 1.0
  rating?: number; // 1 to 10
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Agent Types
export interface AgentTask {
  id: string;
  type: 'search' | 'recommend' | 'learn' | 'match' | 'group';
  userId?: string;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface AgentMemory {
  userId: string;
  context: string;
  memories: Memory[];
  lastAccessed: Date;
}

export interface Memory {
  id: string;
  type: 'preference' | 'interaction' | 'feedback' | 'reasoning';
  content: string;
  embedding: number[];
  importance: number; // 0.0 to 1.0
  timestamp: Date;
}
```

**packages/@media-gateway/database/src/agentdb/index.ts**
```typescript
import Database from 'better-sqlite3';
import path from 'path';

export interface AgentDBConfig {
  dbPath?: string;
  verbose?: boolean;
}

export class AgentDB {
  private db: Database.Database;

  constructor(config: AgentDBConfig = {}) {
    const dbPath = config.dbPath || path.join(process.cwd(), 'data', 'agentdb.db');
    this.db = new Database(dbPath, {
      verbose: config.verbose ? console.log : undefined
    });
    this.initialize();
  }

  private initialize(): void {
    // Create tables for AgentDB schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reasoning_bank (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        task_type TEXT NOT NULL,
        reasoning TEXT NOT NULL,
        outcome TEXT NOT NULL,
        success INTEGER NOT NULL,
        context TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reflexion_memory (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        experience TEXT NOT NULL,
        reflection TEXT NOT NULL,
        lesson TEXT NOT NULL,
        importance REAL NOT NULL,
        embedding BLOB,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS skill_library (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        implementation TEXT NOT NULL,
        parameters TEXT,
        usage_count INTEGER DEFAULT 0,
        success_rate REAL DEFAULT 0.0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        preference_vector BLOB NOT NULL,
        genres TEXT,
        actors TEXT,
        directors TEXT,
        moods TEXT,
        languages TEXT,
        content_types TEXT,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS watch_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        content_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        progress REAL,
        rating INTEGER,
        timestamp INTEGER NOT NULL,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS content_cache (
        content_id TEXT PRIMARY KEY,
        content_data TEXT NOT NULL,
        content_vector BLOB,
        cached_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_reasoning_agent ON reasoning_bank(agent_id);
      CREATE INDEX IF NOT EXISTS idx_reasoning_task ON reasoning_bank(task_type);
      CREATE INDEX IF NOT EXISTS idx_reflexion_agent ON reflexion_memory(agent_id);
      CREATE INDEX IF NOT EXISTS idx_watch_user ON watch_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_watch_content ON watch_events(content_id);
    `);
  }

  // Reasoning Bank Methods
  public saveReasoning(reasoning: {
    id: string;
    agentId: string;
    taskType: string;
    reasoning: string;
    outcome: string;
    success: boolean;
    context?: Record<string, unknown>;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO reasoning_bank
      (id, agent_id, task_type, reasoning, outcome, success, context, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();
    stmt.run(
      reasoning.id,
      reasoning.agentId,
      reasoning.taskType,
      reasoning.reasoning,
      reasoning.outcome,
      reasoning.success ? 1 : 0,
      reasoning.context ? JSON.stringify(reasoning.context) : null,
      now,
      now
    );
  }

  public getReasoningHistory(agentId: string, taskType: string, limit = 10): unknown[] {
    const stmt = this.db.prepare(`
      SELECT * FROM reasoning_bank
      WHERE agent_id = ? AND task_type = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    return stmt.all(agentId, taskType, limit);
  }

  // Reflexion Memory Methods
  public saveReflexion(reflexion: {
    id: string;
    agentId: string;
    experience: string;
    reflection: string;
    lesson: string;
    importance: number;
    embedding?: number[];
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO reflexion_memory
      (id, agent_id, experience, reflection, lesson, importance, embedding, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const embedding = reflexion.embedding
      ? Buffer.from(new Float32Array(reflexion.embedding).buffer)
      : null;

    stmt.run(
      reflexion.id,
      reflexion.agentId,
      reflexion.experience,
      reflexion.reflection,
      reflexion.lesson,
      reflexion.importance,
      embedding,
      Date.now()
    );
  }

  public getRecentReflexions(agentId: string, limit = 5): unknown[] {
    const stmt = this.db.prepare(`
      SELECT * FROM reflexion_memory
      WHERE agent_id = ?
      ORDER BY importance DESC, created_at DESC
      LIMIT ?
    `);

    return stmt.all(agentId, limit);
  }

  // Skill Library Methods
  public saveSkill(skill: {
    id: string;
    name: string;
    description: string;
    implementation: string;
    parameters?: Record<string, unknown>;
  }): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO skill_library
      (id, name, description, implementation, parameters, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();
    stmt.run(
      skill.id,
      skill.name,
      skill.description,
      skill.implementation,
      skill.parameters ? JSON.stringify(skill.parameters) : null,
      now,
      now
    );
  }

  public getSkill(name: string): unknown {
    const stmt = this.db.prepare(`
      SELECT * FROM skill_library WHERE name = ?
    `);

    return stmt.get(name);
  }

  public incrementSkillUsage(name: string, success: boolean): void {
    const stmt = this.db.prepare(`
      UPDATE skill_library
      SET usage_count = usage_count + 1,
          success_rate = (success_rate * usage_count + ?) / (usage_count + 1),
          updated_at = ?
      WHERE name = ?
    `);

    stmt.run(success ? 1.0 : 0.0, Date.now(), name);
  }

  // User Preference Methods
  public saveUserPreferences(userId: string, preferences: {
    preferenceVector: number[];
    genres: Record<string, number>;
    actors: Record<string, number>;
    directors: Record<string, number>;
    moods: Record<string, number>;
    languages: string[];
    contentTypes: string[];
  }): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_preferences
      (user_id, preference_vector, genres, actors, directors, moods, languages, content_types, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const vectorBuffer = Buffer.from(new Float32Array(preferences.preferenceVector).buffer);

    stmt.run(
      userId,
      vectorBuffer,
      JSON.stringify(preferences.genres),
      JSON.stringify(preferences.actors),
      JSON.stringify(preferences.directors),
      JSON.stringify(preferences.moods),
      JSON.stringify(preferences.languages),
      JSON.stringify(preferences.contentTypes),
      Date.now()
    );
  }

  public getUserPreferences(userId: string): unknown {
    const stmt = this.db.prepare(`
      SELECT * FROM user_preferences WHERE user_id = ?
    `);

    return stmt.get(userId);
  }

  // Watch Event Methods
  public saveWatchEvent(event: {
    id: string;
    userId: string;
    contentId: string;
    eventType: string;
    progress?: number;
    rating?: number;
    metadata?: Record<string, unknown>;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO watch_events
      (id, user_id, content_id, event_type, progress, rating, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.id,
      event.userId,
      event.contentId,
      event.eventType,
      event.progress || null,
      event.rating || null,
      Date.now(),
      event.metadata ? JSON.stringify(event.metadata) : null
    );
  }

  public getWatchHistory(userId: string, limit = 50): unknown[] {
    const stmt = this.db.prepare(`
      SELECT * FROM watch_events
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    return stmt.all(userId, limit);
  }

  public close(): void {
    this.db.close();
  }
}

export default AgentDB;
```

**packages/@media-gateway/arw/src/manifest/generator.ts**
```typescript
import { ARWManifest, MachineView, Action } from '../types';

export class ManifestGenerator {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  public generate(): ARWManifest {
    return {
      version: '1.0.0',
      name: 'Media Gateway',
      description: 'Intelligent media discovery and recommendation platform with unified search across streaming providers',
      baseUrl: this.baseUrl,
      authentication: {
        type: 'bearer',
        tokenUrl: `${this.baseUrl}/auth/token`,
        scopes: ['search', 'recommend', 'profile']
      },
      machineViews: this.getMachineViews(),
      actions: this.getActions(),
      capabilities: {
        search: true,
        recommendations: true,
        groupDecisions: true,
        crossPlatform: true,
        personalizedLearning: true
      },
      dataPrivacy: {
        userDataRetention: '20 years',
        deletionSupported: true,
        exportSupported: true,
        gdprCompliant: true
      }
    };
  }

  private getMachineViews(): MachineView[] {
    return [
      {
        id: 'search',
        name: 'Content Search',
        description: 'Search for movies and TV shows across all streaming platforms using natural language',
        endpoint: `${this.baseUrl}/api/search`,
        method: 'POST',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Natural language search query'
            },
            userId: {
              type: 'string',
              description: 'Optional user ID for personalized results'
            },
            filters: {
              type: 'object',
              properties: {
                contentTypes: { type: 'array', items: { type: 'string' } },
                genres: { type: 'array', items: { type: 'string' } },
                providers: { type: 'array', items: { type: 'string' } },
                releaseYearMin: { type: 'number' },
                releaseYearMax: { type: 'number' }
              }
            },
            limit: { type: 'number', default: 20 }
          },
          required: ['query']
        },
        outputSchema: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  content: { type: 'object' },
                  score: { type: 'number' },
                  availability: { type: 'array' },
                  explanation: { type: 'string' }
                }
              }
            }
          }
        }
      },
      {
        id: 'recommend',
        name: 'Personalized Recommendations',
        description: 'Get AI-powered recommendations based on user preferences and viewing history',
        endpoint: `${this.baseUrl}/api/recommend`,
        method: 'POST',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            context: {
              type: 'object',
              properties: {
                mood: { type: 'string' },
                occasion: { type: 'string' },
                timeAvailable: { type: 'number' }
              }
            },
            limit: { type: 'number', default: 10 }
          },
          required: ['userId']
        },
        outputSchema: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  content: { type: 'object' },
                  score: { type: 'number' },
                  reasons: { type: 'array', items: { type: 'string' } },
                  availability: { type: 'array' }
                }
              }
            }
          }
        }
      },
      {
        id: 'group-recommend',
        name: 'Group Recommendations',
        description: 'Get recommendations for multiple users watching together',
        endpoint: `${this.baseUrl}/api/group`,
        method: 'POST',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            memberIds: { type: 'array', items: { type: 'string' } },
            context: { type: 'object' },
            limit: { type: 'number', default: 10 }
          },
          required: ['memberIds']
        },
        outputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            recommendations: { type: 'array' },
            consensus: { type: 'number' }
          }
        }
      },
      {
        id: 'availability',
        name: 'Provider Availability',
        description: 'Check which streaming platforms have specific content available',
        endpoint: `${this.baseUrl}/api/availability/:contentId`,
        method: 'GET',
        inputSchema: {
          type: 'object',
          properties: {
            contentId: { type: 'string' },
            region: { type: 'string', default: 'US' }
          },
          required: ['contentId']
        },
        outputSchema: {
          type: 'object',
          properties: {
            contentId: { type: 'string' },
            availability: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  provider: { type: 'string' },
                  type: { type: 'string' },
                  deepLink: { type: 'string' },
                  quality: { type: 'string' }
                }
              }
            }
          }
        }
      }
    ];
  }

  private getActions(): Action[] {
    return [
      {
        id: 'search-content',
        name: 'Search Content',
        description: 'Search for movies and TV shows',
        machineViewId: 'search',
        triggers: [
          'find movies about',
          'search for',
          'show me',
          'what are good',
          'I want to watch'
        ],
        examples: [
          {
            input: 'Find sci-fi movies from the 1980s',
            output: 'Returns list of 1980s sci-fi films with availability'
          },
          {
            input: 'Show me action movies with Tom Cruise',
            output: 'Returns Tom Cruise action films across platforms'
          }
        ]
      },
      {
        id: 'get-recommendations',
        name: 'Get Recommendations',
        description: 'Get personalized content recommendations',
        machineViewId: 'recommend',
        triggers: [
          'what should I watch',
          'recommend something',
          'suggest a movie',
          'what to watch tonight'
        ],
        examples: [
          {
            input: 'What should I watch tonight? I want something light and funny',
            output: 'Returns personalized comedy recommendations'
          }
        ]
      },
      {
        id: 'group-decision',
        name: 'Group Decision',
        description: 'Find content that works for multiple people',
        machineViewId: 'group-recommend',
        triggers: [
          'what should we watch',
          'movie for the family',
          'group recommendation'
        ],
        examples: [
          {
            input: 'What should we watch as a family?',
            output: 'Returns family-friendly recommendations considering all preferences'
          }
        ]
      },
      {
        id: 'check-availability',
        name: 'Check Availability',
        description: 'Find where to watch specific content',
        machineViewId: 'availability',
        triggers: [
          'where can I watch',
          'is it on Netflix',
          'which service has'
        ],
        examples: [
          {
            input: 'Where can I watch Inception?',
            output: 'Returns all platforms with Inception and deep links'
          }
        ]
      }
    ];
  }
}
```

---

### Phase 2: Intelligence Layer (Days 3-4)

**Objective:** Implement AI agents using Google ADK and Claude Flow orchestration

#### Task Breakdown

**Day 3 Morning: Agent Infrastructure**
- [ ] Create `packages/@media-gateway/agents` structure
- [ ] Set up Google ADK integration
- [ ] Implement base Agent class
- [ ] Create AgentMemory service
- [ ] Set up SwarmCoordinator for multi-agent orchestration

**Day 3 Afternoon: Discovery & Preference Agents**
- [ ] Implement DiscoveryAgent for natural language understanding
- [ ] Implement PreferenceAgent for learning user preferences
- [ ] Create agent-to-agent communication protocol
- [ ] Write unit tests for agents

**Day 4 Morning: Social & Provider Agents**
- [ ] Implement SocialAgent for group recommendations
- [ ] Implement ProviderAgent for platform integration
- [ ] Create agent reasoning pipeline
- [ ] Integrate with AgentDB

**Day 4 Afternoon: Agent Orchestration**
- [ ] Implement swarm coordination patterns
- [ ] Create agent health monitoring
- [ ] Implement fallback strategies
- [ ] Write integration tests

#### Key Deliverables

**packages/@media-gateway/agents/src/DiscoveryAgent.ts**
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AgentDB } from '@media-gateway/database';
import { SearchQuery, SearchFilters } from '@media-gateway/core';

export class DiscoveryAgent {
  private genAI: GoogleGenerativeAI;
  private db: AgentDB;
  private model: any;

  constructor(apiKey: string, db: AgentDB) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.db = db;
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  /**
   * Parse natural language query into structured search parameters
   */
  public async parseIntent(query: string): Promise<SearchQuery> {
    const prompt = `
You are a media discovery assistant. Parse the following natural language query into structured search parameters.

User Query: "${query}"

Extract:
1. Core search terms
2. Content types (movie, tv_show, documentary, anime)
3. Genres
4. Release year range
5. Specific actors, directors, or creators
6. Mood or occasion
7. Any other filters

Return as JSON:
{
  "query": "refined search terms",
  "filters": {
    "contentTypes": [],
    "genres": [],
    "releaseYearMin": null,
    "releaseYearMax": null,
    "ratingMin": null
  },
  "context": {
    "mood": null,
    "occasion": null,
    "actors": [],
    "directors": []
  }
}
`;

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse intent from query');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Save reasoning to AgentDB
    await this.saveReasoning({
      taskType: 'intent-parsing',
      reasoning: `Parsed query: "${query}"`,
      outcome: JSON.stringify(parsed),
      success: true,
      context: { originalQuery: query }
    });

    return {
      query: parsed.query,
      filters: parsed.filters
    };
  }

  /**
   * Execute discovery task with context accumulation
   */
  public async executeTask(task: {
    query: string;
    userId?: string;
    context?: Record<string, unknown>;
  }): Promise<SearchQuery> {
    // Retrieve relevant past reasoning
    const history = this.db.getReasoningHistory('discovery-agent', 'intent-parsing', 5);

    // Retrieve user context if userId provided
    let userContext = '';
    if (task.userId) {
      const preferences = this.db.getUserPreferences(task.userId);
      if (preferences) {
        userContext = `\nUser Preferences: ${JSON.stringify(preferences)}`;
      }
    }

    // Parse intent with accumulated context
    const searchQuery = await this.parseIntent(task.query);

    // Refine based on user preferences
    if (task.userId && userContext) {
      searchQuery.userId = task.userId;
    }

    return searchQuery;
  }

  /**
   * Learn from successful searches to improve future parsing
   */
  public async learnFromFeedback(
    originalQuery: string,
    parsedQuery: SearchQuery,
    wasSuccessful: boolean,
    userFeedback?: string
  ): Promise<void> {
    const reflexion = {
      id: `reflexion-${Date.now()}`,
      agentId: 'discovery-agent',
      experience: `Query: "${originalQuery}" -> Parsed: ${JSON.stringify(parsedQuery)}`,
      reflection: wasSuccessful
        ? 'Query was successfully parsed and returned relevant results'
        : `Query parsing failed: ${userFeedback || 'no user feedback'}`,
      lesson: wasSuccessful
        ? 'Successful pattern to reinforce'
        : 'Need to adjust parsing strategy for similar queries',
      importance: wasSuccessful ? 0.7 : 0.9
    };

    this.db.saveReflexion(reflexion);
  }

  private async saveReasoning(reasoning: {
    taskType: string;
    reasoning: string;
    outcome: string;
    success: boolean;
    context?: Record<string, unknown>;
  }): Promise<void> {
    this.db.saveReasoning({
      id: `reasoning-${Date.now()}`,
      agentId: 'discovery-agent',
      ...reasoning
    });
  }
}
```

**packages/@media-gateway/agents/src/PreferenceAgent.ts**
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AgentDB } from '@media-gateway/database';
import { WatchEvent, UserPreferences } from '@media-gateway/core';

export class PreferenceAgent {
  private genAI: GoogleGenerativeAI;
  private db: AgentDB;
  private model: any;

  constructor(apiKey: string, db: AgentDB) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.db = db;
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  /**
   * Learn from watch events to update user preferences
   */
  public async learnFromWatchEvent(event: WatchEvent): Promise<void> {
    // Get watch history
    const history = this.db.getWatchHistory(event.userId, 50);

    // Get current preferences
    const currentPrefs = this.db.getUserPreferences(event.userId);

    // Analyze event significance
    const significance = this.calculateEventSignificance(event);

    if (significance > 0.5) {
      // Generate updated preference vector using AI
      const updatedPrefs = await this.generateUpdatedPreferences(
        event,
        history as WatchEvent[],
        currentPrefs as UserPreferences | null
      );

      // Save to database
      this.db.saveUserPreferences(event.userId, updatedPrefs);

      // Save reasoning
      this.db.saveReasoning({
        id: `pref-update-${Date.now()}`,
        agentId: 'preference-agent',
        taskType: 'preference-learning',
        reasoning: `Updated preferences based on ${event.type} event for content ${event.contentId}`,
        outcome: JSON.stringify(updatedPrefs),
        success: true,
        context: { eventId: event.id, significance }
      });
    }
  }

  /**
   * Calculate how significant a watch event is for preference learning
   */
  private calculateEventSignificance(event: WatchEvent): number {
    let significance = 0.0;

    switch (event.type) {
      case 'completed':
        significance = 0.9; // Very significant
        break;
      case 'rated':
        significance = event.rating ? (event.rating / 10) : 0.5;
        break;
      case 'abandoned':
        significance = event.progress ? (1 - event.progress) : 0.7; // Negative signal
        break;
      case 'saved':
        significance = 0.6; // Moderate positive signal
        break;
      default:
        significance = 0.3;
    }

    return significance;
  }

  /**
   * Generate updated preference vector using AI analysis
   */
  private async generateUpdatedPreferences(
    event: WatchEvent,
    history: WatchEvent[],
    currentPrefs: UserPreferences | null
  ): Promise<any> {
    const prompt = `
You are analyzing user viewing behavior to update their content preferences.

Recent Event:
${JSON.stringify(event)}

Watch History (last 50 events):
${JSON.stringify(history.slice(0, 10))} (truncated)

Current Preferences:
${currentPrefs ? JSON.stringify(currentPrefs) : 'No preferences yet'}

Based on this data, generate updated preference weights for:
1. Genres (e.g., action: 0.8, comedy: 0.6, drama: 0.4)
2. Actors (top 10 preferred actors with weights)
3. Directors (top 5 preferred directors with weights)
4. Moods (e.g., uplifting: 0.7, dark: 0.3, intense: 0.8)
5. Content types (movie, tv_show, documentary, anime)
6. Languages

Return as JSON with weights from -1.0 (dislike) to 1.0 (strong like):
{
  "genres": { "genre1": 0.8, "genre2": 0.6, ... },
  "actors": { "actor1": 0.9, "actor2": 0.7, ... },
  "directors": { "director1": 0.8, ... },
  "moods": { "mood1": 0.7, ... },
  "contentTypes": ["movie", "tv_show"],
  "languages": ["en", "es"]
}
`;

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to generate preferences');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Generate preference vector (simplified - in production, use embeddings)
    const preferenceVector = this.generatePreferenceVector(parsed);

    return {
      preferenceVector,
      ...parsed
    };
  }

  /**
   * Generate 768-dimensional preference vector from structured preferences
   */
  private generatePreferenceVector(preferences: any): number[] {
    // Simplified version - in production, use actual embeddings from Gemini
    // This creates a deterministic vector from preference weights
    const vector = new Array(768).fill(0);

    let index = 0;

    // Encode genres
    Object.entries(preferences.genres || {}).forEach(([genre, weight]) => {
      const hashCode = this.hashString(genre);
      vector[hashCode % 100] = weight as number;
      index++;
    });

    // Encode actors
    Object.entries(preferences.actors || {}).forEach(([actor, weight]) => {
      const hashCode = this.hashString(actor);
      vector[100 + (hashCode % 100)] = weight as number;
      index++;
    });

    // Encode moods
    Object.entries(preferences.moods || {}).forEach(([mood, weight]) => {
      const hashCode = this.hashString(mood);
      vector[200 + (hashCode % 100)] = weight as number;
      index++;
    });

    return vector;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Get personalized recommendation vector for a user
   */
  public async getPersonalizedVector(userId: string): Promise<number[]> {
    const prefs = this.db.getUserPreferences(userId);

    if (!prefs) {
      // Return neutral vector for new users
      return new Array(768).fill(0);
    }

    // In production, this would return the actual stored vector
    // For now, reconstruct from preferences
    return (prefs as any).preference_vector;
  }
}
```

**packages/@media-gateway/agents/src/orchestration/SwarmCoordinator.ts**
```typescript
import { DiscoveryAgent } from '../DiscoveryAgent';
import { PreferenceAgent } from '../PreferenceAgent';
import { SocialAgent } from '../SocialAgent';
import { ProviderAgent } from '../ProviderAgent';

export interface SwarmTask {
  id: string;
  type: 'search' | 'recommend' | 'group' | 'learn';
  input: Record<string, unknown>;
  userId?: string;
}

export class SwarmCoordinator {
  private discoveryAgent: DiscoveryAgent;
  private preferenceAgent: PreferenceAgent;
  private socialAgent: SocialAgent;
  private providerAgent: ProviderAgent;

  constructor(
    discoveryAgent: DiscoveryAgent,
    preferenceAgent: PreferenceAgent,
    socialAgent: SocialAgent,
    providerAgent: ProviderAgent
  ) {
    this.discoveryAgent = discoveryAgent;
    this.preferenceAgent = preferenceAgent;
    this.socialAgent = socialAgent;
    this.providerAgent = providerAgent;
  }

  /**
   * Execute task with appropriate agent coordination
   */
  public async executeTask(task: SwarmTask): Promise<unknown> {
    switch (task.type) {
      case 'search':
        return this.executeSearchTask(task);
      case 'recommend':
        return this.executeRecommendTask(task);
      case 'group':
        return this.executeGroupTask(task);
      case 'learn':
        return this.executeLearnTask(task);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  private async executeSearchTask(task: SwarmTask): Promise<unknown> {
    // Step 1: Discovery agent parses intent
    const searchQuery = await this.discoveryAgent.executeTask({
      query: task.input.query as string,
      userId: task.userId,
      context: task.input.context as Record<string, unknown>
    });

    // Step 2: If userId provided, get personalization from PreferenceAgent
    if (task.userId) {
      const preferenceVector = await this.preferenceAgent.getPersonalizedVector(task.userId);
      // Use preference vector to boost results
      (searchQuery as any).preferenceVector = preferenceVector;
    }

    // Step 3: Provider agent fetches availability
    // (This would be called after semantic search returns results)

    return searchQuery;
  }

  private async executeRecommendTask(task: SwarmTask): Promise<unknown> {
    if (!task.userId) {
      throw new Error('userId required for recommendations');
    }

    // Get user's preference vector
    const preferenceVector = await this.preferenceAgent.getPersonalizedVector(task.userId);

    // Use vector for semantic search and ranking
    return {
      userId: task.userId,
      preferenceVector,
      context: task.input.context
    };
  }

  private async executeGroupTask(task: SwarmTask): Promise<unknown> {
    const memberIds = task.input.memberIds as string[];
    if (!memberIds || memberIds.length === 0) {
      throw new Error('memberIds required for group recommendations');
    }

    // Use SocialAgent to coordinate group decision
    return this.socialAgent.getGroupRecommendations(memberIds, task.input.context as any);
  }

  private async executeLearnTask(task: SwarmTask): Promise<void> {
    const event = task.input.event as any;

    // PreferenceAgent learns from watch event
    await this.preferenceAgent.learnFromWatchEvent(event);

    // DiscoveryAgent gets feedback if provided
    if (task.input.feedback) {
      await this.discoveryAgent.learnFromFeedback(
        task.input.originalQuery as string,
        task.input.parsedQuery as any,
        task.input.wasSuccessful as boolean,
        task.input.feedback as string
      );
    }
  }
}
```

---

### Phase 3: API Layer (Days 5-6)

**Objective:** Build RESTful API with ARW compliance and MCP server

#### Task Breakdown

**Day 5 Morning: API Server Setup**
- [ ] Create `apps/api` with Express/Hono
- [ ] Set up routing structure
- [ ] Implement authentication middleware
- [ ] Set up request validation
- [ ] Configure CORS and security headers

**Day 5 Afternoon: Core API Endpoints**
- [ ] Implement POST /api/search
- [ ] Implement POST /api/recommend
- [ ] Implement GET /api/availability/:contentId
- [ ] Implement POST /api/watch-event
- [ ] Add rate limiting

**Day 6 Morning: Group & Social Features**
- [ ] Implement POST /api/group
- [ ] Implement GET /api/group/:sessionId
- [ ] Implement POST /api/preferences/export
- [ ] Implement DELETE /api/preferences

**Day 6 Afternoon: MCP Server & ARW**
- [ ] Implement MCP server for agent integration
- [ ] Serve ARW manifest at /.well-known/arw-manifest.json
- [ ] Add OpenAPI documentation
- [ ] Write API integration tests

#### Key Deliverables

**apps/api/src/index.ts**
```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { searchRouter } from './routes/search';
import { recommendRouter } from './routes/recommend';
import { groupRouter } from './routes/group';
import { availabilityRouter } from './routes/availability';
import { preferencesRouter } from './routes/preferences';
import { arwRouter } from './routes/arw';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ARW manifest (publicly accessible)
app.use('/.well-known', arwRouter);

// API routes (require authentication)
app.use('/api/search', authMiddleware, searchRouter);
app.use('/api/recommend', authMiddleware, recommendRouter);
app.use('/api/group', authMiddleware, groupRouter);
app.use('/api/availability', availabilityRouter); // Public
app.use('/api/preferences', authMiddleware, preferencesRouter);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Media Gateway API listening on port ${PORT}`);
  console.log(`ARW manifest available at http://localhost:${PORT}/.well-known/arw-manifest.json`);
});
```

**apps/api/src/routes/search.ts**
```typescript
import { Router } from 'express';
import { SearchService } from '@media-gateway/core';
import { AgentDB } from '@media-gateway/database';
import { SwarmCoordinator } from '@media-gateway/agents';

const router = Router();
const searchService = new SearchService();
const agentDB = new AgentDB();

/**
 * POST /api/search
 * Search for content using natural language
 */
router.post('/', async (req, res, next) => {
  try {
    const { query, userId, filters, limit = 20, offset = 0 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Use swarm coordinator to parse intent and execute search
    const swarmTask = {
      id: `search-${Date.now()}`,
      type: 'search' as const,
      input: { query, filters },
      userId
    };

    // This would integrate with the actual search service
    const results = await searchService.search({
      query,
      userId,
      filters,
      limit,
      offset
    });

    res.json({
      results,
      pagination: {
        limit,
        offset,
        total: results.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/search/feedback
 * Provide feedback on search results
 */
router.post('/feedback', async (req, res, next) => {
  try {
    const { searchId, resultId, feedback, userId } = req.body;

    // Store feedback for learning
    await agentDB.saveWatchEvent({
      id: `feedback-${Date.now()}`,
      userId,
      contentId: resultId,
      eventType: 'feedback',
      metadata: { searchId, feedback }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export { router as searchRouter };
```

**apps/api/src/routes/arw.ts**
```typescript
import { Router } from 'express';
import { ManifestGenerator } from '@media-gateway/arw';

const router = Router();
const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
const manifestGenerator = new ManifestGenerator(baseUrl);

/**
 * GET /.well-known/arw-manifest.json
 * Serve ARW manifest for agent integration
 */
router.get('/arw-manifest.json', (req, res) => {
  const manifest = manifestGenerator.generate();
  res.json(manifest);
});

export { router as arwRouter };
```

---

### Phase 4: Frontend Integration (Days 7-8)

**Objective:** Enhance existing media-discovery app and create new UI features

#### Task Breakdown

**Day 7 Morning: UI Component Library**
- [ ] Create `packages/@media-gateway/ui` with shared components
- [ ] Implement SearchBar component
- [ ] Implement ContentCard component
- [ ] Implement RecommendationList component
- [ ] Set up Storybook for component development

**Day 7 Afternoon: Main Web App**
- [ ] Enhance `apps/web` with Next.js App Router
- [ ] Create search interface
- [ ] Create recommendation feed
- [ ] Implement provider availability display
- [ ] Add deep-link buttons

**Day 8 Morning: Preference Learning UI**
- [ ] Create onboarding flow for new users
- [ ] Create preference dashboard
- [ ] Implement watch history timeline
- [ ] Add preference export/import

**Day 8 Afternoon: Group Features**
- [ ] Create group session UI
- [ ] Implement real-time updates (WebSocket/SSE)
- [ ] Add voting/consensus visualization
- [ ] Polish and responsive design

#### Key Deliverables

**packages/@media-gateway/ui/src/components/SearchBar.tsx**
```typescript
'use client';

import { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';

export interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  showAIBadge?: boolean;
}

export function SearchBar({
  onSearch,
  placeholder = "What should we watch tonight?",
  isLoading = false,
  showAIBadge = true
}: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-3xl">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          className="w-full pl-12 pr-24 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors"
        />
        {showAIBadge && (
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-medium rounded-full">
            <Sparkles className="w-3 h-3" />
            AI-Powered
          </div>
        )}
      </div>
      {isLoading && (
        <div className="absolute top-full left-0 right-0 mt-2">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              <span className="text-gray-600">Searching across all platforms...</span>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
```

**apps/web/src/app/page.tsx**
```typescript
'use client';

import { useState } from 'react';
import { SearchBar } from '@media-gateway/ui';
import { useSearch } from '@/hooks/useSearch';
import { ContentGrid } from '@/components/ContentGrid';
import { ProviderFilter } from '@/components/ProviderFilter';

export default function HomePage() {
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const { results, isLoading, search } = useSearch();

  const handleSearch = async (query: string) => {
    await search({
      query,
      filters: {
        providers: selectedProviders.length > 0 ? selectedProviders : undefined
      }
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            What should we watch tonight?
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Search across all your streaming platforms with AI-powered recommendations
          </p>

          <SearchBar
            onSearch={handleSearch}
            isLoading={isLoading}
            showAIBadge={true}
          />
        </div>

        {/* Provider Filter */}
        <ProviderFilter
          selectedProviders={selectedProviders}
          onProviderToggle={(providerId) => {
            setSelectedProviders(prev =>
              prev.includes(providerId)
                ? prev.filter(id => id !== providerId)
                : [...prev, providerId]
            );
          }}
        />

        {/* Results */}
        {results.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Found {results.length} results
            </h2>
            <ContentGrid results={results} />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && results.length === 0 && (
          <div className="text-center mt-16 text-gray-500">
            <p>Try searching for something like:</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[
                'Sci-fi movies from the 90s',
                'Feel-good comedies',
                'Critically acclaimed documentaries',
                'Action movies with Tom Cruise'
              ].map(example => (
                <button
                  key={example}
                  onClick={() => handleSearch(example)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
```

---

### Phase 5: Data Moat Features (Days 9-10)

**Objective:** Implement long-term value accumulation and analytics

#### Task Breakdown

**Day 9: Preference Accumulation Pipeline**
- [ ] Create nightly batch job for preference updates
- [ ] Implement incremental learning from watch events
- [ ] Create preference quality metrics
- [ ] Build preference visualization dashboard
- [ ] Implement A/B testing for recommendation algorithms

**Day 10: Social Graph & Cross-Platform Features**
- [ ] Implement social graph storage
- [ ] Create content matching pipeline across platforms
- [ ] Build moat metrics dashboard
- [ ] Create data export/import tools
- [ ] Document data retention policies

#### Key Deliverables

**packages/@media-gateway/core/src/services/MoatMetricsService.ts**
```typescript
import { AgentDB } from '@media-gateway/database';

export interface MoatMetrics {
  totalUsers: number;
  activeUsers: number;
  totalPreferenceVectors: number;
  totalWatchEvents: number;
  averagePreferenceQuality: number;
  recommendationAccuracy: number;
  crossPlatformMatches: number;
  socialConnections: number;
  dataRetentionDays: number;
  moatScore: number; // 0-100
}

export class MoatMetricsService {
  private db: AgentDB;

  constructor(db: AgentDB) {
    this.db = db;
  }

  /**
   * Calculate overall moat score and metrics
   */
  public async calculateMoatMetrics(): Promise<MoatMetrics> {
    // Query database for various metrics
    const totalUsers = this.getTotalUsers();
    const activeUsers = this.getActiveUsers();
    const totalPreferenceVectors = this.getTotalPreferenceVectors();
    const totalWatchEvents = this.getTotalWatchEvents();
    const avgPreferenceQuality = await this.calculateAveragePreferenceQuality();
    const recommendationAccuracy = await this.calculateRecommendationAccuracy();

    // Calculate moat score (composite metric)
    const moatScore = this.calculateMoatScore({
      totalUsers,
      activeUsers,
      totalPreferenceVectors,
      totalWatchEvents,
      avgPreferenceQuality,
      recommendationAccuracy
    });

    return {
      totalUsers,
      activeUsers,
      totalPreferenceVectors,
      totalWatchEvents,
      averagePreferenceQuality: avgPreferenceQuality,
      recommendationAccuracy,
      crossPlatformMatches: 0, // TODO: Implement
      socialConnections: 0, // TODO: Implement
      dataRetentionDays: 365 * 20, // 20 years
      moatScore
    };
  }

  /**
   * Calculate moat score: how defensible is our data advantage?
   */
  private calculateMoatScore(metrics: {
    totalUsers: number;
    activeUsers: number;
    totalPreferenceVectors: number;
    totalWatchEvents: number;
    avgPreferenceQuality: number;
    recommendationAccuracy: number;
  }): number {
    // Weighted composite score
    const userScore = Math.min((metrics.activeUsers / 10000) * 20, 20); // Max 20 points
    const dataScore = Math.min((metrics.totalWatchEvents / 100000) * 30, 30); // Max 30 points
    const qualityScore = metrics.avgPreferenceQuality * 25; // Max 25 points
    const accuracyScore = metrics.recommendationAccuracy * 25; // Max 25 points

    return Math.min(userScore + dataScore + qualityScore + accuracyScore, 100);
  }

  /**
   * Track moat metrics over time
   */
  public async trackMoatGrowth(dayNumber: number): Promise<void> {
    const metrics = await this.calculateMoatMetrics();

    // Store in time-series format
    this.db.db.prepare(`
      INSERT INTO moat_metrics_history
      (day, total_users, active_users, watch_events, moat_score, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      dayNumber,
      metrics.totalUsers,
      metrics.activeUsers,
      metrics.totalWatchEvents,
      metrics.moatScore,
      Date.now()
    );
  }

  private getTotalUsers(): number {
    const result = this.db.db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM user_preferences').get();
    return (result as any).count || 0;
  }

  private getActiveUsers(): number {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const result = this.db.db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM watch_events
      WHERE timestamp > ?
    `).get(oneDayAgo);
    return (result as any).count || 0;
  }

  private getTotalPreferenceVectors(): number {
    return this.getTotalUsers(); // One vector per user
  }

  private getTotalWatchEvents(): number {
    const result = this.db.db.prepare('SELECT COUNT(*) as count FROM watch_events').get();
    return (result as any).count || 0;
  }

  private async calculateAveragePreferenceQuality(): Promise<number> {
    // Quality based on number of watch events per user
    const result = this.db.db.prepare(`
      SELECT AVG(event_count) as avg_quality
      FROM (
        SELECT user_id, COUNT(*) as event_count
        FROM watch_events
        GROUP BY user_id
      )
    `).get();

    const avgEvents = (result as any).avg_quality || 0;
    // Normalize to 0-1 scale (assume 50 events = high quality)
    return Math.min(avgEvents / 50, 1.0);
  }

  private async calculateRecommendationAccuracy(): Promise<number> {
    // Calculate based on positive feedback vs total recommendations
    const result = this.db.db.prepare(`
      SELECT
        SUM(CASE WHEN rating >= 7 THEN 1 ELSE 0 END) as positive,
        COUNT(*) as total
      FROM watch_events
      WHERE event_type = 'rated'
    `).get();

    const positive = (result as any).positive || 0;
    const total = (result as any).total || 1;

    return positive / total;
  }
}
```

---

### Phase 6: Polish & Deploy (Days 11-12)

**Objective:** Optimize, secure, document, and deploy

#### Task Breakdown

**Day 11: Optimization & Security**
- [ ] Performance optimization (caching, indexing)
- [ ] Security audit and hardening
- [ ] Load testing
- [ ] Error handling improvements
- [ ] Logging and monitoring setup

**Day 12: Documentation & Deployment**
- [ ] Complete API documentation
- [ ] Write deployment guides
- [ ] Create demo video/presentation
- [ ] Deploy API to Google Cloud Run
- [ ] Deploy web app to Vercel
- [ ] Set up monitoring dashboards

#### Key Deliverables

**Docker Deployment**

**docker-compose.yml**
```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - AGENTDB_PATH=/data/agentdb.db
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - agentdb-data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://api:3001
    depends_on:
      - api
    restart: unless-stopped

volumes:
  agentdb-data:
    driver: local
```

**apps/api/Dockerfile**
```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN npm ci --only=production

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build API and required packages
RUN npm run build --workspace=@media-gateway/core
RUN npm run build --workspace=@media-gateway/database
RUN npm run build --workspace=@media-gateway/agents
RUN npm run build --workspace=@media-gateway/arw
RUN npm run build --workspace=apps/api

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 apiuser

COPY --from=builder --chown=apiuser:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=apiuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=apiuser:nodejs /app/packages ./packages

USER apiuser

EXPOSE 3001

ENV PORT 3001

CMD ["node", "dist/index.js"]
```

**Google Cloud Run Deployment**

**.github/workflows/deploy-api.yml**
```yaml
name: Deploy API to Cloud Run

on:
  push:
    branches:
      - main
    paths:
      - 'apps/api/**'
      - 'packages/**'
      - '.github/workflows/deploy-api.yml'

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  SERVICE_NAME: media-gateway-api
  REGION: us-central1

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          project_id: ${{ secrets.GCP_PROJECT_ID }}

      - name: Configure Docker
        run: gcloud auth configure-docker

      - name: Build and Push Container
        run: |
          docker build -t gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA -f apps/api/Dockerfile .
          docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy $SERVICE_NAME \
            --image gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA \
            --platform managed \
            --region $REGION \
            --allow-unauthenticated \
            --memory 2Gi \
            --cpu 2 \
            --set-env-vars="NODE_ENV=production" \
            --set-secrets="GOOGLE_API_KEY=google-api-key:latest,ANTHROPIC_API_KEY=anthropic-api-key:latest,JWT_SECRET=jwt-secret:latest"
```

---

## 3. Success Criteria & Validation

### Hackathon Deliverables Checklist

**Core Functionality**
- [ ] Natural language search working across TMDB content
- [ ] Personalized recommendations improving with each interaction
- [ ] Group decision-making feature functional
- [ ] Cross-platform availability checking
- [ ] ARW-compliant API serving manifest
- [ ] MCP server integrated

**Technical Requirements**
- [ ] Search latency < 200ms (p95)
- [ ] Recommendation accuracy > 70% (measured via user ratings)
- [ ] Test coverage > 80%
- [ ] 0 critical security vulnerabilities
- [ ] Mobile-responsive UI
- [ ] Production deployment successful

**Data Moat Metrics**
- [ ] User preferences accumulating in AgentDB
- [ ] Preference quality increasing over time
- [ ] Moat score calculation implemented
- [ ] Metrics dashboard showing improvement
- [ ] Day 1 vs Day 7 comparison ready

**Documentation & Presentation**
- [ ] API documentation complete
- [ ] Architecture diagrams created
- [ ] Demo video recorded
- [ ] Pitch deck prepared
- [ ] GitHub README comprehensive

### Testing Strategy

**Unit Tests**
```bash
# Run all unit tests
npm run test

# Run with coverage
npm run test:coverage

# Targets:
- packages/@media-gateway/core: 90% coverage
- packages/@media-gateway/database: 85% coverage
- packages/@media-gateway/agents: 80% coverage
- packages/@media-gateway/arw: 90% coverage
```

**Integration Tests**
```bash
# API integration tests
npm run test:integration --workspace=apps/api

# Test scenarios:
- Search flow end-to-end
- Recommendation generation
- Group decision workflow
- Preference learning pipeline
- ARW manifest serving
```

**Performance Tests**
```bash
# Load testing with k6
k6 run tests/load/search-load-test.js

# Targets:
- 100 concurrent users
- < 200ms p95 latency
- 0% error rate
```

---

## 4. Risk Mitigation

### Technical Risks

**Risk: Google Gemini API Rate Limits**
- **Mitigation**: Implement request batching, caching, and fallback to Claude
- **Monitoring**: Track API usage and set alerts at 80% quota

**Risk: AgentDB Performance at Scale**
- **Mitigation**: Implement proper indexing, connection pooling, query optimization
- **Monitoring**: Database query performance metrics

**Risk: Vector Search Accuracy**
- **Mitigation**: Use proven RuVector library, implement hybrid search (keyword + semantic)
- **Testing**: A/B test different embedding models

### Timeline Risks

**Risk: Scope Creep**
- **Mitigation**: Strict adherence to MVP features, defer nice-to-haves
- **Decision Framework**: Only implement if critical for demo

**Risk: Integration Complexity**
- **Mitigation**: Use established libraries, avoid custom implementations
- **Fallback**: Have simplified versions ready

---

## 5. Post-Hackathon Roadmap

### Phase 7: Advanced Features (Months 1-3)
- Voice interface integration
- Mobile app (React Native)
- Advanced social features
- Content availability alerts
- Watchlist synchronization across devices

### Phase 8: Scale & Optimize (Months 4-6)
- Multi-region deployment
- Advanced caching strategies
- Real-time collaborative filtering
- ML model optimization
- Enterprise features

### Phase 9: Monetization (Months 7-12)
- Premium tier with advanced AI features
- API access for third-party developers
- White-label solutions for streaming platforms
- Affiliate partnerships for content purchases

---

## 6. Conclusion

This SPARC Completion document provides the comprehensive implementation roadmap for the Media Gateway solution. The phased approach ensures systematic development from foundation through deployment, with clear success criteria and risk mitigation strategies.

**Key Success Factors:**
1. **Modular Architecture**: Monorepo structure enables independent package development and testing
2. **AI-First Design**: Google Gemini and Claude integration provides intelligent understanding and recommendations
3. **Data Moat Strategy**: AgentDB enables 20-year preference accumulation creating exponential value
4. **Agent-Ready**: ARW compliance ensures integration with autonomous AI agents
5. **Production-Ready**: Comprehensive testing, security, and deployment strategies

**Next Steps:**
1. Review and approve this completion plan
2. Set up development environment
3. Begin Phase 1: Foundation (Day 1)
4. Execute phases systematically
5. Prepare for demo and presentation

The Media Gateway solution solves a real problem affecting millions of streaming users while building a defensible data moat that increases in value over time. This implementation roadmap provides the blueprint to deliver a production-ready system within the hackathon timeline.

---

**Document Version:** 1.0
**Last Updated:** 2025-12-06
**Status:** Ready for Implementation
**Estimated Completion:** 12 days

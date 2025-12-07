# SPARC Architecture Phase: Media Gateway

**Status:** Architecture Design
**Version:** 1.0.0
**Date:** 2025-12-06
**Phase:** 3 of 5 (Specification → Pseudocode → **Architecture** → Refinement → Completion)

---

## Executive Summary

This architecture designs a Media Gateway solution that creates a **20-year competitive moat** by solving the "45-minute decision problem" in content discovery. The system leverages AgentDB v2.0's cognitive memory patterns, RuVector's high-performance embeddings, and Google's Gemini 2.5 Pro to build an intelligent, self-improving platform that becomes more valuable as it accumulates user preference data.

**Key Architectural Decisions:**
- **Data Moat Strategy:** User preference accumulation in AgentDB creates switching costs
- **Agent-Ready Web (ARW):** Machine-readable interfaces enable ecosystem growth
- **Multi-Agent Architecture:** Specialized agents for discovery, preferences, social, and providers
- **Monorepo Structure:** 8 packages with clear dependency boundaries
- **Edge-First Deployment:** Cloudflare/Vercel for global low-latency access
- **Privacy-Preserving Design:** Federated learning for collaborative filtering without data sharing

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Data Moat Architecture](#2-data-moat-architecture)
3. [Multi-Agent System Architecture](#3-multi-agent-system-architecture)
4. [ARW Integration Architecture](#4-arw-integration-architecture)
5. [Monorepo Package Architecture](#5-monorepo-package-architecture)
6. [Technology Stack](#6-technology-stack)
7. [Scalability & Performance Architecture](#7-scalability--performance-architecture)
8. [Security & Privacy Architecture](#8-security--privacy-architecture)
9. [Deployment Architecture](#9-deployment-architecture)
10. [API Architecture](#10-api-architecture)
11. [Database Schema Architecture](#11-database-schema-architecture)
12. [Integration Points](#12-integration-points)

---

## 1. System Architecture Overview

### 1.1 High-Level System Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                                │
│  ┌──────────────┬──────────────┬──────────────┬─────────────────────┐  │
│  │  Web App     │  Mobile App  │  Voice       │  MCP/Agent          │  │
│  │  (Next.js)   │  (React      │  Assistant   │  Interface          │  │
│  │              │   Native)    │  (Gemini)    │  (Claude/GPT)       │  │
│  └──────────────┴──────────────┴──────────────┴─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY LAYER                                 │
│  ┌──────────────┬──────────────┬──────────────┬─────────────────────┐  │
│  │  ARW         │  REST API    │  GraphQL     │  WebSocket          │  │
│  │  Manifest    │  (/api/v1)   │  (/graphql)  │  (Real-time)        │  │
│  │  (.well-     │              │              │                     │  │
│  │  known)      │              │              │                     │  │
│  └──────────────┴──────────────┴──────────────┴─────────────────────┘  │
│  Authentication & Rate Limiting & CORS                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    AGENT ORCHESTRATION LAYER                             │
│  ┌──────────────┬──────────────┬──────────────┬─────────────────────┐  │
│  │  Discovery   │  Preference  │  Social      │  Provider           │  │
│  │  Agent       │  Agent       │  Agent       │  Agent              │  │
│  │  (Search &   │  (Learning & │  (Group      │  (Netflix, Prime,   │  │
│  │   Intent)    │   Memory)    │   Recs)      │   Disney+, etc.)    │  │
│  └──────────────┴──────────────┴──────────────┴─────────────────────┘  │
│  Claude Flow Coordination + MCP Integration                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                        INTELLIGENCE LAYER                                │
│  ┌──────────────┬──────────────┬──────────────┬─────────────────────┐  │
│  │  AgentDB     │  RuVector    │  Gemini 2.5  │  Claude Opus        │  │
│  │  (Cognitive  │  (Embeddings │  Pro         │  4.5                │  │
│  │   Memory)    │   + HNSW)    │  (1M ctx)    │  (Reasoning)        │  │
│  │              │              │              │                     │  │
│  │  - Reflexion │  - 768-dim   │  - NL Query  │  - Complex          │  │
│  │  - Skills    │  - 61μs      │  - Grounding │    Analysis         │  │
│  │  - Causal    │    latency   │  - Multi-    │  - Explain          │  │
│  │  - Nightly   │  - 150x      │    modal     │    Decisions        │  │
│  │    Learner   │    faster    │              │                     │  │
│  └──────────────┴──────────────┴──────────────┴─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATA MOAT LAYER                                   │
│  ┌──────────────┬──────────────┬──────────────┬─────────────────────┐  │
│  │  User Taste  │  Watch       │  Social      │  Content            │  │
│  │  Graph       │  History     │  Graph       │  Knowledge Base     │  │
│  │  (768-dim    │  (Completion │  (Friend     │  (Cross-platform    │  │
│  │   vectors)   │   patterns)  │   network)   │   catalog)          │  │
│  │              │              │              │                     │  │
│  │  AgentDB     │  PostgreSQL  │  AgentDB     │  RuVector +         │  │
│  │  + RuVector  │  + Redis     │  Graph       │  TMDB API           │  │
│  └──────────────┴──────────────┴──────────────┴─────────────────────┘  │
│  Federated Learning for Privacy-Preserving Collaborative Filtering       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                        INTEGRATION LAYER                                 │
│  ┌──────────────┬──────────────┬──────────────┬─────────────────────┐  │
│  │  Netflix API │  Prime Video │  Disney+     │  HBO Max            │  │
│  │              │  API         │  API         │  API                │  │
│  └──────────────┴──────────────┴──────────────┴─────────────────────┘  │
│  ┌──────────────┬──────────────┬──────────────┬─────────────────────┐  │
│  │  Hulu API    │  Apple TV+   │  TMDB        │  JustWatch          │  │
│  │              │  API         │  (Metadata)  │  (Availability)     │  │
│  └──────────────┴──────────────┴──────────────┴─────────────────────┘  │
│  Rate-Limited Adapters + OAuth + Deep Linking                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Architecture

```
User Query ("thriller movies like Inception")
         ↓
    [Discovery Agent]
         ↓
    Natural Language → Intent Extraction → Query Expansion
         ↓
    [Preference Agent] ← Retrieves user taste vectors from AgentDB
         ↓
    RuVector Embedding (768-dim) + User Preferences
         ↓
    [Intelligence Layer]
         ↓
    Gemini 2.5 Pro: Semantic Search + Context Understanding
         ↓
    AgentDB: Retrieve similar watched content + patterns
         ↓
    [Social Agent] ← Check friend recommendations (optional)
         ↓
    Aggregate: Content Candidates (ranked by relevance)
         ↓
    [Provider Agent] ← Check availability across platforms
         ↓
    Filter by: User subscriptions + Region + Language
         ↓
    Final Results (with deep links to providers)
         ↓
    [User Interaction]
         ↓
    Feedback Loop → AgentDB (update taste vectors, learn patterns)
```

### 1.3 Key Architectural Principles

1. **Data Moat First:** Every interaction improves the system's understanding of user preferences
2. **Agent-Native:** ARW compliance enables ecosystem growth and third-party integrations
3. **Edge-First:** Deploy close to users for <100ms response times globally
4. **Privacy-Preserving:** Federated learning enables collaborative filtering without data centralization
5. **Fail-Safe:** Graceful degradation when external services are unavailable
6. **Cost-Efficient:** Local AgentDB (no cloud fees) + edge compute + API caching
7. **Self-Improving:** Nightly learner optimizes search patterns automatically

---

## 2. Data Moat Architecture

### 2.1 User Preference Graph Schema

**Stored in AgentDB with RuVector embeddings:**

```typescript
interface UserTasteVector {
  userId: string;
  embedding: Float32Array; // 768-dim RuVector embedding
  metadata: {
    genre_affinities: Record<string, number>; // e.g., {"thriller": 0.92, "sci-fi": 0.85}
    director_preferences: Record<string, number>; // e.g., {"Nolan": 0.95}
    actor_preferences: Record<string, number>;
    mood_mappings: Record<string, string[]>; // e.g., {"friday_evening": ["comedy", "action"]}
    temporal_patterns: {
      day_of_week: Record<string, number>; // Watch probability by day
      time_of_day: Record<string, number>; // Watch probability by hour
    };
    completion_patterns: {
      abandonment_threshold: number; // Minutes before abandoning content
      binge_probability: number; // Likelihood to watch multiple episodes
    };
  };
  created_at: Date;
  updated_at: Date;
  version: number; // For schema evolution
}

interface WatchHistory {
  userId: string;
  contentId: string;
  platform: string; // "netflix", "prime", etc.
  watched_at: Date;
  completion_percentage: number; // 0-100
  rating: number | null; // Explicit rating (1-5)
  implicit_rating: number; // Derived from completion + rewatch
  context: {
    device: string; // "mobile", "tv", "browser"
    location: string; // "home", "commute", etc.
    time_of_day: string; // "morning", "afternoon", "evening", "night"
    with_others: boolean; // Solo or group viewing
  };
}

interface ContentEmbedding {
  contentId: string;
  tmdb_id: number;
  title: string;
  embedding: Float32Array; // 768-dim RuVector embedding
  metadata: {
    genres: string[];
    directors: string[];
    actors: string[];
    year: number;
    runtime_minutes: number;
    language: string;
    keywords: string[]; // Extracted themes
  };
  availability: {
    platform: string;
    region: string;
    deep_link: string;
    subscription_required: boolean;
  }[];
  popularity_score: number;
  last_updated: Date;
}
```

### 2.2 AgentDB Cognitive Memory Patterns

**Leverage AgentDB's 6 cognitive patterns for defensibility:**

```typescript
// 1. Reflexion Memory: Self-critique of recommendations
interface ReflexionPattern {
  recommendationId: string;
  predicted_rating: number;
  actual_rating: number;
  error: number;
  self_critique: string; // "Overestimated user's interest in action scenes"
  adjustment: {
    feature: string; // "action_intensity"
    delta: number; // -0.15
  };
}

// 2. Skill Library: Reusable recommendation strategies
interface RecommendationSkill {
  skillId: string;
  name: string; // "mood_based_filter", "director_similarity", etc.
  code: string; // Executable logic
  success_rate: number;
  usage_count: number;
  last_used: Date;
}

// 3. Causal Memory: Interventions that improve recommendations
interface CausalIntervention {
  interventionId: string;
  hypothesis: string; // "Boosting recent releases improves engagement"
  treatment: any; // {"boost_recent": 1.2}
  control: any; // {"boost_recent": 1.0}
  outcome_metric: string; // "click_through_rate"
  effect_size: number; // +0.08 (8% improvement)
  confidence: number; // 0.95
}

// 4. Nightly Learner: Batch optimization overnight
interface NightlyOptimization {
  run_id: string;
  timestamp: Date;
  patterns_learned: number;
  embeddings_updated: number;
  skills_pruned: number;
  skills_created: number;
  performance_delta: {
    recall_at_10: number; // +0.03
    click_through_rate: number; // +0.05
  };
}
```

### 2.3 Social Graph for Network Effects

```typescript
interface SocialConnection {
  userId: string;
  friendId: string;
  connection_strength: number; // 0-1 based on shared watch history
  taste_correlation: number; // Pearson correlation of taste vectors
  created_at: Date;
}

interface GroupRecommendation {
  groupId: string;
  memberIds: string[];
  aggregated_preferences: Float32Array; // 768-dim vector (centroid)
  watch_together_history: {
    contentId: string;
    watched_at: Date;
    satisfaction_scores: Record<string, number>; // userId → rating
  }[];
}

interface RecommendationExchange {
  fromUserId: string;
  toUserId: string;
  contentId: string;
  message: string; // "You'll love this!"
  accepted: boolean;
  watched: boolean;
  rating: number | null;
  timestamp: Date;
}
```

### 2.4 Cross-Platform Identity Linking

```typescript
interface UserIdentity {
  userId: string; // Internal UUID
  email: string;
  platform_links: {
    platform: string; // "netflix", "prime", etc.
    externalId: string;
    oauth_token: string; // Encrypted
    oauth_refresh_token: string; // Encrypted
    linked_at: Date;
    last_synced: Date;
    sync_enabled: boolean;
  }[];
  privacy_settings: {
    share_watch_history: boolean;
    allow_friend_recommendations: boolean;
    participate_in_collaborative_filtering: boolean;
  };
}
```

### 2.5 Data Moat Growth Strategy

**Year 1-2:** Individual preference learning
- User taste vectors accumulate
- Watch history provides training data
- Reflexion improves recommendation accuracy

**Year 3-5:** Network effects kick in
- Social graph enables collaborative filtering
- Friend recommendations increase engagement
- Group viewing patterns provide unique insights

**Year 6-10:** Cross-platform dominance
- Unified identity across all streaming platforms
- Superior availability data (JustWatch integration)
- Causal interventions optimize for retention

**Year 11-20:** Insurmountable lead
- 10+ years of preference evolution per user
- Multi-generational watch history (families)
- Predictive models for content success before release

**Switching Cost:** Competitors cannot replicate 20 years of preference data

---

## 3. Multi-Agent System Architecture

### 3.1 Agent Taxonomy

**Built using Google ADK (Agent Development Kit) + Claude Flow orchestration:**

```typescript
// Base Agent Interface (all agents implement this)
interface BaseAgent {
  agentId: string;
  type: AgentType;
  capabilities: string[];
  dependencies: string[]; // Other agents this depends on

  initialize(): Promise<void>;
  execute(task: Task): Promise<Result>;
  learn(feedback: Feedback): Promise<void>;
  shutdown(): Promise<void>;
}

enum AgentType {
  DISCOVERY = "discovery",
  PREFERENCE = "preference",
  SOCIAL = "social",
  PROVIDER = "provider",
  CONTENT = "content",
  ORCHESTRATOR = "orchestrator"
}
```

### 3.2 Discovery Agent (Natural Language Understanding)

```typescript
interface DiscoveryAgent extends BaseAgent {
  // Core capabilities
  parseQuery(naturalLanguageQuery: string): Promise<ParsedQuery>;
  extractIntent(query: string): Promise<Intent>;
  expandQuery(intent: Intent): Promise<ExpandedQuery>;
  rankResults(candidates: Content[], context: UserContext): Promise<RankedResults>;
}

interface ParsedQuery {
  entities: {
    genres?: string[]; // ["thriller", "sci-fi"]
    actors?: string[]; // ["Leonardo DiCaprio"]
    directors?: string[]; // ["Christopher Nolan"]
    keywords?: string[]; // ["mind-bending", "heist"]
    year_range?: [number, number]; // [2000, 2023]
    mood?: string; // "exciting", "relaxing", etc.
  };
  constraints: {
    max_runtime?: number;
    language?: string;
    rating_min?: number;
  };
  context: {
    viewing_occasion?: string; // "date night", "family movie", "solo"
    device?: string; // "tv", "mobile"
  };
}

interface Intent {
  primary_goal: "discover" | "decide" | "schedule" | "share";
  specificity: "broad" | "narrow" | "exact";
  urgency: "immediate" | "planning" | "exploring";
}

// Implementation using Gemini 2.5 Pro
class GeminiDiscoveryAgent implements DiscoveryAgent {
  private gemini: GoogleGenerativeAI;
  private agentDb: AgentDB;

  async parseQuery(query: string): Promise<ParsedQuery> {
    // Use Gemini's function calling to extract structured data
    const prompt = `
      Extract structured information from this movie/TV search query.
      Query: "${query}"

      Return JSON with: genres, actors, directors, keywords, constraints, context.
    `;

    const result = await this.gemini.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [QueryExtractionTool], // Function calling
    });

    // Store pattern in AgentDB for future learning
    await this.agentDb.storePattern({
      input: query,
      output: result,
      success: true,
      timestamp: new Date(),
    });

    return result;
  }

  async expandQuery(intent: Intent): Promise<ExpandedQuery> {
    // Retrieve similar successful queries from AgentDB
    const similarQueries = await this.agentDb.searchPatterns({
      query: intent,
      k: 10,
      threshold: 0.8,
    });

    // Use Gemini to synthesize expanded query
    return this.gemini.expandWithContext(intent, similarQueries);
  }
}
```

### 3.3 Preference Agent (Learning & Memory)

```typescript
interface PreferenceAgent extends BaseAgent {
  // Cognitive memory operations
  getTasteVector(userId: string): Promise<Float32Array>;
  updatePreferences(userId: string, feedback: Feedback): Promise<void>;
  predictRating(userId: string, contentId: string): Promise<number>;
  explainRecommendation(userId: string, contentId: string): Promise<Explanation>;
}

// Implementation using AgentDB's cognitive patterns
class AgentDBPreferenceAgent implements PreferenceAgent {
  private agentDb: AgentDB;
  private reflexion: ReflexionMemory;
  private skills: SkillLibrary;
  private causal: CausalMemoryGraph;
  private nightly: NightlyLearner;

  async getTasteVector(userId: string): Promise<Float32Array> {
    // Retrieve from AgentDB's vector index
    const userProfile = await this.agentDb.query(`
      MATCH (u:User {id: $userId})-[:HAS_TASTE]->(t:TasteVector)
      RETURN t.embedding
    `, { userId });

    return userProfile.embedding;
  }

  async updatePreferences(userId: string, feedback: Feedback): Promise<void> {
    const currentVector = await this.getTasteVector(userId);

    // Use Reflexion to self-critique previous predictions
    const critique = await this.reflexion.analyze({
      predicted: feedback.predicted_rating,
      actual: feedback.actual_rating,
      context: feedback.context,
    });

    // Adjust taste vector based on critique
    const adjustment = critique.suggested_adjustment;
    const newVector = this.applyVectorAdjustment(currentVector, adjustment);

    // Store updated vector in AgentDB
    await this.agentDb.execute(`
      MATCH (u:User {id: $userId})-[r:HAS_TASTE]->(t:TasteVector)
      SET t.embedding = $newVector, t.updated_at = datetime()
    `, { userId, newVector });

    // Train causal models overnight (nightly learner)
    await this.nightly.scheduleOptimization({
      userId,
      feedback,
      priority: "high",
    });
  }

  async predictRating(userId: string, contentId: string): Promise<number> {
    // Retrieve best-performing skill from skill library
    const skill = await this.skills.getBestSkill({
      task: "rating_prediction",
      context: { userId, contentId },
    });

    // Execute skill
    const prediction = await skill.execute({ userId, contentId });

    // Update skill success metrics
    await this.skills.recordUsage(skill.id, prediction.confidence);

    return prediction.rating;
  }

  async explainRecommendation(
    userId: string,
    contentId: string
  ): Promise<Explanation> {
    // Use ExplainableRecall for Merkle proof-based explanations
    const explanation = await this.agentDb.explainableRecall.explain({
      userId,
      contentId,
      depth: 3, // Show 3 levels of reasoning
    });

    return {
      primary_reason: explanation.root_cause,
      supporting_factors: explanation.contributing_factors,
      evidence: explanation.merkle_proof, // Cryptographic proof of reasoning
      confidence: explanation.confidence_score,
    };
  }
}
```

### 3.4 Social Agent (Group Recommendations)

```typescript
interface SocialAgent extends BaseAgent {
  getFriendRecommendations(userId: string): Promise<Content[]>;
  aggregateGroupPreferences(groupId: string): Promise<Float32Array>;
  findSimilarTastes(userId: string): Promise<User[]>;
  facilitateWatchTogether(groupId: string, contentId: string): Promise<Session>;
}

class SocialGraphAgent implements SocialAgent {
  private agentDb: AgentDB;
  private graph: GraphDatabase;

  async getFriendRecommendations(userId: string): Promise<Content[]> {
    // Use AgentDB's graph queries (Cypher-like)
    const friendRecs = await this.agentDb.query(`
      MATCH (u:User {id: $userId})-[:FRIEND]->(f:User)
      MATCH (f)-[:WATCHED]->(c:Content)
      WHERE NOT (u)-[:WATCHED]->(c)
      WITH c, COUNT(f) as friend_count, AVG(f.rating) as avg_rating
      ORDER BY friend_count DESC, avg_rating DESC
      LIMIT 20
      RETURN c
    `, { userId });

    return friendRecs;
  }

  async aggregateGroupPreferences(groupId: string): Promise<Float32Array> {
    // Federated learning for privacy-preserving aggregation
    const members = await this.getGroupMembers(groupId);
    const vectors = await Promise.all(
      members.map(m => this.getTasteVector(m.userId))
    );

    // Compute centroid (average vector)
    return this.computeCentroid(vectors);
  }

  async findSimilarTastes(userId: string): Promise<User[]> {
    const userVector = await this.getTasteVector(userId);

    // Use RuVector's HNSW index for fast similarity search
    const similar = await this.agentDb.vectorSearch({
      query: userVector,
      k: 50,
      threshold: 0.7, // 70% similarity minimum
    });

    return similar.map(s => s.user);
  }
}
```

### 3.5 Provider Agent (Platform Integration)

```typescript
interface ProviderAgent extends BaseAgent {
  checkAvailability(contentId: string, userId: string): Promise<Availability[]>;
  generateDeepLink(contentId: string, platform: string): Promise<string>;
  syncWatchHistory(userId: string, platform: string): Promise<void>;
  estimateCost(contentId: string, platform: string): Promise<Cost>;
}

class MultiPlatformProviderAgent implements ProviderAgent {
  private adapters: Map<string, PlatformAdapter>;
  private cache: Cache;

  async checkAvailability(
    contentId: string,
    userId: string
  ): Promise<Availability[]> {
    // Check user's linked platforms
    const userPlatforms = await this.getUserPlatforms(userId);

    // Query JustWatch API + individual platform APIs in parallel
    const results = await Promise.all([
      this.queryJustWatch(contentId),
      ...userPlatforms.map(p => this.adapters.get(p)?.checkAvailability(contentId)),
    ]);

    // Cache results (availability changes slowly)
    await this.cache.set(`availability:${contentId}`, results, { ttl: 3600 });

    return results.flat();
  }

  async generateDeepLink(contentId: string, platform: string): Promise<string> {
    const adapter = this.adapters.get(platform);
    if (!adapter) throw new Error(`Platform ${platform} not supported`);

    // Platform-specific deep linking
    switch (platform) {
      case "netflix":
        return `https://www.netflix.com/watch/${contentId}`;
      case "prime":
        return `https://www.amazon.com/gp/video/detail/${contentId}`;
      case "disney":
        return `https://www.disneyplus.com/video/${contentId}`;
      // ... other platforms
    }
  }

  async syncWatchHistory(userId: string, platform: string): Promise<void> {
    const adapter = this.adapters.get(platform);
    const history = await adapter.fetchWatchHistory();

    // Store in AgentDB for preference learning
    for (const item of history) {
      await this.agentDb.execute(`
        MERGE (u:User {id: $userId})-[w:WATCHED]->(c:Content {id: $contentId})
        SET w.watched_at = $timestamp,
            w.completion = $completion,
            w.platform = $platform
      `, {
        userId,
        contentId: item.id,
        timestamp: item.watched_at,
        completion: item.completion_percentage,
        platform,
      });
    }

    // Trigger preference update
    await this.preferenceAgent.updatePreferences(userId, {
      type: "bulk_import",
      items: history,
    });
  }
}
```

### 3.6 Agent Orchestration with Claude Flow

```typescript
// Claude Flow coordination topology
interface AgentOrchestrator {
  topology: "hierarchical" | "mesh" | "adaptive";
  agents: BaseAgent[];

  route(task: Task): Promise<BaseAgent>;
  coordinate(task: Task): Promise<Result>;
  monitor(): Promise<Metrics>;
}

class MediaGatewayOrchestrator implements AgentOrchestrator {
  topology = "adaptive"; // Adapts based on query complexity

  async coordinate(task: Task): Promise<Result> {
    // Example: User query "What should I watch tonight?"

    // 1. Discovery Agent: Parse intent
    const intent = await this.discoveryAgent.parseQuery(task.query);

    // 2. Preference Agent: Get user taste vector
    const preferences = await this.preferenceAgent.getTasteVector(task.userId);

    // 3. Social Agent: Get friend recommendations (parallel)
    const socialRecs = this.socialAgent.getFriendRecommendations(task.userId);

    // 4. Content Agent: Search content database (parallel)
    const contentCandidates = this.contentAgent.search({
      intent,
      preferences,
      k: 100,
    });

    // Wait for parallel operations
    const [social, candidates] = await Promise.all([socialRecs, contentCandidates]);

    // 5. Merge and rank results
    const merged = this.mergeResults(candidates, social, preferences);

    // 6. Provider Agent: Check availability
    const available = await this.providerAgent.filterByAvailability(
      merged,
      task.userId
    );

    // 7. Return top recommendations with deep links
    return {
      recommendations: available.slice(0, 10),
      explanation: await this.preferenceAgent.explainRecommendation(
        task.userId,
        available[0].id
      ),
    };
  }
}
```

---

## 4. ARW Integration Architecture

### 4.1 ARW Manifest Design

**Location:** `/.well-known/arw-manifest.json`

```json
{
  "version": "1.0",
  "name": "Media Gateway",
  "description": "AI-native content discovery across streaming platforms",
  "capabilities": {
    "discovery": {
      "natural_language_search": true,
      "semantic_similarity": true,
      "personalized_recommendations": true,
      "group_recommendations": true
    },
    "integration": {
      "oauth_platforms": ["netflix", "prime", "disney", "hbo", "hulu", "apple"],
      "deep_linking": true,
      "watch_history_sync": true
    },
    "ai_features": {
      "preference_learning": true,
      "explainable_recommendations": true,
      "causal_interventions": true,
      "collaborative_filtering": true
    }
  },
  "endpoints": {
    "views": [
      {
        "path": "/arw/content/:id",
        "method": "GET",
        "description": "Machine-readable content view",
        "schema": {
          "@context": "https://schema.org",
          "@type": "Movie|TVSeries",
          "properties": ["name", "description", "genre", "director", "actor"]
        }
      },
      {
        "path": "/arw/user/:id/preferences",
        "method": "GET",
        "description": "User preference profile (privacy-controlled)",
        "authentication": "oauth2",
        "schema": {
          "@type": "UserPreferences",
          "properties": ["genres", "actors", "directors", "mood_preferences"]
        }
      }
    ],
    "actions": [
      {
        "path": "/arw/search",
        "method": "POST",
        "description": "Semantic content search",
        "input_schema": {
          "query": "string (natural language)",
          "filters": "object (optional constraints)",
          "user_id": "string (optional for personalization)"
        },
        "output_schema": {
          "results": "array of Content objects",
          "total": "number",
          "explanations": "array of Explanation objects"
        }
      },
      {
        "path": "/arw/recommend",
        "method": "POST",
        "description": "Personalized recommendations",
        "authentication": "oauth2",
        "input_schema": {
          "user_id": "string",
          "context": "object (viewing occasion, mood, etc.)",
          "limit": "number"
        },
        "output_schema": {
          "recommendations": "array of Content with deep links",
          "explanations": "array of reasoning chains"
        }
      },
      {
        "path": "/arw/group/recommend",
        "method": "POST",
        "description": "Group viewing recommendations",
        "authentication": "oauth2",
        "input_schema": {
          "group_id": "string",
          "member_ids": "array of user IDs",
          "context": "object"
        }
      }
    ],
    "mutations": [
      {
        "path": "/arw/feedback",
        "method": "POST",
        "description": "Submit feedback for learning",
        "authentication": "oauth2",
        "input_schema": {
          "user_id": "string",
          "content_id": "string",
          "rating": "number (1-5)",
          "implicit_signals": "object (completion, rewatch, etc.)"
        }
      }
    ]
  },
  "authentication": {
    "oauth2": {
      "authorization_endpoint": "/oauth/authorize",
      "token_endpoint": "/oauth/token",
      "scopes": ["read:preferences", "write:feedback", "read:recommendations"]
    }
  },
  "rate_limits": {
    "search": "100 requests per minute",
    "recommend": "60 requests per minute",
    "feedback": "unlimited"
  }
}
```

### 4.2 ARW Content View Implementation

```typescript
// /arw/content/:id endpoint
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const contentId = params.id;
  const content = await db.content.findUnique({ where: { id: contentId } });

  if (!content) {
    return new Response("Not found", { status: 404 });
  }

  // Return Schema.org-compliant JSON-LD
  const arwView = {
    "@context": "https://schema.org",
    "@type": content.type === "movie" ? "Movie" : "TVSeries",
    "name": content.title,
    "description": content.overview,
    "genre": content.genres,
    "director": content.directors.map(d => ({
      "@type": "Person",
      "name": d.name
    })),
    "actor": content.actors.map(a => ({
      "@type": "Person",
      "name": a.name
    })),
    "datePublished": content.release_date,
    "duration": `PT${content.runtime}M`,
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": content.avg_rating,
      "ratingCount": content.rating_count
    },
    "offers": content.availability.map(a => ({
      "@type": "Offer",
      "url": a.deep_link,
      "priceCurrency": "USD",
      "price": a.rental_price || 0,
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": a.platform
      }
    })),
    // ARW-specific extensions
    "x-arw": {
      "embedding": content.embedding, // 768-dim vector
      "similar_content": content.similar_ids,
      "watch_providers": content.availability.map(a => ({
        "platform": a.platform,
        "deep_link": a.deep_link,
        "subscription_required": a.subscription_required
      }))
    }
  };

  return Response.json(arwView, {
    headers: {
      "Content-Type": "application/ld+json",
      "Access-Control-Allow-Origin": "*", // Allow agent access
    }
  });
}
```

### 4.3 ARW Search Action Implementation

```typescript
// /arw/search endpoint
export async function POST(req: Request) {
  const { query, filters, user_id } = await req.json();

  // Use Discovery Agent for parsing
  const intent = await discoveryAgent.parseQuery(query);

  // Optionally personalize with user preferences
  let preferences = null;
  if (user_id) {
    preferences = await preferenceAgent.getTasteVector(user_id);
  }

  // Search content database with RuVector
  const results = await agentDb.vectorSearch({
    query: await embedQuery(query),
    filters: {
      genres: filters?.genres,
      year_range: filters?.year_range,
      rating_min: filters?.rating_min,
    },
    k: filters?.limit || 20,
    user_preferences: preferences,
  });

  // Generate explanations
  const explanations = await Promise.all(
    results.map(r => preferenceAgent.explainRecommendation(user_id, r.id))
  );

  return Response.json({
    results: results.map(r => ({
      id: r.id,
      title: r.title,
      type: r.type,
      genres: r.genres,
      relevance_score: r.score,
      deep_links: r.availability.map(a => a.deep_link),
    })),
    total: results.length,
    explanations: explanations,
  });
}
```

### 4.4 Agent Ecosystem Enablement

**ARW enables third-party agents to:**

1. **Discovery Agents:** Search our content database via `/arw/search`
2. **Recommendation Agents:** Get personalized suggestions via `/arw/recommend`
3. **Aggregator Agents:** Pull content views via `/arw/content/:id`
4. **Analytics Agents:** (Privacy-controlled) access user preference trends

**Example: Third-party voice assistant integration**

```typescript
// External agent (e.g., Google Assistant) using ARW
async function findMovieForUser(voiceQuery: string, userId: string) {
  const response = await fetch("https://media-gateway.com/arw/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${userOAuthToken}`,
    },
    body: JSON.stringify({
      query: voiceQuery,
      user_id: userId,
      limit: 5,
    }),
  });

  const { results, explanations } = await response.json();

  // Voice response
  return `Based on your preferences, I recommend ${results[0].title}. ${explanations[0].primary_reason}. It's available on ${results[0].deep_links[0]}.`;
}
```

---

## 5. Monorepo Package Architecture

### 5.1 Package Dependency Graph

```
@media-gateway/core (no dependencies)
    ↑
    ├─ @media-gateway/database (depends on AgentDB, RuVector)
    ↑   ↑
    │   ├─ @media-gateway/agents (depends on core, database, Google ADK)
    │   ↑   ↑
    │   │   ├─ @media-gateway/api (depends on all above)
    │   │   ↑
    │   ├─ @media-gateway/providers (depends on core)
    │       ↑
    │       └─ @media-gateway/api
    ↑
    ├─ @media-gateway/arw (depends on core)
    ↑   ↑
    │   └─ @media-gateway/api
    ↑
    ├─ @media-gateway/ui (depends on core, React 19)
    ↑   ↑
    │   └─ @media-gateway/web (Next.js app)
    ↑
    └─ @media-gateway/sdk (depends on core, arw)
```

### 5.2 Package Specifications

#### 5.2.1 @media-gateway/core

**Purpose:** Shared types, utilities, and business logic

```json
{
  "name": "@media-gateway/core",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": "./dist/index.js",
    "./types": "./dist/types/index.js",
    "./utils": "./dist/utils/index.js",
    "./errors": "./dist/errors/index.js"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

**Key exports:**

```typescript
// types/content.ts
export interface Content {
  id: string;
  type: "movie" | "tv_series";
  title: string;
  overview: string;
  genres: string[];
  release_date: Date;
  runtime_minutes: number;
  tmdb_id: number;
}

// types/user.ts
export interface User {
  id: string;
  email: string;
  created_at: Date;
}

// types/recommendation.ts
export interface Recommendation {
  content: Content;
  score: number;
  explanation: Explanation;
  deep_links: DeepLink[];
}

// utils/vector.ts
export function cosineSimilarity(a: Float32Array, b: Float32Array): number;
export function normalizeVector(v: Float32Array): Float32Array;
```

#### 5.2.2 @media-gateway/database

**Purpose:** AgentDB integration, RuVector embeddings, persistence

```json
{
  "name": "@media-gateway/database",
  "version": "1.0.0",
  "dependencies": {
    "@media-gateway/core": "workspace:*",
    "agentdb": "^2.0.0",
    "ruvector": "^0.1.31",
    "pg": "^8.11.0",
    "ioredis": "^5.3.0"
  }
}
```

**Key exports:**

```typescript
// agentdb-client.ts
export class AgentDBClient {
  private db: AgentDB;
  private embedder: EmbeddingService;

  constructor(config: AgentDBConfig) {
    this.db = new AgentDB(config.dbPath);
    this.embedder = new EmbeddingService({
      model: config.embeddingModel || "Xenova/all-MiniLM-L6-v2"
    });
  }

  async storeTasteVector(userId: string, vector: Float32Array): Promise<void>;
  async getTasteVector(userId: string): Promise<Float32Array>;
  async searchSimilarContent(query: Float32Array, k: number): Promise<Content[]>;
}

// postgres-client.ts (for structured data)
export class PostgresClient {
  async storeWatchHistory(entry: WatchHistory): Promise<void>;
  async getUserPlatforms(userId: string): Promise<PlatformLink[]>;
}

// redis-client.ts (for caching)
export class RedisClient {
  async cacheAvailability(contentId: string, data: Availability[]): Promise<void>;
  async getCachedAvailability(contentId: string): Promise<Availability[] | null>;
}
```

#### 5.2.3 @media-gateway/agents

**Purpose:** Multi-agent system (Discovery, Preference, Social, Provider)

```json
{
  "name": "@media-gateway/agents",
  "version": "1.0.0",
  "dependencies": {
    "@media-gateway/core": "workspace:*",
    "@media-gateway/database": "workspace:*",
    "@ai-sdk/google": "^1.0.0",
    "ai": "^4.0.0",
    "claude-flow": "^2.0.0"
  }
}
```

**Key exports:**

```typescript
export { DiscoveryAgent, GeminiDiscoveryAgent } from "./discovery";
export { PreferenceAgent, AgentDBPreferenceAgent } from "./preference";
export { SocialAgent, SocialGraphAgent } from "./social";
export { ProviderAgent, MultiPlatformProviderAgent } from "./provider";
export { AgentOrchestrator, MediaGatewayOrchestrator } from "./orchestrator";
```

#### 5.2.4 @media-gateway/providers

**Purpose:** Platform adapters (Netflix, Prime, Disney+, etc.)

```json
{
  "name": "@media-gateway/providers",
  "version": "1.0.0",
  "dependencies": {
    "@media-gateway/core": "workspace:*",
    "tmdb-ts": "^2.0.3",
    "axios": "^1.6.0"
  }
}
```

**Key exports:**

```typescript
export interface PlatformAdapter {
  platform: string;
  checkAvailability(contentId: string): Promise<Availability | null>;
  generateDeepLink(contentId: string): Promise<string>;
  syncWatchHistory(userId: string): Promise<WatchHistory[]>;
}

export class NetflixAdapter implements PlatformAdapter { }
export class PrimeVideoAdapter implements PlatformAdapter { }
export class DisneyPlusAdapter implements PlatformAdapter { }
export class HBOMaxAdapter implements PlatformAdapter { }
export class HuluAdapter implements PlatformAdapter { }
export class AppleTVAdapter implements PlatformAdapter { }

export class JustWatchClient {
  async getAvailability(contentId: string, region: string): Promise<Availability[]>;
}

export class TMDBClient {
  async getContent(tmdbId: number): Promise<Content>;
  async searchContent(query: string): Promise<Content[]>;
}
```

#### 5.2.5 @media-gateway/arw

**Purpose:** Agent-Ready Web compliance layer

```json
{
  "name": "@media-gateway/arw",
  "version": "1.0.0",
  "dependencies": {
    "@media-gateway/core": "workspace:*"
  }
}
```

**Key exports:**

```typescript
// manifest.ts
export function generateARWManifest(): ARWManifest;

// views.ts
export function contentToSchemaOrg(content: Content): SchemaOrgMovie | SchemaOrgTVSeries;

// actions.ts
export async function handleSearchAction(input: SearchInput): Promise<SearchOutput>;
export async function handleRecommendAction(input: RecommendInput): Promise<RecommendOutput>;
```

#### 5.2.6 @media-gateway/api

**Purpose:** REST + GraphQL + WebSocket API layer

```json
{
  "name": "@media-gateway/api",
  "version": "1.0.0",
  "dependencies": {
    "@media-gateway/core": "workspace:*",
    "@media-gateway/database": "workspace:*",
    "@media-gateway/agents": "workspace:*",
    "@media-gateway/providers": "workspace:*",
    "@media-gateway/arw": "workspace:*",
    "hono": "^4.0.0",
    "graphql": "^16.8.0",
    "ws": "^8.16.0"
  }
}
```

**Key exports:**

```typescript
// REST API routes
export const restAPI = new Hono()
  .get("/api/v1/search", searchHandler)
  .post("/api/v1/recommend", recommendHandler)
  .post("/api/v1/feedback", feedbackHandler)
  .get("/api/v1/content/:id", contentHandler);

// GraphQL schema
export const graphqlSchema = buildSchema(`
  type Query {
    search(query: String!, filters: FilterInput): [Content!]!
    recommendations(userId: ID!, context: ContextInput): [Recommendation!]!
    content(id: ID!): Content
  }

  type Mutation {
    submitFeedback(input: FeedbackInput!): Boolean
    linkPlatform(userId: ID!, platform: String!, oauthCode: String!): Boolean
  }
`);

// WebSocket handlers
export class RealtimeRecommendations {
  handleConnection(ws: WebSocket, userId: string): void;
  broadcastUpdate(userId: string, recommendation: Recommendation): void;
}
```

#### 5.2.7 @media-gateway/ui

**Purpose:** React 19 components (shared UI library)

```json
{
  "name": "@media-gateway/ui",
  "version": "1.0.0",
  "dependencies": {
    "@media-gateway/core": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^3.4.0"
  }
}
```

**Key exports:**

```typescript
// components/ContentCard.tsx
export function ContentCard({ content, onSelect }: ContentCardProps): JSX.Element;

// components/RecommendationList.tsx
export function RecommendationList({ recommendations }: RecommendationListProps): JSX.Element;

// components/SearchBar.tsx
export function SearchBar({ onSearch }: SearchBarProps): JSX.Element;

// components/ExplanationPanel.tsx
export function ExplanationPanel({ explanation }: ExplanationPanelProps): JSX.Element;
```

#### 5.2.8 @media-gateway/sdk

**Purpose:** Client SDK for third-party integrations

```json
{
  "name": "@media-gateway/sdk",
  "version": "1.0.0",
  "dependencies": {
    "@media-gateway/core": "workspace:*",
    "@media-gateway/arw": "workspace:*"
  }
}
```

**Key exports:**

```typescript
// sdk/client.ts
export class MediaGatewayClient {
  constructor(config: { apiUrl: string; apiKey: string });

  async search(query: string, options?: SearchOptions): Promise<Content[]>;
  async getRecommendations(userId: string, context?: Context): Promise<Recommendation[]>;
  async submitFeedback(userId: string, contentId: string, rating: number): Promise<void>;

  // ARW-based methods
  async fetchARWManifest(): Promise<ARWManifest>;
  async fetchContentView(contentId: string): Promise<SchemaOrgContent>;
}
```

### 5.3 Build & Development Scripts

**Root package.json:**

```json
{
  "name": "media-gateway",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

**turbo.json (build pipeline):**

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

---

## 6. Technology Stack

### 6.1 Frontend Stack

```yaml
framework: Next.js 15
  features:
    - App Router
    - Server Components
    - Server Actions
    - Edge Runtime

ui_library: React 19
  features:
    - Concurrent rendering
    - Server Components
    - Suspense
    - use() hook

styling: Tailwind CSS 3.4
  plugins:
    - @tailwindcss/forms
    - @tailwindcss/typography

state_management: TanStack Query 5
  features:
    - Server state caching
    - Optimistic updates
    - Infinite queries

ai_sdk: Vercel AI SDK 4.0
  providers:
    - @ai-sdk/google (Gemini)
    - @ai-sdk/openai (GPT-4)
```

### 6.2 Backend Stack

```yaml
runtime: Node.js 20 LTS

api_framework: Hono 4.0
  features:
    - Ultra-fast routing
    - Edge runtime support
    - TypeScript-first

database_primary: AgentDB v2.0
  backend: RuVector (Rust SIMD)
  features:
    - 150x faster than SQLite
    - 97.9% self-healing
    - Cognitive memory patterns
    - Graph queries (Cypher-like)

database_structured: PostgreSQL 16
  extensions:
    - pgvector (if AgentDB integration needed)
    - pg_cron (scheduled jobs)
  use_cases:
    - User accounts
    - Platform links
    - Watch history (structured)

cache: Redis 7
  use_cases:
    - Session storage
    - API response caching
    - Rate limiting
    - Real-time features

queue: BullMQ (Redis-based)
  use_cases:
    - Background embedding generation
    - Watch history sync
    - Nightly learning jobs
```

### 6.3 AI/ML Stack

```yaml
llm_primary: Google Gemini 2.5 Pro
  context_length: 1M tokens
  features:
    - Function calling
    - Grounding with Google Search
    - Multimodal (text, images)
  use_cases:
    - Natural language query parsing
    - Intent extraction
    - Query expansion
    - Explanation generation

llm_secondary: Claude Opus 4.5
  use_cases:
    - Complex reasoning
    - Long-form explanations
    - Quality evaluation

embeddings: RuVector
  model: all-MiniLM-L6-v2
  dimensions: 768
  performance: 61μs p50 latency

vector_search: AgentDB (RuVector backend)
  algorithm: HNSW
  features:
    - 8-head GNN attention
    - Beam search optimization
    - Self-healing index

collaborative_filtering: Federated Learning
  library: TensorFlow Federated
  use_cases:
    - Privacy-preserving taste correlation
    - Cross-user pattern discovery
```

### 6.4 Integration Stack

```yaml
content_metadata: TMDB API
  endpoints:
    - Movie/TV search
    - Content details
    - Credits (cast/crew)
    - Keywords & genres

availability: JustWatch API
  features:
    - Cross-platform availability
    - Regional pricing
    - New releases tracking

platform_integrations:
  netflix: Unofficial API (selenium-based fallback)
  prime_video: PA-API 5.0 (affiliate program)
  disney_plus: Unofficial API
  hbo_max: Unofficial API
  hulu: Unofficial API
  apple_tv: Apple TV+ API

oauth_providers:
  - Google (for user accounts)
  - Platform-specific OAuth (where available)
```

### 6.5 Infrastructure Stack

```yaml
hosting_primary: Cloudflare Workers
  features:
    - Global edge network
    - 0ms cold starts
    - KV storage (caching)
    - D1 database (SQLite at edge)
  use_cases:
    - API endpoints
    - ARW manifest serving
    - Static assets

hosting_secondary: Vercel
  features:
    - Next.js optimization
    - Edge functions
    - Preview deployments
  use_cases:
    - Web app hosting
    - API routes

cdn: Cloudflare CDN
  features:
    - Global caching
    - DDoS protection
    - Image optimization

monitoring: OpenTelemetry + Prometheus
  exporters:
    - Prometheus (metrics)
    - Jaeger (tracing)
    - Loki (logs)

error_tracking: Sentry

analytics: Plausible Analytics (privacy-focused)
```

---

## 7. Scalability & Performance Architecture

### 7.1 Horizontal Scaling Strategy

```yaml
scaling_layers:
  api_layer:
    platform: Cloudflare Workers
    instances: Auto-scaled globally
    max_concurrency: 1000 per instance
    cold_start: 0ms

  agent_layer:
    platform: Google Cloud Run
    instances: 0-100 (auto-scale)
    cpu: 2 vCPU per instance
    memory: 4 GB per instance
    scaling_triggers:
      - CPU > 70%
      - Request queue > 100
      - Response time p95 > 500ms

  database_layer:
    agentdb:
      sharding: By user_id (consistent hashing)
      shards: 8 (expandable to 64)
      replication: 2x per shard

    postgresql:
      primary: 1 (write)
      replicas: 3 (read)
      connection_pooling: PgBouncer (max 100 connections)

    redis:
      cluster_mode: Enabled
      shards: 3
      replicas: 1 per shard
```

### 7.2 Caching Architecture

```yaml
cache_layers:
  L1_edge_cache:
    provider: Cloudflare CDN
    ttl:
      static_assets: 365 days
      arw_manifest: 1 hour
      content_views: 1 hour
    cache_key_strategy: URL + query params

  L2_api_cache:
    provider: Cloudflare Workers KV
    ttl:
      search_results: 5 minutes
      content_metadata: 1 hour
      availability_data: 15 minutes

  L3_application_cache:
    provider: Redis
    ttl:
      user_taste_vectors: 1 hour (invalidate on feedback)
      content_embeddings: 24 hours
      platform_deep_links: 6 hours
    eviction_policy: LRU
    max_memory: 8 GB

  L4_database_cache:
    agentdb_internal: HNSW index in-memory
    postgresql_query_cache: Enabled (shared_buffers = 4GB)
```

### 7.3 Performance Optimizations

```yaml
vector_search:
  optimization: HNSW with beam search
  performance:
    p50_latency: 61 microseconds
    p95_latency: 120 microseconds
    p99_latency: 250 microseconds
  throughput: 32.6M ops/sec (RuVector)

embedding_generation:
  batch_size: 32
  parallelization: 4 workers
  hardware_acceleration: SIMD (AVX2)
  performance:
    single_embedding: 5ms
    batch_32: 40ms (1.25ms per item)

api_response_times:
  target:
    p50: < 100ms
    p95: < 300ms
    p99: < 500ms
  optimizations:
    - Edge deployment (Cloudflare)
    - Multi-layer caching
    - Database connection pooling
    - Async background jobs
    - GraphQL query batching

database_queries:
  postgresql:
    indexing:
      - B-tree on user_id, content_id
      - GiST on date ranges
      - Hash on platform
    query_optimization:
      - EXPLAIN ANALYZE on all queries
      - Materialized views for aggregations
      - Partition tables by date (watch_history)

  agentdb:
    optimization:
      - HNSW index (M=16, efConstruction=200)
      - 8-head GNN attention
      - Self-healing (97.9% uptime)
```

### 7.4 Load Balancing

```yaml
edge_load_balancing:
  provider: Cloudflare Load Balancer
  algorithm: Geo-steering (lowest latency)
  health_checks:
    interval: 30 seconds
    timeout: 5 seconds
    retries: 2

api_load_balancing:
  provider: Google Cloud Load Balancer
  algorithm: Round-robin with session affinity
  backend_services:
    - api-service (Cloud Run)
    - agent-orchestrator (Cloud Run)

database_load_balancing:
  postgresql:
    reads: PgBouncer pool (round-robin across replicas)
    writes: Primary only
  redis:
    client: ioredis (cluster mode)
    routing: Hash slot-based
```

### 7.5 Performance Monitoring

```yaml
metrics:
  api_latency:
    source: OpenTelemetry
    aggregation: p50, p95, p99
    alerting: p95 > 500ms

  vector_search_latency:
    source: AgentDB internal metrics
    aggregation: p50, p95, p99
    alerting: p99 > 1ms

  cache_hit_rate:
    sources: [Cloudflare, Redis]
    target: > 80%
    alerting: < 70%

  error_rate:
    source: Sentry
    aggregation: errors/minute
    alerting: > 10 errors/min

  agent_success_rate:
    source: Custom metrics
    calculation: successful_tasks / total_tasks
    target: > 95%
    alerting: < 90%

tracing:
  provider: Jaeger
  sampling: 1% (production), 100% (staging)
  spans:
    - API request handling
    - Agent execution
    - Database queries
    - External API calls
```

---

## 8. Security & Privacy Architecture

### 8.1 Authentication & Authorization

```yaml
authentication:
  primary_method: OAuth 2.0 + OIDC
  providers:
    - Google (for user accounts)
    - Platform-specific (Netflix, Prime, etc.)

  token_management:
    access_token:
      type: JWT
      algorithm: RS256
      expiry: 15 minutes
      claims: [user_id, email, roles, scopes]

    refresh_token:
      type: Opaque (random 256-bit)
      expiry: 7 days
      storage: Redis (encrypted)
      rotation: On each use

  session_management:
    storage: Redis
    ttl: 7 days
    security:
      - HttpOnly cookies
      - SameSite=Strict
      - Secure flag (HTTPS only)

authorization:
  model: RBAC (Role-Based Access Control)
  roles:
    - user: Read own data, submit feedback
    - premium_user: Advanced features, group recommendations
    - admin: Manage content, view analytics

  permissions:
    user:
      - "read:own_preferences"
      - "write:own_feedback"
      - "read:recommendations"
    premium_user:
      - "read:group_recommendations"
      - "write:friend_connections"
    admin:
      - "read:all_analytics"
      - "write:content_metadata"

  enforcement:
    layer: API middleware
    implementation: Casbin (policy engine)
```

### 8.2 Data Privacy & Compliance

```yaml
privacy_principles:
  - Data minimization (collect only what's needed)
  - Purpose limitation (use data only for stated purpose)
  - Storage limitation (delete data after retention period)
  - User control (export, delete, opt-out)

gdpr_compliance:
  legal_basis: Consent + Legitimate Interest

  user_rights:
    right_to_access:
      endpoint: /api/v1/user/export
      format: JSON
      delivery: Email link (expires in 7 days)

    right_to_erasure:
      endpoint: /api/v1/user/delete
      process:
        - Mark account as deleted
        - Anonymize watch history
        - Delete taste vectors
        - Revoke OAuth tokens
      retention: Anonymized data kept for 30 days (audit)

    right_to_portability:
      endpoint: /api/v1/user/export
      format: JSON (Schema.org compliant)
      includes: [watch_history, preferences, ratings]

  consent_management:
    granular_consent:
      - Essential (required for service)
      - Personalization (recommendation improvements)
      - Social features (friend recommendations)
      - Analytics (usage statistics)
    storage: PostgreSQL (consent_records table)
    versioning: Track consent changes over time

ccpa_compliance:
  do_not_sell:
    implementation: User preference flag
    effect: Exclude from aggregated analytics
    verification: Annual attestation

  opt_out_mechanism:
    endpoint: /api/v1/privacy/opt-out
    effect: Disable collaborative filtering

federated_learning:
  purpose: Privacy-preserving collaborative filtering
  mechanism:
    - Train local models on-device
    - Aggregate gradients (not raw data)
    - Differential privacy (ε=1.0, δ=10^-5)
  libraries: TensorFlow Federated

data_retention:
  watch_history: 2 years (then anonymized)
  taste_vectors: While account active + 30 days
  feedback: 5 years (aggregated analytics)
  logs: 90 days
```

### 8.3 Data Security

```yaml
encryption:
  at_rest:
    database:
      postgresql: AES-256-GCM (via pg_crypto)
      agentdb: AES-256-GCM (file-level)
      redis: RDB encryption (AES-256)

    oauth_tokens:
      algorithm: AES-256-GCM
      key_management: Google Cloud KMS
      rotation: Every 90 days

  in_transit:
    external: TLS 1.3 (minimum)
    internal: mTLS (service-to-service)
    cipher_suites: [TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256]

secrets_management:
  provider: Google Cloud Secret Manager
  secrets:
    - Database credentials
    - OAuth client secrets
    - API keys (TMDB, JustWatch)
    - Encryption keys
  rotation: Automatic (every 90 days)
  access_control: IAM roles (least privilege)

api_security:
  rate_limiting:
    algorithm: Token bucket
    limits:
      - Anonymous: 10 req/min
      - Authenticated: 100 req/min
      - Premium: 1000 req/min
    storage: Redis

  ddos_protection:
    provider: Cloudflare
    features:
      - Challenge pages (CAPTCHA)
      - IP reputation filtering
      - Rate limiting (L7)

  input_validation:
    library: Zod (TypeScript schema validation)
    sanitization: DOMPurify (for user-generated content)

  cors:
    allowed_origins: [https://media-gateway.com, https://*.media-gateway.com]
    allowed_methods: [GET, POST, PUT, DELETE]
    credentials: true

vulnerability_management:
  dependency_scanning: Snyk (daily)
  sast: SonarQube (on PR)
  dast: OWASP ZAP (weekly)
  penetration_testing: Annual (third-party)
```

### 8.4 Audit Logging

```yaml
audit_events:
  - User login/logout
  - OAuth token issuance/revocation
  - Data export requests
  - Account deletion requests
  - Admin actions (content updates)
  - Failed authentication attempts
  - Rate limit violations

log_format:
  timestamp: ISO 8601 (UTC)
  event_type: string
  user_id: UUID (or "anonymous")
  ip_address: string (anonymized after 90 days)
  user_agent: string
  action: string
  resource: string
  result: "success" | "failure"
  metadata: object

storage:
  provider: Google Cloud Logging
  retention: 1 year
  access_control: Admin role only
  encryption: AES-256

compliance_reporting:
  frequency: Monthly
  reports:
    - GDPR data subject requests
    - Security incidents
    - Access control changes
  distribution: Legal & compliance teams
```

---

## 9. Deployment Architecture

### 9.1 Infrastructure Topology

```yaml
production_environment:
  regions:
    - us-east1 (primary)
    - europe-west1 (secondary)
    - asia-southeast1 (tertiary)

  edge_network:
    provider: Cloudflare
    pops: 300+ globally
    features:
      - Anycast routing
      - DDoS protection
      - Edge caching
      - Workers (compute at edge)

  compute:
    api_gateway:
      platform: Cloudflare Workers
      instances: Auto-scaled globally
      cold_start: 0ms

    backend_services:
      platform: Google Cloud Run
      regions: [us-east1, europe-west1, asia-southeast1]
      min_instances: 1 (per region)
      max_instances: 100 (per region)
      cpu: 2 vCPU
      memory: 4 GB
      concurrency: 100 requests/instance

    web_app:
      platform: Vercel
      regions: Global (edge)
      features:
        - Next.js optimization
        - ISR (Incremental Static Regeneration)
        - Edge functions

  data_layer:
    agentdb:
      deployment: Self-hosted (Cloud Run)
      storage: Google Cloud Storage (persistent)
      backup: Daily snapshots
      replication: 2x per region

    postgresql:
      platform: Google Cloud SQL
      tier: db-custom-8-32768 (8 vCPU, 32 GB RAM)
      high_availability: Enabled (standby replica)
      backup: Automated daily + PITR (7 days)

    redis:
      platform: Google Cloud Memorystore
      tier: M5 (5 GB)
      high_availability: Enabled
      replication: Automatic
```

### 9.2 CI/CD Pipeline

```yaml
source_control:
  provider: GitHub
  branching_strategy: Trunk-based development
  branches:
    - main (production)
    - staging
    - feature/* (short-lived)

ci_pipeline:
  provider: GitHub Actions
  triggers:
    - Push to main/staging
    - Pull request creation

  stages:
    1_lint:
      - ESLint (JavaScript/TypeScript)
      - Prettier (formatting)
      - markdownlint (docs)

    2_typecheck:
      - TypeScript compilation
      - Type coverage report

    3_test:
      - Unit tests (Vitest)
      - Integration tests
      - E2E tests (Playwright)
      - Coverage threshold: 80%

    4_build:
      - Build all packages (turbo)
      - Build Docker images
      - Tag with commit SHA

    5_security:
      - Dependency scanning (Snyk)
      - SAST (SonarQube)
      - Secret detection (GitGuardian)

    6_deploy_staging:
      condition: Branch = staging
      targets:
        - Vercel (web app)
        - Cloud Run (backend)
        - Database migrations

    7_smoke_tests:
      - Health check endpoints
      - Critical user flows

    8_deploy_production:
      condition: Branch = main + manual approval
      strategy: Blue-green deployment
      rollback: Automatic (on health check failure)

cd_pipeline:
  deployment_strategy: Blue-green
  steps:
    1_provision_green:
      - Deploy new version to "green" environment
      - Run database migrations (non-breaking)
      - Warm up caches

    2_health_checks:
      - API health endpoints (200 OK)
      - Database connectivity
      - Redis connectivity
      - Agent orchestrator status

    3_canary_testing:
      - Route 10% traffic to green
      - Monitor error rates (< 1%)
      - Monitor latency (p95 < 500ms)
      - Duration: 15 minutes

    4_full_cutover:
      - Route 100% traffic to green
      - Keep blue running (5 minutes)

    5_cleanup:
      - Decommission blue environment
      - Update DNS records
      - Send deployment notification

  rollback_triggers:
    - Error rate > 5%
    - p95 latency > 1000ms
    - Health check failures
    - Manual trigger (ops team)
```

### 9.3 Disaster Recovery

```yaml
backup_strategy:
  agentdb:
    frequency: Every 6 hours
    retention: 30 days
    storage: Google Cloud Storage (multi-region)
    verification: Weekly restore test

  postgresql:
    frequency: Daily full + continuous PITR
    retention: 30 days
    storage: Google Cloud Storage (multi-region)
    verification: Weekly restore test

  redis:
    frequency: Daily RDB snapshots
    retention: 7 days
    storage: Google Cloud Storage
    note: Cache can be rebuilt from source

recovery_objectives:
  rpo: 1 hour (max data loss)
  rto: 4 hours (max downtime)

failover_procedures:
  database_failure:
    postgresql:
      - Automatic failover to standby replica (< 60s)
      - Promote replica to primary
      - Update connection strings
      - Alert ops team

    agentdb:
      - Restore from latest snapshot (< 6 hours old)
      - Rebuild HNSW index (< 30 minutes)
      - Warm up caches
      - Resume service

  region_failure:
    detection: Health checks fail in region (> 5 min)
    response:
      - Route traffic to healthy regions (automatic)
      - Scale up capacity in healthy regions
      - Investigate root cause
      - Restore failed region when stable

  total_outage:
    detection: All regions unhealthy
    response:
      - Activate incident response team
      - Restore from backups in new region
      - Update DNS to new infrastructure
      - Communicate with users (status page)

incident_response:
  severity_levels:
    P0_critical:
      - Service completely unavailable
      - Data loss occurring
      - Response: Immediate (on-call engineer)

    P1_high:
      - Partial service degradation
      - Response: < 1 hour

    P2_medium:
      - Minor feature broken
      - Response: < 4 hours

  communication:
    status_page: status.media-gateway.com
    updates: Every 30 minutes (during incident)
    post_mortem: Within 48 hours (P0/P1)
```

---

## 10. API Architecture

### 10.1 REST API Design

**Base URL:** `https://api.media-gateway.com/v1`

**Authentication:** Bearer token (JWT)

**Endpoints:**

```yaml
# Content Discovery
GET /search:
  description: Search content by natural language query
  query_params:
    - q: string (required) - Search query
    - limit: number (default: 20, max: 100)
    - filters: object (genres, year_range, etc.)
  response:
    results: Content[]
    total: number
    next_cursor: string | null

# Personalized Recommendations
POST /recommendations:
  description: Get personalized content recommendations
  auth: required
  body:
    user_id: string
    context: object (optional) - viewing_occasion, mood, etc.
    limit: number (default: 10)
  response:
    recommendations: Recommendation[]
    explanations: Explanation[]

# Group Recommendations
POST /recommendations/group:
  description: Aggregate recommendations for a group
  auth: required
  body:
    group_id: string
    member_ids: string[]
    context: object
  response:
    recommendations: Recommendation[]
    member_preferences: Record<string, Preference>

# Content Details
GET /content/:id:
  description: Get detailed content information
  response:
    Content object with full metadata

# Availability Check
GET /content/:id/availability:
  description: Check where content is available
  query_params:
    - region: string (default: user's region)
  response:
    availability: Availability[]
    deep_links: DeepLink[]

# User Feedback
POST /feedback:
  description: Submit user feedback for learning
  auth: required
  body:
    user_id: string
    content_id: string
    rating: number (1-5, optional)
    watched: boolean
    completion_percentage: number (0-100)
    context: object
  response:
    success: boolean

# Platform Linking
POST /platforms/link:
  description: Link user's streaming platform account
  auth: required
  body:
    platform: string
    oauth_code: string
  response:
    success: boolean
    platform_id: string

# Watch History Sync
POST /platforms/:platform/sync:
  description: Sync watch history from platform
  auth: required
  response:
    synced_items: number
    last_sync: timestamp
```

### 10.2 GraphQL Schema

```graphql
type Query {
  # Content search
  search(
    query: String!
    filters: FilterInput
    limit: Int = 20
    cursor: String
  ): SearchResult!

  # Personalized recommendations
  recommendations(
    userId: ID!
    context: ContextInput
    limit: Int = 10
  ): [Recommendation!]!

  # Group recommendations
  groupRecommendations(
    groupId: ID!
    memberIds: [ID!]!
    context: ContextInput
  ): GroupRecommendationResult!

  # Content details
  content(id: ID!): Content

  # User profile
  userProfile(userId: ID!): UserProfile

  # Friend recommendations
  friendRecommendations(userId: ID!, limit: Int = 20): [Content!]!
}

type Mutation {
  # Submit feedback
  submitFeedback(input: FeedbackInput!): Boolean!

  # Link platform
  linkPlatform(platform: String!, oauthCode: String!): PlatformLink!

  # Sync watch history
  syncWatchHistory(platform: String!): SyncResult!

  # Add friend
  addFriend(userId: ID!, friendId: ID!): Boolean!

  # Create group
  createGroup(name: String!, memberIds: [ID!]!): Group!
}

type Subscription {
  # Real-time recommendations
  recommendationUpdates(userId: ID!): Recommendation!

  # Friend activity
  friendActivity(userId: ID!): Activity!
}

# Types
type Content {
  id: ID!
  type: ContentType!
  title: String!
  overview: String!
  genres: [String!]!
  releaseDate: DateTime!
  runtime: Int
  cast: [Person!]!
  crew: [Person!]!
  availability: [Availability!]!
  embedding: [Float!]! # 768-dim vector
  similarContent: [Content!]!
}

type Recommendation {
  content: Content!
  score: Float!
  explanation: Explanation!
  deepLinks: [DeepLink!]!
}

type Explanation {
  primaryReason: String!
  supportingFactors: [String!]!
  evidence: [Evidence!]! # Merkle proof chain
  confidence: Float!
}

type Availability {
  platform: String!
  region: String!
  subscriptionRequired: Boolean!
  rentalPrice: Float
  purchasePrice: Float
  deepLink: String!
}

enum ContentType {
  MOVIE
  TV_SERIES
}

input FilterInput {
  genres: [String!]
  yearRange: [Int!] # [min, max]
  runtimeRange: [Int!]
  ratingMin: Float
  platforms: [String!]
}

input ContextInput {
  viewingOccasion: String # "date_night", "family", "solo"
  mood: String # "exciting", "relaxing", "thought-provoking"
  device: String # "tv", "mobile", "browser"
  timeAvailable: Int # minutes
}

input FeedbackInput {
  contentId: ID!
  rating: Float # 1-5
  watched: Boolean!
  completionPercentage: Float! # 0-100
  context: ContextInput
}
```

### 10.3 WebSocket Protocol

**Connection:** `wss://api.media-gateway.com/ws`

**Authentication:** Query param `?token=<jwt>`

**Message Format:**

```typescript
// Client → Server
interface ClientMessage {
  type: "subscribe" | "unsubscribe" | "heartbeat";
  channel: string; // "recommendations", "friend_activity"
  userId: string;
}

// Server → Client
interface ServerMessage {
  type: "recommendation_update" | "friend_activity" | "pong";
  data: any;
  timestamp: string;
}

// Example: Real-time recommendation update
{
  type: "recommendation_update",
  data: {
    recommendation: {
      content: { id: "123", title: "Inception", ... },
      score: 0.95,
      explanation: { primaryReason: "Based on your love of Christopher Nolan films" },
      deepLinks: [...]
    },
    reason: "new_content_available" // or "preference_update"
  },
  timestamp: "2025-12-06T20:00:00Z"
}
```

---

## 11. Database Schema Architecture

### 11.1 PostgreSQL Schema (Structured Data)

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- Soft delete for GDPR

  INDEX idx_users_email (email),
  INDEX idx_users_created_at (created_at)
);

-- OAuth platform links
CREATE TABLE platform_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL, -- "netflix", "prime", etc.
  external_id VARCHAR(255),
  oauth_token_encrypted TEXT, -- AES-256-GCM encrypted
  oauth_refresh_token_encrypted TEXT,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced TIMESTAMPTZ,
  sync_enabled BOOLEAN DEFAULT TRUE,

  UNIQUE(user_id, platform),
  INDEX idx_platform_links_user_id (user_id)
);

-- Watch history (structured data)
CREATE TABLE watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id VARCHAR(100) NOT NULL, -- External content ID
  platform VARCHAR(50) NOT NULL,
  watched_at TIMESTAMPTZ NOT NULL,
  completion_percentage FLOAT CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  rating FLOAT CHECK (rating >= 1 AND rating <= 5),
  implicit_rating FLOAT, -- Derived from completion + rewatch
  context JSONB, -- { device, location, time_of_day, with_others }

  INDEX idx_watch_history_user_id (user_id),
  INDEX idx_watch_history_content_id (content_id),
  INDEX idx_watch_history_watched_at (watched_at)
) PARTITION BY RANGE (watched_at);

-- Partition tables for watch_history (monthly partitions)
CREATE TABLE watch_history_2025_01 PARTITION OF watch_history
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
-- ... repeat for each month

-- Social connections
CREATE TABLE friend_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connection_strength FLOAT DEFAULT 0.5, -- 0-1
  taste_correlation FLOAT, -- Pearson correlation
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, friend_id),
  INDEX idx_friend_connections_user_id (user_id),
  CHECK (user_id != friend_id) -- Can't be friends with yourself
);

-- Groups for watch-together
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  INDEX idx_groups_created_by (created_by)
);

CREATE TABLE group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (group_id, user_id),
  INDEX idx_group_members_user_id (user_id)
);

-- Consent management (GDPR)
CREATE TABLE consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type VARCHAR(50) NOT NULL, -- "personalization", "social", "analytics"
  granted BOOLEAN NOT NULL,
  version INT NOT NULL, -- Consent policy version
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,

  INDEX idx_consent_records_user_id (user_id),
  INDEX idx_consent_records_type (consent_type)
);

-- Audit logs
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  event_type VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id),
  ip_address INET,
  user_agent TEXT,
  action VARCHAR(255) NOT NULL,
  resource VARCHAR(255),
  result VARCHAR(50) NOT NULL, -- "success", "failure"
  metadata JSONB,

  INDEX idx_audit_logs_user_id (user_id),
  INDEX idx_audit_logs_timestamp (timestamp),
  INDEX idx_audit_logs_event_type (event_type)
) PARTITION BY RANGE (timestamp);

-- Partition tables for audit_logs (monthly partitions)
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### 11.2 AgentDB Schema (Vector + Graph Data)

```typescript
// AgentDB uses Cypher-like graph queries
// Schema is defined through entity creation

// User taste vectors
await agentDb.execute(`
  CREATE (u:User {
    id: $userId,
    created_at: datetime()
  })

  CREATE (t:TasteVector {
    embedding: $embedding, // Float32Array (768-dim)
    genre_affinities: $genreAffinities, // Map<string, number>
    director_preferences: $directorPrefs,
    actor_preferences: $actorPrefs,
    mood_mappings: $moodMappings,
    temporal_patterns: $temporalPatterns,
    completion_patterns: $completionPatterns,
    updated_at: datetime(),
    version: 1
  })

  CREATE (u)-[:HAS_TASTE]->(t)
`);

// Content embeddings
await agentDb.execute(`
  CREATE (c:Content {
    id: $contentId,
    tmdb_id: $tmdbId,
    title: $title,
    type: $type, // "movie" | "tv_series"
    created_at: datetime()
  })

  CREATE (e:Embedding {
    vector: $embedding, // Float32Array (768-dim)
    genres: $genres,
    directors: $directors,
    actors: $actors,
    year: $year,
    runtime_minutes: $runtime,
    language: $language,
    keywords: $keywords,
    popularity_score: $popularity
  })

  CREATE (c)-[:HAS_EMBEDDING]->(e)
`);

// Watch relationships (for graph queries)
await agentDb.execute(`
  MATCH (u:User {id: $userId})
  MATCH (c:Content {id: $contentId})

  CREATE (u)-[w:WATCHED {
    platform: $platform,
    watched_at: datetime($timestamp),
    completion: $completionPercentage,
    rating: $rating,
    implicit_rating: $implicitRating,
    context: $context
  }]->(c)
`);

// Friend connections (for social recommendations)
await agentDb.execute(`
  MATCH (u1:User {id: $userId})
  MATCH (u2:User {id: $friendId})

  CREATE (u1)-[:FRIEND {
    strength: $connectionStrength,
    correlation: $tasteCorrelation,
    created_at: datetime()
  }]->(u2)
`);

// Reflexion memory (self-critique patterns)
await agentDb.storeReflexion({
  recommendationId: "rec-123",
  predicted_rating: 4.5,
  actual_rating: 3.0,
  error: -1.5,
  self_critique: "Overestimated user's interest in action-heavy content",
  adjustment: {
    feature: "action_intensity",
    delta: -0.2,
  },
});

// Skill library (reusable recommendation strategies)
await agentDb.storeSkill({
  name: "mood_based_filter",
  code: `
    function filter(content, userMood) {
      const moodGenreMap = {
        "relaxing": ["comedy", "romance", "documentary"],
        "exciting": ["action", "thriller", "sci-fi"],
        "thought-provoking": ["drama", "mystery", "documentary"]
      };
      return content.filter(c =>
        c.genres.some(g => moodGenreMap[userMood].includes(g))
      );
    }
  `,
  success_rate: 0.87,
  usage_count: 152,
});

// Causal memory (interventions)
await agentDb.storeCausalIntervention({
  hypothesis: "Boosting recent releases improves CTR",
  treatment: { boost_recent: 1.3 },
  control: { boost_recent: 1.0 },
  outcome_metric: "click_through_rate",
  effect_size: 0.08, // +8% CTR
  confidence: 0.95,
});
```

### 11.3 Redis Schema (Caching)

```typescript
// Cache key patterns

// User taste vectors (hot path optimization)
// Key: taste:${userId}
// Value: JSON.stringify(Float32Array)
// TTL: 1 hour (invalidated on feedback)
await redis.set(
  `taste:${userId}`,
  JSON.stringify(Array.from(tasteVector)),
  "EX",
  3600
);

// Content embeddings
// Key: embedding:${contentId}
// Value: JSON.stringify(Float32Array)
// TTL: 24 hours
await redis.set(
  `embedding:${contentId}`,
  JSON.stringify(Array.from(embedding)),
  "EX",
  86400
);

// Search results
// Key: search:${hash(query + filters)}
// Value: JSON.stringify(SearchResult)
// TTL: 5 minutes
await redis.set(
  `search:${queryHash}`,
  JSON.stringify(searchResults),
  "EX",
  300
);

// Availability data
// Key: availability:${contentId}:${region}
// Value: JSON.stringify(Availability[])
// TTL: 15 minutes
await redis.set(
  `availability:${contentId}:${region}`,
  JSON.stringify(availabilityData),
  "EX",
  900
);

// Rate limiting (token bucket)
// Key: ratelimit:${userId}:${endpoint}
// Value: number (remaining tokens)
// TTL: 60 seconds (sliding window)
await redis.set(
  `ratelimit:${userId}:search`,
  100, // 100 requests per minute
  "EX",
  60,
  "NX" // Only set if not exists
);

// Session storage
// Key: session:${sessionId}
// Value: JSON.stringify({ userId, email, ... })
// TTL: 7 days
await redis.set(
  `session:${sessionId}`,
  JSON.stringify(sessionData),
  "EX",
  604800
);

// Real-time presence (WebSocket connections)
// Key: online:${userId}
// Value: timestamp
// TTL: 5 minutes (heartbeat refresh)
await redis.set(
  `online:${userId}`,
  Date.now(),
  "EX",
  300
);
```

---

## 12. Integration Points

### 12.1 TMDB Integration

```typescript
// TMDB API client wrapper
class TMDBClient {
  private apiKey: string;
  private baseUrl = "https://api.themoviedb.org/3";

  async searchContent(query: string): Promise<Content[]> {
    const response = await fetch(
      `${this.baseUrl}/search/multi?api_key=${this.apiKey}&query=${encodeURIComponent(query)}`
    );
    const data = await response.json();
    return data.results.map(this.transformToContent);
  }

  async getContentDetails(tmdbId: number, type: "movie" | "tv"): Promise<Content> {
    const endpoint = type === "movie" ? "/movie" : "/tv";
    const response = await fetch(
      `${this.baseUrl}${endpoint}/${tmdbId}?api_key=${this.apiKey}&append_to_response=credits,keywords`
    );
    return this.transformToContent(await response.json());
  }

  async getWatchProviders(tmdbId: number, type: "movie" | "tv", region: string = "US"): Promise<Availability[]> {
    const endpoint = type === "movie" ? "/movie" : "/tv";
    const response = await fetch(
      `${this.baseUrl}${endpoint}/${tmdbId}/watch/providers?api_key=${this.apiKey}`
    );
    const data = await response.json();
    return this.transformToAvailability(data.results[region]);
  }
}
```

### 12.2 JustWatch Integration

```typescript
// JustWatch API client (unofficial API)
class JustWatchClient {
  private baseUrl = "https://apis.justwatch.com/content";

  async getAvailability(tmdbId: number, region: string = "US"): Promise<Availability[]> {
    const response = await fetch(
      `${this.baseUrl}/titles/movie/${tmdbId}/locale/${region.toLowerCase()}`
    );
    const data = await response.json();

    return data.offers.map(offer => ({
      platform: offer.provider_id,
      region,
      subscriptionRequired: offer.monetization_type === "flatrate",
      rentalPrice: offer.retail_price,
      deepLink: offer.urls.standard_web,
    }));
  }

  async searchContent(query: string, region: string = "US"): Promise<Content[]> {
    const response = await fetch(`${this.baseUrl}/titles/${region.toLowerCase()}/popular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        content_types: ["movie", "show"],
      }),
    });
    return (await response.json()).items;
  }
}
```

### 12.3 Platform Adapters

```typescript
// Netflix adapter (unofficial API via selenium)
class NetflixAdapter implements PlatformAdapter {
  platform = "netflix";

  async checkAvailability(contentId: string): Promise<Availability | null> {
    // Use web scraping or unofficial API
    // Netflix doesn't provide official API for availability
    const response = await this.scrapeNetflix(contentId);
    if (!response.available) return null;

    return {
      platform: "netflix",
      region: "US",
      subscriptionRequired: true,
      deepLink: `https://www.netflix.com/watch/${contentId}`,
    };
  }

  async syncWatchHistory(userId: string): Promise<WatchHistory[]> {
    // OAuth flow to access user's Netflix account
    const oauthToken = await this.getOAuthToken(userId);

    // Scrape watch history (no official API)
    const history = await this.scrapeWatchHistory(oauthToken);

    return history.map(item => ({
      userId,
      contentId: item.id,
      platform: "netflix",
      watched_at: item.timestamp,
      completion_percentage: item.progress,
      context: {
        device: item.device,
      },
    }));
  }
}

// Prime Video adapter (official API via affiliate program)
class PrimeVideoAdapter implements PlatformAdapter {
  platform = "prime";
  private paApiClient: ProductAdvertisingAPIClient;

  async checkAvailability(contentId: string): Promise<Availability | null> {
    const response = await this.paApiClient.getItems({
      ItemIds: [contentId],
      Resources: ["Offers.Listings.Price"],
    });

    if (!response.ItemsResult.Items.length) return null;

    const item = response.ItemsResult.Items[0];
    return {
      platform: "prime",
      region: "US",
      subscriptionRequired: item.Offers.Listings.some(l => l.Condition === "Prime"),
      rentalPrice: item.Offers.Listings.find(l => l.Condition === "Rental")?.Price.Amount,
      deepLink: item.DetailPageURL,
    };
  }
}
```

### 12.4 Google ADK Integration

```typescript
// Google Agent Development Kit integration
import { Agent, Task, Context } from "@google-genai/adk";

class MediaDiscoveryAgent extends Agent {
  async process(task: Task, context: Context): Promise<Response> {
    // Use Gemini 2.5 Pro for natural language understanding
    const intent = await this.gemini.parseIntent(task.query);

    // Retrieve user preferences from AgentDB
    const userPreferences = await this.agentDb.getTasteVector(context.userId);

    // Search content with RuVector embeddings
    const candidates = await this.vectorSearch({
      query: intent.embedding,
      userPreferences,
      filters: intent.filters,
    });

    // Rank with preference agent
    const ranked = await this.preferenceAgent.rank(candidates, context.userId);

    // Check availability with provider agent
    const available = await this.providerAgent.filterByAvailability(ranked, context.userId);

    return {
      recommendations: available.slice(0, 10),
      explanations: await this.explainRecommendations(available, context.userId),
    };
  }
}

// Register agent with Google ADK
const agent = new MediaDiscoveryAgent({
  name: "MediaGateway",
  description: "AI-native content discovery across streaming platforms",
  capabilities: ["search", "recommend", "explain"],
});

agent.register();
```

### 12.5 Claude Flow Orchestration

```typescript
// Claude Flow integration for multi-agent coordination
import { ClaudeFlow, SwarmTopology } from "claude-flow";

const flow = new ClaudeFlow({
  topology: "adaptive", // Adapts based on query complexity
  agents: [
    { type: "discovery", instance: new GeminiDiscoveryAgent() },
    { type: "preference", instance: new AgentDBPreferenceAgent() },
    { type: "social", instance: new SocialGraphAgent() },
    { type: "provider", instance: new MultiPlatformProviderAgent() },
  ],
});

// Orchestrate user query
const result = await flow.orchestrate({
  query: "What should I watch tonight?",
  userId: "user-123",
  context: {
    viewing_occasion: "solo",
    mood: "exciting",
    time_available: 120, // minutes
  },
});

// Flow automatically:
// 1. Routes to Discovery Agent (parse query)
// 2. Retrieves preferences (Preference Agent)
// 3. Checks friend recommendations (Social Agent, parallel)
// 4. Searches content (vectorSearch, parallel)
// 5. Filters by availability (Provider Agent)
// 6. Returns ranked results with explanations
```

---

## Conclusion

This SPARC Architecture document defines a comprehensive system design for the Media Gateway solution that creates a 20-year competitive moat through:

1. **Data Moat:** User preference accumulation in AgentDB with cognitive memory patterns
2. **Agent-Native Design:** ARW compliance enables ecosystem growth
3. **Multi-Agent Architecture:** Specialized agents (Discovery, Preference, Social, Provider) coordinated via Claude Flow
4. **Scalability:** Edge-first deployment with horizontal scaling and multi-layer caching
5. **Privacy-Preserving:** Federated learning for collaborative filtering
6. **Cost-Efficient:** Local AgentDB (no cloud fees), edge compute, aggressive caching

**Next Steps:**
1. **Refinement Phase:** Implement TDD workflow for each component
2. **Completion Phase:** Integrate all packages and deploy to production

**Key Metrics to Track:**
- User taste vector accuracy (Pearson correlation with actual ratings)
- Recommendation click-through rate (target: >15%)
- Search-to-watch conversion rate (target: >30%)
- API latency (p95 < 300ms)
- Cost per user per month (target: <$0.10)
- Data moat growth (preference data accumulated per user per month)

**Estimated Timeline:**
- Phase 4 (Refinement): 8 weeks
- Phase 5 (Completion): 4 weeks
- Total: 12 weeks to MVP

**Resources Required:**
- 2-3 Backend Engineers
- 1-2 Frontend Engineers
- 1 ML/AI Engineer
- 1 DevOps Engineer
- 1 Product Manager

---

*This architecture document is part of the SPARC (Specification → Pseudocode → Architecture → Refinement → Completion) methodology for the Agentics Foundation TV5 Hackathon.*

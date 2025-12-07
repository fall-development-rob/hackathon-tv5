# @media-gateway/agents

Multi-agent system for intelligent media discovery using Google Gemini and swarm orchestration.

## Installation

```bash
pnpm add @media-gateway/agents
```

## Agents

| Agent | Purpose |
|-------|---------|
| **DiscoveryAgent** | Natural language understanding with Gemini 2.0 |
| **PreferenceAgent** | Real-time preference learning |
| **SocialAgent** | Group session and consensus management |
| **ProviderAgent** | Cross-platform availability checking |

## Usage

```typescript
import { createSwarmCoordinator } from '@media-gateway/agents';

const coordinator = createSwarmCoordinator(dbWrapper, vectorWrapper, {
  topology: 'hierarchical', // or 'mesh', 'star'
  maxConcurrentTasks: 10,
  timeoutMs: 30000
});

// Initialize session
coordinator.initializeSession(sessionId, userId);

// Execute discovery task
const result = await coordinator.executeTask(
  'find action movies like John Wick',
  userId
);

console.log(result.data);        // Search results
console.log(result.agentsUsed);  // ['DiscoveryAgent', 'PreferenceAgent', 'ProviderAgent']
console.log(result.latencyMs);   // Execution time
```

## Environment Variables

```bash
GOOGLE_GEMINI_API_KEY=your-api-key  # For AI-powered intent parsing
```

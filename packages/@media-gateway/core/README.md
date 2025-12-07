# @media-gateway/core

Core business logic for Media Gateway - solving the 45-minute streaming decision problem.

## Installation

```bash
pnpm add @media-gateway/core
```

## Features

- **Type Definitions**: Comprehensive TypeScript types for media content, preferences, and agents
- **UserPreferenceService**: Adaptive preference learning with 768-dim vector embeddings
- **SemanticSearchService**: Vector-based semantic search with multi-criteria ranking
- **GroupRecommendationService**: Fairness-weighted group consensus algorithms

## Usage

```typescript
import {
  calculateSignalStrength,
  updatePreferenceVector,
  rankGroupCandidates,
  type MediaContent,
  type UserPreferences
} from '@media-gateway/core';

// Calculate learning signal from watch event
const signal = calculateSignalStrength(watchEvent);

// Update user's preference vector
const newVector = updatePreferenceVector(currentVector, contentEmbedding, learningRate);

// Rank content for group viewing
const ranked = rankGroupCandidates(candidates, groupMembers, fairnessThreshold);
```

## 20-Year Data Moat

This package implements the core algorithms for building long-term competitive advantages:
- Exponential moving average for preference learning
- Adaptive learning rates based on confidence
- Gini coefficient for group fairness scoring
- Maximin optimization for group satisfaction

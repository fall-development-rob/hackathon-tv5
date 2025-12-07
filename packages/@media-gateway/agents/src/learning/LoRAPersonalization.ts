/**
 * LoRA (Low-Rank Adaptation) Personalization Engine
 *
 * Implements efficient user-specific adaptations with:
 * - Low-rank matrix factorization (rank 4-16)
 * - <5ms inference latency
 * - ~10-40KB per adapter
 * - EWC++ regularization for anti-forgetting
 * - Support for thousands of adapters
 *
 * Algorithm: output = baseOutput + (scalingFactor / rank) * B @ A @ input
 */

import type { WatchEvent, UserPreferences } from '@media-gateway/core';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * User-specific LoRA adapter
 */
export interface UserLoRAAdapter {
  /** Unique user identifier */
  userId: string;
  /** LoRA rank (typically 4, 8, or 16) */
  rank: number;
  /** Down-projection matrix (embeddingDim × rank) */
  matrixA: Float32Array;
  /** Up-projection matrix (rank × embeddingDim) */
  matrixB: Float32Array;
  /** Scaling factor for LoRA contribution */
  scalingFactor: number;
  /** Embedding dimension (typically 64 or 768) */
  embeddingDim: number;
  /** Adapter version (incremented on updates) */
  version: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** EWC++ importance weights for anti-forgetting */
  fisherInformation: Float32Array | undefined;
  /** Training metadata */
  metadata: AdapterMetadata;
}

/**
 * Adapter training metadata
 */
export interface AdapterMetadata {
  /** Total training samples */
  totalSamples: number;
  /** Average training loss */
  avgLoss: number;
  /** Learning rate used */
  learningRate: number;
  /** Last training timestamp */
  lastTrainedAt: Date;
  /** Performance metrics */
  performance: {
    avgInferenceMs: number;
    sizeBytes: number;
  };
}

/**
 * LoRA training configuration
 */
export interface LoRAConfig {
  /** LoRA rank (default: 4) */
  rank?: number;
  /** Embedding dimension (default: 64) */
  embeddingDim?: number;
  /** Scaling factor (default: 1.0) */
  scalingFactor?: number;
  /** Learning rate for adapter updates (default: 0.001) */
  learningRate?: number;
  /** Enable EWC++ regularization (default: true) */
  useEWC?: boolean;
  /** EWC++ regularization strength (default: 0.5) */
  ewcLambda?: number;
  /** Gradient clipping threshold (default: 1.0) */
  gradientClipThreshold?: number;
}

/**
 * Feedback signal for adapter updates
 */
export interface AdapterFeedback {
  /** Content embedding before LoRA */
  contentEmbedding: Float32Array;
  /** Expected personalized embedding (target) */
  targetEmbedding: Float32Array | undefined;
  /** Reward signal (0-1) from watch event */
  reward: number;
  /** Watch event metadata */
  watchEvent: WatchEvent;
  /** Timestamp */
  timestamp: Date;
}

// ============================================================================
// Matrix Operations
// ============================================================================

/**
 * Matrix multiplication: C = A @ B
 * A is (m × k), B is (k × n), C is (m × n)
 */
function matrixMultiply(
  A: Float32Array,
  B: Float32Array,
  m: number,
  k: number,
  n: number
): Float32Array {
  const C = new Float32Array(m * n);

  // Optimized matrix multiplication with loop unrolling
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      const baseIdx = i * k;

      // Process 4 elements at a time for better cache utilization
      const unrolled = Math.floor(k / 4) * 4;
      for (let p = 0; p < unrolled; p += 4) {
        sum += (A[baseIdx + p] ?? 0) * (B[p * n + j] ?? 0) +
               (A[baseIdx + p + 1] ?? 0) * (B[(p + 1) * n + j] ?? 0) +
               (A[baseIdx + p + 2] ?? 0) * (B[(p + 2) * n + j] ?? 0) +
               (A[baseIdx + p + 3] ?? 0) * (B[(p + 3) * n + j] ?? 0);
      }

      // Handle remaining elements
      for (let p = unrolled; p < k; p++) {
        sum += (A[baseIdx + p] ?? 0) * (B[p * n + j] ?? 0);
      }

      C[i * n + j] = sum;
    }
  }

  return C;
}

/**
 * Matrix-vector multiplication: y = A @ x
 * A is (m × n), x is (n × 1), y is (m × 1)
 */
function matrixVectorMultiply(
  A: Float32Array,
  x: Float32Array,
  m: number,
  n: number
): Float32Array {
  const y = new Float32Array(m);

  for (let i = 0; i < m; i++) {
    let sum = 0;
    const baseIdx = i * n;

    // Loop unrolling for performance
    const unrolled = Math.floor(n / 4) * 4;
    for (let j = 0; j < unrolled; j += 4) {
      sum += (A[baseIdx + j] ?? 0) * (x[j] ?? 0) +
             (A[baseIdx + j + 1] ?? 0) * (x[j + 1] ?? 0) +
             (A[baseIdx + j + 2] ?? 0) * (x[j + 2] ?? 0) +
             (A[baseIdx + j + 3] ?? 0) * (x[j + 3] ?? 0);
    }

    for (let j = unrolled; j < n; j++) {
      sum += (A[baseIdx + j] ?? 0) * (x[j] ?? 0);
    }

    y[i] = sum;
  }

  return y;
}

/**
 * Outer product: C = x @ y^T
 * x is (m × 1), y is (n × 1), C is (m × n)
 */
function outerProduct(x: Float32Array, y: Float32Array): Float32Array {
  const m = x.length;
  const n = y.length;
  const C = new Float32Array(m * n);

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      C[i * n + j] = (x[i] ?? 0) * (y[j] ?? 0);
    }
  }

  return C;
}

/**
 * Element-wise operations
 */
function vectorAdd(a: Float32Array, b: Float32Array): Float32Array {
  const result = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = (a[i] ?? 0) + (b[i] ?? 0);
  }
  return result;
}

function vectorScale(v: Float32Array, scale: number): Float32Array {
  const result = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) {
    result[i] = (v[i] ?? 0) * scale;
  }
  return result;
}

function vectorSubtract(a: Float32Array, b: Float32Array): Float32Array {
  const result = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = (a[i] ?? 0) - (b[i] ?? 0);
  }
  return result;
}

/**
 * Clip gradient values to prevent explosion
 */
function clipGradient(grad: Float32Array, threshold: number): Float32Array {
  const norm = Math.sqrt(grad.reduce((sum, v) => sum + v * v, 0));

  if (norm > threshold) {
    const scale = threshold / norm;
    return vectorScale(grad, scale);
  }

  return grad;
}

// ============================================================================
// LoRA Personalization Engine
// ============================================================================

export class LoRAPersonalizationEngine {
  private readonly rank: number;
  private readonly embeddingDim: number;
  private readonly scalingFactor: number;
  private readonly learningRate: number;
  private readonly useEWC: boolean;
  private readonly ewcLambda: number;
  private readonly gradientClipThreshold: number;

  constructor(config: LoRAConfig = {}) {
    this.rank = config.rank ?? 4;
    this.embeddingDim = config.embeddingDim ?? 64;
    this.scalingFactor = config.scalingFactor ?? 1.0;
    this.learningRate = config.learningRate ?? 0.001;
    this.useEWC = config.useEWC !== false;
    this.ewcLambda = config.ewcLambda ?? 0.5;
    this.gradientClipThreshold = config.gradientClipThreshold ?? 1.0;
  }

  /**
   * Compute LoRA forward pass
   * output = baseEmbedding + (scalingFactor / rank) * B @ A @ input
   */
  computeLoRAForward(
    baseEmbedding: Float32Array,
    adapter: UserLoRAAdapter
  ): Float32Array {
    const startTime = performance.now();

    // Validate dimensions
    if (baseEmbedding.length !== adapter.embeddingDim) {
      throw new Error(
        `Embedding dimension mismatch: expected ${adapter.embeddingDim}, got ${baseEmbedding.length}`
      );
    }

    // Step 1: A @ input (rank × embeddingDim) @ (embeddingDim × 1) = (rank × 1)
    const aOutput = matrixVectorMultiply(
      adapter.matrixA,
      baseEmbedding,
      adapter.rank,
      adapter.embeddingDim
    );

    // Step 2: B @ (A @ input) (embeddingDim × rank) @ (rank × 1) = (embeddingDim × 1)
    const bOutput = matrixVectorMultiply(
      adapter.matrixB,
      aOutput,
      adapter.embeddingDim,
      adapter.rank
    );

    // Step 3: Scale by (scalingFactor / rank)
    const scale = adapter.scalingFactor / adapter.rank;
    const scaledOutput = vectorScale(bOutput, scale);

    // Step 4: Add to base embedding
    const finalOutput = vectorAdd(baseEmbedding, scaledOutput);

    // Track performance
    const inferenceTime = performance.now() - startTime;
    if (adapter.metadata && inferenceTime < 10) {
      // Update rolling average (exponential moving average)
      const alpha = 0.1;
      adapter.metadata.performance.avgInferenceMs =
        alpha * inferenceTime + (1 - alpha) * adapter.metadata.performance.avgInferenceMs;
    }

    return finalOutput;
  }

  /**
   * Update adapter based on feedback
   * Uses gradient descent with optional EWC++ regularization
   */
  updateAdapter(
    adapter: UserLoRAAdapter,
    feedback: AdapterFeedback[]
  ): UserLoRAAdapter {
    if (feedback.length === 0) {
      return adapter;
    }

    // Accumulate gradients from all feedback
    const gradA = new Float32Array(adapter.matrixA.length);
    const gradB = new Float32Array(adapter.matrixB.length);
    let totalLoss = 0;

    for (const fb of feedback) {
      // Compute current output
      const currentOutput = this.computeLoRAForward(fb.contentEmbedding, adapter);

      // Compute target (if not provided, use reward-weighted embedding)
      const target = fb.targetEmbedding ||
        vectorScale(fb.contentEmbedding, fb.reward);

      // Compute loss (MSE)
      const error = vectorSubtract(currentOutput, target);
      const loss = error.reduce((sum, e) => sum + e * e, 0) / error.length;
      totalLoss += loss;

      // Backpropagation through LoRA layers
      // d/dB = error @ (A @ input)^T / (scalingFactor / rank)
      // d/dA = B^T @ error @ input^T / (scalingFactor / rank)

      const scale = adapter.scalingFactor / adapter.rank;
      const scaledError = vectorScale(error, 1.0 / scale);

      // Compute A @ input
      const aOutput = matrixVectorMultiply(
        adapter.matrixA,
        fb.contentEmbedding,
        adapter.rank,
        adapter.embeddingDim
      );

      // Gradient for B: error @ aOutput^T
      const gradBCurrent = outerProduct(scaledError, aOutput);
      for (let i = 0; i < gradB.length; i++) {
        gradB[i] = (gradB[i] ?? 0) + (gradBCurrent[i] ?? 0);
      }

      // Gradient for A: B^T @ error @ input^T
      // First compute B^T @ error
      const bTransError = new Float32Array(adapter.rank);
      for (let i = 0; i < adapter.rank; i++) {
        let sum = 0;
        for (let j = 0; j < adapter.embeddingDim; j++) {
          sum += (adapter.matrixB[j * adapter.rank + i] ?? 0) * (scaledError[j] ?? 0);
        }
        bTransError[i] = sum;
      }

      // Then outer product with input
      const gradACurrent = outerProduct(bTransError, fb.contentEmbedding);
      for (let i = 0; i < gradA.length; i++) {
        gradA[i] = (gradA[i] ?? 0) + (gradACurrent[i] ?? 0);
      }
    }

    // Average gradients
    const batchSize = feedback.length;
    for (let i = 0; i < gradA.length; i++) {
      gradA[i] = (gradA[i] ?? 0) / batchSize;
    }
    for (let i = 0; i < gradB.length; i++) {
      gradB[i] = (gradB[i] ?? 0) / batchSize;
    }

    // Apply EWC++ regularization if enabled
    if (this.useEWC && adapter.fisherInformation) {
      for (let i = 0; i < gradA.length; i++) {
        gradA[i] = (gradA[i] ?? 0) + this.ewcLambda * (adapter.fisherInformation[i] ?? 0) * (adapter.matrixA[i] ?? 0);
      }
      for (let i = 0; i < gradB.length; i++) {
        const fisherIdx = gradA.length + i;
        gradB[i] = (gradB[i] ?? 0) + this.ewcLambda * (adapter.fisherInformation[fisherIdx] ?? 0) * (adapter.matrixB[i] ?? 0);
      }
    }

    // Clip gradients
    const clippedGradA = clipGradient(gradA, this.gradientClipThreshold);
    const clippedGradB = clipGradient(gradB, this.gradientClipThreshold);

    // Update matrices with gradient descent
    const newMatrixA = new Float32Array(adapter.matrixA.length);
    const newMatrixB = new Float32Array(adapter.matrixB.length);

    for (let i = 0; i < adapter.matrixA.length; i++) {
      newMatrixA[i] = (adapter.matrixA[i] ?? 0) - this.learningRate * (clippedGradA[i] ?? 0);
    }
    for (let i = 0; i < adapter.matrixB.length; i++) {
      newMatrixB[i] = (adapter.matrixB[i] ?? 0) - this.learningRate * (clippedGradB[i] ?? 0);
    }

    // Update Fisher information for EWC++ (diagonal approximation)
    let newFisherInformation: Float32Array | undefined;
    if (this.useEWC) {
      newFisherInformation = new Float32Array(gradA.length + gradB.length);

      // Fisher information ≈ gradient^2 (diagonal approximation)
      for (let i = 0; i < gradA.length; i++) {
        const val = gradA[i] ?? 0;
        newFisherInformation[i] = val * val;
      }
      for (let i = 0; i < gradB.length; i++) {
        const val = gradB[i] ?? 0;
        newFisherInformation[gradA.length + i] = val * val;
      }

      // Exponential moving average with old Fisher information
      if (adapter.fisherInformation) {
        const alpha = 0.9;
        for (let i = 0; i < newFisherInformation.length; i++) {
          newFisherInformation[i] =
            alpha * (adapter.fisherInformation[i] ?? 0) + (1 - alpha) * (newFisherInformation[i] ?? 0);
        }
      }
    }

    // Create updated adapter
    const avgLoss = totalLoss / batchSize;
    const updatedAdapter: UserLoRAAdapter = {
      ...adapter,
      matrixA: newMatrixA,
      matrixB: newMatrixB,
      version: adapter.version + 1,
      updatedAt: new Date(),
      fisherInformation: newFisherInformation,
      metadata: {
        ...adapter.metadata,
        totalSamples: adapter.metadata.totalSamples + batchSize,
        avgLoss: 0.9 * adapter.metadata.avgLoss + 0.1 * avgLoss,
        lastTrainedAt: new Date(),
      },
    };

    return updatedAdapter;
  }

  /**
   * Create new adapter for a user
   */
  createAdapter(
    userId: string,
    initialPreferences?: UserPreferences
  ): UserLoRAAdapter {
    // Xavier/Glorot initialization for matrices
    const limitA = Math.sqrt(6.0 / (this.embeddingDim + this.rank));
    const limitB = Math.sqrt(6.0 / (this.rank + this.embeddingDim));

    const matrixA = new Float32Array(this.rank * this.embeddingDim);
    const matrixB = new Float32Array(this.embeddingDim * this.rank);

    // Initialize with small random values
    for (let i = 0; i < matrixA.length; i++) {
      matrixA[i] = (Math.random() * 2 - 1) * limitA;
    }

    // Initialize B to zeros (common LoRA practice)
    for (let i = 0; i < matrixB.length; i++) {
      matrixB[i] = 0;
    }

    // If initial preferences provided, use them to bias initialization
    if (initialPreferences?.vector) {
      // Slight bias towards user's initial preferences in matrix B
      const prefVector = initialPreferences.vector;
      for (let i = 0; i < Math.min(this.embeddingDim, prefVector.length); i++) {
        const prefVal = prefVector[i] ?? 0;
        for (let j = 0; j < this.rank; j++) {
          const idx = i * this.rank + j;
          matrixB[idx] = (matrixB[idx] ?? 0) + prefVal * 0.01 * (Math.random() * 2 - 1) * limitB;
        }
      }
    }

    const now = new Date();
    const sizeBytes = this.calculateAdapterSize(matrixA, matrixB);

    return {
      userId,
      rank: this.rank,
      matrixA,
      matrixB,
      scalingFactor: this.scalingFactor,
      embeddingDim: this.embeddingDim,
      version: 1,
      createdAt: now,
      updatedAt: now,
      fisherInformation: this.useEWC
        ? new Float32Array(matrixA.length + matrixB.length)
        : undefined,
      metadata: {
        totalSamples: 0,
        avgLoss: 0,
        learningRate: this.learningRate,
        lastTrainedAt: now,
        performance: {
          avgInferenceMs: 0,
          sizeBytes,
        },
      },
    };
  }

  /**
   * Serialize adapter to binary format
   * Format: [version:4][rank:4][dim:4][scale:4][A data][B data][Fisher data?][metadata JSON length:4][metadata JSON]
   */
  serializeAdapter(adapter: UserLoRAAdapter): Uint8Array {
    // Calculate size
    const headerSize = 16; // version, rank, dim, scale (4 bytes each)
    const matrixASize = adapter.matrixA.length * 4;
    const matrixBSize = adapter.matrixB.length * 4;
    const fisherSize = adapter.fisherInformation ? adapter.fisherInformation.length * 4 : 0;

    const metadata = {
      userId: adapter.userId,
      version: adapter.version,
      createdAt: adapter.createdAt.toISOString(),
      updatedAt: adapter.updatedAt.toISOString(),
      metadata: adapter.metadata,
    };
    const metadataJson = JSON.stringify(metadata);
    const metadataBytes = new TextEncoder().encode(metadataJson);
    const metadataLengthSize = 4;

    const totalSize = headerSize + matrixASize + matrixBSize + fisherSize +
                     metadataLengthSize + metadataBytes.length;

    // Create buffer
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    let offset = 0;

    // Write header
    view.setUint32(offset, adapter.version, true); offset += 4;
    view.setUint32(offset, adapter.rank, true); offset += 4;
    view.setUint32(offset, adapter.embeddingDim, true); offset += 4;
    view.setFloat32(offset, adapter.scalingFactor, true); offset += 4;

    // Write matrix A
    for (let i = 0; i < adapter.matrixA.length; i++) {
      view.setFloat32(offset, adapter.matrixA[i] ?? 0, true);
      offset += 4;
    }

    // Write matrix B
    for (let i = 0; i < adapter.matrixB.length; i++) {
      view.setFloat32(offset, adapter.matrixB[i] ?? 0, true);
      offset += 4;
    }

    // Write Fisher information if present
    if (adapter.fisherInformation) {
      for (let i = 0; i < adapter.fisherInformation.length; i++) {
        view.setFloat32(offset, adapter.fisherInformation[i] ?? 0, true);
        offset += 4;
      }
    }

    // Write metadata
    view.setUint32(offset, metadataBytes.length, true); offset += 4;
    new Uint8Array(buffer, offset).set(metadataBytes);

    return new Uint8Array(buffer);
  }

  /**
   * Deserialize adapter from binary format
   */
  deserializeAdapter(data: Uint8Array): UserLoRAAdapter {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    // Read header
    const version = view.getUint32(offset, true); offset += 4;
    const rank = view.getUint32(offset, true); offset += 4;
    const embeddingDim = view.getUint32(offset, true); offset += 4;
    const scalingFactor = view.getFloat32(offset, true); offset += 4;

    // Read matrix A
    const matrixALength = rank * embeddingDim;
    const matrixA = new Float32Array(matrixALength);
    for (let i = 0; i < matrixALength; i++) {
      matrixA[i] = view.getFloat32(offset, true);
      offset += 4;
    }

    // Read matrix B
    const matrixBLength = embeddingDim * rank;
    const matrixB = new Float32Array(matrixBLength);
    for (let i = 0; i < matrixBLength; i++) {
      matrixB[i] = view.getFloat32(offset, true);
      offset += 4;
    }

    // Determine if Fisher information is present
    const metadataLengthOffset = data.length - 4;
    const metadataLength = view.getUint32(metadataLengthOffset, true);
    const fisherInfoPresent = offset + metadataLength + 4 < data.length;

    // Read Fisher information if present
    let fisherInformation: Float32Array | undefined;
    if (fisherInfoPresent) {
      const fisherLength = matrixALength + matrixBLength;
      fisherInformation = new Float32Array(fisherLength);
      for (let i = 0; i < fisherLength; i++) {
        fisherInformation[i] = view.getFloat32(offset, true);
        offset += 4;
      }
    }

    // Read metadata
    offset += 4; // Skip length field we already read
    const metadataBytes = new Uint8Array(data.buffer, data.byteOffset + offset, metadataLength);
    const metadataJson = new TextDecoder().decode(metadataBytes);
    const metadata = JSON.parse(metadataJson);

    return {
      userId: metadata.userId,
      rank,
      matrixA,
      matrixB,
      scalingFactor,
      embeddingDim,
      version,
      createdAt: new Date(metadata.createdAt),
      updatedAt: new Date(metadata.updatedAt),
      fisherInformation,
      metadata: metadata.metadata,
    };
  }

  /**
   * Batch process multiple embeddings with LoRA
   */
  batchComputeLoRAForward(
    baseEmbeddings: Float32Array[],
    adapter: UserLoRAAdapter
  ): Float32Array[] {
    return baseEmbeddings.map(embedding =>
      this.computeLoRAForward(embedding, adapter)
    );
  }

  /**
   * Calculate adapter size in bytes
   */
  private calculateAdapterSize(matrixA: Float32Array, matrixB: Float32Array): number {
    // Header + matrices + metadata overhead
    const headerSize = 16;
    const matrixSize = (matrixA.length + matrixB.length) * 4;
    const metadataOverhead = 256; // Approximate JSON overhead
    return headerSize + matrixSize + metadataOverhead;
  }

  /**
   * Merge multiple adapters (for transfer learning or ensemble)
   */
  mergeAdapters(adapters: UserLoRAAdapter[], weights?: number[]): UserLoRAAdapter {
    if (adapters.length === 0) {
      throw new Error('At least one adapter required for merging');
    }

    // Validate all adapters have same dimensions
    const firstAdapter = adapters[0]!;
    const rank = firstAdapter.rank;
    const embeddingDim = firstAdapter.embeddingDim;

    for (const adapter of adapters) {
      if (adapter.rank !== rank || adapter.embeddingDim !== embeddingDim) {
        throw new Error('All adapters must have same dimensions for merging');
      }
    }

    // Default to equal weights
    const mergeWeights = weights || new Array(adapters.length).fill(1.0 / adapters.length);

    // Normalize weights
    const totalWeight = mergeWeights.reduce((sum, w) => sum + w, 0);
    const normalizedWeights = mergeWeights.map(w => w / totalWeight);

    // Merge matrices
    const matrixA = new Float32Array(firstAdapter.matrixA.length);
    const matrixB = new Float32Array(firstAdapter.matrixB.length);

    for (let i = 0; i < adapters.length; i++) {
      const weight = normalizedWeights[i] ?? 0;
      const adapter = adapters[i]!;

      for (let j = 0; j < matrixA.length; j++) {
        matrixA[j] = (matrixA[j] ?? 0) + (adapter.matrixA[j] ?? 0) * weight;
      }
      for (let j = 0; j < matrixB.length; j++) {
        matrixB[j] = (matrixB[j] ?? 0) + (adapter.matrixB[j] ?? 0) * weight;
      }
    }

    const now = new Date();
    const sizeBytes = this.calculateAdapterSize(matrixA, matrixB);

    return {
      userId: 'merged',
      rank,
      matrixA,
      matrixB,
      scalingFactor: firstAdapter.scalingFactor,
      embeddingDim,
      version: 1,
      createdAt: now,
      updatedAt: now,
      fisherInformation: undefined,
      metadata: {
        totalSamples: adapters.reduce((sum, a) => sum + a.metadata.totalSamples, 0),
        avgLoss: adapters.reduce((sum, a) => sum + a.metadata.avgLoss, 0) / adapters.length,
        learningRate: this.learningRate,
        lastTrainedAt: now,
        performance: {
          avgInferenceMs: 0,
          sizeBytes,
        },
      },
    };
  }

  /**
   * Get configuration
   */
  getConfig(): LoRAConfig {
    return {
      rank: this.rank,
      embeddingDim: this.embeddingDim,
      scalingFactor: this.scalingFactor,
      learningRate: this.learningRate,
      useEWC: this.useEWC,
      ewcLambda: this.ewcLambda,
      gradientClipThreshold: this.gradientClipThreshold,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create LoRA personalization engine
 */
export function createLoRAPersonalizationEngine(
  config?: LoRAConfig
): LoRAPersonalizationEngine {
  return new LoRAPersonalizationEngine(config);
}

/**
 * Create adapter feedback from watch event
 */
export function createAdapterFeedback(
  watchEvent: WatchEvent,
  contentEmbedding: Float32Array,
  targetEmbedding?: Float32Array
): AdapterFeedback {
  // Calculate reward from watch event
  const completionReward = watchEvent.completionRate * 0.5;
  const ratingReward = watchEvent.rating ? (watchEvent.rating / 5) * 0.3 : 0;
  const rewatchBonus = watchEvent.isRewatch ? 0.2 : 0;
  const reward = Math.min(1.0, completionReward + ratingReward + rewatchBonus);

  return {
    contentEmbedding,
    targetEmbedding,
    reward,
    watchEvent,
    timestamp: new Date(),
  };
}

// ============================================================================
// Exports
// ============================================================================

export default LoRAPersonalizationEngine;

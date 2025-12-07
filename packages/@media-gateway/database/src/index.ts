/**
 * @media-gateway/database
 *
 * Database layer with AgentDB cognitive memory and RuVector embeddings
 * Foundation of the 20-year data moat strategy
 */

// AgentDB integration
export { AgentDBWrapper, createAgentDB } from './agentdb/index.js';

// RuVector integration
export { RuVectorWrapper, createRuVector, cosineSimilarity } from './ruvector/index.js';

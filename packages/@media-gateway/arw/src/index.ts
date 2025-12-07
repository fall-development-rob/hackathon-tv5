/**
 * @media-gateway/arw
 *
 * Agent-Ready Web (ARW) specification implementation
 * Enables AI agents to discover and interact with the Media Gateway API
 */

// Manifest generation
export {
  ManifestGenerator,
  createManifestGenerator,
  ARWManifestSchema,
  type ARWManifest,
  type ARWEndpoint,
  type ARWParameter,
} from './manifest/index.js';

// Machine views
export {
  MachineViewGenerator,
  createMachineViewGenerator,
  getMachineViewHeaders,
  type ViewFormat,
  type MachineViewConfig,
  type JsonLdContent,
  type ARWView,
} from './views/index.js';

// Middleware
export {
  createARWMiddleware,
  createARWResponseHelper,
  isAgentRequest,
  getPreferredFormat,
  getARWCorsHeaders,
  getRateLimitHeaders,
  ARWResponseHelper,
  type ARWRequest,
  type ARWResponse,
  type NextFunction,
  type ARWMiddlewareConfig,
  type RateLimitContext,
} from './middleware/index.js';

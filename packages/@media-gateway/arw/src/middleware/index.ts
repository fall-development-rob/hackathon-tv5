/**
 * ARW Middleware
 * Express/Next.js middleware for ARW protocol handling
 * Provides automatic content negotiation and machine view generation
 */

import type { MediaContent, Recommendation, GroupSession } from '@media-gateway/core';
import { MachineViewGenerator, ViewFormat, getMachineViewHeaders } from '../views/index.js';
import { ManifestGenerator, type ARWManifest } from '../manifest/index.js';

/**
 * Request-like interface for framework agnostic middleware
 */
export interface ARWRequest {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  path?: string;
  method?: string;
}

/**
 * Response-like interface for framework agnostic middleware
 */
export interface ARWResponse {
  setHeader(name: string, value: string): void;
  json(data: any): void;
  send(data: string): void;
  status(code: number): ARWResponse;
}

/**
 * Next function for middleware chaining
 */
export type NextFunction = (error?: any) => void;

/**
 * ARW middleware configuration
 */
export interface ARWMiddlewareConfig {
  baseUrl: string;
  version?: string;
  enableManifest?: boolean;
  manifestPath?: string;
  enableMachineViews?: boolean;
  defaultFormat?: ViewFormat;
}

/**
 * Detect if request is from an AI agent
 */
export function isAgentRequest(req: ARWRequest): boolean {
  const userAgent = getHeader(req, 'user-agent')?.toLowerCase() ?? '';
  const accept = getHeader(req, 'accept')?.toLowerCase() ?? '';

  // Check for known AI agent user agents
  const agentPatterns = [
    'claude',
    'chatgpt',
    'gpt-4',
    'anthropic',
    'openai',
    'google-bard',
    'gemini',
    'copilot',
    'assistant',
    'bot',
    'agent',
  ];

  const isAgentUA = agentPatterns.some(pattern => userAgent.includes(pattern));

  // Check for ARW-specific accept headers
  const isARWAccept = accept.includes('application/vnd.arw+json') ||
                       accept.includes('application/ld+json');

  // Check for X-ARW-Agent header
  const hasARWHeader = !!getHeader(req, 'x-arw-agent');

  return isAgentUA || isARWAccept || hasARWHeader;
}

/**
 * Get preferred view format from request
 */
export function getPreferredFormat(req: ARWRequest, defaultFormat: ViewFormat = 'json'): ViewFormat {
  const accept = getHeader(req, 'accept')?.toLowerCase() ?? '';
  const formatQuery = req.query?.format as string | undefined;

  if (formatQuery) {
    if (formatQuery === 'arw' || formatQuery === 'json-ld' || formatQuery === 'json') {
      return formatQuery;
    }
  }

  if (accept.includes('application/vnd.arw+json')) {
    return 'arw';
  }

  if (accept.includes('application/ld+json')) {
    return 'json-ld';
  }

  return defaultFormat;
}

/**
 * Helper to get header value
 */
function getHeader(req: ARWRequest, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Create ARW middleware handler
 */
export function createARWMiddleware(config: ARWMiddlewareConfig) {
  const manifestGenerator = new ManifestGenerator(config.baseUrl, config.version);
  let cachedManifest: ARWManifest | null = null;

  return function arwMiddleware(
    req: ARWRequest,
    res: ARWResponse,
    next: NextFunction
  ): void {
    // Handle manifest requests
    if (config.enableManifest !== false) {
      const manifestPath = config.manifestPath ?? '/.well-known/arw.json';
      if (req.path === manifestPath) {
        if (!cachedManifest) {
          cachedManifest = manifestGenerator.generate();
        }
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.json(cachedManifest);
        return;
      }
    }

    // Add ARW context to request for downstream handlers
    const isAgent = isAgentRequest(req);
    const format = getPreferredFormat(req, config.defaultFormat);

    // Extend request with ARW context
    (req as any).arw = {
      isAgent,
      format,
      viewGenerator: new MachineViewGenerator({
        format,
        baseUrl: config.baseUrl,
        includeAvailability: true,
      }),
    };

    // Add response helper for ARW views
    (res as any).arwView = function(data: MediaContent | Recommendation[] | GroupSession) {
      const headers = getMachineViewHeaders(format);
      Object.entries(headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      const generator = (req as any).arw.viewGenerator as MachineViewGenerator;

      // Determine data type and generate appropriate view
      if (Array.isArray(data)) {
        res.json(generator.generateRecommendationsView(data as Recommendation[]));
      } else if ('candidates' in data) {
        res.json(generator.generateGroupSessionView(data as GroupSession));
      } else {
        res.json(generator.generateContentView(data as MediaContent));
      }
    };

    next();
  };
}

/**
 * Express-style wrapper for ARW responses
 */
export class ARWResponseHelper {
  private viewGenerator: MachineViewGenerator;
  private format: ViewFormat;

  constructor(format: ViewFormat, baseUrl: string) {
    this.format = format;
    this.viewGenerator = new MachineViewGenerator({
      format,
      baseUrl,
      includeAvailability: true,
    });
  }

  /**
   * Generate response for content
   */
  content(content: MediaContent, availability?: any[]): { headers: Record<string, string>; body: any } {
    return {
      headers: getMachineViewHeaders(this.format),
      body: this.viewGenerator.generateContentView(content, availability),
    };
  }

  /**
   * Generate response for recommendations
   */
  recommendations(recs: Recommendation[]): { headers: Record<string, string>; body: any } {
    return {
      headers: getMachineViewHeaders(this.format),
      body: this.viewGenerator.generateRecommendationsView(recs),
    };
  }

  /**
   * Generate response for group session
   */
  groupSession(session: GroupSession): { headers: Record<string, string>; body: any } {
    return {
      headers: getMachineViewHeaders(this.format),
      body: this.viewGenerator.generateGroupSessionView(session),
    };
  }
}

/**
 * Create ARW response helper
 */
export function createARWResponseHelper(format: ViewFormat, baseUrl: string): ARWResponseHelper {
  return new ARWResponseHelper(format, baseUrl);
}

/**
 * CORS headers for ARW endpoints
 */
export function getARWCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-ARW-Agent, X-ARW-Version, Accept',
    'Access-Control-Expose-Headers': 'X-ARW-Format, X-ARW-Version',
  };
}

/**
 * Rate limiting context for ARW
 */
export interface RateLimitContext {
  isAgent: boolean;
  agentType?: string;
  requestsRemaining: number;
  resetTime: Date;
}

/**
 * Create rate limit headers
 */
export function getRateLimitHeaders(context: RateLimitContext): Record<string, string> {
  return {
    'X-RateLimit-Limit': context.isAgent ? '1000' : '100',
    'X-RateLimit-Remaining': context.requestsRemaining.toString(),
    'X-RateLimit-Reset': context.resetTime.toISOString(),
  };
}

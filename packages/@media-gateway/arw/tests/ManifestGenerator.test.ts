/**
 * ARW Manifest Generator Tests
 * Agent-Ready Web specification validation
 */

import { describe, it, expect } from 'vitest';
import {
  ManifestGenerator,
  createManifestGenerator,
  ARWManifestSchema,
} from '../src/manifest/index.js';

describe('ManifestGenerator', () => {
  const baseUrl = 'https://media-gateway.io';

  describe('generate', () => {
    it('should generate valid ARW manifest', () => {
      const generator = createManifestGenerator(baseUrl);
      const manifest = generator.generate();

      expect(manifest.$schema).toBe('https://arw.dev/schemas/manifest/v1.json');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.name).toBe('Media Gateway');
      expect(manifest.baseUrl).toBe(baseUrl);
    });

    it('should include all capabilities', () => {
      const generator = createManifestGenerator(baseUrl);
      const manifest = generator.generate();

      expect(manifest.capabilities.search).toBe(true);
      expect(manifest.capabilities.recommendations).toBe(true);
      expect(manifest.capabilities.groupWatch).toBe(true);
      expect(manifest.capabilities.availability).toBe(true);
      expect(manifest.capabilities.preferences).toBe(true);
    });

    it('should generate endpoints with semantic actions', () => {
      const generator = createManifestGenerator(baseUrl);
      const manifest = generator.generate();

      expect(manifest.endpoints.length).toBeGreaterThan(0);

      const searchEndpoint = manifest.endpoints.find(e => e.path === '/api/search');
      expect(searchEndpoint).toBeDefined();
      expect(searchEndpoint!.method).toBe('POST');
      expect(searchEndpoint!.semanticAction).toBe('search:media');
      expect(searchEndpoint!.parameters).toBeDefined();
    });

    it('should include authentication configuration', () => {
      const generator = createManifestGenerator(baseUrl);
      const manifest = generator.generate();

      expect(manifest.authentication.type).toBe('jwt');
      expect(manifest.authentication.flows).toContain('authorization_code');
    });

    it('should configure machine views', () => {
      const generator = createManifestGenerator(baseUrl);
      const manifest = generator.generate();

      expect(manifest.machineViews?.enabled).toBe(true);
      expect(manifest.machineViews?.contentTypes).toContain('application/json');
      expect(manifest.machineViews?.contentTypes).toContain('application/ld+json');
      expect(manifest.machineViews?.contentTypes).toContain('application/vnd.arw+json');
    });
  });

  describe('generateJsonLdContext', () => {
    it('should generate JSON-LD context', () => {
      const generator = createManifestGenerator(baseUrl);
      const context = generator.generateJsonLdContext();

      expect(context).toHaveProperty('@context');
      const ctx = (context as any)['@context'];
      expect(ctx['@vocab']).toBe('https://schema.org/');
      expect(ctx.arw).toBe('https://arw.dev/ns/');
    });
  });

  describe('validate', () => {
    it('should validate correct manifest', () => {
      const generator = createManifestGenerator(baseUrl);
      const manifest = generator.generate();

      expect(() => ManifestGenerator.validate(manifest)).not.toThrow();
    });

    it('should reject invalid manifest', () => {
      const invalidManifest = {
        name: 'Test',
        // Missing required fields
      };

      expect(() => ManifestGenerator.validate(invalidManifest)).toThrow();
    });
  });

  describe('custom version', () => {
    it('should use custom version', () => {
      const generator = createManifestGenerator(baseUrl, '2.0.0');
      const manifest = generator.generate();

      expect(manifest.version).toBe('2.0.0');
    });
  });
});

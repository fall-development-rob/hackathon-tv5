# @media-gateway/arw

Agent-Ready Web (ARW) specification implementation for AI agent discovery and interaction.

## Installation

```bash
pnpm add @media-gateway/arw
```

## Features

- **ManifestGenerator**: Create ARW-compliant discovery manifests
- **MachineViewGenerator**: Generate JSON, JSON-LD, and ARW format views
- **Middleware**: Express/Next.js middleware for agent detection and content negotiation

## Usage

### Generate Manifest

```typescript
import { createManifestGenerator } from '@media-gateway/arw';

const generator = createManifestGenerator('https://your-site.com', '1.0.0');
const manifest = generator.generate();
// Serve at /.well-known/arw-manifest.json
```

### Machine Views

```typescript
import { createMachineViewGenerator } from '@media-gateway/arw';

const viewGen = createMachineViewGenerator({
  format: 'json-ld', // or 'json', 'arw'
  baseUrl: 'https://your-site.com'
});

const view = viewGen.generateContentView(mediaContent, availability);
```

### Middleware

```typescript
import { createARWMiddleware, isAgentRequest } from '@media-gateway/arw';

app.use(createARWMiddleware({
  baseUrl: 'https://your-site.com',
  enableManifest: true,
  manifestPath: '/.well-known/arw.json'
}));
```

## ARW Benefits

- **85% token reduction** vs HTML scraping
- **10x faster discovery** with structured manifests
- **Semantic actions** for agent understanding

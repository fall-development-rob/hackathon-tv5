import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRateLimit } from './middleware/rateLimit';
import { swaggerSpec } from './utils/swagger';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// API Documentation
app.use('/v1/docs', swaggerUi.serve as any, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'ARW Media Gateway API',
}) as any);

// Serve OpenAPI spec as JSON
app.get('/v1/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'ARW Media Gateway API',
    version: '1.0.0',
    description: 'Unified media content discovery and recommendations',
    documentation: '/v1/docs',
    health: '/v1/health',
    endpoints: {
      search: '/v1/search',
      recommendations: '/v1/recommendations',
      content: '/v1/content/:id',
      availability: '/v1/availability/:contentId',
      watchHistory: '/v1/watch-history',
      ratings: '/v1/ratings',
    },
  });
});

// Apply rate limiting to all API routes
app.use('/v1', apiRateLimit);

// API routes
app.use('/v1', routes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║   ARW Media Gateway API Server             ║
╠════════════════════════════════════════════╣
║   Environment: ${NODE_ENV.padEnd(29)}║
║   Port:        ${String(PORT).padEnd(29)}║
║   API Docs:    http://localhost:${PORT}/v1/docs    ║
║   Health:      http://localhost:${PORT}/v1/health  ║
╚════════════════════════════════════════════╝
    `);
  });
}

// Export for testing
export default app;

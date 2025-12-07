import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ARW Media Gateway API',
      version: '1.0.0',
      description: 'REST API for ARW compliance - unified media content discovery and recommendations',
      contact: {
        name: 'API Support',
        email: 'support@arw-media.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/v1',
        description: 'Development server',
      },
      {
        url: 'https://api.arw-media.com/v1',
        description: 'Production server',
      },
    ],
    tags: [
      {
        name: 'Search',
        description: 'Natural language content search endpoints',
      },
      {
        name: 'Recommendations',
        description: 'Personalized content recommendation endpoints',
      },
      {
        name: 'Content',
        description: 'Content metadata and details endpoints',
      },
      {
        name: 'Availability',
        description: 'Platform availability and deep link endpoints',
      },
      {
        name: 'User',
        description: 'User activity and preference endpoints',
      },
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          required: ['error', 'code'],
          properties: {
            error: {
              type: 'string',
              description: 'Human-readable error message',
            },
            code: {
              type: 'string',
              description: 'Machine-readable error code',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            total: {
              type: 'integer',
              description: 'Total number of results',
            },
            limit: {
              type: 'integer',
              description: 'Results per page',
            },
            offset: {
              type: 'integer',
              description: 'Current offset',
            },
            hasMore: {
              type: 'boolean',
              description: 'Whether more results are available',
            },
          },
        },
        Content: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            mediaType: { type: 'string', enum: ['movie', 'series', 'documentary', 'sports'] },
            year: { type: 'integer' },
            genre: { type: 'array', items: { type: 'string' } },
            rating: { type: 'number' },
            description: { type: 'string' },
          },
        },
        Platform: {
          type: 'object',
          properties: {
            platform: { type: 'string' },
            platformId: { type: 'string' },
            type: { type: 'string', enum: ['subscription', 'rent', 'buy', 'free'] },
            deepLink: { type: 'string', format: 'uri' },
            price: {
              type: 'object',
              nullable: true,
              properties: {
                amount: { type: 'number' },
                currency: { type: 'string' },
              },
            },
            quality: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      responses: {
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        RateLimitExceeded: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        InternalError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

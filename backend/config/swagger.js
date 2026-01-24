const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Attendance Management API',
      version: '1.0.0',
      description: 'Production-ready Attendance API with RBAC and auditing.',
    },
    servers: [{ url: '/api' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./routes/*.js'], // JSDoc blocks live inside routes
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

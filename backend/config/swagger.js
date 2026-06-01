const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'SEP490 G62 — Logistics API',
            version: '1.0.0',
            description: 'API documentation — auto-generated from route JSDoc annotations.',
        },
        servers: [
            { url: 'http://localhost:9999', description: 'Local' },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    },
    // Scan tất cả route files tự động
    apis: ['./routes/*.js'],
};

const swaggerDocument = swaggerJsdoc(options);

module.exports = swaggerDocument;

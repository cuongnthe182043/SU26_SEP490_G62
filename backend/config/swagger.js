const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'SEP490 G62 Backend API',
        version: '1.0.0',
        description: 'API documentation for the SEP490 G62 logistics backend.',
    },
    servers: [
        {
            url: 'http://localhost:9999',
            description: 'Local development server',
        },
    ],
    tags: [
        {
            name: 'Auth',
            description: 'Authentication and user session APIs',
        },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
        schemas: {
            LoginRequest: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: {
                        type: 'string',
                        format: 'email',
                        example: 'admin@example.com',
                    },
                    password: {
                        type: 'string',
                        format: 'password',
                        example: 'admin123',
                    },
                },
            },
            AuthUser: {
                type: 'object',
                properties: {
                    id: { type: 'integer', example: 1 },
                    email: { type: 'string', example: 'admin@example.com' },
                    full_name: { type: 'string', example: 'Admin User' },
                    phone: { type: 'string', nullable: true, example: '0901234560' },
                    role: { type: 'string', example: 'manager' },
                },
            },
            LoginResponse: {
                type: 'object',
                properties: {
                    message: { type: 'string', example: 'Login successful' },
                    token: { type: 'string', example: 'jwt-token' },
                    user: { $ref: '#/components/schemas/AuthUser' },
                },
            },
            Role: {
                type: 'object',
                properties: {
                    id: { type: 'integer', example: 1 },
                    name: { type: 'string', example: 'manager' },
                },
            },
            ErrorResponse: {
                type: 'object',
                properties: {
                    error: { type: 'string', example: 'Invalid credentials' },
                },
            },
        },
    },
    paths: {
        '/auth/login': {
            post: {
                tags: ['Auth'],
                summary: 'Login with email and password',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/LoginRequest' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Login successful',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/LoginResponse' },
                            },
                        },
                    },
                    401: {
                        description: 'Invalid credentials or missing fields',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/auth/me': {
            get: {
                tags: ['Auth'],
                summary: 'Get current authenticated user',
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Current user profile',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/AuthUser' },
                            },
                        },
                    },
                    401: {
                        description: 'Invalid token',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    404: {
                        description: 'User not found',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
        '/auth/roles': {
            get: {
                tags: ['Auth'],
                summary: 'List all roles',
                responses: {
                    200: {
                        description: 'Role list',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/Role' },
                                },
                            },
                        },
                    },
                    500: {
                        description: 'Failed to fetch roles',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            },
        },
    },
};

module.exports = swaggerDocument;

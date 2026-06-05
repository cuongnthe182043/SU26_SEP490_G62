const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'SEP490 G62 — Logistics API',
            version: '1.0.0',
            description: [
                '## Hướng dẫn sử dụng',
                '1. Đăng nhập qua **POST /auth/login** để lấy JWT token.',
                '2. Click **Authorize** (góc trên phải), nhập token vào ô `bearerAuth`.',
                '3. Token được lưu tự động, không cần nhập lại khi refresh trang.',
                '',
                '## Thêm endpoint mới',
                'Tạo hoặc chỉnh sửa file tương ứng trong thư mục `docs/` — server tự reload.',
            ].join('\n'),
        },
        servers: [
            { url: 'http://localhost:9999', description: 'Local dev' },
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
    apis: ['./docs/**/*.js'],
};

module.exports = swaggerJsdoc(options);

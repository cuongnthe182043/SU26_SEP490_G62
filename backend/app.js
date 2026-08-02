require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const routes = require('./routes');
const swaggerDocument = require('./config/swagger');
const pool = require('./config/database');
const logger = require('./config/logger');
const authService = require('./services/authService');
const { initNotificationGateway } = require('./services/notificationGateway');
const { initCronJobs }           = require('./cron/debtCron');
const { API_TITLE }              = require('./constants/brandConstants');

const isProduction = process.env.NODE_ENV === 'production';

const app = express();
const port = process.env.PORT || 9999;
const server = http.createServer(app);
initNotificationGateway(server);
initCronJobs();

const DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
];

const parseOriginList = (value) => String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = new Set([
    ...(isProduction ? [] : DEFAULT_ALLOWED_ORIGINS),
    ...parseOriginList(process.env.CORS_ORIGINS),
    ...parseOriginList(process.env.FRONTEND_URL),
    ...parseOriginList(process.env.FRONTEND_ORIGIN),
]);

const corsOptions = {
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        return callback(null, false);
    },
    credentials: true,
};

const readCookieValue = (cookieHeader, cookieName) => {
    if (!cookieHeader) return null;
    const cookie = String(cookieHeader)
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${cookieName}=`));
    return cookie ? decodeURIComponent(cookie.slice(cookieName.length + 1)) : null;
};

const CSRF_COOKIE_NAME = 'csrf_token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT_PATHS = new Set([
    '/auth/login',
    '/auth/google',
    '/auth/refresh',
    '/auth/logout',
    '/auth/forgot-password/request',
    '/auth/forgot-password/verify',
    '/auth/forgot-password/reset',
]);

const csrfProtection = (req, res, next) => {
    if (SAFE_METHODS.has(req.method) || CSRF_EXEMPT_PATHS.has(req.path)) return next();

    const hasSessionCookie =
        readCookieValue(req.headers.cookie, authService.AUTH_COOKIE_NAME)
        || readCookieValue(req.headers.cookie, authService.REFRESH_COOKIE_NAME);
    if (!hasSessionCookie) return next();

    const csrfCookie = readCookieValue(req.headers.cookie, CSRF_COOKIE_NAME);
    const csrfHeader = req.get('x-csrf-token');
    if (csrfCookie && csrfHeader && csrfCookie === csrfHeader) return next();

    return res.status(403).json({ error: 'CSRF token không hợp lệ', code: 'CSRF_TOKEN_INVALID' });
};

// Chạy sau reverse proxy/load balancer (Cloud Run...) — cần để req.ip và rate-limit
// nhận đúng IP thật của client thay vì IP của proxy.
app.set('trust proxy', 1);

// Middleware
// CSP mặc định của helmet sẽ chặn inline script của Swagger UI (chỉ bật ở non-production) —
// tắt CSP riêng ở non-production, các header bảo mật khác (HSTS, X-Frame-Options...) vẫn giữ.
app.use(helmet({ contentSecurityPolicy: isProduction }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(cors(corsOptions));
app.use(csrfProtection);
app.use(morgan(isProduction ? 'combined' : 'dev', {
    stream: { write: (message) => logger.info(message.trim()) },
}));

// Rate limit chung — chặn spam/DoS cấp API cơ bản
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Quá nhiều yêu cầu, vui lòng thử lại sau ít phút.' },
});
app.use(apiLimiter);

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ message: 'Backend up and running' });
});

// API documentation — chỉ bật ngoài production, tránh lộ toàn bộ API + "try it out" ra ngoài
if (!isProduction) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            filter: true,
            tryItOutEnabled: true,
        },
        customSiteTitle: API_TITLE,
    }));
}

// Routes
app.use('/', routes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler — không lộ chi tiết lỗi nội bộ (message DB, stack trace...) cho client ở production
app.use((err, req, res, next) => {
    logger.error('Server error', { message: err.message, stack: err.stack, path: req.path });
    res.status(500).json({
        error: 'Internal server error',
        ...(isProduction ? {} : { details: err.message }),
    });
});

// Bắt lỗi không được catch để tránh crash process mà không log/không dọn dẹp được gì —
// log lại rồi thoát có kiểm soát (process manager/orchestrator sẽ tự khởi động lại tiến trình sạch).
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason: reason?.stack || reason });
});
process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { message: err.message, stack: err.stack });
    process.exit(1);
});

// Graceful shutdown — đóng HTTP server + pg pool sạch khi orchestrator gửi tín hiệu dừng,
// tránh drop request đang xử lý dở và tránh rò rỉ connection tới DB.
const shutdown = (signal) => {
    logger.info(`[shutdown] Nhận ${signal}, đang đóng server...`);
    server.close(() => {
        pool.end().finally(() => {
            logger.info('[shutdown] Đã đóng server và DB pool.');
            process.exit(0);
        });
    });
    setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
server.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
});

module.exports = app;

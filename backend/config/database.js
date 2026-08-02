const { Pool } = require('pg');
const logger = require('./logger');

const runningOnCloudRun = Boolean(process.env.K_SERVICE);

const poolConfig = {
    host: runningOnCloudRun
        ? `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`
        : (process.env.DB_HOST || '127.0.0.1'),
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: `-c timezone=${process.env.DB_TIMEZONE || 'Asia/Ho_Chi_Minh'}`,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
    query_timeout: 15000,
};

const dbSsl = process.env.DB_SSL && String(process.env.DB_SSL).toLowerCase() !== 'false';
if (dbSsl) poolConfig.ssl = { rejectUnauthorized: false };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
    logger.error('Unexpected error on idle client', { message: err.message, stack: err.stack });
});

module.exports = pool;

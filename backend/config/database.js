const { Pool } = require('pg');
const logger = require('./logger');
const { buildDbConfig } = require('./dbConfig');

const poolConfig = {
    ...buildDbConfig(),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
    query_timeout: 15000,
};

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
    logger.error('Unexpected error on idle client', { message: err.message, stack: err.stack });
});

module.exports = pool;

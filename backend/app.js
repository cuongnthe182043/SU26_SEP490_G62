require('dotenv').config();
const express = require('express');
const app = express();
const { Pool } = require('pg');

const port = process.env.PORT || 9999;

// Configure Postgres pool using env vars (see .env.example)
const poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 10,
    idleTimeoutMillis: 30000,
};

const dbSsl = process.env.DB_SSL && String(process.env.DB_SSL).toLowerCase() !== 'false';
if (dbSsl) poolConfig.ssl = { rejectUnauthorized: false };

const pool = new Pool(poolConfig);

app.get('/', (req, res) => {
    res.json({ message: 'Backend up and running' });
});

// DB test endpoint: return all rows from `roles` table
app.get('/roles', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM roles');
        res.json(result.rows);
    } catch (err) {
        console.error('Error querying roles:', err);
        res.status(500).json({ error: 'Failed to query roles', details: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

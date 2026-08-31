const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../../../DB script/DB script.sql');

/**
 * Starts a throwaway Postgres container, loads the real schema (DB script/DB script.sql —
 * the single source of truth for table/column names), and points process.env DB_* vars at it.
 * Call `teardown()` in an `after()` hook.
 */
async function setupTestDb() {
    const container = await new PostgreSqlContainer('postgres:16-alpine').start();

    // XOÁ TRƯỚC KHI SET: buildDbConfig() ưu tiên DATABASE_URL hơn mọi biến DB_* rời.
    // Còn sót nó trong .env là bộ test nối thẳng vào Supabase thật rồi nạp đè nguyên
    // `DB script.sql` lên đó — mất sạch dữ liệu, và không có bước nào hỏi lại.
    delete process.env.DATABASE_URL;

    process.env.DB_HOST = container.getHost();
    // Ép tắt TLS: container test không có chứng chỉ. buildDbConfig() tự bật TLS cho
    // host "không phải localhost", mà getHost() có thể trả về IP khi Docker chạy từ xa.
    process.env.DB_SSL = 'false';
    process.env.DB_PORT = container.getPort();
    process.env.DB_NAME = container.getDatabase();
    process.env.DB_USER = container.getUsername();
    process.env.DB_PASSWORD = container.getPassword();

    const pool = require('../../config/database');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);

    const teardown = async () => {
        await pool.end();
        await container.stop();
    };

    return { container, pool, teardown };
}

module.exports = { setupTestDb };

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const logger = require('./config/logger');

/**
 * Tự chạy migration lúc backend khởi động.
 *
 * Vì sao chạy ở đây: deploy lên Cloud Run là container khởi động lại — migration tự
 * áp, không phải nhớ vào Cloud SQL Studio gõ tay. Quên chạy migration mà deploy code
 * mới là app gọi cột chưa tồn tại, lỗi 500 hàng loạt.
 *
 * Ba điểm quan trọng:
 *
 * 1. DÙNG KẾT NỐI RIÊNG, KHÔNG DÙNG POOL CỦA APP.
 *    Pool đặt statement_timeout = 15s để một query chậm không chiếm connection mãi.
 *    Migration nặng (thêm index bảng lớn) sẽ bị cắt giữa chừng và để lại schema dở dang.
 *
 * 2. KHOÁ pg_advisory_lock.
 *    Cloud Run có thể bật nhiều instance cùng lúc. Không khoá thì hai instance chạy
 *    song song cùng một ALTER TABLE. Instance nào lấy được khoá thì chạy, các instance
 *    còn lại đứng chờ rồi vào sau, thấy đã áp hết nên không làm gì.
 *
 * 3. FILE TỰ QUẢN GIAO DỊCH.
 *    Mỗi file .sql tự có BEGIN/COMMIT và tự ghi tên mình vào schema_migrations, nên
 *    bộ chạy này thực thi nguyên văn nội dung file. Nếu file nào quên tự ghi thì bộ
 *    chạy ghi bù ở bước sau.
 */

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const MIGRATION_LOCK_ID = 62999;   // id cố định cho pg_advisory_lock

// Kết nối riêng, KHÔNG kế thừa statement_timeout của pool app
function createClient() {
    const onCloudRun = Boolean(process.env.K_SERVICE);
    const config = {
        host: onCloudRun
            ? `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`
            : (process.env.DB_HOST || '127.0.0.1'),
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        options: `-c timezone=${process.env.DB_TIMEZONE || 'Asia/Ho_Chi_Minh'}`,
        connectionTimeoutMillis: 15000,
        // statement_timeout: KHÔNG đặt — migration được phép chạy lâu
    };
    const useSsl = process.env.DB_SSL && String(process.env.DB_SSL).toLowerCase() !== 'false';
    if (useSsl) config.ssl = { rejectUnauthorized: false };
    return new Client(config);
}

function docDanhSachFile() {
    if (!fs.existsSync(MIGRATIONS_DIR)) return [];
    return fs.readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        // Tên file bắt đầu bằng ngày (YYYYMMDD) nên sắp theo tên là đúng thứ tự thời gian
        .sort();
}

async function runMigrations() {
    if (String(process.env.SKIP_MIGRATIONS).toLowerCase() === 'true') {
        logger.info('[migrate] SKIP_MIGRATIONS=true — bỏ qua');
        return { applied: [], skipped: true };
    }

    const danhSach = docDanhSachFile();
    if (danhSach.length === 0) {
        logger.info('[migrate] Không có file migration nào');
        return { applied: [] };
    }

    const client = createClient();
    await client.connect();

    const applied = [];
    try {
        // Chờ tới khi lấy được khoá — instance khác đang chạy thì đứng đây
        await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);

        // DB cũ có thể chưa có bảng này (tạo trước khi cơ chế migration ra đời)
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename   TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        const { rows } = await client.query('SELECT filename FROM schema_migrations');
        const existing = new Set(rows.map((r) => r.filename));

        const toApply = danhSach.filter((f) => !existing.has(f));
        if (toApply.length === 0) {
            logger.info(`[migrate] Schema đã mới nhất (${danhSach.length} migration)`);
            return { applied: [] };
        }

        logger.info(`[migrate] Cần áp ${toApply.length} migration: ${toApply.join(', ')}`);

        for (const fileName of toApply) {
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, fileName), 'utf8');
            const startedAt = Date.now();
            try {
                // File tự có BEGIN/COMMIT — chạy nguyên văn
                await client.query(sql);
            } catch (err) {
                // Lỗi giữa chừng: rollback phần dở dang rồi ném ra để container không lên.
                // Schema sai mà app vẫn chạy còn nguy hiểm hơn là chết hẳn ở đây.
                await client.query('ROLLBACK').catch(() => {});
                logger.error(`[migrate] LỖI ở ${fileName}: ${err.message}`);
                throw new Error(`Migration "${fileName}" thất bại: ${err.message}`);
            }

            // Ghi bù nếu file quên tự đăng ký
            await client.query(
                `INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
                [fileName],
            );

            applied.push(fileName);
            logger.info(`[migrate] OK ${fileName} (${Date.now() - startedAt}ms)`);
        }

        logger.info(`[migrate] Xong — đã áp ${applied.length} migration`);
        return { applied: applied };
    } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
        await client.end().catch(() => {});
    }
}

module.exports = { runMigrations };

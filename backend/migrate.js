const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const logger = require('./config/logger');
const { buildDbConfig } = require('./config/dbConfig');

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
 *
 * 4. ĐỌC TRƯỚC, KHOÁ SAU.
 *    Hàm này chặn `server.listen` (xem app.js), nên nó nằm thẳng trên đường cold start
 *    của Cloud Run — mọi mili-giây ở đây là mọi mili-giây người dùng phải chờ. Gần như
 *    100% lần khởi động không có gì để áp, nên đọc schema_migrations TRƯỚC: không có gì
 *    mới thì đi ra luôn, khỏi CREATE TABLE, khỏi tranh khoá. Chỉ khi thật sự có file
 *    mới mới trả giá khoá — và lúc đó có `lock_timeout` để một instance đang chạy
 *    migration dài không treo cold start của instance này vô thời hạn.
 */

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const MIGRATION_LOCK_ID = 62999;   // id cố định cho pg_advisory_lock
// Chờ khoá tối đa ngần này rồi bỏ cuộc và đọc lại danh sách đã áp — instance kia có
// thể đã áp xong hộ mình. Không đặt thì một migration dài ở instance khác giữ cold
// start của instance này treo cho tới khi Cloud Run bỏ cuộc.
const LOCK_TIMEOUT_MS = 60_000;

// Kết nối riêng, KHÔNG kế thừa statement_timeout của pool app.
// Dùng chung buildDbConfig() với app: trước đây khối này tự dựng lại tham số kết nối,
// nên mỗi lần đổi cách khai báo DB (thêm DATABASE_URL chẳng hạn) là migration lặng lẽ
// chạy vào một database KHÁC với database mà app đang dùng.
function createClient() {
    return new Client({
        ...buildDbConfig(),
        connectionTimeoutMillis: 15000,
        // statement_timeout: KHÔNG đặt — migration được phép chạy lâu
    });
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

    const batDau = Date.now();
    const client = createClient();
    await client.connect();

    /**
     * Danh sách file còn thiếu. Trả null khi bảng schema_migrations chưa tồn tại —
     * DB cũ tạo trước khi cơ chế migration ra đời, phải vào nhánh khoá để tạo bảng.
     */
    const conThieu = async () => {
        const res = await client.query('SELECT filename FROM schema_migrations').catch(() => null);
        if (!res) return null;   // bảng chưa tồn tại (hoặc DB trục trặc) → đi đường khoá
        const existing = new Set(res.rows.map((r) => r.filename));
        return danhSach.filter((f) => !existing.has(f));
    };

    const applied = [];
    try {
        // Đường nhanh: không có gì để áp thì đi ra ngay, không đụng tới khoá.
        const thieuTruocKhoa = await conThieu();
        if (thieuTruocKhoa?.length === 0) {
            logger.info(`[migrate] Schema đã mới nhất (${danhSach.length} migration, ${Date.now() - batDau}ms)`);
            return { applied: [] };
        }

        // Có việc thật sự → tranh khoá với các instance khác, nhưng không chờ vô hạn.
        await client.query(`SET lock_timeout = ${LOCK_TIMEOUT_MS}`);
        try {
            await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
        } catch (err) {
            // Hết giờ chờ: instance khác đang áp. Rất có thể nó đã áp xong phần mình
            // cần — đọc lại, đủ rồi thì cứ khởi động bình thường.
            const thieuSauChoKhoa = await conThieu();
            if (thieuSauChoKhoa?.length === 0) {
                logger.info('[migrate] Instance khác đã áp xong migration — tiếp tục khởi động');
                return { applied: [] };
            }
            throw new Error(`Không lấy được khoá migration sau ${LOCK_TIMEOUT_MS}ms: ${err.message}`);
        }
        await client.query('SET lock_timeout = 0');   // migration được phép chạy lâu

        // DB cũ có thể chưa có bảng này (tạo trước khi cơ chế migration ra đời)
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename   TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        // Đọc lại SAU khi có khoá: instance khác có thể vừa áp xong trong lúc mình chờ.
        const toApply = await conThieu();
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

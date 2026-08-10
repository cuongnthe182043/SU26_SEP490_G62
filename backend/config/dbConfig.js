/**
 * Tham số kết nối Postgres dùng chung.
 *
 * Tách riêng khỏi `database.js` vì ngoài connection pool chính, hệ thống còn cần một
 * kết nối RIÊNG, sống lâu để chạy `LISTEN` (xem services/notificationBus.js). Kết nối
 * đó không được lấy từ pool — một client bị giữ vĩnh viễn sẽ ăn mất 1/10 slot của pool.
 */
const buildDbConfig = () => {
    const runningOnCloudRun = Boolean(process.env.K_SERVICE);

    const config = {
        host: runningOnCloudRun
            ? `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`
            : (process.env.DB_HOST || '127.0.0.1'),
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        options: `-c timezone=${process.env.DB_TIMEZONE || 'Asia/Ho_Chi_Minh'}`,
    };

    const dbSsl = process.env.DB_SSL && String(process.env.DB_SSL).toLowerCase() !== 'false';
    if (dbSsl) config.ssl = { rejectUnauthorized: false };

    return config;
};

module.exports = { buildDbConfig };

/**
 * Tham số kết nối Postgres dùng chung.
 *
 * Tách riêng khỏi `database.js` vì ngoài connection pool chính, hệ thống còn cần một
 * kết nối RIÊNG, sống lâu để chạy `LISTEN` (xem services/notificationBus.js). Kết nối
 * đó không được lấy từ pool — một client bị giữ vĩnh viễn sẽ ăn mất 1/10 slot của pool.
 *
 * Hai cách khai báo, theo thứ tự ưu tiên:
 *  1. DATABASE_URL — một chuỗi kết nối duy nhất. Đây là thứ Supabase/Neon phát cho bạn;
 *     dán nguyên văn, khỏi tách tay ra 5 biến rời rồi sai đúng một chỗ.
 *  2. DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD — cách cũ, vẫn chạy nguyên
 *     như trước cho local và cho Cloud SQL qua unix socket.
 */

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

const hostFromUrl = (url) => {
    try { return new URL(url).hostname; } catch { return ''; }
};

const portFromUrl = (url) => {
    try { return new URL(url).port; } catch { return ''; }
};

/**
 * Gỡ `sslmode=` khỏi chuỗi kết nối khi ta đã tự quyết định cấu hình TLS.
 *
 * Supabase phát chuỗi có sẵn `?sslmode=require`, và pg-connection-string diễn giải
 * `require` thành `verify-full` (chuẩn của nó khác libpq). Giá trị đọc từ chuỗi ĐÈ LÊN
 * object `ssl` truyền vào, nên kết nối quay ra bắt buộc verify chứng chỉ và chết ngay
 * bằng SELF_SIGNED_CERT_IN_CHAIN — dù ta đã nói rõ rejectUnauthorized: false.
 *
 * Gỡ ở đây để dán nguyên văn chuỗi Supabase là chạy, không phải nhớ sửa tay.
 */
const stripSslMode = (url) => {
    try {
        const u = new URL(url);
        if (!u.searchParams.has('sslmode')) return url;
        u.searchParams.delete('sslmode');
        return u.toString();
    } catch {
        return url;
    }
};

/**
 * TLS: khai báo tường minh qua DB_SSL thì theo DB_SSL. Không khai báo thì suy ra từ
 * host — mọi Postgres managed (Supabase, Neon, Cloud SQL qua IP) đều bắt buộc TLS,
 * còn Postgres chạy trên chính máy mình thì không có chứng chỉ để mà bật.
 *
 * `rejectUnauthorized: false` giữ nguyên như trước: chấp nhận chứng chỉ không verify
 * được theo CA hệ thống. Đánh đổi có thật — mất lớp chống MITM ở tầng chứng chỉ, dữ
 * liệu vẫn được mã hoá. Muốn siết thì nạp CA của Supabase rồi đổi cờ này thành true.
 */
const resolveSsl = (host) => {
    const raw = process.env.DB_SSL;
    if (raw !== undefined && raw !== '') {
        return String(raw).toLowerCase() === 'false' ? undefined : { rejectUnauthorized: false };
    }

    const isLocal = !host || host.startsWith('/') || LOCAL_HOSTS.includes(host);
    return isLocal ? undefined : { rejectUnauthorized: false };
};

/**
 * CẢNH BÁO MỘT LẦN cho cổng 6543 (transaction pooler của Supabase).
 *
 * Vì sao đáng một cảnh báo riêng: kết nối vào 6543 THÀNH CÔNG, và câu `LISTEN` cũng
 * trả về OK — không có lấy một dòng lỗi nào. Nhưng ở transaction mode, connection bị
 * trả lại pool ngay sau câu lệnh, nên đăng ký LISTEN nằm lại trên một backend ngẫu
 * nhiên. notificationBus tưởng mình đã đăng ký, `publish()` trả true và nhận trách
 * nhiệm giao hàng, rồi mọi thông báo realtime rơi vào hư không cho tới khi restart.
 * Dùng session pooler (cổng 5432) hoặc kết nối trực tiếp.
 */
let daCanhBaoPooler = false;
const canhBaoTransactionPooler = (port) => {
    if (daCanhBaoPooler || String(port) !== '6543') return;
    daCanhBaoPooler = true;
    console.warn(
        '[db] CẢNH BÁO: đang nối qua cổng 6543 (transaction pooler). LISTEN/NOTIFY sẽ '
        + 'im lặng không hoạt động → mất thông báo realtime. Đổi sang session pooler cổng 5432.',
    );
};

const buildDbConfig = () => {
    // Timezone đặt qua startup packet: new Date() trong Node phải chạy giờ VN, nếu không
    // getDate()/getMonth() lệch 7 tiếng và mốc tháng của KPI sai vào khoảng 0h-7h sáng.
    // Đặt DB_TIMEZONE='' để tắt hẳn — có pooler từ chối tham số `options`. Session
    // pooler của Supabase nhận bình thường (đã đo).
    const timezone = process.env.DB_TIMEZONE ?? 'Asia/Ho_Chi_Minh';
    const chung = timezone ? { options: `-c timezone=${timezone}` } : {};

    const url = process.env.DATABASE_URL;
    if (url) {
        canhBaoTransactionPooler(portFromUrl(url));
        const ssl = resolveSsl(hostFromUrl(url));
        // Ta cấu hình TLS => gỡ sslmode khỏi chuỗi để hai bên không đánh nhau.
        // Không cấu hình (DB_SSL=false) => giữ nguyên chuỗi, để pg tự đọc sslmode.
        return ssl
            ? { ...chung, connectionString: stripSslMode(url), ssl }
            : { ...chung, connectionString: url };
    }

    const runningOnCloudRun = Boolean(process.env.K_SERVICE);
    const host = runningOnCloudRun
        ? `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`
        : (process.env.DB_HOST || '127.0.0.1');
    const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432;

    canhBaoTransactionPooler(port);

    const config = {
        ...chung,
        host,
        port,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    };

    const ssl = resolveSsl(host);
    if (ssl) config.ssl = ssl;

    return config;
};

module.exports = { buildDbConfig };

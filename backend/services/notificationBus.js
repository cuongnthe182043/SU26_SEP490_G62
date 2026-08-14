/**
 * Phát tán sự kiện realtime giữa các instance, dùng Postgres LISTEN/NOTIFY.
 *
 * VẤN ĐỀ: `notificationGateway` giữ danh sách WebSocket trong RAM (`clientsByUserId`).
 * Service `backend` chạy Cloud Run với `maxScale = 20` và KHÔNG bật session affinity,
 * nên WebSocket của tài xế nằm ở instance A trong khi request của điều phối viên có
 * thể rơi vào instance B. `broadcastToUser` chạy ở B không tìm thấy socket nào →
 * thông báo biến mất khỏi realtime, tài xế chỉ thấy khi tự kéo refresh.
 *
 * CÁCH GIẢI: mọi lời phát đều đi vòng qua Postgres. Instance nào cũng LISTEN, nên khi
 * một instance NOTIFY thì tất cả — kể cả chính nó — đều nhận và gửi cho socket của
 * riêng mình. Đúng MỘT đường giao hàng, không sinh bản trùng.
 *
 * Chọn Postgres thay vì Redis vì hệ thống đã có sẵn Cloud SQL: không phải dựng thêm
 * Memorystore, không cần VPC connector, không phát sinh chi phí hạ tầng.
 *
 * Giới hạn cần biết:
 *  - payload của pg_notify tối đa 8000 byte → vượt ngưỡng thì trả false để bên gọi
 *    tự gửi local (chấp nhận suy giảm về đúng hành vi cũ thay vì mất trắng).
 *  - kết nối LISTEN là client RIÊNG, không lấy từ pool: một client bị giữ vĩnh viễn
 *    sẽ ăn mất 1/10 slot của pool. Tốn thêm đúng 1 connection cho mỗi instance.
 *
 * ĐIỂM CHẾT NGƯỜI: `publish()` trả true là NHẬN TRÁCH NHIỆM giao hàng — bên gọi sẽ
 * KHÔNG gửi local nữa. Nên nếu kết nối LISTEN chết mà `subscriber` vẫn còn khác null
 * thì mọi thông báo do instance này phát ra đều rơi vào hư không, im lặng tuyệt đối,
 * cho tới khi tiến trình restart. Đây đúng là triệu chứng "tài xế được gán đơn nhưng
 * không nhận được gì".
 *
 * Kết nối LISTEN nằm im hàng giờ, không có một byte nào chạy qua. Đường mạng của GCP
 * (Cloud SQL / NAT) cắt TCP nhàn rỗi mà tầng ứng dụng KHÔNG hề nhận được lỗi, và khi
 * Postgres đóng sạch sẽ thì `pg` chỉ bắn sự kiện 'end' chứ không bắn 'error'. Vì vậy
 * cần đủ BA lớp mới biết được đường truyền còn sống:
 *   1. bắt cả 'error' LẪN 'end';
 *   2. bật TCP keepalive để socket không bị coi là nhàn rỗi;
 *   3. tự đập cửa định kỳ bằng `SELECT 1` — lớp duy nhất bắt được "chết giả".
 */
const { Client } = require('pg');
const pool = require('../config/database');
const { buildDbConfig } = require('../config/dbConfig');
const logger = require('../config/logger');

const DEFAULT_CHANNEL = 'ws_fanout';
// pg_notify chặn ở 8000 byte; chừa biên an toàn cho phần đóng gói.
const MAX_PAYLOAD_BYTES = 7500;
// Nhịp đập kiểm tra kết nối LISTEN. 60s là đủ dày để cửa sổ mất thông báo không quá
// một phút, và đủ thưa để không đáng kể so với tải DB.
const DEFAULT_HEARTBEAT_MS = 60_000;

const createNotificationBus = ({
    query,
    clientFactory,
    channel = DEFAULT_CHANNEL,
    reconnectDelayMs = 3000,
    heartbeatMs = DEFAULT_HEARTBEAT_MS,
    log = logger,
} = {}) => {
    let subscriber = null;
    let handler = null;
    let stopped = true;
    let restartTimer = null;
    let starting = false;
    let heartbeatTimer = null;

    const isLive = () => Boolean(subscriber && !stopped);

    const deliverLocally = (message) => {
        if (!handler) return;
        try {
            handler(message);
        } catch (err) {
            // Một handler hỏng không được phép kéo sập tiến trình.
            log?.error?.('[ws-bus] handler lỗi', { message: err.message });
        }
    };

    const scheduleRestart = () => {
        if (stopped || restartTimer) return;
        restartTimer = setTimeout(() => {
            restartTimer = null;
            void start();
        }, reconnectDelayMs);
        restartTimer.unref?.();
    };

    const stopHeartbeat = () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    };

    /**
     * Khai tử client đang giữ và hẹn dựng lại. Gọi bao nhiêu lần cũng được — chỉ lần
     * đầu có tác dụng, các lần sau `subscriber !== client` nên đi ra ngay.
     *
     * Quan trọng nhất: `subscriber = null` làm `isLive()` thành false, tức `publish()`
     * quay về trả false và bên gọi tự gửi cho socket local. Suy giảm chứ không mất trắng.
     */
    const dropSubscriber = (client, lyDo) => {
        if (subscriber !== client) return;
        subscriber = null;
        stopHeartbeat();
        log?.warn?.('[ws-bus] mất kết nối LISTEN, sẽ nối lại', { lyDo });
        client.end?.().catch?.(() => {});
        scheduleRestart();
    };

    /**
     * Lớp duy nhất bắt được "chết giả": socket đã đứt nhưng cả 'error' lẫn 'end' đều
     * không nổ. Không có nhịp đập này thì bus tưởng mình còn sống và nuốt sạch thông báo.
     */
    const startHeartbeat = (client) => {
        stopHeartbeat();
        if (!heartbeatMs) return;
        heartbeatTimer = setInterval(() => {
            Promise.resolve(client.query('SELECT 1')).catch((err) => {
                dropSubscriber(client, `heartbeat lỗi: ${err?.message}`);
            });
        }, heartbeatMs);
        heartbeatTimer.unref?.();
    };

    const start = async () => {
        if (stopped || subscriber || starting) return;
        starting = true;

        const client = clientFactory();
        client.on('notification', (msg) => {
            if (msg?.channel !== channel) return;
            let parsed;
            try {
                parsed = JSON.parse(msg.payload);
            } catch {
                return;   // payload hỏng — bỏ qua, không được ném ra ngoài
            }
            deliverLocally(parsed);
        });
        client.on('error', (err) => dropSubscriber(client, err?.message ?? 'lỗi kết nối'));
        // Postgres đóng sạch (restart, pg_terminate_backend, idle timeout của Cloud SQL)
        // chỉ bắn 'end'. Thiếu nhánh này là bus treo ở trạng thái "sống giả" vĩnh viễn.
        client.on('end', () => dropSubscriber(client, 'server đóng kết nối'));

        try {
            await client.connect();
            await client.query(`LISTEN ${channel}`);
            subscriber = client;
            startHeartbeat(client);
        } catch (err) {
            log?.warn?.('[ws-bus] không mở được kết nối LISTEN', { message: err?.message });
            client.end?.().catch?.(() => {});
            scheduleRestart();
        } finally {
            starting = false;
        }
    };

    /**
     * Bắt đầu nghe. `fn` được gọi cho MỌI message trên bus, kể cả message do chính
     * instance này phát ra — đó là chủ ý: một đường giao hàng duy nhất.
     */
    const subscribe = (fn) => {
        handler = fn;
        stopped = false;
        void start();
    };

    /**
     * Phát một message ra toàn cụm.
     * @returns {boolean} true = bus đã nhận trách nhiệm giao. false = bên gọi phải tự
     *          gửi cho socket local (bus chưa sẵn sàng hoặc payload quá lớn).
     */
    const publish = (message) => {
        if (!isLive()) return false;

        const body = JSON.stringify(message);
        if (Buffer.byteLength(body, 'utf8') > MAX_PAYLOAD_BYTES) return false;

        Promise.resolve(query('SELECT pg_notify($1, $2)', [channel, body]))
            .catch((err) => {
                // NOTIFY không đi được ra ngoài — các instance khác sẽ lỡ message này.
                // Ít nhất phải phục vụ được socket đang nằm trên chính instance này.
                log?.warn?.('[ws-bus] pg_notify lỗi, chỉ gửi được local', { message: err?.message });
                deliverLocally(message);
            });

        return true;
    };

    const stop = async () => {
        stopped = true;
        if (restartTimer) clearTimeout(restartTimer);
        restartTimer = null;
        stopHeartbeat();
        const client = subscriber;
        subscriber = null;
        if (client) await client.end?.().catch?.(() => {});
    };

    return { subscribe, publish, stop, isLive };
};

const notificationBus = createNotificationBus({
    query: (text, params) => pool.query(text, params),
    clientFactory: () => new Client({
        ...buildDbConfig(),
        // Kết nối này nằm im chờ NOTIFY hàng giờ — không được để timeout cắt ngang.
        statement_timeout: 0,
        query_timeout: 0,
        // pg mặc định TẮT keepAlive. Không bật thì socket không có lấy một byte nào
        // chạy qua và bị lớp mạng của GCP dọn đi trong im lặng.
        keepAlive: true,
        keepAliveInitialDelayMillis: 10_000,
    }),
});

module.exports = notificationBus;
module.exports.createNotificationBus = createNotificationBus;

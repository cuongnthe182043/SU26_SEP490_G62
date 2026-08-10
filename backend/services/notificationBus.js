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
 */
const { Client } = require('pg');
const pool = require('../config/database');
const { buildDbConfig } = require('../config/dbConfig');
const logger = require('../config/logger');

const DEFAULT_CHANNEL = 'ws_fanout';
// pg_notify chặn ở 8000 byte; chừa biên an toàn cho phần đóng gói.
const MAX_PAYLOAD_BYTES = 7500;

const createNotificationBus = ({
    query,
    clientFactory,
    channel = DEFAULT_CHANNEL,
    reconnectDelayMs = 3000,
    log = logger,
} = {}) => {
    let subscriber = null;
    let handler = null;
    let stopped = true;
    let restartTimer = null;
    let starting = false;

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
        client.on('error', (err) => {
            log?.warn?.('[ws-bus] mất kết nối LISTEN, sẽ nối lại', { message: err?.message });
            if (subscriber === client) subscriber = null;
            client.end?.().catch?.(() => {});
            scheduleRestart();
        });

        try {
            await client.connect();
            await client.query(`LISTEN ${channel}`);
            subscriber = client;
        } catch (err) {
            log?.warn?.('[ws-bus] không mở được kết nối LISTEN', { message: err?.message });
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
    }),
});

module.exports = notificationBus;
module.exports.createNotificationBus = createNotificationBus;

/**
 * notificationBus — phát tán sự kiện realtime giữa các instance Cloud Run.
 *
 * Vì sao cần: `clientsByUserId` của notificationGateway là Map trong RAM của MỘT
 * instance. Service `backend` đang đặt `maxScale = 20` và không bật session affinity,
 * nên WebSocket của tài xế nằm ở instance A trong khi request của điều phối viên có
 * thể rơi vào instance B — `broadcastToUser` ở B không tìm thấy socket nào và thông
 * báo biến mất khỏi realtime. Bus này dùng Postgres LISTEN/NOTIFY (đã có sẵn Cloud SQL,
 * không phải dựng thêm Redis) để mọi instance cùng nhận và cùng gửi cho socket của mình.
 */
const assert = require('node:assert');
const { createNotificationBus } = require('../services/notificationBus');

/** Client pg giả — đủ để kiểm tra vòng đời LISTEN và luồng sự kiện 'notification'. */
class FakeClient {
    constructor() {
        this.connected = false;
        this.queries = [];
        this.handlers = {};
        this.endCalls = 0;
    }

    on(event, fn) { this.handlers[event] = fn; return this; }

    async connect() { this.connected = true; }

    async query(text) { this.queries.push(text); return { rows: [] }; }

    async end() { this.endCalls += 1; this.connected = false; }

    /** Postgres đẩy NOTIFY về. */
    emitNotification(channel, payload) {
        this.handlers.notification?.({ channel, payload });
    }

    emitError(err) { this.handlers.error?.(err); }
}

const setup = ({ queryImpl } = {}) => {
    const clients = [];
    const queries = [];
    const bus = createNotificationBus({
        channel: 'ws_test',
        reconnectDelayMs: 10,
        query: async (text, params) => {
            queries.push({ text, params });
            if (queryImpl) return queryImpl(text, params);
            return { rows: [] };
        },
        clientFactory: () => {
            const c = new FakeClient();
            clients.push(c);
            return c;
        },
    });
    return { bus, clients, queries };
};

const tick = async () => { for (let i = 0; i < 5; i += 1) await Promise.resolve(); };

describe('notificationBus', () => {
    it('publish() trả false khi bus chưa chạy — bên gọi phải tự gửi local', () => {
        const { bus, queries } = setup();

        assert.strictEqual(bus.publish({ scope: 'user', key: '1', payload: { a: 1 } }), false);
        assert.strictEqual(queries.length, 0);
    });

    it('subscribe() mở client riêng và chạy LISTEN đúng channel', async () => {
        const { bus, clients } = setup();

        bus.subscribe(() => {});
        await tick();

        assert.strictEqual(clients.length, 1);
        assert.strictEqual(clients[0].connected, true);
        assert.ok(clients[0].queries.some((q) => q === 'LISTEN ws_test'));
        await bus.stop();
    });

    it('publish() gửi pg_notify với đúng channel và payload JSON', async () => {
        const { bus, queries } = setup();
        bus.subscribe(() => {});
        await tick();

        const message = { scope: 'user', key: '42', payload: { type: 'notification.created' } };
        assert.strictEqual(bus.publish(message), true);

        assert.strictEqual(queries.length, 1);
        assert.match(queries[0].text, /pg_notify/);
        assert.strictEqual(queries[0].params[0], 'ws_test');
        assert.deepStrictEqual(JSON.parse(queries[0].params[1]), message);
        await bus.stop();
    });

    it('NOTIFY về thì gọi handler với object đã parse', async () => {
        const { bus, clients } = setup();
        const received = [];
        bus.subscribe((m) => received.push(m));
        await tick();

        clients[0].emitNotification('ws_test', JSON.stringify({ scope: 'role', key: 'coordinator', payload: { x: 1 } }));

        assert.deepStrictEqual(received, [{ scope: 'role', key: 'coordinator', payload: { x: 1 } }]);
        await bus.stop();
    });

    it('bỏ qua NOTIFY của channel khác', async () => {
        const { bus, clients } = setup();
        const received = [];
        bus.subscribe((m) => received.push(m));
        await tick();

        clients[0].emitNotification('channel_khac', JSON.stringify({ scope: 'user', key: '1', payload: {} }));

        assert.strictEqual(received.length, 0);
        await bus.stop();
    });

    it('payload hỏng không được làm sập tiến trình', async () => {
        const { bus, clients } = setup();
        const received = [];
        bus.subscribe((m) => received.push(m));
        await tick();

        assert.doesNotThrow(() => clients[0].emitNotification('ws_test', '{khong-phai-json'));
        assert.strictEqual(received.length, 0);
        await bus.stop();
    });

    it('handler ném lỗi cũng không làm sập tiến trình', async () => {
        const { bus, clients } = setup();
        bus.subscribe(() => { throw new Error('handler hỏng'); });
        await tick();

        assert.doesNotThrow(() => clients[0].emitNotification('ws_test', JSON.stringify({ scope: 'user', key: '1', payload: {} })));
        await bus.stop();
    });

    it('payload vượt giới hạn 8000 byte của pg_notify thì trả false thay vì ném lỗi', async () => {
        const { bus, queries } = setup();
        bus.subscribe(() => {});
        await tick();

        const qua_to = { scope: 'user', key: '1', payload: { message: 'x'.repeat(9000) } };

        assert.strictEqual(bus.publish(qua_to), false);
        assert.strictEqual(queries.length, 0);
        await bus.stop();
    });

    it('pg_notify lỗi thì vẫn phục vụ được instance hiện tại', async () => {
        const received = [];
        const { bus } = setup({ queryImpl: async () => { throw new Error('DB mất kết nối'); } });
        bus.subscribe((m) => received.push(m));
        await tick();

        const message = { scope: 'user', key: '7', payload: { a: 1 } };
        assert.strictEqual(bus.publish(message), true);
        await tick();

        // NOTIFY không đi được ra ngoài, nhưng socket trên chính instance này vẫn phải nhận.
        assert.deepStrictEqual(received, [message]);
        await bus.stop();
    });

    it('mất kết nối thì tự dựng lại client và LISTEN lại', async () => {
        const { bus, clients } = setup();
        bus.subscribe(() => {});
        await tick();
        assert.strictEqual(clients.length, 1);

        clients[0].emitError(new Error('connection terminated'));
        await new Promise((r) => setTimeout(r, 40));
        await tick();

        assert.strictEqual(clients.length, 2);
        assert.ok(clients[1].queries.some((q) => q === 'LISTEN ws_test'));
        await bus.stop();
    });

    it('stop() rồi thì không tự dựng lại nữa', async () => {
        const { bus, clients } = setup();
        bus.subscribe(() => {});
        await tick();

        await bus.stop();
        await new Promise((r) => setTimeout(r, 40));
        await tick();

        assert.strictEqual(clients.length, 1);
        assert.strictEqual(bus.publish({ scope: 'user', key: '1', payload: {} }), false);
    });
});

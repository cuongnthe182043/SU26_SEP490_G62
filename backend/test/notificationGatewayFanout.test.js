/**
 * notificationGateway — giao hàng qua bus thay vì gửi thẳng vào Map trong RAM.
 *
 * Khoá lại hành vi: mọi lời phát đều đi vòng qua notificationBus, và instance nào
 * cũng gửi cho socket của riêng mình khi bus đẩy message về. Nhờ vậy WebSocket nằm ở
 * instance A vẫn nhận được thông báo do instance B tạo ra.
 */
const { mock } = require('./helpers/nodeTestMock');
const assert = require('node:assert');

const notificationBus = require('../services/notificationBus');
const gateway = require('../services/notificationGateway');

class FakeWs {
    constructor(readyState = 1) {
        this.readyState = readyState;
        this.sent = [];
        this.listeners = {};
    }

    on(event, fn) {
        (this.listeners[event] = this.listeners[event] || []).push(fn);
        return this;
    }

    send(data) { this.sent.push(JSON.parse(data)); }

    emit(event) { (this.listeners[event] || []).forEach((fn) => fn()); }
}

describe('notificationGateway — fanout đa instance', () => {
    const mo = [];

    const themClient = (userId, role, readyState = 1) => {
        const ws = new FakeWs(readyState);
        gateway.addClient(userId, role, ws);
        mo.push(ws);
        return ws;
    };

    afterEach(() => {
        // socket tự gỡ khỏi registry khi 'close' — dọn sạch state module giữa các test
        mo.splice(0).forEach((ws) => ws.emit('close'));
        mock.restoreAll();
    });

    it('broadcastToUser() đẩy qua bus, KHÔNG gửi thẳng socket', () => {
        const ws = themClient(1, 'driver');
        mock.method(notificationBus, 'publish', () => true);   // bus sống

        gateway.broadcastToUser(1, { type: 'notification.created' });

        const [message] = notificationBus.publish.mock.calls[0].arguments;
        assert.deepStrictEqual(message, {
            scope: 'user', key: '1', payload: { type: 'notification.created' },
        });
        // Chưa gửi ngay — chờ bus đẩy về, tránh instance này giao hàng hai lần
        assert.strictEqual(ws.sent.length, 0);
    });

    it('bus chưa sẵn sàng thì gửi thẳng socket local (không mất thông báo)', () => {
        const ws = themClient(1, 'driver');
        mock.method(notificationBus, 'publish', () => false);

        gateway.broadcastToUser(1, { type: 'notification.created' });

        assert.deepStrictEqual(ws.sent, [{ type: 'notification.created' }]);
    });

    it('message từ bus (scope user) tới đúng socket của user đó', () => {
        const cua_1 = themClient(1, 'driver');
        const cua_2 = themClient(2, 'driver');

        gateway.applyBusMessage({ scope: 'user', key: '1', payload: { type: 'x' } });

        assert.deepStrictEqual(cua_1.sent, [{ type: 'x' }]);
        assert.strictEqual(cua_2.sent.length, 0);
    });

    it('một user nhiều thiết bị thì mọi thiết bị đều nhận', () => {
        const dien_thoai = themClient(1, 'driver');
        const may_tinh   = themClient(1, 'driver');

        gateway.applyBusMessage({ scope: 'user', key: '1', payload: { type: 'x' } });

        assert.strictEqual(dien_thoai.sent.length, 1);
        assert.strictEqual(may_tinh.sent.length, 1);
    });

    it('message từ bus (scope role) tới đúng role', () => {
        const dieu_phoi = themClient(10, 'coordinator');
        const tai_xe    = themClient(11, 'driver');

        gateway.applyBusMessage({ scope: 'role', key: 'coordinator', payload: { type: 'alert' } });

        assert.deepStrictEqual(dieu_phoi.sent, [{ type: 'alert' }]);
        assert.strictEqual(tai_xe.sent.length, 0);
    });

    it('bỏ qua message của bus không đúng định dạng', () => {
        const ws = themClient(1, 'driver');

        assert.doesNotThrow(() => gateway.applyBusMessage(null));
        assert.doesNotThrow(() => gateway.applyBusMessage({ scope: 'la_hoac', key: '1', payload: {} }));
        assert.strictEqual(ws.sent.length, 0);
    });

    it('không gửi vào socket đã đóng', () => {
        const CLOSED = 3;
        const ws = themClient(1, 'driver', CLOSED);

        gateway.applyBusMessage({ scope: 'user', key: '1', payload: { type: 'x' } });

        assert.strictEqual(ws.sent.length, 0);
    });

    it('broadcastToRole() cũng đi qua bus', () => {
        themClient(10, 'manager');
        mock.method(notificationBus, 'publish', () => true);

        gateway.broadcastToRole('manager', { type: 'alert' });

        const [message] = notificationBus.publish.mock.calls[0].arguments;
        assert.deepStrictEqual(message, { scope: 'role', key: 'manager', payload: { type: 'alert' } });
    });

    it('notifyCreated() gắn display_mode rồi mới phát', () => {
        mock.method(notificationBus, 'publish', () => true);

        gateway.notifyCreated({ id: 5, user_id: 3, title: 'A' }, { displayMode: 'alert' });

        const [message] = notificationBus.publish.mock.calls[0].arguments;
        assert.strictEqual(message.scope, 'user');
        assert.strictEqual(message.key, '3');
        assert.strictEqual(message.payload.notification.display_mode, 'alert');
    });
});

/**
 * fcmService — đường push nền qua Expo Push Service.
 *
 * Bộ test này khoá lại phần QUAN SÁT ĐƯỢC của đường push. Code cũ nuốt im lặng mọi
 * lỗi (`if (!res.ok) continue;` và `catch {}` rỗng) và không bao giờ lấy receipt, nên
 * khi tài xế báo "thông báo về chậm" thì không có một dòng bằng chứng nào để lần.
 *
 * Nguyên tắc không đổi: push là tính năng phụ, hỏng thế nào cũng KHÔNG được ném lỗi
 * ra ngoài làm sập luồng nghiệp vụ chính. Nhưng "không ném" khác với "không ghi lại".
 */
const { mock } = require('./helpers/nodeTestMock');
const assert = require('node:assert');

const pool = require('../config/database');
const logger = require('../config/logger');
const fcmService = require('../services/fcmService');

const TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

/** Ghi lại mọi câu SQL để assert, trả kết quả theo kịch bản. */
const stubPool = (handler) => {
    const calls = [];
    mock.method(pool, 'query', async (text, params) => {
        calls.push({ text: String(text), params });
        const res = handler ? await handler(String(text), params) : null;
        return res ?? { rows: [], rowCount: 0 };
    });
    return calls;
};

const stubFetch = (impl) => {
    const calls = [];
    global.fetch = async (url, options) => {
        calls.push({ url, body: JSON.parse(options.body), headers: options.headers });
        return impl(url, options);
    };
    return calls;
};

const jsonResponse = (body, ok = true, status = 200) => ({
    ok, status,
    json: async () => body,
    text: async () => JSON.stringify(body),
});

const originalFetch = global.fetch;

describe('fcmService — gửi push', () => {
    afterEach(() => {
        mock.restoreAll();
        global.fetch = originalFetch;
    });

    it('không có token thì không gọi Expo', async () => {
        stubPool(async () => ({ rows: [] }));
        const fetchCalls = stubFetch(() => jsonResponse({ data: [] }));

        await fcmService.sendNotification(1, { title: 'A', body: 'B' });

        assert.strictEqual(fetchCalls.length, 0);
    });

    it('bỏ qua token không đúng định dạng Expo', async () => {
        stubPool(async () => ({ rows: [{ token: 'fcm-token-thuong' }] }));
        const fetchCalls = stubFetch(() => jsonResponse({ data: [] }));

        await fcmService.sendNotification(1, { title: 'A', body: 'B' });

        assert.strictEqual(fetchCalls.length, 0);
    });

    it('gửi đúng priority high và channelId default', async () => {
        stubPool(async (text) => (text.includes('SELECT token') ? { rows: [{ token: TOKEN_A }] } : null));
        const fetchCalls = stubFetch(() => jsonResponse({ data: [{ status: 'ok', id: 'tk-1' }] }));

        await fcmService.sendNotification(1, { title: 'Chuyến mới', body: 'Nội dung' });

        assert.strictEqual(fetchCalls.length, 1);
        const [msg] = fetchCalls[0].body;
        assert.strictEqual(msg.to, TOKEN_A);
        assert.strictEqual(msg.priority, 'high');
        assert.strictEqual(msg.channelId, 'default');
        assert.strictEqual(msg.title, 'Chuyến mới');
    });

    it('Expo trả HTTP lỗi thì phải GHI LOG, không được nuốt im lặng', async () => {
        stubPool(async (text) => (text.includes('SELECT token') ? { rows: [{ token: TOKEN_A }] } : null));
        stubFetch(() => jsonResponse({ errors: [{ code: 'PUSH_TOO_MANY_EXPERIENCE_IDS' }] }, false, 400));
        const warn = mock.method(logger, 'warn', () => {});

        await fcmService.sendNotification(1, { title: 'A', body: 'B' });

        assert.ok(warn.mock.calls.length > 0, 'phải có log cảnh báo khi Expo trả lỗi HTTP');
        assert.match(warn.mock.calls[0].arguments[0], /push/i);
    });

    it('mạng hỏng thì ghi log và KHÔNG ném ra ngoài', async () => {
        stubPool(async (text) => (text.includes('SELECT token') ? { rows: [{ token: TOKEN_A }] } : null));
        global.fetch = async () => { throw new Error('ECONNRESET'); };
        const warn = mock.method(logger, 'warn', () => {});

        await assert.doesNotReject(() => fcmService.sendNotification(1, { title: 'A', body: 'B' }));
        assert.ok(warn.mock.calls.length > 0);
    });

    it('ticket thành công được lưu lại để đối chiếu receipt', async () => {
        const calls = stubPool(async (text) => (text.includes('SELECT token') ? { rows: [{ token: TOKEN_A }] } : null));
        stubFetch(() => jsonResponse({ data: [{ status: 'ok', id: 'tk-abc' }] }));

        await fcmService.sendNotification(7, { title: 'A', body: 'B' });

        const insert = calls.find((c) => c.text.includes('INSERT INTO push_tickets'));
        assert.ok(insert, 'phải lưu ticket vào push_tickets');
        assert.ok(insert.params.flat().includes('tk-abc'));
    });

    it('ticket lỗi DeviceNotRegistered thì xoá token chết', async () => {
        const calls = stubPool(async (text) => (text.includes('SELECT token') ? { rows: [{ token: TOKEN_A }] } : null));
        stubFetch(() => jsonResponse({
            data: [{ status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }],
        }));
        mock.method(logger, 'warn', () => {});

        await fcmService.sendNotification(1, { title: 'A', body: 'B' });

        const del = calls.find((c) => c.text.includes('DELETE FROM device_tokens'));
        assert.ok(del, 'phải xoá token chết');
    });

    it('ticket lỗi loại khác thì ghi log kèm mã lỗi, không xoá token', async () => {
        const calls = stubPool(async (text) => (text.includes('SELECT token') ? { rows: [{ token: TOKEN_A }] } : null));
        stubFetch(() => jsonResponse({
            data: [{ status: 'error', message: 'quá nhiều', details: { error: 'MessageRateExceeded' } }],
        }));
        const warn = mock.method(logger, 'warn', () => {});

        await fcmService.sendNotification(1, { title: 'A', body: 'B' });

        assert.ok(warn.mock.calls.length > 0);
        assert.ok(!calls.some((c) => c.text.includes('DELETE FROM device_tokens')));
    });

    it('nhiều thiết bị của cùng user gửi trong MỘT request tới Expo', async () => {
        stubPool(async (text) => (text.includes('SELECT token') ? { rows: [{ token: TOKEN_A }, { token: TOKEN_B }] } : null));
        const fetchCalls = stubFetch(() => jsonResponse({
            data: [{ status: 'ok', id: 'tk-1' }, { status: 'ok', id: 'tk-2' }],
        }));

        await fcmService.sendNotification(1, { title: 'A', body: 'B' });

        assert.strictEqual(fetchCalls.length, 1);
        assert.strictEqual(fetchCalls[0].body.length, 2);
    });
});

describe('fcmService — đối chiếu receipt', () => {
    afterEach(() => {
        mock.restoreAll();
        global.fetch = originalFetch;
    });

    it('không có ticket chờ thì không gọi Expo', async () => {
        stubPool(async () => ({ rows: [] }));
        const fetchCalls = stubFetch(() => jsonResponse({ data: {} }));

        const result = await fcmService.checkReceipts();

        assert.strictEqual(fetchCalls.length, 0);
        assert.strictEqual(result.checked, 0);
    });

    it('receipt ok thì đánh dấu đã đối chiếu', async () => {
        const calls = stubPool(async (text) => (
            text.includes('SELECT') && text.includes('push_tickets')
                ? { rows: [{ ticket_id: 'tk-1', token: TOKEN_A }] }
                : null
        ));
        stubFetch(() => jsonResponse({ data: { 'tk-1': { status: 'ok' } } }));

        const result = await fcmService.checkReceipts();

        assert.strictEqual(result.checked, 1);
        assert.strictEqual(result.errors, 0);
        assert.ok(calls.some((c) => c.text.includes('UPDATE push_tickets')));
    });

    it('receipt báo DeviceNotRegistered thì xoá token và đếm là lỗi', async () => {
        const calls = stubPool(async (text) => (
            text.includes('SELECT') && text.includes('push_tickets')
                ? { rows: [{ ticket_id: 'tk-1', token: TOKEN_A }] }
                : null
        ));
        stubFetch(() => jsonResponse({
            data: { 'tk-1': { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } } },
        }));
        mock.method(logger, 'warn', () => {});

        const result = await fcmService.checkReceipts();

        assert.strictEqual(result.errors, 1);
        assert.ok(calls.some((c) => c.text.includes('DELETE FROM device_tokens')));
    });

    it('receipt lỗi loại khác thì ghi log kèm mã lỗi để lần nguyên nhân', async () => {
        stubPool(async (text) => (
            text.includes('SELECT') && text.includes('push_tickets')
                ? { rows: [{ ticket_id: 'tk-1', token: TOKEN_A }] }
                : null
        ));
        stubFetch(() => jsonResponse({
            data: { 'tk-1': { status: 'error', message: 'hỏng', details: { error: 'MessageTooBig' } } },
        }));
        const warn = mock.method(logger, 'warn', () => {});

        const result = await fcmService.checkReceipts();

        assert.strictEqual(result.errors, 1);
        const logged = warn.mock.calls.map((c) => JSON.stringify(c.arguments)).join(' ');
        assert.match(logged, /MessageTooBig/);
    });

    it('Expo hỏng lúc lấy receipt thì không ném ra ngoài', async () => {
        stubPool(async (text) => (
            text.includes('SELECT') && text.includes('push_tickets')
                ? { rows: [{ ticket_id: 'tk-1', token: TOKEN_A }] }
                : null
        ));
        global.fetch = async () => { throw new Error('Expo down'); };
        mock.method(logger, 'warn', () => {});

        await assert.doesNotReject(() => fcmService.checkReceipts());
    });
});

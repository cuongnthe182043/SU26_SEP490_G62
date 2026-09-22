/**
 * Mốc request tới máy chủ — mọi hạn chót bên trong (RESPONSE_BUDGET_MS) đếm từ đây.
 */
const assert = require('node:assert');

const { trackRequestTiming } = require('../../middleware/requestTiming');

describe('trackRequestTiming', () => {
    it('đặt mốc request tới để các hạn chót bên trong đếm từ đó', () => {
        const req = {};
        const truoc = Date.now();

        trackRequestTiming(req, {}, () => {});

        assert.ok(req.receivedAt >= truoc && req.receivedAt <= Date.now());
    });

    it('luôn gọi next() — không được chắn đường request nào', () => {
        let called = 0;
        trackRequestTiming({}, {}, () => { called += 1; });

        assert.strictEqual(called, 1);
    });
});

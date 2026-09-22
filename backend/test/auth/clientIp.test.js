/**
 * Rate limit phải đếm theo IP của NGƯỜI DÙNG, không phải của Cloudflare.
 *
 * Production đi client → Cloudflare → proxy Render → Node, và req.ip dừng ở máy Cloudflare.
 * Log thật: một phiên admin hiện ra dưới 3 IP trong 3 giây, và một IP Cloudflare phục vụ
 * cùng lúc trình duyệt admin lẫn app tài xế. Khi đó trần 20 lần đăng nhập / 15 phút là
 * trần CHUNG của mọi tài xế đi qua cùng máy Cloudflare.
 */
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const rateLimit = require('express-rate-limit');

const { clientIp, rateLimitKey } = require('../../utils/clientIp');

/** App tối giản dựng giống app.js: sau một lớp proxy, trần 1 request cho dễ chạm. */
const buildApp = () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(rateLimit({ windowMs: 60_000, limit: 1, keyGenerator: rateLimitKey }));
    app.get('/', (req, res) => res.json({ ip: clientIp(req) }));
    return app;
};

// Cùng một máy Cloudflare chuyển request của hai người dùng khác nhau.
const viaCloudflare = (req, userIp) => req
    .set('X-Forwarded-For', `${userIp}, 104.23.175.46`)
    .set('CF-Connecting-IP', userIp);

describe('clientIp — IP thật sau Cloudflare', () => {
    it('lấy IP từ CF-Connecting-IP thay vì IP của máy Cloudflare', async () => {
        const res = await viaCloudflare(request(buildApp()).get('/'), '113.161.1.1');

        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.ip, '113.161.1.1');
    });

    it('không có header (local, test) thì lùi về req.ip như cũ', () => {
        assert.strictEqual(clientIp({ headers: {}, ip: '10.0.0.5' }), '10.0.0.5');
    });

    it('hai người dùng sau CÙNG một máy Cloudflare có trần riêng', async () => {
        const app = buildApp();

        const a = await viaCloudflare(request(app).get('/'), '113.161.1.1');
        const b = await viaCloudflare(request(app).get('/'), '14.232.2.2');

        assert.strictEqual(a.status, 200);
        assert.strictEqual(b.status, 200, 'người thứ hai không được ăn trần của người thứ nhất');
    });

    it('vẫn chặn đúng người đã vượt trần', async () => {
        const app = buildApp();

        await viaCloudflare(request(app).get('/'), '113.161.1.1');
        const again = await viaCloudflare(request(app).get('/'), '113.161.1.1');

        assert.strictEqual(again.status, 429);
    });

    it('IPv6 gộp theo dải: đổi địa chỉ trong cùng dải không thoát trần', async () => {
        const app = buildApp();

        await viaCloudflare(request(app).get('/'), '2001:db8:abcd:1200::1');
        const again = await viaCloudflare(request(app).get('/'), '2001:db8:abcd:1200::2');

        assert.strictEqual(again.status, 429);
    });
});

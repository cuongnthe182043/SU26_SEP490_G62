
const pool = require('../config/database');

// ─── Push nền qua Expo Push Service ───────────────────────────────────────────
// App mobile build bằng EAS (expo-notifications), nên gửi push qua Expo Push API
// thay vì firebase-admin trực tiếp: Expo tự route sang FCM (Android) và APNs (iOS)
// bằng credential đã cấu hình trong EAS — chạy được CẢ HAI nền tảng, không cần
// firebase-admin / GoogleService-Info.plist / APNs key ở phía server.
//
// Token lưu ở device_tokens là Expo push token dạng ExponentPushToken[...].
// Mọi lỗi push đều nuốt im lặng — đây là tính năng phụ, không được làm sập luồng chính.
//
// Nếu bật "Enhanced Security for Push" trên Expo, set env EXPO_ACCESS_TOKEN.
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const EXPO_CHUNK_SIZE = 100; // Expo nhận tối đa 100 message / request

const isExpoPushToken = (token) =>
    typeof token === 'string'
    && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));

/**
 * Đăng ký device push token cho 1 user. Lưu ở DB (không phải RAM) vì Cloud Run có
 * thể chạy nhiều instance / restart bất kỳ lúc nào. Một user có nhiều thiết bị → upsert
 * theo token (không theo user_id), cho phép nhiều dòng cùng user_id.
 * @param {number|string} profileId
 * @param {string} token  Expo push token (ExponentPushToken[...])
 * @param {string} [platform]  'android' | 'ios' | 'web'
 */
const registerToken = async (profileId, token, platform = 'android') => {
    if (!profileId || !token) return;
    await pool.query(
        `INSERT INTO device_tokens (user_id, token, platform)
         VALUES ($1, $2, $3)
         ON CONFLICT (token) DO UPDATE
             SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = NOW()`,
        [profileId, token, platform],
    );
};

/**
 * Xoá toàn bộ token của 1 user (VD: khi logout).
 * @param {number|string} profileId
 */
const removeToken = async (profileId) => {
    if (!profileId) return;
    await pool.query('DELETE FROM device_tokens WHERE user_id = $1', [profileId]);
};

// Dọn token chết (thiết bị gỡ app / thu hồi quyền) — Expo trả DeviceNotRegistered.
const deleteTokens = async (tokens) => {
    if (!tokens.length) return;
    await pool.query('DELETE FROM device_tokens WHERE token = ANY($1)', [tokens]).catch(() => {});
};

/**
 * Gửi push tới 1 user (tất cả thiết bị đã đăng ký).
 * No-op im lặng nếu: chưa có token / token không phải Expo / Expo trả lỗi.
 * @param {number|string} profileId
 * @param {{ title: string, body: string, data?: object }} payload
 */
const sendNotification = async (profileId, { title, body, data = {} }) => {
    if (!profileId) return;

    const { rows } = await pool.query(
        'SELECT token FROM device_tokens WHERE user_id = $1',
        [profileId],
    );
    const tokens = rows.map((r) => r.token).filter(isExpoPushToken);
    if (tokens.length === 0) return;

    // Expo yêu cầu mọi field data là string.
    const stringData = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)]),
    );

    const messages = tokens.map((token) => ({
        to: token,
        title,
        body: body ?? '',
        data: stringData,
        sound: 'default',
        priority: 'high',
        channelId: 'default', // Android — khớp channel tạo ở use-register-push-token.ts
    }));

    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
    };
    if (process.env.EXPO_ACCESS_TOKEN) {
        headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    }

    for (let i = 0; i < messages.length; i += EXPO_CHUNK_SIZE) {
        const chunk = messages.slice(i, i + EXPO_CHUNK_SIZE);
        try {
            const res = await fetch(EXPO_PUSH_ENDPOINT, {
                method: 'POST',
                headers,
                body: JSON.stringify(chunk),
            });
            if (!res.ok) continue;

            const json = await res.json().catch(() => null);
            const tickets = json?.data;
            if (!Array.isArray(tickets)) continue;

            // Ticket lỗi DeviceNotRegistered → token chết, dọn khỏi DB.
            const dead = [];
            tickets.forEach((ticket, idx) => {
                if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
                    dead.push(chunk[idx].to);
                }
            });
            if (dead.length) await deleteTokens(dead);
        } catch {
            // Push lỗi (mạng, Expo down...) không được làm sập luồng nghiệp vụ chính.
        }
    }
};

/**
 * Gửi push tới nhiều user.
 * @param {Array<number|string>} profileIds
 * @param {{ title: string, body: string, data?: object }} payload
 */
const sendToMany = (profileIds, payload) => {
    const ids = [...new Set((profileIds ?? []).filter(Boolean).map(String))];
    return Promise.all(ids.map((id) => sendNotification(id, payload)));
};

module.exports = { registerToken, removeToken, sendNotification, sendToMany };

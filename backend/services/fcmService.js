
const pool = require('../config/database');
const logger = require('../config/logger');

// ─── Push nền qua Expo Push Service ───────────────────────────────────────────
// App mobile build bằng EAS (expo-notifications), nên gửi push qua Expo Push API
// thay vì firebase-admin trực tiếp: Expo tự route sang FCM (Android) và APNs (iOS)
// bằng credential đã cấu hình trong EAS — chạy được CẢ HAI nền tảng, không cần
// firebase-admin / GoogleService-Info.plist / APNs key ở phía server.
//
// Token lưu ở device_tokens là Expo push token dạng ExponentPushToken[...].
//
// Push là tính năng phụ: hỏng thế nào cũng KHÔNG được ném lỗi ra ngoài làm sập luồng
// nghiệp vụ chính. Nhưng "không ném" khác với "không ghi lại" — bản trước nuốt im lặng
// mọi lỗi (`if (!res.ok) continue;` và `catch {}` rỗng), nên khi tài xế báo thông báo
// về chậm thì không có một dòng bằng chứng nào để lần. Giờ mọi nhánh đều có log.
//
// Expo giao hàng theo HAI bước và bản trước chỉ làm bước một:
//
//   POST /push/send        → "ticket": Expo đã NHẬN message, CHƯA gửi đi
//   POST /push/getReceipts → "receipt": FCM/APNs đã nhận chưa, hỏng thì vì sao
//
// Ticket "ok" KHÔNG có nghĩa là máy đã nhận. Muốn biết thật thì phải đối chiếu receipt
// (xem checkReceipts, chạy định kỳ bằng cron/pushCron.js).
//
// Nếu bật "Enhanced Security for Push" trên Expo, set env EXPO_ACCESS_TOKEN.
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPT_ENDPOINT = 'https://exp.host/--/api/v2/push/getReceipts';
const EXPO_CHUNK_SIZE = 100;      // Expo nhận tối đa 100 message / request gửi
const EXPO_RECEIPT_CHUNK = 300;   // và tối đa 1000 id / request lấy receipt
// Expo cần chút thời gian mới có receipt; hỏi quá sớm chỉ nhận về "chưa có".
const RECEIPT_DELAY = '5 minutes';
const TICKET_RETENTION = '7 days';
const RECEIPT_BATCH_LIMIT = 900;

const isExpoPushToken = (token) =>
    typeof token === 'string'
    && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));

const buildHeaders = () => {
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
    };
    if (process.env.EXPO_ACCESS_TOKEN) {
        headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    }
    return headers;
};

/**
 * Đăng ký device push token cho 1 user. Lưu ở DB (không phải RAM) vì Cloud Run có
 * thể chạy nhiều instance / restart bất kỳ lúc nào. Một user có nhiều thiết bị → upsert
 * theo token (không theo user_id), cho phép nhiều dòng cùng user_id.
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

/** Xoá toàn bộ token của 1 user (VD: khi logout). */
const removeToken = async (profileId) => {
    if (!profileId) return;
    await pool.query('DELETE FROM device_tokens WHERE user_id = $1', [profileId]);
};

// Dọn token chết (thiết bị gỡ app / thu hồi quyền) — Expo trả DeviceNotRegistered.
const deleteTokens = async (tokens) => {
    if (!tokens.length) return;
    await pool.query('DELETE FROM device_tokens WHERE token = ANY($1)', [tokens]).catch(() => {});
};

/** Giữ ticket lại để cron đối chiếu receipt sau vài phút. */
const saveTickets = async (profileId, tickets) => {
    if (!tickets.length) return;
    await pool.query(
        `INSERT INTO push_tickets (ticket_id, token, user_id)
         SELECT t.ticket, t.tok, $3
         FROM UNNEST($1::text[], $2::text[]) AS t(ticket, tok)
         ON CONFLICT (ticket_id) DO NOTHING`,
        [tickets.map((t) => t.id), tickets.map((t) => t.token), profileId || null],
    ).catch((err) => {
        logger.warn('[push] không lưu được ticket để đối chiếu receipt', { message: err.message });
    });
};

/**
 * Gửi push tới 1 user (tất cả thiết bị đã đăng ký).
 * Không bao giờ ném lỗi ra ngoài.
 */
const sendNotification = async (profileId, { title, body, data = {} }) => {
    if (!profileId) return;

    const { rows } = await pool.query(
        'SELECT token FROM device_tokens WHERE user_id = $1',
        [profileId],
    );
    const tokens = rows.map((r) => r.token).filter(isExpoPushToken);
    if (tokens.length === 0) {
        logger.info('[push] bỏ qua — user chưa đăng ký thiết bị nào', { userId: profileId });
        return;
    }

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

    const headers = buildHeaders();

    for (let i = 0; i < messages.length; i += EXPO_CHUNK_SIZE) {
        const chunk = messages.slice(i, i + EXPO_CHUNK_SIZE);
        const startedAt = Date.now();

        try {
            const res = await fetch(EXPO_PUSH_ENDPOINT, {
                method: 'POST',
                headers,
                body: JSON.stringify(chunk),
            });
            const ms = Date.now() - startedAt;

            if (!res.ok) {
                const chiTiet = await res.text().catch(() => '');
                logger.warn('[push] Expo từ chối request gửi', {
                    userId: profileId, status: res.status, ms, body: chiTiet.slice(0, 400),
                });
                continue;
            }

            const json = await res.json().catch(() => null);
            const tickets = json?.data;
            if (!Array.isArray(tickets)) {
                logger.warn('[push] Expo trả về dữ liệu không đúng định dạng', { userId: profileId, ms });
                continue;
            }

            const dead = [];
            const okTickets = [];
            tickets.forEach((ticket, idx) => {
                const token = chunk[idx]?.to;
                if (ticket?.status === 'ok' && ticket.id) {
                    okTickets.push({ id: ticket.id, token });
                    return;
                }
                if (ticket?.status !== 'error') return;

                const code = ticket?.details?.error;
                if (code === 'DeviceNotRegistered') {
                    dead.push(token);   // thiết bị đã gỡ app — dọn token, không phải sự cố
                    return;
                }
                logger.warn('[push] ticket lỗi', {
                    userId: profileId, code, message: ticket?.message,
                });
            });

            // Log này là điểm neo để đo độ trễ chặng backend → Expo trong Cloud Logging.
            logger.info('[push] đã gửi', {
                userId: profileId,
                thietBi: chunk.length,
                ok: okTickets.length,
                loi: chunk.length - okTickets.length,
                ms,
            });

            if (okTickets.length) await saveTickets(profileId, okTickets);
            if (dead.length) await deleteTokens(dead);
        } catch (err) {
            logger.warn('[push] gửi thất bại', {
                userId: profileId, ms: Date.now() - startedAt, message: err.message,
            });
        }
    }
};

/** Gửi push tới nhiều user. */
const sendToMany = (profileIds, payload) => {
    const ids = [...new Set((profileIds ?? []).filter(Boolean).map(String))];
    return Promise.all(ids.map((id) => sendNotification(id, payload)));
};

const markChecked = async (ticketIds, status, errorCode = null) => {
    if (!ticketIds.length) return;
    await pool.query(
        `UPDATE push_tickets
            SET checked_at = NOW(), status = $2, error_code = $3
          WHERE ticket_id = ANY($1)`,
        [ticketIds, status, errorCode],
    ).catch((err) => {
        logger.warn('[push] không đánh dấu được ticket đã đối chiếu', { message: err.message });
    });
};

/**
 * Đối chiếu receipt cho các ticket đã gửi — đây mới là chỗ biết được máy có thật sự
 * nhận hay không. Chạy định kỳ bằng cron.
 *
 * @returns {{ checked: number, errors: number }}
 */
const checkReceipts = async () => {
    const { rows } = await pool.query(
        `SELECT ticket_id, token
           FROM push_tickets
          WHERE checked_at IS NULL
            AND sent_at < NOW() - INTERVAL '${RECEIPT_DELAY}'
          ORDER BY sent_at
          LIMIT ${RECEIPT_BATCH_LIMIT}`,
    );
    if (rows.length === 0) return { checked: 0, errors: 0 };

    const tokenByTicket = new Map(rows.map((r) => [r.ticket_id, r.token]));
    const headers = buildHeaders();
    let checked = 0;
    let errors = 0;

    for (let i = 0; i < rows.length; i += EXPO_RECEIPT_CHUNK) {
        const ids = rows.slice(i, i + EXPO_RECEIPT_CHUNK).map((r) => r.ticket_id);

        try {
            const res = await fetch(EXPO_RECEIPT_ENDPOINT, {
                method: 'POST',
                headers,
                body: JSON.stringify({ ids }),
            });
            if (!res.ok) {
                logger.warn('[push] Expo từ chối request lấy receipt', { status: res.status });
                continue;
            }

            const json = await res.json().catch(() => null);
            const receipts = json?.data;
            if (!receipts || typeof receipts !== 'object') {
                logger.warn('[push] receipt trả về không đúng định dạng');
                continue;
            }

            const ok = [];
            const dead = [];
            const loiTheoMa = new Map();

            for (const [ticketId, receipt] of Object.entries(receipts)) {
                // Receipt chưa sẵn sàng → để nguyên, lượt cron sau hỏi lại.
                if (!receipt?.status) continue;

                if (receipt.status === 'ok') {
                    ok.push(ticketId);
                    continue;
                }

                const code = receipt?.details?.error ?? 'UNKNOWN';
                if (code === 'DeviceNotRegistered') dead.push(tokenByTicket.get(ticketId));
                else {
                    logger.warn('[push] receipt báo lỗi', {
                        code, message: receipt?.message, ticketId,
                    });
                }
                if (!loiTheoMa.has(code)) loiTheoMa.set(code, []);
                loiTheoMa.get(code).push(ticketId);
            }

            await markChecked(ok, 'ok');
            for (const [code, danhSach] of loiTheoMa) {
                await markChecked(danhSach, 'error', code);
                errors += danhSach.length;
            }
            if (dead.length) await deleteTokens(dead.filter(Boolean));

            checked += ok.length;
        } catch (err) {
            logger.warn('[push] lấy receipt thất bại', { message: err.message });
        }
    }

    if (checked || errors) {
        logger.info('[push] đối chiếu receipt xong', { ok: checked, loi: errors });
    }
    return { checked, errors };
};

/** Dọn ticket đã đối chiếu để bảng không phình vô hạn. */
const purgeOldTickets = async () => {
    const res = await pool.query(
        `DELETE FROM push_tickets
          WHERE checked_at IS NOT NULL
            AND sent_at < NOW() - INTERVAL '${TICKET_RETENTION}'`,
    ).catch(() => null);
    return res?.rowCount ?? 0;
};

module.exports = {
    registerToken,
    removeToken,
    sendNotification,
    sendToMany,
    checkReceipts,
    purgeOldTickets,
};

-- Đối chiếu kết quả giao push của Expo.
--
-- VẤN ĐỀ: Expo Push giao hàng theo HAI bước, code cũ chỉ làm bước một.
--
--   POST /push/send        → "ticket": Expo đã NHẬN message, CHƯA gửi đi
--   POST /push/getReceipts → "receipt": FCM/APNs đã nhận chưa, hỏng thì hỏng vì sao
--
-- Dừng ở ticket nghĩa là không ai biết chuyện gì xảy ra sau đó. Thiết bị bị Doze,
-- credential FCM sai, token chết, MessageRateExceeded — tất cả đều im lặng. Đúng lúc
-- cần điều tra "vì sao tài xế nhận thông báo chậm" thì không có một dòng bằng chứng nào.
--
-- Bảng này giữ ticket lại để một cron job đối chiếu receipt sau vài phút, ghi log lỗi
-- thật và dọn token chết.
--
-- Vì sao lưu DB chứ không giữ trong RAM: Cloud Run scale về 0 và khởi động lại bất kỳ
-- lúc nào; setTimeout 15 phút trong RAM là mất trắng.
BEGIN;

CREATE TABLE IF NOT EXISTS push_tickets (
    id          BIGSERIAL PRIMARY KEY,
    ticket_id   TEXT        NOT NULL,
    token       TEXT        NOT NULL,   -- giữ lại để dọn khi receipt báo DeviceNotRegistered
    user_id     INT         REFERENCES profiles(id) ON DELETE SET NULL,
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checked_at  TIMESTAMPTZ,            -- NULL = chưa đối chiếu receipt
    status      VARCHAR(20),            -- 'ok' | 'error'
    error_code  TEXT,
    UNIQUE (ticket_id)
);

-- Index một phần: cron chỉ quét đúng các ticket chưa đối chiếu, không đụng lịch sử.
CREATE INDEX IF NOT EXISTS idx_push_tickets_pending
    ON push_tickets(sent_at)
    WHERE checked_at IS NULL;

COMMENT ON TABLE push_tickets IS
    'Ticket của Expo Push chờ đối chiếu receipt. Cron dọn sau 7 ngày.';

INSERT INTO schema_migrations (filename)
VALUES ('20260810_push_tickets.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

const cron = require('node-cron');
const fcmService = require('../services/fcmService');
const logger = require('../config/logger');

/**
 * Đối chiếu receipt của Expo Push.
 *
 * Ticket "ok" chỉ có nghĩa Expo đã NHẬN message, chưa nói gì về việc máy có nhận
 * được hay không. Receipt mới là bằng chứng thật. Job này chạy 10 phút một lần để
 * biến đường push từ hộp đen thành thứ đo được: mã lỗi thật hiện trong Cloud Logging,
 * token chết bị dọn tự động.
 *
 * Lưu ý vận hành: Cloud Run không đặt min-instances nên instance ngủ là cron ngủ theo.
 * Ticket không mất (nằm ở bảng push_tickets), chỉ là đối chiếu muộn hơn — lượt chạy
 * kế tiếp quét hết phần tồn. Việc này chấp nhận được vì đây là đường quan sát, không
 * phải đường giao hàng.
 */
const doiChieuReceipt = async () => {
    try {
        const { checked, errors } = await fcmService.checkReceipts();
        if (checked || errors) {
            logger.info(`[pushCron] Đối chiếu receipt: ${checked} ok, ${errors} lỗi`);
        }
    } catch (err) {
        logger.error('[pushCron] Lỗi khi đối chiếu receipt', { message: err.message });
    }
};

const donTicketCu = async () => {
    try {
        const removed = await fcmService.purgeOldTickets();
        if (removed > 0) logger.info(`[pushCron] Đã dọn ${removed} ticket cũ`);
    } catch (err) {
        logger.error('[pushCron] Lỗi khi dọn ticket cũ', { message: err.message });
    }
};

const initPushCron = () => {
    // 10 phút/lần — đủ dày để lần ra sự cố, đủ thưa để không spam Expo API.
    cron.schedule('*/10 * * * *', doiChieuReceipt, { timezone: 'Asia/Ho_Chi_Minh' });

    // 03:20 mỗi ngày, lúc vắng người dùng
    cron.schedule('20 3 * * *', donTicketCu, { timezone: 'Asia/Ho_Chi_Minh' });

    logger.info('[cron] Đã đăng ký job: đối chiếu push receipt (10 phút/lần) + dọn ticket cũ (03:20) GMT+7');
};

module.exports = { initPushCron, doiChieuReceipt, donTicketCu };

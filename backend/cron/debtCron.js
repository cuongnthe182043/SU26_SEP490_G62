const cron = require('node-cron');
const pool = require('../config/database');

// ─── Tự động đánh dấu overdue cho công nợ quá hạn ────────────────────────────
// Chạy 00:05 mỗi ngày
// Điều kiện: status IN ('unpaid','partial') AND due_date < TODAY
// → chuyển sang 'overdue' và ghi updated_at

const markOverdueDebts = async () => {
    try {
        const result = await pool.query(
            `UPDATE debts
             SET status     = 'overdue',
                 updated_at = NOW()
             WHERE status   IN ('unpaid', 'partial')
               AND due_date IS NOT NULL
               AND due_date < CURRENT_DATE
             RETURNING id`,
        );
        if (result.rowCount > 0) {
            console.info(`[debtCron] Đánh dấu ${result.rowCount} khoản nợ thành overdue`);
        }
    } catch (err) {
        console.error('[debtCron] Lỗi khi cập nhật overdue:', err.message);
    }
};

// ─── Tự động reject leave request quá ngày mà chưa được duyệt/từ chối ────────
// Chạy 00:05 mỗi ngày

const rejectExpiredLeaveRequests = async () => {
    try {
        const result = await pool.query(
            `UPDATE leave_requests
             SET status     = 'rejected',
                 reject_reason = 'Tự động từ chối — quá ngày nghỉ mà chưa được phê duyệt',
                 updated_at = NOW()
             WHERE status    = 'pending'
               AND leave_date < CURRENT_DATE
             RETURNING id`,
        );
        if (result.rowCount > 0) {
            console.info(`[debtCron] Tự động reject ${result.rowCount} leave request hết hạn`);
        }
    } catch (err) {
        console.error('[debtCron] Lỗi khi reject leave request:', err.message);
    }
};

const initCronJobs = () => {
    // 00:05 mỗi ngày
    cron.schedule('5 0 * * *', async () => {
        await markOverdueDebts();
        await rejectExpiredLeaveRequests();
    }, {
        timezone: 'Asia/Ho_Chi_Minh',
    });

    console.info('[cron] Đã đăng ký job: debt overdue + leave cleanup — chạy lúc 00:05 (GMT+7)');
};

module.exports = { initCronJobs };

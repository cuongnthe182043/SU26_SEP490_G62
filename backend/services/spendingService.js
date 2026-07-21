const paymentVoucherRepository = require('../repositories/paymentVoucherRepository');
const expenseRepository = require('../repositories/expenseRepository');
const financialLedgerRepository = require('../repositories/financialLedgerRepository');
const notificationService = require('./notificationService');
const notificationGateway = require('./notificationGateway');

// ─── Phiếu chi thủ công ───────────────────────────────────────────────────────
// Quy trình 2 cấp: Accountant tạo → Manager duyệt → Accountant xác nhận đã chi
// (ghi sổ tài chính khi chi, không phải khi duyệt).

// `client` tùy chọn — xem ghi chú ở paymentVoucherRepository.create.
const createVoucher = async (data, createdBy, client = null) => {
    const { voucher_type, amount, payee, reason, payment_method, proof_url, incident_id } = data;

    if (!paymentVoucherRepository.VOUCHER_TYPES.includes(voucher_type)) {
        throw new Error('Loại phiếu chi không hợp lệ');
    }
    if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        throw new Error('Số tiền phải lớn hơn 0');
    }
    if (!payee || !String(payee).trim()) throw new Error('Cần ghi rõ người/đơn vị nhận tiền');
    if (!reason || !String(reason).trim()) throw new Error('Cần ghi rõ lý do chi');
    if (payment_method && !paymentVoucherRepository.PAYMENT_METHODS.includes(payment_method)) {
        throw new Error('Hình thức thanh toán không hợp lệ');
    }

    return paymentVoucherRepository.create({
        voucher_type,
        amount: Number(amount),
        payee: String(payee).trim(),
        reason: String(reason).trim(),
        payment_method: payment_method || 'cash',
        proof_url: proof_url ?? null,
        incident_id: incident_id ?? null,
    }, createdBy, client);
};

const listVouchers = (filters) => paymentVoucherRepository.list(filters);
const getVoucherStats = (filters) => paymentVoucherRepository.getStats(filters);

// Manager duyệt khoản đền bù → repository đã tự chuyển sự cố sang 'resolved'.
// Ở đây chỉ lo báo cho coordinator và đẩy realtime để danh sách sự cố cập nhật theo.
const approveVoucher = async (id, approvedBy) => {
    const voucher = await paymentVoucherRepository.approve(id, approvedBy);

    if (voucher.incident_id) {
        notificationService.createForUser(voucher.created_by, {
            title: `Khoản đền bù sự cố #${voucher.incident_id} đã được duyệt`,
            message: `Số tiền ${Number(voucher.amount).toLocaleString('vi-VN')}đ chi cho "${voucher.payee}" đã được duyệt. Sự cố chuyển sang trạng thái đã giải quyết, chờ Kế toán chi tiền.`,
            type: 'VOUCHER_APPROVED',
            entityType: 'incidents',
            entityId: voucher.incident_id,
        }, { displayMode: 'toast' }).catch((err) => {
            console.error(`[Spending] Không gửi được thông báo duyệt phiếu chi #${id}:`, err.message);
        });

        notificationGateway.broadcastToRole('coordinator', {
            type: 'coordinator.incidents.changed',
            action: 'compensation_approved',
            incidentId: voucher.incident_id,
        });
    }

    return voucher;
};

// Manager từ chối phiếu chi → báo ngược cho người tạo phiếu kèm lý do, để họ sửa và gửi lại.
// Không có bước này thì phiếu bị từ chối là ngõ cụt: người tạo không hề biết.
const rejectVoucher = async (id, rejectedBy, reason) => {
    if (!reason || !String(reason).trim()) throw new Error('Cần ghi rõ lý do từ chối');
    const trimmedReason = String(reason).trim();
    const voucher = await paymentVoucherRepository.reject(id, rejectedBy, trimmedReason);

    // Phiếu đền bù trỏ thẳng về sự cố để bấm vào là mở đúng chỗ cần sửa;
    // phiếu chi thường thì trỏ về danh sách phiếu chi.
    const isCompensation = Boolean(voucher.incident_id);
    notificationService.createForUser(voucher.created_by, {
        title: isCompensation
            ? `Khoản đền bù sự cố #${voucher.incident_id} bị từ chối`
            : `Phiếu chi #${voucher.id} bị từ chối`,
        message: `Số tiền ${Number(voucher.amount).toLocaleString('vi-VN')}đ chi cho "${voucher.payee}" không được duyệt. Lý do: ${trimmedReason}`,
        type: 'VOUCHER_REJECTED',
        entityType: isCompensation ? 'incidents' : 'payment_vouchers',
        entityId: isCompensation ? voucher.incident_id : voucher.id,
    }, { displayMode: 'alert' }).catch((err) => {
        console.error(`[Spending] Không gửi được thông báo từ chối phiếu chi #${id}:`, err.message);
    });

    if (isCompensation) {
        notificationGateway.broadcastToRole('coordinator', {
            type: 'coordinator.incidents.changed',
            action: 'compensation_rejected',
            incidentId: voucher.incident_id,
        });
    }

    return voucher;
};

// Kế toán huỷ phiếu đã duyệt nhưng chưa chi — không cần Manager duyệt lại vì chưa có
// đồng nào rời khỏi công ty và chưa phát sinh bút toán. Đổi lại, phiếu được giữ nguyên
// kèm người huỷ + lý do, và Manager đã duyệt được báo để biết quyết định của mình bị đảo.
const cancelVoucher = async (id, cancelledBy, reason) => {
    if (!reason || !String(reason).trim()) throw new Error('Cần ghi rõ lý do huỷ phiếu chi');
    const trimmedReason = String(reason).trim();
    const voucher = await paymentVoucherRepository.cancel(id, cancelledBy, trimmedReason);

    const isCompensation = Boolean(voucher.incident_id);
    const amountText = Number(voucher.amount).toLocaleString('vi-VN');
    const payload = {
        title: isCompensation
            ? `Khoản đền bù sự cố #${voucher.incident_id} đã bị huỷ`
            : `Phiếu chi #${voucher.id} đã bị huỷ`,
        message: `Kế toán đã huỷ khoản chi ${amountText}đ cho "${voucher.payee}" trước khi chi tiền. Lý do: ${trimmedReason}`,
        type: 'VOUCHER_CANCELLED',
        entityType: isCompensation ? 'incidents' : 'payment_vouchers',
        entityId: isCompensation ? voucher.incident_id : voucher.id,
    };

    // Người tạo phiếu cần biết để làm lại; Manager đã duyệt cần biết vì quyết định
    // duyệt của họ vừa bị đảo — bỏ qua nếu trùng người để không gửi hai lần.
    const recipients = [voucher.created_by, voucher.approved_by].filter(Boolean);
    notificationService.createForUsers(recipients, payload, { displayMode: 'alert' })
        .catch((err) => {
            console.error(`[Spending] Không gửi được thông báo huỷ phiếu chi #${id}:`, err.message);
        });

    if (isCompensation) {
        notificationGateway.broadcastToRole('coordinator', {
            type: 'coordinator.incidents.changed',
            action: 'compensation_cancelled',
            incidentId: voucher.incident_id,
        });
    }

    return voucher;
};

const payVoucher = (id, paidBy) => paymentVoucherRepository.markPaid(id, paidBy);

// ─── Chi phí tài xế (danh sách toàn hệ thống cho web) ─────────────────────────
const listExpenses = (filters) => expenseRepository.listAllExpenses(filters);
const getExpenseStats = (filters) => expenseRepository.getExpenseStats(filters);

// ─── Tổng hợp chi từ sổ tài chính ─────────────────────────────────────────────
const getSpendingSummary = ({ month, year }) => {
    const m = Number(month);
    const y = Number(year);
    if (!m || m < 1 || m > 12) throw new Error('Tháng không hợp lệ (1-12)');
    if (!y || y < 2020) throw new Error('Năm không hợp lệ');
    return financialLedgerRepository.getSpendingSummary({ month: m, year: y });
};

module.exports = {
    createVoucher,
    listVouchers,
    getVoucherStats,
    approveVoucher,
    rejectVoucher,
    cancelVoucher,
    payVoucher,
    listExpenses,
    getExpenseStats,
    getSpendingSummary,
};

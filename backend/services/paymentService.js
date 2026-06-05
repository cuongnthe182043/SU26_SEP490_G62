const paymentRepository = require('../repositories/paymentRepository');
const tripRepository    = require('../repositories/tripRepository');

const PAYMENT_ALLOWED_STATUSES = ['arrived', 'transit', 'loaded', 'completed'];

const fmtVND = (n) => Number(n).toLocaleString('vi-VN') + 'đ';

// TH2: Khách thanh toán tiền mặt cho Driver → ghi nhận + tạo Driver Debt (BR-018, §15)
const recordDriverCashPayment = async (driverId, shipmentId, { amount, notes }, receiptUrl) => {
    if (!receiptUrl) throw new Error('Ảnh biên lai thanh toán là bắt buộc (BR-018)');

    const amt = Number(amount);
    if (!amt || amt <= 0) throw new Error('Số tiền phải lớn hơn 0');

    const shipment = await tripRepository.getTripById(shipmentId);
    if (!shipment) throw new Error('Chuyến không tồn tại');
    if (Number(shipment.owner_driver_id) !== Number(driverId)) {
        throw new Error('Bạn không có quyền ghi nhận thanh toán cho chuyến này');
    }
    if (!PAYMENT_ALLOWED_STATUSES.includes(shipment.status)) {
        throw new Error('Chỉ có thể ghi nhận thanh toán khi chuyến đang thực hiện hoặc đã giao');
    }

    // Lấy tổng hợp tài chính để validate
    const summary = await paymentRepository.getShipmentFinancialSummary(shipmentId);
    if (!summary) throw new Error('Không thể lấy thông tin tài chính chuyến');

    // TH1 guard: nếu đơn đã được khai báo là chuyển khoản thẳng cho công ty
    if (summary.order_payment_type === 'bank_transfer') {
        throw new Error(
            'Đơn hàng này khách thanh toán chuyển khoản trực tiếp cho công ty — driver không thu tiền mặt. ' +
            'Nếu có ngoại lệ, liên hệ điều phối viên.'
        );
    }

    // Anti-spam + TH2+TH3 overflow guard
    if (summary.remaining !== null) {
        if (amt > summary.remaining) {
            const msg = summary.remaining <= 0
                ? `Chuyến này đã được ghi nhận đủ số tiền (${fmtVND(summary.trip_value)}). Không thể ghi thêm.`
                : `Số tiền ${fmtVND(amt)} vượt quá phần còn lại ${fmtVND(summary.remaining)} ` +
                  `(giá trị chuyến ${fmtVND(summary.trip_value)}, đã thu ${fmtVND(summary.cash_collected)}, đã báo nợ ${fmtVND(summary.customer_debt_total)}).`;
            throw new Error(msg);
        }
    }

    const { payment, debt } = await paymentRepository.recordCashPayment({
        shipmentId,
        amount: amt,
        collectedBy: driverId,
        notes: notes?.trim() ?? null,
    });

    await paymentRepository.addPaymentReceipt(payment.id, receiptUrl);

    return { payment, debt };
};

// GET payments + summary cho driver xem trạng thái tài chính chuyến
const getShipmentPayments = async (shipmentId, driverId) => {
    const shipment = await tripRepository.getTripById(shipmentId);
    if (!shipment) throw new Error('Chuyến không tồn tại');
    if (Number(shipment.owner_driver_id) !== Number(driverId)) {
        throw new Error('Bạn không có quyền xem thanh toán của chuyến này');
    }
    return paymentRepository.getShipmentPayments(shipmentId);
};

// GET financial summary — dùng cho mobile hiển thị trạng thái thanh toán
const getShipmentPaymentSummary = async (shipmentId, driverId) => {
    const shipment = await tripRepository.getTripById(shipmentId);
    if (!shipment) throw new Error('Chuyến không tồn tại');
    if (Number(shipment.owner_driver_id) !== Number(driverId)) {
        throw new Error('Bạn không có quyền xem thông tin tài chính chuyến này');
    }
    return paymentRepository.getShipmentFinancialSummary(shipmentId);
};

module.exports = { recordDriverCashPayment, getShipmentPayments, getShipmentPaymentSummary };

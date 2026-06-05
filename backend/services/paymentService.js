const paymentRepository = require('../repositories/paymentRepository');
const tripRepository    = require('../repositories/tripRepository');

const PAYMENT_ALLOWED_STATUSES = ['arrived', 'transit', 'loaded', 'completed'];

// TH2: Khách thanh toán tiền mặt cho Driver → ghi nhận + tạo Driver Debt (§15 TH2)
const recordDriverCashPayment = async (driverId, shipmentId, { amount, notes }, receiptUrl) => {
    if (!receiptUrl) throw new Error('Ảnh biên lai thanh toán là bắt buộc (BR-018)');
    if (!amount || Number(amount) <= 0) throw new Error('Số tiền phải lớn hơn 0');

    const shipment = await tripRepository.getTripById(shipmentId);
    if (!shipment) throw new Error('Chuyến không tồn tại');
    if (Number(shipment.owner_driver_id) !== Number(driverId)) {
        throw new Error('Bạn không có quyền ghi nhận thanh toán cho chuyến này');
    }
    if (!PAYMENT_ALLOWED_STATUSES.includes(shipment.status)) {
        throw new Error('Chỉ có thể ghi nhận thanh toán khi chuyến đang thực hiện hoặc đã giao');
    }

    const { payment, debt } = await paymentRepository.recordCashPayment({
        shipmentId,
        amount: Number(amount),
        collectedBy: driverId,
        notes: notes?.trim() ?? null,
    });

    await paymentRepository.addPaymentReceipt(payment.id, receiptUrl);

    return { payment, debt };
};

const getShipmentPayments = async (shipmentId, driverId) => {
    const shipment = await tripRepository.getTripById(shipmentId);
    if (!shipment) throw new Error('Chuyến không tồn tại');
    if (Number(shipment.owner_driver_id) !== Number(driverId)) {
        throw new Error('Bạn không có quyền xem thanh toán của chuyến này');
    }
    return paymentRepository.getShipmentPayments(shipmentId);
};

module.exports = { recordDriverCashPayment, getShipmentPayments };

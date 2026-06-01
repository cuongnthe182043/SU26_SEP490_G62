const tripRepository = require('../repositories/tripRepository');
const {
    SHIPMENT_STATUS,
    ALLOWED_TRANSITIONS,
    CANCELLABLE_STATUSES,
    RELEASABLE_STATUSES,
} = require('../constants/tripConstants');

const getTripPool = async (driverId) => {
    const vehicleGroupId = await tripRepository.getDriverVehicleGroupId(driverId);
    if (!vehicleGroupId) throw new Error('Tài xế chưa được gán xe');
    return tripRepository.getAvailableOrders(vehicleGroupId);
};

const getActiveTrip = async (driverId) => {
    return tripRepository.getActiveTrip(driverId);
};

const claimTrip = async (orderId, driverId) => {
    const activeTrip = await tripRepository.getActiveTrip(driverId);
    if (activeTrip) throw new Error('Bạn đang có chuyến đang hoạt động, không thể nhận thêm đơn hàng mới');

    const vehicleGroupId = await tripRepository.getDriverVehicleGroupId(driverId);
    if (!vehicleGroupId) throw new Error('Tài xế chưa được gán xe');

    const vehicleId = await tripRepository.getDriverVehicleId(driverId);
    const claimed = await tripRepository.claimOrder(orderId, driverId, vehicleId);
    if (!claimed) throw new Error('Đơn hàng đã được nhận bởi tài xế khác');
    return claimed;
};

const updateStatus = async (tripId, driverId, newStatus) => {
    const trip = await tripRepository.getTripById(tripId);
    if (!trip) throw new Error('Chuyến không tồn tại');
    if (Number(trip.owner_driver_id) !== Number(driverId)) throw new Error('Bạn không có quyền cập nhật chuyến này');

    const allowed = ALLOWED_TRANSITIONS[trip.status] ?? [];
    if (!allowed.includes(newStatus)) {
        throw new Error(`Không thể chuyển trạng thái từ "${trip.status}" sang "${newStatus}"`);
    }

    const updatedTrip = await tripRepository.updateTripStatus(tripId, newStatus);

    // Sau khi hoàn thành (COMPLETED): kích hoạt leg tiếp theo nếu có
    if (newStatus === SHIPMENT_STATUS.COMPLETED) {
        const vehicleId = await tripRepository.getDriverVehicleId(driverId);
        await tripRepository.activateNextShipment(tripId, driverId, vehicleId);
    }

    return updatedTrip;
};

// Không thể giao hàng: ARRIVED → CANCELLED + lý do bắt buộc
// Driver vẫn giữ chuyến (CANCELLED trong ACTIVE_STATUSES) để xác nhận đã trả hàng về
const cancelDelivery = async (tripId, driverId, reason) => {
    if (!reason || !reason.trim()) throw new Error('Lý do không thể giao hàng là bắt buộc');

    const trip = await tripRepository.getTripById(tripId);
    if (!trip) throw new Error('Chuyến không tồn tại');
    if (Number(trip.owner_driver_id) !== Number(driverId)) throw new Error('Bạn không có quyền cập nhật chuyến này');
    if (trip.status !== SHIPMENT_STATUS.ARRIVED) throw new Error('Chỉ có thể báo không giao được khi đã đến điểm giao');

    return tripRepository.updateTripStatus(tripId, SHIPMENT_STATUS.CANCELLED, reason.trim());
};

// Hủy chuyến sớm: CLAIMED/PICKING → trả toàn bộ order về pool (available)
const releaseTrip = async (tripId, driverId, reason) => {
    const trip = await tripRepository.getTripById(tripId);
    if (!trip) throw new Error('Chuyến không tồn tại');
    if (Number(trip.owner_driver_id) !== Number(driverId)) throw new Error('Bạn không có quyền hủy chuyến này');
    if (!RELEASABLE_STATUSES.includes(trip.status)) {
        throw new Error(`Chỉ có thể hủy chuyến khi ở trạng thái "claimed" hoặc "picking"`);
    }

    return tripRepository.releaseOrderToPool(tripId, driverId, reason);
};

const completeTrip = async (tripId, driverId, receiptFileUrl, proofFileUrl) => {
    const trip = await tripRepository.getTripById(tripId);
    if (!trip) throw new Error('Chuyến không tồn tại');
    if (Number(trip.owner_driver_id) !== Number(driverId)) throw new Error('Bạn không có quyền hoàn thành chuyến này');
    if (trip.status !== SHIPMENT_STATUS.ARRIVED) throw new Error('Chuyến phải ở trạng thái "arrived" để hoàn thành');

    if (!receiptFileUrl) throw new Error('Ảnh biên lai giao hàng là bắt buộc');
    await tripRepository.saveShipmentReceipt(tripId, driverId, receiptFileUrl);

    const isFinal = await tripRepository.isFinalShipment(tripId);
    if (isFinal) {
        if (!proofFileUrl) throw new Error('Ảnh xác nhận hoàn thành đơn hàng là bắt buộc cho chuyến cuối');
        await tripRepository.saveCompletionProof(trip.order_id, tripId, driverId, proofFileUrl);
    }

    const completedTrip = await tripRepository.updateTripStatus(tripId, SHIPMENT_STATUS.COMPLETED);

    if (!isFinal) {
        const vehicleId = await tripRepository.getDriverVehicleId(driverId);
        await tripRepository.activateNextShipment(tripId, driverId, vehicleId);
    }

    return completedTrip;
};

const getDriverStats = async (driverId) => {
    return tripRepository.getDriverStats(driverId);
};

module.exports = {
    getTripPool,
    getActiveTrip,
    claimTrip,
    updateStatus,
    cancelDelivery,
    releaseTrip,
    completeTrip,
    getDriverStats,
};

const tripRepository = require('../repositories/tripRepository');
const {
    SHIPMENT_STATUS,
    ALLOWED_TRANSITIONS,
    CANCELLABLE_STATUSES,
} = require('../constants/tripConstants');

const getTripPool = async (driverId) => {
    const vehicleGroupId = await tripRepository.getDriverVehicleGroupId(driverId);
    if (!vehicleGroupId) throw new Error('Tài xế chưa được gán xe');
    return tripRepository.getAvailableTrips(vehicleGroupId);
};

const getActiveTrip = async (driverId) => {
    return tripRepository.getActiveTrip(driverId);
};

const claimTrip = async (tripId, driverId) => {
    const activeTrip = await tripRepository.getActiveTrip(driverId);
    if (activeTrip) throw new Error('Bạn đang có chuyến đang hoạt động, không thể nhận thêm chuyến mới');

    const trip = await tripRepository.getTripById(tripId);
    if (!trip) throw new Error('Chuyến không tồn tại');
    if (trip.status !== SHIPMENT_STATUS.AVAILABLE) throw new Error('Chuyến đã được nhận bởi tài xế khác');

    const vehicleGroupId = await tripRepository.getDriverVehicleGroupId(driverId);
    if (!vehicleGroupId) throw new Error('Tài xế chưa được gán xe');
    if (Number(trip.vehicle_group_id) !== Number(vehicleGroupId)) throw new Error('Chuyến không phù hợp nhóm xe của bạn');

    const vehicleId = await tripRepository.getDriverVehicleId(driverId);
    const claimed = await tripRepository.claimTrip(tripId, driverId, trip.version, vehicleId);
    if (!claimed) throw new Error('Chuyến đã được nhận bởi tài xế khác');
    return claimed;
};

const updateStatus = async (tripId, driverId, newStatus) => {
    const trip = await tripRepository.getTripById(tripId);
    if (!trip) throw new Error('Chuyến không tồn tại');
    if (Number(trip.owner_driver_id) !== Number(driverId)) throw new Error('Bạn không có quyền cập nhật chuyến này');

    if (newStatus === SHIPMENT_STATUS.CANCELLED) {
        if (!CANCELLABLE_STATUSES.includes(trip.status)) {
            throw new Error(`Không thể hủy chuyến ở trạng thái ${trip.status}`);
        }
        return tripRepository.updateTripStatus(tripId, SHIPMENT_STATUS.CANCELLED);
    }

    const allowed = ALLOWED_TRANSITIONS[trip.status] ?? [];
    if (!allowed.includes(newStatus)) {
        throw new Error(`Không thể chuyển trạng thái từ "${trip.status}" sang "${newStatus}"`);
    }

    return tripRepository.updateTripStatus(tripId, newStatus);
};

const completeTrip = async (tripId, driverId, proofFileUrl) => {
    const trip = await tripRepository.getTripById(tripId);
    if (!trip) throw new Error('Chuyến không tồn tại');
    if (Number(trip.owner_driver_id) !== Number(driverId)) throw new Error('Bạn không có quyền hoàn thành chuyến này');
    if (trip.status !== SHIPMENT_STATUS.ARRIVED) throw new Error('Chuyến phải ở trạng thái "arrived" để hoàn thành');

    const isFinal = await tripRepository.isFinalShipment(tripId);
    if (isFinal) {
        if (!proofFileUrl) throw new Error('Ảnh xác nhận giao hàng là bắt buộc cho chuyến cuối cùng của đơn hàng');
        await tripRepository.saveCompletionProof(trip.order_id, tripId, driverId, proofFileUrl);
    }

    return tripRepository.updateTripStatus(tripId, SHIPMENT_STATUS.COMPLETED);
};

const getDriverStats = async (driverId) => {
    return tripRepository.getDriverStats(driverId);
};

module.exports = { getTripPool, getActiveTrip, claimTrip, updateStatus, completeTrip, getDriverStats };

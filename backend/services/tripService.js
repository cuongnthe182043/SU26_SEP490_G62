const tripRepository = require('../repositories/tripRepository');
const notificationService = require('./notificationService');
const {
    SHIPMENT_STATUS,
    ALLOWED_TRANSITIONS,
    CANCELLABLE_STATUSES,
    RELEASABLE_STATUSES,
} = require('../constants/tripConstants');

// Nội dung thông báo cho từng bước vòng đời chuyến
const STATUS_NOTIF = {
    picking: {
        title: 'Bắt đầu lấy hàng',
        message: 'Bạn đã bắt đầu di chuyển đến điểm lấy hàng.',
        type: 'TRIP_STATUS_UPDATED',
    },
    loaded: {
        title: 'Đã lấy hàng xong',
        message: 'Hàng đã được lấy, chuẩn bị xuất phát giao hàng.',
        type: 'TRIP_STATUS_UPDATED',
    },
    transit: {
        title: 'Đang vận chuyển',
        message: 'Chuyến đang trên đường vận chuyển đến điểm giao.',
        type: 'TRIP_STATUS_UPDATED',
    },
    arrived: {
        title: 'Đã đến điểm giao',
        message: 'Bạn đã đến điểm giao hàng — tiến hành giao cho khách.',
        type: 'TRIP_STATUS_UPDATED',
    },
    failed: {
        title: 'Giao hàng thất bại',
        message: 'Giao hàng không thành công, cần hoàn hàng về điểm lấy.',
        type: 'TRIP_STATUS_UPDATED',
    },
    returning: {
        title: 'Đang hoàn hàng',
        message: 'Đang trên đường hoàn hàng về điểm lấy ban đầu.',
        type: 'TRIP_STATUS_UPDATED',
    },
    completed: {
        title: 'Hoàn thành chuyến',
        message: 'Chuyến đã được hoàn thành và xác nhận giao hàng thành công.',
        type: 'ORDER_COMPLETED',
    },
    cancelled: {
        title: 'Chuyến đã bị hủy',
        message: 'Chuyến vận chuyển đã bị hủy và trả về pool.',
        type: 'TRIP_STATUS_UPDATED',
    },
};

const fireStatusNotif = (driverId, shipmentId, newStatus) => {
    const cfg = STATUS_NOTIF[newStatus];
    if (!cfg) return;
    notificationService.createForUser(driverId, {
        title: cfg.title,
        message: `${cfg.message} (Chuyến #${shipmentId})`,
        type: cfg.type,
        entityType: 'shipments',
        entityId: shipmentId,
    }, { displayMode: 'silent' }).catch(() => {});
};

// ─────────────────────────────────────────────────────────────────────────────

const getTripPool = async (_driverId, { page = 1, limit = 5, vehicleGroupId = null } = {}) => {
    const [paged, vehicleGroups] = await Promise.all([
        tripRepository.getAvailableShipments({ page, limit, vehicleGroupId }),
        tripRepository.getAllVehicleGroups(),
    ]);
    return { ...paged, vehicleGroups };
};

const getActiveTrip = async (driverId) => {
    return tripRepository.getActiveTrip(driverId);
};

const claimTrip = async (shipmentId, driverId) => {
    const vehicleId = await tripRepository.getDriverVehicleId(driverId);
    if (!vehicleId) throw new Error('Tài xế chưa được gán xe');

    let claimed;
    try {
        claimed = await tripRepository.claimShipment(shipmentId, driverId, vehicleId);
    } catch (err) {
        if (err.message === 'ACTIVE_TRIP') {
            throw new Error('Bạn đang có chuyến đang hoạt động, không thể nhận thêm chuyến mới');
        }
        if (err.message === 'SAME_ORDER') {
            throw new Error('SAME_ORDER:Bạn đã có một chuyến trong đơn hàng này rồi');
        }
        throw err;
    }
    if (!claimed) throw new Error('ALREADY_CLAIMED:Chuyến này đã được tài xế khác nhận');

    notificationService.createForUser(driverId, {
        title: 'Nhận chuyến thành công',
        message: `Chuyến #${claimed.id} đã được nhận. Hãy di chuyển đến điểm lấy hàng.`,
        type: 'TRIP_ASSIGNED',
        entityType: 'shipments',
        entityId: claimed.id,
    }, { displayMode: 'silent' }).catch(() => {});

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

    // Lưu thông báo trạng thái vào DB
    fireStatusNotif(driverId, tripId, newStatus);

    // Sau khi hoàn thành (COMPLETED): kích hoạt leg tiếp theo nếu có
    if (newStatus === SHIPMENT_STATUS.COMPLETED) {
        const vehicleId = await tripRepository.getDriverVehicleId(driverId);
        const nextShipment = await tripRepository.activateNextShipment(tripId, driverId, vehicleId);
        if (nextShipment) {
            notificationService.createForUser(driverId, {
                title: 'Chuyến tiếp theo đã sẵn sàng',
                message: `Chuyến #${nextShipment.id} trong cùng đơn hàng đã được tự động kích hoạt. Hãy tiếp tục giao hàng.`,
                type: 'TRIP_QUEUED',
                entityType: 'shipments',
                entityId: nextShipment.id,
            }, { displayMode: 'alert' }).catch(() => {});
        }
    }

    return updatedTrip;
};

// Không thể giao hàng: ARRIVED → CANCELLED + lý do bắt buộc
const cancelDelivery = async (tripId, driverId, reason) => {
    if (!reason || !reason.trim()) throw new Error('Lý do không thể giao hàng là bắt buộc');

    const trip = await tripRepository.getTripById(tripId);
    if (!trip) throw new Error('Chuyến không tồn tại');
    if (Number(trip.owner_driver_id) !== Number(driverId)) throw new Error('Bạn không có quyền cập nhật chuyến này');
    if (trip.status !== SHIPMENT_STATUS.ARRIVED) throw new Error('Chỉ có thể báo không giao được khi đã đến điểm giao');

    const cancelled = await tripRepository.updateTripStatus(tripId, SHIPMENT_STATUS.CANCELLED, reason.trim());

    notificationService.createForUser(driverId, {
        title: 'Không thể giao hàng',
        message: `Chuyến #${tripId} đã bị hủy: ${reason.trim().slice(0, 60)}`,
        type: 'TRIP_STATUS_UPDATED',
        entityType: 'shipments',
        entityId: tripId,
    }, { displayMode: 'silent' }).catch(() => {});

    return cancelled;
};

// Hủy chuyến sớm: CLAIMED/PICKING → trả toàn bộ order về pool (available)
const releaseTrip = async (tripId, driverId, reason) => {
    const trip = await tripRepository.getTripById(tripId);
    if (!trip) throw new Error('Chuyến không tồn tại');
    if (Number(trip.owner_driver_id) !== Number(driverId)) throw new Error('Bạn không có quyền hủy chuyến này');
    if (!RELEASABLE_STATUSES.includes(trip.status)) {
        throw new Error(`Chỉ có thể hủy chuyến khi ở trạng thái "claimed" hoặc "picking"`);
    }

    const released = await tripRepository.releaseShipmentToPool(tripId, driverId, reason);

    notificationService.createForUser(driverId, {
        title: 'Đã hủy chuyến',
        message: `Chuyến #${tripId} đã được trả về pool${reason ? `: ${reason.slice(0, 60)}` : ''}.`,
        type: 'TRIP_STATUS_UPDATED',
        entityType: 'shipments',
        entityId: tripId,
    }, { displayMode: 'silent' }).catch(() => {});

    return released;
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
        await tripRepository.saveCompletionProof(tripId, driverId, proofFileUrl);
    }

    const completedTrip = await tripRepository.updateTripStatus(tripId, SHIPMENT_STATUS.COMPLETED);

    // Lưu thông báo hoàn thành vào DB
    const completionMsg = isFinal
        ? `Chuyến #${tripId} — chuyến cuối của đơn hàng #${trip.order_id} đã hoàn thành!`
        : `Chuyến #${tripId} của đơn hàng #${trip.order_id} đã hoàn thành.`;

    notificationService.createForUser(driverId, {
        title: isFinal ? 'Hoàn thành toàn bộ đơn hàng!' : 'Hoàn thành chuyến',
        message: completionMsg,
        type: 'ORDER_COMPLETED',
        entityType: 'shipments',
        entityId: tripId,
    }, { displayMode: 'silent' }).catch(() => {});

    return completedTrip;
};

const getDriverStats = async (driverId) => {
    return tripRepository.getDriverStats(driverId);
};

const getOrderHistory = async (driverId, page = 1, limit = 30) => {
    const offset = (page - 1) * limit;
    const { rows, total } = await tripRepository.getDriverOrderHistory(driverId, { limit, offset });
    return {
        orders: rows,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};

const getAvailableShipmentDetail = async (shipmentId) => {
    const detail = await tripRepository.getAvailableShipmentDetail(shipmentId);
    if (!detail) throw new Error('Chuyến không tồn tại hoặc đã được nhận');
    return detail;
};

const getAvailableOrderDetail = async (orderId) => {
    const detail = await tripRepository.getAvailableOrderDetail(orderId);
    if (!detail) throw new Error('Đơn hàng không tồn tại hoặc đã được nhận');
    return detail;
};

const getOrderDetail = async (orderId, driverId) => {
    const detail = await tripRepository.getOrderWithShipments(orderId, driverId);
    if (!detail) throw new Error('Đơn hàng không tồn tại hoặc bạn không có quyền xem');
    return detail;
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
    getOrderHistory,
    getAvailableShipmentDetail,
    getAvailableOrderDetail,
    getOrderDetail,
};

const SHIPMENT_STATUS = Object.freeze({
    AVAILABLE: 'available',
    CLAIMED: 'claimed',
    PICKING: 'picking',
    LOADED: 'loaded',
    TRANSIT: 'transit',
    ARRIVED: 'arrived',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    FAILED: 'failed',
    RETURNING: 'returning',
});

const ASSIGNMENT_TYPE = Object.freeze({
    SELF_CLAIM: 'self_claim',
    COORDINATOR_ASSIGN: 'coordinator_assign',
});

const ACTIVE_STATUSES = Object.freeze([
    SHIPMENT_STATUS.CLAIMED,
    SHIPMENT_STATUS.PICKING,
    SHIPMENT_STATUS.LOADED,
    SHIPMENT_STATUS.TRANSIT,
    SHIPMENT_STATUS.ARRIVED,
    SHIPMENT_STATUS.CANCELLED, // driver đang trả hàng về
    SHIPMENT_STATUS.RETURNING,
]);

const CANCELLABLE_STATUSES = Object.freeze([
    SHIPMENT_STATUS.CLAIMED,
    SHIPMENT_STATUS.PICKING,
    SHIPMENT_STATUS.LOADED,
    SHIPMENT_STATUS.TRANSIT,
    SHIPMENT_STATUS.ARRIVED,
]);

// Strict forward-only transitions
const ALLOWED_TRANSITIONS = Object.freeze({
    [SHIPMENT_STATUS.CLAIMED]:   [SHIPMENT_STATUS.PICKING],
    [SHIPMENT_STATUS.PICKING]:   [SHIPMENT_STATUS.LOADED],
    [SHIPMENT_STATUS.LOADED]:    [SHIPMENT_STATUS.TRANSIT],
    [SHIPMENT_STATUS.TRANSIT]:   [SHIPMENT_STATUS.ARRIVED],
    [SHIPMENT_STATUS.ARRIVED]:   [SHIPMENT_STATUS.FAILED],
    [SHIPMENT_STATUS.FAILED]:    [SHIPMENT_STATUS.RETURNING],
    [SHIPMENT_STATUS.RETURNING]: [SHIPMENT_STATUS.COMPLETED],
    // Khi không thể giao (CANCELLED with reason): driver xác nhận đã trả hàng → COMPLETED
    [SHIPMENT_STATUS.CANCELLED]: [SHIPMENT_STATUS.COMPLETED],
});

// Các trạng thái cho phép hủy chuyến sớm (release về pool)
const RELEASABLE_STATUSES = Object.freeze([
    SHIPMENT_STATUS.CLAIMED,
    SHIPMENT_STATUS.PICKING,
]);

// Status → lifecycle timestamp column
const STATUS_TIMESTAMP_COL = Object.freeze({
    [SHIPMENT_STATUS.PICKING]:   'picking_at',
    [SHIPMENT_STATUS.LOADED]:    'loaded_at',
    [SHIPMENT_STATUS.TRANSIT]:   'transit_at',
    [SHIPMENT_STATUS.ARRIVED]:   'arrived_at',
    [SHIPMENT_STATUS.COMPLETED]: 'completed_at',
    [SHIPMENT_STATUS.CANCELLED]: 'cancelled_at',
});

module.exports = {
    SHIPMENT_STATUS,
    ASSIGNMENT_TYPE,
    ACTIVE_STATUSES,
    CANCELLABLE_STATUSES,
    RELEASABLE_STATUSES,
    ALLOWED_TRANSITIONS,
    STATUS_TIMESTAMP_COL,
};

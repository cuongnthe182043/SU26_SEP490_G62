const SHIPMENT_STATUS = Object.freeze({
    AVAILABLE: 'available',
    CLAIMED: 'claimed',
    PICKING: 'picking',
    TRANSIT: 'transit',
    ARRIVED: 'arrived',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    FAILED: 'failed',
    RETURNING: 'returning',
});

// CANCELLED is terminal — driver is freed after cancellation (not active)
// RETURNING is active — driver is returning cargo to pickup point
const ACTIVE_STATUSES = Object.freeze([
    SHIPMENT_STATUS.CLAIMED,
    SHIPMENT_STATUS.PICKING,
    SHIPMENT_STATUS.TRANSIT,
    SHIPMENT_STATUS.ARRIVED,
    SHIPMENT_STATUS.RETURNING,
]);

// Chuyến ĐANG GIỮ CHÂN tài xế/xe — dùng cho mọi guard "còn rảnh không".
//
// Khác ACTIVE_STATUSES ở đúng một điểm: có thêm FAILED. Chuyến giao thất bại KHÔNG
// phải đã xong — coordinator còn phải chọn giao lại hay hoàn hàng, và cả hai lựa chọn
// đều đưa chuyến về trạng thái đang chạy (resolveFailedShipment → TRANSIT / RETURNING).
// Nếu guard chỉ nhìn ACTIVE_STATUSES thì tài đang treo một chuyến 'failed' vẫn được
// giao chuyến mới, rồi lúc coordinator xử lý chuyến cũ là tài có HAI chuyến chạy cùng
// lúc — vỡ nguyên tắc 1 chuyến active (BR-005).
const BLOCKING_STATUSES = Object.freeze([
    ...ACTIVE_STATUSES,
    SHIPMENT_STATUS.FAILED,
]);

const CANCELLABLE_STATUSES = Object.freeze([
    SHIPMENT_STATUS.CLAIMED,
    SHIPMENT_STATUS.PICKING,
    SHIPMENT_STATUS.TRANSIT,
]);

// Strict forward-only transitions via PATCH /status endpoint
// PICKING → TRANSIT goes through POST /start-transit (with mandatory loading proof, BR-013/014)
// ARRIVED → COMPLETED goes through POST /complete (with mandatory delivery proof, BR-015/016/017)
// RETURNING → COMPLETED goes through POST /return-complete (with notifications + KPI)
// FAILED không còn cho tài tự chuyển sang RETURNING: giao thất bại là điểm quyết
// định nghiệp vụ (liên hệ khách → giao lại hay trả hàng về, khách có phải trả tiền
// hay không), coordinator xử lý qua POST /coordinator/trips/:id/resolve-failed.
const ALLOWED_TRANSITIONS = Object.freeze({
    [SHIPMENT_STATUS.CLAIMED]:   [SHIPMENT_STATUS.PICKING],
    [SHIPMENT_STATUS.TRANSIT]:   [SHIPMENT_STATUS.ARRIVED],
    [SHIPMENT_STATUS.ARRIVED]:   [SHIPMENT_STATUS.FAILED],
});

// ─── Hoàn tác (undo) ──────────────────────────────────────────────────────────
// Cửa sổ cho tài xế tự sửa một cú bấm nhầm. Ngắn là CỐ Ý: đây là "bấm nhầm nút",
// không phải "đổi ý về nghiệp vụ". Việc sau đi qua tầng 2 (yêu cầu hoàn tác có
// người duyệt), không đi qua đây.
const UNDO_WINDOW_MS = 90_000;

// Lùi đúng MỘT bước, về trạng thái ngay trước.
//
// `clear` là dấu thời gian của chính bước bị lùi và BẮT BUỘC phải xoá: để lại
// arrived_at trong khi status đã quay về 'transit' thì mọi báo cáo đọc arrived_at
// đều sai, và sai âm thầm — không có gì báo cho ai biết.
//
// COMPLETED cố ý KHÔNG có mặt: hoàn thành chuyến đã tính lại KPI, kích hoạt chuyến
// kế tiếp và gửi thông báo cho người khác. FAILED cũng không: nó đã tạo bản ghi sự
// cố và báo động toàn bộ điều phối. Hai cái đó lùi được, nhưng phải qua tầng 2.
const UNDOABLE_TRANSITIONS = Object.freeze({
    [SHIPMENT_STATUS.PICKING]: { back: SHIPMENT_STATUS.CLAIMED, clear: 'picking_at' },
    [SHIPMENT_STATUS.TRANSIT]: { back: SHIPMENT_STATUS.PICKING, clear: 'transit_at' },
    [SHIPMENT_STATUS.ARRIVED]: { back: SHIPMENT_STATUS.TRANSIT, clear: 'arrived_at' },
});

// Chuyến phải hoàn hàng được tính GẤP ĐÔI cước: tài chạy cả chiều đi lẫn chiều về.
// Khách từ chối nhận thì chịu cả hai lượt, doanh thu/KPI của tài lấy từ cùng con số.
const RETURN_FARE_MULTIPLIER = 2;

const RELEASABLE_STATUSES = Object.freeze([
    SHIPMENT_STATUS.CLAIMED,
    SHIPMENT_STATUS.PICKING,
]);

// Status → lifecycle timestamp column (must cover every writable status)
const STATUS_TIMESTAMP_COL = Object.freeze({
    [SHIPMENT_STATUS.PICKING]:   'picking_at',
    [SHIPMENT_STATUS.TRANSIT]:   'transit_at',
    [SHIPMENT_STATUS.ARRIVED]:   'arrived_at',
    [SHIPMENT_STATUS.COMPLETED]: 'completed_at',
    [SHIPMENT_STATUS.FAILED]:    'failed_at',
    [SHIPMENT_STATUS.RETURNING]: 'returning_at',
    [SHIPMENT_STATUS.CANCELLED]: 'cancelled_at',
});

module.exports = {
    SHIPMENT_STATUS,
    ACTIVE_STATUSES,
    BLOCKING_STATUSES,
    CANCELLABLE_STATUSES,
    RELEASABLE_STATUSES,
    ALLOWED_TRANSITIONS,
    RETURN_FARE_MULTIPLIER,
    STATUS_TIMESTAMP_COL,
    UNDO_WINDOW_MS,
    UNDOABLE_TRANSITIONS,
};

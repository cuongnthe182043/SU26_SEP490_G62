const reversalRequestService = require('../services/reversalRequestService');

/**
 * Yêu cầu hoàn tác tầng 2.
 *
 * Lỗi từ service mang tiền tố mã ("CONFLICT:...") theo đúng lối các controller khác
 * trong dự án, để client phân biệt được "bấm trùng" với "không đủ quyền" — hai việc
 * giao diện phải xử lý khác nhau.
 */
const STATUS_BY_CODE = {
    NOT_FOUND: 404,
    FORBIDDEN: 403,
    CONFLICT: 409,
    DUPLICATE: 409,
    REASON_REQUIRED: 422,
    WRONG_TIER: 422,
    NOT_SUPPORTED: 422,
};

const send = (res, err) => {
    const [maybeCode, ...rest] = String(err.message).split(':');
    const status = STATUS_BY_CODE[maybeCode];
    if (status) return res.status(status).json({ error: rest.join(':').trim(), code: maybeCode });
    return res.status(400).json({ error: err.message });
};

// GET /api/reversal-requests/kinds — loại nào xin hoàn tác được (dựng danh sách chọn)
const listKinds = async (_req, res) => {
    res.json({ kinds: reversalRequestService.listRequestableKinds() });
};

// POST /api/reversal-requests   Body: { kind, entity_id, reason }
const create = async (req, res) => {
    try {
        const { kind, entity_id: entityId, reason } = req.body ?? {};
        if (!kind || !entityId) {
            return res.status(400).json({ error: 'Thiếu loại thao tác hoặc đối tượng cần hoàn tác' });
        }
        const request = await reversalRequestService.request({
            kind, entityId, reason, requestedBy: req.user.userId,
        });
        res.status(201).json({ message: 'Đã gửi yêu cầu hoàn tác', request });
    } catch (err) { send(res, err); }
};

// GET /api/reversal-requests/pending — màn duyệt của quản lý
const listPending = async (_req, res) => {
    try {
        res.json({ requests: await reversalRequestService.listPending() });
    } catch (err) { send(res, err); }
};

// GET /api/reversal-requests/mine — yêu cầu của chính mình
const listMine = async (req, res) => {
    try {
        res.json({ requests: await reversalRequestService.listMine(req.user.userId) });
    } catch (err) { send(res, err); }
};

// PATCH /api/reversal-requests/:id/approve   Body: { note? }
const approve = async (req, res) => {
    try {
        const request = await reversalRequestService.approve(Number(req.params.id), {
            decidedBy: req.user.userId,
            actorRole: req.user.role,
            note: req.body?.note ?? null,
        });
        // Duyệt xong mà không lùi được vẫn là 200: quyết định ĐÃ được ghi nhận. Trả lỗi
        // ở đây sẽ khiến giao diện tưởng chưa duyệt và người dùng bấm lại.
        res.json({
            message: request.execution_error
                ? 'Đã duyệt nhưng không lùi được — xem lý do'
                : 'Đã duyệt và hoàn tác xong',
            request,
        });
    } catch (err) { send(res, err); }
};

// PATCH /api/reversal-requests/:id/reject   Body: { note }
const reject = async (req, res) => {
    try {
        const request = await reversalRequestService.reject(Number(req.params.id), {
            decidedBy: req.user.userId,
            actorRole: req.user.role,
            note: req.body?.note ?? null,
        });
        res.json({ message: 'Đã từ chối yêu cầu hoàn tác', request });
    } catch (err) { send(res, err); }
};

// DELETE /api/reversal-requests/:id — người gửi tự rút lại khi chưa ai duyệt
const cancelOwn = async (req, res) => {
    try {
        const request = await reversalRequestService.cancelOwn(Number(req.params.id), req.user.userId);
        res.json({ message: 'Đã rút lại yêu cầu', request });
    } catch (err) { send(res, err); }
};

module.exports = { listKinds, create, listPending, listMine, approve, reject, cancelOwn };

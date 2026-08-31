const reversalRequestRepository = require('../repositories/reversalRequestRepository');
const reversalService = require('./reversalService');
const notificationService = require('./notificationService');

/**
 * Tầng 2 — xin lùi, có người duyệt.
 *
 * Tách khỏi reversalService (thuần chính sách, không I/O) vì file này phải gọi ngược
 * lại các service nghiệp vụ, mà chính các service đó lại gọi reversalService. Gộp vào
 * một chỗ là vòng import.
 */

/**
 * Ai thực sự làm việc lùi, ứng với từng loại.
 *
 * Cố ý require BÊN TRONG hàm: expenseService/debtService/spendingService đều đã
 * require reversalService ở đầu file, nạp sớm ở đây là vòng import.
 *
 * Chỉ đăng ký những loại ĐÃ CÓ đường lùi thật. Loại chưa có (vd gỡ hoàn thành chuyến —
 * còn phải tính lại KPI và hạ chuyến kế tiếp đã kích hoạt) cố ý vắng mặt: hứa trong sổ
 * đăng ký một việc hệ thống chưa làm được thì quản lý sẽ bấm duyệt rồi mới biết là
 * không có gì xảy ra.
 */
const EXECUTORS = {
    'expense.approve': (entityId, actorId, reason) =>
        require('./expenseService').unapproveExpense(entityId, actorId, reason, 'manager'),

    'repayment.confirm': (entityId, actorId, reason) =>
        require('./debtService').voidRepayment(entityId, actorId, reason),

    'voucher.approve': (entityId, actorId, reason) =>
        require('./spendingService').cancelVoucher(entityId, actorId, reason),
};

const canExecute = (kind) => Object.prototype.hasOwnProperty.call(EXECUTORS, kind);

/**
 * Gửi yêu cầu hoàn tác. Người gửi KHÔNG cần quyền thực hiện việc lùi — đó là ý nghĩa
 * của tầng này: người phát hiện ra cái sai thường không phải người có quyền sửa.
 */
const request = async ({ kind, entityId, reason, requestedBy }) => {
    const spec = reversalService.describe(kind);   // ném lỗi nếu kind lạ
    if (spec.tier !== reversalService.TIER.APPROVAL) {
        throw new Error(`WRONG_TIER:"${spec.label}" không đi qua đường xin duyệt`);
    }
    if (!canExecute(kind)) {
        throw new Error(`NOT_SUPPORTED:Hệ thống chưa hỗ trợ hoàn tác "${spec.label}"`);
    }
    if (!String(reason ?? '').trim()) {
        throw new Error('REASON_REQUIRED:Cần ghi rõ vì sao cần hoàn tác');
    }

    const created = await reversalRequestRepository.create({
        kind,
        entityType: reversalService.REVERSIBLE[kind].entityType,
        entityId: Number(entityId),
        reason: String(reason).trim(),
        requestedBy,
    });

    const approvers = await notificationService.getUserIdsByRole('manager').catch(() => []);
    notificationService.createForUsers(approvers, {
        title: 'Có yêu cầu hoàn tác cần duyệt',
        message: `${spec.label} #${entityId} — lý do: ${String(reason).trim()}`,
        type: 'REVERSAL_REQUESTED',
        entityType: 'reversal_requests',
        entityId: created.id,
    }, { displayMode: 'alert' }).catch(() => {});

    return created;
};

/**
 * Duyệt và thực hiện luôn.
 *
 * Quyết định được chốt TRƯỚC khi thi hành, và thi hành hỏng thì KHÔNG lật ngược quyết
 * định — chỉ ghi lý do hỏng vào execution_error. Lý do: "quản lý đã đồng ý" và "hệ
 * thống lùi được" là hai sự thật khác nhau. Gộp lại thì một khoản đã chi tiền mất rồi
 * sẽ hiện ra như thể quản lý chưa từng duyệt, và người xin sẽ gửi lại lần nữa.
 */
const approve = async (requestId, { decidedBy, actorRole, note = null }) => {
    const existing = await reversalRequestRepository.getById(requestId);
    if (!existing) throw new Error('NOT_FOUND:Không tìm thấy yêu cầu hoàn tác');
    if (existing.status !== 'pending') {
        throw new Error(`CONFLICT:Yêu cầu này đã được xử lý (${existing.status})`);
    }

    reversalService.assertAllowed(existing.kind, { actorRole, reason: existing.reason });

    const decided = await reversalRequestRepository.decide(requestId, {
        status: 'approved', decidedBy, note,
    });
    if (!decided) throw new Error('CONFLICT:Yêu cầu vừa được người khác xử lý');

    let executionError = null;
    try {
        await EXECUTORS[existing.kind](existing.entity_id, decidedBy, existing.reason);
    } catch (err) {
        executionError = err.message;
    }
    const final = await reversalRequestRepository.markExecuted(requestId, { error: executionError });

    notificationService.createForUser(existing.requested_by, {
        title: executionError ? 'Yêu cầu hoàn tác không thực hiện được' : 'Yêu cầu hoàn tác đã được duyệt',
        message: executionError
            ? `Quản lý đã đồng ý nhưng hệ thống không lùi được: ${executionError}`
            : `${reversalService.describe(existing.kind).label} #${existing.entity_id} đã được hoàn tác.`,
        type: executionError ? 'REVERSAL_FAILED' : 'REVERSAL_APPROVED',
        entityType: 'reversal_requests',
        entityId: requestId,
    }, { displayMode: 'alert' }).catch(() => {});

    return final;
};

const reject = async (requestId, { decidedBy, actorRole, note = null }) => {
    const existing = await reversalRequestRepository.getById(requestId);
    if (!existing) throw new Error('NOT_FOUND:Không tìm thấy yêu cầu hoàn tác');
    if (existing.status !== 'pending') {
        throw new Error(`CONFLICT:Yêu cầu này đã được xử lý (${existing.status})`);
    }
    if (!String(note ?? '').trim()) {
        throw new Error('REASON_REQUIRED:Từ chối thì phải nói rõ vì sao — người gửi cần biết để xử lý cách khác');
    }
    reversalService.assertAllowed(existing.kind, { actorRole, reason: existing.reason });

    const decided = await reversalRequestRepository.decide(requestId, {
        status: 'rejected', decidedBy, note: String(note).trim(),
    });
    if (!decided) throw new Error('CONFLICT:Yêu cầu vừa được người khác xử lý');

    notificationService.createForUser(existing.requested_by, {
        title: 'Yêu cầu hoàn tác bị từ chối',
        message: `${reversalService.describe(existing.kind).label} #${existing.entity_id} — ${String(note).trim()}`,
        type: 'REVERSAL_REJECTED',
        entityType: 'reversal_requests',
        entityId: requestId,
    }, { displayMode: 'alert' }).catch(() => {});

    return decided;
};

const cancelOwn = async (requestId, requestedBy) => {
    const cancelled = await reversalRequestRepository.cancelOwn(requestId, requestedBy);
    if (!cancelled) throw new Error('CONFLICT:Không rút được — yêu cầu không phải của bạn hoặc đã được xử lý');
    return cancelled;
};

const listPending = () => reversalRequestRepository.listPending();
const listMine = (profileId) => reversalRequestRepository.listByRequester(profileId);

/** Loại nào thực sự xin lùi được — dùng cho UI dựng danh sách chọn. */
const listRequestableKinds = () =>
    reversalService.listReversible()
        .filter((r) => r.tier === reversalService.TIER.APPROVAL && canExecute(r.kind));

module.exports = {
    request, approve, reject, cancelOwn, listPending, listMine, listRequestableKinds, canExecute,
};

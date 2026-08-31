const activityLogRepository = require('../repositories/activityLogRepository');

/**
 * Cửa chung cho MỌI thao tác lùi trong hệ thống.
 *
 * Vì sao cần: trước file này hệ thống đã có 6 đường lùi — unapproveExpense,
 * revertPayroll, cancelVoucher, voidRepayment, cancelShipment, restore — với 5 cái tên
 * khác nhau cho cùng một ý, guard mỗi nơi mỗi kiểu, và chỉ 2/6 để lại vết trong
 * activity_logs. Hệ quả: không truy được ai đã lùi cái gì và vì sao, mà đó lại đúng là
 * thứ cần nhất khi có tranh cãi về tiền.
 *
 * File này KHÔNG viết lại các luồng đó. Nó chỉ bọc lại để ép bốn thứ ở một chỗ:
 *   1. bắt buộc có lý do (trừ khi đăng ký là không cần)
 *   2. bắt buộc ghi activity_logs kèm giá trị trước/sau
 *   3. quyền theo TẦNG, không phải mỗi controller tự nghĩ
 *   4. một hàm describe() duy nhất cho cả API lẫn UI — để nút "Hoàn tác" hiện/ẩn theo
 *      đúng luật mà server áp dụng, thay vì frontend đoán rồi bấm vào mới báo lỗi
 */

// ─── Ba tầng, phân theo mức hệ quả đã đi ra khỏi bản ghi ──────────────────────
const TIER = Object.freeze({
    // Chỉ đổi trạng thái của chính nó, chưa sinh tiền, chưa báo ai. Người làm tự lùi
    // được trong một cửa sổ ngắn.
    SELF: 1,
    // Đã sinh hệ quả nhưng chưa thành tiền mặt. Lùi được, nhưng phải có người thứ hai
    // và phải có lý do — nếu chính người bấm nhầm tự lùi thì không ai biết chuyện gì
    // đã xảy ra, và đó là chỗ dễ bị lạm dụng nhất.
    APPROVAL: 2,
    // Đã chi tiền thật hoặc đã chốt kỳ. KHÔNG sửa lịch sử — chỉ ghi bút toán đảo.
    //
    // Sổ đăng ký bên dưới cố ý KHÔNG có mục nào ở tầng này. Bút toán đảo
    // (financialLedgerRepository.reverseTransaction) chỉ được sinh ra từ bên trong luồng
    // nghiệp vụ, cùng giao dịch với việc đảo bản ghi nghiệp vụ tương ứng — vd huỷ xác
    // nhận khoản nộp vừa set debt_payments='voided' vừa đảo dòng sổ. Mở một cửa đảo sổ
    // độc lập sẽ làm sổ lệch với nghiệp vụ, vì không có chiều đồng bộ ngược từ sổ về
    // nghiệp vụ. Tầng 3 ở đây là để PHÂN LOẠI, không phải để cấp thêm một đường đi.
    COMPENSATE: 3,
});

/**
 * Sổ đăng ký các thao tác lùi được. Khoá là "<đối tượng>.<việc bị lùi>".
 *
 * `roles` = ai được phép. Tầng 1 để null vì quyền là "chính người đã làm", không phải
 * một vai — kiểm tra đó nằm ở luồng nghiệp vụ nơi biết ai sở hữu bản ghi.
 */
const REVERSIBLE = Object.freeze({
    'trip.transition': {
        tier: TIER.SELF,
        action: 'trip_status_undo',
        entityType: 'shipment',
        roles: null,
        requireReason: false,   // bấm nhầm trong 90 giây, bắt gõ lý do là vô nghĩa
        label: 'Hoàn tác bước vừa bấm',
    },
    'expense.approve': {
        tier: TIER.APPROVAL,
        action: 'expense_unapprove',
        entityType: 'expense',
        roles: ['accountant', 'manager'],
        requireReason: true,
        label: 'Gỡ duyệt chi phí',
    },
    'payroll.review': {
        tier: TIER.APPROVAL,
        action: 'payroll_revert',
        entityType: 'payroll',
        roles: ['accountant', 'manager'],
        requireReason: true,
        label: 'Trả phiếu lương về tính lại',
    },
    'voucher.approve': {
        tier: TIER.APPROVAL,
        action: 'voucher_cancel',
        entityType: 'payment_voucher',
        roles: ['accountant', 'manager'],
        requireReason: true,
        label: 'Huỷ phiếu chi',
    },
    'repayment.confirm': {
        tier: TIER.APPROVAL,
        action: 'repayment_void',
        entityType: 'debt_payment',
        roles: ['accountant', 'manager'],
        requireReason: true,
        label: 'Huỷ xác nhận khoản nộp',
    },
    'vehicle.retire': {
        tier: TIER.APPROVAL,
        action: 'vehicle_restore',
        entityType: 'vehicle',
        roles: ['manager'],
        requireReason: true,
        label: 'Khôi phục xe đã ngừng dùng',
    },
});

const spec = (kind) => {
    const found = REVERSIBLE[kind];
    if (!found) throw new Error(`Thao tác lùi chưa được đăng ký: "${kind}"`);
    return found;
};

/**
 * Kiểm quyền + lý do TRƯỚC khi chạm vào dữ liệu.
 * Ném lỗi có tiền tố mã để controller ánh xạ ra HTTP status, đúng lối các service khác.
 */
const assertAllowed = (kind, { actorRole = null, reason = null } = {}) => {
    const s = spec(kind);

    if (s.roles && !s.roles.includes(actorRole)) {
        throw new Error(`FORBIDDEN:Chỉ ${s.roles.join(' hoặc ')} mới được ${s.label.toLowerCase()}`);
    }
    if (s.requireReason && !String(reason ?? '').trim()) {
        throw new Error(`REASON_REQUIRED:Cần ghi rõ lý do — ${s.label.toLowerCase()}`);
    }
    return s;
};

/**
 * Ghi vết một lần lùi. Gọi SAU khi nghiệp vụ đã thành công.
 *
 * Cố ý dùng logSafe (nuốt lỗi, ghi ngoài giao dịch): mất một dòng audit thì tiếc,
 * nhưng để lỗi ghi audit làm hỏng một thao tác lùi đã chạy xong thì tệ hơn nhiều —
 * người dùng sẽ bấm lại và lùi thêm một bước nữa.
 */
const recordReversal = ({ kind, entityId, actorId, reason = null, oldData = null, newData = null }) => {
    const s = spec(kind);
    activityLogRepository.logSafe({
        userId: actorId,
        action: s.action,
        entityType: s.entityType,
        entityId: entityId ?? null,
        oldData,
        newData: { ...(newData ?? {}), reversal_tier: s.tier, reason: reason ?? null },
    });
};

/**
 * Mô tả cho UI: thao tác này có lùi được không, ai lùi được, có cần lý do.
 * Frontend và mobile đọc đúng cái này thay vì tự đoán luật.
 */
const describe = (kind) => {
    const s = spec(kind);
    return {
        kind,
        tier: s.tier,
        label: s.label,
        roles: s.roles,
        require_reason: s.requireReason,
    };
};

const listReversible = () => Object.keys(REVERSIBLE).map(describe);

module.exports = { TIER, REVERSIBLE, assertAllowed, recordReversal, describe, listReversible };

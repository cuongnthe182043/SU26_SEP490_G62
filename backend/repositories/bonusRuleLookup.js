/**
 * Tra cứu chính sách thưởng từ bảng bonus_rules.
 *
 * Trước đây mỗi nơi tính lương tự viết lại một đoạn LATERAL join giống nhau, và
 * đoạn đó có hai lỗi im lặng:
 *
 *   1. `WHERE vehicle_group_id = k.vehicle_group_id` loại luôn rule áp dụng chung
 *      (vehicle_group_id IS NULL) — trong SQL `NULL = 100000` cho NULL chứ không
 *      phải TRUE. Form quản lý vẫn cho tạo rule "để trống = áp dụng chung", lưu
 *      thành công, rồi không bao giờ có hiệu lực.
 *   2. `ORDER BY id LIMIT 1` khiến rule cũ hơn thắng khi một nhóm có nhiều rule
 *      cùng loại đang bật — sửa chính sách bằng cách tạo rule mới sẽ không ăn.
 *
 * Gom về một chỗ để ba nơi tính lương (xem trước, chốt lương, KPI tài xế) không
 * thể lệch nhau nữa. Thứ tự ưu tiên: rule gắn đúng nhóm xe > rule áp dụng chung.
 */

// $1 = vehicle_group_id (cho phép NULL), $2 = bonus_type
const RULE_LOOKUP_SQL = `
    SELECT id, reward_amount, reward_multiplier, conditions_json
    FROM bonus_rules
    WHERE bonus_type = $2
      AND is_active = TRUE
      AND (vehicle_group_id = $1 OR vehicle_group_id IS NULL)
    ORDER BY (vehicle_group_id IS NULL), id
    LIMIT 1
`;

// Chỉ những giá trị dưới đây được phép ghép thẳng vào chuỗi SQL của ruleLateralSql.
// Hai tham số của hàm đó đều là hằng do mã nguồn truyền vào, không phải input người
// dùng — nhưng chốt allowlist để không ai lỡ tay nối chuỗi từ req.body vào sau này.
const ALLOWED_BONUS_TYPES = new Set([
    'kpi', 'top_revenue', 'top_trips', 'zero_incident', 'overtime', 'holiday', 'custom',
]);
const SAFE_COLUMN_REF = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/i;

// Dùng trong các câu SQL lớn đang JOIN sẵn kpi_records — nhận biểu thức nhóm xe
// (vd 'k.vehicle_group_id') thay vì tham số, để giữ nguyên một lượt truy vấn.
const ruleLateralSql = (vehicleGroupExpr, bonusType) => {
    if (!ALLOWED_BONUS_TYPES.has(bonusType)) {
        throw new Error(`bonus_type không hợp lệ cho rule lookup: ${bonusType}`);
    }
    if (!SAFE_COLUMN_REF.test(vehicleGroupExpr)) {
        throw new Error(`Tham chiếu cột nhóm xe không hợp lệ: ${vehicleGroupExpr}`);
    }
    return `
    SELECT id, reward_amount, reward_multiplier, conditions_json
    FROM bonus_rules
    WHERE bonus_type = '${bonusType}'
      AND is_active = TRUE
      AND (vehicle_group_id = ${vehicleGroupExpr} OR vehicle_group_id IS NULL)
    ORDER BY (vehicle_group_id IS NULL), id
    LIMIT 1
`;
};

// executor = pool hoặc client trong transaction — cùng interface .query()
const getActiveRule = async (executor, vehicleGroupId, bonusType) => {
    const { rows } = await executor.query(RULE_LOOKUP_SQL, [vehicleGroupId ?? null, bonusType]);
    return rows[0] ?? null;
};

// Điều V.1 — đi làm ngày lễ hưởng 200% lương ngày. Hệ số này giờ nằm ở
// bonus_rules(bonus_type='holiday').reward_multiplier; giá trị dưới đây chỉ là
// lưới an toàn khi DB chưa cấu hình rule nào, cố ý bằng đúng quy chế để hành vi
// không đổi so với bản hardcode cũ.
const DEFAULT_HOLIDAY_MULTIPLIER = 2;

// Hệ số < 1 nghĩa là đi làm ngày lễ được trả ÍT hơn ngày thường — vô nghĩa, và
// làm phần thưởng thêm (multiplier - 1) thành âm, tức trừ tiền tài xế. Chặn ở đây
// thay vì để nó chảy vào bảng lương.
const normalizeMultiplier = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
};

const getHolidayMultiplier = async (executor, vehicleGroupId) => {
    const rule = await getActiveRule(executor, vehicleGroupId, 'holiday');
    return normalizeMultiplier(rule?.reward_multiplier, DEFAULT_HOLIDAY_MULTIPLIER);
};

module.exports = {
    RULE_LOOKUP_SQL,
    ruleLateralSql,
    getActiveRule,
    getHolidayMultiplier,
    normalizeMultiplier,
    DEFAULT_HOLIDAY_MULTIPLIER,
};

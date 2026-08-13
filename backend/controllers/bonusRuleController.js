const bonusRuleService = require('../services/bonusRuleService');
const bonusRuleRepository = require('../repositories/bonusRuleRepository');

// Service gắn sẵn err.status cho lỗi nghiệp vụ (400/404). Trước đây chỗ này đoán mã lỗi
// bằng cách dò chuỗi trong thông điệp, nên mọi câu không chứa "bắt buộc"/"không hợp lệ"/
// "Cần nhập" — ví dụ "Loại thưởng ... chưa được bộ tính lương hỗ trợ" hay "Thưởng ngày lễ
// cần cấu hình Hệ số thưởng" — đều rơi xuống 500, báo lỗi người dùng thành lỗi máy chủ.
const sendError = (res, err) => {
    const status = err.status || 500;
    if (status >= 500) {
        console.error('[BonusRule]', err);
        return res.status(500).json({ error: 'Có lỗi xảy ra phía máy chủ. Vui lòng thử lại sau.' });
    }
    return res.status(status).json({ error: err.message });
};

// Trả kèm danh sách loại thưởng để UI không phải hardcode một bản sao rồi trôi lệch:
// dropdown chỉ nên mời chọn các loại bộ tính lương thật sự đọc (implemented), các loại
// còn lại (all) chỉ dùng để hiển thị đúng tên cho rule cũ đang nằm trong DB.
const getAll = async (req, res) => {
    try {
        const rules = await bonusRuleService.listRules(req.query);
        res.json({
            rules,
            bonusTypes: {
                all: bonusRuleRepository.BONUS_RULE_TYPES,
                implemented: bonusRuleRepository.IMPLEMENTED_BONUS_TYPES,
            },
        });
    } catch (err) { sendError(res, err); }
};

const getOne = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ error: 'ID không hợp lệ' });
        const rule = await bonusRuleService.getRuleById(id);
        res.json({ rule });
    } catch (err) { sendError(res, err); }
};

const create = async (req, res) => {
    try {
        const rule = await bonusRuleService.createRule({ ...req.body, actor_id: req.user?.userId ?? null });
        res.status(201).json({ message: 'Đã tạo quy tắc thưởng', rule });
    } catch (err) { sendError(res, err); }
};

const update = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ error: 'ID không hợp lệ' });
        const rule = await bonusRuleService.updateRule(id, { ...req.body, actor_id: req.user?.userId ?? null });
        res.json({ message: 'Đã cập nhật quy tắc thưởng', rule });
    } catch (err) { sendError(res, err); }
};

const remove = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ error: 'ID không hợp lệ' });
        await bonusRuleService.deleteRule(id, req.user?.userId ?? null);
        res.json({ message: 'Đã xóa quy tắc thưởng' });
    } catch (err) { sendError(res, err); }
};

module.exports = { getAll, getOne, create, update, remove };

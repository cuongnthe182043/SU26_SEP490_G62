const leaveService = require('../services/leaveService');
const { optMonth, optYear, sendError } = require('../utils/accountantValidate');
const attendanceService = require('../services/attendanceService');

// GET /api/leave/attendance?month=7&year=2026
// Tài xế xem chấm công từng ngày của CHÍNH MÌNH — để biết mình bị chấm vắng /
// nửa công vào ngày nào mà còn khiếu nại đúng chỗ, thay vì chỉ thấy con số tổng.
const getMyAttendance = async (req, res) => {
    try {
        const now = new Date();
        const month = optMonth(req.query.month, now.getMonth() + 1);
        const year  = optYear(req.query.year, now.getFullYear());
        const data = await attendanceService.getMyMonth(req.user.userId, { month, year });
        res.json(data);
    } catch (err) {
        if (err.name === 'AttendanceError') return res.status(err.status ?? 400).json({ error: err.message });
        return sendError(res, err);
    }
};

// GET /api/leave/me?month=6&year=2026
const getMyLeaves = async (req, res) => {
    try {
        const month = optMonth(req.query.month, null);
        const year  = optYear(req.query.year, null);
        const data = await leaveService.getMyLeaves(req.user.userId, { month, year });
        res.json({ leaves: data });
    } catch (err) {
        return sendError(res, err);
    }
};

// GET /api/leave/summary?month=6&year=2026
const getSummary = async (req, res) => {
    try {
        const now = new Date();
        const month = optMonth(req.query.month, now.getMonth() + 1);
        const year  = optYear(req.query.year, now.getFullYear());
        const data = await leaveService.getSummary(req.user.userId, { month, year });
        res.json(data);
    } catch (err) {
        return sendError(res, err);
    }
};

// POST /api/leave
// Body: { leaveDate, leaveType, reason? }
const createLeave = async (req, res) => {
    try {
        const { leaveDate, leaveType, reason } = req.body;
        const leave = await leaveService.createLeave(req.user.userId, {
            leaveDate, leaveType, reason,
        });
        res.status(201).json({ message: 'Đăng ký nghỉ thành công', leave });
    } catch (err) {
        const code = err.message.includes('đã có') || err.message.includes('duplicate') ? 409
            : err.message.includes('bắt buộc') ? 400
            : 400;
        res.status(code).json({ error: err.message });
    }
};

// DELETE /api/leave/:id
const deleteLeave = async (req, res) => {
    try {
        const id = Number(req.params.id);
        await leaveService.deleteLeave(req.user.userId, id);
        res.json({ message: 'Đã huỷ đăng ký nghỉ' });
    } catch (err) {
        const code = err.message.toLowerCase().includes('không thể huỷ') ? 422 : 400;
        res.status(code).json({ error: err.message });
    }
};

module.exports = { getMyLeaves, getSummary, getMyAttendance, createLeave, deleteLeave };

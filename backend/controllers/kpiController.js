const kpiService = require('../services/kpiService');

// ─── Driver: GET /api/kpi/me?month=6&year=2026 ────────────────────────────────

const getMyKPI = async (req, res) => {
    try {
        const { month, year } = req.query;
        const data = await kpiService.getMyKPI(req.user.userId, { month, year });
        res.json({ kpi: data });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// ─── Driver: GET /api/kpi/leaderboard?month=6&year=2026 ──────────────────────

const getLeaderboard = async (req, res) => {
    try {
        const { month, year } = req.query;
        const data = await kpiService.getLeaderboard(req.user.userId, { month, year });
        res.json(data);
    } catch (err) {
        const code = err.message.includes('chưa được gán') ? 422 : 400;
        res.status(code).json({ error: err.message });
    }
};

// ─── Coordinator / Manager: GET /api/kpi/all?month=&year=&vehicle_group_id= ──

const getAllDriversKPI = async (req, res) => {
    try {
        const { month, year, vehicle_group_id } = req.query;
        const data = await kpiService.getAllDriversKPI({ month, year, vehicleGroupId: vehicle_group_id });
        res.json({ kpi: data, month: Number(month) || null, year: Number(year) || null });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// ─── Coordinator / Manager / Accountant: GET /api/kpi/driver/:driverId ───────

const getDriverKPIById = async (req, res) => {
    try {
        const driverId = Number(req.params.driverId);
        if (!driverId) return res.status(400).json({ error: 'Driver ID không hợp lệ' });
        const { month, year } = req.query;
        const data = await kpiService.getDriverKPIById(driverId, { month, year });
        res.json({ kpi: data });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// POST /api/kpi/recalculate  (coordinator/manager — trigger tính lại thủ công)
// Body: { driverId, month, year }
const recalculate = async (req, res) => {
    try {
        const { driverId, month, year } = req.body;
        if (!driverId) return res.status(400).json({ error: 'driverId là bắt buộc' });
        const m = month ? Number(month) : new Date().getMonth() + 1;
        const y = year  ? Number(year)  : new Date().getFullYear();
        const kpiRepository = require('../repositories/kpiRepository');
        const record = await kpiRepository.recalculateDriverKPI(Number(driverId), m, y);
        if (!record) return res.status(422).json({ error: 'Driver chưa được gán xe hoặc không có dữ liệu' });
        res.json({ message: 'Đã tính lại KPI thành công', kpi: record });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getMyKPI, getLeaderboard, getAllDriversKPI, getDriverKPIById, recalculate };

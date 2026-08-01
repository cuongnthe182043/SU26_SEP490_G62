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

// ─── Coordinator/Manager: GET /api/kpi/all?month=6&year=2026&vehicleGroupId=1 ─

const getAllDriversKPI = async (req, res) => {
    try {
        const { month, year, vehicleGroupId } = req.query;
        const data = await kpiService.getAllDriversKPI({ month, year, vehicleGroupId });
        res.json({ kpi: data });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// ─── Coordinator/Manager/Accountant: GET /api/kpi/driver/:driverId ───────────

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

// ─── Coordinator/Manager: GET /api/kpi/leaderboard/group/:vehicleGroupId ─────

const getLeaderboardByGroup = async (req, res) => {
    try {
        const vehicleGroupId = Number(req.params.vehicleGroupId);
        if (!vehicleGroupId) return res.status(400).json({ error: 'Vehicle group ID không hợp lệ' });
        const { month, year } = req.query;
        const data = await kpiService.getLeaderboardByGroup(vehicleGroupId, { month, year });
        res.json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// ─── Coordinator/Manager/Accountant: PATCH /api/kpi/driver/:driverId/vehicle-group ─
// Sửa tay nhóm xe KPI cố định của tài xế (BR: gắn chết 1 nhóm, không tự đổi theo xe hiện tại)

const setDriverDefaultVehicleGroup = async (req, res) => {
    try {
        const driverId = Number(req.params.driverId);
        if (!driverId) return res.status(400).json({ error: 'Driver ID không hợp lệ' });
        const vehicleGroupId = Number(req.body.vehicleGroupId);
        if (!vehicleGroupId) return res.status(400).json({ error: 'Nhóm xe không hợp lệ' });
        const result = await kpiService.setDriverDefaultVehicleGroup(
            driverId, vehicleGroupId, req.user.userId, req.body.reason,
        );
        // Thông điệp do service dựng — nói rõ doanh thu tháng này có chuyển nhóm hay
        // không, để người bấm không phải đoán.
        res.json({ message: result.message, driver: result });
    } catch (err) {
        const code = err.message.includes('Không tìm thấy') || err.message.includes('không tồn tại') ? 404
            : 400;
        res.status(code).json({ error: err.message });
    }
};

// GET /api/kpi/driver/:driverId/vehicle-group/history
// Lịch sử đổi nhóm cố định — ai đổi, lúc nào, từ nhóm nào sang nhóm nào
const getDriverGroupHistory = async (req, res) => {
    try {
        const driverId = Number(req.params.driverId);
        if (!driverId) return res.status(400).json({ error: 'Driver ID không hợp lệ' });
        const history = await kpiService.getDriverGroupHistory(driverId, req.query.limit);
        res.json({ history });
    } catch (err) {
        const code = err.message.includes('bắt buộc') ? 400 : 500;
        res.status(code).json({ error: err.message });
    }
};

module.exports = {
    getMyKPI, getLeaderboard, getAllDriversKPI, getDriverKPIById, getLeaderboardByGroup,
    setDriverDefaultVehicleGroup, getDriverGroupHistory,
};

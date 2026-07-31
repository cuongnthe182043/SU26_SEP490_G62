const kpiRepository = require('../repositories/kpiRepository');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseMonth = (month) => {
    if (!month) return null;
    const m = Number(month);
    if (m < 1 || m > 12) throw new Error('Tháng không hợp lệ (1-12)');
    return m;
};

const parseYear = (year) => {
    if (!year) return null;
    const y = Number(year);
    if (y < 2020) throw new Error('Năm không hợp lệ (tối thiểu 2020)');
    return y;
};

const currentMonth = () => new Date().getMonth() + 1;
const currentYear  = () => new Date().getFullYear();

// ─── Driver: xem KPI cá nhân ─────────────────────────────────────────────────

const getMyKPI = async (driverId, { month, year } = {}) => {
    const m = parseMonth(month);
    const y = parseYear(year);
    return kpiRepository.getDriverKPI(driverId, { month: m, year: y });
};

// ─── Driver: xem leaderboard nhóm xe của mình (BR-028) ───────────────────────

const getLeaderboard = async (driverId, { month, year } = {}) => {
    const m = month ? Number(month) : currentMonth();
    const y = year  ? Number(year)  : currentYear();
    if (m < 1 || m > 12) throw new Error('Tháng không hợp lệ (1-12)');

    const vehicleGroupInfo = await kpiRepository.getDriverVehicleGroupId(driverId);
    if (!vehicleGroupInfo) throw new Error('Driver chưa được gán xe — không thể xem bảng xếp hạng');

    const rows = await kpiRepository.getLeaderboard(driverId, vehicleGroupInfo.vehicle_group_id, { month: m, year: y });
    return {
        vehicle_group_name: vehicleGroupInfo.vehicle_group_name,
        month: m,
        year:  y,
        total_in_group: Number(rows[0]?.total_in_group ?? 0),
        leaderboard: rows,
    };
};

// ─── Coordinator / Manager: xem KPI tất cả driver ────────────────────────────

const getAllDriversKPI = async ({ month, year, vehicleGroupId } = {}) => {
    const m = month ? Number(month) : currentMonth();
    const y = year  ? Number(year)  : currentYear();
    if (m < 1 || m > 12) throw new Error('Tháng không hợp lệ (1-12)');
    const gid = vehicleGroupId ? Number(vehicleGroupId) : null;
    return kpiRepository.getAllDriversKPI({ month: m, year: y, vehicleGroupId: gid });
};

// ─── Coordinator / Manager / Accountant: xem KPI của 1 driver cụ thể ─────────

const getDriverKPIById = async (driverId, { month, year } = {}) => {
    if (!driverId) throw new Error('Driver ID là bắt buộc');
    const m = parseMonth(month);
    const y = parseYear(year);
    return kpiRepository.getDriverKPIById(driverId, { month: m, year: y });
};

// ─── Coordinator / Manager: leaderboard của 1 nhóm xe bất kỳ (không cần là driver) ─

const getLeaderboardByGroup = async (vehicleGroupId, { month, year } = {}) => {
    const m = month ? Number(month) : currentMonth();
    const y = year  ? Number(year)  : currentYear();
    if (m < 1 || m > 12) throw new Error('Tháng không hợp lệ (1-12)');

    const rows = await kpiRepository.getLeaderboard(0, vehicleGroupId, { month: m, year: y });
    return {
        vehicle_group_id: vehicleGroupId,
        month: m,
        year:  y,
        total_in_group: Number(rows[0]?.total_in_group ?? 0),
        leaderboard: rows,
    };
};

// Manager/Coordinator/Accountant sửa tay nhóm xe KPI cố định của tài xế — dùng khi
// gán nhầm lúc tạo tài, hoặc tài chuyển hẳn sang biên chế nhóm khác.
//
// Quy tắc doanh thu khi đổi nhóm (đã chốt với nghiệp vụ):
//   * kpi_records chỉ có 1 dòng cho mỗi tài mỗi tháng nên KHÔNG tách được doanh thu
//     ra hai nhóm — đổi nhóm là cả tháng đi theo.
//   * THÁNG HIỆN TẠI, lương chưa chốt → tính lại ngay, doanh thu cả tháng sang nhóm mới.
//   * MỌI THÁNG CŨ → khoá, giữ nguyên nhóm cũ. Lịch sử đã ghi sao để vậy.
//   * Lương tháng hiện tại đã duyệt/đã chi → KHÔNG đụng KPI, vì tiền đã tính theo
//     nhóm cũ; đổi KPI sẽ làm bảng lương và bảng xếp hạng lệch nhau.
const setDriverDefaultVehicleGroup = async (driverId, vehicleGroupId) => {
    const parsedDriverId = Number(driverId);
    const parsedGroupId  = Number(vehicleGroupId);
    if (!parsedDriverId) throw new Error('Driver ID là bắt buộc');
    if (!parsedGroupId)  throw new Error('Nhóm xe là bắt buộc');

    const driver = await kpiRepository.getDriverDefaultVehicleGroup(parsedDriverId);
    if (!driver) throw new Error('Không tìm thấy tài xế');

    const group = await kpiRepository.getVehicleGroupById(parsedGroupId);
    if (!group) throw new Error('Nhóm xe không tồn tại');
    if (group.status !== 'active') {
        throw new Error(`Nhóm xe "${group.name}" đang bị ẩn — không gán được cho tài xế`);
    }

    if (Number(driver.default_vehicle_group_id) === parsedGroupId) {
        return {
            profile_id: parsedDriverId,
            default_vehicle_group_id: parsedGroupId,
            vehicle_group_name: group.name,
            kpi_synced: false,
            message: `Tài xế đã thuộc nhóm "${group.name}" — không có gì thay đổi`,
        };
    }

    const updated = await kpiRepository.setDriverDefaultVehicleGroup(parsedDriverId, parsedGroupId);

    const now   = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();

    const payrollStatus = await kpiRepository.getPayrollStatus(parsedDriverId, month, year);
    const payrollLocked = payrollStatus !== null && payrollStatus !== 'pending';

    let kpiSynced = false;
    if (!payrollLocked) {
        // await (không fire-and-forget) để trả về đúng kết quả cho người bấm
        await kpiRepository.recalculateDriverKPI(parsedDriverId, month, year, { syncVehicleGroup: true });
        kpiSynced = true;
    }

    const message = payrollLocked
        ? `Đã đổi nhóm cố định sang "${group.name}". Bảng lương tháng ${month}/${year} đã chốt (${payrollStatus}) nên KPI tháng này giữ nguyên nhóm cũ — nhóm mới áp dụng từ kỳ sau.`
        : `Đã đổi nhóm cố định sang "${group.name}". Doanh thu và KPI tháng ${month}/${year} đã chuyển sang nhóm mới. Các tháng trước giữ nguyên nhóm cũ.`;

    return {
        ...updated,
        vehicle_group_name: group.name,
        kpi_synced: kpiSynced,
        payroll_locked: payrollLocked,
        payroll_status: payrollStatus,
        message,
    };
};

// Trigger tự động sau khi trip hoàn thành — gọi fire-and-forget (không await)
const recalculateAfterCompletion = (driverIds, completedAt = new Date()) => {
    const month = completedAt.getMonth() + 1;
    const year  = completedAt.getFullYear();
    const ids = Array.isArray(driverIds) ? driverIds : [driverIds];
    [...new Set(ids.map(Number).filter(Boolean))].forEach((driverId) => {
        kpiRepository.recalculateDriverKPI(driverId, month, year).catch((err) => {
            console.error(`[KPI] Recalculate failed for driver ${driverId} ${month}/${year}:`, err.message);
        });
    });
};

module.exports = {
    getMyKPI,
    getLeaderboard,
    getAllDriversKPI,
    getDriverKPIById,
    getLeaderboardByGroup,
    setDriverDefaultVehicleGroup,
    recalculateAfterCompletion,
};

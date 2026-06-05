const kpiRepository = require('../repositories/kpiRepository');

const getMyKPI = async (driverId, { month, year } = {}) => {
    const m = month ? Number(month) : null;
    const y = year  ? Number(year)  : null;
    if (m && (m < 1 || m > 12)) throw new Error('Tháng không hợp lệ (1-12)');
    if (y && y < 2020)          throw new Error('Năm không hợp lệ');
    return kpiRepository.getDriverKPI(driverId, { month: m, year: y });
};

// BR-028: Leaderboard tính theo vehicle group, không so sánh chéo nhóm xe
const getLeaderboard = async (driverId, { month, year } = {}) => {
    const m = month ? Number(month) : new Date().getMonth() + 1;
    const y = year  ? Number(year)  : new Date().getFullYear();
    if (m < 1 || m > 12) throw new Error('Tháng không hợp lệ (1-12)');

    const vehicleGroupInfo = await kpiRepository.getDriverVehicleGroupId(driverId);
    if (!vehicleGroupInfo) throw new Error('Driver chưa được gán xe');

    const rows = await kpiRepository.getLeaderboard(vehicleGroupInfo.vehicle_group_id, { month: m, year: y });
    return {
        vehicle_group_name: vehicleGroupInfo.vehicle_group_name,
        month: m,
        year: y,
        leaderboard: rows,
    };
};

module.exports = { getMyKPI, getLeaderboard };

const leaveRepository = require('../repositories/leaveRepository');

const VALID_TYPES = ['paid', 'unpaid'];

const getMyLeaves = async (driverId, { month, year } = {}) => {
    const m = month ? Number(month) : null;
    const y = year  ? Number(year)  : null;
    return leaveRepository.getDriverLeaves(driverId, { month: m, year: y });
};

const getSummary = async (driverId, { month, year }) => {
    const m = Number(month) || new Date().getMonth() + 1;
    const y = Number(year)  || new Date().getFullYear();
    return leaveRepository.getAttendanceSummary(driverId, { month: m, year: y });
};

// Ngày do CLIENT gửi lên nên phải tự kiểm, không tin đồng hồ máy người dùng.
// So với "hôm nay" theo giờ Việt Nam chứ không theo giờ máy chủ thô.
const MAX_MONTHS_AHEAD = 3;
// Vẫn cho lùi ít tháng để báo nghỉ bù cho kỳ chưa chốt lương; kỳ đã chốt bị chặn riêng
const MAX_MONTHS_BACK = 3;

const createLeave = async (driverId, { leaveDate, leaveType, reason }) => {
    if (!leaveDate) throw new Error('Ngày nghỉ là bắt buộc');
    if (!VALID_TYPES.includes(leaveType)) throw new Error('Loại nghỉ không hợp lệ (paid / unpaid)');

    const day = String(leaveDate).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Ngày nghỉ không hợp lệ (định dạng YYYY-MM-DD)');
    const d = new Date(`${day}T00:00:00+07:00`);
    if (Number.isNaN(d.getTime())) throw new Error('Ngày nghỉ không hợp lệ');

    const homNay = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

    // Chặn ngày quá xa ở CẢ HAI PHÍA — đồng hồ máy sai hoặc gõ nhầm năm thì chặn day
    // tại đây, không để lọt vào DB rồi mới phát hiện lúc tính lương.
    const windowEnd = new Date(`${homNay}T00:00:00+07:00`);
    windowEnd.setMonth(windowEnd.getMonth() + MAX_MONTHS_AHEAD);
    if (d > windowEnd) {
        throw new Error(`Chỉ đăng ký nghỉ trong vòng ${MAX_MONTHS_AHEAD} tháng tới`);
    }
    const windowStart = new Date(`${homNay}T00:00:00+07:00`);
    windowStart.setMonth(windowStart.getMonth() - MAX_MONTHS_BACK);
    if (d < windowStart) {
        throw new Error(`Không đăng ký nghỉ lùi quá ${MAX_MONTHS_BACK} tháng`);
    }

    // Chặn đăng ký lùi vào kỳ lương ĐÃ CHỐT: số công tháng đó đã dùng để trả tiền,
    // thêm ngày nghỉ vào sẽ làm bảng lương và thực tế lệch nhau.
    const [y, m] = day.split('-').map(Number);
    const payrollStatus = await leaveRepository.getPayrollStatus(driverId, m, y);
    if (payrollStatus && payrollStatus !== 'pending') {
        throw new Error(`Bảng lương tháng ${m}/${y} đã chốt — không đăng ký nghỉ lùi vào kỳ này được. Liên hệ kế toán nếu cần điều chỉnh.`);
    }

    // Chặn đăng ký nghỉ chồng lên ngày đã bị chấm vắng/nửa công. Đối xứng với
    // attendanceService (bên đó chặn chấm vắng cho ngày đã có đơn nghỉ) — trước đây chốt
    // chặn chỉ có MỘT chiều, nên thứ tự ngược (chấm vắng trước, xin nghỉ bù sau) vẫn tạo
    // được hai bản ghi cho cùng một ngày. Bảng lương nay đã khử trùng nên không còn trừ
    // hai công, nhưng vẫn chặn ở đây để dữ liệu không mâu thuẫn ngay từ đầu.
    const blocking = await leaveRepository.findBlockingAttendance(driverId, day);
    if (blocking) {
        const nhan = blocking.status === 'half_day' ? 'nửa công' : 'vắng không phép';
        throw new Error(`Ngày ${day} đã được chấm công "${nhan}" — không đăng ký nghỉ chồng lên được. Liên hệ điều phối/quản lý để sửa chấm công trước.`);
    }

    return leaveRepository.createLeave(driverId, { leaveDate: day, leaveType, reason });
};

const deleteLeave = async (driverId, leaveId) => {
    return leaveRepository.deleteLeave(leaveId, driverId);
};

// Cron: tự động reject các đơn nghỉ còn "pending" nhưng đã qua ngày nghỉ
const rejectExpiredLeaveRequests = async () => leaveRepository.rejectExpiredLeaveRequests();

module.exports = { getMyLeaves, getSummary, createLeave, deleteLeave, rejectExpiredLeaveRequests };

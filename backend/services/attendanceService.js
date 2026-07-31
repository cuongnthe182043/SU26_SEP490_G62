const attendanceRepository = require('../repositories/attendanceRepository');

class AttendanceError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = 'AttendanceError';
        this.status = status;
    }
}

const STATUS_LABEL = {
    present:           'Có mặt',
    holiday:           'Nghỉ lễ (hưởng nguyên lương)',
    holiday_worked:    'Đi làm ngày lễ (200% lương)',
    leave_paid:        'Nghỉ phép (hưởng lương)',
    leave_unpaid:      'Nghỉ không lương',
    absent_unexcused:  'Vắng không phép',
    half_day:          'Nửa công (nghỉ nửa buổi)',
};

// Ngày lễ đè lên mọi trạng thái khác: theo Điều V.1 chính sách lương, ngày lễ được
// nghỉ mà vẫn hưởng nguyên lương — nên không có khái niệm "vắng" hay "nghỉ không
// lương" trong ngày lễ. Chỉ còn hai khả năng: nghỉ lễ, hoặc đi làm và ăn 200%.
const resolveDayStatus = (row) => {
    if (row.holiday_name) {
        return (row.override_status === 'holiday_worked' || row.has_completed_trip)
            ? 'holiday_worked'
            : 'holiday';
    }
    if (row.override_status) return row.override_status;
    if (row.leave_request_id) return row.leave_type === 'paid' ? 'leave_paid' : 'leave_unpaid';
    return 'present';
};

// Gộp override + leave_request thành 1 danh sách theo tài xế, mỗi tài xế có mảng ngày
// với trạng thái hiệu lực đã tính sẵn — tiện cho FE vẽ lưới tháng.
const getMonthlyGrid = async ({ month, year, driverId, vehicleGroupId }) => {
    const m = Number(month);
    const y = Number(year);
    if (!m || m < 1 || m > 12) throw new AttendanceError('Tháng không hợp lệ (1-12)');
    if (!y || y < 2020 || y > 2100) throw new AttendanceError('Năm không hợp lệ');

    const rows = await attendanceRepository.getMonthlyGrid({
        month: m, year: y,
        driverId: driverId ? Number(driverId) : null,
        vehicleGroupId: vehicleGroupId ? Number(vehicleGroupId) : null,
    });

    const driversMap = new Map();
    for (const r of rows) {
        if (!driversMap.has(r.driver_id)) {
            driversMap.set(r.driver_id, {
                driver_id: r.driver_id,
                full_name: r.full_name,
                plate_number: r.plate_number,
                vehicle_group_name: r.vehicle_group_name,
                days: [],
                summary: {
                    present: 0, holiday: 0, holiday_worked: 0,
                    leave_paid: 0, leave_unpaid: 0, absent_unexcused: 0, half_day: 0,
                },
            });
        }
        const driver = driversMap.get(r.driver_id);
        const status = resolveDayStatus(r);

        driver.days.push({
            work_date: r.work_date,
            status,
            status_label: STATUS_LABEL[status],
            override_id: r.override_id,
            override_notes: r.override_notes,
            leave_request_id: r.leave_request_id,
            holiday_name: r.holiday_name ?? null,
            has_completed_trip: Boolean(r.has_completed_trip),
            editable: true,
        });
        driver.summary[status] += 1;
    }

    return { drivers: Array.from(driversMap.values()), status_labels: STATUS_LABEL };
};

const markAttendance = async ({ driverId, workDate, status, notes }, markedBy) => {
    if (!driverId) throw new AttendanceError('driver_id là bắt buộc');
    if (!workDate) throw new AttendanceError('work_date là bắt buộc');
    if (!['present', 'absent_unexcused', 'half_day', 'holiday_worked'].includes(status)) {
        throw new AttendanceError('Trạng thái không hợp lệ (chỉ đánh dấu được: present, absent_unexcused, half_day, holiday_worked)');
    }
    // So sánh theo chuỗi ngày giờ Việt Nam, KHÔNG dùng new Date(workDate) > new Date():
    // 'YYYY-MM-DD' được parse thành 00:00 UTC = 07:00 giờ VN, nên chấm công cho chính
    // hôm nay trước 7h sáng sẽ bị hiểu nhầm là "ngày trong tương lai" và bị chặn oan.
    const todayVN = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    if (String(workDate).slice(0, 10) > todayVN) {
        throw new AttendanceError('Không thể chấm công cho ngày trong tương lai');
    }

    // Ngày lễ hưởng nguyên lương nên không trừ công được; ngược lại "đi làm ngày lễ"
    // chỉ có nghĩa đúng vào ngày lễ. Chặn ở đây để kế toán không chấm ra trạng thái
    // mà lương không hiểu.
    const holidayName = await attendanceRepository.isHoliday(workDate);
    if (holidayName && ['absent_unexcused', 'half_day'].includes(status)) {
        throw new AttendanceError(`${workDate} là ngày lễ (${holidayName}) — được nghỉ hưởng nguyên lương, không trừ công. Nếu tài xế có đi làm hôm đó, chọn "Đi làm ngày lễ" để tính 200%.`);
    }
    if (!holidayName && status === 'holiday_worked') {
        throw new AttendanceError('Chỉ đánh dấu "Đi làm ngày lễ" cho ngày nằm trong danh mục ngày lễ của công ty');
    }

    if (status === 'absent_unexcused' || status === 'half_day') {
        const leave = await attendanceRepository.findApprovedLeave(Number(driverId), workDate);
        if (leave) {
            throw new AttendanceError('Ngày này tài xế đã có đơn nghỉ được duyệt — không thể đánh dấu vắng không phép/nửa công. Nếu cần điều chỉnh, đánh dấu "Có mặt" để ghi đè.');
        }
    }

    return attendanceRepository.upsertOverride({
        driverId: Number(driverId),
        workDate,
        status,
        notes,
        markedBy,
    });
};

const clearAttendance = async (driverId, workDate) => {
    const deleted = await attendanceRepository.deleteOverride(Number(driverId), workDate);
    if (!deleted) throw new AttendanceError('Không tìm thấy đánh dấu chấm công để xoá', 404);
    return deleted;
};

module.exports = { AttendanceError, STATUS_LABEL, getMonthlyGrid, markAttendance, clearAttendance };

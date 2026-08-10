// Số NGÀY CÔNG KHÔNG LƯƠNG của một tài xế trong kỳ — dùng chung cho màn ước tính
// (payrollRepository) và bảng lương chốt chính thức (accountantPayrollRepository).
// Tham số: $1 driver_id, $2 tháng, $3 năm. Trả về 1 dòng, cột `unpaid_days` (NUMERIC).
//
// Vì sao phải gộp một truy vấn thay vì cộng ba truy vấn rời:
// một ngày lịch có thể vừa có đơn nghỉ không lương, vừa có bản ghi chấm công. Đếm rời rồi
// cộng lại là trừ HAI công cho MỘT ngày — tài xế senior mất 321.429đ mỗi ngày dính, và
// bảng lương đã rời trạng thái 'pending' thì không sửa lại được nữa.
// Đường vào có thật: điều phối chấm 'absent_unexcused' trước, tài xế đăng ký nghỉ bù sau
// (leaveService cho đăng ký lùi tới 3 tháng).
//
// Thứ tự ưu tiên: CHẤM CÔNG thắng ĐƠN NGHỈ. Chấm công là thứ điều phối/quản lý quan sát
// được tại chỗ, còn đơn nghỉ là thứ tài xế tự khai — quy tắc "ghi đè 'present' thì không
// trừ công" vốn đã đi theo hướng này, nay áp nhất quán cho mọi trạng thái chấm công.
//
//   ngày lễ                        → 0   (Điều V.1 — nghỉ lễ hưởng nguyên lương)
//   chấm 'absent_unexcused'        → 1
//   chấm 'half_day'                → 0.5 (có đi làm nửa ngày)
//   chấm 'present'/'holiday_worked'→ 0   (đi làm thật, dù có đơn nghỉ)
//   chỉ có đơn nghỉ không lương    → 1
//
// Tập ngày ứng viên chỉ gồm ngày CÓ trừ công tiềm năng; ngày chỉ có chấm 'present' không
// lọt vào nên không sinh dòng thừa. UNIQUE(driver_id, work_date) và UNIQUE(driver_id,
// leave_date) bảo đảm hai LEFT JOIN bên dưới không nhân bản dòng.
const UNPAID_DAYS_SQL = `
    SELECT COALESCE(SUM(
        CASE
            WHEN ao.status = 'absent_unexcused' THEN 1
            WHEN ao.status = 'half_day'         THEN 0.5
            WHEN ao.status IS NOT NULL          THEN 0
            WHEN lr.leave_date IS NOT NULL      THEN 1
            ELSE 0
        END
    ), 0)::numeric AS unpaid_days
    FROM (
        SELECT ao2.work_date AS d
        FROM attendance_overrides ao2
        WHERE ao2.driver_id = $1
          AND ao2.status IN ('absent_unexcused', 'half_day')
          AND EXTRACT(MONTH FROM ao2.work_date) = $2
          AND EXTRACT(YEAR  FROM ao2.work_date) = $3
        UNION
        SELECT lr2.leave_date
        FROM leave_requests lr2
        WHERE lr2.driver_id = $1
          AND lr2.leave_type = 'unpaid' AND lr2.status = 'approved'
          AND EXTRACT(MONTH FROM lr2.leave_date) = $2
          AND EXTRACT(YEAR  FROM lr2.leave_date) = $3
    ) cand
    LEFT JOIN attendance_overrides ao
           ON ao.driver_id = $1 AND ao.work_date = cand.d
    LEFT JOIN leave_requests lr
           ON lr.driver_id = $1 AND lr.leave_date = cand.d
          AND lr.leave_type = 'unpaid' AND lr.status = 'approved'
    WHERE NOT EXISTS (
        SELECT 1 FROM company_holidays h WHERE h.holiday_date = cand.d
    )
`;

module.exports = { UNPAID_DAYS_SQL };

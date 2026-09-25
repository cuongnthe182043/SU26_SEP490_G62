import { RiCheckboxCircleFill, RiToolsFill, RiTimeFill, RiErrorWarningFill, RiForbidFill } from "react-icons/ri";

// Mỗi trạng thái một màu VÀ một biểu tượng riêng — chỉ khác màu thì người mù màu, hay
// màn hình chỉnh độ sáng thấp, vẫn không phân biệt được "hỏng" với "bảo dưỡng".
const VEHICLE_STATUS = {
  active: {
    label: "Đang hoạt động",
    Icon: RiCheckboxCircleFill,
    style: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/30",
  },
  maintenance: {
    label: "Đang bảo dưỡng",
    Icon: RiToolsFill,
    style: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/30",
  },
  // Tài xế đã nộp hóa đơn, đang chờ quản lý bấm Xác nhận — việc nằm ở phía văn phòng,
  // khác hẳn "đang bảo dưỡng" (việc nằm ở phía xưởng), nên tách màu riêng.
  maintenance_pending: {
    label: "Chờ xác nhận bảo dưỡng",
    Icon: RiTimeFill,
    style: "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-500/30",
  },
  broken: {
    label: "Hỏng",
    Icon: RiErrorWarningFill,
    style: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-500/30",
  },
  retired: {
    label: "Đã thu hồi",
    Icon: RiForbidFill,
    style: "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 ring-gray-200 dark:ring-white/10",
  },
};

const FALLBACK_STYLE = "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 ring-gray-200 dark:ring-white/10";

/**
 * Badge trạng thái xe. Truyền cả `vehicle` (dòng từ API danh sách xe) để phân biệt được
 * bảo dưỡng đang làm với bảo dưỡng đang chờ xác nhận — cột `vehicles.status` chỉ có
 * một giá trị 'maintenance' cho cả hai.
 */
export function VehicleStatusBadge({ vehicle }) {
  const status = String(vehicle?.status ?? "").trim().toLowerCase();
  const key = status === "maintenance" && vehicle?.active_maintenance_status === "pending_verification"
    ? "maintenance_pending"
    : status;
  const cfg = VEHICLE_STATUS[key];
  const Icon = cfg?.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ring-1 ring-inset whitespace-nowrap ${cfg?.style ?? FALLBACK_STYLE}`}
    >
      {Icon && <Icon size={13} className="shrink-0" />}
      {cfg?.label ?? vehicle?.status ?? "-"}
    </span>
  );
}

export default VehicleStatusBadge;

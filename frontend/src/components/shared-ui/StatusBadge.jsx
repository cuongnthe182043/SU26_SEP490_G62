const STATUS_STYLES = {
  // trip / shipment lifecycle
  available:      "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300",
  claimed:        "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300",
  picking:        "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300",
  loaded:         "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300",
  transit:        "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300",
  arrived:        "bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
  returning:      "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-300",
  completed:      "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  cancelled:      "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400",
  failed:         "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300",
  partial:        "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-300",

  // incident lifecycle
  open:           "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300",
  investigating:  "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300",
  resolved:       "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  closed:         "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400",

  // receipt / approval lifecycle
  pending:        "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300",
  processing:     "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300",
  approved:       "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  rejected:       "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300",
  reviewed:       "bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300",
  paid:           "bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-300",

  // severity level (sự cố)
  low:            "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400",
  medium:         "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300",
  high:           "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-300",
  critical:       "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300",
};

const STATUS_LABELS = {
  // trip / shipment lifecycle
  available:      "Chưa nhận",
  claimed:        "Đã nhận",
  picking:        "Đang lấy hàng",
  loaded:         "Đã lấy hàng",
  transit:        "Đang vận chuyển",
  arrived:        "Đã đến nơi",
  returning:      "Đang hoàn hàng",
  completed:      "Hoàn thành",
  cancelled:      "Đã hủy",
  failed:         "Thất bại",
  partial:        "Nhiều trạng thái",

  // incident lifecycle
  open:           "Mới tiếp nhận",
  investigating:  "Đang xử lý",
  resolved:       "Đã giải quyết",
  closed:         "Đã đóng",

  // receipt / approval lifecycle
  pending:        "Chờ duyệt",
  processing:     "Đang xử lý",
  approved:       "Đã duyệt",
  rejected:       "Đã từ chối",
  reviewed:       "Đã xác nhận",
  paid:           "Đã chi",

  // severity level (sự cố)
  low:            "Thấp",
  medium:         "Trung bình",
  high:           "Cao",
  critical:       "Khẩn cấp",
};

const normalize = (status) => String(status ?? "").trim().toLowerCase();

/**
 * Badge trạng thái dùng chung — luôn hiển thị tiếng Việt.
 * Truyền `status` là đủ; không cần children (children chỉ dùng khi cần ghi đè hiển thị đặc biệt).
 */
export function StatusBadge({ status, children }) {
  const key = normalize(status);
  const style = STATUS_STYLES[key] || "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400";
  const label = STATUS_LABELS[key] ?? status ?? "-";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${style}`}>
      {children ?? label}
    </span>
  );
}

export default StatusBadge;

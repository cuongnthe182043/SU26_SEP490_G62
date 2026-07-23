import { useEffect, useState } from "react";
import {
  RiCheckboxCircleFill, RiErrorWarningFill, RiInformationFill, RiAlertFill, RiCloseLine,
} from "react-icons/ri";

/**
 * Hệ thống thông báo (toast) dùng chung — thay cho window.alert().
 * Gọi ở BẤT KỲ đâu (kể cả ngoài component):
 *   notify("..."), notify.success("..."), notify.error("..."), notify.warning("..."), notify.info("...")
 * Đặt <Toaster /> một lần ở App để hiển thị (góc trên bên phải).
 */

let seq = 0;
const listeners = new Set();
let store = [];
const emit = () => listeners.forEach((l) => l(store));

function push(type, message, duration = 4000) {
  const text = message == null || message === "" ? (type === "error" ? "Đã xảy ra lỗi" : "") : String(message);
  const id = ++seq;
  store = [...store, { id, type, message: text }];
  emit();
  if (duration) setTimeout(() => dismiss(id), duration);
  return id;
}

function dismiss(id) {
  store = store.filter((t) => t.id !== id);
  emit();
}

export const notify = Object.assign((m) => push("info", m), {
  success: (m) => push("success", m),
  error: (m) => push("error", m),
  warning: (m) => push("warning", m),
  info: (m) => push("info", m),
  dismiss,
});

const STYLE = {
  success: { Icon: RiCheckboxCircleFill, accent: "text-emerald-500", bar: "bg-emerald-500" },
  error:   { Icon: RiErrorWarningFill,   accent: "text-rose-500",    bar: "bg-rose-500" },
  warning: { Icon: RiAlertFill,          accent: "text-amber-500",   bar: "bg-amber-500" },
  info:    { Icon: RiInformationFill,    accent: "text-blue-500",    bar: "bg-blue-500" },
};

function ToastCard({ toast, onClose }) {
  const s = STYLE[toast.type] ?? STYLE.info;
  const { Icon } = s;
  return (
    <div className="g62-toast-in pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#1b1f2a] shadow-lg px-4 py-3">
      <span className={`absolute left-0 top-0 h-full w-1 ${s.bar}`} />
      <Icon size={20} className={`${s.accent} shrink-0 mt-0.5`} />
      <p className="flex-1 text-sm text-gray-700 dark:text-gray-200 leading-snug break-words">{toast.message}</p>
      <button
        onClick={onClose}
        className="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        aria-label="Đóng"
      >
        <RiCloseLine size={16} />
      </button>
    </div>
  );
}

export function Toaster() {
  const [items, setItems] = useState(store);
  useEffect(() => {
    const l = (s) => setItems([...s]);
    listeners.add(l);
    setItems([...store]);
    return () => listeners.delete(l);
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[9999] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2 pointer-events-none">
      {items.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

export default Toaster;

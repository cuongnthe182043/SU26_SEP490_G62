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
  success: {
    Icon: RiCheckboxCircleFill,
    shell: "border-emerald-400 bg-emerald-500 text-white shadow-emerald-600/30 dark:border-emerald-300/60 dark:bg-emerald-500 dark:text-white",
    accent: "text-white",
    close: "text-white/80 hover:text-white",
  },
  error: {
    Icon: RiErrorWarningFill,
    shell: "border-rose-400 bg-rose-500 text-white shadow-rose-600/30 dark:border-rose-300/60 dark:bg-rose-500 dark:text-white",
    accent: "text-white",
    close: "text-white/80 hover:text-white",
  },
  warning: {
    Icon: RiAlertFill,
    shell: "border-amber-300 bg-amber-400 text-amber-950 shadow-amber-500/30 dark:border-amber-200/70 dark:bg-amber-400 dark:text-amber-950",
    accent: "text-amber-950",
    close: "text-amber-950/75 hover:text-amber-950",
  },
  info: {
    Icon: RiInformationFill,
    shell: "border-sky-400 bg-sky-500 text-white shadow-sky-600/30 dark:border-sky-300/60 dark:bg-sky-500 dark:text-white",
    accent: "text-white",
    close: "text-white/80 hover:text-white",
  },
};

function ToastCard({ toast, onClose }) {
  const s = STYLE[toast.type] ?? STYLE.info;
  const { Icon } = s;
  return (
    <div className={`g62-toast-in pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border shadow-lg px-4 py-3 ${s.shell}`}>
      <Icon size={20} className={`${s.accent} shrink-0 mt-0.5`} />
      <p className="flex-1 text-sm leading-snug break-words">{toast.message}</p>
      <button
        onClick={onClose}
        className={`shrink-0 transition-colors ${s.close}`}
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

  const stackedItems = items.slice(-4).reverse();

  return (
    <div className="fixed top-[90px] right-4 z-[9999] h-36 w-[360px] max-w-[calc(100vw-2rem)] pointer-events-none">
      {stackedItems.map((t, index) => (
        <div
          key={t.id}
          className="absolute inset-x-0 transition-all duration-200 ease-out"
          style={{
            zIndex: stackedItems.length - index,
            transform: `translateY(${index * 12}px) scale(${1 - index * 0.035})`,
            opacity: 1 - index * 0.12,
            transformOrigin: "top right",
          }}
        >
          <ToastCard toast={t} onClose={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}

export default Toaster;

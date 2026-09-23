import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ToastOverlay } from '@/components/toast';
import { ConfirmModal } from '@/components/confirm-modal';
import { AlertModal } from '@/components/alert-modal';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type ToastOptions = {
    type: ToastType;
    message: string;
    duration?: number;
};

export type ConfirmOptions = {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
};

export type AlertOptions = {
    title: string;
    message?: string;
    okLabel?: string;
    type?: 'success' | 'error' | 'warning' | 'info';
};

type ToastState = ToastOptions & { id: number; visible: boolean };
type ConfirmState = ConfirmOptions & { visible: boolean; id: number; resolve: (v: boolean) => void };
type AlertState = AlertOptions & { visible: boolean; id: number; resolve: () => void };

// ─── Context ──────────────────────────────────────────────────────────────────

type UIContextValue = {
    showToast: (opts: ToastOptions) => void;
    showConfirm: (opts: ConfirmOptions) => Promise<boolean>;
    showAlert: (opts: AlertOptions) => Promise<void>;
};

const UIContext = createContext<UIContextValue | null>(null);

// Toast / hộp xác nhận / thông báo là View thường vẽ ở gốc app, nên luôn nằm DƯỚI mọi
// native <Modal> (camera toàn màn hình, bottom sheet...). Đã gặp: đang chụp hóa đơn bảo
// dưỡng thì quản lý trả chứng từ về → thông báo hiện sau lưng camera, tài xế không thấy,
// đóng camera ra mới thấy nó đè lên lúc ảnh đang gửi. Nên nội dung mỗi Modal được bọc
// trong <UIOverlaySlot> (qua AppModal) và lớp phủ được vẽ vào slot của Modal nằm trên
// cùng; không Modal nào mở thì vẽ ở gốc như cũ.
//
// "Trên cùng" = lồng sâu nhất, không phải mount sau cùng: Modal lồng trong Modal hiện đè
// lên Modal cha, mà thứ tự render/effect không cho biết điều đó (effect chạy con trước
// cha; slot cha có thể mount lại khi Modal con đang mở).
type Slot = { id: number; depth: number };

type OverlaySlotContextValue = {
    topSlot: number | null;
    overlays: React.ReactNode;
    register: (slot: Slot) => () => void;
};

const OverlaySlotContext = createContext<OverlaySlotContextValue | null>(null);
const SlotDepthContext = createContext(0);

let slotSeq = 0;

/**
 * Bọc TOÀN BỘ nội dung của một native <Modal>. Dùng qua AppModal, không gắn tay.
 *
 * `active` = Modal này có đang thực sự hiện hay không. Bắt buộc phải có, vì "React có
 * render children" KHÔNG đồng nghĩa "Modal đang hiện":
 *
 *   • Android: Modal.render() trả null khi visible=false → children tháo, slot tự huỷ.
 *   • iOS:     _shouldShowModal() = `visible === true || state.isRendered === true`.
 *              isRendered chỉ về false khi native bắn sự kiện modalDismissed, nên có
 *              cửa sổ (và với New Architecture là có thể MÃI MÃI) Modal đã ẩn mà
 *              children vẫn còn mount.
 *
 * Không có cờ này thì một Modal đã ẩn vẫn giữ slot, `topSlot` trỏ vào nó, và toàn bộ
 * toast/hộp xác nhận/thông báo được vẽ vào bên trong một Modal vô hình — tức là biến
 * mất hoàn toàn khỏi màn hình. Đáng ngại nhất ở active-trip-screen: nó giữ 5 Modal
 * mount thường trực (2 ReasonModal, 2 CameraModal, 1 ExpenseFormModal).
 */
export function UIOverlaySlot({
    children,
    active = true,
}: { children?: React.ReactNode; active?: boolean }) {
    const ctx = useContext(OverlaySlotContext);
    const depth = useContext(SlotDepthContext) + 1;
    const [id] = useState(() => ++slotSeq);
    const register = ctx?.register;
    useEffect(() => {
        if (!active) return;
        return register?.({ id, depth });
    }, [register, id, depth, active]);
    return (
        <SlotDepthContext.Provider value={depth}>
            {children}
            {active && ctx?.topSlot === id ? ctx.overlays : null}
        </SlotDepthContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(UIContext);
    if (!ctx) throw new Error('useToast must be used inside UIProvider');
    return { showToast: ctx.showToast };
}

export function useConfirm() {
    const ctx = useContext(UIContext);
    if (!ctx) throw new Error('useConfirm must be used inside UIProvider');
    return { showConfirm: ctx.showConfirm };
}

export function useAppAlert() {
    const ctx = useContext(UIContext);
    if (!ctx) throw new Error('useAppAlert must be used inside UIProvider');
    return { showAlert: ctx.showAlert };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

// Mỗi hộp thoại mang một id riêng để làm `key` khi render: không có key, React giữ
// nguyên instance cũ khi hộp kế tiếp thay chỗ — hiệu ứng mở không chạy lại và
// BackHandler vẫn là của hộp đã đóng.
let dialogSeq = 0;

export function UIProvider({ children }: { children: React.ReactNode }) {
    const [toast, setToast] = useState<ToastState | null>(null);
    // Hộp xác nhận / thông báo xếp HÀNG ĐỢI chứ không phải một ô duy nhất.
    //
    // Trước đây mỗi loại giữ đúng một state + một resolver: hộp mới đè lên hộp đang
    // mở và ghi đè luôn resolver của nó, nên `await showAlert(...)` của màn hình bên
    // dưới KHÔNG BAO GIỜ resolve. Chỉ cần một thông báo đẩy tới (WS, display_mode
    // 'alert'/'traffic_alert' — xem notifications-provider) rơi đúng lúc màn hình
    // đang hiện hộp "Đã gửi yêu cầu!" là màn đó treo vĩnh viễn: nút kẹt ở "Đang xử
    // lý...", `router.back()` sau await không chạy, và nội dung hộp bị tráo giữa
    // chừng nên tài xế bấm OK cho một đằng lại xác nhận một nẻo.
    //
    // Xếp hàng thì hộp nào cũng được xem và promise nào cũng resolve, đúng một lần.
    const [confirms, setConfirms] = useState<ConfirmState[]>([]);
    const [alerts, setAlerts]     = useState<AlertState[]>([]);

    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Toast ──
    const showToast = useCallback((opts: ToastOptions) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ ...opts, id: Date.now(), visible: true });
        const duration = opts.duration ?? 3000;
        toastTimerRef.current = setTimeout(() => {
            setToast((t) => t ? { ...t, visible: false } : null);
        }, duration);
    }, []);

    const handleToastHide = useCallback(() => setToast(null), []);

    // ── Confirm ──
    const showConfirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setConfirms((queue) => [...queue, { ...opts, visible: true, id: ++dialogSeq, resolve }]);
        });
    }, []);

    // Gọi resolve bên trong updater là có chủ ý: nó lấy đúng phần tử đầu hàng của
    // state mới nhất, không cần thêm ref đi kèm. Resolve một promise hai lần là
    // no-op nên StrictMode chạy updater lặp cũng không sinh hệ quả.
    const handleConfirmResult = useCallback((result: boolean) => {
        setConfirms(([current, ...rest]) => {
            current?.resolve(result);
            return rest;
        });
    }, []);

    // ── Alert ──
    const showAlert = useCallback((opts: AlertOptions): Promise<void> => {
        return new Promise((resolve) => {
            setAlerts((queue) => [...queue, { ...opts, visible: true, id: ++dialogSeq, resolve }]);
        });
    }, []);

    const handleAlertClose = useCallback(() => {
        setAlerts(([current, ...rest]) => {
            current?.resolve();
            return rest;
        });
    }, []);

    // ── Overlay slots ──
    const [slots, setSlots] = useState<Slot[]>([]);
    const register = useCallback((slot: Slot) => {
        setSlots((cur) => [...cur, slot]);
        return () => setSlots((cur) => cur.filter((x) => x.id !== slot.id));
    }, []);
    // Sâu nhất thắng; cùng độ sâu (hai Modal ngang hàng) thì cái mở sau nằm trên.
    const topSlot = slots.reduce<Slot | null>(
        (top, x) => (!top || x.depth >= top.depth ? x : top), null,
    )?.id ?? null;

    // Chỉ hộp đầu hàng được vẽ; các hộp sau lần lượt lên khi hộp trước đóng.
    // Hộp xác nhận nằm trên thông báo: nó đang chờ một quyết định, còn thông báo
    // chỉ cần đọc — và cả hai đều chặn thao tác bên dưới nên không thể xen kẽ.
    const confirm = confirms[0];
    const alert   = alerts[0];

    const overlays = (
        <>
            {toast && (
                <ToastOverlay key={toast.id} toast={toast} onHide={handleToastHide} />
            )}
            {alert && !confirm && (
                <AlertModal key={alert.id} opts={alert} onClose={handleAlertClose} />
            )}
            {confirm && (
                <ConfirmModal key={confirm.id} opts={confirm} onResult={handleConfirmResult} />
            )}
        </>
    );

    return (
        <UIContext.Provider value={{ showToast, showConfirm, showAlert }}>
            <OverlaySlotContext.Provider value={{ topSlot, overlays, register }}>
                {children}
                {topSlot === null ? overlays : null}
            </OverlaySlotContext.Provider>
        </UIContext.Provider>
    );
}

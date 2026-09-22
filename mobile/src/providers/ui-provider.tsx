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
type ConfirmState = ConfirmOptions & { visible: boolean };
type AlertState = AlertOptions & { visible: boolean };

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

/** Bọc TOÀN BỘ nội dung của một native <Modal>. Dùng qua AppModal, không gắn tay. */
export function UIOverlaySlot({ children }: { children?: React.ReactNode }) {
    const ctx = useContext(OverlaySlotContext);
    const depth = useContext(SlotDepthContext) + 1;
    const [id] = useState(() => ++slotSeq);
    const register = ctx?.register;
    useEffect(() => register?.({ id, depth }), [register, id, depth]);
    return (
        <SlotDepthContext.Provider value={depth}>
            {children}
            {ctx?.topSlot === id ? ctx.overlays : null}
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

export function UIProvider({ children }: { children: React.ReactNode }) {
    const [toast, setToast] = useState<ToastState | null>(null);
    const [confirm, setConfirm] = useState<ConfirmState | null>(null);
    const [alert, setAlert] = useState<AlertState | null>(null);

    const confirmResolveRef = useRef<((v: boolean) => void) | null>(null);
    const alertResolveRef   = useRef<(() => void) | null>(null);
    const toastTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            confirmResolveRef.current = resolve;
            setConfirm({ ...opts, visible: true });
        });
    }, []);

    const handleConfirmResult = useCallback((result: boolean) => {
        setConfirm(null);
        confirmResolveRef.current?.(result);
        confirmResolveRef.current = null;
    }, []);

    // ── Alert ──
    const showAlert = useCallback((opts: AlertOptions): Promise<void> => {
        return new Promise((resolve) => {
            alertResolveRef.current = resolve;
            setAlert({ ...opts, visible: true });
        });
    }, []);

    const handleAlertClose = useCallback(() => {
        setAlert(null);
        alertResolveRef.current?.();
        alertResolveRef.current = null;
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

    const overlays = (
        <>
            {toast && (
                <ToastOverlay key={toast.id} toast={toast} onHide={handleToastHide} />
            )}
            {confirm && (
                <ConfirmModal opts={confirm} onResult={handleConfirmResult} />
            )}
            {alert && (
                <AlertModal opts={alert} onClose={handleAlertClose} />
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

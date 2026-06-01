import { createContext, useCallback, useContext, useRef, useState } from 'react';
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

    return (
        <UIContext.Provider value={{ showToast, showConfirm, showAlert }}>
            {children}
            {toast && (
                <ToastOverlay key={toast.id} toast={toast} onHide={handleToastHide} />
            )}
            {confirm && (
                <ConfirmModal opts={confirm} onResult={handleConfirmResult} />
            )}
            {alert && (
                <AlertModal opts={alert} onClose={handleAlertClose} />
            )}
        </UIContext.Provider>
    );
}

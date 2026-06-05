import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { API_BASE_URL } from '@/constants/api';
import { ERROR_MESSAGES } from '@/constants/error-messages';
import { ApiError } from '@/lib/api-error';
import { notificationService } from '@/services/notification-service';
import { tokenStorage } from '@/services/token-storage';
import type { AppNotification, NotificationEvent } from '@/types/notification';
import { useAuthSession } from '@/providers/auth-provider';
import { useAppAlert, useToast } from '@/providers/ui-provider';

const PAGE_LIMIT = 20;

type NotificationsContextValue = {
    notifications: AppNotification[];
    unreadCount: number;
    total: number;
    page: number;
    totalPages: number;
    isLoading: boolean;
    error: string | null;
    refresh: (showSpinner?: boolean) => Promise<void>;
    markAsRead: (id: number | string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    goToPage: (p: number) => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const toWsUrl = () => {
    const url = new URL(API_BASE_URL);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws/notifications';
    url.search = '';
    return url;
};

const normalizeNotification = (notification: AppNotification): AppNotification => ({
    ...notification,
    message: notification.message ?? '',
    is_read: Boolean(notification.is_read),
});

const mergeNotification = (items: AppNotification[], notification: AppNotification) => {
    const normalized = normalizeNotification(notification);
    const existingIndex = items.findIndex((item) => String(item.id) === String(normalized.id));
    if (existingIndex < 0) return [normalized, ...items];
    const next = [...items];
    next[existingIndex] = { ...next[existingIndex], ...normalized };
    return next;
};

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
    const { status } = useAuthSession();
    const { showToast } = useToast();
    const { showAlert } = useAppAlert();

    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount]     = useState(0);
    const [total, setTotal]                 = useState(0);
    const [page, setPage]                   = useState(1);
    const [totalPages, setTotalPages]       = useState(1);
    const [isLoading, setIsLoading]         = useState(false);
    const [error, setError]                 = useState<string | null>(null);

    const pageRef             = useRef(1);
    const socketRef           = useRef<WebSocket | null>(null);
    const reconnectTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptRef = useRef(0);
    const shouldConnectRef    = useRef(false);

    const closeSocket = useCallback(() => {
        shouldConnectRef.current = false;
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
        socketRef.current?.close();
        socketRef.current = null;
    }, []);

    // ── Fetch page ──────────────────────────────────────────────────────────────
    const fetchPage = useCallback(async (targetPage: number, showSpinner: boolean) => {
        if (showSpinner) {
            setIsLoading(true);
            setError(null);
        }
        try {
            const res = await notificationService.getMyNotifications(targetPage, PAGE_LIMIT);
            setNotifications((res.notifications ?? []).map(normalizeNotification));
            setUnreadCount(res.unreadCount ?? 0);
            setTotal(res.total ?? 0);
            setTotalPages(res.totalPages ?? 1);
            setPage(targetPage);
            pageRef.current = targetPage;
            setError(null);
        } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
                setNotifications([]);
                setError(null);
                return;
            }
            if (showSpinner) {
                setError(err instanceof Error ? err.message : ERROR_MESSAGES.notificationLoadFailed);
            }
        } finally {
            if (showSpinner) setIsLoading(false);
        }
    }, []);

    const refresh   = useCallback((showSpinner = true) => fetchPage(pageRef.current, showSpinner), [fetchPage]);
    const goToPage  = useCallback((p: number)          => fetchPage(p, true),                      [fetchPage]);

    // ── Incoming WS notification ────────────────────────────────────────────────
    const handleIncomingNotification = useCallback((notification: AppNotification) => {
        const normalized = normalizeNotification(notification);

        // Prepend to list only when on page 1 (newest first)
        if (pageRef.current === 1) {
            setNotifications((current) => mergeNotification(current, normalized));
        }
        // Always update unread badge
        if (!normalized.is_read) {
            setUnreadCount((c) => c + 1);
        }
        setTotal((t) => t + 1);

        if (normalized.display_mode === 'silent') return;
        if (normalized.display_mode === 'alert') {
            void showAlert({
                type: 'info',
                title: normalized.title,
                message: normalized.message,
                okLabel: 'Đã hiểu',
            });
            return;
        }
        showToast({
            type: 'info',
            message: `${normalized.title}${normalized.message ? `: ${normalized.message}` : ''}`,
        });
    }, [showAlert, showToast]);

    // ── WebSocket ───────────────────────────────────────────────────────────────
    const connect = useCallback(async () => {
        if (status !== 'authenticated') return;
        if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) return;

        const token = await tokenStorage.getToken();
        if (!token) return;

        shouldConnectRef.current = true;
        const wsUrl = toWsUrl();
        wsUrl.searchParams.set('token', token);

        const socket = new WebSocket(wsUrl.toString());
        socketRef.current = socket;

        socket.onopen = () => { reconnectAttemptRef.current = 0; };

        socket.onmessage = (event) => {
            try {
                const payload = JSON.parse(String(event.data)) as NotificationEvent;
                if (payload.type === 'notification.created') {
                    handleIncomingNotification(payload.notification);
                }
            } catch { /* ignore malformed */ }
        };

        socket.onclose = () => {
            socketRef.current = null;
            if (!shouldConnectRef.current) return;
            reconnectAttemptRef.current += 1;
            const delay = Math.min(30_000, 1000 * reconnectAttemptRef.current);
            reconnectTimerRef.current = setTimeout(() => { void connect(); }, delay);
        };

        socket.onerror = () => { socket.close(); };
    }, [handleIncomingNotification, status]);

    // ── Mark as read ────────────────────────────────────────────────────────────
    const markAsRead = useCallback(async (id: number | string) => {
        setNotifications((current) =>
            current.map((item) => String(item.id) === String(id) ? { ...item, is_read: true } : item),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
        try {
            const { notification } = await notificationService.markAsRead(id);
            setNotifications((current) => mergeNotification(current, notification));
        } catch {
            void refresh(false);
        }
    }, [refresh]);

    const markAllAsRead = useCallback(async () => {
        setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
        setUnreadCount(0);
        try {
            await notificationService.markAllAsRead();
        } catch {
            void refresh(false);
        }
    }, [refresh]);

    // ── Auth lifecycle ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (status !== 'authenticated') {
            closeSocket();
            setNotifications([]);
            setUnreadCount(0);
            setTotal(0);
            setPage(1);
            setTotalPages(1);
            setIsLoading(false);
            setError(null);
            pageRef.current = 1;
            return;
        }
        void fetchPage(1, true);
        void connect();
        return () => closeSocket();
    }, [closeSocket, connect, fetchPage, status]);

    useEffect(() => {
        const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
            if (status !== 'authenticated') return;
            if (next === 'active') {
                void refresh(false);
                void connect();
            } else {
                closeSocket();
            }
        });
        return () => sub.remove();
    }, [closeSocket, connect, refresh, status]);

    const value = useMemo<NotificationsContextValue>(() => ({
        notifications,
        unreadCount,
        total,
        page,
        totalPages,
        isLoading,
        error,
        refresh,
        markAsRead,
        markAllAsRead,
        goToPage,
    }), [error, goToPage, isLoading, markAllAsRead, markAsRead, notifications,
        page, refresh, total, totalPages, unreadCount]);

    return (
        <NotificationsContext.Provider value={value}>
            {children}
        </NotificationsContext.Provider>
    );
}

export function useNotificationsContext() {
    const context = useContext(NotificationsContext);
    if (!context) throw new Error('useNotificationsContext must be used inside NotificationsProvider');
    return context;
}

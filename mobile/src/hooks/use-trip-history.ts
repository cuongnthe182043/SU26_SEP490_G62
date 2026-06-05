import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { tripService } from '@/services/trip-service';
import type { OrderHistoryItem, OrderHistoryPagination } from '@/types/trip';

const LIMIT = 15;

export function useTripHistory() {
    const [orders, setOrders]         = useState<OrderHistoryItem[]>([]);
    const [pagination, setPagination] = useState<OrderHistoryPagination | null>(null);
    const [isLoading, setLoading]     = useState(true);
    const [error, setError]           = useState<string | null>(null);

    const pageRef        = useRef(1);
    const hasLoadedRef   = useRef(false);

    const load = useCallback(async (p: number, showSpinner: boolean) => {
        if (showSpinner) setLoading(true);
        setError(null);
        try {
            const { orders: rows, pagination: meta } = await tripService.getOrderHistory(p, LIMIT);
            setOrders(rows);
            setPagination(meta);
            pageRef.current   = p;
            hasLoadedRef.current = true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Không thể tải lịch sử');
        } finally {
            if (showSpinner) setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            load(pageRef.current, !hasLoadedRef.current);
        }, [load]),
    );

    const refresh  = useCallback(() => load(1, true), [load]);
    const goToPage = useCallback((p: number) => load(p, true), [load]);

    const page       = pagination?.page        ?? 1;
    const totalPages = pagination?.totalPages  ?? 1;
    const total      = pagination?.total       ?? 0;

    return { orders, pagination, page, totalPages, total, isLoading, error, refresh, goToPage };
}

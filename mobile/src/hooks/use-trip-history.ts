import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { tripService } from '@/services/trip-service';
import type { OrderHistoryItem, OrderHistoryPagination } from '@/types/trip';

const LIMIT = 20;

export function useTripHistory() {
    const [orders, setOrders]           = useState<OrderHistoryItem[]>([]);
    const [pagination, setPagination]   = useState<OrderHistoryPagination | null>(null);
    const [isLoading, setLoading]       = useState(true);
    const [isLoadingMore, setLoadMore]  = useState(false);
    const [error, setError]             = useState<string | null>(null);

    const pageRef        = useRef(1);
    // Sau khi load xong lần đầu, các lần focus tiếp theo refresh ngầm (không hiện spinner)
    const hasLoadedRef   = useRef(false);

    const load = useCallback(async (page: number, showSpinner: boolean) => {
        const isFirst = page === 1;

        if (isFirst) {
            if (showSpinner) setLoading(true);
        } else {
            setLoadMore(true);
        }
        setError(null);

        try {
            const { orders: rows, pagination: meta } =
                await tripService.getOrderHistory(page, LIMIT);

            setOrders(prev => isFirst ? rows : [...prev, ...rows]);
            setPagination(meta);
            pageRef.current   = page;
            hasLoadedRef.current = true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Không thể tải lịch sử');
        } finally {
            if (isFirst) setLoading(false);
            else         setLoadMore(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            // Lần đầu vào tab: hiện spinner toàn màn hình
            // Tab switch quay lại: refresh ngầm, không hiện spinner / không đẩy layout
            load(1, !hasLoadedRef.current);
        }, [load]),
    );

    // Pull-to-refresh: luôn hiện spinner (người dùng chủ động)
    const refresh  = useCallback(() => load(1, true), [load]);

    const loadMore = useCallback(() => {
        if (!pagination) return;
        if (pageRef.current >= pagination.totalPages) return;
        if (isLoadingMore) return;
        load(pageRef.current + 1, false);
    }, [pagination, isLoadingMore, load]);

    const hasMore = pagination ? pageRef.current < pagination.totalPages : false;

    return { orders, pagination, isLoading, isLoadingMore, hasMore, error, refresh, loadMore };
}

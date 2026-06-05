import { useCallback, useEffect, useState } from 'react';
import { tripService } from '@/services/trip-service';
import type { OrderDetailResponse } from '@/types/trip';

export function useOrderDetail(orderId: number) {
    const [data, setData]         = useState<OrderDetailResponse | null>(null);
    const [isLoading, setLoading] = useState(true);
    const [error, setError]       = useState<string | null>(null);

    const fetch = useCallback(async () => {
        if (!orderId) return;
        setLoading(true);
        setError(null);
        try {
            const detail = await tripService.getOrderDetail(orderId);
            setData(detail);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Không thể tải chi tiết đơn hàng');
        } finally {
            setLoading(false);
        }
    }, [orderId]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, isLoading, error, refresh: fetch };
}

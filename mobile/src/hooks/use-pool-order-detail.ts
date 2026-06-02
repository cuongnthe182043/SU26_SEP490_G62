import { useCallback, useEffect, useState } from 'react';
import { tripService } from '@/services/trip-service';
import type { PoolOrderDetail } from '@/types/trip';

export function usePoolOrderDetail(orderId: number) {
    const [data, setData]         = useState<PoolOrderDetail | null>(null);
    const [isLoading, setLoading] = useState(true);
    const [error, setError]       = useState<string | null>(null);

    const fetch = useCallback(async () => {
        if (!orderId) return;
        setLoading(true);
        setError(null);
        try {
            const detail = await tripService.getPoolOrderDetail(orderId);
            setData(detail);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Không thể tải thông tin đơn hàng');
        } finally {
            setLoading(false);
        }
    }, [orderId]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, isLoading, error, refresh: fetch };
}

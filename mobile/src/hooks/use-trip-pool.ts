import { useCallback, useEffect, useState } from 'react';
import { tripService } from '@/services/trip-service';
import type { TripPoolItem } from '@/types/trip';

type State = {
    trips: TripPoolItem[];
    isLoading: boolean;
    error: string | null;
};

export function useTripPool() {
    const [state, setState] = useState<State>({ trips: [], isLoading: true, error: null });

    const fetch = useCallback(async () => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            const { trips } = await tripService.getPool();
            setState({ trips, isLoading: false, error: null });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể tải danh sách chuyến';
            setState({ trips: [], isLoading: false, error: message });
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    return { ...state, refresh: fetch };
}

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { tripService } from '@/services/trip-service';
import type { ActiveTrip } from '@/types/trip';

type State = {
    trip: ActiveTrip | null;
    isLoading: boolean;
    error: string | null;
};

export function useActiveTrip() {
    const [state, setState] = useState<State>({ trip: null, isLoading: true, error: null });

    const fetch = useCallback(async () => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            const { trip } = await tripService.getActiveTrip();
            setState({ trip, isLoading: false, error: null });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể tải chuyến';
            setState({ trip: null, isLoading: false, error: message });
        }
    }, []);

    // Refresh mỗi khi màn hình được focus
    useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

    return { ...state, refresh: fetch };
}

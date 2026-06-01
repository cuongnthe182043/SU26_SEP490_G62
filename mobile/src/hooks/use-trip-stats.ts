import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

type TripStats = {
    today_total: number;
    today_completed: number;
    month_completed: number;
};

type State = {
    stats: TripStats | null;
    isLoading: boolean;
};

export function useTripStats() {
    const [state, setState] = useState<State>({ stats: null, isLoading: true });

    const fetch = useCallback(async () => {
        setState((s) => ({ ...s, isLoading: true }));
        try {
            const { stats } = await apiClient.get<{ stats: TripStats }>('/api/trips/stats');
            setState({ stats, isLoading: false });
        } catch {
            setState({ stats: null, isLoading: false });
        }
    }, []);

    useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

    return { ...state, refresh: fetch };
}

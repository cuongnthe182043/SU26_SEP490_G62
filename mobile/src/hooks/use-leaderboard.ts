import { useCallback, useState } from 'react';
import { kpiService } from '@/services/kpi-service';
import type { LeaderboardResponse } from '@/services/kpi-service';

type State = {
    data: LeaderboardResponse | null;
    isLoading: boolean;
    error: string | null;
};

export function useLeaderboard(month: number, year: number) {
    const [state, setState] = useState<State>({ data: null, isLoading: true, error: null });

    const load = useCallback(async () => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            const data = await kpiService.getLeaderboard({ month, year });
            setState({ data, isLoading: false, error: null });
        } catch (err) {
            setState({ data: null, isLoading: false, error: err instanceof Error ? err.message : 'Không thể tải bảng xếp hạng' });
        }
    }, [month, year]);

    return { ...state, reload: load };
}

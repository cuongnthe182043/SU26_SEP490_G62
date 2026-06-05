import { useCallback, useState } from 'react';
import { kpiService } from '@/services/kpi-service';
import type { KpiRecord } from '@/services/kpi-service';

type State = {
    records: KpiRecord[];
    isLoading: boolean;
    error: string | null;
};

export function useKpi(month: number, year: number) {
    const [state, setState] = useState<State>({ records: [], isLoading: true, error: null });

    const load = useCallback(async () => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            const { kpi } = await kpiService.getMyKPI({ month, year });
            setState({ records: kpi, isLoading: false, error: null });
        } catch (err) {
            setState({ records: [], isLoading: false, error: err instanceof Error ? err.message : 'Không thể tải KPI' });
        }
    }, [month, year]);

    return { ...state, reload: load };
}

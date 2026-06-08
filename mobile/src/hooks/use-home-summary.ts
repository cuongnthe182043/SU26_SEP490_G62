import { useCallback, useState } from 'react';
import { debtService }     from '@/services/debt-service';
import { incidentService } from '@/services/incident-service';

type HomeSummaryState = {
    debt_remaining: number;
    open_incident_count: number;
    closed_incident_count: number;
    isLoading: boolean;
};

export function useHomeSummary() {
    const [state, setState] = useState<HomeSummaryState>({
        debt_remaining:       0,
        open_incident_count:  0,
        closed_incident_count: 0,
        isLoading: true,
    });

    const load = useCallback(async () => {
        setState((s) => ({ ...s, isLoading: true }));
        try {
            const [summary, counts] = await Promise.all([
                debtService.getSummary(),
                incidentService.getCounts(),
            ]);
            setState({
                debt_remaining:        Number(summary.total_remaining ?? 0),
                open_incident_count:   counts.open_count,
                closed_incident_count: counts.closed_count,
                isLoading: false,
            });
        } catch {
            setState((s) => ({ ...s, isLoading: false }));
        }
    }, []);

    return { ...state, reload: load };
}

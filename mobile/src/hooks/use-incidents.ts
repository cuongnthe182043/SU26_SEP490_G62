import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { incidentService } from '@/services/incident-service';
import type { Incident, IncidentPagination } from '@/types/incident';

type State = {
    incidents: Incident[];
    pagination: IncidentPagination | null;
    isLoading: boolean;
    error: string | null;
};

export function useIncidents() {
    const [state, setState] = useState<State>({
        incidents: [],
        pagination: null,
        isLoading: true,
        error: null,
    });

    const load = useCallback(async (showSpinner = true) => {
        setState((s) => ({ ...s, isLoading: showSpinner || s.incidents.length === 0, error: null }));
        try {
            const data = await incidentService.getMyIncidents(1, 50);
            setState({ incidents: data.incidents, pagination: data.pagination, isLoading: false, error: null });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể tải lịch sử sự cố';
            setState((s) => ({ ...s, isLoading: false, error: message }));
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    return { ...state, refresh: (spinner?: boolean) => load(spinner) };
}

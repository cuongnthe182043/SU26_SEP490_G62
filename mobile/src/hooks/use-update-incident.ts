import { useState } from 'react';
import { incidentService } from '@/services/incident-service';
import type { UpdateIncidentPayload } from '@/services/incident-service';
import type { Incident } from '@/types/incident';

type State = {
    isSubmitting: boolean;
    error: string | null;
};

export function useUpdateIncident(onSuccess?: (incident: Incident) => void) {
    const [state, setState] = useState<State>({ isSubmitting: false, error: null });

    const update = async (id: number, payload: UpdateIncidentPayload) => {
        setState({ isSubmitting: true, error: null });
        try {
            const { incident } = await incidentService.updateIncident(id, payload);
            setState({ isSubmitting: false, error: null });
            onSuccess?.(incident);
            return incident;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể cập nhật sự cố';
            setState({ isSubmitting: false, error: message });
            return null;
        }
    };

    const clearError = () => setState((s) => ({ ...s, error: null }));

    return { ...state, update, clearError };
}

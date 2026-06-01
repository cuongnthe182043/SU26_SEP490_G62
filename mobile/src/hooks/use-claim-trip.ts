import { useState } from 'react';
import { tripService } from '@/services/trip-service';
import type { ActiveTrip } from '@/types/trip';

type State = {
    isLoading: boolean;
    error: string | null;
};

export function useClaimTrip(onSuccess?: (trip: ActiveTrip) => void) {
    const [state, setState] = useState<State>({ isLoading: false, error: null });

    const claim = async (tripId: number) => {
        setState({ isLoading: true, error: null });
        try {
            const { trip } = await tripService.claim(tripId);
            setState({ isLoading: false, error: null });
            onSuccess?.(trip);
            return trip;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể nhận chuyến';
            setState({ isLoading: false, error: message });
            return null;
        }
    };

    const clearError = () => setState((s) => ({ ...s, error: null }));

    return { ...state, claim, clearError };
}

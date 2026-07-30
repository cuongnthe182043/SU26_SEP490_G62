import { useState } from 'react';
import { tripService } from '@/services/trip-service';
import type { ActiveTrip, TripStatus } from '@/types/trip';

type State = {
    isLoading: boolean;
    error: string | null;
};

export function useTripLifecycle(onSuccess?: (trip: ActiveTrip) => void) {
    const [state, setState] = useState<State>({ isLoading: false, error: null });

    // reason: bắt buộc khi nextStatus = 'failed' (BE trả 422 nếu thiếu)
    const advance = async (tripId: number, nextStatus: TripStatus, reason?: string) => {
        setState({ isLoading: true, error: null });
        try {
            const { trip } = await tripService.updateStatus(tripId, nextStatus, reason);
            setState({ isLoading: false, error: null });
            onSuccess?.(trip);
            return trip;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể cập nhật trạng thái';
            setState({ isLoading: false, error: message });
            return null;
        }
    };

    const clearError = () => setState((s) => ({ ...s, error: null }));

    return { ...state, advance, clearError };
}

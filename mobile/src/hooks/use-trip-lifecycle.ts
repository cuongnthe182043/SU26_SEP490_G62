import { useState } from 'react';
import { tripService } from '@/services/trip-service';
import type { ActiveTrip, TripStatus } from '@/types/trip';

type State = {
    isLoading: boolean;
    error: string | null;
};

export function useTripLifecycle(
    onSuccess?: (trip: ActiveTrip) => void,
    onUndone?: (trip: ActiveTrip) => void,
) {
    const [state, setState] = useState<State>({ isLoading: false, error: null });

    // reason: bắt buộc khi nextStatus = 'failed' (BE trả 422 nếu thiếu)
    // version: gửi kèm để server chặn ghi đè khi màn hình đang cầm dữ liệu cũ
    const advance = async (tripId: number, nextStatus: TripStatus, reason?: string, version?: number) => {
        setState({ isLoading: true, error: null });
        try {
            const { trip } = await tripService.updateStatus(tripId, nextStatus, reason, version);
            setState({ isLoading: false, error: null });
            onSuccess?.(trip);
            return trip;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể cập nhật trạng thái';
            setState({ isLoading: false, error: message });
            return null;
        }
    };

    const undo = async (tripId: number, version: number) => {
        setState({ isLoading: true, error: null });
        try {
            const { trip } = await tripService.undo(tripId, version);
            setState({ isLoading: false, error: null });
            onUndone?.(trip);
            return trip;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không hoàn tác được';
            setState({ isLoading: false, error: message });
            return null;
        }
    };

    const clearError = () => setState((s) => ({ ...s, error: null }));

    return { ...state, advance, undo, clearError };
}

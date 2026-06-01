import { useState } from 'react';
import { tripService } from '@/services/trip-service';
import type { ActiveTrip } from '@/types/trip';

export function useCancelDelivery(onSuccess?: (trip: ActiveTrip) => void) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cancelDelivery = async (tripId: number, reason: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const { trip } = await tripService.cancelDelivery(tripId, reason);
            setIsLoading(false);
            onSuccess?.(trip);
            return trip;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể xử lý yêu cầu';
            setIsLoading(false);
            setError(message);
            return null;
        }
    };

    return { isLoading, error, cancelDelivery };
}

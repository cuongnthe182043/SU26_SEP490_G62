import { useState } from 'react';
import { tripService } from '@/services/trip-service';

export function useReleaseTrip(onSuccess?: () => void) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const releaseTrip = async (tripId: number, reason?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            await tripService.releaseTrip(tripId, reason);
            setIsLoading(false);
            onSuccess?.();
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể hủy chuyến';
            setIsLoading(false);
            setError(message);
            return false;
        }
    };

    return { isLoading, error, releaseTrip };
}

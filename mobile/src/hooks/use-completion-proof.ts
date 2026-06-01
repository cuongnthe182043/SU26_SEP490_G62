import { useState } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { tripService } from '@/services/trip-service';
import type { ActiveTrip } from '@/types/trip';

type State = {
    isUploading: boolean;
    error: string | null;
};

export function useCompletionProof(onSuccess?: (trip: ActiveTrip) => void) {
    const [state, setState] = useState<State>({ isUploading: false, error: null });

    const completeWithProof = async (tripId: number, photoUri: string) => {
        setState({ isUploading: true, error: null });
        try {
            // Resize + compress before upload
            const compressed = await ImageManipulator.manipulateAsync(
                photoUri,
                [{ resize: { width: 1200 } }],
                { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
            );

            const formData = new FormData();
            formData.append('proof', {
                uri: compressed.uri,
                type: 'image/jpeg',
                name: 'proof.jpg',
            } as unknown as Blob);

            const { trip } = await tripService.completeWithProof(tripId, formData);
            setState({ isUploading: false, error: null });
            onSuccess?.(trip);
            return trip;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể hoàn thành chuyến';
            setState({ isUploading: false, error: message });
            return null;
        }
    };

    // For non-final shipments (no proof required)
    const completeNoProof = async (tripId: number) => {
        setState({ isUploading: true, error: null });
        try {
            const { trip } = await tripService.completeNoProof(tripId);
            setState({ isUploading: false, error: null });
            onSuccess?.(trip);
            return trip;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể hoàn thành chuyến';
            setState({ isUploading: false, error: message });
            return null;
        }
    };

    const clearError = () => setState((s) => ({ ...s, error: null }));

    return { ...state, completeWithProof, completeNoProof, clearError };
}

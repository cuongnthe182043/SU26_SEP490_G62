import { useState } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { tripService } from '@/services/trip-service';
import type { ActiveTrip } from '@/types/trip';

type State = {
    isUploading: boolean;
    error: string | null;
};

async function compressImage(uri: string): Promise<string> {
    const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
}

export function useCompletionProof(onSuccess?: (trip: ActiveTrip) => void) {
    const [state, setState] = useState<State>({ isUploading: false, error: null });

    /**
     * receiptUri — ảnh biên lai trip (bắt buộc mọi trip)
     * proofUri   — ảnh xác nhận hoàn thành order (chỉ bắt buộc final trip)
     */
    const completeWithProof = async (tripId: number, receiptUri: string, proofUri?: string) => {
        setState({ isUploading: true, error: null });
        try {
            const [compressedReceipt, compressedProof] = await Promise.all([
                compressImage(receiptUri),
                proofUri ? compressImage(proofUri) : Promise.resolve(null),
            ]);

            const formData = new FormData();
            formData.append('receipt', {
                uri: compressedReceipt,
                type: 'image/jpeg',
                name: 'receipt.jpg',
            } as unknown as Blob);

            if (compressedProof) {
                formData.append('proof', {
                    uri: compressedProof,
                    type: 'image/jpeg',
                    name: 'proof.jpg',
                } as unknown as Blob);
            }

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

    const clearError = () => setState((s) => ({ ...s, error: null }));

    return { ...state, completeWithProof, clearError };
}

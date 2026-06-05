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

    // proofUri   — ảnh xác nhận giao hàng (bắt buộc, BR-015/016/017)
    // receiptUri — ảnh biên lai/hóa đơn có chữ ký khách (bắt buộc)
    const completeWithProof = async (tripId: number, proofUri: string, receiptUri: string) => {
        setState({ isUploading: true, error: null });
        try {
            const [compressedProof, compressedReceipt] = await Promise.all([
                compressImage(proofUri),
                compressImage(receiptUri),
            ]);

            const formData = new FormData();
            formData.append('proof', {
                uri: compressedProof,
                type: 'image/jpeg',
                name: 'proof.jpg',
            } as unknown as Blob);
            formData.append('receipt', {
                uri: compressedReceipt,
                type: 'image/jpeg',
                name: 'receipt.jpg',
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

    const clearError = () => setState((s) => ({ ...s, error: null }));

    return { ...state, completeWithProof, clearError };
}

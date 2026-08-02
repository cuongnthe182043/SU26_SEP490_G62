import { useState } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { tripService } from '@/services/trip-service';
import { sendOrQueue } from '@/lib/send-or-queue';
import type { ActiveTrip } from '@/types/trip';

type State = {
    isUploading: boolean;
    error: string | null;
    /** true khi mất mạng và thao tác đã được cất vào hàng đợi để gửi sau */
    daXepHang: boolean;
};

async function compressImage(uri: string): Promise<string> {
    const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
}

export function useCompletionProof(onSuccess?: (completedTrip: ActiveTrip) => void) {
    const [state, setState] = useState<State>({ isUploading: false, error: null, daXepHang: false });

    // proofUri — ảnh xác nhận giao hàng (bắt buộc, BR-015/016/017)
    // Ảnh biên lai được chụp riêng ở màn hình receipt-request (BR-008A/B)
    const completeWithProof = async (tripId: number, proofUri: string) => {
        setState({ isUploading: true, error: null, daXepHang: false });
        try {
            const compressedProof = await compressImage(proofUri);

            const formData = new FormData();
            formData.append('proof', {
                uri: compressedProof,
                type: 'image/jpeg',
                name: 'proof.jpg',
            } as unknown as Blob);

            // Mất mạng → cất ảnh vào hàng đợi thay vì báo lỗi và làm tài mất ảnh
            const kq = await sendOrQueue(
                () => tripService.completeWithProof(tripId, formData),
                {
                    path: `/api/trips/${tripId}/complete`,
                    photoUri: compressedProof,
                    photoField: 'proof',
                    label: `Xác nhận giao hàng chuyến #${tripId}`,
                },
            );

            if (kq.sent) {
                setState({ isUploading: false, error: null, daXepHang: false });
                onSuccess?.(kq.result.trip);
            } else {
                setState({ isUploading: false, error: null, daXepHang: true });
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể hoàn thành chuyến';
            setState({ isUploading: false, error: message, daXepHang: false });
        }
    };

    const clearError = () => setState((s) => ({ ...s, error: null, daXepHang: false }));

    return { ...state, completeWithProof, clearError };
}

import { useState } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { tripService } from '@/services/trip-service';
import { sendOrQueue } from '@/lib/send-or-queue';
import type { ActiveTrip } from '@/types/trip';

type State = { isUploading: boolean; error: string | null; daXepHang: boolean };

async function compress(uri: string): Promise<string> {
    const r = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
    );
    return r.uri;
}

// RETURNING → COMPLETED: ảnh hoàn hàng BẮT BUỘC — nút gọi hàm này bị disable ở UI khi
// chưa có ảnh (xem active-trip-screen.tsx), backend cũng từ chối nếu thiếu (400).
export function useReturnComplete(onSuccess?: (trip: ActiveTrip) => void) {
    const [state, setState] = useState<State>({ isUploading: false, error: null, daXepHang: false });

    const completeReturn = async (tripId: number, photoUri?: string | null) => {
        setState({ isUploading: true, error: null, daXepHang: false });
        try {
            let formData: FormData | null = null;
            let compressedPhoto: string | null = null;
            if (photoUri) {
                compressedPhoto = await compress(photoUri);
                formData = new FormData();
                formData.append('proof', { uri: compressedPhoto, type: 'image/jpeg', name: 'return.jpg' } as unknown as Blob);
            }

            // Mất mạng → cất ảnh hoàn hàng vào hàng đợi
            const kq = await sendOrQueue(
                () => tripService.returnComplete(tripId, formData),
                {
                    path: `/api/trips/${tripId}/return-complete`,
                    photoUri: compressedPhoto,
                    photoField: 'proof',
                    label: `Xác nhận hoàn hàng chuyến #${tripId}`,
                },
            );

            if (!kq.sent) {
                setState({ isUploading: false, error: null, daXepHang: true });
                return null;
            }
            setState({ isUploading: false, error: null, daXepHang: false });
            onSuccess?.(kq.result.trip);
            return kq.result.trip;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể hoàn thành hoàn hàng';
            setState({ isUploading: false, error: message, daXepHang: false });
            return null;
        }
    };

    const clearError = () => setState(s => ({ ...s, error: null, daXepHang: false }));
    return { ...state, completeReturn, clearError };
}

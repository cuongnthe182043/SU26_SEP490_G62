import { useState } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { tripService } from '@/services/trip-service';
import { guiHoacXepHang } from '@/lib/gui-hoac-xep-hang';
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

// PICKING → TRANSIT: ảnh lấy hàng bắt buộc (BR-013/014)
export function useLoadingProof(onSuccess?: (trip: ActiveTrip) => void) {
    const [state, setState] = useState<State>({ isUploading: false, error: null, daXepHang: false });

    const submitLoadingProof = async (tripId: number, photoUri: string) => {
        setState({ isUploading: true, error: null, daXepHang: false });
        try {
            const compressed = await compress(photoUri);
            const formData = new FormData();
            formData.append('proof', { uri: compressed, type: 'image/jpeg', name: 'loading.jpg' } as unknown as Blob);

            // Mất mạng → cất ảnh vào hàng đợi, tài không phải quay lại chụp lại
            const kq = await guiHoacXepHang(
                () => tripService.submitLoadingProof(tripId, formData),
                {
                    path: `/api/trips/${tripId}/start-transit`,
                    photoUri: compressed,
                    photoField: 'proof',
                    label: `Xác nhận lấy hàng chuyến #${tripId}`,
                },
            );

            if (!kq.daGui) {
                setState({ isUploading: false, error: null, daXepHang: true });
                return null;
            }
            setState({ isUploading: false, error: null, daXepHang: false });
            onSuccess?.(kq.ketQua.trip);
            return kq.ketQua.trip;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể xác nhận lấy hàng';
            setState({ isUploading: false, error: message, daXepHang: false });
            return null;
        }
    };

    const clearError = () => setState(s => ({ ...s, error: null, daXepHang: false }));
    return { ...state, submitLoadingProof, clearError };
}

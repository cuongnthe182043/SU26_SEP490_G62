import { useState } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { tripService } from '@/services/trip-service';

type State = { isLoading: boolean; error: string | null };

async function compress(uri: string): Promise<string> {
    const r = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
    );
    return r.uri;
}

// TH2: Khách trả tiền mặt cho driver → ghi nhận + tạo driver debt
export function useRecordPayment(onSuccess?: () => void) {
    const [state, setState] = useState<State>({ isLoading: false, error: null });

    const recordPayment = async (tripId: number, amount: number, receiptUri: string, notes?: string) => {
        if (!amount || amount <= 0) {
            setState(s => ({ ...s, error: 'Số tiền phải lớn hơn 0' }));
            return null;
        }
        if (!receiptUri) {
            setState(s => ({ ...s, error: 'Ảnh biên lai là bắt buộc' }));
            return null;
        }
        setState({ isLoading: true, error: null });
        try {
            const compressed = await compress(receiptUri);
            const formData = new FormData();
            formData.append('receipt', { uri: compressed, type: 'image/jpeg', name: 'receipt.jpg' } as unknown as Blob);
            formData.append('amount', String(amount));
            if (notes) formData.append('notes', notes);

            const result = await tripService.recordPayment(tripId, formData);
            setState({ isLoading: false, error: null });
            onSuccess?.();
            return result;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể ghi nhận thanh toán';
            setState({ isLoading: false, error: message });
            return null;
        }
    };

    const clearError = () => setState(s => ({ ...s, error: null }));
    return { ...state, recordPayment, clearError };
}

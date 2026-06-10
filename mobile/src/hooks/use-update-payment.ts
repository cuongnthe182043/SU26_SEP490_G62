import { useState } from 'react';
import { tripService } from '@/services/trip-service';
import type { ShipmentPayment } from '@/types/trip';

type State = { isLoading: boolean; error: string | null };

export function useUpdatePayment(onSuccess?: () => void) {
    const [state, setState] = useState<State>({ isLoading: false, error: null });

    const updatePayment = async (
        tripId: number,
        paymentId: number,
        amount: number,
        newReceiptUri?: string | null,
        notes?: string,
    ): Promise<ShipmentPayment | null> => {
        if (!amount || amount <= 0) {
            setState(s => ({ ...s, error: 'Số tiền phải lớn hơn 0' }));
            return null;
        }
        setState({ isLoading: true, error: null });
        try {
            const formData = new FormData();
            formData.append('amount', String(amount));
            if (notes?.trim()) formData.append('notes', notes.trim());
            if (newReceiptUri) {
                formData.append('receipt', {
                    uri: newReceiptUri,
                    type: 'image/jpeg',
                    name: 'receipt.jpg',
                } as unknown as Blob);
            }
            const result = await tripService.updatePayment(tripId, paymentId, formData);
            setState({ isLoading: false, error: null });
            onSuccess?.();
            return result.payment;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể cập nhật ghi nhận';
            setState({ isLoading: false, error: message });
            return null;
        }
    };

    const clearError = () => setState(s => ({ ...s, error: null }));
    return { ...state, updatePayment, clearError };
}

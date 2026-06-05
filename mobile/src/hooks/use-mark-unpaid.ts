import { useState } from 'react';
import { tripService } from '@/services/trip-service';

type State = { isLoading: boolean; error: string | null };

// TH3: Driver báo khách chưa trả tiền → tạo customer debt
export function useMarkUnpaid(onSuccess?: () => void) {
    const [state, setState] = useState<State>({ isLoading: false, error: null });

    const markUnpaid = async (tripId: number, amount: number, notes?: string) => {
        if (!amount || amount <= 0) {
            setState(s => ({ ...s, error: 'Số tiền phải lớn hơn 0' }));
            return null;
        }
        setState({ isLoading: true, error: null });
        try {
            const result = await tripService.markUnpaid(tripId, amount, notes);
            setState({ isLoading: false, error: null });
            onSuccess?.();
            return result;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể ghi nhận công nợ';
            setState({ isLoading: false, error: message });
            return null;
        }
    };

    const clearError = () => setState(s => ({ ...s, error: null }));
    return { ...state, markUnpaid, clearError };
}

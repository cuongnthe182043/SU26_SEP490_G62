import { useCallback, useState } from 'react';
import { billService } from '@/services/bill-service';
import type { Bill, BillSummary, BillStatus, CreateBillPayload } from '@/services/bill-service';

// ─── List + summary ───────────────────────────────────────────────────────────

type ListState = {
    bills: Bill[];
    summary: BillSummary | null;
    isLoading: boolean;
    error: string | null;
};

export function useBill(filters: { status?: BillStatus } = {}) {
    const [state, setState] = useState<ListState>({
        bills: [],
        summary: null,
        isLoading: true,
        error: null,
    });

    const load = useCallback(async () => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            const [{ bills }, summary] = await Promise.all([
                billService.getMyBills(filters),
                billService.getSummary(),
            ]);
            setState({ bills, summary, isLoading: false, error: null });
        } catch (err) {
            setState((s) => ({
                ...s,
                isLoading: false,
                error: err instanceof Error ? err.message : 'Không thể tải danh sách bill',
            }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { ...state, reload: load };
}

// ─── Create ───────────────────────────────────────────────────────────────────

type CreateState = { isSubmitting: boolean; error: string | null };

export function useCreateBill() {
    const [state, setState] = useState<CreateState>({ isSubmitting: false, error: null });

    const submit = useCallback(async (payload: CreateBillPayload): Promise<boolean> => {
        setState({ isSubmitting: true, error: null });
        try {
            await billService.create(payload);
            setState({ isSubmitting: false, error: null });
            return true;
        } catch (err) {
            setState({
                isSubmitting: false,
                error: err instanceof Error ? err.message : 'Tạo bill thất bại',
            });
            return false;
        }
    }, []);

    return { ...state, submit };
}

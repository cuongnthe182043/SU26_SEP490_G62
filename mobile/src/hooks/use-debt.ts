import { useCallback, useState } from 'react';
import { debtService } from '@/services/debt-service';
import type { DriverDebt, DebtSummary, DebtPayment, RemitPayload } from '@/services/debt-service';

// ─── Debt list + summary ──────────────────────────────────────────────────────

type DebtState = {
    debts: DriverDebt[];
    summary: DebtSummary | null;
    isLoading: boolean;
    error: string | null;
};

export function useDebt() {
    const [state, setState] = useState<DebtState>({
        debts: [],
        summary: null,
        isLoading: true,
        error: null,
    });

    const load = useCallback(async () => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            const [{ debts }, summary] = await Promise.all([
                debtService.getMyDebts(),
                debtService.getSummary(),
            ]);
            setState({ debts, summary, isLoading: false, error: null });
        } catch (err) {
            setState((s) => ({
                ...s,
                isLoading: false,
                error: err instanceof Error ? err.message : 'Không thể tải dữ liệu công nợ',
            }));
        }
    }, []);

    return { ...state, reload: load };
}

// ─── Payment history for a single debt ───────────────────────────────────────

type PaymentState = {
    payments: DebtPayment[];
    isLoading: boolean;
    error: string | null;
};

export function useDebtPayments(debtId: number) {
    const [state, setState] = useState<PaymentState>({
        payments: [],
        isLoading: false,
        error: null,
    });

    const load = useCallback(async () => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            const { payments } = await debtService.getPayments(debtId);
            setState({ payments, isLoading: false, error: null });
        } catch (err) {
            setState((s) => ({
                ...s,
                isLoading: false,
                error: err instanceof Error ? err.message : 'Không thể tải lịch sử nộp tiền',
            }));
        }
    }, [debtId]);

    return { ...state, reload: load };
}

// ─── Remit action ─────────────────────────────────────────────────────────────

type RemitState = {
    isSubmitting: boolean;
    error: string | null;
};

export function useRemitDebt() {
    const [state, setState] = useState<RemitState>({ isSubmitting: false, error: null });

    const submit = useCallback(
        async (debtId: number, payload: RemitPayload): Promise<boolean> => {
            setState({ isSubmitting: true, error: null });
            try {
                await debtService.remit(debtId, payload);
                setState({ isSubmitting: false, error: null });
                return true;
            } catch (err) {
                setState({
                    isSubmitting: false,
                    error: err instanceof Error ? err.message : 'Báo nộp tiền thất bại',
                });
                return false;
            }
        },
        [],
    );

    return { ...state, submit };
}

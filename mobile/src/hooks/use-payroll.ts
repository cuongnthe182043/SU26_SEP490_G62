import { useCallback, useState } from 'react';
import { payrollService } from '@/services/payroll-service';
import type { Payroll, PayrollEstimate, SalaryAdvance } from '@/services/payroll-service';

// ─── Payroll history ──────────────────────────────────────────────────────────

type PayrollState = { payrolls: Payroll[]; isLoading: boolean; error: string | null };

export function usePayroll() {
    const [state, setState] = useState<PayrollState>({ payrolls: [], isLoading: true, error: null });

    const load = useCallback(async () => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            const { payrolls } = await payrollService.getMyPayrolls();
            setState({ payrolls, isLoading: false, error: null });
        } catch (err) {
            setState((s) => ({
                ...s,
                isLoading: false,
                error: err instanceof Error ? err.message : 'Không thể tải lịch sử lương',
            }));
        }
    }, []);

    return { ...state, reload: load };
}

// ─── Payroll estimate ─────────────────────────────────────────────────────────

type EstimateState = { estimate: PayrollEstimate | null; isLoading: boolean; error: string | null };

export function usePayrollEstimate(month: number, year: number) {
    const [state, setState] = useState<EstimateState>({ estimate: null, isLoading: true, error: null });

    const load = useCallback(async () => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            const data = await payrollService.getEstimate(month, year);
            setState({ estimate: data, isLoading: false, error: null });
        } catch (err) {
            setState((s) => ({
                ...s,
                isLoading: false,
                error: err instanceof Error ? err.message : 'Không thể tính lương',
            }));
        }
    }, [month, year]);

    return { ...state, reload: load };
}

// ─── Salary advances ──────────────────────────────────────────────────────────

type AdvanceState = {
    advances: SalaryAdvance[];
    isLoading: boolean;
    isSubmitting: boolean;
    error: string | null;
};

export function useSalaryAdvance() {
    const [state, setState] = useState<AdvanceState>({
        advances: [], isLoading: false, isSubmitting: false, error: null,
    });

    const load = useCallback(async () => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            const { advances } = await payrollService.getAdvances();
            setState((s) => ({ ...s, advances, isLoading: false }));
        } catch (err) {
            setState((s) => ({
                ...s, isLoading: false,
                error: err instanceof Error ? err.message : 'Không thể tải ứng lương',
            }));
        }
    }, []);

    const request = useCallback(async (payload: {
        amount: number;
        reason?: string;
        requestMonth: number;
        requestYear: number;
    }): Promise<boolean> => {
        setState((s) => ({ ...s, isSubmitting: true, error: null }));
        try {
            await payrollService.requestAdvance(payload);
            setState((s) => ({ ...s, isSubmitting: false }));
            return true;
        } catch (err) {
            setState((s) => ({
                ...s, isSubmitting: false,
                error: err instanceof Error ? err.message : 'Yêu cầu ứng lương thất bại',
            }));
            return false;
        }
    }, []);

    return { ...state, load, request };
}

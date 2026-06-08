import { useCallback, useState } from 'react';
import { leaveService } from '@/services/leave-service';
import type { LeaveRequest, AttendanceSummary, LeaveType } from '@/services/leave-service';

// ─── Leave list + summary ─────────────────────────────────────────────────────

type LeaveState = {
    leaves: LeaveRequest[];
    summary: AttendanceSummary | null;
    isLoading: boolean;
    error: string | null;
};

export function useLeave(month: number, year: number) {
    const [state, setState] = useState<LeaveState>({
        leaves: [], summary: null, isLoading: true, error: null,
    });

    const load = useCallback(async () => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            const [{ leaves }, summary] = await Promise.all([
                leaveService.getMyLeaves({ month, year }),
                leaveService.getSummary(month, year),
            ]);
            setState({ leaves, summary, isLoading: false, error: null });
        } catch (err) {
            setState((s) => ({
                ...s,
                isLoading: false,
                error: err instanceof Error ? err.message : 'Không thể tải dữ liệu',
            }));
        }
    }, [month, year]);

    return { ...state, reload: load };
}

// ─── Create leave ─────────────────────────────────────────────────────────────

type SubmitState = { isSubmitting: boolean; error: string | null };

export function useCreateLeave() {
    const [state, setState] = useState<SubmitState>({ isSubmitting: false, error: null });

    const submit = useCallback(async (payload: {
        leaveDate: string;
        leaveType: LeaveType;
        reason?: string;
    }): Promise<boolean> => {
        setState({ isSubmitting: true, error: null });
        try {
            await leaveService.create(payload);
            setState({ isSubmitting: false, error: null });
            return true;
        } catch (err) {
            setState({
                isSubmitting: false,
                error: err instanceof Error ? err.message : 'Đăng ký nghỉ thất bại',
            });
            return false;
        }
    }, []);

    return { ...state, submit };
}

// ─── Delete leave ─────────────────────────────────────────────────────────────

export function useDeleteLeave() {
    const [isDeleting, setIsDeleting] = useState(false);

    const remove = useCallback(async (id: number): Promise<boolean> => {
        setIsDeleting(true);
        try {
            await leaveService.delete(id);
            return true;
        } catch {
            return false;
        } finally {
            setIsDeleting(false);
        }
    }, []);

    return { isDeleting, remove };
}

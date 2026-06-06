import { useCallback, useState } from 'react';
import { cashCollectionService } from '@/services/cash-collection-service';
import type {
    CashCollection, CollectionSummary, CollectionStatus, CreateCollectionPayload,
} from '@/services/cash-collection-service';

// ─── List + summary ───────────────────────────────────────────────────────────

type ListState = {
    collections: CashCollection[];
    summary: CollectionSummary | null;
    isLoading: boolean;
    error: string | null;
};

export function useCashCollection(filters: { status?: CollectionStatus } = {}) {
    const [state, setState] = useState<ListState>({
        collections: [],
        summary: null,
        isLoading: true,
        error: null,
    });

    const load = useCallback(async () => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            const [{ collections }, summary] = await Promise.all([
                cashCollectionService.getMyCollections(filters),
                cashCollectionService.getSummary(),
            ]);
            setState({ collections, summary, isLoading: false, error: null });
        } catch (err) {
            setState((s) => ({
                ...s,
                isLoading: false,
                error: err instanceof Error ? err.message : 'Không thể tải dữ liệu thu hộ',
            }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { ...state, reload: load };
}

// ─── Create ───────────────────────────────────────────────────────────────────

type CreateState = { isSubmitting: boolean; error: string | null };

export function useCreateCollection() {
    const [state, setState] = useState<CreateState>({ isSubmitting: false, error: null });

    const submit = useCallback(async (payload: CreateCollectionPayload): Promise<boolean> => {
        setState({ isSubmitting: true, error: null });
        try {
            await cashCollectionService.create(payload);
            setState({ isSubmitting: false, error: null });
            return true;
        } catch (err) {
            setState({
                isSubmitting: false,
                error: err instanceof Error ? err.message : 'Báo thu hộ thất bại',
            });
            return false;
        }
    }, []);

    return { ...state, submit };
}

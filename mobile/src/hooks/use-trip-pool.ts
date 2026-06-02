import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { tripService } from '@/services/trip-service';
import type { TripPoolItem, VehicleGroup } from '@/types/trip';

const POLL_MS = 10_000;

type State = {
    allTrips: TripPoolItem[];
    vehicleGroups: VehicleGroup[];
    isLoading: boolean;
    error: string | null;
};

export function useTripPool() {
    const [state, setState] = useState<State>({ allTrips: [], vehicleGroups: [], isLoading: true, error: null });
    const [groupFilter, setGroupFilter] = useState<number | null>(null);
    const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    // showSpinner=true only on first load / manual pull-to-refresh
    const fetchAll = useCallback(async (showSpinner = true) => {
        if (showSpinner) setState((s) => ({ ...s, isLoading: true, error: null }));
        try {
            const { trips, vehicleGroups } = await tripService.getPool();
            setState((s) => ({ ...s, allTrips: trips ?? [], vehicleGroups: vehicleGroups ?? [], isLoading: false, error: null }));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không thể tải danh sách';
            setState((s) => ({ ...s, isLoading: false, ...(showSpinner ? { error: message } : {}) }));
        }
    }, []);

    // Xóa ngay một order khỏi danh sách (optimistic update khi claim)
    const removeOrder = useCallback((orderId: number) => {
        setState((s) => ({ ...s, allTrips: s.allTrips.filter((t) => t.order_id !== orderId) }));
    }, []);

    const startPolling = useCallback(() => {
        if (pollTimer.current) clearInterval(pollTimer.current);
        pollTimer.current = setInterval(() => fetchAll(false), POLL_MS);
    }, [fetchAll]);

    const stopPolling = useCallback(() => {
        if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    }, []);

    useEffect(() => {
        fetchAll(true);
        startPolling();
        return stopPolling;
    }, [fetchAll, startPolling, stopPolling]);

    // Dừng polling khi app bị đưa xuống nền, tiếp tục khi quay lại
    useEffect(() => {
        const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
            if (next === 'active') { fetchAll(false); startPolling(); }
            else stopPolling();
        });
        return () => sub.remove();
    }, [fetchAll, startPolling, stopPolling]);

    // Ưu tiên groups từ API (đầy đủ, ổn định).
    // Fallback: derive từ pool data nếu API chưa trả về (backend cũ / đang load).
    const vehicleGroups = useMemo<VehicleGroup[]>(() => {
        if (state.vehicleGroups.length > 0) return state.vehicleGroups;
        const seen = new Map<number, string>();
        for (const t of state.allTrips) seen.set(t.vehicle_group_id, t.vehicle_group_name);
        return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
    }, [state.vehicleGroups, state.allTrips]);

    // Danh sách sau khi lọc
    const trips = useMemo(
        () => groupFilter !== null
            ? state.allTrips.filter((t) => t.vehicle_group_id === groupFilter)
            : state.allTrips,
        [state.allTrips, groupFilter],
    );

    return {
        trips,
        totalCount: state.allTrips.length,
        vehicleGroups,
        groupFilter,
        setGroupFilter,
        isLoading: state.isLoading,
        error: state.error,
        refresh: fetchAll,
        removeOrder,
    };
}

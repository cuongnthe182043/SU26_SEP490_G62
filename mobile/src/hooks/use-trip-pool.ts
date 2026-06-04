import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { ERROR_MESSAGES } from '@/constants/error-messages';
import { tripService }    from '@/services/trip-service';
import type { TripPoolItem, VehicleGroup } from '@/types/trip';

const PAGE_SIZE = 5;
const POLL_MS   = 10_000;

type State = {
    trips:         TripPoolItem[];
    vehicleGroups: VehicleGroup[];
    total:         number;
    page:          number;
    totalPages:    number;
    isLoading:     boolean;
    error:         string | null;
};

export function useTripPool() {
    const [state, setState] = useState<State>({
        trips:         [],
        vehicleGroups: [],
        total:         0,
        page:          1,
        totalPages:    1,
        isLoading:     true,
        error:         null,
    });
    const [groupFilter, setGroupFilterRaw] = useState<number | null>(null);
    const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    // Refs để polling luôn dùng giá trị mới nhất mà không recreate callback
    const pageRef         = useRef(1);
    const groupFilterRef  = useRef<number | null>(null);

    const fetch = useCallback(async (page: number, groupId: number | null, showSpinner = true) => {
        if (showSpinner) {
            setState((s) => ({ ...s, isLoading: true, error: null }));
        }
        try {
            const data = await tripService.getPool(page, PAGE_SIZE, groupId ?? undefined);
            const pagination = data.pagination;
            const allTrips = data.trips ?? [];
            const total = data.total ?? pagination?.total ?? allTrips.length;
            const pageFromApi = data.page ?? pagination?.page ?? page;
            const totalPagesFromApi = data.totalPages ?? pagination?.totalPages ?? Math.ceil(total / PAGE_SIZE);
            const totalPagesFromRows = Math.ceil(allTrips.length / PAGE_SIZE);
            const totalPages = Math.max(1, totalPagesFromApi, totalPagesFromRows);
            const currentPage = Math.min(Math.max(1, pageFromApi), totalPages);
            const visibleTrips = allTrips.length > PAGE_SIZE
                ? allTrips.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                : allTrips;
            setState((s) => ({
                ...s,
                trips:         visibleTrips,
                vehicleGroups: data.vehicleGroups ?? s.vehicleGroups,
                total,
                page:          currentPage,
                totalPages,
                isLoading:     false,
                error:         null,
            }));
        } catch (err) {
            const message = err instanceof Error ? err.message : ERROR_MESSAGES.tripPoolLoadFailed;
            setState((s) => ({
                ...s,
                isLoading: false,
                ...(showSpinner ? { error: message } : {}),
            }));
        }
    }, []);

    // Refresh trang hiện tại
    const refresh = useCallback((showSpinner = true) => {
        fetch(pageRef.current, groupFilterRef.current, showSpinner);
    }, [fetch]);

    // Đổi trang
    const goToPage = useCallback((newPage: number) => {
        pageRef.current = newPage;
        fetch(newPage, groupFilterRef.current, true);
    }, [fetch]);

    // Đổi filter → reset về trang 1
    const setGroupFilter = useCallback((groupId: number | null) => {
        groupFilterRef.current = groupId;
        pageRef.current        = 1;
        setGroupFilterRaw(groupId);
        fetch(1, groupId, true);
    }, [fetch]);

    // Xóa shipment vừa claim khỏi danh sách (optimistic) rồi refresh
    const removeShipment = useCallback((shipmentId: number) => {
        setState((s) => ({
            ...s,
            trips: s.trips.filter((t) => t.shipment_id !== shipmentId),
            total: Math.max(0, s.total - 1),
        }));
        // Refresh ngay để bù vào slot trống nếu còn trang sau
        setTimeout(() => refresh(false), 400);
    }, [refresh]);

    // Polling
    const startPolling = useCallback(() => {
        if (pollTimer.current) clearInterval(pollTimer.current);
        pollTimer.current = setInterval(() => refresh(false), POLL_MS);
    }, [refresh]);

    const stopPolling = useCallback(() => {
        if (!pollTimer.current) return;
        clearInterval(pollTimer.current);
        pollTimer.current = null;
    }, []);

    useEffect(() => {
        fetch(1, null, true);
        startPolling();
        return stopPolling;
    }, [fetch, startPolling, stopPolling]);

    useEffect(() => {
        const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
            if (next === 'active') { refresh(false); startPolling(); }
            else                    stopPolling();
        });
        return () => sub.remove();
    }, [refresh, startPolling, stopPolling]);

    return {
        trips:        state.trips,
        vehicleGroups: state.vehicleGroups,
        total:        state.total,
        page:         state.page,
        totalPages:   state.totalPages,
        groupFilter,
        setGroupFilter,
        isLoading:    state.isLoading,
        error:        state.error,
        refresh,
        goToPage,
        removeShipment,
    };
}

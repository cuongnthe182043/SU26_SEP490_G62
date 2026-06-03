import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { ERROR_MESSAGES } from '@/constants/error-messages';
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
  const [state, setState] = useState<State>({
    allTrips: [],
    vehicleGroups: [],
    isLoading: true,
    error: null,
  });
  const [groupFilter, setGroupFilter] = useState<number | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setState((current) => ({ ...current, isLoading: true, error: null }));
    }

    try {
      const { trips, vehicleGroups } = await tripService.getPool();
      setState((current) => ({
        ...current,
        allTrips: trips ?? [],
        vehicleGroups: vehicleGroups ?? [],
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : ERROR_MESSAGES.tripPoolLoadFailed;
      setState((current) => ({
        ...current,
        isLoading: false,
        ...(showSpinner ? { error: message } : {}),
      }));
    }
  }, []);

  const removeOrder = useCallback((orderId: number) => {
    setState((current) => ({
      ...current,
      allTrips: current.allTrips.filter((trip) => trip.order_id !== orderId),
    }));
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => fetchAll(false), POLL_MS);
  }, [fetchAll]);

  const stopPolling = useCallback(() => {
    if (!pollTimer.current) return;
    clearInterval(pollTimer.current);
    pollTimer.current = null;
  }, []);

  useEffect(() => {
    fetchAll(true);
    startPolling();
    return stopPolling;
  }, [fetchAll, startPolling, stopPolling]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        fetchAll(false);
        startPolling();
      } else {
        stopPolling();
      }
    });

    return () => sub.remove();
  }, [fetchAll, startPolling, stopPolling]);

  const vehicleGroups = useMemo<VehicleGroup[]>(() => {
    if (state.vehicleGroups.length > 0) return state.vehicleGroups;

    const seen = new Map<number, string>();
    for (const trip of state.allTrips) {
      seen.set(trip.vehicle_group_id, trip.vehicle_group_name);
    }

    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [state.vehicleGroups, state.allTrips]);

  const trips = useMemo(
    () =>
      groupFilter !== null
        ? state.allTrips.filter((trip) => trip.vehicle_group_id === groupFilter)
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

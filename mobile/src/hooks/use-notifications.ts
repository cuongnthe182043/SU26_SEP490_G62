import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ERROR_MESSAGES } from '@/constants/error-messages';
import { ApiError } from '@/lib/api-error';
import { notificationService } from '@/services/notification-service';
import type { AppNotification } from '@/types/notification';

const POLL_MS = 15_000;

type State = {
  notifications: AppNotification[];
  isLoading: boolean;
  error: string | null;
};

export function useNotifications() {
  const [state, setState] = useState<State>({
    notifications: [],
    isLoading: true,
    error: null,
  });
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasLoaded = useRef(false);

  const fetchNotifications = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setState((current) => ({ ...current, isLoading: true, error: null }));
    }

    try {
      const { notifications } = await notificationService.getMyNotifications();
      setState({
        notifications: notifications ?? [],
        isLoading: false,
        error: null,
      });
      hasLoaded.current = true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setState({ notifications: [], isLoading: false, error: null });
        hasLoaded.current = true;
        return;
      }

      setState((current) => ({
        ...current,
        isLoading: false,
        error: showSpinner
          ? error instanceof Error
            ? error.message
            : ERROR_MESSAGES.notificationLoadFailed
          : current.error,
      }));
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => fetchNotifications(false), POLL_MS);
  }, [fetchNotifications]);

  const stopPolling = useCallback(() => {
    if (!pollTimer.current) return;
    clearInterval(pollTimer.current);
    pollTimer.current = null;
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications(!hasLoaded.current);
      startPolling();
      return stopPolling;
    }, [fetchNotifications, startPolling, stopPolling]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        fetchNotifications(false);
        startPolling();
      } else {
        stopPolling();
      }
    });

    return () => {
      sub.remove();
      stopPolling();
    };
  }, [fetchNotifications, startPolling, stopPolling]);

  return {
    ...state,
    unreadCount: state.notifications.filter((item) => !item.is_read).length,
    refresh: fetchNotifications,
  };
}

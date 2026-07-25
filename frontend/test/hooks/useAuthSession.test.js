import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthSession } from '../../src/hooks/useAuthSession';
import * as storage from '../../src/services/storage';
import * as apiClient from '../../src/services/apiClient';

vi.mock('../../src/services/storage', () => ({
  getStoredUser: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
  saveRememberedEmail: vi.fn(),
}));

vi.mock('../../src/services/apiClient', () => ({
  apiRequest: vi.fn(),
}));

describe('useAuthSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('L1-HOOK-FE-01: initializes with null user if no active session', async () => {
    storage.getStoredUser.mockReturnValue(null);
    apiClient.apiRequest.mockRejectedValue(new Error('Unauthorized'));

    const { result } = renderHook(() => useAuthSession());

    expect(result.current.user).toBeNull();
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('L1-HOOK-FE-02: refreshes cached user on mount', async () => {
    storage.getStoredUser.mockReturnValue({ id: 1, email: 'cached@test.com' });
    apiClient.apiRequest.mockResolvedValue({ id: 1, email: 'fresh@test.com' });

    const { result } = renderHook(() => useAuthSession());

    // Initially returns cached user
    expect(result.current.user).toEqual({ id: 1, email: 'cached@test.com' });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.user).toEqual({ id: 1, email: 'fresh@test.com' });
      expect(storage.saveSession).toHaveBeenCalledWith({ user: { id: 1, email: 'fresh@test.com' } });
    });
  });

  it('L1-HOOK-FE-03: clears session if fetch fails on mount', async () => {
    storage.getStoredUser.mockReturnValue({ id: 1, email: 'cached@test.com' });
    apiClient.apiRequest.mockRejectedValue(new Error('Unauthorized'));

    const { result } = renderHook(() => useAuthSession());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.user).toBeNull();
      expect(storage.clearSession).toHaveBeenCalled();
    });
  });

  it('L1-HOOK-FE-04: setSession saves data correctly', () => {
    storage.getStoredUser.mockReturnValue(null);

    const { result } = renderHook(() => useAuthSession());

    act(() => {
      result.current.setSession({ user: { email: 'new@test.com' }, rememberEmail: 'new@test.com' });
    });

    expect(storage.saveSession).toHaveBeenCalledWith({ user: { email: 'new@test.com' } });
    expect(storage.saveRememberedEmail).toHaveBeenCalledWith('new@test.com');
    expect(result.current.user).toEqual({ email: 'new@test.com' });
  });

  it('L1-HOOK-FE-05: logout clears session', async () => {
    storage.getStoredUser.mockReturnValue({ email: 'test@test.com' });
    apiClient.apiRequest.mockResolvedValue({});

    const { result } = renderHook(() => useAuthSession());

    await act(async () => {
      await result.current.logout();
    });

    expect(apiClient.apiRequest).toHaveBeenCalledWith('/auth/logout', {
      method: 'POST',
      retryOnAuthFailure: false,
      skipAuthRefresh: true,
    });
    expect(storage.clearSession).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });
});

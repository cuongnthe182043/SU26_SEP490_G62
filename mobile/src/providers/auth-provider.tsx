import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { router, useSegments } from 'expo-router';

import { ERROR_MESSAGES } from '@/constants/error-messages';
import { ApiError } from '@/lib/api-error';
import { apiClient } from '@/lib/api-client';
import { authEvents } from '@/lib/auth-events';
import { profileService } from '@/services/profile-service';
import { tokenStorage } from '@/services/token-storage';
import { offlineCache } from '@/lib/offline-cache';
import { offlineQueue } from '@/lib/offline-queue';
import type { UserProfile } from '@/types/profile';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: AuthStatus;
  profile: UserProfile | null;
  refreshSession: () => Promise<UserProfile | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isPublicRoute(firstSegment: string | undefined) {
  return firstSegment === undefined || firstSegment === 'login';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const signOut = useCallback(async () => {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (refreshToken) {
      try {
        await apiClient.post('/auth/logout', { refreshToken });
      } catch {
        // Logout local vẫn phải hoàn tất dù server/config tạm lỗi.
      }
    }
    await tokenStorage.clearAll();
    // Xoá đệm dữ liệu và hàng đợi của tài xế vừa đăng xuất — máy có thể được người
    // khác dùng, không để lộ chuyến/lương của người trước, và không gửi nhầm thao
    // tác tồn của người này dưới tài khoản người kia.
    await offlineCache.clear();
    await offlineQueue.clear();
    setProfile(null);
    setStatus('unauthenticated');
    router.replace('/login');
  }, []);

  const refreshSession = useCallback(async () => {
    const token = await tokenStorage.getToken();
    if (!token) {
      setProfile(null);
      setStatus('unauthenticated');
      return null;
    }

    try {
      const { profile: nextProfile } = await profileService.getMyProfile();

      if (nextProfile.role !== 'driver') {
        await tokenStorage.removeToken();
        setProfile(null);
        setStatus('unauthenticated');
        throw new Error(ERROR_MESSAGES.driverOnly);
      }

      setProfile(nextProfile);
      setStatus('authenticated');
      return nextProfile;
    } catch (error) {
      // Chỉ đăng xuất khi phiên THỰC SỰ hết hạn (401/403). Lỗi tạm thời (mạng
      // chập chờn, 5xx, cold start Cloud Run) → GIỮ token, KHÔNG xoá phiên —
      // tránh bị đá ra đăng nhập lại oan.
      const httpStatus = error instanceof ApiError ? error.status : undefined;
      if (httpStatus === 401 || httpStatus === 403) {
        await tokenStorage.clearAll();
        setProfile(null);
        setStatus('unauthenticated');
      } else {
        // Giữ token. Nếu đang có phiên thì ở nguyên; nếu chưa (mở app lần đầu bị
        // lỗi mạng) thì để unauthenticated nhưng KHÔNG xoá token — mở lại sẽ vào.
        setStatus((prev) => (prev === 'authenticated' ? 'authenticated' : 'unauthenticated'));
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    authEvents.register(signOut);
  }, [signOut]);

  useEffect(() => {
    refreshSession().catch(() => {
      setProfile(null);
      setStatus('unauthenticated');
    });
  }, [refreshSession]);

  useEffect(() => {
    if (status === 'loading') return;

    const firstSegment = segments[0];
    const publicRoute = isPublicRoute(firstSegment);

    if (status === 'authenticated' && publicRoute) {
      router.replace('/(tabs)');
      return;
    }

    if (status === 'unauthenticated' && !publicRoute) {
      router.replace('/login');
    }
  }, [segments, status]);

  const value = useMemo(
    () => ({ status, profile, refreshSession, signOut }),
    [status, profile, refreshSession, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthSession must be used inside AuthProvider');
  return context;
}

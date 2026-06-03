import { apiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { ERROR_MESSAGES } from '@/constants/error-messages';
import { tokenStorage } from '@/services/token-storage';
import type { LoginRequest, LoginResponse } from '@/types/auth';

export const authService = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const result = await apiClient.post<LoginResponse>('/auth/login', payload);

    if (result.user.role !== 'driver') {
      await tokenStorage.removeToken();
      throw new ApiError(ERROR_MESSAGES.driverOnly, 403);
    }

    await tokenStorage.setToken(result.token);
    return result;
  },
};

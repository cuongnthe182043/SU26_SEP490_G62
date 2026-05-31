import { apiClient } from '@/lib/api-client';
import { tokenStorage } from '@/services/token-storage';
import type { LoginRequest, LoginResponse } from '@/types/auth';

export const authService = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const result = await apiClient.post<LoginResponse>('/auth/login', payload);
    await tokenStorage.setToken(result.token);
    return result;
  },
};

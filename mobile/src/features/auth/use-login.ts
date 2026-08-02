import { useState } from 'react';

import { ApiError } from '@/lib/api-error';
import { ERROR_MESSAGES } from '@/constants/error-messages';
import { authService } from '@/services/auth-service';
import type { AuthUser } from '@/types/auth';

type LoginState = {
  isLoading: boolean;
  error: string | null;
  user: AuthUser | null;
};

const initialState: LoginState = {
  isLoading: false,
  error: null,
  user: null,
};

export function useLogin() {
  const [state, setState] = useState<LoginState>(initialState);

  // identifier = email hoặc số điện thoại; backend tự phân loại.
  const login = async (identifier: string, password: string) => {
    setState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      const result = await authService.login({ identifier: identifier.trim(), password });
      setState({ isLoading: false, error: null, user: result.user });
      return result;
    } catch (error) {
      const message = error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : ERROR_MESSAGES.invalidCredential;

      setState({ isLoading: false, error: message, user: null });
      return null;
    }
  };

  return {
    ...state,
    login,
  };
}

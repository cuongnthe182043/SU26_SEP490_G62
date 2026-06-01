import { useState } from 'react';

import { ApiError } from '@/lib/api-error';
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

  const login = async (email: string, password: string) => {
    setState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      const result = await authService.login({ email: email.trim(), password });
      setState({ isLoading: false, error: null, user: result.user });
      return result;
    } catch (error) {
      const message = error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : '\u0110\u0103ng nh\u1eadp th\u1ea5t b\u1ea1i. Vui l\u00f2ng th\u1eed l\u1ea1i.';

      setState({ isLoading: false, error: message, user: null });
      return null;
    }
  };

  return {
    ...state,
    login,
  };
}

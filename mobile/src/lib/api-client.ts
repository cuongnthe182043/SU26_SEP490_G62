import { Alert } from 'react-native';
import { router } from 'expo-router';
import { API_BASE_URL } from '@/constants/api';
import { ApiError } from '@/lib/api-error';
import { tokenStorage } from '@/services/token-storage';

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | object | null;
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await tokenStorage.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let isRedirectingToLogin = false;

async function handleUnauthorized(): Promise<void> {
  if (isRedirectingToLogin) return;
  isRedirectingToLogin = true;
  await tokenStorage.removeToken();
  Alert.alert(
    'Phiên đăng nhập hết hạn',
    'Vui lòng đăng nhập lại để tiếp tục.',
    [{ text: 'Đăng nhập', onPress: () => { isRedirectingToLogin = false; } }],
    { cancelable: false },
  );
  router.replace('/');
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const headers = new Headers({ ...authHeaders, ...(options.headers as Record<string, string> | undefined) });

  const rawBody = options.body;
  let body: BodyInit | null | undefined;
  if (rawBody && typeof rawBody === 'object' && !(rawBody instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(rawBody);
  } else {
    body = rawBody as BodyInit | null | undefined;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: body as BodyInit | null | undefined,
  });

  const payload = await response.json().catch(() => null);

  if (response.status === 401) {
    await handleUnauthorized();
    throw new ApiError('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.', 401);
  }

  if (!response.ok) {
    throw new ApiError(payload?.error ?? payload?.message ?? 'Không thể kết nối đến máy chủ.', response.status);
  }

  return payload as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: object) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body: object) => request<T>(path, { method: 'PATCH', body }),
  postForm: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', body: formData }),
};

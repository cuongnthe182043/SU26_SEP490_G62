import { API_BASE_URL } from '@/constants/api';
import { ApiError } from '@/lib/api-error';

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | object | null;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

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

  if (!response.ok) {
    throw new ApiError(payload?.error ?? 'Không thể kết nối đến máy chủ.', response.status);
  }

  return payload as T;
}

export const apiClient = {
  post: <T>(path: string, body: object) =>
    request<T>(path, {
      method: 'POST',
      body,
    }),
};

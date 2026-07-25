export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? ''
).replace(/\/$/, '');

export function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not configured.');
  }

  try {
    const url = new URL(API_BASE_URL);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Invalid API URL protocol.');
    }
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL is invalid.');
  }

  return API_BASE_URL;
}

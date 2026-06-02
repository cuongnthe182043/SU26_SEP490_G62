const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiBaseUrl) {
  throw new Error('Missing EXPO_PUBLIC_API_URL in mobile/.env');
}

export const API_BASE_URL = apiBaseUrl.replace(/\/$/, '');
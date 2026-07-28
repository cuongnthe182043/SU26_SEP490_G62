import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY    = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const CSRF_TOKEN_KEY    = 'csrf_token';

export const tokenStorage = {
  getToken:         () => SecureStore.getItemAsync(AUTH_TOKEN_KEY),
  setToken:         (token: string) => SecureStore.setItemAsync(AUTH_TOKEN_KEY, token),
  removeToken:      () => SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),

  getRefreshToken:  () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  setRefreshToken:  (token: string) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token),
  removeRefreshToken: () => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),

  getCsrfToken:     () => SecureStore.getItemAsync(CSRF_TOKEN_KEY),
  setCsrfToken:     (token: string) => SecureStore.setItemAsync(CSRF_TOKEN_KEY, token),
  removeCsrfToken:  () => SecureStore.deleteItemAsync(CSRF_TOKEN_KEY),

  clearAll: async () => {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(CSRF_TOKEN_KEY);
  },
};

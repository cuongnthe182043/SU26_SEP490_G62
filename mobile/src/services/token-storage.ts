import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'auth_token';

export const tokenStorage = {
  getToken: () => SecureStore.getItemAsync(AUTH_TOKEN_KEY),
  setToken: (token: string) => SecureStore.setItemAsync(AUTH_TOKEN_KEY, token),
  removeToken: () => SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
};

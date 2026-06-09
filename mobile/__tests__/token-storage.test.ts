import { tokenStorage } from '@/services/token-storage';
import * as SecureStore  from 'expo-secure-store';

// expo-secure-store đã được mock toàn cục trong jest.setup.js
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('tokenStorage', () => {
    beforeEach(() => jest.clearAllMocks());

    it('G62-FE-23: setToken → SecureStore.setItemAsync("auth_token", token)', async () => {
        mockSecureStore.setItemAsync.mockResolvedValue(undefined);

        await tokenStorage.setToken('mytoken');

        expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'mytoken');
    });

    it('G62-FE-24: getToken → SecureStore.getItemAsync("auth_token") trả về token', async () => {
        mockSecureStore.getItemAsync.mockResolvedValue('mytoken');

        const token = await tokenStorage.getToken();

        expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('auth_token');
        expect(token).toBe('mytoken');
    });

    it('G62-FE-25: getToken khi chưa có → trả về null', async () => {
        mockSecureStore.getItemAsync.mockResolvedValue(null);

        const token = await tokenStorage.getToken();

        expect(token).toBeNull();
    });

    it('G62-FE-26: removeToken → SecureStore.deleteItemAsync("auth_token")', async () => {
        mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

        await tokenStorage.removeToken();

        expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
    });
});

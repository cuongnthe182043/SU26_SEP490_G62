import { authService } from '@/services/auth-service';
import { apiClient }   from '@/lib/api-client';
import { ApiError }    from '@/lib/api-error';
import * as SecureStore from 'expo-secure-store';

jest.mock('@/lib/api-client');

const mockApi         = apiClient   as jest.Mocked<typeof apiClient>;
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('authService', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('login', () => {
        it('G62-FE-18: login thành công → lưu token, trả về user role=driver', async () => {
            mockApi.post = jest.fn().mockResolvedValue({ token: 'abc', user: { role: 'driver' } });
            mockSecureStore.setItemAsync.mockResolvedValue(undefined);

            const result = await authService.login({ email: 'd@g62.com', password: '123456' });

            expect(mockApi.post).toHaveBeenCalledWith('/auth/login', { email: 'd@g62.com', password: '123456' });
            expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'abc');
            expect(result.user.role).toBe('driver');
        });

        it('G62-FE-19: login role != driver → throw ApiError 403, xóa token', async () => {
            mockApi.post = jest.fn().mockResolvedValue({ token: 'abc', user: { role: 'accountant' } });
            mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

            const err = await authService.login({ email: 'd@g62.com', password: '123456' }).catch(e => e);

            expect(err).toBeInstanceOf(ApiError);
            expect(err.status).toBe(403);
            expect(mockSecureStore.deleteItemAsync).toHaveBeenCalled();
        });

        it('G62-FE-20: login sai mật khẩu → API 401 → reject', async () => {
            mockApi.post = jest.fn().mockRejectedValue(new ApiError('Sai mật khẩu', 401));

            const err = await authService.login({ email: 'd@g62.com', password: 'wrong' }).catch(e => e);

            expect(err).toBeInstanceOf(ApiError);
            expect(err.status).toBe(401);
            expect(err.message).toMatch(/Sai mật khẩu/i);
        });
    });

    describe('loginWithGoogle', () => {
        it('G62-FE-21: loginWithGoogle thành công → POST /auth/google, lưu token', async () => {
            mockApi.post = jest.fn().mockResolvedValue({ token: 'xyz', user: { role: 'driver' } });
            mockSecureStore.setItemAsync.mockResolvedValue(undefined);

            const result = await authService.loginWithGoogle('google_credential');

            expect(mockApi.post).toHaveBeenCalledWith('/auth/google', { credential: 'google_credential' });
            expect(result.token).toBe('xyz');
        });

        it('G62-FE-22: loginWithGoogle role != driver → throw ApiError 403', async () => {
            mockApi.post = jest.fn().mockResolvedValue({ token: 'xyz', user: { role: 'staff' } });
            mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

            const err = await authService.loginWithGoogle('google_credential').catch(e => e);

            expect(err).toBeInstanceOf(ApiError);
            expect(err.status).toBe(403);
        });
    });
});

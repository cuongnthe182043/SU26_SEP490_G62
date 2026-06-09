import { profileService } from '@/services/profile-service';
import { apiClient }       from '@/lib/api-client';
import { ApiError }        from '@/lib/api-error';

jest.mock('@/lib/api-client');

const mockApi = apiClient as jest.Mocked<typeof apiClient>;

describe('profileService', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('getMyProfile', () => {
        it('G62-FE-65: getMyProfile → GET /api/profile/me trả về profile driver', async () => {
            mockApi.get = jest.fn().mockResolvedValue({
                profile: { id: 1, full_name: 'Tien', role: 'driver' },
            });

            const result = await profileService.getMyProfile();

            expect(mockApi.get).toHaveBeenCalledWith('/api/profile/me');
            expect(result.profile.role).toBe('driver');
        });
    });

    describe('updateMyProfile', () => {
        it('G62-FE-66: updateMyProfile → PATCH /api/profile/me cập nhật thông tin', async () => {
            mockApi.patch = jest.fn().mockResolvedValue({
                message: 'OK',
                profile: { full_name: 'Tien New' },
            });

            const result = await profileService.updateMyProfile({ fullName: 'Tien New' } as any);

            expect(mockApi.patch).toHaveBeenCalledWith('/api/profile/me', { fullName: 'Tien New' });
            expect(result.profile.full_name).toBe('Tien New');
        });
    });

    describe('changePassword', () => {
        it('G62-FE-67: changePassword thành công → PATCH /api/profile/me/password', async () => {
            mockApi.patch = jest.fn().mockResolvedValue({ message: 'Password changed' });

            const result = await profileService.changePassword('OldPass123', 'NewPass456');

            expect(mockApi.patch).toHaveBeenCalledWith('/api/profile/me/password', {
                currentPassword: 'OldPass123',
                newPassword:     'NewPass456',
            });
            expect(result.message).toBe('Password changed');
        });

        it('G62-FE-68: changePassword sai mật khẩu hiện tại → reject 400', async () => {
            mockApi.patch = jest.fn().mockRejectedValue(new ApiError('Mật khẩu không đúng', 400));

            const err = await profileService.changePassword('WrongPass', 'NewPass456').catch(e => e);

            expect(err).toBeInstanceOf(ApiError);
            expect(err.status).toBe(400);
            expect(err.message).toMatch(/Mật khẩu không đúng/i);
        });
    });

    describe('registerDeviceToken', () => {
        it('G62-FE-69: registerDeviceToken → POST /api/profile/me/device-token', async () => {
            mockApi.post = jest.fn().mockResolvedValue({ message: 'OK', platform: 'android' });

            const result = await profileService.registerDeviceToken('fcm_token_abc');

            expect(mockApi.post).toHaveBeenCalledWith('/api/profile/me/device-token', {
                fcmToken: 'fcm_token_abc',
                platform: 'android',
            });
            expect(result.platform).toBe('android');
        });
    });
});

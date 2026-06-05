import { apiClient } from '@/lib/api-client';
import type {
    ProfileResponse,
    UpdateAvatarResponse,
    UpdateProfilePayload,
    UpdateProfileResponse,
} from '@/types/profile';

export const profileService = {
    getMyProfile: () =>
        apiClient.get<ProfileResponse>('/api/profile/me'),

    updateMyProfile: (payload: UpdateProfilePayload) =>
        apiClient.patch<UpdateProfileResponse>('/api/profile/me', payload),

    updateAvatar: (formData: FormData) =>
        apiClient.postForm<UpdateAvatarResponse>('/api/profile/me/avatar', formData),

    // Item 3 — Đổi mật khẩu
    changePassword: (currentPassword: string, newPassword: string) =>
        apiClient.patch<{ message: string }>('/api/profile/me/password', { currentPassword, newPassword }),

    // Item 6 — Đăng ký FCM device token
    registerDeviceToken: (fcmToken: string, platform: 'android' | 'ios' | 'web' = 'android') =>
        apiClient.post<{ message: string; platform: string }>('/api/profile/me/device-token', { fcmToken, platform }),
};

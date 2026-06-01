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
};

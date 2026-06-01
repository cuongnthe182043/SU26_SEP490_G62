export type Gender = 'male' | 'female' | 'other';

export type UserProfile = {
    id: number;
    email: string;           // read-only
    full_name: string;
    phone: string | null;
    role: string;
    avatar_url: string | null;
    dob: string | null;      // ISO date string YYYY-MM-DD
    gender: Gender | null;
    address: string | null;
    city: string | null;
    country: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

export type UpdateProfilePayload = {
    full_name?: string;
    phone?: string | null;
    dob?: string | null;
    gender?: Gender | null;
    address?: string | null;
    city?: string | null;
    country?: string;
};

export type ProfileResponse = {
    profile: UserProfile;
};

export type UpdateProfileResponse = {
    message: string;
    profile: Partial<UserProfile>;
};

export type UpdateAvatarResponse = {
    message: string;
    avatar_url: string;
};

export const GENDER_LABEL: Record<Gender, string> = {
    male:   'Nam',
    female: 'Nữ',
    other:  'Khác',
};

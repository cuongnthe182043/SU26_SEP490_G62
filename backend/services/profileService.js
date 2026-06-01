const profileRepository = require('../repositories/profileRepository');

const GENDER_VALUES = new Set(['male', 'female', 'other']);

const getMyProfile = async (userId) => {
    const profile = await profileRepository.getFullProfile(userId);
    if (!profile) throw new Error('Không tìm thấy hồ sơ');
    return profile;
};

const updateMyProfile = async (userId, data) => {
    // Strip email — cannot be changed
    const { email, role_id, role, is_active, id, created_at, ...rest } = data;

    // Validate gender if provided
    if (rest.gender !== undefined && rest.gender !== null && !GENDER_VALUES.has(rest.gender)) {
        throw new Error('Giới tính không hợp lệ (male / female / other)');
    }

    // Validate dob format if provided
    if (rest.dob !== undefined && rest.dob !== null) {
        const date = new Date(rest.dob);
        if (isNaN(date.getTime())) throw new Error('Ngày sinh không hợp lệ');
        if (date > new Date()) throw new Error('Ngày sinh không thể trong tương lai');
    }

    // Validate phone uniqueness handled by DB UNIQUE constraint
    return profileRepository.updateProfile(userId, rest);
};

const updateAvatar = async (userId, avatarUrl) => {
    if (!avatarUrl) throw new Error('URL ảnh đại diện không hợp lệ');
    return profileRepository.updateAvatar(userId, avatarUrl);
};

module.exports = { getMyProfile, updateMyProfile, updateAvatar };

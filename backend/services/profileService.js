const profileRepository = require('../repositories/profileRepository');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

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

// ITEM 3 — Change Password (all authenticated users)
const changePassword = async (userId, { currentPassword, newPassword } = {}) => {
    if (!currentPassword || !newPassword) {
        throw new Error('Mật khẩu hiện tại và mật khẩu mới là bắt buộc');
    }
    if (newPassword.length < 6) {
        throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự');
    }

    // Fetch current password_hash from accounts
    const accountResult = await pool.query(
        `SELECT password_hash FROM accounts WHERE id = $1`,
        [userId],
    );
    if (!accountResult.rows[0]) throw new Error('Không tìm thấy tài khoản');

    const { password_hash } = accountResult.rows[0];

    // Verify current password using bcrypt (matches authService.login pattern)
    const valid = await bcrypt.compare(currentPassword, password_hash);
    if (!valid) throw new Error('Mật khẩu hiện tại không đúng');

    // Hash the new password and update
    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
        `UPDATE accounts SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [newHash, userId],
    );

    return { message: 'Đổi mật khẩu thành công' };
};

// ITEM 6 — Register FCM device token
const registerDeviceToken = async (userId, { fcmToken, platform } = {}) => {
    if (!fcmToken || !fcmToken.trim()) throw new Error('fcmToken là bắt buộc');
    const allowedPlatforms = ['android', 'ios', 'web'];
    const normalizedPlatform = platform && allowedPlatforms.includes(platform) ? platform : 'android';

    const fcmService = require('./fcmService');
    fcmService.registerToken(userId, fcmToken.trim(), normalizedPlatform);

    return { message: 'Đăng ký thiết bị thành công', platform: normalizedPlatform };
};

module.exports = { getMyProfile, updateMyProfile, updateAvatar, changePassword, registerDeviceToken };

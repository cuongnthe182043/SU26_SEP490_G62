const profileRepository = require('../repositories/profileRepository');
const bcrypt = require('bcryptjs');
const emailService = require('./emailService');

class AdminError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = 'AdminError';
        this.status = status;
    }
}

const getAllUsers = async () => {
    return await profileRepository.getAllUsers();
};

const createUser = async (email, full_name, phone, role) => {
    const password = '123123';
    if (!email || !role) {
        throw new AdminError('Thiếu thông tin bắt buộc (email, role).', 400);
    }

    const roleId = await profileRepository.getRoleIdByName(role);
    if (!roleId) {
        throw new AdminError('Vai trò không hợp lệ.', 400);
    }

    const existingAccount = await profileRepository.getAccountByEmail(email);
    if (existingAccount) {
        throw new AdminError('Email đã tồn tại.', 409);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    try {
        const newId = await profileRepository.adminCreateUser(email, passwordHash, roleId, full_name || '', phone || null);
        emailService.sendWelcomeEmail(email, password, full_name, role);
        return newId;
    } catch (err) {
        if (err.code === '23505') {
            throw new AdminError('Số điện thoại hoặc Email đã tồn tại.', 409);
        }
        throw err;
    }
};

const updateUser = async (userId, full_name, phone, role) => {
    if (!role) {
        throw new AdminError('Vai trò không được để trống.', 400);
    }

    const roleId = await profileRepository.getRoleIdByName(role);
    if (!roleId) {
        throw new AdminError('Vai trò không hợp lệ.', 400);
    }

    try {
        await profileRepository.adminUpdateUser(userId, { full_name, phone }, roleId);
    } catch (err) {
        if (err.code === '23505') {
            throw new AdminError('Số điện thoại đã tồn tại.', 409);
        }
        throw err;
    }
};

const toggleUserStatus = async (userId, is_active, currentUserId) => {
    if (is_active === undefined) {
        throw new AdminError('Thiếu is_active.', 400);
    }

    if (Number(userId) === currentUserId) {
        throw new AdminError('Không thể tự khoá tài khoản của chính mình.', 400);
    }

    await profileRepository.adminToggleUserStatus(userId, is_active);
};

module.exports = {
    getAllUsers,
    createUser,
    updateUser,
    toggleUserStatus,
    AdminError
};

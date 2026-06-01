const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const profileRepository = require('../repositories/profileRepository');

const JWT_SECRET = process.env.JWT_SECRET || 'MY_SECRET_KEY';

class AuthError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = 'AuthError';
        this.status = status;
    }
}

// Login user - return token and user info
const login = async (email, password) => {
    if (!email || !password) {
        throw new AuthError('Email và mật khẩu là bắt buộc.', 400);
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find account by normalized email
    const account = await profileRepository.getAccountByEmail(normalizedEmail);
    if (!account) {
        throw new AuthError('Email không tồn tại.', 404);
    }

    // Compare passwords
    const validPassword = await bcrypt.compare(password, account.password_hash);
    if (!validPassword) {
        throw new AuthError('Mật khẩu không đúng.', 401);
    }

    const profile = await profileRepository.getProfileByAccountId(account.id);
    const role = account.role;

    if (!role) {
        throw new AuthError('Tài khoản chưa được gán vai trò.', 403);
    }

    // Update last login
    await profileRepository.updateLastLogin(account.id);

    // Generate JWT token
    const token = jwt.sign(
        { userId: account.id, email: account.email, role },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    return {
        token,
        user: {
            id: account.id,
            email: account.email,
            full_name: profile?.full_name ?? null,
            phone: profile?.phone ?? null,
            role_id: profile?.role_id ?? account.role_id ?? null,
            role,
        }
    };
};

// Get user from token
const getUserFromToken = async (userId) => {
    const profile = await profileRepository.getProfileWithRole(userId);
    if (!profile) {
        throw new Error('User not found');
    }
    return profile;
};

// Verify JWT token
const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (err) {
        throw new Error('Invalid token');
    }
};

module.exports = {
    login,
    getUserFromToken,
    verifyToken,
    AuthError,
};

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const profileRepository = require('../repositories/profileRepository');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production';

// Login user - return token and user info
const login = async (email, password) => {
    if (!email || !password) {
        throw new Error('Email and password are required');
    }

    // Find account by email
    const account = await profileRepository.getAccountByEmail(email);
    if (!account) {
        throw new Error('Invalid credentials');
    }

    // Compare passwords
    const validPassword = await bcrypt.compare(password, account.password_hash);
    if (!validPassword) {
        throw new Error('Invalid credentials');
    }

    // Update last login
    await profileRepository.updateLastLogin(account.id);

    // Generate JWT token
    const token = jwt.sign(
        { userId: account.id, email: account.email, role: account.role },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    return {
        token,
        user: {
            id: account.id,
            email: account.email,
            full_name: account.full_name,
            phone: account.phone,
            role: account.role,
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
};

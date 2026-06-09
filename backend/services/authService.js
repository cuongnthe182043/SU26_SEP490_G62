const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const profileRepository = require('../repositories/profileRepository');
const { OAuth2Client } = require('google-auth-library');

const JWT_SECRET = process.env.JWT_SECRET || 'MY_SECRET_KEY';
const GOOGLE_CLIENT_ID = process.env.GG_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

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

    
    if (account.is_active === false) {
        throw new AuthError('Tài khoản của bạn đã bị khoá.', 403);
    }

 
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

const fetchGoogleTokenInfo = async (credential) => {
    if (!credential) {
        throw new AuthError('Google credential is required.', 400);
    }

    if (typeof fetch !== 'function') {
        throw new Error('Global fetch is not available in this runtime.');
    }

    const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
        throw new AuthError('Invalid Google credential.', 401);
    }

    return payload;
};

const loginWithGoogle = async (credential) => {
    const tokenInfo = await fetchGoogleTokenInfo(credential);

    if (GOOGLE_CLIENT_ID && tokenInfo.aud !== GOOGLE_CLIENT_ID) {
        throw new AuthError('Google account is not authorized for this application.', 403);
    }

    if (!tokenInfo.email || String(tokenInfo.email_verified).toLowerCase() !== 'true') {
        throw new AuthError('Google email is not verified.', 403);
    }

    const normalizedEmail = tokenInfo.email.trim().toLowerCase();
    const account = await profileRepository.getAccountByEmail(normalizedEmail);

    if (!account) {
        throw new AuthError('This Google account is not provisioned for internal access.', 403);
    }

    const profile = await profileRepository.getProfileByAccountId(account.id);
    const role = account.role;

    if (!role) {
        throw new AuthError('Account role is not assigned.', 403);
    }

    if (account.is_active === false) {
        throw new AuthError('Your account has been deactivated.', 403);
    }

    await profileRepository.updateLastLogin(account.id);

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
    loginWithGoogle,
    getUserFromToken,
    verifyToken,
    AuthError,
};

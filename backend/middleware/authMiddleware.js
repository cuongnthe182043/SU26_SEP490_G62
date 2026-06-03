const authService = require('../services/authService');
const profileRepository = require('../repositories/profileRepository');

// Middleware: Verify JWT token
const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(403).json({ error: 'No token provided' });

        const decoded = authService.verifyToken(token);

        const account = await profileRepository.getAccountById(decoded.userId);
        if (!account) return res.status(401).json({ error: 'User not found' });
        if (account.is_active === false) {
            return res.status(403).json({ error: 'Tài khoản của bạn đã bị khoá.' });
        }

        req.user = { ...decoded, role: account.role, roleId: account.role_id };
        next();
    } catch (err) {
        return res.status(401).json({ error: err.message });
    }
};

// Middleware: Check user role(s)
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

module.exports = {
    verifyToken,
    requireRole,
};

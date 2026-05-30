const authService = require('../services/authService');

// Middleware: Verify JWT token
const verifyToken = (req, res, next) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(403).json({ error: 'No token provided' });

        const decoded = authService.verifyToken(token);
        req.user = decoded;
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

const authService = require('../services/authService');
const roleRepository = require('../repositories/roleRepository');

// POST /auth/login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await authService.login(email, password);

        res.json({
            message: 'Login successful',
            ...result,
        });
    } catch (err) {
        console.error('Login error:', err);
        const status = Number.isInteger(err.status) ? err.status : 500;
        const message = status === 500 ? 'Internal server error' : err.message;
        res.status(status).json({ error: message });
    }
};

// POST /auth/google
const googleLogin = async (req, res) => {
    try {
        const { credential } = req.body;
        const result = await authService.loginWithGoogle(credential);

        res.json({
            message: 'Google login successful',
            ...result,
        });
    } catch (err) {
        console.error('Google login error:', err);
        const status = Number.isInteger(err.status) ? err.status : 500;
        const message = status === 500 ? 'Internal server error' : err.message;
        res.status(status).json({ error: message });
    }
};

// GET /auth/me (protected endpoint)
const getCurrentUser = async (req, res) => {
    try {
        const user = await authService.getUserFromToken(req.user.userId);
        res.json(user);
    } catch (err) {
        console.error('Get user error:', err);
        res.status(404).json({ error: err.message });
    }
};

// GET /roles (public endpoint for reference)
const getAllRoles = async (req, res) => {
    try {
        const roles = await roleRepository.getAllRoles();
        res.json(roles);
    } catch (err) {
        console.error('Error fetching roles:', err);
        res.status(500).json({ error: 'Failed to fetch roles', details: err.message });
    }
};

module.exports = {
    login,
    googleLogin,
    getCurrentUser,
    getAllRoles,
};

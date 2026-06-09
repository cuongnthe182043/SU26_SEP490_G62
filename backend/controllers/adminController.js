const adminService = require('../services/adminService');

const getAllUsers = async (req, res) => {
    try {
        const users = await adminService.getAllUsers();
        res.json({ users });
    } catch (err) {
        console.error('Error fetching all users:', err);
        const status = err.status || 500;
        res.status(status).json({ error: err.status ? err.message : 'Failed to fetch users', details: err.message });
    }
};

const createUser = async (req, res) => {
    try {
        const { email, full_name, phone, role } = req.body;
        const newId = await adminService.createUser(email, full_name, phone, role);
        res.status(201).json({ message: 'Tạo người dùng thành công.', id: newId });
    } catch (err) {
        console.error('Error creating user:', err);
        const status = err.status || 500;
        const errorMsg = err.status ? err.message : 'Lỗi máy chủ.';
        res.status(status).json({ error: errorMsg, details: err.message });
    }
};

const updateUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const { full_name, phone, role } = req.body;
        await adminService.updateUser(userId, full_name, phone, role);
        res.json({ message: 'Cập nhật thành công.' });
    } catch (err) {
        console.error('Error updating user:', err);
        const status = err.status || 500;
        const errorMsg = err.status ? err.message : 'Lỗi máy chủ.';
        res.status(status).json({ error: errorMsg, details: err.message });
    }
};

const toggleUserStatus = async (req, res) => {
    try {
        const userId = req.params.id;
        const { is_active } = req.body;
        const currentUserId = req.user.userId;

        await adminService.toggleUserStatus(userId, is_active, currentUserId);
        res.json({ message: `Đã ${is_active ? 'mở khoá' : 'khoá'} tài khoản.` });
    } catch (err) {
        console.error('Error toggling user status:', err);
        const status = err.status || 500;
        res.status(status).json({ error: err.status ? err.message : 'Lỗi máy chủ', details: err.message });
    }
};

module.exports = {
    getAllUsers,
    createUser,
    updateUser,
    toggleUserStatus,
};

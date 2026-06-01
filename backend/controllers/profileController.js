const profileService = require('../services/profileService');

// GET /api/profile/me
const getMyProfile = async (req, res) => {
    try {
        const profile = await profileService.getMyProfile(req.user.userId);
        res.json({ profile });
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
};

// PATCH /api/profile/me
const updateMyProfile = async (req, res) => {
    try {
        const updated = await profileService.updateMyProfile(req.user.userId, req.body);
        res.json({ message: 'Cập nhật hồ sơ thành công', profile: updated });
    } catch (err) {
        const status = err.message.includes('không hợp lệ') ? 422
            : err.code === '23505' ? 409   // unique violation (phone)
            : 400;
        const message = err.code === '23505'
            ? 'Số điện thoại đã được sử dụng bởi tài khoản khác'
            : err.message;
        res.status(status).json({ error: message });
    }
};

// POST /api/profile/me/avatar  (multipart/form-data, field: avatar)
const updateAvatar = async (req, res) => {
    try {
        const avatarUrl = req.file?.path;
        if (!avatarUrl) return res.status(422).json({ error: 'Vui lòng chọn ảnh đại diện' });

        const result = await profileService.updateAvatar(req.user.userId, avatarUrl);
        res.json({ message: 'Cập nhật ảnh đại diện thành công', avatar_url: result.avatar_url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getMyProfile, updateMyProfile, updateAvatar };

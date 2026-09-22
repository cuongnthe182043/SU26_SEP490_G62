/**
 * Đánh dấu mốc request tới máy chủ.
 *
 * Mọi hạn chót bên trong đếm từ đây — xem RESPONSE_BUDGET_MS. Phải là lúc request TỚI,
 * vì đoạn đẩy ảnh lên Cloudinary nằm trước controller và chính nó là đoạn co giãn nhất
 * khi tài xế đứng chỗ sóng yếu.
 */
const trackRequestTiming = (req, res, next) => {
    req.receivedAt = Date.now();
    next();
};

module.exports = { trackRequestTiming };

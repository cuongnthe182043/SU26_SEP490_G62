const cloudinary = require('../config/cloudinary');

/**
 * Xoá file vừa upload lên Cloudinary.
 *
 * Dùng khi một ảnh đã được multer đẩy lên nhưng sau đó bị từ chối (hóa đơn không hợp
 * lệ, validate thất bại): không xoá thì Cloudinary tích dần file rác không có gì tham
 * chiếu tới.
 *
 * Không bao giờ ném lỗi — dọn rác thất bại không được làm hỏng phản hồi cho người dùng.
 */
const deleteUploadedFile = async (publicId) => {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (err) {
        console.warn('[upload] Không xoá được file Cloudinary:', publicId, err.message);
    }
};

module.exports = { deleteUploadedFile };

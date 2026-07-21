// Chuẩn hoá số điện thoại Việt Nam về một dạng chuẩn duy nhất để so khớp khách hàng,
// không phân biệt cách gõ (dấu cách, gạch, dấu chấm, +84, thiếu số 0 đầu).
//
//   "0901 234 567"   -> "0901234567"
//   "+84901234567"   -> "0901234567"
//   "84901234567"    -> "0901234567"
//   "901234567"      -> "0901234567"  (thiếu số 0 đầu)
//   ""/null          -> ""            (khách lẻ không SĐT — gom chung 1 hồ sơ)
//
// Lưu ý: giữ nguyên các chuỗi không nhận diện được (số cố định, số lạ) sau khi bỏ ký tự
// không phải chữ số, tránh biến đổi sai.
const normalizeVietnamPhone = (raw) => {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 11 && digits.startsWith('84')) return `0${digits.slice(2)}`;
    if (digits.length === 9) return `0${digits}`;
    return digits;
};

// Biểu thức SQL chuẩn hoá cột `phone` đã lưu theo ĐÚNG quy tắc như normalizeVietnamPhone,
// để so khớp cả những hồ sơ cũ đang lưu ở định dạng chưa chuẩn (không cần migrate dữ liệu).
// Dùng: `WHERE ${normalizedPhoneSql('c.phone')} = $1` với $1 = normalizeVietnamPhone(input).
const normalizedPhoneSql = (col) => {
    const d = `regexp_replace(${col}, '\\D', '', 'g')`;
    return `(CASE
        WHEN length(${d}) = 11 AND ${d} LIKE '84%' THEN '0' || substring(${d} from 3)
        WHEN length(${d}) = 9 THEN '0' || ${d}
        ELSE ${d}
    END)`;
};

module.exports = { normalizeVietnamPhone, normalizedPhoneSql };

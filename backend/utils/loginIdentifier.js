/**
 * Nhận diện định danh đăng nhập: email hay số điện thoại.
 *
 * Tài xế thuộc lòng số điện thoại của mình nhưng thường không nhớ email công ty cấp
 * (dạng hoten@gmail.com), nên cho đăng nhập bằng cả hai. Số điện thoại nằm ở
 * profiles.phone và đã UNIQUE sẵn nên không sợ trùng.
 *
 * Quy tắc phân loại: chỉ coi là số điện thoại khi chuỗi CHỈ chứa chữ số và các ký tự
 * phân tách thường gặp (dấu cách, chấm, gạch, ngoặc, dấu +). Có '@' hoặc chữ cái →
 * đi đường email. Nhờ vậy một email gõ sai vẫn báo lỗi kiểu email, không bị hiểu nhầm
 * thành số điện thoại sai.
 */

// Ký tự người dùng hay chèn khi gõ số: '0901 000 001', '0901-000-001', '(+84) 901.000.001'
const PHONE_SHAPED = /^[\d\s.\-()+]+$/;

// Đầu số Việt Nam sau đợt chuyển đổi 2018: di động 03/05/07/08/09, cố định 02.
// Tất cả đều là 10 chữ số khi ở dạng nội địa bắt đầu bằng 0.
const VN_LOCAL_PHONE = /^0[235789]\d{8}$/;

const digitsOnly = (value) => String(value).replace(/\D/g, '');

/**
 * Chuẩn hoá về dạng nội địa 10 chữ số ('0901000001'), hoặc null nếu không phải
 * số điện thoại Việt Nam hợp lệ.
 */
const normalizeVietnamPhone = (raw) => {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed || !PHONE_SHAPED.test(trimmed)) return null;

    let digits = digitsOnly(trimmed);

    // '00' là cách quay số quốc tế thay cho '+' trên bàn phím không có dấu cộng.
    // Bỏ trước rồi mới xét mã quốc gia, để '0084901000001' và '+84901000001' về cùng một chỗ.
    if (digits.startsWith('00')) {
        digits = digits.slice(2);
    }

    // '84901000001' → '0901000001'
    if (digits.startsWith('84') && digits.length === 11) {
        digits = `0${digits.slice(2)}`;
    }

    return VN_LOCAL_PHONE.test(digits) ? digits : null;
};

/**
 * Phân loại định danh đăng nhập.
 *   { type: 'phone', localDigits, intlDigits }  — số hợp lệ
 *   { type: 'email', email }                    — mọi trường hợp còn lại
 *
 * Cố ý KHÔNG chặn email sai định dạng ở đây: tầng login tra cứu rồi trả "không tồn
 * tại" như trước, giữ nguyên hành vi cũ với các input rác.
 */
const classifyLoginIdentifier = (raw) => {
    const trimmed = typeof raw === 'string' ? raw.trim() : '';

    const phone = normalizeVietnamPhone(trimmed);
    if (phone) {
        return { type: 'phone', localDigits: phone, intlDigits: `84${phone.slice(1)}` };
    }

    return { type: 'email', email: trimmed.toLowerCase() };
};

/**
 * Chuỗi có "hình dạng" số điện thoại nhưng không phải số Việt Nam hợp lệ — dùng để
 * báo lỗi đúng ngữ cảnh ở client ("Số điện thoại không hợp lệ" thay vì "Email không
 * hợp lệ") khi người dùng gõ toàn số.
 */
const looksLikePhoneInput = (raw) => typeof raw === 'string'
    && raw.trim().length > 0
    && PHONE_SHAPED.test(raw.trim());

module.exports = {
    normalizeVietnamPhone,
    classifyLoginIdentifier,
    looksLikePhoneInput,
    VN_LOCAL_PHONE,
};

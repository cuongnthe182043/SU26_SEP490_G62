export type LoginFormErrors = {
  email?: string;
  password?: string;
};

/**
 * Nhận diện định danh đăng nhập: email hay số điện thoại.
 *
 * BẢN SAO của backend/utils/loginIdentifier.js — dự án chưa có package dùng chung giữa
 * backend/frontend/mobile. Backend mới là nơi quyết định; phần này chỉ để báo lỗi sớm
 * trên form. Sửa quy tắc thì phải sửa cả ba nơi.
 *
 * Tài xế thuộc lòng số điện thoại của mình nhưng thường không nhớ email công ty cấp,
 * nên màn đăng nhập của app nhận cả hai.
 */

const PHONE_SHAPED = /^[\d\s.\-()+]+$/;
// Đầu số Việt Nam sau đợt chuyển đổi 2018: di động 03/05/07/08/09, cố định 02.
const VN_LOCAL_PHONE = /^0[235789]\d{8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeVietnamPhone(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || !PHONE_SHAPED.test(trimmed)) return null;

  let digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('84') && digits.length === 11) digits = `0${digits.slice(2)}`;

  return VN_LOCAL_PHONE.test(digits) ? digits : null;
}

/** Chuỗi toàn chữ số/ký tự phân tách — người dùng đang gõ số, không phải email. */
export function looksLikePhoneInput(raw: string): boolean {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed.length > 0 && PHONE_SHAPED.test(trimmed);
}

export function isValidLoginIdentifier(raw: string): boolean {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return Boolean(normalizeVietnamPhone(trimmed)) || EMAIL_PATTERN.test(trimmed);
}

/**
 * `identifier` giữ tên khoá lỗi là `email` để không phải đổi loạt chỗ dùng ở màn hình.
 * Thông báo bám theo thứ người dùng ĐANG gõ: gõ toàn số mà sai thì báo lỗi số điện
 * thoại, đừng báo "email không đúng định dạng".
 */
export function validateLoginForm(identifier: string, password: string): LoginFormErrors {
  const errors: LoginFormErrors = {};
  const trimmed = identifier.trim();

  if (!trimmed) {
    errors.email = 'Vui lòng nhập email hoặc số điện thoại.';
  } else if (!isValidLoginIdentifier(trimmed)) {
    errors.email = looksLikePhoneInput(trimmed)
      ? 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 03/05/07/08/09 hoặc 02).'
      : 'Email không đúng định dạng.';
  }

  if (!password) {
    errors.password = 'Vui lòng nhập mật khẩu.';
  } else if (password.length < 6) {
    errors.password = 'Mật khẩu phải có ít nhất 6 ký tự.';
  }

  return errors;
}

export function hasLoginErrors(errors: LoginFormErrors) {
  return Boolean(errors.email || errors.password);
}

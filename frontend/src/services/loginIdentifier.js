/**
 * Nhận diện định danh đăng nhập: email hay số điện thoại.
 *
 * BẢN SAO của backend/utils/loginIdentifier.js — dự án chưa có package dùng chung
 * giữa backend/frontend/mobile. Backend mới là nơi quyết định; phần này chỉ để báo lỗi
 * sớm ngay trên form. Sửa quy tắc thì phải sửa cả ba nơi (backend, frontend, mobile).
 */

const PHONE_SHAPED = /^[\d\s.\-()+]+$/;
// Đầu số Việt Nam sau đợt chuyển đổi 2018: di động 03/05/07/08/09, cố định 02.
const VN_LOCAL_PHONE = /^0[235789]\d{8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeVietnamPhone(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || !PHONE_SHAPED.test(trimmed)) return null;

  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("84") && digits.length === 11) digits = `0${digits.slice(2)}`;

  return VN_LOCAL_PHONE.test(digits) ? digits : null;
}

/** Chuỗi toàn chữ số/ký tự phân tách — người dùng đang định gõ số, không phải email. */
export function looksLikePhoneInput(raw) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed.length > 0 && PHONE_SHAPED.test(trimmed);
}

export function isValidLoginIdentifier(raw) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return Boolean(normalizeVietnamPhone(trimmed)) || EMAIL_PATTERN.test(trimmed);
}

/**
 * Thông báo lỗi bám theo thứ người dùng ĐANG gõ: gõ toàn số mà sai thì báo lỗi số
 * điện thoại, đừng báo "email không hợp lệ" — người dùng sẽ không hiểu sai ở đâu.
 */
export function getIdentifierError(raw) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) return "Vui lòng nhập email hoặc số điện thoại.";
  if (isValidLoginIdentifier(trimmed)) return "";
  return looksLikePhoneInput(trimmed)
    ? "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 03/05/07/08/09 hoặc 02)."
    : "Email không hợp lệ.";
}

export { EMAIL_PATTERN };

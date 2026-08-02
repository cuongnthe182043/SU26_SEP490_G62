/**
 * Tên hệ thống — một nguồn duy nhất.
 *
 * Trước đây mỗi nơi gọi hệ thống một kiểu: trang Swagger là "G62 Logistics API",
 * tiêu đề OpenAPI là "SEP490 G62 — Logistics API", còn web và app di động lại là
 * "LogisCount". Người dùng thấy ba cái tên cho cùng một sản phẩm.
 *
 * "LogisCount" là tên chính thức (đang dùng ở frontend/index.html, mobile/app.json và
 * tên công ty trong seed). Mọi chỗ hiển thị tên phải lấy từ đây.
 * Bản sao phía client: frontend/src/constants/brand.js, mobile/src/constants/brand.ts.
 */

const APP_NAME = 'LogisCount';
const APP_LEGAL_NAME = 'Phần mềm quản lý tài chính nội bộ LogisCount';
const API_TITLE = `${APP_NAME} — Logistics API`;

module.exports = { APP_NAME, APP_LEGAL_NAME, API_TITLE };

/**
 * Tên hệ thống và logo — một nguồn duy nhất cho web.
 *
 * Trước đây chuỗi "LogisCount" nằm rải rác ở 3 trang vai trò, Sidebar và 4 file export
 * Excel; đổi tên sản phẩm phải đi sửa từng chỗ và chắc chắn sót. Bản sao phía server:
 * backend/constants/brandConstants.js; phía mobile: mobile/src/constants/brand.ts.
 */

export const APP_NAME = "LogisCount";
export const APP_LEGAL_NAME = "Phần mềm quản lý tài chính nội bộ LogisCount";

// Logo tự đổi theo theme — dùng qua component theme/Logo.jsx, đừng trỏ thẳng file.
export const LOGO_LIGHT_SRC = "/logo.png";
export const LOGO_DARK_SRC = "/logodark.png";

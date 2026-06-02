export const ERROR_MESSAGES = {
  invalidCredential: 'Email hoặc mật khẩu không đúng.',
  inactiveAccount: 'Tài khoản đã bị vô hiệu hóa.',
  driverOnly: 'Tài khoản này không có quyền truy cập ứng dụng tài xế.',
  sessionExpired: 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.',
  network: 'Không thể kết nối đến máy chủ.',
  tripAlreadyClaimed: 'Đơn hàng này đã được tài xế khác nhận.',
  activeTripExists: 'Bạn đang có đơn hàng đang thực hiện.',
  claimFailed: 'Không thể nhận đơn hàng.',
  tripPoolLoadFailed: 'Không thể tải danh sách đơn hàng.',
  profileLoadFailed: 'Không thể tải hồ sơ.',
  notificationLoadFailed: 'Không thể tải thông báo.',
} as const;

export const appTheme = {
  colors: {
    // Brand
    primary: '#3B4FD8',
    primaryDark: '#2E40C0',
    primarySoft: '#EFF6FF',
    primaryMuted: '#BFCBF7',
    // Surfaces
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceSoft: '#F8FAFC',
    // Text
    text: '#111827',
    textMuted: '#64748B',
    // Border
    border: '#E2E8F0',
    // Semantic — base
    success: '#22C55E',
    danger: '#DC2626',
    warning: '#F59E0B',
    // Semantic — soft backgrounds
    successSoft: '#F0FDF4',
    dangerSoft: '#FEF2F2',
    warningSoft: '#FFFBEB',
    // Semantic — soft borders
    successBorder: '#BBF7D0',
    dangerBorder: '#FECACA',
    warningBorder: '#FDE68A',
    // Semantic — text on soft backgrounds
    successText: '#15803D',
    dangerText: '#B91C1C',
    warningText: '#92400E',
    warningTextMuted: '#A16207',
    // Status-specific (trip lifecycle)
    statusPicking: '#EA580C',
    statusPickingSoft: '#FFF7ED',
    statusPickingText: '#C2410C',
    statusTransit: '#3B82F6',
    statusTransitSoft: '#EFF6FF',
    statusTransitText: '#1D4ED8',
    statusReturning: '#A855F7',
    statusReturningSoft: '#FDF4FF',
    statusReturningText: '#7E22CE',
  },
  radius: {
    sm: 14,
    md: 20,
    lg: 28,
    xl: 34,
    pill: 999,
  },
  spacing: {
    screenX: 20,
    screenTop: 56,
    screenBottom: 30,
  },
  /**
   * Độ cao (elevation) của lớp phủ toàn màn hình trên Android.
   *
   * PHẢI có, và phải lớn hơn MỌI elevation khác trong app. Trên Android, `zIndex` chỉ
   * xếp thứ tự giữa các View CÙNG CHA; lớp phủ (toast/hộp xác nhận/thông báo) là anh em
   * với <Stack> ở gốc app, còn thanh tab nằm sâu trong cây của Stack — hai bên khác cha
   * nên zIndex của lớp phủ không hề so được với thanh tab. Thứ quyết định giữa hai nhánh
   * khác nhau là elevation.
   *
   * Nền mờ của hộp thoại trước đây chỉ có zIndex, elevation = 0, trong khi bottom-tab-bar
   * để elevation: 10 → trên Android thanh tab ĐÂM XUYÊN qua nền mờ và vẫn bấm được: hộp
   * "Đã gửi yêu cầu!" đang mở mà tài xế vẫn chuyển tab được sang màn chính.
   *
   * 24 vì elevation cao nhất còn lại trong app là 12 (thẻ hộp thoại). Đổi số này thì
   * kiểm tra lại `grep -rn "elevation:" src` để chắc chắn vẫn là lớn nhất.
   */
  overlayElevation: 24,
  typography: {
    fontFamily: {
      regular: 'GoogleSansRegular',
      medium: 'GoogleSansMedium',
      semiBold: 'GoogleSansSemiBold',
      bold: 'GoogleSansBold',
    },
    size: {
      xs: 12,
      sm: 13,
      md: 15,
      lg: 16,
      xl: 18,
      title: 26,
      display: 38,
    },
    lineHeight: {
      xs: 16,
      sm: 18,
      md: 22,
      lg: 24,
      title: 32,
      display: 44,
    },
    weight: {
      regular: '400',
      medium: '600',
      bold: '800',
      black: '900',
    },
  },
} as const;

export type AppTheme = typeof appTheme;

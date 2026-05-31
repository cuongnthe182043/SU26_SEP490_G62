export const appTheme = {
  colors: {
    primary: '#3B4FD8',
    primaryDark: '#2E40C0',
    primarySoft: '#EFF6FF',
    primaryMuted: '#BFCBF7',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceSoft: '#F8FAFC',
    text: '#111827',
    textMuted: '#64748B',
    border: '#E2E8F0',
    success: '#22C55E',
    danger: '#DC2626',
    warning: '#F59E0B',
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

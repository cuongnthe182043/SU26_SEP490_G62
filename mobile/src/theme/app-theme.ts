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

export const appTheme = {
  colors: {
    primary: '#6366F1',
    primaryDark: '#4F46E5',
    primarySoft: '#EEF2FF',
    primaryMuted: '#C7D2FE',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceSoft: '#F8FAFC',
    text: '#111827',
    textMuted: '#64748B',
    border: '#E2E8F0',
    success: '#22C55E',
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
} as const;

export type AppTheme = typeof appTheme;

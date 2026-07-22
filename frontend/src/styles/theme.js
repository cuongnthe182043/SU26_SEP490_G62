// Color palette — Material Design 3 inspired, mapped to G62 primary
export const C = {
  // Brand
  primary: '#3B4FD8',
  primaryDark: '#2E40C0',
  primarySoft: '#EFF6FF',
  primaryMuted: '#BFCBF7',

  // Surface scale (light mode)
  surface: '#F8F9FF',
  surfaceContainer: '#E5EEFF',
  surfaceContainerLow: '#EFF4FF',
  surfaceContainerHigh: '#DCE9FF',
  surfaceContainerHighest: '#D3E4FE',

  // Text
  onSurface: '#0B1C30',
  onSurfaceVariant: '#424751',
  outline: '#737782',
  outlineVariant: '#C2C6D3',

  // State: secondary-container (active nav)
  secondaryContainer: '#EFF6FF',
  onSecondaryContainer: '#3B4FD8',

  // Semantic
  error: '#BA1A1A',
  success: '#1E7E34',
  warning: '#B76E00',
};

export const appTheme = {
  token: {
    colorPrimary: C.primary,
    colorBgLayout: C.surface,
    borderRadius: 8,
    borderRadiusLG: 12,
    fontFamily: "'Geist', 'Google Sans', 'Open Sans', system-ui, sans-serif",
    colorLink: C.primary,
    colorLinkHover: C.primaryDark,
    colorBorder: C.outlineVariant,
    colorBorderSecondary: '#EEF2FF',
    colorText: C.onSurface,
    colorTextSecondary: C.onSurfaceVariant,
    colorBgContainer: '#ffffff',
  },
  components: {
    Layout: {
      siderBg: C.surface,
      headerBg: C.surface,
      bodyBg: C.surface,
    },
    Menu: {
      itemSelectedBg: C.secondaryContainer,
      itemSelectedColor: C.onSecondaryContainer,
      itemHoverBg: C.surfaceContainer,
      itemHoverColor: C.primary,
      itemActiveBg: C.secondaryContainer,
      itemBorderRadius: 8,
      itemMarginInline: 0,
      itemPaddingInline: 12,
      activeBarBorderWidth: 0,
      itemHeight: 42,
      iconSize: 18,
    },
    Table: {
      headerBg: C.surfaceContainerLow,
      headerColor: C.onSurfaceVariant,
      rowHoverBg: `${C.surfaceContainerLow}80`,
      borderColor: `${C.outlineVariant}50`,
      fontSize: 14,
    },
    Button: {
      borderRadius: 8,
      fontWeight: 500,
    },
    Input: { borderRadius: 8 },
    Select: { borderRadius: 8 },
    Modal: { borderRadiusLG: 14 },
    Tag: { borderRadius: 6 },
    Card: { borderRadiusLG: 14 },
  },
};

// Bảng màu nền tối — hơi ngả xanh cho khớp brand, chữ sáng nổi bật.
export const D = {
  bg: '#0e1016',
  surface: '#161922',
  surfaceElevated: '#1e2230',
  onSurface: '#e6e8ef',
  onSurfaceVariant: '#a9afc0',
  border: 'rgba(255,255,255,0.14)',
  borderSubtle: 'rgba(255,255,255,0.08)',
  primary: '#6B7BFF',
  primaryHover: '#8b97ff',
};

// Token AntD cho chế độ tối. Kết hợp với theme.darkAlgorithm ở App.
export const appThemeDark = {
  token: {
    colorPrimary: C.primary,
    borderRadius: 8,
    borderRadiusLG: 12,
    fontFamily: "'Geist', 'Google Sans', 'Open Sans', system-ui, sans-serif",
    colorLink: D.primaryHover,
    colorLinkHover: '#aab3ff',
    colorBgLayout: D.bg,
    colorBgContainer: D.surface,
    colorBgElevated: D.surfaceElevated,
    colorBorder: D.border,
    colorBorderSecondary: D.borderSubtle,
    colorText: D.onSurface,
    colorTextSecondary: D.onSurfaceVariant,
  },
  components: {
    Layout: {
      siderBg: D.bg,
      headerBg: D.bg,
      bodyBg: D.bg,
    },
    Menu: {
      itemSelectedBg: 'rgba(107,123,255,0.16)',
      itemSelectedColor: D.primaryHover,
      itemHoverBg: 'rgba(255,255,255,0.06)',
      itemHoverColor: '#c7ccff',
      itemActiveBg: 'rgba(107,123,255,0.16)',
      itemBorderRadius: 8,
      itemMarginInline: 0,
      itemPaddingInline: 12,
      activeBarBorderWidth: 0,
      itemHeight: 42,
      iconSize: 18,
    },
    Table: {
      headerBg: D.surfaceElevated,
      headerColor: D.onSurfaceVariant,
      rowHoverBg: 'rgba(255,255,255,0.04)',
      borderColor: 'rgba(255,255,255,0.10)',
      fontSize: 14,
    },
    Button: { borderRadius: 8, fontWeight: 500 },
    Input: { borderRadius: 8 },
    Select: { borderRadius: 8 },
    Modal: { borderRadiusLG: 14 },
    Tag: { borderRadius: 6 },
    Card: { borderRadiusLG: 14 },
  },
};

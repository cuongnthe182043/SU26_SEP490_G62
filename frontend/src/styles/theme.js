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

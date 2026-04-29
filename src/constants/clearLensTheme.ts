export const ClearLensColors = {
  navy: '#0A1430',
  slate: '#263248',
  emerald: '#10B981',
  emeraldDeep: '#0EA372',
  mint: '#A7F3D0',
  mint50: '#ECFDF5',
  lightGrey: '#E6EBF1',
  grey50: '#F2F4F8',
  background: '#FAFBFD',
  surface: '#FFFFFF',
  surfaceSoft: '#F4F7FA',
  textPrimary: '#0A1430',
  textSecondary: '#263248',
  textTertiary: '#7B8AA3',
  positive: '#10B981',
  negative: '#E5484D',
  negativeBg: '#FEEDEE',
  positiveBg: '#E7FAF2',
  amber: '#F59E0B',
  warning: '#D97706',
  border: '#DDE5EE',
  borderLight: '#E6EBF1',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#BAC6D8',
  shadow: '#0A1430',
};

export const ClearLensSemanticColors = {
  asset: {
    equity: ClearLensColors.emerald,
    debt: ClearLensColors.amber,
    cash: ClearLensColors.mint,
    other: ClearLensColors.lightGrey,
  },
  marketCap: {
    large: ClearLensColors.navy,
    mid: ClearLensColors.emerald,
    small: ClearLensColors.amber,
    other: ClearLensColors.lightGrey,
  },
  chart: {
    fund: ClearLensColors.emerald,
    portfolio: ClearLensColors.emerald,
    benchmark: ClearLensColors.slate,
    invested: ClearLensColors.navy,
    neutral: ClearLensColors.textTertiary,
  },
  fundAllocation: [
    ClearLensColors.emerald,
    ClearLensColors.navy,
    ClearLensColors.amber,
    ClearLensColors.negative,
    ClearLensColors.slate,
    ClearLensColors.mint,
  ],
  sentiment: {
    positive: ClearLensColors.positive,
    negative: ClearLensColors.negative,
    positiveText: '#087A5B',
    negativeText: '#B91C1C',
    positiveSurface: ClearLensColors.positiveBg,
    negativeSurface: ClearLensColors.negativeBg,
  },
  state: {
    loading: ClearLensColors.emerald,
    success: ClearLensColors.emerald,
    warning: ClearLensColors.amber,
    danger: ClearLensColors.negative,
    emptyIcon: ClearLensColors.emerald,
  },
  overlay: {
    backdrop: 'rgba(10,20,48,0.34)',
    darkDivider: 'rgba(255,255,255,0.28)',
    focusRing: 'rgba(16,185,129,0.25)',
  },
} as const;

export const ClearLensSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const ClearLensRadii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 999,
};

export const ClearLensFonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
};

export const ClearLensTypography = {
  hero: {
    fontFamily: ClearLensFonts.extraBold,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: 0,
  },
  h1: {
    fontFamily: ClearLensFonts.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: 0,
  },
  h2: {
    fontFamily: ClearLensFonts.bold,
    fontSize: 21,
    lineHeight: 28,
    letterSpacing: 0,
  },
  h3: {
    fontFamily: ClearLensFonts.semiBold,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: 0,
  },
  body: {
    fontFamily: ClearLensFonts.regular,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0,
  },
  bodySmall: {
    fontFamily: ClearLensFonts.regular,
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: 0,
  },
  label: {
    fontFamily: ClearLensFonts.semiBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1,
  },
  caption: {
    fontFamily: ClearLensFonts.medium,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0,
  },
};

export const ClearLensShadow = {
  shadowColor: ClearLensColors.shadow,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.07,
  shadowRadius: 20,
  elevation: 3,
};

export const ClearLensCompatibleColors = {
  primary: ClearLensColors.emerald,
  primaryDark: ClearLensColors.navy,
  primaryLight: ClearLensColors.mint,
  positive: ClearLensColors.emerald,
  negative: ClearLensColors.negative,
  warning: ClearLensColors.warning,
  background: ClearLensColors.background,
  surface: ClearLensColors.surface,
  surfaceAlt: ClearLensColors.surfaceSoft,
  border: ClearLensColors.border,
  borderLight: ClearLensColors.borderLight,
  textPrimary: ClearLensColors.textPrimary,
  textSecondary: ClearLensColors.textSecondary,
  textTertiary: ClearLensColors.textTertiary,
  textOnDark: ClearLensColors.textOnDark,
  gradientHero: [ClearLensColors.navy, ClearLensColors.slate] as [string, string],
  gradientHeader: [ClearLensColors.navy, ClearLensColors.slate] as [string, string],
};

/**
 * Clear Lens design tokens — colours, typography, spacing, radii.
 *
 * Two colour schemes share the same shape:
 *   - ClearLensLightColors (the original light theme)
 *   - ClearLensDarkColors  (added for the in-app dark mode)
 *
 * `ClearLensColors` is exported as the LIGHT palette for back-compat with
 * any module that imported it directly. Components that need to react to a
 * runtime scheme change should consume `useClearLensTokens()` from
 * `@/src/context/ThemeContext` instead.
 */

export type ClearLensColorScheme = 'light' | 'dark';

export interface ClearLensColorTokens {
  navy: string;
  slate: string;
  emerald: string;
  emeraldDeep: string;
  mint: string;
  mint50: string;
  lightGrey: string;
  grey50: string;
  background: string;
  surface: string;
  surfaceSoft: string;
  /**
   * Brand-dark surface used by hero cards, active segment/pill backgrounds,
   * and other places that want a distinctive dark accent. Stays dark in both
   * light and dark modes — `navy` itself doubles as a flipping text colour,
   * so anything that needs a stable dark surface should reach for this token
   * instead.
   */
  heroSurface: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  positive: string;
  negative: string;
  negativeBg: string;
  positiveBg: string;
  amber: string;
  warning: string;
  warningBg: string;
  accountSurface: string;
  accountBorder: string;
  border: string;
  borderLight: string;
  textOnDark: string;
  textOnDarkMuted: string;
  shadow: string;
}

export const ClearLensLightColors: ClearLensColorTokens = {
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
  heroSurface: '#0A1430',
  textPrimary: '#0A1430',
  textSecondary: '#263248',
  textTertiary: '#7B8AA3',
  positive: '#10B981',
  negative: '#E5484D',
  negativeBg: '#FEEDEE',
  positiveBg: '#E7FAF2',
  amber: '#F59E0B',
  warning: '#D97706',
  warningBg: '#FFF8E6',
  accountSurface: '#E7DFD2',
  accountBorder: '#CFC6B8',
  border: '#DDE5EE',
  borderLight: '#E6EBF1',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#BAC6D8',
  shadow: '#0A1430',
};

export const ClearLensDarkColors: ClearLensColorTokens = {
  // `navy` doubles as the primary text colour, so it flips to near-white in
  // dark mode. Anything that needs the deep brand-navy *surface* (hero cards,
  // active pill backgrounds, segment-active state) reaches for `heroSurface`
  // instead, which is brand-navy in both modes.
  navy: '#F2F5FB',
  slate: '#C5CFE0',
  emerald: '#34D399',
  emeraldDeep: '#10B981',
  // `mint` is consumed both as a soft surface accent and as a token-on-dark
  // accent in icons. Light mint reads against the dark canvas the same way
  // it reads against the light surface, so we keep it stable.
  mint: '#A7F3D0',
  mint50: '#0E2F25',
  // `lightGrey` is consumed as a chart "other" segment colour and as a soft
  // border/muted accent. Pick a mid-grey that reads against the dark canvas
  // (the previous #26314A merged with the page bg — the "navy on navy" bar
  // chart bug surfaced from review).
  lightGrey: '#4F5A78',
  grey50: '#1A2238',
  background: '#06101F',
  surface: '#121B33',
  surfaceSoft: '#19223D',
  // Lifted dark navy that stands clearly above `surfaceSoft` (and the page
  // bg) for active selections — the previous #1F2A4A was only a few % off
  // from the surrounding surfaces, which made selected pills/chips/segments
  // hard to spot in dark mode.
  heroSurface: '#34416B',
  textPrimary: '#F2F5FB',
  textSecondary: '#C5CFE0',
  textTertiary: '#8C9BB8',
  positive: '#34D399',
  negative: '#F87171',
  negativeBg: '#3A1A1F',
  positiveBg: '#0E3324',
  amber: '#FBBF24',
  warning: '#F59E0B',
  warningBg: '#3A2A0E',
  accountSurface: '#2A2418',
  accountBorder: '#4A4030',
  border: '#27314A',
  borderLight: '#1F2840',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#BAC6D8',
  shadow: '#000000',
};

export interface ClearLensSemanticTokens {
  asset: { equity: string; debt: string; cash: string; other: string };
  marketCap: { large: string; mid: string; small: string; other: string };
  chart: {
    fund: string;
    portfolio: string;
    benchmark: string;
    invested: string;
    neutral: string;
  };
  fundAllocation: readonly string[];
  sentiment: {
    positive: string;
    negative: string;
    positiveText: string;
    negativeText: string;
    positiveSurface: string;
    negativeSurface: string;
  };
  state: {
    loading: string;
    success: string;
    warning: string;
    danger: string;
    emptyIcon: string;
  };
  overlay: {
    backdrop: string;
    darkDivider: string;
    focusRing: string;
  };
}

function buildSemanticColors(c: ClearLensColorTokens, scheme: ClearLensColorScheme): ClearLensSemanticTokens {
  return {
    asset: {
      equity: c.emerald,
      debt: c.amber,
      cash: c.mint,
      other: c.lightGrey,
    },
    marketCap: {
      // `large` was `c.navy` historically, but `navy` flips to near-white in
      // dark mode, which leaves the bar segment indistinguishable from either
      // the surrounding dark canvas or a light surface depending on context.
      // Use stable greens instead — emerald for the anchor (Large), mint for
      // Mid, amber for Small. All three read against light AND dark canvases.
      large: c.emerald,
      mid: c.mint,
      small: c.amber,
      other: c.lightGrey,
    },
    chart: {
      fund: c.emerald,
      portfolio: c.emerald,
      benchmark: c.slate,
      // `invested` is used as a baseline/reference fill on charts. Use the
      // dark-stable hero surface so it never blends into the page bg in dark.
      invested: c.heroSurface,
      neutral: c.textTertiary,
    },
    // Palette used to colour fund allocation segments. The previous `c.navy`
    // entry rendered as near-black on light bg (fine) but flipped to near-white
    // on dark bg, which made the segment look like an empty track. Cycle
    // through six distinct hues that all read against both canvases.
    fundAllocation: [c.emerald, c.amber, c.negative, c.mint, c.slate, c.emeraldDeep],
    sentiment: {
      positive: c.positive,
      negative: c.negative,
      positiveText: scheme === 'dark' ? '#A7F3D0' : '#087A5B',
      negativeText: scheme === 'dark' ? '#FCA5A5' : '#B91C1C',
      positiveSurface: c.positiveBg,
      negativeSurface: c.negativeBg,
    },
    state: {
      loading: c.emerald,
      success: c.emerald,
      warning: c.amber,
      danger: c.negative,
      emptyIcon: c.emerald,
    },
    overlay: {
      backdrop: scheme === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(10,20,48,0.34)',
      darkDivider: 'rgba(255,255,255,0.28)',
      focusRing: 'rgba(16,185,129,0.25)',
    },
  };
}

export const ClearLensLightSemanticColors: ClearLensSemanticTokens = buildSemanticColors(
  ClearLensLightColors,
  'light',
);

export const ClearLensDarkSemanticColors: ClearLensSemanticTokens = buildSemanticColors(
  ClearLensDarkColors,
  'dark',
);

export interface ClearLensCompatibleTokens {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  positive: string;
  negative: string;
  warning: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderLight: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnDark: string;
  gradientHero: [string, string];
  gradientHeader: [string, string];
}

function buildCompatibleColors(c: ClearLensColorTokens, scheme: ClearLensColorScheme): ClearLensCompatibleTokens {
  const heroStart = scheme === 'dark' ? '#040A1A' : c.navy;
  const heroEnd = scheme === 'dark' ? '#0F1A33' : c.slate;
  return {
    primary: c.emerald,
    primaryDark: scheme === 'dark' ? c.surface : c.navy,
    primaryLight: c.mint,
    positive: c.emerald,
    negative: c.negative,
    warning: c.warning,
    background: c.background,
    surface: c.surface,
    surfaceAlt: c.surfaceSoft,
    border: c.border,
    borderLight: c.borderLight,
    textPrimary: c.textPrimary,
    textSecondary: c.textSecondary,
    textTertiary: c.textTertiary,
    textOnDark: c.textOnDark,
    gradientHero: [heroStart, heroEnd],
    gradientHeader: [heroStart, heroEnd],
  };
}

export const ClearLensLightCompatibleColors: ClearLensCompatibleTokens = buildCompatibleColors(
  ClearLensLightColors,
  'light',
);

export const ClearLensDarkCompatibleColors: ClearLensCompatibleTokens = buildCompatibleColors(
  ClearLensDarkColors,
  'dark',
);

// Back-compat re-exports — modules that imported these directly continue to
// receive the LIGHT palette. To support a runtime scheme switch, switch the
// importer to `useClearLensTokens()` (see `@/src/context/ThemeContext`).
export const ClearLensColors = ClearLensLightColors;
export const ClearLensSemanticColors = ClearLensLightSemanticColors;
export const ClearLensCompatibleColors = ClearLensLightCompatibleColors;

export interface ClearLensTokens {
  scheme: ClearLensColorScheme;
  colors: ClearLensColorTokens;
  semantic: ClearLensSemanticTokens;
  compatible: ClearLensCompatibleTokens;
}

export const ClearLensLightTokens: ClearLensTokens = {
  scheme: 'light',
  colors: ClearLensLightColors,
  semantic: ClearLensLightSemanticColors,
  compatible: ClearLensLightCompatibleColors,
};

export const ClearLensDarkTokens: ClearLensTokens = {
  scheme: 'dark',
  colors: ClearLensDarkColors,
  semantic: ClearLensDarkSemanticColors,
  compatible: ClearLensDarkCompatibleColors,
};

export function getClearLensTokens(scheme: ClearLensColorScheme): ClearLensTokens {
  return scheme === 'dark' ? ClearLensDarkTokens : ClearLensLightTokens;
}

// ─── Layout/typography tokens (scheme-agnostic) ─────────────────────────────

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
  shadowColor: ClearLensLightColors.shadow,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.07,
  shadowRadius: 20,
  elevation: 3,
};

/**
 * FundLens design tokens — single source of truth for colours, spacing, and typography.
 *
 * Palette: deep navy primary, warm white surface, slate accents.
 * Chosen to feel trustworthy (financial), not gimmicky.
 */

export const Colors = {
  // Brand
  primary: '#1a56db',      // Electric blue — CTAs, interactive elements
  primaryDark: '#1341a8',  // Pressed state, dark contexts
  primaryLight: '#eff4ff', // Tint for banners, selected states

  // Semantic
  positive: '#16a34a', // Green — gains, beats benchmark
  negative: '#dc2626', // Red — losses, lags benchmark
  warning: '#d97706',  // Amber — caution states

  // Surfaces
  background: '#f8fafc',  // Off-white page bg
  surface: '#ffffff',      // Card / panel bg
  surfaceAlt: '#fafbfc',  // Subtle alt surface

  // Borders
  border: '#e2e8f0',
  borderLight: '#f1f5f9',

  // Text
  textPrimary: '#0f172a',   // Headings, important values
  textSecondary: '#475569', // Body text, descriptions
  textTertiary: '#94a3b8',  // Labels, placeholders, meta
  textOnDark: '#ffffff',

  // Gradients (start/end for LinearGradient)
  gradientHero: ['#0f172a', '#1e3a5f'] as [string, string],
  gradientCard: ['#1a56db', '#1341a8'] as [string, string],
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Typography = {
  hero: { fontSize: 38, fontWeight: '800' as const, letterSpacing: -1 },
  h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, lineHeight: 20 },
  label: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.5 },
  caption: { fontSize: 10, fontWeight: '500' as const, letterSpacing: 0.4 },
};

/**
 * FundLens V2 design tokens — "Editorial Wealth" palette.
 *
 * Palette: navy blue primary — trust, authority, editorial finance.
 * Derived from the designer's DESIGN.md concept document.
 *
 * Shape is identical to Colors in theme.ts for safe type interop.
 */

export const ColorsV2 = {
  // Brand
  primary: '#003d9b',      // Navy blue — trust, editorial
  primaryDark: '#002a6e',  // Darker navy — pressed states, gradient start
  primaryLight: '#e8eef9', // Blue tint — banners, highlights

  // Semantic
  positive: '#006c47', // Growth green (designer's secondary)
  negative: '#c0392b', // Red — losses, lags benchmark
  warning: '#d97706',  // Amber — caution states (unchanged)

  // Surfaces
  background: '#f8f9fb',  // Cooler off-white
  surface: '#ffffff',
  surfaceAlt: '#f3f6fb',  // Blue-tinted alt surface

  // Borders
  border: '#dde4ee',      // Blue-tinted border
  borderLight: '#edf0f7',

  // Text
  textPrimary: '#0b1221',   // Near-black with blue cast
  textSecondary: '#4a5568', // Body text, descriptions
  textTertiary: '#9babc0',  // Labels, placeholders, meta
  textOnDark: '#ffffff',

  // Gradients (start/end for LinearGradient)
  gradientHero: ['#001233', '#003d9b'] as [string, string],
  gradientHeader: ['#001a5c', '#003d9b'] as [string, string], // deep navy
};

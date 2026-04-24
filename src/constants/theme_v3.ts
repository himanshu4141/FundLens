/**
 * FundLens V3 design tokens — "Clear Lens" palette.
 *
 * Palette: forest teal primary + warm cream surfaces.
 * Brand concept: Clarity over noise. Clarity in every decision.
 * Tagline: Clarity. Comparison. Confidence.
 *
 * Distinguishing traits vs V1/V2:
 *  - Warm cream/parchment surfaces (not cold white) — surfaceAlt, background
 *  - Deep forest teal primary with dark charcoal headers
 *  - Emerald accent (distinct from brand primary) for gains/positive
 *
 * Shape is identical to Colors in theme.ts for safe type interop.
 */

export const ColorsV3 = {
  // Brand
  primary: '#016150',      // Forest teal — clarity, growth, nature
  primaryDark: '#014A3C',  // Darker forest — pressed states, gradient start
  primaryLight: '#E6F3EF', // Light teal tint — banners, highlights

  // Semantic
  positive: '#3DAA8A', // Emerald — gains, beats benchmark (distinct from brand primary)
  negative: '#C0392B', // Red — losses, lags benchmark
  warning: '#D97706',  // Amber — caution states

  // Surfaces
  background: '#FAF8F3',  // Warm off-white — signature V3 warmth
  surface: '#FFFEF9',      // Card / panel bg — very slightly warm (vs V1/V2 cold white)
  surfaceAlt: '#F5EDD8',  // Warm cream/parchment — accent surfaces, highlighted cards

  // Borders
  border: '#DDE8E3',      // Teal-tinted border
  borderLight: '#EDF4F1', // Light teal border

  // Text
  textPrimary: '#1A2B28',   // Dark charcoal-teal — headings, important values
  textSecondary: '#4A6560', // Muted teal-gray — body text, descriptions
  textTertiary: '#8CA8A0',  // Light teal-gray — labels, placeholders, meta
  textOnDark: '#FFFFFF',

  // Gradients (start/end for LinearGradient)
  gradientHero: ['#1A2B28', '#016150'] as [string, string],
  gradientHeader: ['#1A2B28', '#016150'] as [string, string], // dark charcoal → forest teal
};

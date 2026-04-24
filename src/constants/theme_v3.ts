/**
 * FundLens V3 design tokens — "Clear Lens" palette.
 *
 * Brand concept: Clarity over noise. Clarity in every decision.
 * Tagline: Clarity. Comparison. Confidence.
 *
 * The defining visual identity of V3 is WARMTH — a parchment/cream world
 * that immediately reads as different from V1's cold teal or V2's cold navy.
 *
 *   background  = warm parchment (#F5EDD8) — the full page canvas
 *   surface     = warm white (#FFFCF5)     — cards lifting off the parchment
 *   surfaceAlt  = deep cream (#EDD9B5)     — stats sections, emphasis
 *   primary     = deep forest teal (#016150)
 *   header      = charcoal #1A2B28 → forest #016150 (visually distinct from V1 green-on-green)
 *
 * Shape is identical to Colors in theme.ts for safe type interop.
 */

export const ColorsV3 = {
  // Brand
  primary: '#016150',      // Forest teal — clarity, growth, nature
  primaryDark: '#014A3C',  // Darker forest — pressed states, gradient start
  primaryLight: '#D4EDE5', // Teal tint on parchment — banners, highlights

  // Semantic
  positive: '#2D8A6E', // Emerald — gains (tuned for legibility on warm cream bg)
  negative: '#B83030', // Deep red — losses (warmer red vs cold V1 #dc2626)
  warning: '#C07020',  // Warm amber — caution (tuned for warm palette)

  // Surfaces — the defining V3 differentiator
  background: '#F5EDD8',  // Warm parchment — THE signature V3 background
  surface: '#FFFCF5',     // Warm white — cards float above parchment
  surfaceAlt: '#EDD9B5',  // Deep cream — stats footers, emphasis sections

  // Borders — warm-tinted to harmonise with parchment
  border: '#D9C9A8',      // Warm sand border
  borderLight: '#EAD9BA', // Light warm border

  // Text — warm-tinted darks for legibility on parchment
  textPrimary: '#1A2B28',   // Dark charcoal-teal
  textSecondary: '#4A6050', // Muted warm-teal — body text
  textTertiary: '#8A7A60',  // Warm khaki — labels, placeholders
  textOnDark: '#FFFFFF',

  // Gradients — charcoal to forest teal (high-contrast; V1 is green-on-green)
  gradientHero: ['#1A2B28', '#016150'] as [string, string],
  gradientHeader: ['#1A2B28', '#016150'] as [string, string],
};

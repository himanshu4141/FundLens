/**
 * FundLens V3 design tokens — "Clear Lens" palette.
 *
 * Brand concept: Clarity. Comparison. Confidence.
 * Font: Inter (loaded in app/_layout.tsx)
 *
 * Palette source: brand guide swatches (cool navy + vivid emerald, zero warm tones)
 *   #0B132B — near-black navy   — header gradient start, darkest text
 *   #1E293B — dark slate        — gradient end, secondary text
 *   #12B886 — vivid emerald     — PRIMARY brand colour, positive indicator
 *   #A7F3D0 — pale mint         — primaryLight, banners, card tints
 *   #E5E7EB — cool light grey   — borders, surfaceAlt
 *   #F8FAFC — cool off-white    — page canvas (NOT warm, NOT teal)
 */

export const ColorsV3 = {
  // Brand
  primary: '#12B886',       // vivid emerald — THE brand colour
  primaryDark: '#0E9970',   // darker emerald — pressed states
  primaryLight: '#A7F3D0',  // pale mint — banners, back buttons, card footer tints

  // Semantic
  positive: '#12B886',      // gains = brand emerald
  negative: '#EF4444',      // losses — red
  warning: '#F59E0B',       // caution — amber

  // Surfaces
  background: '#F8FAFC',    // cool off-white — page canvas
  surface: '#FFFFFF',       // pure white — cards float above canvas
  surfaceAlt: '#E5E7EB',    // cool light grey — stats footers, expanded panels

  // Borders
  border: '#E5E7EB',
  borderLight: '#F1F5F9',

  // Text — dark navy family
  textPrimary: '#0B132B',   // near-black navy — headings, key numbers
  textSecondary: '#1E293B', // dark slate — body text
  textTertiary: '#64748B',  // muted slate — labels, placeholders
  textOnDark: '#FFFFFF',

  // Gradients — dark navy to dark slate (header bar)
  gradientHero: ['#0B132B', '#1E293B'] as [string, string],
  gradientHeader: ['#0B132B', '#1E293B'] as [string, string],
};

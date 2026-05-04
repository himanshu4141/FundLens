/**
 * Shared layout tokens — spacing, radii, and typography scales.
 *
 * The Classic colour palette that used to live alongside these tokens has been
 * removed in favour of `clearLensTheme.ts`. Use `useClearLensTokens()` from
 * `@/src/context/ThemeContext` for any colour the active scheme should drive,
 * or import the static `ClearLensFonts`/`ClearLensSpacing` constants directly
 * for layout values.
 *
 * These structural tokens are kept here for back-compat with components that
 * still pass `Spacing`, `Radii`, or `Typography` to local makeStyles factories.
 * Prefer the Clear Lens equivalents (`ClearLensSpacing`, `ClearLensRadii`,
 * `ClearLensTypography`) when adding new code.
 */

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

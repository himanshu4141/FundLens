import { DESKTOP_MIN_WIDTH } from '@/src/components/responsive/desktopBreakpoints';

export type ResponsiveLayout = 'mobile' | 'desktop';

/**
 * Pure breakpoint resolver, extracted so the decision can be unit-tested
 * without mocking React Native's `useWindowDimensions`. Native platforms
 * (iOS / Android binaries) always resolve to `mobile`; web resolves to
 * `desktop` at or above the breakpoint.
 */
export function resolveResponsiveLayout(width: number, isWeb: boolean): ResponsiveLayout {
  if (!isWeb) return 'mobile';
  return width >= DESKTOP_MIN_WIDTH ? 'desktop' : 'mobile';
}

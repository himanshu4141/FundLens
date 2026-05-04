import { Platform, useWindowDimensions } from 'react-native';
import { DESKTOP_MIN_WIDTH } from './desktopBreakpoints';

export type ResponsiveLayout = 'mobile' | 'desktop';

export function useResponsiveLayout(): { layout: ResponsiveLayout; width: number } {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return { layout: 'mobile', width };
  return { layout: width >= DESKTOP_MIN_WIDTH ? 'desktop' : 'mobile', width };
}

export function useIsDesktop(): boolean {
  return useResponsiveLayout().layout === 'desktop';
}

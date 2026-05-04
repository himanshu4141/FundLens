import { Platform, useWindowDimensions } from 'react-native';
import { resolveResponsiveLayout, type ResponsiveLayout } from '@/src/utils/responsiveLayout';

export type { ResponsiveLayout };

export function useResponsiveLayout(): { layout: ResponsiveLayout; width: number } {
  const { width } = useWindowDimensions();
  return { layout: resolveResponsiveLayout(width, Platform.OS === 'web'), width };
}

export function useIsDesktop(): boolean {
  return useResponsiveLayout().layout === 'desktop';
}

import { ReactNode, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { ClearLensSpacing, type ClearLensTokens } from '@/src/constants/clearLensTheme';
import { useClearLensTokens } from '@/src/context/ThemeContext';
import { useResponsiveLayout } from './useResponsiveLayout';
import { ResponsiveRouteFrame } from './ResponsiveRouteFrame';

/**
 * Desktop wrapper for "form-style" screens (onboarding wizards, settings forms,
 * post-auth pages with vertical content) that don't need the full max-content
 * width. On desktop the children are centered in a 720px column inside the
 * sidebar shell. On mobile the children render unchanged.
 *
 * Use for: onboarding/index, onboarding/pdf. Not for the auth screens — those
 * have their own pre-auth desktop layout (no sidebar).
 */
export function DesktopFormFrame({
  children,
  maxWidth = 720,
}: {
  children: ReactNode;
  maxWidth?: number;
}) {
  const { layout } = useResponsiveLayout();
  const tokens = useClearLensTokens();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  if (layout !== 'desktop') return <>{children}</>;
  return (
    <ResponsiveRouteFrame>
      <View style={[styles.frame, { maxWidth }]}>{children}</View>
    </ResponsiveRouteFrame>
  );
}

function makeStyles(tokens: ClearLensTokens) {
  return StyleSheet.create({
    frame: {
      flex: 1,
      width: '100%',
      alignSelf: 'center',
      paddingHorizontal: ClearLensSpacing.md,
      backgroundColor: tokens.colors.background,
    },
  });
}

import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { ClearLensSpacing } from '@/src/constants/clearLensTheme';
import { MaxContentWidth } from './desktopBreakpoints';

interface Props {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Centers a screen's content within the desktop max-content-width column with
 * the standard horizontal padding. Use inside <DesktopShell framed={false}>
 * when a screen wants to opt out of the shell's default max-width frame and
 * apply its own.
 */
export function DesktopContainer({ children, style }: Props) {
  return (
    <View style={styles.outer}>
      <View style={[styles.inner, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: ClearLensSpacing.xl,
    paddingVertical: ClearLensSpacing.lg,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: ClearLensSpacing.md,
  },
});

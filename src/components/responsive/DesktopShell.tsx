import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ClearLensColors, ClearLensSpacing } from '@/src/constants/clearLensTheme';
import { DesktopSidebar } from './DesktopSidebar';
import { MaxContentWidth } from './desktopBreakpoints';

interface Props {
  children: ReactNode;
  /**
   * When false the children are rendered without the inner scrollable, max-width
   * content frame — useful for screens that need to control their own scroll
   * region (e.g. a master-detail page that scrolls panes independently).
   */
  framed?: boolean;
}

export function DesktopShell({ children, framed = true }: Props) {
  return (
    <View style={styles.shell}>
      <DesktopSidebar />
      {framed ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentFrame}>{children}</View>
        </ScrollView>
      ) : (
        <View style={styles.unframed}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: ClearLensColors.background,
    minHeight: '100%',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: ClearLensSpacing.xl,
    paddingTop: ClearLensSpacing.lg,
    paddingBottom: ClearLensSpacing.xxl,
    alignItems: 'center',
  },
  contentFrame: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: ClearLensSpacing.md,
  },
  unframed: {
    flex: 1,
  },
});

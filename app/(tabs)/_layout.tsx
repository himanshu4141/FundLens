import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/context/ThemeContext';
import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import { ClearLensColors, ClearLensFonts } from '@/src/constants/clearLensTheme';
import { DesktopSidebar, useResponsiveLayout } from '@/src/components/responsive';

/**
 * Renders the same `<Tabs>` navigator in both layouts. On desktop the bottom
 * tab bar is hidden via `display: none` and the Clear Lens sidebar is rendered
 * as a sibling to the left. Keeping the navigator instance mounted across the
 * mobile↔desktop breakpoint preserves the active route and any per-screen
 * state when the user resizes the browser window.
 */
export default function TabLayout() {
  const { colors } = useTheme();
  const { isClearLens } = useAppDesignMode();
  const insets = useSafeAreaInsets();
  const { layout } = useResponsiveLayout();
  const isDesktop = layout === 'desktop';

  const activeTint = isClearLens ? ClearLensColors.emerald : colors.primary;
  const inactiveTint = isClearLens ? ClearLensColors.textTertiary : colors.textTertiary;
  const borderTopColor = isClearLens ? ClearLensColors.borderLight : colors.borderLight;

  return (
    <View style={[styles.shell, isDesktop && styles.shellDesktop]}>
      <View style={[styles.sidebarSlot, !isDesktop && styles.hidden]}>
        {isDesktop ? <DesktopSidebar /> : null}
      </View>
      <View style={styles.contentSlot}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: activeTint,
            tabBarInactiveTintColor: inactiveTint,
            headerShown: false,
            tabBarStyle: isDesktop
              ? { display: 'none' }
              : {
                  backgroundColor: isClearLens ? ClearLensColors.surface : undefined,
                  borderTopColor,
                  borderTopWidth: 1,
                  elevation: 0,
                  shadowOpacity: 0,
                  // Give the icon + label stack enough vertical room on phone-sized
                  // viewports where font metrics tend to clip label descenders. The
                  // bar grows tall enough to fit a two-line label ("Wealth Journey")
                  // on narrow widths without clipping the icon above it.
                  paddingTop: isClearLens ? 6 : 8,
                  paddingBottom: Math.max(insets.bottom, isClearLens ? 10 : 14),
                  height: (isClearLens ? 78 : 86) + Math.max(insets.bottom, isClearLens ? 10 : 14),
                },
            // Force each visible tab item to fill its fair share of the bar width
            // and center content so icons don't bunch left on wider screens / web
            tabBarItemStyle: {
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingTop: 4,
              paddingBottom: 6,
            },
            tabBarIconStyle: {
              marginTop: 2,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
              fontFamily: isClearLens ? ClearLensFonts.semiBold : undefined,
              lineHeight: 14,
              marginTop: isClearLens ? 2 : 3,
              marginBottom: isClearLens ? 0 : 2,
              textAlign: 'center',
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Portfolio',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="pie-chart-outline" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="leaderboard"
            options={{
              title: isClearLens ? 'Funds' : 'Leaderboard',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name={isClearLens ? 'list-outline' : 'trophy-outline'} size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="wealth-journey"
            options={{
              title: 'Wealth Journey',
              freezeOnBlur: isClearLens,
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="calculator-outline" size={size} color={color} />
              ),
            }}
          />
          {/* Settings hidden from tab bar — accessible via the shared overflow menu */}
          <Tabs.Screen
            name="settings"
            options={{
              tabBarButton: () => null,
              tabBarItemStyle: { display: 'none' },
            }}
          />
          {/* Compare deprecated — route kept to avoid broken deep-links during transition */}
          <Tabs.Screen
            name="compare"
            options={{
              tabBarButton: () => null,
              tabBarItemStyle: { display: 'none' },
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: ClearLensColors.background,
  },
  shellDesktop: {
    flexDirection: 'row',
  },
  sidebarSlot: {
    // Width is set by DesktopSidebar (240px); on mobile the slot is hidden.
  },
  hidden: {
    display: 'none',
  },
  contentSlot: {
    flex: 1,
  },
});

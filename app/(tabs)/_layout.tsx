import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/context/ThemeContext';

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        headerShown: false,
        tabBarStyle: {
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
          // Ensure the bar clears the home indicator / gesture nav bar on all devices
          paddingBottom: insets.bottom,
          height: 49 + insets.bottom,
        },
        // Force each visible tab item to fill its fair share of the bar width
        // and center content so icons don't bunch left on wider screens / web
        tabBarItemStyle: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 2,
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
          title: 'Leaderboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="simulator"
        options={{
          title: 'Simulator',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calculator-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Settings hidden from tab bar — accessible via gear icon in each screen's header */}
      <Tabs.Screen
        name="settings"
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { width: 0, overflow: 'hidden' },
        }}
      />
      {/* Compare deprecated — route kept to avoid broken deep-links during transition */}
      <Tabs.Screen
        name="compare"
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { width: 0, overflow: 'hidden' },
        }}
      />
    </Tabs>
  );
}

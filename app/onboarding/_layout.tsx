import { Stack } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useResponsiveLayout } from '@/src/components/responsive';
import { ClearLensFonts } from '@/src/constants/clearLensTheme';

export default function OnboardingLayout() {
  const { clearLens } = useTheme();
  const cl = clearLens.colors;
  const { layout } = useResponsiveLayout();
  const isDesktop = layout === 'desktop';

  // On desktop the sidebar provides nav and each onboarding screen renders
  // its own hero block ("Upload a CAS PDF", "Import your portfolio"). Showing
  // the Stack's "Upload PDF" / "Import CAS" header on top of that creates a
  // duplicate-title row, so suppress it.
  return (
    <Stack
      screenOptions={
        isDesktop
          ? { headerShown: false }
          : {
              headerStyle: { backgroundColor: cl.background },
              headerShadowVisible: false,
              headerTintColor: cl.navy,
              headerTitleStyle: {
                color: cl.navy,
                fontFamily: ClearLensFonts.bold,
                fontWeight: '700',
              },
            }
      }
    >
      <Stack.Screen name="index" options={{ title: 'Import CAS' }} />
      <Stack.Screen name="pdf" options={{ title: 'Upload PDF' }} />
    </Stack>
  );
}

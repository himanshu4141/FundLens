import { Stack } from 'expo-router';
import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import { useResponsiveLayout } from '@/src/components/responsive';
import {
  ClearLensColors,
  ClearLensFonts,
} from '@/src/constants/clearLensTheme';

export default function OnboardingLayout() {
  const { isClearLens } = useAppDesignMode();
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
          : isClearLens
            ? {
                headerStyle: { backgroundColor: ClearLensColors.background },
                headerShadowVisible: false,
                headerTintColor: ClearLensColors.navy,
                headerTitleStyle: {
                  color: ClearLensColors.navy,
                  fontFamily: ClearLensFonts.bold,
                  fontWeight: '700',
                },
              }
            : undefined
      }
    >
      <Stack.Screen name="index" options={{ title: 'Import CAS' }} />
      <Stack.Screen name="pdf" options={{ title: 'Upload PDF' }} />
    </Stack>
  );
}

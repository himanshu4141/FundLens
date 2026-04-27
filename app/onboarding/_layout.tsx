import { Stack } from 'expo-router';
import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import {
  ClearLensColors,
  ClearLensFonts,
} from '@/src/constants/clearLensTheme';

export default function OnboardingLayout() {
  const { isClearLens } = useAppDesignMode();

  return (
    <Stack
      screenOptions={isClearLens ? {
        headerStyle: { backgroundColor: ClearLensColors.background },
        headerShadowVisible: false,
        headerTintColor: ClearLensColors.navy,
        headerTitleStyle: {
          color: ClearLensColors.navy,
          fontFamily: ClearLensFonts.bold,
          fontWeight: '700',
        },
      } : undefined}
    >
      <Stack.Screen name="index" options={{ title: 'Import CAS' }} />
      <Stack.Screen name="pdf" options={{ title: 'Upload PDF' }} />
    </Stack>
  );
}

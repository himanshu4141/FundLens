import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Import CAS' }} />
      <Stack.Screen name="qr" options={{ title: 'MFcentral QR' }} />
      <Stack.Screen name="pdf" options={{ title: 'Upload PDF' }} />
    </Stack>
  );
}

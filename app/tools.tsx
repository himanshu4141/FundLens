import { Stack } from 'expo-router';
import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import { ClearLensToolsScreen } from '@/src/components/clearLens/screens/ClearLensToolsScreen';

export default function ToolsRoute() {
  const { isClearLens } = useAppDesignMode();

  return (
    <>
      <Stack.Screen options={{ headerShown: !isClearLens, title: 'Tools' }} />
      {isClearLens ? <ClearLensToolsScreen /> : null}
    </>
  );
}

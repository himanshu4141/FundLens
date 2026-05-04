import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import { ClearLensToolsScreen } from '@/src/components/clearLens/screens/ClearLensToolsScreen';
import { ResponsiveRouteFrame } from '@/src/components/responsive';

export default function ToolsRoute() {
  const { isClearLens } = useAppDesignMode();
  if (!isClearLens) return null;
  return (
    <ResponsiveRouteFrame>
      <ClearLensToolsScreen />
    </ResponsiveRouteFrame>
  );
}

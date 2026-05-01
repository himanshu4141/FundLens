import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import { ClearLensToolsScreen } from '@/src/components/clearLens/screens/ClearLensToolsScreen';

export default function ToolsRoute() {
  const { isClearLens } = useAppDesignMode();
  return isClearLens ? <ClearLensToolsScreen /> : null;
}

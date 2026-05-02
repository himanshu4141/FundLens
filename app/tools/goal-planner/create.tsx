import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import { ClearLensCreateGoalScreen } from '@/src/components/clearLens/screens/tools/ClearLensCreateGoalScreen';

export default function CreateGoalRoute() {
  const { isClearLens } = useAppDesignMode();
  return isClearLens ? <ClearLensCreateGoalScreen /> : null;
}

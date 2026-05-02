import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import { ClearLensGoalSummaryScreen } from '@/src/components/clearLens/screens/tools/ClearLensGoalSummaryScreen';

export default function GoalSummaryRoute() {
  const { isClearLens } = useAppDesignMode();
  return isClearLens ? <ClearLensGoalSummaryScreen /> : null;
}

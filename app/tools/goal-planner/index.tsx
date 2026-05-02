import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import { ClearLensGoalPlannerScreen } from '@/src/components/clearLens/screens/tools/ClearLensGoalPlannerScreen';

export default function GoalPlannerRoute() {
  const { isClearLens } = useAppDesignMode();
  return isClearLens ? <ClearLensGoalPlannerScreen /> : null;
}

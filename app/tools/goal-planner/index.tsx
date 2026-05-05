import { ClearLensGoalPlannerScreen } from '@/src/components/clearLens/screens/tools/ClearLensGoalPlannerScreen';
import { ResponsiveRouteFrame } from '@/src/components/responsive';

export default function GoalPlannerRoute() {
  return (
    <ResponsiveRouteFrame>
      <ClearLensGoalPlannerScreen />
    </ResponsiveRouteFrame>
  );
}

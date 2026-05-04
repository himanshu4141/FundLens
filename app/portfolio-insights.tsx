import { Stack } from 'expo-router';
import { ClearLensPortfolioInsightsScreen } from '@/src/components/clearLens/screens/ClearLensPortfolioInsightsScreen';
import { ResponsiveRouteFrame } from '@/src/components/responsive';

export default function PortfolioInsightsScreen() {
  return (
    <ResponsiveRouteFrame>
      <Stack.Screen options={{ headerShown: false, title: 'Portfolio Insights' }} />
      <ClearLensPortfolioInsightsScreen />
    </ResponsiveRouteFrame>
  );
}

import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { Spacing, Typography } from '@/src/constants/theme';
import { usePortfolio } from '@/src/hooks/usePortfolio';
import { usePortfolioInsights } from '@/src/hooks/usePortfolioInsights';
import { useAppStore } from '@/src/store/appStore';
import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import { ClearLensPortfolioInsightsScreen } from '@/src/components/clearLens/screens/ClearLensPortfolioInsightsScreen';
import { AssetMixCard } from '@/src/components/insights/AssetMixCard';
import { DebtCard } from '@/src/components/insights/DebtCard';
import { MarketCapCard } from '@/src/components/insights/MarketCapCard';
import { SectorCard } from '@/src/components/insights/SectorCard';
import { TopHoldingsCard } from '@/src/components/insights/TopHoldingsCard';
import { Ionicons } from '@expo/vector-icons';

function ClassicPortfolioInsightsScreen() {
  const { colors } = useTheme();
  const { defaultBenchmarkSymbol } = useAppStore();

  const { data } = usePortfolio(defaultBenchmarkSymbol);
  const fundCards = data?.fundCards ?? [];

  const { insights, isLoading, isStale, isSyncing, triggerSync, hasNoData } =
    usePortfolioInsights(fundCards);
  const didAutoTrigger = useRef(false);

  // Auto-trigger sync on first visit if no data or stale
  useEffect(() => {
    if (!didAutoTrigger.current && (hasNoData || isStale) && !isSyncing) {
      didAutoTrigger.current = true;
      triggerSync();
    }
  }, [hasNoData, isStale, isSyncing, triggerSync]);

  const styles = makeStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Syncing in progress */}
        {isSyncing && (
          <View style={[styles.syncBanner, { backgroundColor: colors.primaryLight }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.syncText, { color: colors.primary }]}>
              Syncing portfolio composition data…
            </Text>
          </View>
        )}

        {/* Stale data — not currently syncing */}
        {isStale && !isSyncing && (
          <TouchableOpacity
            style={[styles.staleBanner, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}
            onPress={() => triggerSync()}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={14} color="#d97706" />
            <Text style={styles.staleText}>
              Data is outdated · Tap to refresh
            </Text>
          </TouchableOpacity>
        )}

        {/* Estimated data notice — shown when composition comes from category rules, not actual AMFI data */}
        {insights && insights.dataSource === 'category_rules' && !isSyncing && (
          <View style={[styles.estimateBanner, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} style={styles.estimateIcon} />
            <View style={styles.estimateTextBlock}>
              <Text style={[styles.estimateHeading, { color: colors.primary }]}>Showing estimated data</Text>
              <Text style={[styles.estimateBody, { color: colors.primary }]}>
                Asset mix and market cap figures are derived from SEBI&apos;s fund category framework,
                not actual holdings. Real sector and stock data loads automatically each month
                from AMFI portfolio disclosures.
              </Text>
            </View>
          </View>
        )}

        {isLoading || (hasNoData && isSyncing) ? (
          <LoadingSkeleton colors={colors} />
        ) : !insights ? (
          <NoDataState colors={colors} isSyncing={isSyncing} onSync={triggerSync} />
        ) : (
          <>
            {/* Asset Mix — overview of equity/debt/cash split */}
            <AssetMixCard
              totalValue={insights.totalValue}
              assetMix={insights.assetMix}
              source={insights.dataSource}
              dataAsOf={insights.dataAsOf}
            />

            {/* Debt & Cash — shown if portfolio has meaningful non-equity exposure */}
            {(insights.assetMix.debt >= 1 || insights.assetMix.cash >= 5) && (
              <DebtCard
                totalValue={insights.totalValue}
                debtPct={insights.assetMix.debt}
                cashPct={insights.assetMix.cash}
                debtFunds={insights.debtFunds}
              />
            )}

            {/* Market Cap Mix — equity composition */}
            {insights.assetMix.equity > 5 && (
              <MarketCapCard
                totalValue={insights.totalValue}
                equityPct={insights.assetMix.equity}
                marketCapMix={insights.marketCapMix}
              />
            )}

            {/* Sector Break-up — requires AMFI data */}
            {insights.sectorBreakdown ? (
              <SectorCard
                sectors={insights.sectorBreakdown}
                totalValue={insights.totalValue}
              />
            ) : (
              <PendingCard
                colors={colors}
                title="Sector Break-up"
                message="Detailed sector data is loaded from AMFI monthly disclosures. Sync to fetch."
                isSyncing={isSyncing}
                onSync={triggerSync}
              />
            )}

            {/* Top Holdings — requires AMFI data */}
            {insights.topHoldings ? (
              <TopHoldingsCard
                holdings={insights.topHoldings}
                fundCount={insights.fundAllocation.length}
              />
            ) : (
              <PendingCard
                colors={colors}
                title="Top Holdings"
                message="Individual stock holdings are loaded from AMFI monthly disclosures. Sync to fetch."
                isSyncing={isSyncing}
                onSync={triggerSync}
              />
            )}

            {/* Missing data footnote */}
            {insights.missingDataFunds.length > 0 && (
              <Text style={[styles.footnote, { color: colors.textTertiary }]}>
                Composition data unavailable for:{' '}
                {insights.missingDataFunds.join(', ')}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function PortfolioInsightsScreen() {
  const { isClearLens } = useAppDesignMode();
  return (
    <>
      <Stack.Screen options={{ headerShown: !isClearLens, title: 'Portfolio Insights' }} />
      {isClearLens ? <ClearLensPortfolioInsightsScreen /> : <ClassicPortfolioInsightsScreen />}
    </>
  );
}

function PendingCard({
  colors,
  title,
  message,
  isSyncing,
  onSync,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  title: string;
  message: string;
  isSyncing: boolean;
  onSync: () => void;
}) {
  return (
    <View style={[pendingStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[pendingStyles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[pendingStyles.message, { color: colors.textSecondary }]}>{message}</Text>
      {isSyncing ? (
        <View style={pendingStyles.row}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[pendingStyles.syncingText, { color: colors.primary }]}>Syncing…</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[pendingStyles.btn, { backgroundColor: colors.primaryLight }]}
          onPress={onSync}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={14} color={colors.primary} />
          <Text style={[pendingStyles.btnText, { color: colors.primary }]}>Sync Now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function LoadingSkeleton({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={[skeletonStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[skeletonStyles.line, { backgroundColor: colors.borderLight, width: '40%' }]} />
          <View style={[skeletonStyles.bar, { backgroundColor: colors.borderLight }]} />
          <View style={[skeletonStyles.line, { backgroundColor: colors.borderLight, width: '70%' }]} />
          <View style={[skeletonStyles.line, { backgroundColor: colors.borderLight, width: '55%' }]} />
        </View>
      ))}
    </>
  );
}

function NoDataState({
  colors,
  isSyncing,
  onSync,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  isSyncing: boolean;
  onSync: () => void;
}) {
  return (
    <View style={emptyStyles.wrapper}>
      <Ionicons name="pie-chart-outline" size={48} color={colors.textTertiary} />
      <Text style={[emptyStyles.title, { color: colors.textPrimary }]}>No composition data yet</Text>
      <Text style={[emptyStyles.body, { color: colors.textSecondary }]}>
        Portfolio insights are built from AMFI monthly portfolio disclosures and your fund
        categories. Tap below to load the data.
      </Text>
      <TouchableOpacity
        style={[emptyStyles.btn, { backgroundColor: colors.primary }]}
        onPress={onSync}
        disabled={isSyncing}
        activeOpacity={0.85}
      >
        {isSyncing
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={emptyStyles.btnText}>Load Insights</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

type AppColors = ReturnType<typeof useTheme>['colors'];
function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
    syncBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.sm,
      borderRadius: 8,
      marginBottom: Spacing.md,
    },
    syncText: { ...Typography.bodySmall },
    staleBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      padding: Spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: Spacing.md,
    },
    staleText: { ...Typography.bodySmall, color: '#d97706', flex: 1 },
    estimateBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: 10,
      borderWidth: 1,
      marginBottom: Spacing.md,
    },
    estimateIcon: { marginTop: 1 },
    estimateTextBlock: { flex: 1, gap: 4 },
    estimateHeading: {
      ...Typography.bodySmall,
      fontWeight: '700',
    },
    estimateBody: {
      ...Typography.bodySmall,
      lineHeight: 18,
    },
    footnote: {
      ...Typography.caption,
      marginTop: Spacing.sm,
      marginBottom: Spacing.lg,
      textAlign: 'center',
    },
  });
}

const pendingStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  title: { ...Typography.h3 },
  message: { ...Typography.bodySmall },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  syncingText: { ...Typography.bodySmall },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
  },
  btnText: { ...Typography.bodySmall, fontWeight: '600' },
});

const skeletonStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  line: { height: 14, borderRadius: 6 },
  bar: { height: 10, borderRadius: 5 },
});

const emptyStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
    gap: Spacing.md,
  },
  title: { ...Typography.h3, textAlign: 'center' },
  body: { ...Typography.body, textAlign: 'center' },
  btn: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.xl,
    borderRadius: 12,
    minWidth: 160,
    alignItems: 'center',
  },
  btnText: { ...Typography.body, fontWeight: '700', color: '#fff' },
});

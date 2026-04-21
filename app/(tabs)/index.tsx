import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LineChart } from 'react-native-gifted-charts';
import { usePortfolio, type FundCardData } from '@/src/hooks/usePortfolio';
import { usePortfolioTimeline, type FundRef } from '@/src/hooks/usePortfolioTimeline';
import { usePortfolioInsights } from '@/src/hooks/usePortfolioInsights';
import { PortfolioInsightsEntryCard } from '@/src/components/insights/PortfolioInsightsEntryCard';
import { YourFundsEntryCard } from '@/src/components/YourFundsEntryCard';
import { formatXirr } from '@/src/utils/xirr';
import { formatCurrency, formatChange } from '@/src/utils/formatting';
import { parseFundName } from '@/src/utils/fundName';
import { navStaleness } from '@/src/utils/navUtils';
import { supabase } from '@/src/lib/supabase';
import { useSession } from '@/src/hooks/useSession';
import { useAppStore, BENCHMARK_OPTIONS } from '@/src/store/appStore';
import Logo from '@/src/components/Logo';
import { Spacing, Radii, Typography } from '@/src/constants/theme';
import { useTheme } from '@/src/context/ThemeContext';
import type { AppColors } from '@/src/context/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - Spacing.md * 2;

function BenchmarkSelector({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (symbol: string) => void;
}) {
  return (
    <View style={benchmarkStyles.benchmarkRow}>
      <Text style={benchmarkStyles.benchmarkRowLabel}>vs</Text>
      {BENCHMARK_OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.symbol}
          style={[benchmarkStyles.benchmarkPill, selected === opt.symbol && benchmarkStyles.benchmarkPillActive]}
          onPress={() => onChange(opt.symbol)}
        >
          <Text
            style={[
              benchmarkStyles.benchmarkPillText,
              selected === opt.symbol && benchmarkStyles.benchmarkPillTextActive,
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// The benchmark selector in the gradient header uses glass-style pills — static styles
const benchmarkStyles = StyleSheet.create({
  benchmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  benchmarkRowLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginRight: 2,
  },
  benchmarkPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  benchmarkPillActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
  benchmarkPillText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  benchmarkPillTextActive: { color: '#0a2e25' },
});


function PortfolioHeader({
  totalValue,
  totalInvested,
  dailyChangeAmount,
  dailyChangePct,
  xirr: xirrRate,
  marketXirr,
  benchmarkSymbol,
  latestNavDate,
  onBenchmarkChange,
}: {
  totalValue: number;
  totalInvested: number;
  dailyChangeAmount: number;
  dailyChangePct: number;
  xirr: number;
  marketXirr: number;
  benchmarkSymbol: string;
  latestNavDate: string | null;
  onBenchmarkChange: (symbol: string) => void;
}) {
  const { colors } = useTheme();
  const isPositiveDay = dailyChangeAmount >= 0;
  const gain = totalValue - totalInvested;
  const gainPct = totalInvested > 0 ? (gain / totalInvested) * 100 : null;
  const gainPositive = gain >= 0;
  const isAheadOfMarket =
    isFinite(xirrRate) && isFinite(marketXirr) ? xirrRate >= marketXirr : null;
  const benchmarkLabel =
    BENCHMARK_OPTIONS.find((b) => b.symbol === benchmarkSymbol)?.label ?? benchmarkSymbol;
  const delta = isAheadOfMarket !== null ? Math.abs((xirrRate - marketXirr) * 100) : 0;
  const staleness = navStaleness(latestNavDate);

  return (
    <LinearGradient
      colors={colors.gradientHeader}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={portfolioHeaderStyles.portfolioHeader}
    >
      {/* Stale-data warning when NAV is more than 2 days old */}
      {staleness.stale && (
        <View style={portfolioHeaderStyles.staleBanner}>
          <Ionicons name="warning-outline" size={13} color={staleness.veryStale ? '#fca5a5' : '#fcd34d'} />
          <Text style={[portfolioHeaderStyles.staleBannerText, staleness.veryStale && portfolioHeaderStyles.staleBannerTextRed]}>
            Portfolio based on {staleness.label} NAV — sync may be paused
          </Text>
        </View>
      )}

      {/* Narrative-first: verdict leads */}
      {isAheadOfMarket !== null && (
        <View style={portfolioHeaderStyles.verdictBlock}>
          <Text style={portfolioHeaderStyles.verdictHeadline}>
            {isAheadOfMarket ? 'Beating the market' : 'Lagging the market'}
          </Text>
          <Text style={portfolioHeaderStyles.verdictDelta}>
            {isAheadOfMarket ? '↑' : '↓'} {delta.toFixed(1)}%{' '}
            {isAheadOfMarket ? 'ahead' : 'behind'} · vs {benchmarkLabel}
          </Text>
        </View>
      )}

      {/* Portfolio value + today's change on one row */}
      <View style={portfolioHeaderStyles.valueRow}>
        <Text style={portfolioHeaderStyles.totalValue}>{formatCurrency(totalValue)}</Text>
        <View style={portfolioHeaderStyles.dailyPill}>
          <Ionicons
            name={isPositiveDay ? 'trending-up' : 'trending-down'}
            size={13}
            color={isPositiveDay ? '#86efac' : '#fca5a5'}
          />
          <Text style={[portfolioHeaderStyles.dailyChange, { color: isPositiveDay ? '#86efac' : '#fca5a5' }]}>
            {formatChange(dailyChangeAmount, dailyChangePct)}{' '}
            {staleness.stale ? staleness.label : 'today'}
          </Text>
        </View>
      </View>

      {/* Portfolio overall Gain / Loss */}
      {gainPct !== null && (
        <Text style={[portfolioHeaderStyles.portfolioGainLoss, { color: gainPositive ? '#86efac' : '#fca5a5' }]}>
          {gainPositive ? '+' : ''}{formatCurrency(Math.abs(gain))} ({gainPositive ? '+' : ''}{gainPct.toFixed(1)}%) overall
        </Text>
      )}

      {/* Two-column Your Return | Benchmark */}
      <View style={portfolioHeaderStyles.xirrRow}>
        <View style={portfolioHeaderStyles.xirrItem}>
          <Text style={portfolioHeaderStyles.xirrLabel}>Your Return</Text>
          <Text style={portfolioHeaderStyles.xirrValue}>{formatXirr(xirrRate)}</Text>
        </View>
        <View style={portfolioHeaderStyles.xirrDivider} />
        <View style={portfolioHeaderStyles.xirrItem}>
          <Text style={portfolioHeaderStyles.xirrLabel}>{benchmarkLabel}</Text>
          <Text style={portfolioHeaderStyles.xirrValue}>{formatXirr(marketXirr)}</Text>
        </View>
      </View>

      <BenchmarkSelector selected={benchmarkSymbol} onChange={onBenchmarkChange} />
    </LinearGradient>
  );
}

// Portfolio header inner styles are all "on dark" — white text, no color tokens needed
const portfolioHeaderStyles = StyleSheet.create({
  portfolioHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: Radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: Spacing.xs,
    alignSelf: 'flex-start',
  },
  staleBannerText: { fontSize: 12, color: '#fcd34d', fontWeight: '500' },
  staleBannerTextRed: { color: '#fca5a5' },
  verdictBlock: { marginBottom: Spacing.xs },
  verdictHeadline: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  verdictDelta: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap', marginTop: Spacing.xs },
  totalValue: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  dailyPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dailyChange: { fontSize: 14, fontWeight: '600' },
  portfolioGainLoss: { fontSize: 13, fontWeight: '500', marginTop: 4 },
  xirrRow: { flexDirection: 'row', marginTop: Spacing.sm, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  xirrItem: { flex: 1, alignItems: 'center', gap: 3 },
  xirrDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  xirrLabel: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  xirrValue: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

type ChartWindow = '1Y' | '3Y';

function PortfolioChartSection({
  funds,
  userId,
  benchmarkSymbol,
}: {
  funds: FundRef[];
  userId: string | undefined;
  benchmarkSymbol: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [window, setWindow] = useState<ChartWindow>('1Y');
  const { portfolioPoints, benchmarkPoints, xAxisLabels, isLoading } = usePortfolioTimeline(
    funds,
    userId,
    benchmarkSymbol,
    window,
  );
  const benchmarkLabel = BENCHMARK_OPTIONS.find((b) => b.symbol === benchmarkSymbol)?.label ?? benchmarkSymbol;

  const chartData = portfolioPoints.map((p) => ({ value: p.value }));
  const benchmarkData = benchmarkPoints.map((p) => ({ value: p.value }));

  // Compute y-axis floor so indexed-to-100 lines fill the chart height
  // rather than floating in the top quarter above a large empty area.
  const allChartVals = [...portfolioPoints, ...benchmarkPoints].map((p) => p.value);
  const chartYMax = allChartVals.length > 0 ? Math.max(...allChartVals) : 120;
  const chartYMin = allChartVals.length > 0 ? Math.min(...allChartVals) : 90;
  const chartYPad = ((chartYMax - chartYMin) || chartYMax * 0.1 || 1) * 0.15;
  const chartMaxValue = Math.ceil((chartYMax + chartYPad) / 10) * 10;
  const chartMinValue = Math.floor((chartYMin - chartYPad) / 10) * 10;

  if (!isLoading && chartData.length === 0) return null;

  return (
    <View style={styles.chartSection}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Portfolio vs Market</Text>
        <View style={styles.windowSelector}>
          {(['1Y', '3Y'] as ChartWindow[]).map((w) => (
            <TouchableOpacity
              key={w}
              style={[styles.windowPill, window === w && styles.windowPillActive]}
              onPress={() => setWindow(w)}
            >
              <Text style={[styles.windowPillText, window === w && styles.windowPillTextActive]}>
                {w}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.chartSkeleton} />
      ) : (
        <>
          <LineChart
            data={chartData}
            data2={benchmarkData}
            width={CHART_WIDTH - 32}
            height={140}
            color1={colors.primary}
            color2="#f59e0b"
            thickness1={3}
            thickness2={2.5}
            curved
            hideDataPoints
            yAxisLabelWidth={40}
            yAxisTextStyle={styles.chartAxisText}
            xAxisLabelTexts={xAxisLabels}
            xAxisLabelTextStyle={styles.chartAxisText}
            xAxisLabelsHeight={16}
            labelsExtraHeight={40}
            hideRules
            xAxisColor={colors.borderLight}
            yAxisColor="transparent"
            formatYLabel={(v) => `${Math.round(Number(v))}`}
            maxValue={chartMaxValue - chartMinValue}
            yAxisOffset={chartMinValue}
            noOfSections={4}
            initialSpacing={0}
            endSpacing={32}
            spacing={Math.max(8, (CHART_WIDTH - 56) / Math.max(chartData.length - 1, 1))}
          />
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendText}>Your Portfolio</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.legendText}>{benchmarkLabel}</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function GainersLosersRow({ fundCards }: { fundCards: FundCardData[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const withDailyChange = fundCards.filter(
    (f) => f.dailyChangePct !== null && f.currentValue !== null,
  );
  if (withDailyChange.length < 2) return null;

  const sorted = [...withDailyChange].sort(
    (a, b) => (a.dailyChangePct ?? 0) - (b.dailyChangePct ?? 0),
  );
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];

  function GainerCard({ fund, label, color }: { fund: FundCardData; label: string; color: string }) {
    const { base } = parseFundName(fund.schemeName);
    const pct = fund.dailyChangePct!;
    const amt = fund.dailyChangeAmount!;
    return (
      <View style={[styles.gainerCard, { borderLeftColor: color }]}>
        <Text style={[styles.gainerLabel, { color }]}>{label}</Text>
        <Text style={styles.gainerName} numberOfLines={1}>{base}</Text>
        <Text style={styles.gainerCategory}>{fund.schemeCategory}</Text>
        <Text style={[styles.gainerPct, { color }]}>
          {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
        </Text>
        <Text style={[styles.gainerAmt, { color }]}>
          {amt >= 0 ? '+' : ''}{formatCurrency(Math.abs(amt))}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.gainersRow}>
      <GainerCard fund={best} label="Today's Best" color={colors.positive} />
      <GainerCard fund={worst} label="Today's Worst" color={colors.negative} />
    </View>
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="pie-chart-outline" size={40} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>No portfolio yet</Text>
      <Text style={styles.emptySub}>
        Import your CAS statement to see your mutual fund portfolio, your return, and how you
        compare to the market.
      </Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onImport} activeOpacity={0.85}>
        <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
        <Text style={styles.emptyBtnText}>Import CAS</Text>
      </TouchableOpacity>
    </View>
  );
}

type SyncState = 'idle' | 'syncing' | 'requested' | 'error';

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { defaultBenchmarkSymbol, setDefaultBenchmarkSymbol } = useAppStore();

  const { data: profile } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profile')
        .select('kfintech_email')
        .eq('user_id', userId!)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [overflowOpen, setOverflowOpen] = useState(false);

  async function handleSync() {
    if (!profile?.kfintech_email) {
      router.push('/onboarding');
      return;
    }
    setSyncState('syncing');
    const { error } = await supabase.functions.invoke('request-cas', {
      method: 'POST',
      body: { email: profile.kfintech_email },
    });
    setSyncState(error ? 'error' : 'requested');
    setTimeout(() => setSyncState('idle'), 4000);
  }

  const { data, isLoading, isError, refetch, isRefetching } = usePortfolio(defaultBenchmarkSymbol);

  const fundCards = data?.fundCards ?? [];
  const summary = data?.summary ?? null;
  const fundRefs: FundRef[] = fundCards.map((f) => ({ id: f.id, schemeCode: f.schemeCode }));

  const { insights, isLoading: insightsLoading, isStale, isSyncing, triggerSync } =
    usePortfolioInsights(fundCards);

  return (
    <SafeAreaView style={styles.container}>
      {/* Dark header bar — seamlessly joins the gradient below */}
      <View style={styles.header}>
        <Logo size={28} showWordmark light />
        <View style={styles.headerActions}>
          <TouchableOpacity
            hitSlop={8}
            onPress={() => setOverflowOpen(true)}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} hitSlop={8}>
            <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Overflow menu */}
      <Modal
        visible={overflowOpen}
        transparent
        animationType="none"
        onRequestClose={() => setOverflowOpen(false)}
      >
        <TouchableOpacity
          style={styles.overflowBackdrop}
          activeOpacity={1}
          onPress={() => setOverflowOpen(false)}
        >
          <View style={styles.overflowMenu}>
            <TouchableOpacity
              style={styles.overflowItem}
              onPress={() => {
                setOverflowOpen(false);
                handleSync();
              }}
              disabled={syncState === 'syncing'}
            >
              {syncState === 'syncing' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="sync-outline" size={18} color={colors.textPrimary} />
              )}
              <Text style={styles.overflowItemText}>Sync Portfolio</Text>
            </TouchableOpacity>
            <View style={styles.overflowDivider} />
            <TouchableOpacity
              style={styles.overflowItem}
              onPress={() => {
                setOverflowOpen(false);
                router.push(profile?.kfintech_email ? '/onboarding/pdf' : '/onboarding');
              }}
            >
              <Ionicons name="cloud-upload-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.overflowItemText}>Import CAS</Text>
            </TouchableOpacity>
            <View style={styles.overflowDivider} />
            <TouchableOpacity
              style={styles.overflowItem}
              onPress={() => {
                setOverflowOpen(false);
                router.push('/(tabs)/settings');
              }}
            >
              <Ionicons name="settings-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.overflowItemText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {syncState === 'requested' && (
        <View style={styles.syncBanner}>
          <Text style={styles.syncBannerText}>
            CAS requested! Check your email — forward it to your inbound address.
          </Text>
        </View>
      )}
      {syncState === 'error' && (
        <View style={[styles.syncBanner, styles.syncBannerError]}>
          <Text style={styles.syncBannerText}>Sync failed. Please try again.</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load portfolio.</Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={styles.retryLink}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !summary || fundCards.length === 0 ? (
        <EmptyState onImport={() => router.push('/onboarding')} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
        >
          <PortfolioHeader
            totalValue={summary.totalValue}
            totalInvested={summary.totalInvested}
            dailyChangeAmount={summary.dailyChangeAmount}
            dailyChangePct={summary.dailyChangePct}
            xirr={summary.xirr}
            marketXirr={summary.marketXirr}
            benchmarkSymbol={defaultBenchmarkSymbol}
            latestNavDate={summary.latestNavDate ?? null}
            onBenchmarkChange={setDefaultBenchmarkSymbol}
          />

          <PortfolioChartSection
            funds={fundRefs}
            userId={userId}
            benchmarkSymbol={defaultBenchmarkSymbol}
          />

          <GainersLosersRow fundCards={fundCards} />

          <PortfolioInsightsEntryCard
            insights={insights}
            isLoading={insightsLoading}
            isStale={isStale}
            isSyncing={isSyncing}
            onSyncPress={triggerSync}
          />

          <YourFundsEntryCard
            fundAllocation={insights?.fundAllocation ?? []}
            fundCount={fundCards.length}
          />

          <View style={styles.bottomPad} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // Dark header — matches gradientHeader[0] for seamless join with portfolio gradient
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: 14,
      backgroundColor: colors.gradientHeader[0],
    },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    // Overflow menu
    overflowBackdrop: {
      flex: 1,
    },
    overflowMenu: {
      position: 'absolute',
      top: 60,
      right: 16,
      backgroundColor: colors.surface,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 180,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 8,
    },
    overflowItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
    },
    overflowItemText: {
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    overflowDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: Spacing.sm,
    },

    syncBanner: {
      backgroundColor: colors.primaryLight,
      borderBottomWidth: 1,
      borderBottomColor: colors.primary + '33',
      paddingHorizontal: Spacing.lg,
      paddingVertical: 10,
    },
    syncBannerError: { backgroundColor: '#fef2f2', borderBottomColor: '#fecaca' },
    syncBannerText: { fontSize: 13, color: colors.primaryDark, lineHeight: 18 },

    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    errorText: { fontSize: 15, color: colors.textSecondary },
    retryLink: { fontSize: 14, color: colors.primary, fontWeight: '600' },

    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
    },
    emptyTitle: { ...Typography.h2, color: colors.textPrimary },
    emptySub: { ...Typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    emptyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 13,
      marginTop: Spacing.sm,
    },
    emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

    bottomPad: { height: 32 },

    // Portfolio vs Market chart
    chartSection: {
      backgroundColor: colors.surface,
      marginHorizontal: Spacing.md,
      marginTop: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
    },
    chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
    chartTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    windowSelector: { flexDirection: 'row', gap: 6 },
    windowPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    windowPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    windowPillText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    windowPillTextActive: { color: '#fff' },
    chartSkeleton: { height: 140, backgroundColor: colors.borderLight, borderRadius: Radii.sm },
    chartLegend: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm, justifyContent: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
    chartAxisText: { fontSize: 10, color: colors.textTertiary },

    // Gainers / Losers row
    gainersRow: { flexDirection: 'row', marginHorizontal: Spacing.md, marginTop: Spacing.sm, gap: Spacing.sm },
    gainerCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 3,
      padding: Spacing.sm,
      gap: 3,
    },
    gainerLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    gainerName: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
    gainerCategory: { fontSize: 11, color: colors.textTertiary },
    gainerPct: { fontSize: 14, fontWeight: '700', marginTop: 4 },
    gainerAmt: { fontSize: 11, fontWeight: '500' },
  });
}

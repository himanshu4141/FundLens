import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LineChart } from 'react-native-gifted-charts';
import { AppOverflowMenu } from '@/src/components/AppOverflowMenu';
import {
  ClearLensCard,
  ClearLensHeader,
  ClearLensPill,
  ClearLensScreen,
} from '@/src/components/clearLens/ClearLensPrimitives';
import { usePortfolio, type FundCardData } from '@/src/hooks/usePortfolio';
import { usePortfolioInsights } from '@/src/hooks/usePortfolioInsights';
import { useInvestmentVsBenchmarkTimeline } from '@/src/hooks/useInvestmentVsBenchmarkTimeline';
import type { FundRef } from '@/src/hooks/usePortfolioTimeline';
import { useSession } from '@/src/hooks/useSession';
import { supabase } from '@/src/lib/supabase';
import { BENCHMARK_OPTIONS, useAppStore } from '@/src/store/appStore';
import { formatChange, formatCurrency } from '@/src/utils/formatting';
import { formatXirr } from '@/src/utils/xirr';
import { parseFundName } from '@/src/utils/fundName';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensShadow,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - ClearLensSpacing.md * 2 - ClearLensSpacing.md * 2;

type SyncState = 'idle' | 'syncing' | 'requested' | 'error';

function toneForValue(value: number): 'positive' | 'negative' {
  return value >= 0 ? 'positive' : 'negative';
}

function toneColor(tone: 'positive' | 'negative') {
  return tone === 'positive' ? ClearLensColors.emerald : ClearLensColors.slate;
}

function PortfolioHero({
  totalValue,
  totalInvested,
  dailyChangeAmount,
  dailyChangePct,
  xirr,
  marketXirr,
  benchmarkLabel,
}: {
  totalValue: number;
  totalInvested: number;
  dailyChangeAmount: number;
  dailyChangePct: number;
  xirr: number;
  marketXirr: number;
  benchmarkLabel: string;
}) {
  const gain = totalValue - totalInvested;
  const gainPct = totalInvested > 0 ? (gain / totalInvested) * 100 : 0;
  const delta = Number.isFinite(xirr) && Number.isFinite(marketXirr) ? (xirr - marketXirr) * 100 : null;
  const ahead = delta !== null && delta >= 0;

  return (
    <ClearLensCard style={styles.heroCard}>
      <View style={styles.heroTopRow}>
        <View style={styles.heroIcon}>
          <Ionicons name="pie-chart-outline" size={20} color={ClearLensColors.emerald} />
        </View>
        {delta !== null && (
          <View style={styles.statusPill}>
            <Ionicons
              name={ahead ? 'trending-up' : 'trending-down'}
              size={15}
              color={ClearLensColors.emerald}
            />
            <Text style={styles.statusText}>
              {ahead ? 'Ahead of' : 'Behind'} {benchmarkLabel} by {Math.abs(delta).toFixed(1)}%
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.heroLabel}>Current value</Text>
      <Text style={styles.heroValue}>{formatCurrency(totalValue)}</Text>

      <View style={styles.heroMetricGrid}>
        <View style={styles.heroMetric}>
          <Text style={styles.metricLabel}>Today</Text>
          <Text style={[styles.metricValue, { color: toneColor(toneForValue(dailyChangeAmount)) }]}>
            {formatChange(dailyChangeAmount, dailyChangePct)}
          </Text>
        </View>
        <View style={styles.heroMetric}>
          <Text style={styles.metricLabel}>Overall gain</Text>
          <Text style={[styles.metricValue, { color: toneColor(toneForValue(gain)) }]}>
            {gain >= 0 ? '+' : '-'}{formatCurrency(Math.abs(gain))} ({gain >= 0 ? '+' : ''}{gainPct.toFixed(1)}%)
          </Text>
        </View>
        <View style={styles.heroMetric}>
          <Text style={styles.metricLabel}>SIP-aware return</Text>
          <Text style={[styles.metricValue, { color: toneColor(toneForValue(xirr)) }]}>
            {formatXirr(xirr)}
          </Text>
        </View>
      </View>
    </ClearLensCard>
  );
}

function BenchmarkComparisonCard({
  xirr,
  marketXirr,
  benchmarkSymbol,
  onBenchmarkChange,
}: {
  xirr: number;
  marketXirr: number;
  benchmarkSymbol: string;
  onBenchmarkChange: (symbol: string) => void;
}) {
  const benchmarkLabel = BENCHMARK_OPTIONS.find((option) => option.symbol === benchmarkSymbol)?.label ?? benchmarkSymbol;
  const difference = Number.isFinite(xirr) && Number.isFinite(marketXirr) ? (xirr - marketXirr) * 100 : null;

  return (
    <ClearLensCard style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Benchmark comparison</Text>
        <Text style={styles.sectionMeta}>XIRR</Text>
      </View>
      <View style={styles.compareGrid}>
        <View style={styles.compareCell}>
          <Text style={styles.metricLabel}>Portfolio</Text>
          <Text style={styles.compareValue}>{formatXirr(xirr)}</Text>
        </View>
        <View style={styles.compareDivider} />
        <View style={styles.compareCell}>
          <Text style={styles.metricLabel}>{benchmarkLabel}</Text>
          <Text style={styles.compareValue}>{formatXirr(marketXirr)}</Text>
        </View>
        <View style={styles.compareDivider} />
        <View style={styles.compareCell}>
          <Text style={styles.metricLabel}>Difference</Text>
          <Text style={[styles.compareValue, { color: (difference ?? 0) >= 0 ? ClearLensColors.emerald : ClearLensColors.slate }]}>
            {difference === null ? 'N/A' : `${difference >= 0 ? '+' : ''}${difference.toFixed(2)}%`}
          </Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
        {BENCHMARK_OPTIONS.map((option) => (
          <ClearLensPill
            key={option.symbol}
            label={option.label}
            active={option.symbol === benchmarkSymbol}
            onPress={() => onBenchmarkChange(option.symbol)}
          />
        ))}
      </ScrollView>
    </ClearLensCard>
  );
}

function InvestmentVsBenchmarkChart({
  funds,
  userId,
  benchmarkSymbol,
}: {
  funds: FundRef[];
  userId: string | undefined;
  benchmarkSymbol: string;
}) {
  const { points, xAxisLabels, isLoading } = useInvestmentVsBenchmarkTimeline(
    funds,
    userId,
    benchmarkSymbol,
    '1Y',
  );
  const benchmarkLabel = BENCHMARK_OPTIONS.find((option) => option.symbol === benchmarkSymbol)?.label ?? benchmarkSymbol;

  if (!isLoading && points.length < 2) return null;

  const investedData = points.map((point) => ({ value: point.investedValue / 100000 }));
  const portfolioData = points.map((point) => ({ value: point.portfolioValue / 100000 }));
  const benchmarkData = points.map((point) => ({ value: point.benchmarkValue / 100000 }));
  const values = [...investedData, ...portfolioData, ...benchmarkData].map((point) => point.value);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const yPad = Math.max((maxValue - minValue) * 0.14, 1);
  const yMax = Math.ceil(maxValue + yPad);
  const yMin = Math.max(0, Math.floor(minValue - yPad));
  const spacing = points.length > 1 ? (CHART_WIDTH - 44) / (points.length - 1) : 24;

  return (
    <ClearLensCard style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Investment value over time</Text>
        <Text style={styles.sectionMeta}>1Y</Text>
      </View>
      {isLoading ? (
        <View style={styles.chartLoading}>
          <ActivityIndicator size="small" color={ClearLensColors.emerald} />
        </View>
      ) : (
        <>
          <LineChart
            data={portfolioData}
            data2={benchmarkData}
            data3={investedData}
            width={CHART_WIDTH}
            height={172}
            spacing={spacing}
            initialSpacing={0}
            endSpacing={28}
            hideDataPoints
            hideDataPoints2
            hideDataPoints3
            color1={ClearLensColors.emerald}
            color2={ClearLensColors.slate}
            color3={ClearLensColors.lightGrey}
            thickness1={3}
            thickness2={2.4}
            thickness3={2.2}
            curved
            yAxisLabelWidth={42}
            maxValue={yMax - yMin}
            yAxisOffset={yMin}
            noOfSections={4}
            xAxisLabelTexts={xAxisLabels}
            xAxisLabelTextStyle={styles.chartAxis}
            yAxisTextStyle={styles.chartAxis}
            formatYLabel={(value) => `₹${Math.round(Number(value) + yMin)}L`}
            xAxisColor={ClearLensColors.borderLight}
            yAxisColor="transparent"
            rulesColor={ClearLensColors.borderLight}
          />
          <View style={styles.legendWrap}>
            <Legend color={ClearLensColors.emerald} label="Your portfolio" />
            <Legend color={ClearLensColors.slate} label={benchmarkLabel} />
            <Legend color={ClearLensColors.lightGrey} label="Invested" />
          </View>
        </>
      )}
    </ClearLensCard>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function MoversRow({ fundCards }: { fundCards: FundCardData[] }) {
  const withDailyChange = fundCards.filter((fund) => fund.dailyChangePct !== null && fund.currentValue !== null);
  if (withDailyChange.length < 2) return null;

  const sorted = [...withDailyChange].sort((a, b) => (a.dailyChangePct ?? 0) - (b.dailyChangePct ?? 0));
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];

  return (
    <View style={styles.moversGrid}>
      <MoverCard title="Today's best" fund={best} positive />
      <MoverCard title="Today's worst" fund={worst} positive={false} />
    </View>
  );
}

function MoverCard({
  title,
  fund,
  positive,
}: {
  title: string;
  fund: FundCardData;
  positive: boolean;
}) {
  const { base } = parseFundName(fund.schemeName);
  const pct = fund.dailyChangePct ?? 0;
  const amount = fund.dailyChangeAmount ?? 0;
  const color = positive ? ClearLensColors.emerald : ClearLensColors.slate;

  return (
    <ClearLensCard style={styles.moverCard}>
      <Text style={styles.metricLabel}>{title}</Text>
      <Text style={styles.moverName} numberOfLines={2}>{base}</Text>
      <Text style={[styles.moverPct, { color }]}>
        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
      </Text>
      <Text style={[styles.moverAmount, { color }]}>
        {amount >= 0 ? '+' : '-'}{formatCurrency(Math.abs(amount))}
      </Text>
    </ClearLensCard>
  );
}

function AssetAllocationPreview({
  totalValue,
  equityPct,
  debtPct,
  cashPct,
}: {
  totalValue: number;
  equityPct: number;
  debtPct: number;
  cashPct: number;
}) {
  const rows = [
    { label: 'Equity', pct: equityPct, color: ClearLensColors.emerald },
    { label: 'Debt', pct: debtPct, color: ClearLensColors.slate },
    { label: 'Cash & Others', pct: cashPct, color: ClearLensColors.mint },
  ];

  return (
    <ClearLensCard style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Asset allocation</Text>
      <View style={styles.allocationBar}>
        {rows.map((row) => (
          row.pct > 0 ? (
            <View key={row.label} style={[styles.allocationSegment, { flex: row.pct, backgroundColor: row.color }]} />
          ) : null
        ))}
      </View>
      <View style={styles.allocationRows}>
        {rows.map((row) => (
          <View key={row.label} style={styles.allocationRow}>
            <View style={styles.allocationLabelWrap}>
              <View style={[styles.allocationDot, { backgroundColor: row.color }]} />
              <Text style={styles.allocationLabel}>{row.label}</Text>
            </View>
            <Text style={styles.allocationValue}>{row.pct.toFixed(1)}%</Text>
            <Text style={styles.allocationMoney}>{formatCurrency((row.pct / 100) * totalValue)}</Text>
          </View>
        ))}
      </View>
    </ClearLensCard>
  );
}

function EntryRows({ onInsights, onFunds }: { onInsights: () => void; onFunds: () => void }) {
  return (
    <View style={styles.entryRows}>
      <EntryRow
        icon="analytics-outline"
        title="Portfolio Insights"
        subtitle="See allocation, sectors, and top holdings"
        onPress={onInsights}
      />
      <EntryRow
        icon="list-outline"
        title="Your Funds"
        subtitle="Search, sort, and open every holding"
        onPress={onFunds}
      />
    </View>
  );
}

function EntryRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.entryRow} onPress={onPress} activeOpacity={0.76}>
      <View style={styles.entryIcon}>
        <Ionicons name={icon} size={19} color={ClearLensColors.emerald} />
      </View>
      <View style={styles.entryCopy}>
        <Text style={styles.entryTitle}>{title}</Text>
        <Text style={styles.entrySubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={ClearLensColors.textTertiary} />
    </TouchableOpacity>
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="cloud-upload-outline" size={32} color={ClearLensColors.emerald} />
      </View>
      <Text style={styles.emptyTitle}>Import your portfolio</Text>
      <Text style={styles.emptyText}>
        Add your CAS once. FundLens will show SIP-aware returns, benchmark clarity, and your real progress.
      </Text>
      <TouchableOpacity style={styles.primaryButton} onPress={onImport} activeOpacity={0.82}>
        <Text style={styles.primaryButtonText}>Import CAS</Text>
      </TouchableOpacity>
    </View>
  );
}

export function ClearLensPortfolioScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { defaultBenchmarkSymbol, setDefaultBenchmarkSymbol } = useAppStore();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');

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
  const fundCards = useMemo(() => data?.fundCards ?? [], [data?.fundCards]);
  const summary = data?.summary ?? null;
  const fundRefs: FundRef[] = useMemo(
    () => fundCards.map((fund) => ({ id: fund.id, schemeCode: fund.schemeCode })),
    [fundCards],
  );
  const { insights, isLoading: insightsLoading } = usePortfolioInsights(fundCards);
  const benchmarkLabel = BENCHMARK_OPTIONS.find((option) => option.symbol === defaultBenchmarkSymbol)?.label ?? defaultBenchmarkSymbol;

  return (
    <ClearLensScreen>
      <ClearLensHeader onPressMenu={() => setOverflowOpen(true)} showTagline />
      <AppOverflowMenu
        visible={overflowOpen}
        syncState={syncState}
        onClose={() => setOverflowOpen(false)}
        onSync={handleSync}
        onImport={() => router.push(profile?.kfintech_email ? '/onboarding/pdf' : '/onboarding')}
        onSettings={() => router.push('/(tabs)/settings')}
      />

      {syncState === 'requested' && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>CAS requested. Forward the email to your FundLens import address.</Text>
        </View>
      )}
      {syncState === 'error' && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Sync failed. Please try again.</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ClearLensColors.emerald} />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load portfolio.</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => refetch()}>
            <Text style={styles.secondaryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !summary || fundCards.length === 0 ? (
        <EmptyState onImport={() => router.push('/onboarding')} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={ClearLensColors.emerald}
            />
          }
        >
          <PortfolioHero
            totalValue={summary.totalValue}
            totalInvested={summary.totalInvested}
            dailyChangeAmount={summary.dailyChangeAmount}
            dailyChangePct={summary.dailyChangePct}
            xirr={summary.xirr}
            marketXirr={summary.marketXirr}
            benchmarkLabel={benchmarkLabel}
          />

          <BenchmarkComparisonCard
            xirr={summary.xirr}
            marketXirr={summary.marketXirr}
            benchmarkSymbol={defaultBenchmarkSymbol}
            onBenchmarkChange={setDefaultBenchmarkSymbol}
          />

          <InvestmentVsBenchmarkChart
            funds={fundRefs}
            userId={userId}
            benchmarkSymbol={defaultBenchmarkSymbol}
          />

          <MoversRow fundCards={fundCards} />

          {insights && (
            <AssetAllocationPreview
              totalValue={insights.totalValue}
              equityPct={insights.assetMix.equity}
              debtPct={insights.assetMix.debt}
              cashPct={insights.assetMix.cash + insights.assetMix.other}
            />
          )}

          {!insights && insightsLoading && (
            <ClearLensCard style={styles.sectionCard}>
              <ActivityIndicator size="small" color={ClearLensColors.emerald} />
            </ClearLensCard>
          )}

          <EntryRows
            onInsights={() => router.push('/portfolio-insights')}
            onFunds={() => router.push('/funds')}
          />
        </ScrollView>
      )}
    </ClearLensScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingBottom: ClearLensSpacing.xxl,
    gap: ClearLensSpacing.md,
  },
  heroCard: {
    gap: ClearLensSpacing.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ClearLensSpacing.sm,
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: ClearLensRadii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DFF8ED',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: ClearLensSpacing.sm,
    paddingVertical: 8,
    borderRadius: ClearLensRadii.full,
    backgroundColor: '#DFF8ED',
    flexShrink: 1,
  },
  statusText: {
    ...ClearLensTypography.caption,
    color: '#087A5B',
    fontWeight: '700',
  },
  heroLabel: {
    ...ClearLensTypography.label,
    color: ClearLensColors.textTertiary,
    textTransform: 'uppercase',
  },
  heroValue: {
    ...ClearLensTypography.hero,
    color: ClearLensColors.navy,
  },
  heroMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ClearLensSpacing.sm,
  },
  heroMetric: {
    minWidth: '47%',
    flex: 1,
    padding: ClearLensSpacing.sm,
    borderRadius: ClearLensRadii.md,
    backgroundColor: ClearLensColors.surfaceSoft,
    gap: 3,
  },
  metricLabel: {
    ...ClearLensTypography.label,
    color: ClearLensColors.textTertiary,
    textTransform: 'uppercase',
  },
  metricValue: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.bold,
    fontWeight: '700',
  },
  sectionCard: {
    gap: ClearLensSpacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ClearLensSpacing.sm,
  },
  sectionTitle: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  sectionMeta: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  compareGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: ClearLensSpacing.sm,
  },
  compareCell: {
    flex: 1,
    gap: 5,
  },
  compareDivider: {
    width: 1,
    backgroundColor: ClearLensColors.borderLight,
  },
  compareValue: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  pillRow: {
    gap: ClearLensSpacing.sm,
  },
  chartLoading: {
    height: 172,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartAxis: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
    fontSize: 10,
  },
  legendWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ClearLensSpacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textSecondary,
  },
  moversGrid: {
    flexDirection: 'row',
    gap: ClearLensSpacing.sm,
  },
  moverCard: {
    flex: 1,
    minHeight: 148,
    gap: ClearLensSpacing.xs,
  },
  moverName: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.semiBold,
    color: ClearLensColors.navy,
    minHeight: 42,
  },
  moverPct: {
    ...ClearLensTypography.h3,
  },
  moverAmount: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.semiBold,
  },
  allocationBar: {
    height: 12,
    borderRadius: ClearLensRadii.full,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: ClearLensColors.surfaceSoft,
  },
  allocationSegment: {
    height: '100%',
  },
  allocationRows: {
    gap: ClearLensSpacing.sm,
  },
  allocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
  },
  allocationLabelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allocationDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  allocationLabel: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textSecondary,
  },
  allocationValue: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.bold,
    color: ClearLensColors.navy,
    minWidth: 54,
    textAlign: 'right',
  },
  allocationMoney: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
    minWidth: 72,
    textAlign: 'right',
  },
  entryRows: {
    gap: ClearLensSpacing.sm,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    padding: ClearLensSpacing.md,
    borderRadius: ClearLensRadii.lg,
    backgroundColor: ClearLensColors.surface,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    ...ClearLensShadow,
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: ClearLensRadii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DFF8ED',
  },
  entryCopy: {
    flex: 1,
    gap: 2,
  },
  entryTitle: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  entrySubtitle: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ClearLensSpacing.md,
    padding: ClearLensSpacing.xl,
  },
  errorText: {
    ...ClearLensTypography.body,
    color: ClearLensColors.textSecondary,
  },
  banner: {
    backgroundColor: '#DFF8ED',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: ClearLensColors.mint,
    paddingHorizontal: ClearLensSpacing.md,
    paddingVertical: ClearLensSpacing.sm,
  },
  bannerText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.slate,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ClearLensSpacing.xl,
    gap: ClearLensSpacing.md,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: ClearLensRadii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DFF8ED',
  },
  emptyTitle: {
    ...ClearLensTypography.h2,
    color: ClearLensColors.navy,
    textAlign: 'center',
  },
  emptyText: {
    ...ClearLensTypography.body,
    color: ClearLensColors.textSecondary,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 46,
    paddingHorizontal: ClearLensSpacing.xl,
    borderRadius: ClearLensRadii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ClearLensColors.emerald,
  },
  primaryButtonText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textOnDark,
    fontFamily: ClearLensFonts.bold,
  },
  secondaryButton: {
    minHeight: 42,
    paddingHorizontal: ClearLensSpacing.lg,
    borderRadius: ClearLensRadii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ClearLensColors.surface,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
  },
  secondaryButtonText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.navy,
    fontFamily: ClearLensFonts.bold,
  },
});

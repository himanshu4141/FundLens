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
import { PrimaryShellHeader } from '@/src/components/PrimaryShellHeader';
import { AppOverflowMenu } from '@/src/components/AppOverflowMenu';
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
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
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
  verdictDelta: { fontSize: 13, color: 'rgba(255,255,255,0.78)', marginTop: 3, lineHeight: 18 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap', marginTop: Spacing.xs },
  totalValue: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  dailyPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dailyChange: { fontSize: 14, fontWeight: '700' },
  portfolioGainLoss: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  xirrRow: { flexDirection: 'row', marginTop: Spacing.md, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
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

// ─── V3 "Clear Lens" Portfolio Hero ──────────────────────────────────────────

type V3ChartWindow = '1Y' | '3Y';

function V3PortfolioHero({
  totalValue,
  totalInvested,
  dailyChangeAmount,
  dailyChangePct,
  xirr: xirrRate,
  marketXirr,
  benchmarkSymbol,
  latestNavDate,
  onBenchmarkChange,
  funds,
  userId,
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
  funds: FundRef[];
  userId: string | undefined;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeV3HeroStyles(colors), [colors]);
  const [benchmarkExpanded, setBenchmarkExpanded] = useState(true);
  const [showReturnDetail, setShowReturnDetail] = useState(false);
  const [chartWindow, setChartWindow] = useState<V3ChartWindow>('1Y');

  const { portfolioPoints, benchmarkPoints, isLoading: chartLoading } = usePortfolioTimeline(
    funds,
    userId,
    benchmarkSymbol,
    chartWindow,
  );

  const isPositiveDay = dailyChangeAmount >= 0;
  const gain = totalValue - totalInvested;
  const gainPositive = gain >= 0;
  const isAhead =
    isFinite(xirrRate) && isFinite(marketXirr) ? xirrRate >= marketXirr : null;
  const delta = isAhead !== null ? Math.abs((xirrRate - marketXirr) * 100) : 0;
  const benchmarkLabel =
    BENCHMARK_OPTIONS.find((b) => b.symbol === benchmarkSymbol)?.label ?? benchmarkSymbol;
  const staleness = navStaleness(latestNavDate);

  const returnGrade = (x: number) =>
    x >= 0.15 ? 'Great' : x >= 0.10 ? 'Good' : x >= 0.07 ? 'Average' : 'Below Avg';

  const areaData = portfolioPoints.map((p) => ({ value: p.value }));
  const lineData2 = benchmarkPoints.map((p) => ({ value: p.value }));

  const allVals = [...portfolioPoints, ...benchmarkPoints].map((p) => p.value);
  const yMax = allVals.length > 0 ? Math.max(...allVals) : 120;
  const yMin = allVals.length > 0 ? Math.min(...allVals) : 90;
  const yPad = ((yMax - yMin) || yMax * 0.1 || 1) * 0.15;
  const chartMax = Math.ceil((yMax + yPad) / 5) * 5;
  const chartMin = Math.floor((yMin - yPad) / 5) * 5;
  const chartInnerWidth = CHART_WIDTH - Spacing.md * 2 - 32;

  return (
    <View style={styles.hero}>
      {staleness.stale && (
        <View style={styles.staleBanner}>
          <Ionicons
            name="warning-outline"
            size={13}
            color={staleness.veryStale ? colors.negative : colors.warning}
          />
          <Text style={styles.staleBannerText}>
            Portfolio based on {staleness.label} NAV — sync may be paused
          </Text>
        </View>
      )}

      {/* Card 1: Portfolio Overview */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Portfolio Overview</Text>
        <Text style={styles.totalValue}>{formatCurrency(totalValue)}</Text>
        <View style={styles.dailyRow}>
          <Ionicons
            name={isPositiveDay ? 'trending-up' : 'trending-down'}
            size={14}
            color={isPositiveDay ? colors.positive : colors.negative}
          />
          <Text style={[styles.dailyChange, { color: isPositiveDay ? colors.positive : colors.negative }]}>
            {formatChange(dailyChangeAmount, dailyChangePct)}{' '}
            {staleness.stale ? staleness.label : 'today'}
          </Text>
        </View>
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Invested</Text>
            <Text style={styles.metricValue}>{formatCurrency(totalInvested)}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Total Return</Text>
            <Text style={[styles.metricValue, { color: gainPositive ? colors.positive : colors.negative }]}>
              {gainPositive ? '+' : ''}{formatCurrency(Math.abs(gain))}
            </Text>
          </View>
        </View>
        {!chartLoading && areaData.length >= 2 && (
          <View style={styles.areaChartWrap}>
            <LineChart
              areaChart
              data={areaData}
              color={colors.primary}
              startFillColor={colors.primaryLight}
              endFillColor={colors.background}
              startOpacity={0.35}
              endOpacity={0}
              hideDataPoints
              curved
              hideRules
              yAxisColor="transparent"
              xAxisColor="transparent"
              width={chartInnerWidth}
              height={80}
              initialSpacing={0}
              endSpacing={0}
              maxValue={chartMax - chartMin}
              yAxisOffset={chartMin}
              yAxisLabelWidth={0}
              spacing={Math.max(4, chartInnerWidth / Math.max(areaData.length - 1, 1))}
            />
          </View>
        )}
        {isAhead !== null && (
          <View style={[
            styles.cardFooterStrip,
            { backgroundColor: isAhead ? colors.primaryLight : '#FEE2E2' },
          ]}>
            <Ionicons
              name={isAhead ? 'medal-outline' : 'trending-down-outline'}
              size={14}
              color={isAhead ? colors.primaryDark : colors.negative}
            />
            <Text style={[styles.cardFooterText, { color: isAhead ? colors.primaryDark : colors.negative }]}>
              {isAhead
                ? `You're ${delta.toFixed(1)}% ahead of ${benchmarkLabel}`
                : `${delta.toFixed(1)}% behind ${benchmarkLabel}`}
            </Text>
          </View>
        )}
      </View>

      {/* Card 2: vs Benchmark (collapsible) */}
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={[styles.cardLabel, { flex: 0 }]}>vs Benchmark</Text>
          <View style={styles.benchmarkPillsRow}>
            {BENCHMARK_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.symbol}
                style={[
                  styles.benchmarkPill,
                  benchmarkSymbol === opt.symbol && styles.benchmarkPillActive,
                ]}
                onPress={() => onBenchmarkChange(opt.symbol)}
              >
                <Text style={[
                  styles.benchmarkPillText,
                  benchmarkSymbol === opt.symbol && styles.benchmarkPillTextActive,
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => setBenchmarkExpanded(!benchmarkExpanded)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={benchmarkExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        </View>
        {benchmarkExpanded && isAhead !== null && (
          <View style={styles.benchmarkDetail}>
            <View style={styles.benchmarkDeltaRow}>
              <Text style={[styles.benchmarkDelta, { color: isAhead ? colors.positive : colors.negative }]}>
                {isAhead ? '+' : '-'}{delta.toFixed(1)}%
              </Text>
              <Text style={[styles.benchmarkVerdict, { color: isAhead ? colors.positive : colors.negative }]}>
                {isAhead ? 'Outperformed' : 'Underperformed'}
              </Text>
            </View>
            <Text style={styles.benchmarkSub}>vs {benchmarkLabel} · XIRR based</Text>
          </View>
        )}
      </View>

      {/* Card 3: Return (SIP-aware) with ℹ️ toggle */}
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Return (SIP-aware)</Text>
          <TouchableOpacity
            onPress={() => setShowReturnDetail(!showReturnDetail)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showReturnDetail ? 'information-circle' : 'information-circle-outline'}
              size={18}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.xirrRow}>
          {isFinite(xirrRate) ? (
            <>
              <Text style={styles.xirrBig}>{formatXirr(xirrRate)}</Text>
              <View style={styles.gradeBadge}>
                <Text style={styles.gradeText}>{returnGrade(xirrRate)}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.xirrBig}>—</Text>
          )}
        </View>
        <Text style={styles.xirrSub}>XIRR · annualised, SIP-adjusted</Text>
        {showReturnDetail && (
          <View style={styles.returnDetailRow}>
            <View style={styles.returnDetailItem}>
              <Text style={styles.metricLabel}>Your XIRR</Text>
              <Text style={[styles.metricValue, { color: xirrRate >= 0 ? colors.positive : colors.negative }]}>
                {formatXirr(xirrRate)}
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.returnDetailItem}>
              <Text style={styles.metricLabel}>{benchmarkLabel}</Text>
              <Text style={[styles.metricValue, { color: isFinite(marketXirr) && marketXirr >= 0 ? colors.positive : colors.negative }]}>
                {formatXirr(marketXirr)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Card 4: Fund vs Benchmark line chart */}
      {!chartLoading && areaData.length >= 2 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Fund vs Benchmark</Text>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendText}>Your Portfolio · {formatXirr(xirrRate)}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#94A3B8' }]} />
              <Text style={styles.legendText}>{benchmarkLabel} · {formatXirr(marketXirr)}</Text>
            </View>
          </View>
          <LineChart
            data={areaData}
            data2={lineData2.length > 0 ? lineData2 : undefined}
            color1={colors.primary}
            color2="#94A3B8"
            thickness1={3}
            thickness2={2}
            curved
            hideDataPoints
            hideRules
            yAxisColor="transparent"
            xAxisColor="transparent"
            width={chartInnerWidth}
            height={130}
            initialSpacing={0}
            endSpacing={0}
            maxValue={chartMax - chartMin}
            yAxisOffset={chartMin}
            yAxisLabelWidth={0}
            spacing={Math.max(4, chartInnerWidth / Math.max(areaData.length - 1, 1))}
          />
          <View style={styles.timeSelector}>
            {(['1Y', '3Y'] as V3ChartWindow[]).map((w) => (
              <TouchableOpacity
                key={w}
                style={[styles.timePill, chartWindow === w && styles.timePillActive]}
                onPress={() => setChartWindow(w)}
              >
                <Text style={[styles.timePillText, chartWindow === w && styles.timePillTextActive]}>
                  {w}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function makeV3HeroStyles(colors: AppColors) {
  return StyleSheet.create({
    hero: { gap: 12, paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
    staleBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surfaceAlt,
      borderRadius: Radii.sm,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    staleBannerText: { fontSize: 12, color: colors.textSecondary, flex: 1 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      paddingTop: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
      gap: 10,
    },
    cardLabel: {
      fontSize: 11,
      fontWeight: '600' as const,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    totalValue: {
      fontSize: 32,
      fontWeight: '800' as const,
      color: colors.textPrimary,
      letterSpacing: -1,
    },
    dailyRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    dailyChange: { fontSize: 14, fontWeight: '700' as const },
    metricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      paddingTop: 10,
    },
    metric: { flex: 1, alignItems: 'center', gap: 3 },
    metricLabel: {
      fontSize: 10,
      color: colors.textTertiary,
      fontWeight: '600' as const,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    metricValue: { fontSize: 14, fontWeight: '700' as const, color: colors.textPrimary },
    metricDivider: { width: 1, height: 32, backgroundColor: colors.borderLight },
    areaChartWrap: { marginHorizontal: -Spacing.md, marginBottom: -4 },
    cardFooterStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginHorizontal: -Spacing.md,
      marginBottom: -Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
    },
    cardFooterText: { fontSize: 13, fontWeight: '600' as const },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    benchmarkPillsRow: { flex: 1, flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
    benchmarkPill: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 10,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    benchmarkPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    benchmarkPillText: { fontSize: 11, fontWeight: '600' as const, color: colors.textTertiary },
    benchmarkPillTextActive: { color: '#fff' },
    benchmarkDetail: {
      gap: 4,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      paddingTop: 10,
    },
    benchmarkDeltaRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
    benchmarkDelta: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
    benchmarkVerdict: { fontSize: 14, fontWeight: '700' as const },
    benchmarkSub: { fontSize: 12, color: colors.textTertiary },
    xirrRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    xirrBig: { fontSize: 28, fontWeight: '800' as const, color: colors.textPrimary, letterSpacing: -0.5 },
    xirrSub: { fontSize: 12, color: colors.textTertiary },
    gradeBadge: {
      backgroundColor: colors.primaryLight,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    gradeText: { fontSize: 12, fontWeight: '700' as const, color: colors.primaryDark },
    returnDetailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      paddingTop: 10,
    },
    returnDetailItem: { flex: 1, alignItems: 'center', gap: 3 },
    chartLegend: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' as const },
    timeSelector: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      paddingTop: 10,
    },
    timePill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 16 },
    timePillActive: { backgroundColor: colors.textPrimary },
    timePillText: { fontSize: 12, fontWeight: '600' as const, color: colors.textTertiary },
    timePillTextActive: { color: '#fff' },
  });
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const { colors, variant } = useTheme();
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
      <PrimaryShellHeader onPressMenu={() => setOverflowOpen(true)} />

      <AppOverflowMenu
        visible={overflowOpen}
        syncState={syncState}
        onClose={() => setOverflowOpen(false)}
        onSync={handleSync}
        onImport={() => router.push(profile?.kfintech_email ? '/onboarding/pdf' : '/onboarding')}
        onSettings={() => router.push('/(tabs)/settings')}
      />

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
          {variant === 'v3' ? (
            <V3PortfolioHero
              totalValue={summary.totalValue}
              totalInvested={summary.totalInvested}
              dailyChangeAmount={summary.dailyChangeAmount}
              dailyChangePct={summary.dailyChangePct}
              xirr={summary.xirr}
              marketXirr={summary.marketXirr}
              benchmarkSymbol={defaultBenchmarkSymbol}
              latestNavDate={summary.latestNavDate ?? null}
              onBenchmarkChange={setDefaultBenchmarkSymbol}
              funds={fundRefs}
              userId={userId}
            />
          ) : (
            <>
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
            </>
          )}

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
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
    },
    chartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    chartTitle: { ...Typography.h3, color: colors.textPrimary },
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
    chartLegend: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md, justifyContent: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 9, height: 9, borderRadius: 4.5 },
    legendText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    chartAxisText: { fontSize: 11, color: colors.textTertiary },

    // Gainers / Losers row
    gainersRow: {
      flexDirection: 'row',
      marginHorizontal: Spacing.md,
      marginTop: Spacing.md,
      gap: Spacing.sm,
    },
    gainerCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 3,
      padding: Spacing.md,
      gap: 4,
    },
    gainerLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
    gainerName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, lineHeight: 18 },
    gainerCategory: { fontSize: 12, color: colors.textTertiary, lineHeight: 17, minHeight: 34 },
    gainerPct: { fontSize: 15, fontWeight: '700', marginTop: 6, lineHeight: 20 },
    gainerAmt: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  });
}

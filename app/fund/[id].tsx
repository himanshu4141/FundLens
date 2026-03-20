import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import {
  useFundDetail,
  filterToWindow,
  indexTo100,
  type TimeWindow,
} from '@/src/hooks/useFundDetail';
import { formatXirr } from '@/src/utils/xirr';
import { formatCurrency } from '@/src/utils/formatting';
import { Colors, Spacing, Radii, Typography } from '@/src/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 32;

const TIME_WINDOWS: TimeWindow[] = ['1M', '3M', '6M', '1Y', '3Y', 'All'];

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format a YYYY-MM-DD date string for x-axis labels based on the selected window. */
function formatChartDate(dateStr: string, window: TimeWindow): string {
  const [year, month, day] = dateStr.split('-');
  const mon = MONTH_ABBR[parseInt(month, 10) - 1] ?? month;
  const yr2 = year.slice(2);
  switch (window) {
    case '1M': return `${parseInt(day, 10)} ${mon}`;   // "5 Feb"
    case '3M': return `${parseInt(day, 10)} ${mon}`;   // "20 Dec"
    case '6M': return `${mon} '${yr2}`;                // "Sep '24"
    case '1Y': return `${mon} '${yr2}`;                // "Mar '25"
    case '3Y':
    case 'All': return `${mon} '${yr2}`;               // "Jan '22"
  }
}

function TimeWindowSelector({
  selected,
  onChange,
}: {
  selected: TimeWindow;
  onChange: (w: TimeWindow) => void;
}) {
  return (
    <View style={styles.windowRow}>
      {TIME_WINDOWS.map((w) => (
        <TouchableOpacity
          key={w}
          style={[styles.windowPill, selected === w && styles.windowPillActive]}
          onPress={() => onChange(w)}
          activeOpacity={0.75}
        >
          <Text style={[styles.windowPillText, selected === w && styles.windowPillTextActive]}>
            {w}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function PerformanceTab({
  navHistory,
  indexHistory,
  fundXirr,
  benchmarkIndex,
}: {
  navHistory: { date: string; value: number }[];
  indexHistory: { date: string; value: number }[];
  fundXirr: number;
  benchmarkIndex: string | null;
}) {
  const [window, setWindow] = useState<TimeWindow>('1Y');
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);

  const filteredNav = filterToWindow(navHistory, window);
  const filteredIdx = filterToWindow(indexHistory, window);
  const indexedNav = indexTo100(filteredNav);
  const indexedBenchmark = indexTo100(filteredIdx);

  function sample<T>(arr: T[], max: number): T[] {
    if (arr.length <= max) return arr;
    const step = Math.ceil(arr.length / max);
    return arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
  }

  const sampledNav = sample(indexedNav, 60);

  // Align benchmark to nav sample dates so data + data2 always have identical length.
  // Without alignment, gifted-charts renders mismatched-length series across the same
  // x-width, making the shorter line appear to "cut off".
  function nearestBenchmarkValue(
    series: { date: string; value: number }[],
    targetDate: string,
  ): number {
    if (series.length === 0) return 100;
    let lo = 0, hi = series.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (series[mid].date < targetDate) lo = mid + 1;
      else hi = mid;
    }
    if (lo === 0) return series[0].value;
    if (lo >= series.length) return series[series.length - 1].value;
    return series[lo - 1].value;
  }

  const navPoints = sampledNav.map((p) => ({ value: p.value }));
  const hasNavData = navPoints.length > 1;
  const hasBenchmarkData = indexedBenchmark.length > 1;
  const benchmarkPoints = hasBenchmarkData
    ? sampledNav.map((p) => ({ value: nearestBenchmarkValue(indexedBenchmark, p.date) }))
    : [];

  // X-axis date labels: show ~5 evenly spaced dates (full-length array required by gifted-charts)
  const labelInterval = Math.max(1, Math.floor(sampledNav.length / 5));
  const xLabels = sampledNav.map((p, i) =>
    i % labelInterval === 0 || i === sampledNav.length - 1
      ? formatChartDate(p.date, window)
      : ''
  );

  // Y-axis range with 12% padding so the line never hugs the edges
  const allVals = [
    ...navPoints.map((p) => p.value),
    ...(hasBenchmarkData ? benchmarkPoints.map((p) => p.value) : []),
  ];
  const yMax = allVals.length > 0 ? Math.max(...allVals) : 110;
  const yMin = allVals.length > 0 ? Math.min(...allVals) : 90;
  const yPad = ((yMax - yMin) || yMax * 0.1 || 1) * 0.12;
  const chartMaxValue = yMax + yPad;
  const chartMostNegative = Math.min(0, yMin - yPad);

  const focusedDate = focusedIdx !== null ? (sampledNav[focusedIdx]?.date ?? null) : null;
  const focusedNavVal = focusedIdx !== null ? (sampledNav[focusedIdx]?.value ?? null) : null;

  const latestNav = indexedNav[indexedNav.length - 1]?.value ?? 100;
  const latestBenchmark = indexedBenchmark[indexedBenchmark.length - 1]?.value ?? 100;
  const navReturn = ((latestNav - 100) / 100) * 100;
  const benchmarkReturn = ((latestBenchmark - 100) / 100) * 100;
  const isAhead = isFinite(navReturn) && isFinite(benchmarkReturn) && navReturn >= benchmarkReturn;

  return (
    <View style={styles.tabContent}>
      {/* XIRR card */}
      <View style={styles.xirrCard}>
        <View style={styles.xirrStat}>
          <Text style={styles.statLabel}>Your Return</Text>
          <Text
            style={[
              styles.xirrValue,
              { color: isFinite(fundXirr) && fundXirr >= 0 ? Colors.positive : Colors.negative },
            ]}
          >
            {formatXirr(fundXirr)}
          </Text>
          <Text style={styles.xirrHint}>SIP-adjusted annualised return</Text>
        </View>
        {benchmarkIndex && hasBenchmarkData && (
          <>
            <View style={styles.xirrDivider} />
            <View style={styles.xirrStat}>
              <Text style={styles.statLabel}>{benchmarkIndex}</Text>
              <Text style={styles.xirrValue}>{benchmarkReturn.toFixed(1)}%</Text>
              <View style={styles.vsChip}>
                <Text style={[styles.vsChipText, { color: isAhead ? Colors.positive : Colors.negative }]}>
                  {isAhead ? '↑ Outperforming' : '↓ Underperforming'}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>

      <TimeWindowSelector selected={window} onChange={setWindow} />

      {hasNavData ? (
        <View style={styles.chartCard}>
          <View style={styles.chartLegendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.legendLabel}>Fund NAV</Text>
            </View>
            {hasBenchmarkData && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                <Text style={styles.legendLabel}>{benchmarkIndex ?? 'Benchmark'}</Text>
              </View>
            )}
          </View>

          <View style={{ overflow: 'hidden' }}>
          <LineChart
            data={navPoints}
            data2={hasBenchmarkData ? benchmarkPoints : undefined}
            width={CHART_WIDTH - 32}
            height={180}
            initialSpacing={0}
            endSpacing={0}
            hideDataPoints
            color1={Colors.primary}
            color2="#f59e0b"
            thickness1={2.5}
            thickness2={2}
            startFillColor1={Colors.primary}
            endFillColor1="#fff"
            startOpacity1={0.15}
            endOpacity1={0}
            areaChart
            curved
            hideYAxisText
            yAxisLabelWidth={0}
            maxValue={chartMaxValue}
            mostNegativeValue={chartMostNegative}
            xAxisColor={Colors.borderLight}
            yAxisColor="transparent"
            rulesColor={Colors.borderLight}
            rulesType="solid"
            noOfSections={4}
            xAxisLabelTexts={xLabels}
            xAxisLabelTextStyle={styles.chartAxisLabel}
            focusEnabled
            showDataPointOnFocus
            showStripOnFocus
            stripColor={Colors.textTertiary + '66'}
            stripWidth={1}
            focusedDataPointRadius={4}
            onFocus={(_item: unknown, index: number) => setFocusedIdx(index)}
          />
          </View>
          {focusedDate !== null && focusedNavVal !== null && (
            <View style={styles.chartFocusRow}>
              <Text style={styles.chartFocusDate}>{focusedDate}</Text>
              <Text style={styles.chartFocusVal}>Fund: {focusedNavVal.toFixed(1)}</Text>
            </View>
          )}

          <View style={styles.returnSummary}>
            <View style={styles.returnRow}>
              <Text style={styles.returnLabel}>Fund ({window})</Text>
              <Text style={[styles.returnVal, { color: navReturn >= 0 ? Colors.positive : Colors.negative }]}>
                {navReturn >= 0 ? '+' : ''}{navReturn.toFixed(2)}%
              </Text>
            </View>
            {hasBenchmarkData && (
              <View style={styles.returnRow}>
                <Text style={styles.returnLabel}>{benchmarkIndex ?? 'Benchmark'} ({window})</Text>
                <Text style={[styles.returnVal, { color: benchmarkReturn >= 0 ? Colors.positive : Colors.negative }]}>
                  {benchmarkReturn >= 0 ? '+' : ''}{benchmarkReturn.toFixed(2)}%
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.noData}>
          <Ionicons name="bar-chart-outline" size={32} color={Colors.textTertiary} />
          <Text style={styles.noDataText}>No NAV data available for this window.</Text>
        </View>
      )}
    </View>
  );
}

function NavHistoryTab({ navHistory }: { navHistory: { date: string; value: number }[] }) {
  const [window, setWindow] = useState<TimeWindow>('1Y');
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const filtered = filterToWindow(navHistory, window);

  function sample<T>(arr: T[], max: number): T[] {
    if (arr.length <= max) return arr;
    const step = Math.ceil(arr.length / max);
    return arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
  }

  const sampledFiltered = sample(filtered, 90);
  const points = sampledFiltered.map((p) => ({ value: p.value }));
  const currentNav = filtered[filtered.length - 1]?.value;
  const startNav = filtered[0]?.value;
  const navChange = currentNav && startNav ? ((currentNav - startNav) / startNav) * 100 : null;

  const labelInterval = Math.max(1, Math.floor(sampledFiltered.length / 5));
  const xLabels = sampledFiltered.map((p, i) =>
    i % labelInterval === 0 || i === sampledFiltered.length - 1
      ? formatChartDate(p.date, window)
      : ''
  );

  // Y-axis range with 12% padding
  const navVals = points.map((p) => p.value);
  const navYMax = navVals.length > 0 ? Math.max(...navVals) : 100;
  const navYMin = navVals.length > 0 ? Math.min(...navVals) : 0;
  const navYPad = ((navYMax - navYMin) || navYMax * 0.1 || 1) * 0.12;
  const navChartMax = navYMax + navYPad;
  const navChartMin = Math.max(0, navYMin - navYPad);

  const focusedDate = focusedIdx !== null ? (sampledFiltered[focusedIdx]?.date ?? null) : null;
  const focusedNavVal = focusedIdx !== null ? (sampledFiltered[focusedIdx]?.value ?? null) : null;

  return (
    <View style={styles.tabContent}>
      <TimeWindowSelector selected={window} onChange={setWindow} />

      {points.length > 1 ? (
        <View style={styles.chartCard}>
          <View style={{ overflow: 'hidden' }}>
          <LineChart
            data={points}
            width={CHART_WIDTH - 32}
            height={200}
            initialSpacing={0}
            endSpacing={0}
            hideDataPoints
            color1={Colors.primary}
            thickness1={2.5}
            startFillColor1={Colors.primary}
            endFillColor1="#fff"
            startOpacity1={0.15}
            endOpacity1={0}
            areaChart
            curved
            hideYAxisText
            yAxisLabelWidth={0}
            maxValue={navChartMax}
            mostNegativeValue={navChartMin}
            xAxisColor={Colors.borderLight}
            yAxisColor="transparent"
            rulesColor={Colors.borderLight}
            rulesType="solid"
            noOfSections={4}
            xAxisLabelTexts={xLabels}
            xAxisLabelTextStyle={styles.chartAxisLabel}
            focusEnabled
            showDataPointOnFocus
            showStripOnFocus
            stripColor={Colors.textTertiary + '66'}
            stripWidth={1}
            focusedDataPointRadius={4}
            onFocus={(_item: unknown, index: number) => setFocusedIdx(index)}
          />
          </View>
          {focusedDate !== null && focusedNavVal !== null && (
            <View style={styles.chartFocusRow}>
              <Text style={styles.chartFocusDate}>{focusedDate}</Text>
              <Text style={styles.chartFocusVal}>NAV: ₹{focusedNavVal.toFixed(3)}</Text>
            </View>
          )}

          <View style={styles.navStatsRow}>
            <View style={styles.navStat}>
              <Text style={styles.statLabel}>Current NAV</Text>
              <Text style={styles.navStatValue}>₹{currentNav?.toFixed(3) ?? '—'}</Text>
            </View>
            <View style={styles.navStat}>
              <Text style={styles.statLabel}>Period start</Text>
              <Text style={styles.navStatValue}>₹{startNav?.toFixed(3) ?? '—'}</Text>
            </View>
            {navChange !== null && (
              <View style={styles.navStat}>
                <Text style={styles.statLabel}>Change ({window})</Text>
                <Text
                  style={[styles.navStatValue, { color: navChange >= 0 ? Colors.positive : Colors.negative }]}
                >
                  {navChange >= 0 ? '+' : ''}{navChange.toFixed(2)}%
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.noData}>
          <Ionicons name="bar-chart-outline" size={32} color={Colors.textTertiary} />
          <Text style={styles.noDataText}>No NAV data for this window.</Text>
        </View>
      )}
    </View>
  );
}

export default function FundDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'performance' | 'nav'>('performance');
  const { data, isLoading, isError } = useFundDetail(id);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* ── Header ── */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Portfolio
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : isError || !data ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.errorText}>Couldn&apos;t load fund data</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* ── Fund header card ── */}
          <View style={styles.fundHeader}>
            <Text style={styles.fundName}>{data.schemeName}</Text>
            <Text style={styles.fundCategory}>{data.schemeCategory}</Text>

            <View style={styles.holdingRow}>
              <View style={styles.holdingStat}>
                <Text style={styles.statLabel}>Current Value</Text>
                <Text style={styles.holdingValue}>{formatCurrency(data.currentValue)}</Text>
              </View>
              <View style={styles.holdingStat}>
                <Text style={styles.statLabel}>Invested</Text>
                <Text style={styles.holdingValue}>{formatCurrency(data.investedAmount)}</Text>
              </View>
              <View style={styles.holdingStat}>
                <Text style={styles.statLabel}>Units</Text>
                <Text style={styles.holdingValue}>{data.currentUnits.toFixed(3)}</Text>
              </View>
            </View>

            {data.benchmarkIndex && (
              <View style={styles.benchmarkRow}>
                <Ionicons name="git-compare-outline" size={12} color={Colors.textTertiary} />
                <Text style={styles.benchmarkLabel}>vs {data.benchmarkIndex}</Text>
              </View>
            )}
          </View>

          {/* ── Tab bar ── */}
          <View style={styles.tabBar}>
            {(['performance', 'nav'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.75}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'performance' ? 'Performance' : 'NAV History'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'performance' ? (
            <PerformanceTab
              navHistory={data.navHistory}
              indexHistory={data.indexHistory}
              fundXirr={data.fundXirr}
              benchmarkIndex={data.benchmarkIndex}
            />
          ) : (
            <NavHistoryTab navHistory={data.navHistory} />
          )}

          <View style={styles.bottomPad} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { ...Typography.body, color: Colors.textSecondary },
  backLink: { color: Colors.primary, fontSize: 14, fontWeight: '600' },

  // ── Fund header ──
  fundHeader: {
    backgroundColor: Colors.surface,
    margin: Spacing.md,
    borderRadius: Radii.md,
    padding: 18,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  fundName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, lineHeight: 22 },
  fundCategory: { ...Typography.bodySmall, color: Colors.textTertiary, marginBottom: 4 },

  holdingRow: { flexDirection: 'row', marginTop: 4 },
  holdingStat: { flex: 1, alignItems: 'center', gap: 3 },
  holdingValue: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },

  benchmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  benchmarkLabel: { fontSize: 12, color: Colors.textTertiary },

  // ── Tab bar ──
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.borderLight,
    borderRadius: Radii.sm + 2,
    padding: 3,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radii.sm,
  },
  tabActive: {
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: { fontSize: 13, fontWeight: '500', color: Colors.textTertiary },
  tabTextActive: { color: Colors.textPrimary, fontWeight: '700' },

  // ── Tab content ──
  tabContent: { paddingHorizontal: Spacing.md, gap: 14 },

  // XIRR card
  xirrCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  xirrStat: { flex: 1, gap: 4 },
  xirrDivider: { width: 1, backgroundColor: Colors.borderLight },
  xirrValue: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  xirrHint: { ...Typography.caption, color: Colors.textTertiary },

  vsChip: {},
  vsChipText: { fontSize: 12, fontWeight: '600' },

  // Chart
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  chartLegendRow: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: Colors.textSecondary },

  returnSummary: { gap: 6, marginTop: 4 },
  returnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  returnLabel: { fontSize: 13, color: Colors.textSecondary },
  returnVal: { fontSize: 14, fontWeight: '700' },

  navStatsRow: { flexDirection: 'row' },
  navStat: { flex: 1, alignItems: 'center', gap: 3 },
  navStatValue: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },

  statLabel: { ...Typography.caption, color: Colors.textTertiary, textTransform: 'uppercase' },

  windowRow: { flexDirection: 'row', gap: 6 },
  windowPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: Radii.full,
    alignItems: 'center',
    backgroundColor: Colors.borderLight,
  },
  windowPillActive: { backgroundColor: Colors.primary },
  windowPillText: { fontSize: 12, fontWeight: '600', color: Colors.textTertiary },
  windowPillTextActive: { color: '#fff' },

  chartAxisLabel: { fontSize: 9, color: Colors.textTertiary },
  chartFocusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingHorizontal: 2,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  chartFocusDate: { fontSize: 11, color: Colors.textTertiary },
  chartFocusVal: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },

  noData: { padding: 40, alignItems: 'center', gap: 10 },
  noDataText: { ...Typography.body, color: Colors.textTertiary, textAlign: 'center' },

  bottomPad: { height: 32 },
});

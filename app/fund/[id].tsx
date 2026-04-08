import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-gifted-charts';
import { useQuery } from '@tanstack/react-query';
import {
  useFundDetail,
  filterToWindow,
  indexTo100,
  type TimeWindow,
} from '@/src/hooks/useFundDetail';
import { usePortfolio } from '@/src/hooks/usePortfolio';
import { computeQuarterlyReturns } from '@/src/utils/quarterlyReturns';
import { formatXirr } from '@/src/utils/xirr';
import { formatCurrency } from '@/src/utils/formatting';
import { Colors, Spacing, Radii, Typography } from '@/src/constants/theme';
import { supabase } from '@/src/lib/supabase';
import { BENCHMARK_OPTIONS, useAppStore } from '@/src/store/appStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 32;

const TIME_WINDOWS: TimeWindow[] = ['1M', '3M', '6M', '1Y', '3Y', 'All'];

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format a YYYY-MM-DD NAV date for staleness display: "2026-03-20" → "20 Mar" */
function formatNavDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [, month, day] = parts;
  return `${parseInt(day, 10)} ${MONTH_ABBR[parseInt(month, 10) - 1]}`;
}

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
  defaultBenchmarkSymbol,
}: {
  navHistory: { date: string; value: number }[];
  defaultBenchmarkSymbol: string | null;
}) {
  const [window, setWindow] = useState<TimeWindow>('1Y');
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    const valid = BENCHMARK_OPTIONS.some((b) => b.symbol === defaultBenchmarkSymbol);
    return valid && defaultBenchmarkSymbol ? defaultBenchmarkSymbol : '^NSEI';
  });
  // Track crosshair position so the return summary below the chart stays in sync.
  // null = no active crosshair (show end-of-period values).
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const { data: indexRows } = useQuery({
    queryKey: ['index-history', selectedSymbol],
    queryFn: async () => {
      // ascending: false → most-recent 1000 rows (avoids returning only pre-2021 data
      // for long-history indexes like BSE Sensex). Reversed back to ascending for chart use.
      const { data } = await supabase
        .from('index_history')
        .select('index_date, close_value')
        .eq('index_symbol', selectedSymbol)
        .order('index_date', { ascending: false });
      return (data ?? [])
        .map((r) => ({ date: r.index_date as string, value: r.close_value as number }))
        .reverse();
    },
    staleTime: 5 * 60_000,
  });

  const indexHistory = indexRows ?? [];
  const selectedLabel = BENCHMARK_OPTIONS.find((b) => b.symbol === selectedSymbol)?.label ?? selectedSymbol;

  // Reset crosshair when window or benchmark changes so summary resets to period-end values.
  useEffect(() => { setActiveIdx(null); }, [window, selectedSymbol]);

  const filteredNav = filterToWindow(navHistory, window);
  const navStartDate = filteredNav[0]?.date ?? '';
  const filteredIdx = indexHistory.filter((p) => p.date >= navStartDate);
  // Use the later of the two start dates so both series are indexed to 100 at the same moment.
  // Without this, nearestBenchmarkValue returns 100 for all dates before the index's first point,
  // making the benchmark appear flat while the fund grows.
  const idxStartDate = filteredIdx[0]?.date ?? navStartDate;
  const commonStart = navStartDate >= idxStartDate ? navStartDate : idxStartDate;
  const alignedNav = filteredNav.filter((p) => p.date >= commonStart);
  const alignedIdx = filteredIdx.filter((p) => p.date >= commonStart);

  const indexedNav = indexTo100(alignedNav);
  const indexedBenchmark = indexTo100(alignedIdx);

  function sample<T>(arr: T[], max: number): T[] {
    if (arr.length <= max) return arr;
    const step = Math.ceil(arr.length / max);
    return arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
  }

  const sampledNav = sample(indexedNav, 60);

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

  // Spacing: fit all sampled points exactly within the chart body (no overflow / no scroll).
  // chart body width = total width passed to LineChart minus y-axis label area
  const PERF_Y_AXIS_W = 32;
  const perfChartBodyW = CHART_WIDTH - 32 - PERF_Y_AXIS_W; // 32 = card padding (16×2)
  const perfSpacing = sampledNav.length > 1 ? perfChartBodyW / (sampledNav.length - 1) : 20;

  const labelInterval = Math.max(1, Math.floor(sampledNav.length / 5));
  const xLabels = sampledNav.map((p, i) =>
    i % labelInterval === 0 || i === sampledNav.length - 1
      ? formatChartDate(p.date, window)
      : ''
  );

  const allVals = [
    ...navPoints.map((p) => p.value),
    ...(hasBenchmarkData ? benchmarkPoints.map((p) => p.value) : []),
  ];
  const yMax = allVals.length > 0 ? Math.max(...allVals) : 110;
  const yMin = allVals.length > 0 ? Math.min(...allVals) : 90;
  const yPad = ((yMax - yMin) || yMax * 0.1 || 1) * 0.12;
  const chartMaxValue = yMax + yPad;
  const chartMostNegative = Math.min(0, yMin - yPad);

  const latestNav = indexedNav[indexedNav.length - 1]?.value ?? 100;
  const latestBenchmark = indexedBenchmark[indexedBenchmark.length - 1]?.value ?? 100;
  const navReturn = ((latestNav - 100) / 100) * 100;
  const benchmarkReturn = ((latestBenchmark - 100) / 100) * 100;
  const isAhead = isFinite(navReturn) && isFinite(benchmarkReturn) && navReturn >= benchmarkReturn;
  const diff = navReturn - benchmarkReturn;

  // Values to show in the summary below the chart.
  // When crosshair is active, show the hovered values; otherwise show end-of-period.
  const summaryIdx = activeIdx !== null && activeIdx < sampledNav.length ? activeIdx : sampledNav.length - 1;
  const summaryNavVal = sampledNav[summaryIdx]?.value ?? 100;
  const summaryBenchVal = hasBenchmarkData ? (benchmarkPoints[summaryIdx]?.value ?? 100) : null;
  const summaryNavReturn = ((summaryNavVal - 100) / 100) * 100;
  const summaryBenchReturn = summaryBenchVal !== null ? ((summaryBenchVal - 100) / 100) * 100 : null;
  const summaryDate = sampledNav[summaryIdx]?.date;

  return (
    <View style={styles.tabContent}>
      {/* Period return comparison card */}
      <View style={styles.xirrCard}>
        <View style={styles.comparisonRow}>
          <View style={styles.comparisonCol}>
            <Text style={styles.statLabel}>Your Fund ({window})</Text>
            <Text style={[styles.xirrValue, { color: navReturn >= 0 ? Colors.positive : Colors.negative }]}>
              {navReturn >= 0 ? '+' : ''}{navReturn.toFixed(1)}%
            </Text>
          </View>
          {hasBenchmarkData && (
            <>
              <View style={styles.xirrDivider} />
              <View style={styles.comparisonCol}>
                <Text style={styles.statLabel}>{selectedLabel} ({window})</Text>
                <Text style={[styles.xirrValue, { color: benchmarkReturn >= 0 ? Colors.positive : Colors.negative }]}>
                  {benchmarkReturn >= 0 ? '+' : ''}{benchmarkReturn.toFixed(1)}%
                </Text>
              </View>
            </>
          )}
        </View>
        {hasBenchmarkData && (
          <View style={styles.verdictRow}>
            <Text style={[styles.verdictText, { color: isAhead ? Colors.positive : Colors.negative }]}>
              {isAhead ? '↑ Outperforming' : '↓ Underperforming'}
              {' by '}{Math.abs(diff).toFixed(1)}% vs {selectedLabel}
            </Text>
          </View>
        )}
      </View>

      <TimeWindowSelector selected={window} onChange={setWindow} />

      {/* Benchmark selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.benchmarkSelectorContent}
      >
        {BENCHMARK_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.symbol}
            style={[styles.benchmarkPill, selectedSymbol === opt.symbol && styles.benchmarkPillActive]}
            onPress={() => setSelectedSymbol(opt.symbol)}
            activeOpacity={0.75}
          >
            <Text style={[styles.benchmarkPillText, selectedSymbol === opt.symbol && styles.benchmarkPillTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
                <Text style={styles.legendLabel}>{selectedLabel}</Text>
              </View>
            )}
          </View>

          <LineChart
              data={navPoints}
              data2={hasBenchmarkData ? benchmarkPoints : undefined}
              width={CHART_WIDTH - 32}
              height={180}
              spacing={perfSpacing}
              initialSpacing={0}
              endSpacing={32}
              hideDataPoints
              color1={Colors.primary}
              color2="#f59e0b"
              thickness1={3}
              thickness2={2.5}
              curved
              yAxisLabelWidth={32}
              formatYLabel={(v: string) => Number(v).toFixed(0)}
              yAxisTextStyle={styles.chartAxisLabel}
              maxValue={chartMaxValue}
              mostNegativeValue={chartMostNegative}
              xAxisColor={Colors.borderLight}
              yAxisColor="transparent"
              rulesColor={Colors.borderLight}
              rulesType="solid"
              noOfSections={4}
              referenceLine1Config={{
                color: Colors.textTertiary + '66',
                dashWidth: 4,
                dashGap: 4,
                thickness: 1,
              }}
              referenceLine1Position={100}
              xAxisLabelTexts={xLabels}
              xAxisLabelTextStyle={styles.chartAxisLabel}
              xAxisLabelsHeight={16}
              labelsExtraHeight={40}
              pointerConfig={{
                showPointerStrip: true,
                pointerStripHeight: 180,
                pointerStripWidth: 1,
                pointerStripColor: Colors.textTertiary + '88',
                pointerColor: Colors.primary,
                radius: 5,
                pointerLabelWidth: 140,
                pointerLabelHeight: hasBenchmarkData ? 52 : 36,
                activatePointersOnLongPress: false,
                autoAdjustPointerLabelPosition: true,
                pointerLabelComponent: (_items: unknown, _sec: unknown, pointerIndex: number) => {
                  // Schedule summary update outside of render to avoid setState-in-render.
                  requestAnimationFrame(() => setActiveIdx(pointerIndex));
                  const navVal = sampledNav[pointerIndex]?.value;
                  const benchVal = hasBenchmarkData ? benchmarkPoints[pointerIndex]?.value : undefined;
                  const date = sampledNav[pointerIndex]?.date;
                  return (
                    <View style={styles.pointerLabel}>
                      {date !== undefined && (
                        <Text style={styles.pointerDate}>{formatChartDate(date, window)}</Text>
                      )}
                      {navVal !== undefined && (
                        <Text style={styles.pointerSeriesText}>
                          <Text style={{ color: Colors.primary }}>● </Text>
                          Fund: {navVal.toFixed(1)}
                        </Text>
                      )}
                      {benchVal !== undefined && (
                        <Text style={styles.pointerSeriesText}>
                          <Text style={{ color: '#f59e0b' }}>● </Text>
                          {selectedLabel}: {benchVal.toFixed(1)}
                        </Text>
                      )}
                    </View>
                  );
                },
              }}
            />

          {/* Explainer */}
          <Text style={styles.chartExplainer}>
            Both series rebased to 100 at start of period · higher = outperforming
          </Text>

          {!hasBenchmarkData && (
            <Text style={styles.noBenchmarkNote}>
              {selectedLabel} data not available for the {window} window
            </Text>
          )}

          <View style={styles.returnSummary}>
            {activeIdx !== null && summaryDate && (
              <Text style={styles.summaryDateLabel}>
                as of {formatChartDate(summaryDate, window)}
              </Text>
            )}
            <View style={styles.returnRow}>
              <Text style={styles.returnLabel}>Fund</Text>
              <Text style={[styles.returnVal, { color: summaryNavReturn >= 0 ? Colors.positive : Colors.negative }]}>
                {summaryNavReturn >= 0 ? '+' : ''}{summaryNavReturn.toFixed(2)}%
              </Text>
            </View>
            {hasBenchmarkData && summaryBenchReturn !== null && (
              <View style={styles.returnRow}>
                <Text style={styles.returnLabel}>{selectedLabel}</Text>
                <Text style={[styles.returnVal, { color: summaryBenchReturn >= 0 ? Colors.positive : Colors.negative }]}>
                  {summaryBenchReturn >= 0 ? '+' : ''}{summaryBenchReturn.toFixed(2)}%
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

  const NAV_Y_AXIS_W = 44;
  const navChartBodyW = CHART_WIDTH - 32 - NAV_Y_AXIS_W;
  const navSpacing = sampledFiltered.length > 1 ? navChartBodyW / (sampledFiltered.length - 1) : 20;

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
            spacing={navSpacing}
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
            yAxisLabelWidth={44}
            formatYLabel={(v: string) => {
              const n = Number(v);
              if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
              return `₹${n.toFixed(0)}`;
            }}
            yAxisTextStyle={styles.chartAxisLabel}
            maxValue={navChartMax}
            mostNegativeValue={navChartMin}
            xAxisColor={Colors.borderLight}
            yAxisColor="transparent"
            rulesColor={Colors.borderLight}
            rulesType="solid"
            noOfSections={4}
            xAxisLabelTexts={xLabels}
            xAxisLabelTextStyle={styles.chartAxisLabel}
            pointerConfig={{
              showPointerStrip: true,
              pointerStripHeight: 200,
              pointerStripWidth: 1,
              pointerStripColor: Colors.textTertiary + '88',
              pointerColor: Colors.primary,
              radius: 5,
              pointerLabelWidth: 110,
              pointerLabelHeight: 36,
              activatePointersOnLongPress: false,
              autoAdjustPointerLabelPosition: true,
              pointerLabelComponent: (_items: unknown, _sec: unknown, pointerIndex: number) => {
                const p = sampledFiltered[pointerIndex];
                if (!p) return null;
                return (
                  <View style={styles.pointerLabel}>
                    <Text style={styles.pointerDate}>{formatChartDate(p.date, window)}</Text>
                    <Text style={styles.pointerSeriesText}>
                      <Text style={{ color: Colors.primary }}>● </Text>
                      ₹{p.value.toFixed(4)}
                    </Text>
                  </View>
                );
              },
            }}
          />
          </View>

          <View style={styles.navStatsRow}>
            <View style={styles.navStat}>
              <Text style={styles.statLabel}>Current NAV</Text>
              <Text style={styles.navStatValue}>₹{currentNav?.toFixed(4) ?? '—'}</Text>
            </View>
            <View style={styles.navStat}>
              <Text style={styles.statLabel}>Period start</Text>
              <Text style={styles.navStatValue}>₹{startNav?.toFixed(4) ?? '—'}</Text>
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

// ---------------------------------------------------------------------------
// Technical Details Card
// ---------------------------------------------------------------------------

function TechnicalDetailsCard({
  expenseRatio,
  aumCr,
  minSipAmount,
  fundMetaSyncedAt,
  schemeCode,
}: {
  expenseRatio: number | null;
  aumCr: number | null;
  minSipAmount: number | null;
  fundMetaSyncedAt: string | null;
  schemeCode: number;
}) {
  const unsynced = !fundMetaSyncedAt;

  function openSid() {
    const url = `https://www.mfapi.in/mf/${schemeCode}`;
    Linking.openURL(url);
  }

  return (
    <View style={techStyles.card}>
      <Text style={techStyles.title}>Technical Details</Text>
      <View style={techStyles.row}>
        <View style={techStyles.cell}>
          <Text style={techStyles.label}>Expense Ratio</Text>
          <Text style={techStyles.value}>
            {unsynced || expenseRatio == null ? '—' : `${expenseRatio.toFixed(2)}%`}
          </Text>
        </View>
        <View style={techStyles.cell}>
          <Text style={techStyles.label}>AUM</Text>
          <Text style={techStyles.value}>
            {unsynced || aumCr == null ? '—' : `₹${Math.round(aumCr).toLocaleString('en-IN')} Cr`}
          </Text>
        </View>
        <View style={techStyles.cell}>
          <Text style={techStyles.label}>Min SIP</Text>
          <Text style={techStyles.value}>
            {unsynced || minSipAmount == null ? '—' : `₹${minSipAmount.toLocaleString('en-IN')}`}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={openSid} style={techStyles.sidLink}>
        <Text style={techStyles.sidLinkText}>View fund factsheet ↗</Text>
      </TouchableOpacity>
    </View>
  );
}

const techStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    ...Typography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: 2,
    textAlign: 'center',
  },
  value: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  sidLink: {
    marginTop: Spacing.xs,
    alignItems: 'center',
  },
  sidLinkText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
});

// ---------------------------------------------------------------------------
// Growth Consistency Chart — quarterly returns from navHistory
// ---------------------------------------------------------------------------

function GrowthConsistencyChart({ navHistory }: { navHistory: { date: string; value: number }[] }) {
  // Muted semi-transparent colors so bars feel lighter, not heavy blocks
  const bars = computeQuarterlyReturns(navHistory, '#16a34a', '#dc2626');
  if (bars.length < 2) return null;

  const vals = bars.map((b) => Math.abs(b.value));
  const maxAbs = Math.max(...vals, 1);
  const chartMax = maxAbs * 1.3;

  const barWidth = Math.min(20, Math.floor((CHART_WIDTH - 64) / bars.length) - 6);
  const spacing = Math.max(4, Math.floor((CHART_WIDTH - 64 - barWidth * bars.length) / (bars.length + 1)));

  return (
    <View style={growthStyles.card}>
      <Text style={growthStyles.title}>Growth Consistency</Text>
      <Text style={growthStyles.subtitle}>Quarterly returns (%)</Text>
      <View style={{ marginTop: Spacing.xs }}>
        <BarChart
          data={bars}
          width={CHART_WIDTH - 64}
          height={140}
          barWidth={barWidth}
          spacing={spacing}
          barBorderRadius={4}
          initialSpacing={spacing}
          maxValue={chartMax}
          mostNegativeValue={-chartMax}
          noOfSections={4}
          isAnimated
          hideRules={false}
          rulesColor={Colors.borderLight}
          rulesType="solid"
          xAxisColor={Colors.borderLight}
          yAxisColor="transparent"
          yAxisTextStyle={growthStyles.axisLabel}
          xAxisLabelTextStyle={growthStyles.axisLabel}
          formatYLabel={(v: string) => `${Number(v).toFixed(0)}%`}
          yAxisLabelWidth={36}
          showValuesAsTopLabel
          topLabelTextStyle={{ ...growthStyles.barTopLabel }}
          showFractionalValues
          referenceLine1Config={{
            color: Colors.textTertiary,
            dashWidth: 4,
            dashGap: 4,
            thickness: 1,
          }}
          referenceLine1Position={0}
        />
      </View>
      <View style={growthStyles.legend}>
        <View style={growthStyles.legendItem}>
          <View style={[growthStyles.legendDot, { backgroundColor: Colors.positive }]} />
          <Text style={growthStyles.legendText}>Positive quarter</Text>
        </View>
        <View style={growthStyles.legendItem}>
          <View style={[growthStyles.legendDot, { backgroundColor: Colors.negative }]} />
          <Text style={growthStyles.legendText}>Negative quarter</Text>
        </View>
      </View>
    </View>
  );
}

const growthStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    ...Typography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  axisLabel: { fontSize: 10, color: Colors.textTertiary },
  barTopLabel: { fontSize: 9, color: Colors.textSecondary },
  legend: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...Typography.caption, color: Colors.textTertiary },
});

// ---------------------------------------------------------------------------
// Portfolio Health Donut
// ---------------------------------------------------------------------------

function ordinalRank(rank: number): string {
  if (rank === 1) return 'Largest position';
  if (rank === 2) return '2nd largest';
  if (rank === 3) return '3rd largest';
  return `${rank}th largest`;
}

function PortfolioHealthDonut({
  fundId,
  currentValue,
}: {
  fundId: string;
  currentValue: number | null;
}) {
  const { defaultBenchmarkSymbol } = useAppStore();
  const { data: portfolioData } = usePortfolio(defaultBenchmarkSymbol);
  const fundCards = portfolioData?.fundCards ?? [];
  const summary = portfolioData?.summary ?? null;
  const totalValue = summary?.totalValue ?? 0;

  if (!currentValue || currentValue <= 0 || totalValue <= 0) return null;

  const fundPct = (currentValue / totalValue) * 100;
  const restPct = 100 - fundPct;

  // Rank this fund among all holdings by currentValue (descending)
  const sorted = [...fundCards]
    .filter((f) => f.currentValue !== null && f.currentValue > 0)
    .sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0));
  const rank = sorted.findIndex((f) => f.id === fundId) + 1;
  const rankLabel = rank > 0 ? ordinalRank(rank) : null;

  const donutData = [
    { value: fundPct, color: Colors.primary },
    { value: Math.max(restPct, 0), color: Colors.borderLight },
  ];

  return (
    <View style={donutStyles.card}>
      <Text style={donutStyles.title}>Portfolio Weight</Text>
      <View style={donutStyles.content}>
        <PieChart
          data={donutData}
          donut
          radius={56}
          innerRadius={38}
          innerCircleColor={Colors.surface}
          centerLabelComponent={() => (
            <View style={donutStyles.centerLabel}>
              <Text style={donutStyles.centerPct}>{fundPct.toFixed(1)}%</Text>
            </View>
          )}
        />
        <View style={donutStyles.info}>
          <Text style={donutStyles.infoValue}>{fundPct.toFixed(1)}%</Text>
          <Text style={donutStyles.infoLabel}>of portfolio</Text>
          {rankLabel && (
            <Text style={donutStyles.rankLabel}>{rankLabel}</Text>
          )}
          <Text style={donutStyles.totalLabel}>
            Total: {formatCurrency(totalValue)}
          </Text>
        </View>
      </View>
      <View style={donutStyles.legend}>
        <View style={donutStyles.legendItem}>
          <View style={[donutStyles.legendDot, { backgroundColor: Colors.primary }]} />
          <Text style={donutStyles.legendText}>This fund</Text>
        </View>
        <View style={donutStyles.legendItem}>
          <View style={[donutStyles.legendDot, { backgroundColor: Colors.borderLight }]} />
          <Text style={donutStyles.legendText}>Rest of portfolio</Text>
        </View>
      </View>
    </View>
  );
}

const donutStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    ...Typography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  centerLabel: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPct: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  infoValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
    lineHeight: 32,
  },
  infoLabel: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  rankLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  totalLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  legend: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...Typography.caption, color: Colors.textTertiary },
});

// ---------------------------------------------------------------------------

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
          {(() => {
            const latestNavDate = data.navHistory[data.navHistory.length - 1]?.date ?? null;
            const todayIso = new Date().toISOString().split('T')[0];
            const navIsStale = latestNavDate !== null && latestNavDate !== todayIso;
            const gain = data.currentValue !== null ? data.currentValue - data.investedAmount : null;
            const gainPct = gain !== null && data.investedAmount > 0
              ? (gain / data.investedAmount) * 100 : null;
            const gainPositive = gain !== null ? gain >= 0 : true;
            return (
              <View style={styles.fundHeader}>
                <Text style={styles.fundName}>{data.schemeName}</Text>
                <Text style={styles.fundCategory}>{data.schemeCategory}</Text>

                <View style={styles.holdingRow}>
                  <View style={styles.holdingStat}>
                    <Text style={styles.statLabel}>Current Value</Text>
                    {data.currentValue !== null ? (
                      <>
                        <Text style={styles.holdingValue}>{formatCurrency(data.currentValue)}</Text>
                        {navIsStale && (
                          <Text style={styles.navStaleLabel}>as of {formatNavDate(latestNavDate!)}</Text>
                        )}
                      </>
                    ) : (
                      <Text style={styles.holdingValuePending}>NAV pending</Text>
                    )}
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

                {/* Gain / Loss row */}
                {gain !== null && gainPct !== null && (
                  <View style={styles.gainRow}>
                    <Text style={styles.statLabel}>Gain / Loss</Text>
                    <Text style={[styles.gainValue, { color: gainPositive ? Colors.positive : Colors.negative }]}>
                      {gainPositive ? '+' : ''}{formatCurrency(Math.abs(gain))}{' '}
                      ({gainPositive ? '+' : ''}{gainPct.toFixed(1)}%)
                    </Text>
                  </View>
                )}

                {/* XIRR row — SIP-adjusted annualised return */}
                {isFinite(data.fundXirr) && (
                  <View style={styles.xirrHeaderRow}>
                    <Text style={styles.statLabel}>XIRR</Text>
                    <Text style={[styles.xirrHeaderValue, { color: data.fundXirr >= 0 ? Colors.positive : Colors.negative }]}>
                      {formatXirr(data.fundXirr)}
                    </Text>
                    <Text style={styles.xirrHeaderHint}> · SIP-adjusted, annualised</Text>
                  </View>
                )}

              </View>
            );
          })()}

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
              defaultBenchmarkSymbol={data.benchmarkSymbol ?? null}
            />
          ) : (
            <NavHistoryTab navHistory={data.navHistory} />
          )}

          <TechnicalDetailsCard
            expenseRatio={data.expenseRatio}
            aumCr={data.aumCr}
            minSipAmount={data.minSipAmount}
            fundMetaSyncedAt={data.fundMetaSyncedAt}
            schemeCode={data.schemeCode}
          />

          <GrowthConsistencyChart navHistory={data.navHistory} />

          <PortfolioHealthDonut
            fundId={data.id}
            currentValue={data.currentValue}
          />

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
  holdingValuePending: { fontSize: 13, fontWeight: '500', color: Colors.textTertiary, fontStyle: 'italic' },
  navStaleLabel: { fontSize: 11, color: Colors.textTertiary, fontStyle: 'italic' },

  gainRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  gainValue: { fontSize: 14, fontWeight: '600' },

  xirrHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  xirrHeaderValue: { fontSize: 14, fontWeight: '600' },
  xirrHeaderHint: { fontSize: 11, color: Colors.textTertiary },

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
  comparisonRow: { flexDirection: 'row', alignItems: 'flex-start' },
  comparisonCol: { flex: 1, gap: 4 },
  xirrDivider: { width: 1, backgroundColor: Colors.borderLight, marginHorizontal: 12 },
  xirrValue: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  verdictRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  verdictText: { fontSize: 13, fontWeight: '600' },

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
  summaryDateLabel: { fontSize: 11, color: Colors.textTertiary, marginBottom: 2 },
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

  chartExplainer: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 16,
  },
  noBenchmarkNote: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 2,
  },

  benchmarkSelectorContent: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 0,
  },
  benchmarkPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radii.full,
    backgroundColor: Colors.borderLight,
  },
  benchmarkPillActive: { backgroundColor: Colors.primary },
  benchmarkPillText: { fontSize: 11, fontWeight: '600', color: Colors.textTertiary },
  benchmarkPillTextActive: { color: '#fff' },

  pointerLabel: {
    backgroundColor: Colors.surface,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 2,
  },
  pointerDate: { fontSize: 10, color: Colors.textTertiary, fontWeight: '600' },
  pointerSeriesText: { fontSize: 11, color: Colors.textSecondary },

  noData: { padding: 40, alignItems: 'center', gap: 10 },
  noDataText: { ...Typography.body, color: Colors.textTertiary, textAlign: 'center' },

  bottomPad: { height: 32 },
});

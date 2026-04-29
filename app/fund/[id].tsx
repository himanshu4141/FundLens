import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, PieChart } from 'react-native-gifted-charts';
import Svg, { G, Line as SvgLine, Rect as SvgRect, Text as SvgText } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import {
  useFundDetail,
  filterToWindow,
  indexTo100,
  type TimeWindow,
} from '@/src/hooks/useFundDetail';
import { useFundComposition } from '@/src/hooks/useFundComposition';
import { usePortfolio } from '@/src/hooks/usePortfolio';
import { useSession } from '@/src/hooks/useSession';
import { useInvestmentVsBenchmarkTimeline } from '@/src/hooks/useInvestmentVsBenchmarkTimeline';
import type { FundRef } from '@/src/hooks/usePortfolioTimeline';
import { computeQuarterlyReturns } from '@/src/utils/quarterlyReturns';
import { formatXirr } from '@/src/utils/xirr';
import { formatCurrency } from '@/src/utils/formatting';
import { Spacing, Radii, Typography } from '@/src/constants/theme';
import { useTheme } from '@/src/context/ThemeContext';
import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
import {
  ClearLensCard,
  ClearLensHeader,
  ClearLensScreen,
  ClearLensSegmentedControl,
} from '@/src/components/clearLens/ClearLensPrimitives';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensSpacing,
  ClearLensSemanticColors,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';
import {
  formatClearLensCurrencyDelta,
  formatClearLensPercentDelta,
} from '@/src/utils/clearLensFormat';
import type { AppColors } from '@/src/context/ThemeContext';
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
    case '5Y':
    case '10Y':
    case '15Y':
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
  const { colors } = useTheme();
  const { isClearLens } = useAppDesignMode();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={s.windowRow}>
      {TIME_WINDOWS.map((w) => (
        <TouchableOpacity
          key={w}
          style={[
            s.windowPill,
            selected === w && s.windowPillActive,
            selected === w && isClearLens && { backgroundColor: ClearLensColors.navy },
          ]}
          onPress={() => onChange(w)}
          activeOpacity={0.75}
        >
          <Text style={[s.windowPillText, selected === w && s.windowPillTextActive]}>
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
  fundRef,
  userId,
}: {
  navHistory: { date: string; value: number }[];
  defaultBenchmarkSymbol: string | null;
  fundRef?: FundRef;
  userId?: string;
}) {
  const { colors } = useTheme();
  const { isClearLens } = useAppDesignMode();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const benchmarkColor = isClearLens ? ClearLensColors.slate : colors.warning;
  const positiveMetricColor = isClearLens ? ClearLensColors.emerald : colors.positive;
  const negativeMetricColor = isClearLens ? ClearLensColors.negative : colors.negative;
  const [window, setWindow] = useState<TimeWindow>('1Y');
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    const valid = BENCHMARK_OPTIONS.some((b) => b.symbol === defaultBenchmarkSymbol);
    return valid && defaultBenchmarkSymbol ? defaultBenchmarkSymbol : '^NSEI';
  });
  const investmentTimeline = useInvestmentVsBenchmarkTimeline(
    fundRef ? [fundRef] : [],
    userId,
    selectedSymbol,
    window,
  );
  // Track crosshair position so the return summary below the chart stays in sync.
  // null = no active crosshair (show end-of-period values).
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const activeIdxFrameRef = useRef<number | null>(null);
  const updateActiveIdxFromPointer = useCallback((pointerIndex: number) => {
    if (activeIdxFrameRef.current !== null) {
      cancelAnimationFrame(activeIdxFrameRef.current);
    }
    activeIdxFrameRef.current = requestAnimationFrame(() => {
      activeIdxFrameRef.current = null;
      setActiveIdx((current) => (current === pointerIndex ? current : pointerIndex));
    });
  }, []);

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
  useEffect(() => (
    () => {
      if (activeIdxFrameRef.current !== null) {
        cancelAnimationFrame(activeIdxFrameRef.current);
      }
    }
  ), []);

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
  const benchmarkPoints = useMemo(
    () => (
      hasBenchmarkData
        ? sampledNav.map((p) => ({ value: nearestBenchmarkValue(indexedBenchmark, p.date) }))
        : []
    ),
    [hasBenchmarkData, indexedBenchmark, sampledNav],
  );

  // Spacing: fit all sampled points exactly within the chart body (no overflow / no scroll).
  // chart body width = total width passed to LineChart minus y-axis label area
  const PERF_Y_AXIS_W = 32;
  const perfChartBodyW = CHART_WIDTH - 32 - PERF_Y_AXIS_W; // 32 = card padding (16×2)
  const perfSpacing = sampledNav.length > 1 ? Math.max(8, (perfChartBodyW - 16) / (sampledNav.length - 1)) : 20;

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
  const chartMostNegative = yMin - yPad;

  const latestNav = indexedNav[indexedNav.length - 1]?.value ?? 100;
  const latestBenchmark = indexedBenchmark[indexedBenchmark.length - 1]?.value ?? 100;
  const navReturn = ((latestNav - 100) / 100) * 100;
  const benchmarkReturn = ((latestBenchmark - 100) / 100) * 100;
  const benchmarkReturnColor = benchmarkReturn >= 0 ? positiveMetricColor : negativeMetricColor;
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

  const timelinePoints = investmentTimeline.points;
  const hasInvestmentTimeline = timelinePoints.length > 1;
  const formatActualYLabel = useCallback((v: string) => formatCurrency(Number(v)), []);
  const formatPerformanceYLabel = useCallback((v: string) => Number(v).toFixed(0), []);
  const actualPointerLabelComponent = useCallback(
    (_items: unknown, _sec: unknown, pointerIndex: number) => {
      updateActiveIdxFromPointer(pointerIndex);
      const point = timelinePoints[pointerIndex];
      if (!point) return null;
      return (
        <View style={s.pointerLabel}>
          <Text style={s.pointerDate}>{formatChartDate(point.date, window)}</Text>
          <Text style={s.pointerSeriesText}>
            <Text style={{ color: ClearLensSemanticColors.chart.invested }}>● </Text>
            Net invested: {formatCurrency(point.investedValue)}
          </Text>
          <Text style={s.pointerSeriesText}>
            <Text style={{ color: colors.primary }}>● </Text>
            Fund: {formatCurrency(point.portfolioValue)}
          </Text>
          <Text style={s.pointerSeriesText}>
            <Text style={{ color: benchmarkColor }}>● </Text>
            {selectedLabel}: {formatCurrency(point.benchmarkValue)}
          </Text>
        </View>
      );
    },
    [benchmarkColor, colors.primary, s, selectedLabel, timelinePoints, updateActiveIdxFromPointer, window],
  );
  const actualPointerConfig = useMemo(
    () => ({
      showPointerStrip: true,
      pointerStripHeight: 212,
      pointerStripWidth: 1,
      pointerStripColor: colors.textTertiary + '88',
      pointerColor: colors.primary,
      radius: 5,
      pointerLabelWidth: 162,
      pointerLabelHeight: 68,
      activatePointersOnLongPress: false,
      autoAdjustPointerLabelPosition: true,
      pointerLabelComponent: actualPointerLabelComponent,
    }),
    [actualPointerLabelComponent, colors.primary, colors.textTertiary],
  );
  const performancePointerLabelComponent = useCallback(
    (_items: unknown, _sec: unknown, pointerIndex: number) => {
      updateActiveIdxFromPointer(pointerIndex);
      const navVal = sampledNav[pointerIndex]?.value;
      const benchVal = hasBenchmarkData ? benchmarkPoints[pointerIndex]?.value : undefined;
      const date = sampledNav[pointerIndex]?.date;
      return (
        <View style={s.pointerLabel}>
          {date !== undefined && (
            <Text style={s.pointerDate}>{formatChartDate(date, window)}</Text>
          )}
          {navVal !== undefined && (
            <Text style={s.pointerSeriesText}>
              <Text style={{ color: colors.primary }}>● </Text>
              Fund: {navVal.toFixed(1)}
            </Text>
          )}
          {benchVal !== undefined && (
            <Text style={s.pointerSeriesText}>
              <Text style={{ color: benchmarkColor }}>● </Text>
              {selectedLabel}: {benchVal.toFixed(1)}
            </Text>
          )}
        </View>
      );
    },
    [benchmarkColor, benchmarkPoints, colors.primary, hasBenchmarkData, s, sampledNav, selectedLabel, updateActiveIdxFromPointer, window],
  );
  const performancePointerConfig = useMemo(
    () => ({
      showPointerStrip: true,
      pointerStripHeight: 200,
      pointerStripWidth: 1,
      pointerStripColor: colors.textTertiary + '88',
      pointerColor: colors.primary,
      radius: 5,
      pointerLabelWidth: 140,
      pointerLabelHeight: hasBenchmarkData ? 52 : 36,
      activatePointersOnLongPress: false,
      autoAdjustPointerLabelPosition: true,
      pointerLabelComponent: performancePointerLabelComponent,
    }),
    [colors.primary, colors.textTertiary, hasBenchmarkData, performancePointerLabelComponent],
  );
  const performanceReferenceLineConfig = useMemo(
    () => ({
      color: colors.textTertiary + '66',
      dashWidth: 4,
      dashGap: 4,
      thickness: 1,
    }),
    [colors.textTertiary],
  );
  if (fundRef && userId && investmentTimeline.isLoading && !hasInvestmentTimeline) {
    return (
      <View style={s.tabContent}>
        <TimeWindowSelector selected={window} onChange={setWindow} />
        <View style={s.chartCard}>
          <ActivityIndicator size="small" color={isClearLens ? ClearLensColors.emerald : colors.primary} />
        </View>
      </View>
    );
  }

  if (fundRef && userId && hasInvestmentTimeline) {
    const points = timelinePoints;
    const actualActiveIdx = activeIdx !== null && activeIdx < points.length ? activeIdx : points.length - 1;
    const latestPoint = points[points.length - 1];
    const activePoint = points[actualActiveIdx] ?? latestPoint;
    const investedData = points.map((point) => ({ value: point.investedValue }));
    const fundValueData = points.map((point) => ({ value: point.portfolioValue }));
    const benchmarkValueData = points.map((point) => ({ value: point.benchmarkValue }));
    const actualValues = points.flatMap((point) => [
      point.investedValue,
      point.portfolioValue,
      point.benchmarkValue,
    ]);
    const actualYMax = Math.max(...actualValues);
    const actualYMin = Math.min(...actualValues);
    const actualYPad = ((actualYMax - actualYMin) || actualYMax * 0.1 || 1) * 0.12;
    const actualChartTop = actualYMax + actualYPad;
    const actualChartBottom = Math.max(0, actualYMin - actualYPad);
    const actualChartRange = Math.max(1, actualChartTop - actualChartBottom);
    const ACTUAL_Y_AXIS_W = 54;
    const actualChartW = CHART_WIDTH - 32 - ACTUAL_Y_AXIS_W - 8;
    const actualSpacing =
      points.length > 1 ? Math.max(8, (actualChartW - 16) / (points.length - 1)) : 20;
    const actualLabelInterval = Math.max(1, Math.floor(points.length / 5));
    const actualXLabels =
      investmentTimeline.xAxisLabels.length === points.length
        ? investmentTimeline.xAxisLabels
        : points.map((point, index) =>
            index % actualLabelInterval === 0 || index === points.length - 1
              ? formatChartDate(point.date, window)
              : '',
          );
    const fundReturn =
      latestPoint.investedValue > 0
        ? ((latestPoint.portfolioValue - latestPoint.investedValue) / latestPoint.investedValue) * 100
        : 0;
    const simulatedBenchmarkReturn =
      latestPoint.investedValue > 0
        ? ((latestPoint.benchmarkValue - latestPoint.investedValue) / latestPoint.investedValue) * 100
        : 0;
    const activeFundReturn =
      activePoint.investedValue > 0
        ? ((activePoint.portfolioValue - activePoint.investedValue) / activePoint.investedValue) * 100
        : 0;
    const activeBenchmarkReturn =
      activePoint.investedValue > 0
        ? ((activePoint.benchmarkValue - activePoint.investedValue) / activePoint.investedValue) * 100
        : 0;
    const windowContext = window === 'All' ? 'since first transaction' : `past ${window}`;

    return (
      <View style={s.tabContent}>
        <View style={s.xirrCard}>
          <View style={s.comparisonRow}>
            <View style={s.comparisonCol}>
              <Text style={s.statLabel}>This fund</Text>
              <Text
                style={[s.xirrValue, { color: fundReturn >= 0 ? positiveMetricColor : negativeMetricColor }]}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                numberOfLines={1}
              >
                {fundReturn >= 0 ? '+' : ''}{fundReturn.toFixed(1)}%
              </Text>
            </View>
            <View style={s.xirrDivider} />
            <View style={s.comparisonCol}>
              <Text style={s.statLabel}>Same cashflows in {selectedLabel}</Text>
              <Text
                style={[
                  s.xirrValue,
                  { color: simulatedBenchmarkReturn >= 0 ? positiveMetricColor : negativeMetricColor },
                ]}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                numberOfLines={1}
              >
                {simulatedBenchmarkReturn >= 0 ? '+' : ''}{simulatedBenchmarkReturn.toFixed(1)}%
              </Text>
            </View>
          </View>
          <Text style={s.comparisonHint}>Using your buys, redemptions, and switches · {windowContext}</Text>
        </View>

        <TimeWindowSelector selected={window} onChange={setWindow} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.benchmarkSelectorContent}
        >
          {BENCHMARK_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.symbol}
              style={[
                s.benchmarkPill,
                selectedSymbol === opt.symbol && s.benchmarkPillActive,
                selectedSymbol === opt.symbol && isClearLens && { backgroundColor: ClearLensColors.navy },
              ]}
              onPress={() => setSelectedSymbol(opt.symbol)}
              activeOpacity={0.75}
            >
              <Text style={[s.benchmarkPillText, selectedSymbol === opt.symbol && s.benchmarkPillTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={s.chartCard}>
          <View style={s.chartLegendRow}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: ClearLensSemanticColors.chart.invested }]} />
              <Text style={s.legendLabel}>Net invested</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={s.legendLabel}>Fund value</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: benchmarkColor }]} />
              <Text style={s.legendLabel}>{selectedLabel} value</Text>
            </View>
          </View>

          <View style={s.chartWrap}>
            <LineChart
              data={investedData}
              data2={fundValueData}
              data3={benchmarkValueData}
              width={actualChartW}
              height={196}
              spacing={actualSpacing}
              initialSpacing={8}
              endSpacing={8}
              hideDataPoints
              color1={ClearLensSemanticColors.chart.invested}
              color2={colors.primary}
              color3={benchmarkColor}
              thickness1={2.4}
              thickness2={3}
              thickness3={2.5}
              curved
              yAxisLabelWidth={ACTUAL_Y_AXIS_W}
              formatYLabel={formatActualYLabel}
              yAxisTextStyle={s.chartAxisLabel}
              maxValue={actualChartRange}
              yAxisOffset={actualChartBottom}
              xAxisColor={colors.borderLight}
              yAxisColor="transparent"
              rulesColor={colors.borderLight}
              rulesType="solid"
              noOfSections={4}
              xAxisLabelTexts={actualXLabels}
              xAxisLabelTextStyle={s.chartAxisLabel}
              xAxisLabelsHeight={16}
              labelsExtraHeight={36}
              pointerConfig={actualPointerConfig}
            />
          </View>

          <Text style={s.chartExplainer}>
            Net invested is the remaining cost basis after redemptions and switches.
          </Text>

          <View style={s.returnSummary}>
            {activeIdx !== null && (
              <Text style={s.summaryDateLabel}>as of {formatChartDate(activePoint.date, window)}</Text>
            )}
            <View style={s.returnRow}>
              <Text style={s.returnLabel}>Net invested</Text>
              <Text style={s.returnVal}>{formatCurrency(activePoint.investedValue)}</Text>
            </View>
            <View style={s.returnRow}>
              <Text style={s.returnLabel}>Fund value</Text>
              <Text style={[s.returnVal, { color: activeFundReturn >= 0 ? positiveMetricColor : negativeMetricColor }]}>
                {formatCurrency(activePoint.portfolioValue)} · {activeFundReturn >= 0 ? '+' : ''}{activeFundReturn.toFixed(2)}%
              </Text>
            </View>
            <View style={s.returnRow}>
              <Text style={s.returnLabel}>{selectedLabel} value</Text>
              <Text style={[s.returnVal, { color: activeBenchmarkReturn >= 0 ? positiveMetricColor : negativeMetricColor }]}>
                {formatCurrency(activePoint.benchmarkValue)} · {activeBenchmarkReturn >= 0 ? '+' : ''}{activeBenchmarkReturn.toFixed(2)}%
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (fundRef && userId) {
    return (
      <View style={s.tabContent}>
        <TimeWindowSelector selected={window} onChange={setWindow} />
        <View style={s.noData}>
          <Ionicons name="bar-chart-outline" size={32} color={colors.textTertiary} />
          <Text style={s.noDataText}>Investment timeline is not available for this window.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.tabContent}>
      {/* Period return comparison card */}
      <View style={s.xirrCard}>
        <View style={s.comparisonRow}>
          <View style={s.comparisonCol}>
            <Text style={s.statLabel}>Fund NAV</Text>
            <Text
              style={[s.xirrValue, { color: navReturn >= 0 ? positiveMetricColor : negativeMetricColor }]}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              numberOfLines={1}
            >
              {navReturn >= 0 ? '+' : ''}{navReturn.toFixed(1)}%
            </Text>
          </View>
          {hasBenchmarkData && (
            <>
              <View style={s.xirrDivider} />
              <View style={s.comparisonCol}>
                <Text style={s.statLabel}>{selectedLabel} NAV</Text>
                <Text
                  style={[
                    s.xirrValue,
                    { color: benchmarkReturnColor },
                  ]}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  numberOfLines={1}
                >
                  {benchmarkReturn >= 0 ? '+' : ''}{benchmarkReturn.toFixed(1)}%
                </Text>
              </View>
            </>
          )}
        </View>
        {hasBenchmarkData && !isClearLens && (
          <View
            style={[
              s.verdictRow,
              isClearLens && {
                marginTop: 0,
                paddingHorizontal: ClearLensSpacing.sm,
                paddingVertical: ClearLensSpacing.sm,
                borderTopWidth: 0,
                borderRadius: ClearLensRadii.md,
                backgroundColor: isAhead
                  ? ClearLensSemanticColors.sentiment.positiveSurface
                  : ClearLensSemanticColors.sentiment.negativeSurface,
              },
            ]}
          >
            <Text style={[s.verdictText, { color: isAhead ? positiveMetricColor : negativeMetricColor }]}>
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
        contentContainerStyle={s.benchmarkSelectorContent}
      >
        {BENCHMARK_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.symbol}
            style={[
              s.benchmarkPill,
              selectedSymbol === opt.symbol && s.benchmarkPillActive,
              selectedSymbol === opt.symbol && isClearLens && { backgroundColor: ClearLensColors.navy },
            ]}
            onPress={() => setSelectedSymbol(opt.symbol)}
            activeOpacity={0.75}
          >
            <Text style={[s.benchmarkPillText, selectedSymbol === opt.symbol && s.benchmarkPillTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {hasNavData ? (
        <View style={s.chartCard}>
          <View style={s.chartLegendRow}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={s.legendLabel}>Fund NAV</Text>
            </View>
            {hasBenchmarkData && (
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: benchmarkColor }]} />
                <Text style={s.legendLabel}>{selectedLabel}</Text>
              </View>
            )}
          </View>

          <View style={s.chartWrap}>
            <LineChart
              data={navPoints}
              data2={hasBenchmarkData ? benchmarkPoints : undefined}
              width={perfChartBodyW}
              height={180}
              spacing={perfSpacing}
              initialSpacing={8}
              endSpacing={8}
              hideDataPoints
              color1={colors.primary}
              color2={benchmarkColor}
              thickness1={3}
              thickness2={2.5}
              curved
              yAxisLabelWidth={32}
              formatYLabel={formatPerformanceYLabel}
              yAxisTextStyle={s.chartAxisLabel}
              maxValue={chartMaxValue - chartMostNegative}
              yAxisOffset={chartMostNegative}
              xAxisColor={colors.borderLight}
              yAxisColor="transparent"
              rulesColor={colors.borderLight}
              rulesType="solid"
              noOfSections={4}
              referenceLine1Config={performanceReferenceLineConfig}
              referenceLine1Position={100}
              xAxisLabelTexts={xLabels}
              xAxisLabelTextStyle={s.chartAxisLabel}
              xAxisLabelsHeight={16}
              labelsExtraHeight={40}
              pointerConfig={performancePointerConfig}
            />
          </View>

          {/* Explainer */}
          <Text style={s.chartExplainer}>
            Both series rebased to 100 at start of period · higher = outperforming
          </Text>

          {!hasBenchmarkData && (
            <Text style={s.noBenchmarkNote}>
              {selectedLabel} data not available for the {window} window
            </Text>
          )}

          <View style={s.returnSummary}>
            {activeIdx !== null && summaryDate && (
              <Text style={s.summaryDateLabel}>
                as of {formatChartDate(summaryDate, window)}
              </Text>
            )}
            <View style={s.returnRow}>
              <Text style={s.returnLabel}>Fund</Text>
              <Text style={[s.returnVal, { color: summaryNavReturn >= 0 ? positiveMetricColor : negativeMetricColor }]}>
                {summaryNavReturn >= 0 ? '+' : ''}{summaryNavReturn.toFixed(2)}%
              </Text>
            </View>
            {hasBenchmarkData && summaryBenchReturn !== null && (
              <View style={s.returnRow}>
                <Text style={s.returnLabel}>{selectedLabel}</Text>
                <Text
                  style={[
                    s.returnVal,
                    { color: summaryBenchReturn >= 0 ? positiveMetricColor : negativeMetricColor },
                  ]}
                >
                  {summaryBenchReturn >= 0 ? '+' : ''}{summaryBenchReturn.toFixed(2)}%
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={s.noData}>
          <Ionicons name="bar-chart-outline" size={32} color={colors.textTertiary} />
          <Text style={s.noDataText}>No NAV data available for this window.</Text>
        </View>
      )}
    </View>
  );
}

function NavHistoryTab({ navHistory }: { navHistory: { date: string; value: number }[] }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
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
  const navChartMin = navYMin - navYPad;

  const NAV_Y_AXIS_W = 44;
  const navChartBodyW = CHART_WIDTH - 32 - NAV_Y_AXIS_W;
  const navSpacing = sampledFiltered.length > 1 ? Math.max(8, (navChartBodyW - 16) / (sampledFiltered.length - 1)) : 20;
  const formatNavYLabel = useCallback((v: string) => {
    const n = Number(v);
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${n.toFixed(0)}`;
  }, []);
  const navPointerLabelComponent = useCallback(
    (_items: unknown, _sec: unknown, pointerIndex: number) => {
      const p = sampledFiltered[pointerIndex];
      if (!p) return null;
      return (
        <View style={s.pointerLabel}>
          <Text style={s.pointerDate}>{formatChartDate(p.date, window)}</Text>
          <Text style={s.pointerSeriesText}>
            <Text style={{ color: colors.primary }}>● </Text>
            ₹{p.value.toFixed(4)}
          </Text>
        </View>
      );
    },
    [colors.primary, s, sampledFiltered, window],
  );
  const navPointerConfig = useMemo(
    () => ({
      showPointerStrip: true,
      pointerStripHeight: 220,
      pointerStripWidth: 1,
      pointerStripColor: colors.textTertiary + '88',
      pointerColor: colors.primary,
      radius: 5,
      pointerLabelWidth: 110,
      pointerLabelHeight: 36,
      activatePointersOnLongPress: false,
      autoAdjustPointerLabelPosition: true,
      pointerLabelComponent: navPointerLabelComponent,
    }),
    [colors.primary, colors.textTertiary, navPointerLabelComponent],
  );

  return (
    <View style={s.tabContent}>
      <TimeWindowSelector selected={window} onChange={setWindow} />

      {points.length > 1 ? (
        <View style={s.chartCard}>
          <View style={s.chartWrap}>
            <LineChart
              data={points}
              width={navChartBodyW}
              height={200}
              spacing={navSpacing}
              initialSpacing={8}
              endSpacing={8}
              hideDataPoints
              color1={colors.primary}
              thickness1={2.5}
              curved
              yAxisLabelWidth={44}
              formatYLabel={formatNavYLabel}
              yAxisTextStyle={s.chartAxisLabel}
              maxValue={navChartMax - navChartMin}
              yAxisOffset={navChartMin}
              xAxisColor={colors.borderLight}
              yAxisColor="transparent"
              rulesColor={colors.borderLight}
              rulesType="solid"
              noOfSections={4}
              xAxisLabelTexts={xLabels}
              xAxisLabelTextStyle={s.chartAxisLabel}
              xAxisLabelsHeight={16}
              labelsExtraHeight={40}
              pointerConfig={navPointerConfig}
            />
          </View>

          <View style={s.navStatsRow}>
            <View style={s.navStat}>
              <Text style={s.statLabel}>Current NAV</Text>
              <Text style={s.navStatValue}>₹{currentNav?.toFixed(4) ?? '—'}</Text>
            </View>
            <View style={s.navStat}>
              <Text style={s.statLabel}>Period start</Text>
              <Text style={s.navStatValue}>₹{startNav?.toFixed(4) ?? '—'}</Text>
            </View>
            {navChange !== null && (
              <View style={s.navStat}>
                <Text style={s.statLabel}>Change ({window})</Text>
                <Text
                  style={[s.navStatValue, { color: navChange >= 0 ? colors.positive : colors.negative }]}
                >
                  {navChange >= 0 ? '+' : ''}{navChange.toFixed(2)}%
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={s.noData}>
          <Ionicons name="bar-chart-outline" size={32} color={colors.textTertiary} />
          <Text style={s.noDataText}>No NAV data for this window.</Text>
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
  isin,
}: {
  expenseRatio: number | null;
  aumCr: number | null;
  minSipAmount: number | null;
  fundMetaSyncedAt: string | null;
  schemeCode: number;
  isin: string | null;
}) {
  const { colors } = useTheme();
  const { isClearLens } = useAppDesignMode();
  const ts = useMemo(() => makeTechStyles(colors), [colors]);
  const metaStatus = fundMetaSyncedAt
    ? `as of ${formatNavDate(fundMetaSyncedAt.split('T')[0] ?? fundMetaSyncedAt)}`
    : 'latest available';

  function openFactsheet() {
    const url = isin
      ? `https://www.amfiindia.com/schemes/the-scheme-detail?ISIN=${isin}`
      : `https://api.mfapi.in/mf/${schemeCode}`;
    Linking.openURL(url);
  }

  return (
    <View style={[ts.card, isClearLens && ts.clearLensCard]}>
      <Text style={ts.title}>Technical Details</Text>
      <Text style={ts.metaStatus}>{metaStatus}</Text>
      <View style={ts.row}>
        <View style={ts.cell}>
          <Text style={ts.label}>Expense Ratio</Text>
          <Text style={ts.value}>
            {expenseRatio == null ? 'Unavailable' : `${expenseRatio.toFixed(2)}%`}
          </Text>
        </View>
        <View style={ts.cell}>
          <Text style={ts.label}>AUM</Text>
          <Text style={ts.value}>
            {aumCr == null ? 'Unavailable' : `₹${Math.round(aumCr).toLocaleString('en-IN')} Cr`}
          </Text>
        </View>
        <View style={ts.cell}>
          <Text style={ts.label}>Min SIP</Text>
          <Text style={ts.value}>
            {minSipAmount == null ? 'Unavailable' : `₹${minSipAmount.toLocaleString('en-IN')}`}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={openFactsheet} style={ts.sidLink}>
        <Text style={ts.sidLinkText}>View fund factsheet ↗</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeTechStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      marginHorizontal: Spacing.md,
      marginTop: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    clearLensCard: {
      marginHorizontal: 0,
      marginTop: 0,
      borderRadius: ClearLensRadii.lg,
      borderColor: ClearLensColors.border,
      backgroundColor: ClearLensColors.surface,
    },
    title: {
      ...Typography.label,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    metaStatus: {
      ...Typography.caption,
      color: colors.textTertiary,
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
      color: colors.textSecondary,
      marginBottom: 2,
      textAlign: 'center',
    },
    value: {
      ...Typography.body,
      color: colors.textPrimary,
      fontWeight: '600' as const,
      textAlign: 'center',
    },
    sidLink: {
      marginTop: Spacing.xs,
      alignItems: 'center',
    },
    sidLinkText: {
      ...Typography.caption,
      color: colors.primary,
      fontWeight: '600' as const,
    },
  });
}

// ---------------------------------------------------------------------------
// Growth Consistency Chart — quarterly returns from navHistory
// ---------------------------------------------------------------------------

function GrowthConsistencyChart({ navHistory }: { navHistory: { date: string; value: number }[] }) {
  const { colors } = useTheme();
  const gs = useMemo(() => makeGrowthStyles(colors), [colors]);
  const bars = computeQuarterlyReturns(navHistory, colors.positive, colors.negative);
  if (bars.length < 2) return null;

  const vals = bars.map((b) => Math.abs(b.value));
  const maxAbs = Math.max(...vals, 1);
  const chartMax = Math.ceil(maxAbs * 1.2);
  const chartWidth = CHART_WIDTH - 64;
  const chartHeight = 176;
  const plotTop = 18;
  const plotBottom = 34;
  const plotLeft = 34;
  const plotRight = 8;
  const plotWidth = chartWidth - plotLeft - plotRight;
  const plotHeight = chartHeight - plotTop - plotBottom;
  const zeroY = plotTop + plotHeight / 2;
  const barGap = 7;
  const barWidth = Math.max(12, Math.min(20, (plotWidth - barGap * (bars.length - 1)) / bars.length));
  const xLabelEvery = bars.length <= 8 ? 1 : 2;

  function yFor(value: number): number {
    return zeroY - (value / chartMax) * (plotHeight / 2);
  }

  return (
    <View style={gs.card}>
      <Text style={gs.title}>Growth Consistency</Text>
      <Text style={gs.subtitle}>Quarterly returns (%)</Text>
      <View style={gs.svgWrap}>
        <Svg width={chartWidth} height={chartHeight}>
          {[-1, -0.5, 0, 0.5, 1].map((tick) => {
            const value = tick * chartMax;
            const y = yFor(value);
            return (
              <G key={`tick-${tick}`}>
                <SvgLine
                  x1={plotLeft}
                  x2={plotLeft + plotWidth}
                  y1={y}
                  y2={y}
                  stroke={tick === 0 ? colors.textTertiary : colors.borderLight}
                  strokeWidth={tick === 0 ? 1.2 : 1}
                  strokeDasharray={tick === 0 ? undefined : '4 5'}
                />
                <SvgText
                  x={plotLeft - 8}
                  y={y + 4}
                  fill={colors.textTertiary}
                  fontSize={10}
                  textAnchor="end"
                >
                  {`${Math.round(value)}%`}
                </SvgText>
              </G>
            );
          })}
          {bars.map((bar, index) => {
            const x = plotLeft + index * (barWidth + barGap);
            const positive = bar.value >= 0;
            const y = positive ? yFor(bar.value) : zeroY;
            const height = Math.max(3, Math.abs(yFor(bar.value) - zeroY));
            const labelY = positive ? y - 5 : y + height + 12;
            const showXAxisLabel = index === 0 || index === bars.length - 1 || index % xLabelEvery === 0;
            return (
              <G key={bar.label}>
                <SvgRect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={height}
                  rx={4}
                  fill={bar.frontColor}
                />
                <SvgText
                  x={x + barWidth / 2}
                  y={labelY}
                  fill={positive ? colors.positive : colors.negative}
                  fontSize={9}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {bar.value.toFixed(Math.abs(bar.value) >= 10 ? 1 : 2)}
                </SvgText>
                {showXAxisLabel && (
                  <SvgText
                    x={x + barWidth / 2}
                    y={chartHeight - 10}
                    fill={colors.textTertiary}
                    fontSize={9}
                    textAnchor="middle"
                  >
                    {bar.label}
                  </SvgText>
                )}
              </G>
            );
          })}
        </Svg>
      </View>
      <View style={gs.legend}>
        <View style={gs.legendItem}>
          <View style={[gs.legendDot, { backgroundColor: colors.positive }]} />
          <Text style={gs.legendText}>Positive quarter</Text>
        </View>
        <View style={gs.legendItem}>
          <View style={[gs.legendDot, { backgroundColor: colors.negative }]} />
          <Text style={gs.legendText}>Negative quarter</Text>
        </View>
      </View>
    </View>
  );
}

function makeGrowthStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      marginHorizontal: Spacing.md,
      marginTop: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      ...Typography.label,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    subtitle: {
      ...Typography.caption,
      color: colors.textTertiary,
    },
    svgWrap: {
      marginTop: Spacing.xs,
      alignItems: 'center',
      overflow: 'hidden',
    },
    axisLabel: { fontSize: 10, color: colors.textTertiary },
    barTopLabel: { fontSize: 9, color: colors.textSecondary },
    legend: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.xs,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { ...Typography.caption, color: colors.textTertiary },
  });
}

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
  const { colors } = useTheme();
  const ds = useMemo(() => makeDonutStyles(colors), [colors]);
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
    { value: fundPct, color: colors.primary },
    { value: Math.max(restPct, 0), color: colors.borderLight },
  ];

  return (
    <View style={ds.card}>
      <Text style={ds.title}>Portfolio Weight</Text>
      <View style={ds.content}>
        <PieChart
          data={donutData}
          donut
          radius={56}
          innerRadius={38}
          innerCircleColor={colors.surface}
          centerLabelComponent={() => (
            <View style={ds.centerLabel}>
              <Text style={ds.centerPct}>{fundPct.toFixed(1)}%</Text>
            </View>
          )}
        />
        <View style={ds.info}>
          <Text style={ds.infoValue}>{fundPct.toFixed(1)}%</Text>
          <Text style={ds.infoLabel}>of portfolio</Text>
          {rankLabel && (
            <Text style={ds.rankLabel}>{rankLabel}</Text>
          )}
          <Text style={ds.totalLabel}>
            Total: {formatCurrency(totalValue)}
          </Text>
        </View>
      </View>
      <View style={ds.legend}>
        <View style={ds.legendItem}>
          <View style={[ds.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={ds.legendText}>This fund</Text>
        </View>
        <View style={ds.legendItem}>
          <View style={[ds.legendDot, { backgroundColor: colors.borderLight }]} />
          <Text style={ds.legendText}>Rest of portfolio</Text>
        </View>
      </View>
    </View>
  );
}

function makeDonutStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      marginHorizontal: Spacing.md,
      marginTop: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      ...Typography.label,
      color: colors.textSecondary,
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
      fontWeight: '700' as const,
      color: colors.primary,
    },
    info: {
      flex: 1,
      gap: 4,
    },
    infoValue: {
      fontSize: 28,
      fontWeight: '700' as const,
      color: colors.primary,
      lineHeight: 32,
    },
    infoLabel: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
    },
    rankLabel: {
      ...Typography.body,
      color: colors.textSecondary,
      fontWeight: '600' as const,
      marginTop: 2,
    },
    totalLabel: {
      ...Typography.caption,
      color: colors.textTertiary,
      marginTop: 4,
    },
    legend: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.sm,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { ...Typography.caption, color: colors.textTertiary },
  });
}

// ---------------------------------------------------------------------------
// Fund Composition Tab
// ---------------------------------------------------------------------------

function FundCompositionTab({ schemeCode }: { schemeCode: number }) {
  const { colors } = useTheme();
  const { isClearLens } = useAppDesignMode();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const cs = useMemo(() => makeCompStyles(colors), [colors]);
  const { composition, isLoading } = useFundComposition(schemeCode);
  const compAssetColors = useMemo(
    () => ({
      equity: isClearLens ? ClearLensSemanticColors.asset.equity : colors.positive,
      debt: isClearLens ? ClearLensSemanticColors.asset.debt : colors.primaryDark,
      cash: isClearLens ? ClearLensSemanticColors.asset.cash : colors.primaryLight,
      other: isClearLens ? ClearLensSemanticColors.asset.other : colors.borderLight,
    }),
    [colors.borderLight, colors.positive, colors.primaryDark, colors.primaryLight, isClearLens],
  );
  const compCapColors = useMemo(
    () => ({
      large: isClearLens ? ClearLensSemanticColors.marketCap.large : colors.primaryDark,
      mid: isClearLens ? ClearLensSemanticColors.marketCap.mid : colors.positive,
      small: isClearLens ? ClearLensSemanticColors.marketCap.small : colors.textSecondary,
      other: isClearLens ? ClearLensSemanticColors.marketCap.other : colors.borderLight,
    }),
    [colors.borderLight, colors.positive, colors.primaryDark, colors.textSecondary, isClearLens],
  );

  if (isLoading) {
    return (
      <View style={[s.tabContent, { alignItems: 'center', paddingTop: 40 }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!composition) {
    return (
      <View style={s.tabContent}>
        <View style={s.noData}>
          <Ionicons name="pie-chart-outline" size={32} color={colors.textTertiary} />
          <Text style={s.noDataText}>No composition data available for this fund.</Text>
        </View>
      </View>
    );
  }

  const hasMarketCap = composition.largeCapPct !== null && composition.equityPct > 5;
  const sectors = composition.sectorAllocation
    ? Object.entries(composition.sectorAllocation).sort(([, a], [, b]) => b - a).slice(0, 8)
    : null;
  const holdings = composition.topHoldings?.slice(0, 10) ?? null;

  return (
    <View style={s.tabContent}>
      {/* Asset Mix */}
      <View style={[s.chartCard, { gap: Spacing.sm }]}>
        <Text style={cs.cardTitle}>Asset Mix</Text>
        <View style={cs.stackedBar}>
          {composition.equityPct > 0.5 && (
            <View style={[cs.barSeg, { flex: composition.equityPct, backgroundColor: compAssetColors.equity }]} />
          )}
          {composition.debtPct > 0.5 && (
            <View style={[cs.barSeg, { flex: composition.debtPct, backgroundColor: compAssetColors.debt }]} />
          )}
          {composition.cashPct > 0.5 && (
            <View style={[cs.barSeg, { flex: composition.cashPct, backgroundColor: compAssetColors.cash }]} />
          )}
          {composition.otherPct > 0.5 && (
            <View style={[cs.barSeg, { flex: composition.otherPct, backgroundColor: compAssetColors.other }]} />
          )}
        </View>
        <View style={cs.assetRow}>
          {composition.equityPct > 0 && (
            <View style={cs.assetItem}>
              <View style={[cs.assetDot, { backgroundColor: compAssetColors.equity }]} />
              <Text style={cs.assetLabel}>Equity</Text>
              <Text style={cs.assetValue}>{composition.equityPct.toFixed(1)}%</Text>
            </View>
          )}
          {composition.debtPct > 0 && (
            <View style={cs.assetItem}>
              <View style={[cs.assetDot, { backgroundColor: compAssetColors.debt }]} />
              <Text style={cs.assetLabel}>Debt</Text>
              <Text style={cs.assetValue}>{composition.debtPct.toFixed(1)}%</Text>
            </View>
          )}
          {composition.cashPct > 0 && (
            <View style={cs.assetItem}>
              <View style={[cs.assetDot, { backgroundColor: compAssetColors.cash }]} />
              <Text style={cs.assetLabel}>Cash</Text>
              <Text style={cs.assetValue}>{composition.cashPct.toFixed(1)}%</Text>
            </View>
          )}
          {composition.otherPct > 0 && (
            <View style={cs.assetItem}>
              <View style={[cs.assetDot, { backgroundColor: compAssetColors.other }]} />
              <Text style={cs.assetLabel}>Other</Text>
              <Text style={cs.assetValue}>{composition.otherPct.toFixed(1)}%</Text>
            </View>
          )}
        </View>
      </View>

      {/* Market Cap Mix */}
      {hasMarketCap && (
        <View style={[s.chartCard, { gap: Spacing.sm }]}>
          <Text style={cs.cardTitle}>Market Cap Mix</Text>
          <View style={cs.stackedBar}>
            {(composition.largeCapPct ?? 0) > 0.5 && (
              <View style={[cs.barSeg, { flex: composition.largeCapPct!, backgroundColor: compCapColors.large }]} />
            )}
            {(composition.midCapPct ?? 0) > 0.5 && (
              <View style={[cs.barSeg, { flex: composition.midCapPct!, backgroundColor: compCapColors.mid }]} />
            )}
            {(composition.smallCapPct ?? 0) > 0.5 && (
              <View style={[cs.barSeg, { flex: composition.smallCapPct!, backgroundColor: compCapColors.small }]} />
            )}
            {(composition.notClassifiedPct ?? 0) > 0.5 && (
              <View style={[cs.barSeg, { flex: composition.notClassifiedPct!, backgroundColor: compCapColors.other }]} />
            )}
          </View>
          <View style={cs.assetRow}>
            {(composition.largeCapPct ?? 0) > 0 && (
              <View style={cs.assetItem}>
                <View style={[cs.assetDot, { backgroundColor: compCapColors.large }]} />
                <Text style={cs.assetLabel}>Large</Text>
                <Text style={cs.assetValue}>{composition.largeCapPct!.toFixed(1)}%</Text>
              </View>
            )}
            {(composition.midCapPct ?? 0) > 0 && (
              <View style={cs.assetItem}>
                <View style={[cs.assetDot, { backgroundColor: compCapColors.mid }]} />
                <Text style={cs.assetLabel}>Mid</Text>
                <Text style={cs.assetValue}>{composition.midCapPct!.toFixed(1)}%</Text>
              </View>
            )}
            {(composition.smallCapPct ?? 0) > 0 && (
              <View style={cs.assetItem}>
                <View style={[cs.assetDot, { backgroundColor: compCapColors.small }]} />
                <Text style={cs.assetLabel}>Small</Text>
                <Text style={cs.assetValue}>{composition.smallCapPct!.toFixed(1)}%</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Sector Breakdown */}
      <View style={[s.chartCard, { gap: Spacing.xs }]}>
        <Text style={[cs.cardTitle, { marginBottom: Spacing.xs }]}>Sector Breakdown</Text>
        {sectors && sectors.length > 0 ? (
          sectors.map(([sector, pct]) => (
            <View key={sector} style={cs.sectorRow}>
              <Text style={cs.sectorName} numberOfLines={1}>{sector}</Text>
              <View style={cs.sectorBarWrap}>
                <View
                  style={[cs.sectorBar, {
                    width: `${Math.min(pct, 30) / 30 * 100}%`,
                    backgroundColor: colors.primary + '66',
                  }]}
                />
              </View>
              <Text style={cs.sectorPct}>{pct.toFixed(1)}%</Text>
            </View>
          ))
        ) : (
          <View style={cs.emptySlot}>
            <Ionicons name="grid-outline" size={24} color={colors.textTertiary} />
            <Text style={cs.emptySlotText}>Syncs from AMFI monthly disclosures</Text>
          </View>
        )}
      </View>

      {/* Top Holdings */}
      <View style={[s.chartCard, { gap: 0, overflow: 'hidden' }]}>
        <Text style={[cs.cardTitle, { marginBottom: Spacing.xs }]}>Top Holdings</Text>
        {holdings && holdings.length > 0 ? (
          holdings.map((h, i) => (
            <View
              key={h.isin || h.name}
              style={[cs.holdingRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight }]}
            >
              <Text style={cs.holdingRank}>{i + 1}</Text>
              <View style={cs.holdingInfo}>
                <Text style={cs.holdingName} numberOfLines={1}>{h.name}</Text>
                <Text style={cs.holdingSector}>{h.sector}</Text>
              </View>
              <Text style={cs.holdingPct}>{h.pctOfNav.toFixed(1)}%</Text>
            </View>
          ))
        ) : (
          <View style={cs.emptySlot}>
            <Ionicons name="list-outline" size={24} color={colors.textTertiary} />
            <Text style={cs.emptySlotText}>Syncs from AMFI monthly disclosures</Text>
          </View>
        )}
      </View>

      <Text style={cs.footer}>
        {composition.source === 'amfi' ? 'AMFI disclosure' : 'Estimated from fund category'} ·{' '}
        {new Date(composition.portfolioDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
      </Text>
    </View>
  );
}

function makeCompStyles(colors: AppColors) {
  return StyleSheet.create({
    cardTitle: {
      fontSize: 11,
      fontWeight: '700' as const,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: colors.textTertiary,
    },
    stackedBar: {
      flexDirection: 'row',
      height: 10,
      borderRadius: Radii.full,
      overflow: 'hidden',
    },
    barSeg: { height: '100%' },
    assetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    assetItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    assetDot: { width: 8, height: 8, borderRadius: 4 },
    assetLabel: { fontSize: 12, color: colors.textTertiary, fontWeight: '600' as const },
    assetValue: { fontSize: 13, fontWeight: '700' as const, color: colors.textPrimary },
    sectorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: 4,
    },
    sectorName: { flex: 1, fontSize: 13, color: colors.textPrimary, fontWeight: '600' as const },
    sectorBarWrap: {
      width: 80,
      height: 6,
      backgroundColor: colors.borderLight,
      borderRadius: 3,
      overflow: 'hidden',
    },
    sectorBar: { height: '100%', borderRadius: 3 },
    sectorPct: {
      fontSize: 12,
      fontWeight: '600' as const,
      minWidth: 42,
      textAlign: 'right',
      color: colors.textSecondary,
    },
    holdingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      gap: Spacing.sm,
    },
    holdingRank: {
      fontSize: 12,
      fontWeight: '600' as const,
      minWidth: 18,
      textAlign: 'center',
      color: colors.textTertiary,
    },
    holdingInfo: { flex: 1, gap: 2 },
    holdingName: { fontSize: 13, fontWeight: '600' as const, color: colors.textPrimary },
    holdingSector: { fontSize: 11, color: colors.textTertiary, fontWeight: '500' as const },
    holdingPct: {
      fontSize: 13,
      fontWeight: '700' as const,
      minWidth: 48,
      textAlign: 'right',
      color: colors.textPrimary,
    },
    emptySlot: { alignItems: 'center', paddingVertical: Spacing.md, gap: 6 },
    emptySlotText: { fontSize: 12, color: colors.textTertiary, textAlign: 'center' },
    footer: {
      fontSize: 11,
      color: colors.textTertiary,
      textAlign: 'center',
      fontStyle: 'italic',
      paddingBottom: Spacing.sm,
    },
  });
}

// ---------------------------------------------------------------------------

function ClassicFundDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<'performance' | 'nav' | 'composition'>('performance');
  const { data, isLoading, isError } = useFundDetail(id);

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {isLoading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError || !data ? (
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.textTertiary} />
          <Text style={s.errorText}>Couldn&apos;t load fund data</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.backLink}>Go back</Text>
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
              <View style={s.fundHeader}>
                <Text style={s.fundName}>{data.schemeName}</Text>
                <Text style={s.fundCategory}>{data.schemeCategory}</Text>

                <View style={s.holdingRow}>
                  <View style={s.holdingStat}>
                    <Text style={s.statLabel}>Current Value</Text>
                    {data.currentValue !== null ? (
                      <>
                        <Text style={s.holdingValue}>{formatCurrency(data.currentValue)}</Text>
                        {navIsStale && (
                          <Text style={s.navStaleLabel}>as of {formatNavDate(latestNavDate!)}</Text>
                        )}
                      </>
                    ) : (
                      <Text style={s.holdingValuePending}>NAV pending</Text>
                    )}
                  </View>
                  <View style={s.holdingStat}>
                    <Text style={s.statLabel}>Cost basis</Text>
                    <Text style={s.holdingValue}>{formatCurrency(data.investedAmount)}</Text>
                  </View>
                  <View style={s.holdingStat}>
                    <Text style={s.statLabel}>Units</Text>
                    <Text style={s.holdingValue}>{data.currentUnits.toFixed(3)}</Text>
                  </View>
                </View>

                {/* Gain / Loss row */}
                {gain !== null && gainPct !== null && (
                  <View style={s.gainRow}>
                    <Text style={s.statLabel}>Gain / Loss</Text>
                    <Text style={[s.gainValue, { color: gainPositive ? colors.positive : colors.negative }]}>
                      {gainPositive ? '+' : ''}{formatCurrency(Math.abs(gain))}{' '}
                      ({gainPositive ? '+' : ''}{gainPct.toFixed(1)}%)
                    </Text>
                  </View>
                )}

                {/* XIRR row — SIP-adjusted annualised return */}
                {isFinite(data.fundXirr) && (
                  <View style={s.xirrHeaderRow}>
                    <Text style={s.statLabel}>XIRR</Text>
                    <Text style={[s.xirrHeaderValue, { color: data.fundXirr >= 0 ? colors.positive : colors.negative }]}>
                      {formatXirr(data.fundXirr)}
                    </Text>
                    <Text style={s.xirrHeaderHint}> · SIP-adjusted, annualised</Text>
                  </View>
                )}

              </View>
            );
          })()}

          {/* ── Tab bar ── */}
          <View style={s.tabBar}>
            {(['performance', 'nav', 'composition'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[s.tab, activeTab === tab && s.tabActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.75}
              >
                <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                  {tab === 'performance' ? 'Performance' : tab === 'nav' ? 'NAV History' : 'Composition'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'performance' ? (
            <PerformanceTab
              navHistory={data.navHistory}
              defaultBenchmarkSymbol={data.benchmarkSymbol ?? null}
            />
          ) : activeTab === 'nav' ? (
            <NavHistoryTab navHistory={data.navHistory} />
          ) : (
            <FundCompositionTab schemeCode={data.schemeCode} />
          )}

          <TechnicalDetailsCard
            expenseRatio={data.expenseRatio}
            aumCr={data.aumCr}
            minSipAmount={data.minSipAmount}
            fundMetaSyncedAt={data.fundMetaSyncedAt}
            schemeCode={data.schemeCode}
            isin={data.isin}
          />

          <GrowthConsistencyChart navHistory={data.navHistory} />

          <PortfolioHealthDonut
            fundId={data.id}
            currentValue={data.currentValue}
          />

          <View style={s.bottomPad} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

type ClearLensFundTab = 'performance' | 'nav' | 'composition';

function ClearLensFundDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ClearLensFundTab>('performance');
  const { data, isLoading, isError } = useFundDetail(id);
  const { session } = useSession();
  const userId = session?.user.id;

  if (isLoading) {
    return (
      <ClearLensScreen>
        <ClearLensHeader title="Fund Detail" onPressBack={() => router.back()} />
        <View style={clearDetailStyles.centered}>
          <ActivityIndicator size="large" color={ClearLensColors.emerald} />
        </View>
      </ClearLensScreen>
    );
  }

  if (isError || !data) {
    return (
      <ClearLensScreen>
        <ClearLensHeader title="Fund Detail" onPressBack={() => router.back()} />
        <View style={clearDetailStyles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={ClearLensColors.textTertiary} />
          <Text style={clearDetailStyles.errorText}>Couldn&apos;t load fund data</Text>
        </View>
      </ClearLensScreen>
    );
  }

  const latestNavDate = data.navHistory[data.navHistory.length - 1]?.date ?? null;
  const todayIso = new Date().toISOString().split('T')[0];
  const navIsStale = latestNavDate !== null && latestNavDate !== todayIso;
  const gain = data.currentValue !== null ? data.currentValue - data.investedAmount : null;
  const gainPct = gain !== null && data.investedAmount > 0 ? (gain / data.investedAmount) * 100 : null;
  const hasSignalRow = (gain !== null && gainPct !== null) || Number.isFinite(data.fundXirr);
  const hasRealizedActivity = data.realizedAmount > 0 || data.redeemedUnits > 0;

  return (
    <ClearLensScreen>
      <ClearLensHeader title="Fund Detail" onPressBack={() => router.back()} />
      <ScrollView contentContainerStyle={clearDetailStyles.scroll} showsVerticalScrollIndicator={false}>
        <ClearLensCard style={clearDetailStyles.heroCard}>
          <View style={clearDetailStyles.heroTitleRow}>
            <View style={clearDetailStyles.heroTitleBlock}>
              <Text style={clearDetailStyles.fundName}>{data.schemeName}</Text>
              <Text style={clearDetailStyles.category}>{data.schemeCategory || 'Fund'}</Text>
            </View>
          </View>

          <View style={clearDetailStyles.statsRow}>
            <View style={clearDetailStyles.statCell}>
              <Text style={clearDetailStyles.statLabel} numberOfLines={1}>Current value</Text>
              <Text style={clearDetailStyles.statValue}>
                {data.currentValue !== null ? formatCurrency(data.currentValue) : 'NAV pending'}
              </Text>
              {navIsStale && latestNavDate && (
                <Text style={clearDetailStyles.statHint}>as of {formatNavDate(latestNavDate)}</Text>
              )}
            </View>
            <View style={clearDetailStyles.statCell}>
              <Text style={clearDetailStyles.statLabel} numberOfLines={1}>Cost basis</Text>
              <Text style={clearDetailStyles.statValue}>{formatCurrency(data.investedAmount)}</Text>
              {hasRealizedActivity && (
                <Text style={clearDetailStyles.statHint}>after redemptions</Text>
              )}
            </View>
            <View style={clearDetailStyles.statCell}>
              <Text style={clearDetailStyles.statLabel} numberOfLines={1}>Units</Text>
              <Text style={clearDetailStyles.statValue}>{data.currentUnits.toFixed(3)}</Text>
            </View>
          </View>

          {hasSignalRow && (
            <View style={clearDetailStyles.signalBox}>
              {gain !== null && gainPct !== null && (
                <View style={clearDetailStyles.signalCell}>
                  <Text style={clearDetailStyles.statLabel}>Gain</Text>
                  <Text style={[clearDetailStyles.signalValue, { color: gain >= 0 ? ClearLensColors.emeraldDeep : ClearLensColors.negative }]}>
                    {formatClearLensCurrencyDelta(gain)}
                    <Text style={clearDetailStyles.signalInline}> ({formatClearLensPercentDelta(gainPct, 1)})</Text>
                  </Text>
                </View>
              )}
              {gain !== null && gainPct !== null && Number.isFinite(data.fundXirr) && (
                <View style={clearDetailStyles.signalDivider} />
              )}
              {Number.isFinite(data.fundXirr) && (
                <View style={clearDetailStyles.signalCell}>
                  <Text style={clearDetailStyles.statLabel}>XIRR</Text>
                  <View style={clearDetailStyles.xirrSignalLine}>
                    <Text style={[clearDetailStyles.signalValue, { color: data.fundXirr >= 0 ? ClearLensColors.emeraldDeep : ClearLensColors.negative }]}>
                      {formatXirr(data.fundXirr)}
                    </Text>
                    <Text style={clearDetailStyles.xirrHint}>p.a.</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {hasRealizedActivity && (
            <View style={clearDetailStyles.realizedBox}>
              <View style={clearDetailStyles.realizedCell}>
                <Text style={clearDetailStyles.statLabel}>Redeemed</Text>
                <Text style={clearDetailStyles.realizedValue}>{formatCurrency(data.realizedAmount)}</Text>
              </View>
              <View style={clearDetailStyles.signalDivider} />
              <View style={clearDetailStyles.realizedCell}>
                <Text style={clearDetailStyles.statLabel}>Booked P&amp;L</Text>
                <Text
                  style={[
                    clearDetailStyles.realizedValue,
                    { color: data.realizedGain >= 0 ? ClearLensColors.emeraldDeep : ClearLensColors.negative },
                  ]}
                >
                  {formatClearLensCurrencyDelta(data.realizedGain)}
                </Text>
              </View>
            </View>
          )}
        </ClearLensCard>

        <ClearLensSegmentedControl
          selected={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'performance', label: 'Performance' },
            { value: 'nav', label: 'NAV & Facts' },
            { value: 'composition', label: 'Mix & Weight' },
          ]}
        />

        {activeTab === 'performance' && (
          <>
            <PerformanceTab
              navHistory={data.navHistory}
              defaultBenchmarkSymbol={data.benchmarkSymbol ?? null}
              fundRef={{ id: data.id, schemeCode: data.schemeCode }}
              userId={userId}
            />
            <GrowthConsistencyChart navHistory={data.navHistory} />
          </>
        )}

        {activeTab === 'nav' && (
          <>
            <NavHistoryTab navHistory={data.navHistory} />
            <TechnicalDetailsCard
              expenseRatio={data.expenseRatio}
              aumCr={data.aumCr}
              minSipAmount={data.minSipAmount}
              fundMetaSyncedAt={data.fundMetaSyncedAt}
              schemeCode={data.schemeCode}
              isin={data.isin}
            />
          </>
        )}

        {activeTab === 'composition' && (
          <>
            <FundCompositionTab schemeCode={data.schemeCode} />
            <PortfolioHealthDonut fundId={data.id} currentValue={data.currentValue} />
          </>
        )}
      </ScrollView>
    </ClearLensScreen>
  );
}

export default function FundDetailScreen() {
  const { isClearLens } = useAppDesignMode();
  return (
    <>
      <Stack.Screen options={{ headerShown: !isClearLens, title: '' }} />
      {isClearLens ? <ClearLensFundDetailScreen /> : <ClassicFundDetailScreen />}
    </>
  );
}

const clearDetailStyles = StyleSheet.create({
  scroll: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingBottom: ClearLensSpacing.xxl,
    gap: ClearLensSpacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ClearLensSpacing.md,
  },
  errorText: {
    ...ClearLensTypography.body,
    color: ClearLensColors.textSecondary,
  },
  heroCard: {
    gap: ClearLensSpacing.md,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ClearLensSpacing.sm,
  },
  heroTitleBlock: {
    flex: 1,
    gap: 5,
  },
  fundName: {
    ...ClearLensTypography.h2,
    color: ClearLensColors.navy,
  },
  category: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
    fontFamily: ClearLensFonts.semiBold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: ClearLensSpacing.sm,
  },
  statCell: {
    flex: 1,
    gap: 4,
  },
  statLabel: {
    ...ClearLensTypography.label,
    color: ClearLensColors.textTertiary,
    textTransform: 'uppercase',
    fontSize: 10,
    letterSpacing: 0.7,
  },
  statValue: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  statHint: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
    fontStyle: 'italic',
  },
  gainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    flexWrap: 'wrap',
  },
  gainValue: {
    ...ClearLensTypography.h3,
  },
  signalBox: {
    minHeight: 56,
    padding: ClearLensSpacing.sm,
    borderRadius: ClearLensRadii.md,
    backgroundColor: ClearLensSemanticColors.sentiment.positiveSurface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
  },
  signalCell: {
    flex: 1,
    gap: 3,
  },
  signalDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: ClearLensColors.mint,
  },
  signalValue: {
    ...ClearLensTypography.h3,
  },
  signalInline: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.medium,
  },
  realizedBox: {
    minHeight: 56,
    padding: ClearLensSpacing.sm,
    borderRadius: ClearLensRadii.md,
    backgroundColor: ClearLensColors.surfaceSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
  },
  realizedCell: {
    flex: 1,
    gap: 3,
  },
  realizedValue: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  xirrSignalLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: ClearLensSpacing.xs,
    flexWrap: 'wrap',
  },
  xirrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.xs,
    flexWrap: 'wrap',
  },
  xirrValue: {
    ...ClearLensTypography.h3,
  },
  xirrHint: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
  },
  benchmarkPill: {
    minHeight: 40,
    alignSelf: 'flex-end',
    marginTop: -ClearLensSpacing.xs,
    paddingHorizontal: ClearLensSpacing.md,
    borderRadius: ClearLensRadii.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    backgroundColor: ClearLensSemanticColors.sentiment.positiveSurface,
  },
  benchmarkPillNegative: {
    backgroundColor: ClearLensSemanticColors.sentiment.negativeSurface,
  },
  benchmarkPillText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensSemanticColors.sentiment.positiveText,
    fontFamily: ClearLensFonts.semiBold,
  },
  benchmarkPillTextNegative: {
    color: ClearLensSemanticColors.sentiment.negativeText,
  },
  noteCard: {
    marginHorizontal: ClearLensSpacing.md,
  },
  noteText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textSecondary,
  },
});

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    errorText: { ...Typography.body, color: colors.textSecondary },
    backLink: { color: colors.primary, fontSize: 14, fontWeight: '600' as const },

    // ── Fund header ──
    fundHeader: {
      backgroundColor: colors.surface,
      margin: Spacing.md,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    fundName: { fontSize: 17, fontWeight: '700' as const, color: colors.textPrimary, lineHeight: 24 },
    fundCategory: { ...Typography.bodySmall, color: colors.textTertiary, marginBottom: 6, fontWeight: '600' as const },

    holdingRow: { flexDirection: 'row', marginTop: 2 },
    holdingStat: { flex: 1, alignItems: 'center', gap: 4 },
    holdingValue: { fontSize: 15, fontWeight: '800' as const, color: colors.textPrimary },
    holdingValuePending: { fontSize: 13, fontWeight: '500' as const, color: colors.textTertiary, fontStyle: 'italic' },
    navStaleLabel: { fontSize: 11, color: colors.textTertiary, fontStyle: 'italic' },

    gainRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    gainValue: { fontSize: 14, fontWeight: '700' as const },

    xirrHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' },
    xirrHeaderValue: { fontSize: 14, fontWeight: '700' as const },
    xirrHeaderHint: { fontSize: 11, color: colors.textTertiary, fontWeight: '600' as const },

    // ── Tab bar ──
    tabBar: {
      flexDirection: 'row',
      marginHorizontal: Spacing.md,
      backgroundColor: colors.borderLight,
      borderRadius: Radii.md,
      padding: 4,
      marginBottom: Spacing.xs,
    },
    tab: {
      flex: 1,
      paddingVertical: 9,
      alignItems: 'center',
      borderRadius: Radii.sm,
    },
    tabActive: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabText: { fontSize: 13, fontWeight: '600' as const, color: colors.textTertiary },
    tabTextActive: { color: colors.textPrimary, fontWeight: '700' as const },

    // ── Tab content ──
    tabContent: { paddingHorizontal: Spacing.md, gap: 14 },

    // XIRR card
    xirrCard: {
      backgroundColor: colors.surface,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      gap: Spacing.md,
      marginTop: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    comparisonRow: { flexDirection: 'row', alignItems: 'flex-start' },
    comparisonCol: { flex: 1, gap: 4 },
    comparisonHint: {
      fontSize: 11,
      lineHeight: 16,
      color: colors.textTertiary,
      fontWeight: '600' as const,
    },
    xirrDivider: { width: 1, backgroundColor: colors.borderLight, marginHorizontal: 12 },
    xirrValue: { fontSize: 22, fontWeight: '800' as const, color: colors.textPrimary, letterSpacing: -0.5 },
    verdictRow: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    verdictText: { fontSize: 13, fontWeight: '600' as const },

    // Chart
    chartCard: {
      backgroundColor: colors.surface,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      gap: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    chartWrap: {
      alignItems: 'center',
      overflow: 'hidden',
    },
    chartLegendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' as const },

    returnSummary: { gap: 6, marginTop: 4 },
    summaryDateLabel: { fontSize: 11, color: colors.textTertiary, marginBottom: 2 },
    returnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    returnLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' as const },
    returnVal: { fontSize: 14, fontWeight: '700' as const },

    navStatsRow: { flexDirection: 'row' },
    navStat: { flex: 1, alignItems: 'center', gap: 3 },
    navStatValue: { fontSize: 13, fontWeight: '700' as const, color: colors.textPrimary },

    statLabel: { ...Typography.caption, color: colors.textTertiary, textTransform: 'uppercase' },

    windowRow: { flexDirection: 'row', gap: 6 },
    windowPill: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: Radii.full,
      alignItems: 'center',
      backgroundColor: colors.borderLight,
    },
    windowPillActive: { backgroundColor: colors.primary },
    windowPillText: { fontSize: 12, fontWeight: '600' as const, color: colors.textTertiary },
    windowPillTextActive: { color: colors.textOnDark },

    chartAxisLabel: { fontSize: 9, color: colors.textTertiary },

    chartExplainer: {
      fontSize: 11,
      color: colors.textTertiary,
      fontStyle: 'italic',
      textAlign: 'center',
      lineHeight: 16,
    },
    noBenchmarkNote: {
      fontSize: 12,
      color: colors.textTertiary,
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
      backgroundColor: colors.borderLight,
    },
    benchmarkPillActive: { backgroundColor: colors.primary },
    benchmarkPillText: { fontSize: 11, fontWeight: '600' as const, color: colors.textTertiary },
    benchmarkPillTextActive: { color: colors.textOnDark },

    pointerLabel: {
      backgroundColor: colors.surface,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 2,
    },
    pointerDate: { fontSize: 10, color: colors.textTertiary, fontWeight: '600' as const },
    pointerSeriesText: { fontSize: 11, color: colors.textSecondary },

    noData: { padding: 40, alignItems: 'center', gap: 10 },
    noDataText: { ...Typography.body, color: colors.textTertiary, textAlign: 'center' },

    bottomPad: { height: 32 },
  });
}

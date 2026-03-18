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
import { LineChart } from 'react-native-gifted-charts';
import {
  useFundDetail,
  filterToWindow,
  indexTo100,
  type TimeWindow,
} from '@/src/hooks/useFundDetail';
import { buildXAxisLabels, formatDateShort } from '@/src/hooks/usePerformanceTimeline';
import { formatXirr } from '@/src/utils/xirr';
import { formatCurrency } from '@/src/utils/formatting';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 32;

const TIME_WINDOWS: TimeWindow[] = ['1M', '3M', '6M', '1Y', '3Y', 'All'];

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
        >
          <Text style={[styles.windowPillText, selected === w && styles.windowPillTextActive]}>
            {w}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function sample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = Math.ceil(arr.length / max);
  return arr.filter((_, i) => i % step === 0 || i === arr.length - 1);
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
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const filteredNav = filterToWindow(navHistory, window);
  const filteredIdx = filterToWindow(indexHistory, window);

  const indexedNav = indexTo100(filteredNav);
  const indexedBenchmark = indexTo100(filteredIdx);

  const sampledNav = sample(indexedNav, 60);
  const sampledBenchmark = sample(indexedBenchmark, 60);

  const navPoints = sampledNav.map((p) => ({ value: p.value }));
  const benchmarkPoints = sampledBenchmark.map((p) => ({ value: p.value }));

  const navDates = sampledNav.map((p) => p.date);
  const xAxisLabels = buildXAxisLabels(navDates);

  const hasNavData = navPoints.length > 1;
  const hasBenchmarkData = benchmarkPoints.length > 1;

  const latestNav = indexedNav[indexedNav.length - 1]?.value ?? 100;
  const latestBenchmark = indexedBenchmark[indexedBenchmark.length - 1]?.value ?? 100;
  const navReturn = ((latestNav - 100) / 100) * 100;
  const benchmarkReturn = ((latestBenchmark - 100) / 100) * 100;

  function tooltipLeft(idx: number): number {
    if (navDates.length <= 1) return 0;
    const raw = (idx / (navDates.length - 1)) * (CHART_WIDTH - 64);
    return Math.max(4, Math.min(raw, CHART_WIDTH - 130));
  }

  return (
    <View style={styles.tabContent}>
      <View style={styles.xirrCard}>
        <View style={styles.xirrStat}>
          <Text style={styles.xirrStatLabel}>XIRR (annualised)</Text>
          <Text
            style={[
              styles.xirrStatValue,
              { color: isFinite(fundXirr) && fundXirr >= 0 ? '#16a34a' : '#dc2626' },
            ]}
          >
            {formatXirr(fundXirr)}
          </Text>
        </View>
        {benchmarkIndex && (
          <View style={[styles.xirrStat, { borderLeftWidth: 1, borderLeftColor: '#e2e8f0', paddingLeft: 16 }]}>
            <Text style={styles.xirrStatLabel}>{benchmarkIndex}</Text>
            <Text style={styles.xirrStatValue}>{formatXirr(benchmarkReturn / 100, 2)}</Text>
          </View>
        )}
      </View>

      <TimeWindowSelector selected={window} onChange={(w) => { setWindow(w); setFocusedIndex(null); }} />

      {hasNavData ? (
        <View style={styles.chartContainer}>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#1a56db' }]} />
              <Text style={styles.legendLabel}>Fund</Text>
            </View>
            {hasBenchmarkData && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                <Text style={styles.legendLabel}>{benchmarkIndex ?? 'Benchmark'}</Text>
              </View>
            )}
          </View>

          <View style={{ position: 'relative' }}>
            <LineChart
              data={navPoints}
              data2={hasBenchmarkData ? benchmarkPoints : undefined}
              width={CHART_WIDTH - 32}
              height={180}
              hideDataPoints
              showDataPointOnFocus
              showStripOnFocus
              stripColor="#94a3b8"
              stripOpacity={0.2}
              stripWidth={1}
              focusedDataPointColor="#1a56db"
              onFocus={(_item: unknown, index: number) => setFocusedIndex(index)}
              color1="#1a56db"
              color2="#f59e0b"
              thickness1={2}
              thickness2={2}
              startFillColor1="#1a56db"
              endFillColor1="#fff"
              startOpacity1={0.12}
              endOpacity1={0}
              areaChart
              curved
              hideYAxisText
              xAxisColor="#e2e8f0"
              yAxisColor="transparent"
              rulesColor="#f1f5f9"
              rulesType="solid"
              noOfSections={4}
              xAxisLabelTexts={xAxisLabels}
              xAxisLabelTextStyle={styles.xAxisText}
            />

            {/* Crosshair tooltip */}
            {focusedIndex !== null && navDates[focusedIndex] && (
              <View
                style={[styles.tooltip, { left: tooltipLeft(focusedIndex) }]}
                pointerEvents="none"
              >
                <Text style={styles.tooltipDate}>{formatDateShort(navDates[focusedIndex])}</Text>
                <Text style={[styles.tooltipValue, { color: '#1a56db' }]}>
                  Fund: {((navPoints[focusedIndex]?.value ?? 100) - 100).toFixed(1)}%
                </Text>
                {hasBenchmarkData && benchmarkPoints[focusedIndex] && (
                  <Text style={[styles.tooltipValue, { color: '#f59e0b' }]}>
                    {benchmarkIndex?.split(' ')[0] ?? 'Idx'}: {((benchmarkPoints[focusedIndex].value) - 100).toFixed(1)}%
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.returnRow}>
            <Text style={styles.returnLabel}>Fund return ({window}):</Text>
            <Text style={[styles.returnValue, { color: navReturn >= 0 ? '#16a34a' : '#dc2626' }]}>
              {navReturn >= 0 ? '+' : ''}{navReturn.toFixed(2)}%
            </Text>
          </View>
          {hasBenchmarkData && (
            <View style={styles.returnRow}>
              <Text style={styles.returnLabel}>{benchmarkIndex ?? 'Benchmark'} return ({window}):</Text>
              <Text
                style={[styles.returnValue, { color: benchmarkReturn >= 0 ? '#16a34a' : '#dc2626' }]}
              >
                {benchmarkReturn >= 0 ? '+' : ''}{benchmarkReturn.toFixed(2)}%
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.noData}>
          <Text style={styles.noDataText}>No NAV data available for this window.</Text>
        </View>
      )}
    </View>
  );
}

function NavHistoryTab({ navHistory }: { navHistory: { date: string; value: number }[] }) {
  const [window, setWindow] = useState<TimeWindow>('1Y');
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const filtered = filterToWindow(navHistory, window);
  const sampledFull = sample(filtered, 90);
  const points = sampledFull.map((p) => ({ value: p.value }));
  const dates = sampledFull.map((p) => p.date);
  const xAxisLabels = buildXAxisLabels(dates);

  const currentNav = filtered[filtered.length - 1]?.value;
  const startNav = filtered[0]?.value;
  const navChange = currentNav && startNav ? ((currentNav - startNav) / startNav) * 100 : null;

  function tooltipLeft(idx: number): number {
    if (dates.length <= 1) return 0;
    const raw = (idx / (dates.length - 1)) * (CHART_WIDTH - 64);
    return Math.max(4, Math.min(raw, CHART_WIDTH - 110));
  }

  return (
    <View style={styles.tabContent}>
      <TimeWindowSelector selected={window} onChange={(w) => { setWindow(w); setFocusedIndex(null); }} />

      {points.length > 1 ? (
        <View style={styles.chartContainer}>
          <View style={{ position: 'relative' }}>
            <LineChart
              data={points}
              width={CHART_WIDTH - 32}
              height={200}
              hideDataPoints
              showDataPointOnFocus
              showStripOnFocus
              stripColor="#94a3b8"
              stripOpacity={0.2}
              stripWidth={1}
              focusedDataPointColor="#1a56db"
              onFocus={(_item: unknown, index: number) => setFocusedIndex(index)}
              color1="#1a56db"
              thickness1={2}
              startFillColor1="#1a56db"
              endFillColor1="#fff"
              startOpacity1={0.15}
              endOpacity1={0}
              areaChart
              curved
              hideYAxisText
              xAxisColor="#e2e8f0"
              yAxisColor="transparent"
              rulesColor="#f1f5f9"
              rulesType="solid"
              noOfSections={4}
              xAxisLabelTexts={xAxisLabels}
              xAxisLabelTextStyle={styles.xAxisText}
            />

            {/* Crosshair tooltip */}
            {focusedIndex !== null && dates[focusedIndex] && (
              <View
                style={[styles.tooltip, { left: tooltipLeft(focusedIndex) }]}
                pointerEvents="none"
              >
                <Text style={styles.tooltipDate}>{formatDateShort(dates[focusedIndex])}</Text>
                <Text style={[styles.tooltipValue, { color: '#1a56db' }]}>
                  ₹{(points[focusedIndex]?.value ?? 0).toFixed(3)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.navStatsRow}>
            <View style={styles.navStat}>
              <Text style={styles.navStatLabel}>Current NAV</Text>
              <Text style={styles.navStatValue}>₹{currentNav?.toFixed(3) ?? '—'}</Text>
            </View>
            <View style={styles.navStat}>
              <Text style={styles.navStatLabel}>Start NAV</Text>
              <Text style={styles.navStatValue}>₹{startNav?.toFixed(3) ?? '—'}</Text>
            </View>
            {navChange !== null && (
              <View style={styles.navStat}>
                <Text style={styles.navStatLabel}>Change ({window})</Text>
                <Text
                  style={[styles.navStatValue, { color: navChange >= 0 ? '#16a34a' : '#dc2626' }]}
                >
                  {navChange >= 0 ? '+' : ''}{navChange.toFixed(2)}%
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.noData}>
          <Text style={styles.noDataText}>No NAV data available for this window.</Text>
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
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isLoading ? 'Loading…' : (data?.schemeName ?? 'Fund Detail')}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1a56db" />
        </View>
      ) : isError || !data ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load fund data.</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Fund header card */}
          <View style={styles.fundHeader}>
            <Text style={styles.fundName}>{data.schemeName}</Text>
            <Text style={styles.fundCategory}>{data.schemeCategory}</Text>

            <View style={styles.holdingRow}>
              <View style={styles.holdingStat}>
                <Text style={styles.holdingLabel}>Current Value</Text>
                <Text style={styles.holdingValue}>{formatCurrency(data.currentValue)}</Text>
              </View>
              <View style={styles.holdingStat}>
                <Text style={styles.holdingLabel}>Invested</Text>
                <Text style={styles.holdingValue}>{formatCurrency(data.investedAmount)}</Text>
              </View>
              <View style={styles.holdingStat}>
                <Text style={styles.holdingLabel}>Units</Text>
                <Text style={styles.holdingValue}>{data.currentUnits.toFixed(3)}</Text>
              </View>
            </View>

            {data.benchmarkIndex && (
              <Text style={styles.benchmarkLabel}>
                Benchmark: {data.benchmarkIndex}
              </Text>
            )}
          </View>

          {/* Tab bar */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'performance' && styles.tabActive]}
              onPress={() => setActiveTab('performance')}
            >
              <Text style={[styles.tabText, activeTab === 'performance' && styles.tabTextActive]}>
                Performance
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'nav' && styles.tabActive]}
              onPress={() => setActiveTab('nav')}
            >
              <Text style={[styles.tabText, activeTab === 'nav' && styles.tabTextActive]}>
                NAV History
              </Text>
            </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: '#f8fafc' },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 10,
  },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 22, color: '#1a56db' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 15, color: '#555' },
  backLink: { fontSize: 14, color: '#1a56db', fontWeight: '600' },

  fundHeader: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 14,
    padding: 18,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  fundName: { fontSize: 16, fontWeight: '700', color: '#111', lineHeight: 22 },
  fundCategory: { fontSize: 12, color: '#94a3b8', marginBottom: 4 },
  holdingRow: { flexDirection: 'row', marginTop: 4 },
  holdingStat: { flex: 1, alignItems: 'center', gap: 3 },
  holdingLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' },
  holdingValue: { fontSize: 15, fontWeight: '700', color: '#111' },
  benchmarkLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  tabText: { fontSize: 13, fontWeight: '500', color: '#64748b' },
  tabTextActive: { color: '#111', fontWeight: '700' },

  tabContent: { paddingHorizontal: 16, gap: 14 },

  xirrCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  xirrStat: { flex: 1, gap: 4 },
  xirrStatLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' },
  xirrStatValue: { fontSize: 22, fontWeight: '700', color: '#111' },

  windowRow: { flexDirection: 'row', gap: 6 },
  windowPill: { flex: 1, paddingVertical: 6, borderRadius: 20, alignItems: 'center', backgroundColor: '#f1f5f9' },
  windowPillActive: { backgroundColor: '#1a56db' },
  windowPillText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  windowPillTextActive: { color: '#fff' },

  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  chartLegend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: '#64748b' },

  xAxisText: { fontSize: 9, color: '#94a3b8' },

  tooltip: {
    position: 'absolute',
    top: 6,
    backgroundColor: 'rgba(17,17,17,0.88)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 90,
    gap: 3,
    zIndex: 10,
  },
  tooltipDate: { fontSize: 11, color: '#e2e8f0', fontWeight: '600', marginBottom: 2 },
  tooltipValue: { fontSize: 12, fontWeight: '700' },

  returnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  returnLabel: { fontSize: 13, color: '#64748b' },
  returnValue: { fontSize: 14, fontWeight: '700' },

  navStatsRow: { flexDirection: 'row' },
  navStat: { flex: 1, alignItems: 'center', gap: 3 },
  navStatLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' },
  navStatValue: { fontSize: 13, fontWeight: '700', color: '#111' },

  noData: { padding: 32, alignItems: 'center' },
  noDataText: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },

  bottomPad: { height: 32 },
});

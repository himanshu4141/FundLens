import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import { useSession } from '@/src/hooks/useSession';
import { useCompare, type CompareFundData } from '@/src/hooks/useCompare';
import {
  usePerformanceTimeline,
  buildTimelineSeries,
  buildXAxisLabels,
  formatDateShort,
} from '@/src/hooks/usePerformanceTimeline';
import { formatXirr } from '@/src/utils/xirr';
import { supabase } from '@/src/lib/supabase';
import { type TimeWindow } from '@/src/hooks/useFundDetail';
import { Colors, Spacing, Radii, Typography } from '@/src/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 32;
const MAX_ITEMS = 3;

// Visually distinct colours for each selected item
const SERIES_COLORS = [Colors.primary, Colors.positive, '#f59e0b'];
// Lighter versions for index benchmark lines
const INDEX_LINE_COLORS = [Colors.primary + 'b0', Colors.positive + 'b0', '#f59e0bb0'];

const TIME_WINDOWS: TimeWindow[] = ['1M', '3M', '6M', '1Y', '3Y', 'All'];

// Fixed list of trackable benchmark indexes
const INDEX_OPTIONS = [
  { symbol: '^NSEI', name: 'Nifty 50' },
  { symbol: '^NSEBANK', name: 'Nifty Bank' },
  { symbol: '^BSESN', name: 'SENSEX' },
  { symbol: '^CNXIT', name: 'Nifty IT' },
];

interface SelectedItem {
  type: 'fund' | 'index';
  id: string;      // fund ID or index symbol
  name: string;
  color: string;   // from SERIES_COLORS, assigned when added
}

interface FundSearchResult {
  id: string;
  scheme_name: string;
  scheme_category: string | null;
}

interface SearchItem {
  id: string;
  name: string;
  sub: string;
  type: 'fund' | 'index';
}

function AddItemModal({
  visible,
  userId,
  excludeIds,
  onSelect,
  onClose,
}: {
  visible: boolean;
  userId: string;
  excludeIds: string[];
  onSelect: (item: { type: 'fund' | 'index'; id: string; name: string }) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [allFunds, setAllFunds] = useState<FundSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFunds = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('fund')
        .select('id, scheme_name, scheme_category')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('scheme_name', { ascending: true })
        .limit(100);
      setAllFunds(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (visible) loadFunds();
  }, [visible, loadFunds]);

  const filteredFunds: SearchItem[] = allFunds
    .filter(
      (f) =>
        !excludeIds.includes(f.id) &&
        (query.trim() === '' || f.scheme_name.toLowerCase().includes(query.trim().toLowerCase())),
    )
    .map((f) => ({ id: f.id, name: f.scheme_name, sub: f.scheme_category ?? '', type: 'fund' as const }));

  const filteredIndexes: SearchItem[] = INDEX_OPTIONS.filter(
    (idx) =>
      !excludeIds.includes(idx.symbol) &&
      (query.trim() === '' || idx.name.toLowerCase().includes(query.trim().toLowerCase())),
  ).map((idx) => ({ id: idx.symbol, name: idx.name, sub: 'Benchmark Index', type: 'index' as const }));

  // Build unified list with section headers interleaved
  const listItems: ({ kind: 'header'; title: string } | { kind: 'item' } & SearchItem)[] = [];
  if (filteredFunds.length > 0) {
    listItems.push({ kind: 'header', title: 'Your Funds' });
    filteredFunds.forEach((f) => listItems.push({ kind: 'item', ...f }));
  }
  if (filteredIndexes.length > 0) {
    listItems.push({ kind: 'header', title: 'Benchmark Indexes' });
    filteredIndexes.forEach((idx) => listItems.push({ kind: 'item', ...idx }));
  }

  function handleClose() {
    setQuery('');
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>Add to Compare</Text>
          <TouchableOpacity onPress={handleClose} style={modalStyles.closeBtn}>
            <Text style={modalStyles.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={modalStyles.searchRow}>
          <Ionicons name="search-outline" size={16} color={Colors.textTertiary} style={{ marginRight: 6 }} />
          <TextInput
            style={modalStyles.searchInput}
            placeholder="Search funds or indexes…"
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholderTextColor={Colors.textTertiary}
            clearButtonMode="while-editing"
          />
          {loading && <ActivityIndicator style={modalStyles.searchSpinner} color={Colors.primary} />}
        </View>

        {listItems.length === 0 && !loading ? (
          <View style={modalStyles.hint}>
            <Ionicons name="search-outline" size={32} color={Colors.textTertiary} />
            <Text style={modalStyles.hintText}>
              {allFunds.length === 0 ? 'No funds in your portfolio' : 'No matches'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={listItems}
            keyExtractor={(item, i) => item.kind === 'header' ? `hdr-${i}` : item.id}
            renderItem={({ item }) => {
              if (item.kind === 'header') {
                return (
                  <View style={modalStyles.sectionHeader}>
                    <Text style={modalStyles.sectionHeaderText}>{item.title}</Text>
                  </View>
                );
              }
              return (
                <TouchableOpacity
                  style={modalStyles.resultItem}
                  onPress={() => {
                    onSelect({ type: item.type, id: item.id, name: item.name });
                    handleClose();
                  }}
                >
                  {item.type === 'index' && <Text style={modalStyles.indexBadge}>INDEX</Text>}
                  <View style={modalStyles.resultText}>
                    <Text style={modalStyles.resultName}>{item.name}</Text>
                    <Text style={modalStyles.resultCategory}>{item.sub}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={modalStyles.resultList}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function CompareTable({ funds, fundColors }: { funds: CompareFundData[]; fundColors: string[] }) {
  if (funds.length === 0) return null;
  return (
    <View style={styles.compareTable}>
      <View style={styles.tableRow}>
        <Text style={styles.tableHeaderCell}>Metric</Text>
        {funds.map((f, i) => (
          <Text key={f.id} style={[styles.tableHeaderCell, { color: fundColors[i] }]} numberOfLines={2}>
            {f.schemeName.split(' ').slice(0, 3).join(' ')}
          </Text>
        ))}
      </View>

      <View style={[styles.tableRow, styles.tableRowAlt]}>
        <Text style={styles.tableLabelCell}>XIRR</Text>
        {funds.map((f) => (
          <Text key={f.id} style={styles.tableValueCell}>{formatXirr(f.fundXirr)}</Text>
        ))}
      </View>

      <View style={styles.tableRow}>
        <Text style={styles.tableLabelCell}>1Y Return</Text>
        {funds.map((f) => (
          <Text key={f.id} style={styles.tableValueCell}>
            {f.return1Y !== null ? `${f.return1Y >= 0 ? '+' : ''}${f.return1Y.toFixed(1)}%` : 'N/A'}
          </Text>
        ))}
      </View>

      <View style={[styles.tableRow, styles.tableRowAlt]}>
        <Text style={styles.tableLabelCell}>NAV</Text>
        {funds.map((f) => (
          <Text key={f.id} style={styles.tableValueCell}>₹{f.currentNav.toFixed(2)}</Text>
        ))}
      </View>

      <View style={styles.tableRow}>
        <Text style={styles.tableLabelCell}>Category</Text>
        {funds.map((f) => (
          <Text key={f.id} style={[styles.tableValueCell, { fontSize: 11 }]} numberOfLines={2}>
            {f.schemeCategory}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function CompareScreen() {
  const { session } = useSession();
  const userId = session?.user.id;

  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [window, setWindow] = useState<TimeWindow>('1Y');
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const focusedIndexRef = useRef<number | null>(null);

  const selectedFundItems = selectedItems
    .filter((i) => i.type === 'fund')
    .map((i) => ({ id: i.id, name: i.name }));
  const selectedIndexItems = selectedItems
    .filter((i) => i.type === 'index')
    .map((i) => ({ symbol: i.id, name: i.name }));
  const selectedFundIds = selectedFundItems.map((f) => f.id);

  const { data: timelineData, isLoading: timelineLoading } = usePerformanceTimeline(
    selectedFundItems,
    selectedIndexItems,
  );
  const { data: compareData, isLoading: compareLoading } = useCompare(selectedFundIds);

  const isLoading = timelineLoading || compareLoading;

  // Visible items (exclude hidden)
  const visibleItems = selectedItems.filter((item) => !hiddenIds.has(item.id));
  const visibleIds = visibleItems.map((i) => i.id);

  const { points: chartPoints, dates: chartDates } =
    timelineData && visibleIds.length > 0
      ? buildTimelineSeries(timelineData.entries, visibleIds, window)
      : { points: [], dates: [] };

  const hasChartData = chartPoints.length > 0 && chartPoints[0].length > 1;
  const xAxisLabels = hasChartData ? buildXAxisLabels(chartDates) : [];

  function addItem(item: { type: 'fund' | 'index'; id: string; name: string }) {
    if (selectedItems.length >= MAX_ITEMS) return;
    // Check not already added
    if (selectedItems.some((s) => s.id === item.id)) return;
    const colorIndex = selectedItems.length;
    setSelectedItems((prev) => [
      ...prev,
      { ...item, color: SERIES_COLORS[colorIndex] },
    ]);
  }

  function removeItem(id: string) {
    setSelectedItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      // Re-assign colors by new position
      return next.map((item, i) => ({ ...item, color: SERIES_COLORS[i] }));
    });
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setFocusedIndex(null);
    focusedIndexRef.current = null;
  }

  function toggleHidden(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setFocusedIndex(null);
    focusedIndexRef.current = null;
  }

  const excludeIds = selectedItems.map((i) => i.id);

  // Tooltip position: clamp to chart bounds
  function tooltipLeft(idx: number): number {
    if (chartDates.length <= 1) return 0;
    const raw = (idx / (chartDates.length - 1)) * (CHART_WIDTH - 60);
    return Math.max(4, Math.min(raw, CHART_WIDTH - 120));
  }

  // For the metrics table, build fund colors in the same order as compareData.funds
  const fundItemsInOrder = selectedItems.filter((i) => i.type === 'fund');
  const fundColors = fundItemsInOrder.map((i) => i.color);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Compare</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Item selector chips */}
        <View style={styles.chipSection}>
          <Text style={styles.chipSectionLabel}>
            Selected ({selectedItems.length}/{MAX_ITEMS})
          </Text>
          <View style={styles.chipRow}>
            {selectedItems.map((item, i) => (
              <View key={item.id} style={[styles.fundChip, { borderColor: SERIES_COLORS[i] }]}>
                <View style={[styles.chipDot, { backgroundColor: SERIES_COLORS[i] }]} />
                <Text style={styles.chipName} numberOfLines={1}>
                  {item.name.split(' ').slice(0, 4).join(' ')}
                </Text>
                {item.type === 'index' && <Text style={styles.chipIndexTag}>IDX</Text>}
                <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.chipRemove}>
                  <Text style={styles.chipRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}

            {selectedItems.length < MAX_ITEMS && (
              <TouchableOpacity
                style={styles.addChip}
                onPress={() => setShowModal(true)}
                disabled={!userId}
              >
                <Text style={styles.addChipText}>+ Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {selectedItems.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bar-chart-outline" size={40} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Compare funds & indexes</Text>
            <Text style={styles.emptySub}>
              Select up to {MAX_ITEMS} funds or benchmark indexes to compare their % return on the same chart.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => setShowModal(true)}
              disabled={!userId}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.emptyBtnText}>Add first item</Text>
            </TouchableOpacity>
          </View>
        ) : isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <>
            {/* Time window */}
            <View style={styles.windowSection}>
              <View style={styles.windowRow}>
                {TIME_WINDOWS.map((w) => (
                  <TouchableOpacity
                    key={w}
                    style={[styles.windowPill, window === w && styles.windowPillActive]}
                    onPress={() => {
                      setWindow(w);
                      setFocusedIndex(null);
                      focusedIndexRef.current = null;
                    }}
                  >
                    <Text style={[styles.windowPillText, window === w && styles.windowPillTextActive]}>
                      {w}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>% Return from start of period</Text>

              {hasChartData ? (
                <>
                  <View style={{ position: 'relative' }}>
                    <LineChart
                      data={chartPoints[0]}
                      data2={chartPoints[1]}
                      data3={chartPoints[2]}
                      width={CHART_WIDTH - 32}
                      height={200}
                      hideDataPoints
                      showDataPointOnFocus
                      showStripOnFocus
                      stripColor="#94a3b8"
                      stripOpacity={0.2}
                      stripWidth={1}
                      focusedDataPointColor={visibleItems[0]?.color ?? SERIES_COLORS[0]}
                      onFocus={(_item: unknown, index: number) => {
                        focusedIndexRef.current = index;
                        setFocusedIndex(index);
                      }}
                      color1={visibleItems[0]?.type === 'index' ? INDEX_LINE_COLORS[0] : (visibleItems[0]?.color ?? SERIES_COLORS[0])}
                      color2={visibleItems[1]?.type === 'index' ? INDEX_LINE_COLORS[1] : (visibleItems[1]?.color ?? SERIES_COLORS[1])}
                      color3={visibleItems[2]?.type === 'index' ? INDEX_LINE_COLORS[2] : (visibleItems[2]?.color ?? SERIES_COLORS[2])}
                      thickness1={visibleItems[0]?.type === 'index' ? 1.5 : 2.5}
                      thickness2={visibleItems[1]?.type === 'index' ? 1.5 : 2.5}
                      thickness3={visibleItems[2]?.type === 'index' ? 1.5 : 2.5}
                      hideYAxisText={false}
                      yAxisTextStyle={styles.yAxisText}
                      xAxisColor="#e2e8f0"
                      yAxisColor="transparent"
                      rulesColor="#f1f5f9"
                      rulesType="solid"
                      noOfSections={4}
                      xAxisLabelTexts={xAxisLabels}
                      xAxisLabelTextStyle={styles.xAxisText}
                    />

                    {/* Crosshair tooltip */}
                    {focusedIndex !== null && chartDates[focusedIndex] && (
                      <View
                        style={[
                          styles.tooltip,
                          { left: tooltipLeft(focusedIndex) },
                        ]}
                        pointerEvents="none"
                      >
                        <Text style={styles.tooltipDate}>
                          {formatDateShort(chartDates[focusedIndex])}
                        </Text>
                        {visibleItems.map((item, si) => {
                          const val = chartPoints[si]?.[focusedIndex]?.value;
                          if (val === undefined) return null;
                          return (
                            <Text key={item.id} style={[styles.tooltipValue, { color: item.color }]}>
                              {item.name.split(' ')[0]}: {val >= 0 ? '+' : ''}{val.toFixed(1)}%
                            </Text>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {/* Legend with show/hide toggles */}
                  <View style={styles.legendSection}>
                    {selectedItems.map((item, i) => {
                      const isHidden = hiddenIds.has(item.id);
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.legendItem, isHidden && styles.legendItemHidden]}
                          onPress={() => toggleHidden(item.id)}
                        >
                          <View
                            style={[
                              styles.legendLine,
                              {
                                backgroundColor: isHidden ? '#cbd5e1' : SERIES_COLORS[i],
                                height: item.type === 'index' ? 2 : 3,
                              },
                            ]}
                          />
                          <Text
                            style={[styles.legendLabel, isHidden && styles.legendLabelHidden]}
                            numberOfLines={1}
                          >
                            {item.name.split(' ').slice(0, 3).join(' ')}
                            {item.type === 'index' ? ' (Index)' : ''}
                          </Text>
                          <Text style={[styles.legendEye, isHidden && styles.legendEyeHidden]}>
                            {isHidden ? '○' : '●'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : (
                <View style={styles.noData}>
                  <Text style={styles.noDataText}>
                    {selectedItems.length < 2
                      ? 'Add at least 2 items to see the chart.'
                      : visibleItems.length < 2
                      ? 'Show at least 2 items in the legend to compare.'
                      : 'No overlapping data for this time window.'}
                  </Text>
                </View>
              )}
            </View>

            {/* Metrics table — fund items only */}
            {compareData && compareData.funds.length > 0 && (
              <CompareTable funds={compareData.funds} fundColors={fundColors} />
            )}
          </>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      {userId && (
        <AddItemModal
          visible={showModal}
          userId={userId}
          excludeIds={excludeIds}
          onSelect={addItem}
          onClose={() => setShowModal(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  title: { ...Typography.h2, color: Colors.textPrimary },

  chipSection: { padding: Spacing.md, gap: 10 },
  chipSectionLabel: { ...Typography.label, color: Colors.textTertiary, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fundChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radii.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    maxWidth: 200,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipName: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  chipIndexTag: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textSecondary,
    backgroundColor: Colors.borderLight,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  chipRemove: { padding: 2 },
  chipRemoveText: { fontSize: 16, color: Colors.textTertiary, fontWeight: '700', lineHeight: 18 },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    borderRadius: Radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addChipText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: { ...Typography.h2, color: Colors.textPrimary },
  emptySub: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    marginTop: Spacing.sm,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  loading: { paddingVertical: 60, alignItems: 'center' },

  windowSection: { paddingHorizontal: Spacing.md, marginBottom: 4 },
  windowRow: { flexDirection: 'row', gap: 6 },
  windowPill: { flex: 1, paddingVertical: 7, borderRadius: Radii.full, alignItems: 'center', backgroundColor: Colors.borderLight },
  windowPillActive: { backgroundColor: Colors.primary },
  windowPillText: { fontSize: 12, fontWeight: '600', color: Colors.textTertiary },
  windowPillTextActive: { color: '#fff' },

  chartCard: {
    backgroundColor: Colors.surface,
    margin: Spacing.md,
    borderRadius: Radii.md,
    padding: Spacing.md,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  yAxisText: { fontSize: 10, color: Colors.textTertiary },
  xAxisText: { fontSize: 9, color: Colors.textTertiary },

  tooltip: {
    position: 'absolute',
    top: 6,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderRadius: Radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 100,
    gap: 3,
    zIndex: 10,
  },
  tooltipDate: { fontSize: 11, color: '#e2e8f0', fontWeight: '600', marginBottom: 2 },
  tooltipValue: { fontSize: 12, fontWeight: '700' },

  legendSection: { gap: 8, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  legendItemHidden: { opacity: 0.4 },
  legendLine: { width: 20, borderRadius: 2 },
  legendLabel: { flex: 1, fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  legendLabelHidden: { color: Colors.textTertiary },
  legendEye: { fontSize: 12, color: Colors.textSecondary, width: 16 },
  legendEyeHidden: { color: Colors.textTertiary },

  noData: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  noDataText: { ...Typography.body, color: Colors.textTertiary, textAlign: 'center', lineHeight: 20 },

  compareTable: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  tableRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10 },
  tableRowAlt: { backgroundColor: Colors.background },
  tableHeaderCell: { flex: 1, fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  tableLabelCell: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  tableValueCell: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textPrimary },

  bottomPad: { height: 32 },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  title: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 15, color: Colors.primary, fontWeight: '600' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radii.sm,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 12, color: Colors.textPrimary },
  searchSpinner: { marginLeft: 8 },

  sectionHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sectionHeaderText: { ...Typography.label, color: Colors.textTertiary, textTransform: 'uppercase' },

  hint: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hintText: { fontSize: 14, color: Colors.textTertiary },

  resultList: { paddingBottom: 32 },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 10,
  },
  indexBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.primary,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  resultText: { flex: 1, gap: 3 },
  resultName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  resultCategory: { fontSize: 12, color: Colors.textTertiary },
});

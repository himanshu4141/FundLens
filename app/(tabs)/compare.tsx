import { useState, useCallback } from 'react';
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
import { LineChart } from 'react-native-gifted-charts';
import { useSession } from '@/src/hooks/useSession';
import { useCompare, buildChartSeries, type CompareFundData } from '@/src/hooks/useCompare';
import { formatXirr } from '@/src/utils/xirr';
import { supabase } from '@/src/lib/supabase';
import { type TimeWindow } from '@/src/hooks/useFundDetail';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 32;
const MAX_FUNDS = 3;

// Distinct chart colors for up to 3 funds
const FUND_COLORS = ['#1a56db', '#16a34a', '#f59e0b'];

const TIME_WINDOWS: TimeWindow[] = ['1M', '3M', '6M', '1Y', '3Y', 'All'];

interface FundSearchResult {
  id: string;
  scheme_name: string;
  scheme_category: string | null;
}

function FundSearchModal({
  visible,
  userId,
  excludeIds,
  onSelect,
  onClose,
}: {
  visible: boolean;
  userId: string;
  excludeIds: string[];
  onSelect: (fund: FundSearchResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FundSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(
    async (text: string) => {
      setQuery(text);
      if (text.trim().length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const { data } = await supabase
          .from('fund')
          .select('id, scheme_name, scheme_category')
          .eq('user_id', userId)
          .eq('is_active', true)
          .ilike('scheme_name', `%${text}%`)
          .limit(20);
        setResults((data ?? []).filter((f) => !excludeIds.includes(f.id)));
      } finally {
        setSearching(false);
      }
    },
    [userId, excludeIds],
  );

  function handleClose() {
    setQuery('');
    setResults([]);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>Add Fund to Compare</Text>
          <TouchableOpacity onPress={handleClose} style={modalStyles.closeBtn}>
            <Text style={modalStyles.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={modalStyles.searchRow}>
          <TextInput
            style={modalStyles.searchInput}
            placeholder="Search funds by name…"
            value={query}
            onChangeText={search}
            autoFocus
            placeholderTextColor="#94a3b8"
          />
          {searching && <ActivityIndicator style={modalStyles.searchSpinner} color="#1a56db" />}
        </View>

        {query.length < 2 ? (
          <View style={modalStyles.hint}>
            <Text style={modalStyles.hintText}>Type at least 2 characters to search</Text>
          </View>
        ) : results.length === 0 && !searching ? (
          <View style={modalStyles.hint}>
            <Text style={modalStyles.hintText}>No funds found</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={modalStyles.resultItem}
                onPress={() => {
                  onSelect(item);
                  handleClose();
                }}
              >
                <Text style={modalStyles.resultName}>{item.scheme_name}</Text>
                <Text style={modalStyles.resultCategory}>{item.scheme_category ?? ''}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={modalStyles.resultList}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function CompareTable({ funds }: { funds: CompareFundData[] }) {
  return (
    <View style={styles.compareTable}>
      {/* Header row */}
      <View style={styles.tableRow}>
        <Text style={styles.tableHeaderCell}>Metric</Text>
        {funds.map((f, i) => (
          <Text key={f.id} style={[styles.tableHeaderCell, { color: FUND_COLORS[i] }]} numberOfLines={2}>
            {f.schemeName.split(' ').slice(0, 3).join(' ')}
          </Text>
        ))}
      </View>

      {/* XIRR row */}
      <View style={[styles.tableRow, styles.tableRowAlt]}>
        <Text style={styles.tableLabelCell}>XIRR</Text>
        {funds.map((f) => (
          <Text key={f.id} style={styles.tableValueCell}>{formatXirr(f.fundXirr)}</Text>
        ))}
      </View>

      {/* 1Y return row */}
      <View style={styles.tableRow}>
        <Text style={styles.tableLabelCell}>1Y Return</Text>
        {funds.map((f) => (
          <Text key={f.id} style={styles.tableValueCell}>
            {f.return1Y !== null ? `${f.return1Y >= 0 ? '+' : ''}${f.return1Y.toFixed(1)}%` : 'N/A'}
          </Text>
        ))}
      </View>

      {/* Current NAV row */}
      <View style={[styles.tableRow, styles.tableRowAlt]}>
        <Text style={styles.tableLabelCell}>NAV</Text>
        {funds.map((f) => (
          <Text key={f.id} style={styles.tableValueCell}>₹{f.currentNav.toFixed(2)}</Text>
        ))}
      </View>

      {/* Category row */}
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

  const [selectedFundIds, setSelectedFundIds] = useState<string[]>([]);
  const [selectedFundNames, setSelectedFundNames] = useState<Record<string, string>>({});
  const [showModal, setShowModal] = useState(false);
  const [window, setWindow] = useState<TimeWindow>('1Y');

  const { data, isLoading } = useCompare(selectedFundIds);

  function removeFund(id: string) {
    setSelectedFundIds((prev) => prev.filter((fid) => fid !== id));
    setSelectedFundNames((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function addFund(fund: FundSearchResult) {
    if (selectedFundIds.length >= MAX_FUNDS) return;
    setSelectedFundIds((prev) => [...prev, fund.id]);
    setSelectedFundNames((prev) => ({ ...prev, [fund.id]: fund.scheme_name }));
  }

  const chartSeries =
    data && selectedFundIds.length > 0
      ? buildChartSeries(data.commonNavSeries, selectedFundIds, window)
      : [];

  const hasChartData = chartSeries.length > 0 && chartSeries[0].length > 1;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Compare</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Fund selector chips */}
        <View style={styles.chipSection}>
          <Text style={styles.chipSectionLabel}>
            Selected funds ({selectedFundIds.length}/{MAX_FUNDS})
          </Text>
          <View style={styles.chipRow}>
            {selectedFundIds.map((id, i) => (
              <View key={id} style={[styles.fundChip, { borderColor: FUND_COLORS[i] }]}>
                <View style={[styles.chipDot, { backgroundColor: FUND_COLORS[i] }]} />
                <Text style={styles.chipName} numberOfLines={1}>
                  {(selectedFundNames[id] ?? '').split(' ').slice(0, 4).join(' ')}
                </Text>
                <TouchableOpacity onPress={() => removeFund(id)} style={styles.chipRemove}>
                  <Text style={styles.chipRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}

            {selectedFundIds.length < MAX_FUNDS && (
              <TouchableOpacity
                style={styles.addChip}
                onPress={() => setShowModal(true)}
                disabled={!userId}
              >
                <Text style={styles.addChipText}>+ Add fund</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {selectedFundIds.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Compare your funds</Text>
            <Text style={styles.emptySub}>
              Select up to {MAX_FUNDS} funds to compare their performance side-by-side.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => setShowModal(true)}
              disabled={!userId}
            >
              <Text style={styles.emptyBtnText}>Add first fund</Text>
            </TouchableOpacity>
          </View>
        ) : isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#1a56db" />
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
                    onPress={() => setWindow(w)}
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
              <Text style={styles.chartTitle}>NAV indexed to 100</Text>

              {hasChartData ? (
                <>
                  <LineChart
                    data={chartSeries[0]}
                    data2={chartSeries[1]}
                    data3={chartSeries[2]}
                    width={CHART_WIDTH - 32}
                    height={200}
                    hideDataPoints
                    color1={FUND_COLORS[0]}
                    color2={FUND_COLORS[1]}
                    color3={FUND_COLORS[2]}
                    thickness1={2}
                    thickness2={2}
                    thickness3={2}
                    hideYAxisText
                    xAxisColor="#e2e8f0"
                    yAxisColor="transparent"
                    rulesColor="#f1f5f9"
                    rulesType="solid"
                    noOfSections={4}
                  />
                  <View style={styles.chartLegend}>
                    {selectedFundIds.map((id, i) => (
                      <View key={id} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: FUND_COLORS[i] }]} />
                        <Text style={styles.legendLabel} numberOfLines={1}>
                          {(selectedFundNames[id] ?? '').split(' ').slice(0, 3).join(' ')}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <View style={styles.noData}>
                  <Text style={styles.noDataText}>
                    {selectedFundIds.length < 2
                      ? 'Add at least 2 funds to see the comparison chart.'
                      : 'No overlapping NAV data available for this time window.'}
                  </Text>
                </View>
              )}
            </View>

            {/* Metrics table */}
            {data && data.funds.length > 0 && <CompareTable funds={data.funds} />}
          </>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      {userId && (
        <FundSearchModal
          visible={showModal}
          userId={userId}
          excludeIds={selectedFundIds}
          onSelect={addFund}
          onClose={() => setShowModal(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111' },

  chipSection: { padding: 16, gap: 10 },
  chipSectionLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fundChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    maxWidth: 180,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipName: { flex: 1, fontSize: 12, fontWeight: '600', color: '#111' },
  chipRemove: { padding: 2 },
  chipRemoveText: { fontSize: 16, color: '#94a3b8', fontWeight: '700', lineHeight: 18 },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#1a56db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addChipText: { fontSize: 13, color: '#1a56db', fontWeight: '600' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  emptySub: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22 },
  emptyBtn: { backgroundColor: '#1a56db', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  loading: { paddingVertical: 60, alignItems: 'center' },

  windowSection: { paddingHorizontal: 16, marginBottom: 4 },
  windowRow: { flexDirection: 'row', gap: 6 },
  windowPill: { flex: 1, paddingVertical: 7, borderRadius: 20, alignItems: 'center', backgroundColor: '#f1f5f9' },
  windowPillActive: { backgroundColor: '#1a56db' },
  windowPillText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  windowPillTextActive: { color: '#fff' },

  chartCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  chartLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: '#334155', maxWidth: 120 },

  noData: { paddingVertical: 32, alignItems: 'center' },
  noDataText: { fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 20 },

  compareTable: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  tableRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10 },
  tableRowAlt: { backgroundColor: '#f8fafc' },
  tableHeaderCell: { flex: 1, fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  tableLabelCell: { flex: 1, fontSize: 12, fontWeight: '600', color: '#64748b' },
  tableValueCell: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111' },

  bottomPad: { height: 32 },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#111' },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 15, color: '#1a56db', fontWeight: '600' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 12, color: '#111' },
  searchSpinner: { marginLeft: 8 },

  hint: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hintText: { fontSize: 14, color: '#94a3b8' },

  resultList: { paddingHorizontal: 16, gap: 0 },
  resultItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 3,
  },
  resultName: { fontSize: 14, fontWeight: '600', color: '#111' },
  resultCategory: { fontSize: 12, color: '#94a3b8' },
});

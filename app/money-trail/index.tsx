import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ClearLensCard,
  ClearLensHeader,
  ClearLensScreen,
} from '@/src/components/clearLens/ClearLensPrimitives';
import { useMoneyTrail } from '@/src/hooks/useMoneyTrail';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensShadow,
  ClearLensSpacing,
  ClearLensSemanticColors,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';
import { formatCurrency } from '@/src/utils/formatting';
import {
  DEFAULT_MONEY_TRAIL_FILTERS,
  MONEY_TRAIL_SORT_LABELS,
  applyMoneyTrailControls,
  buildAnnualMoneyFlows,
  buildMoneyTrailSummary,
  directionLabel,
  formatMoneyTrailDate,
  getFinancialYearShortLabel,
  parseMoneyTrailAmountInput,
  statusLabel,
  type MoneyTrailDatePreset,
  type MoneyTrailDirection,
  type MoneyTrailFilters,
  type MoneyTrailSortOption,
  type MoneyTrailTransactionType,
  type PortfolioTransaction,
} from '@/src/utils/moneyTrail';
import { exportMoneyTrailCsv } from '@/src/utils/moneyTrailExport';

const DATE_PRESETS: { value: MoneyTrailDatePreset; label: string }[] = [
  { value: 'this_fy', label: 'This financial year' },
  { value: 'last_fy', label: 'Last financial year' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'all_time', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

const TYPE_FILTERS: { value: MoneyTrailTransactionType; label: string }[] = [
  { value: 'sip_purchase', label: 'SIP investment' },
  { value: 'purchase', label: 'Lump sum investment' },
  { value: 'redemption', label: 'Withdrawal' },
  { value: 'switch_in', label: 'Switch' },
  { value: 'switch_out', label: 'Switch out' },
  { value: 'dividend_payout', label: 'Dividend' },
  { value: 'dividend_reinvestment', label: 'Dividend reinvested' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'failed', label: 'Failed/reversed' },
  { value: 'reversal', label: 'Reversal' },
];

const DIRECTION_FILTERS: { value: MoneyTrailDirection; label: string }[] = [
  { value: 'money_in', label: 'Money in' },
  { value: 'money_out', label: 'Money out' },
  { value: 'internal', label: 'Internal movement' },
];

const SORT_OPTIONS: MoneyTrailSortOption[] = [
  'newest',
  'oldest',
  'amount_desc',
  'amount_asc',
  'fund_asc',
  'fund_desc',
];

function MetricGrid({ transactions }: { transactions: PortfolioTransaction[] }) {
  const summary = useMemo(() => buildMoneyTrailSummary(transactions), [transactions]);

  return (
    <ClearLensCard style={styles.metricGrid}>
      <Metric label="Total invested" value={formatCurrency(summary.totalInvested)} tone="in" />
      <Metric label="Total withdrawn" value={formatCurrency(summary.totalWithdrawn)} tone="out" />
      <Metric label="Net invested" value={formatCurrency(summary.netInvested)} tone="net" />
      <Metric label="Transactions" value={String(summary.transactionCount)} tone="neutral" />
    </ClearLensCard>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'in' | 'out' | 'net' | 'neutral';
}) {
  const color = tone === 'in' || tone === 'net' ? ClearLensColors.emeraldDeep : ClearLensColors.navy;
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={[styles.metricLabel, { color }]}>{label}</Text>
    </View>
  );
}

function AnnualSummary({ transactions }: { transactions: PortfolioTransaction[] }) {
  const annualFlows = useMemo(() => buildAnnualMoneyFlows(transactions), [transactions]);
  const maxValue = Math.max(
    1,
    ...annualFlows.flatMap((flow) => [flow.invested, flow.withdrawn, Math.abs(flow.netInvested)]),
  );

  if (annualFlows.length === 0) return null;

  return (
    <ClearLensCard style={styles.annualCard}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Net invested by financial year</Text>
          <Text style={styles.sectionSubtitle}>Invested, withdrawn, and net invested</Text>
        </View>
        <Ionicons name="information-circle-outline" size={18} color={ClearLensColors.textTertiary} />
      </View>
      <View style={styles.annualBars}>
        {annualFlows.slice(-6).map((flow) => {
          const investedHeight = Math.max(8, (flow.invested / maxValue) * 78);
          const withdrawnHeight = flow.withdrawn > 0 ? Math.max(3, (flow.withdrawn / maxValue) * 34) : 0;
          return (
            <View key={flow.financialYear} style={styles.annualBarItem}>
              <Text style={styles.annualNet}>{formatCurrency(flow.netInvested)}</Text>
              <View style={styles.annualBarTrack}>
                <View style={[styles.annualInvested, { height: investedHeight }]} />
                {withdrawnHeight > 0 && <View style={[styles.annualWithdrawn, { height: withdrawnHeight }]} />}
              </View>
              <Text style={styles.annualLabel}>{getFinancialYearShortLabel(flow.financialYear)}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.legendRow}>
        <Legend color={ClearLensColors.emerald} label="Invested" />
        <Legend color={ClearLensColors.amber} label="Withdrawn" />
        <Legend color={ClearLensColors.mint} label="Net invested" />
      </View>
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

function TransactionRow({
  transaction,
  onPress,
}: {
  transaction: PortfolioTransaction;
  onPress: () => void;
}) {
  const treatment = transactionTreatment(transaction);

  return (
    <TouchableOpacity style={styles.transactionRow} onPress={onPress} activeOpacity={0.76}>
      <View style={[styles.transactionIcon, { backgroundColor: treatment.bg }]}>
        <Ionicons name={treatment.icon} size={18} color={treatment.color} />
      </View>
      <View style={styles.transactionCopy}>
        <Text style={styles.transactionType}>{transaction.userFacingType}</Text>
        <Text style={styles.transactionFund} numberOfLines={1}>{transaction.fundName}</Text>
        <Text style={styles.transactionDate}>{formatMoneyTrailDate(transaction.date)}</Text>
      </View>
      <View style={styles.transactionAmountBlock}>
        <Text style={[styles.transactionAmount, { color: treatment.color }]}>{formatCurrency(transaction.amount)}</Text>
        <Text style={[styles.statusText, { color: treatment.statusColor }]}>
          {statusLabel(transaction.status)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function transactionTreatment(transaction: PortfolioTransaction): {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  statusColor: string;
} {
  if (transaction.hiddenByDefault) {
    return {
      icon: 'remove-circle-outline',
      color: ClearLensColors.textTertiary,
      bg: ClearLensColors.grey50,
      statusColor: ClearLensColors.textTertiary,
    };
  }
  if (transaction.direction === 'money_in') {
    return {
      icon: 'arrow-down-circle-outline',
      color: ClearLensColors.emeraldDeep,
      bg: ClearLensColors.mint50,
      statusColor: ClearLensColors.emeraldDeep,
    };
  }
  if (transaction.direction === 'money_out') {
    return {
      icon: 'arrow-up-circle-outline',
      color: ClearLensColors.amber,
      bg: '#FFF7E6',
      statusColor: ClearLensColors.emeraldDeep,
    };
  }
  if (transaction.direction === 'internal') {
    return {
      icon: 'swap-horizontal-outline',
      color: ClearLensColors.slate,
      bg: ClearLensColors.surfaceSoft,
      statusColor: ClearLensColors.emeraldDeep,
    };
  }
  return {
    icon: 'ellipse-outline',
    color: ClearLensColors.textTertiary,
    bg: ClearLensColors.surfaceSoft,
    statusColor: ClearLensColors.textTertiary,
  };
}

function ActiveFilterChips({
  filters,
  fundOptions,
  query,
  onClear,
}: {
  filters: MoneyTrailFilters;
  fundOptions: { id: string; name: string }[];
  query: string;
  onClear: () => void;
}) {
  const chips: string[] = [];
  if (query.trim()) chips.push(`Search: ${query.trim()}`);
  if (filters.datePreset !== 'all_time') chips.push(DATE_PRESETS.find((item) => item.value === filters.datePreset)?.label ?? 'Date range');
  if (filters.fundIds.length > 0) {
    const names = filters.fundIds
      .map((fundId) => fundOptions.find((fund) => fund.id === fundId)?.name)
      .filter(Boolean);
    chips.push(names.length === 1 ? names[0]! : `${names.length} funds`);
  }
  if (filters.transactionTypes.length > 0) chips.push(`${filters.transactionTypes.length} type filters`);
  if (filters.directions.length > 0) chips.push(filters.directions.map(directionLabel).join(', '));
  if (filters.amcNames.length > 0) chips.push(`${filters.amcNames.length} AMCs`);
  if (filters.minAmount != null || filters.maxAmount != null) chips.push('Amount range');
  if (filters.includeHidden) chips.push('Hidden shown');

  if (chips.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {chips.map((chip) => (
        <View key={chip} style={styles.activeChip}>
          <Text style={styles.activeChipText}>{chip}</Text>
        </View>
      ))}
      <TouchableOpacity style={styles.clearChip} onPress={onClear} activeOpacity={0.76}>
        <Text style={styles.clearChipText}>Clear all filters</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SortSheet({
  visible,
  selected,
  onClose,
  onApply,
}: {
  visible: boolean;
  selected: MoneyTrailSortOption;
  onClose: () => void;
  onApply: (sort: MoneyTrailSortOption) => void;
}) {
  const [draft, setDraft] = useState(selected);

  useEffect(() => {
    if (visible) setDraft(selected);
  }, [selected, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <SheetHeader title="Sort by" onClose={onClose} />
          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.sheetOption}
              onPress={() => setDraft(option)}
              activeOpacity={0.76}
            >
              <Text style={styles.sheetOptionText}>{MONEY_TRAIL_SORT_LABELS[option]}</Text>
              <View style={[styles.radioOuter, draft === option && styles.radioOuterActive]}>
                {draft === option && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          ))}
          <SheetActions
            secondaryLabel="Cancel"
            primaryLabel="Apply sort"
            onSecondary={onClose}
            onPrimary={() => {
              onApply(draft);
              onClose();
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FilterSheet({
  visible,
  selected,
  fundOptions,
  amcOptions,
  onClose,
  onApply,
}: {
  visible: boolean;
  selected: MoneyTrailFilters;
  fundOptions: { id: string; name: string }[];
  amcOptions: string[];
  onClose: () => void;
  onApply: (filters: MoneyTrailFilters) => void;
}) {
  const [draft, setDraft] = useState<MoneyTrailFilters>(selected);
  const [minAmountText, setMinAmountText] = useState('');
  const [maxAmountText, setMaxAmountText] = useState('');

  useEffect(() => {
    if (!visible) return;
    setDraft(selected);
    setMinAmountText(selected.minAmount != null ? String(selected.minAmount) : '');
    setMaxAmountText(selected.maxAmount != null ? String(selected.maxAmount) : '');
  }, [selected, visible]);

  function toggleArrayValue<T extends string>(key: keyof MoneyTrailFilters, value: T) {
    setDraft((current) => {
      const values = current[key] as T[];
      return {
        ...current,
        [key]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      };
    });
  }

  function applyDraft() {
    onApply({
      ...draft,
      minAmount: parseMoneyTrailAmountInput(minAmountText),
      maxAmount: parseMoneyTrailAmountInput(maxAmountText),
    });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.filterSheet} onPress={(event) => event.stopPropagation()}>
          <SheetHeader title="Filters" onClose={onClose} trailing="Clear all" onTrailing={() => {
            setDraft(DEFAULT_MONEY_TRAIL_FILTERS);
            setMinAmountText('');
            setMaxAmountText('');
          }} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
            <FilterGroup title="Date range">
              <View style={styles.wrapRow}>
                {DATE_PRESETS.map((preset) => (
                  <ChoiceChip
                    key={preset.value}
                    label={preset.label}
                    selected={draft.datePreset === preset.value}
                    onPress={() => setDraft((current) => ({ ...current, datePreset: preset.value }))}
                  />
                ))}
              </View>
              {draft.datePreset === 'custom' && (
                <View style={styles.inputRow}>
                  <TextInput
                    value={draft.customStartDate ?? ''}
                    onChangeText={(value) => setDraft((current) => ({ ...current, customStartDate: value }))}
                    placeholder="Start YYYY-MM-DD"
                    placeholderTextColor={ClearLensColors.textTertiary}
                    style={styles.textInput}
                  />
                  <TextInput
                    value={draft.customEndDate ?? ''}
                    onChangeText={(value) => setDraft((current) => ({ ...current, customEndDate: value }))}
                    placeholder="End YYYY-MM-DD"
                    placeholderTextColor={ClearLensColors.textTertiary}
                    style={styles.textInput}
                  />
                </View>
              )}
            </FilterGroup>

            <FilterGroup title="Transaction type">
              <View style={styles.wrapRow}>
                {TYPE_FILTERS.map((type) => (
                  <ChoiceChip
                    key={type.value}
                    label={type.label}
                    selected={draft.transactionTypes.includes(type.value)}
                    onPress={() => toggleArrayValue('transactionTypes', type.value)}
                  />
                ))}
              </View>
            </FilterGroup>

            <FilterGroup title="Direction">
              <View style={styles.wrapRow}>
                {DIRECTION_FILTERS.map((direction) => (
                  <ChoiceChip
                    key={direction.value}
                    label={direction.label}
                    selected={draft.directions.includes(direction.value)}
                    onPress={() => toggleArrayValue('directions', direction.value)}
                  />
                ))}
              </View>
            </FilterGroup>

            {amcOptions.length > 0 && (
              <FilterGroup title="AMC">
                <View style={styles.wrapRow}>
                  {amcOptions.map((amc) => (
                    <ChoiceChip
                      key={amc}
                      label={amc}
                      selected={draft.amcNames.includes(amc)}
                      onPress={() => toggleArrayValue('amcNames', amc)}
                    />
                  ))}
                </View>
              </FilterGroup>
            )}

            {fundOptions.length > 0 && (
              <FilterGroup title="Fund name">
                <View style={styles.wrapRow}>
                  {fundOptions.map((fund) => (
                    <ChoiceChip
                      key={fund.id}
                      label={fund.name}
                      selected={draft.fundIds.includes(fund.id)}
                      onPress={() => toggleArrayValue('fundIds', fund.id)}
                    />
                  ))}
                </View>
              </FilterGroup>
            )}

            <FilterGroup title="Amount range">
              <View style={styles.inputRow}>
                <TextInput
                  value={minAmountText}
                  onChangeText={setMinAmountText}
                  keyboardType="numeric"
                  placeholder="Min amount"
                  placeholderTextColor={ClearLensColors.textTertiary}
                  style={styles.textInput}
                />
                <TextInput
                  value={maxAmountText}
                  onChangeText={setMaxAmountText}
                  keyboardType="numeric"
                  placeholder="Max amount"
                  placeholderTextColor={ClearLensColors.textTertiary}
                  style={styles.textInput}
                />
              </View>
            </FilterGroup>

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setDraft((current) => ({ ...current, includeHidden: !current.includeHidden }))}
              activeOpacity={0.76}
            >
              <View>
                <Text style={styles.toggleTitle}>Include hidden/reversed transactions</Text>
                <Text style={styles.toggleSubtitle}>Shows failed, cancelled, and reversed rows.</Text>
              </View>
              <View style={[styles.toggleTrack, draft.includeHidden && styles.toggleTrackActive]}>
                <View style={[styles.toggleKnob, draft.includeHidden && styles.toggleKnobActive]} />
              </View>
            </TouchableOpacity>
          </ScrollView>
          <SheetActions
            secondaryLabel="Cancel"
            primaryLabel="Apply filters"
            onSecondary={onClose}
            onPrimary={applyDraft}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ExportSheet({
  visible,
  transactionCount,
  exportResult,
  exportError,
  onClose,
  onExport,
}: {
  visible: boolean;
  transactionCount: number;
  exportResult: string | null;
  exportError: string | null;
  onClose: () => void;
  onExport: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <SheetHeader title="CSV export" onClose={onClose} />
          <View style={styles.exportBody}>
            <View style={styles.exportIcon}>
              <Ionicons name="document-text-outline" size={36} color={ClearLensColors.emeraldDeep} />
              <Text style={styles.exportBadge}>CSV</Text>
            </View>
            <Text style={styles.exportTitle}>Export your transactions</Text>
            <Text style={styles.exportText}>
              File will include {transactionCount} visible transaction{transactionCount === 1 ? '' : 's'} matching your current filters.
            </Text>
            {exportResult && <Text style={styles.exportResult}>{exportResult}</Text>}
            {exportError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxTitle}>Couldn&apos;t export CSV</Text>
                <Text style={styles.errorBoxText}>{exportError}</Text>
              </View>
            )}
          </View>
          <SheetActions
            secondaryLabel="Cancel"
            primaryLabel="Export CSV"
            onSecondary={onClose}
            onPrimary={onExport}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetHeader({
  title,
  trailing,
  onTrailing,
  onClose,
}: {
  title: string;
  trailing?: string;
  onTrailing?: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.sheetHeader}>
      <Text style={styles.sheetTitle}>{title}</Text>
      <View style={styles.sheetHeaderActions}>
        {trailing && onTrailing ? (
          <TouchableOpacity onPress={onTrailing} activeOpacity={0.76}>
            <Text style={styles.sheetTrailing}>{trailing}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.sheetClose} onPress={onClose} activeOpacity={0.76}>
          <Ionicons name="close" size={20} color={ClearLensColors.navy} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SheetActions({
  secondaryLabel,
  primaryLabel,
  onSecondary,
  onPrimary,
}: {
  secondaryLabel: string;
  primaryLabel: string;
  onSecondary: () => void;
  onPrimary: () => void;
}) {
  return (
    <View style={styles.sheetActions}>
      <TouchableOpacity style={styles.sheetSecondaryButton} onPress={onSecondary} activeOpacity={0.76}>
        <Text style={styles.sheetSecondaryText}>{secondaryLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.sheetPrimaryButton} onPress={onPrimary} activeOpacity={0.82}>
        <Text style={styles.sheetPrimaryText}>{primaryLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.choiceChip, selected && styles.choiceChipSelected]} onPress={onPress} activeOpacity={0.76}>
      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyTransactions({ filtered, onPrimary }: { filtered: boolean; onPrimary: () => void }) {
  return (
    <ClearLensCard style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Ionicons name={filtered ? 'search-outline' : 'cloud-upload-outline'} size={30} color={ClearLensColors.emerald} />
      </View>
      <Text style={styles.emptyTitle}>{filtered ? 'No matching transactions' : 'No transactions yet'}</Text>
      <Text style={styles.emptyText}>
        {filtered
          ? 'Try changing your filters or date range.'
          : 'Upload your CAS statement to see your complete Money Trail.'}
      </Text>
      <TouchableOpacity style={styles.emptyButton} onPress={onPrimary} activeOpacity={0.82}>
        <Text style={styles.emptyButtonText}>{filtered ? 'Clear filters' : 'Upload CAS'}</Text>
      </TouchableOpacity>
    </ClearLensCard>
  );
}

export default function MoneyTrailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fundId?: string }>();
  const requestedFundId = typeof params.fundId === 'string' ? params.fundId : undefined;
  const didApplyFundParam = useRef(false);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<MoneyTrailFilters>(DEFAULT_MONEY_TRAIL_FILTERS);
  const [sortBy, setSortBy] = useState<MoneyTrailSortOption>('newest');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useMoneyTrail();
  const transactions = useMemo(() => data?.transactions ?? [], [data?.transactions]);

  useEffect(() => {
    if (!requestedFundId || didApplyFundParam.current) return;
    didApplyFundParam.current = true;
    setFilters((current) => ({ ...current, fundIds: [requestedFundId] }));
  }, [requestedFundId]);

  const visibleTransactions = useMemo(
    () => applyMoneyTrailControls(transactions, filters, query, sortBy),
    [filters, query, sortBy, transactions],
  );
  const hasAnyFilter = query.trim().length > 0 ||
    filters.datePreset !== 'all_time' ||
    filters.transactionTypes.length > 0 ||
    filters.directions.length > 0 ||
    filters.amcNames.length > 0 ||
    filters.fundIds.length > 0 ||
    filters.minAmount != null ||
    filters.maxAmount != null ||
    filters.includeHidden;

  function clearFilters() {
    setFilters(DEFAULT_MONEY_TRAIL_FILTERS);
    setQuery('');
  }

  async function handleExport() {
    setExportResult(null);
    setExportError(null);
    try {
      const result = await exportMoneyTrailCsv(visibleTransactions);
      setExportResult(`Exported ${visibleTransactions.length} transactions. ${result.message}`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <ClearLensScreen>
      <Stack.Screen options={{ headerShown: false }} />
      <ClearLensHeader title="Money Trail" onPressBack={() => router.back()} />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ClearLensColors.emerald} />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Couldn&apos;t load Money Trail.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()} activeOpacity={0.82}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Money Trail</Text>
            <Text style={styles.subtitle}>Every investment, withdrawal, switch, and dividend in your portfolio.</Text>
          </View>

          {transactions.length > 0 ? (
            <>
              <MetricGrid transactions={visibleTransactions} />
              <AnnualSummary transactions={visibleTransactions} />

              <View style={styles.controlsBlock}>
                <View style={styles.searchBox}>
                  <Ionicons name="search-outline" size={18} color={ClearLensColors.textTertiary} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search fund, type, amount..."
                    placeholderTextColor={ClearLensColors.textTertiary}
                    style={styles.searchInput}
                  />
                </View>
                <TouchableOpacity style={styles.iconButton} onPress={() => setSortOpen(true)} activeOpacity={0.76}>
                  <Ionicons name="swap-vertical-outline" size={19} color={ClearLensColors.navy} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => setFilterOpen(true)} activeOpacity={0.76}>
                  <Ionicons name="filter-outline" size={19} color={ClearLensColors.navy} />
                </TouchableOpacity>
              </View>

              <ActiveFilterChips
                filters={filters}
                fundOptions={data?.fundOptions ?? []}
                query={query}
                onClear={clearFilters}
              />

              <View style={styles.listHeader}>
                <View>
                  <Text style={styles.listTitle}>Transactions</Text>
                  <Text style={styles.listSubtitle}>
                    {visibleTransactions.length} shown · {MONEY_TRAIL_SORT_LABELS[sortBy]}
                  </Text>
                </View>
                <TouchableOpacity style={styles.exportButton} onPress={() => setExportOpen(true)} activeOpacity={0.76}>
                  <Ionicons name="download-outline" size={17} color={ClearLensColors.emeraldDeep} />
                  <Text style={styles.exportButtonText}>Export</Text>
                </TouchableOpacity>
              </View>

              {visibleTransactions.length === 0 ? (
                <EmptyTransactions filtered={hasAnyFilter} onPrimary={clearFilters} />
              ) : (
                <View style={styles.transactionList}>
                  {visibleTransactions.map((transaction) => (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      onPress={() => router.push(`/money-trail/${transaction.id}`)}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <EmptyTransactions filtered={false} onPrimary={() => router.push('/onboarding')} />
          )}
        </ScrollView>
      )}

      <SortSheet
        visible={sortOpen}
        selected={sortBy}
        onClose={() => setSortOpen(false)}
        onApply={setSortBy}
      />
      <FilterSheet
        visible={filterOpen}
        selected={filters}
        fundOptions={data?.fundOptions ?? []}
        amcOptions={data?.amcOptions ?? []}
        onClose={() => setFilterOpen(false)}
        onApply={setFilters}
      />
      <ExportSheet
        visible={exportOpen}
        transactionCount={visibleTransactions.length}
        exportResult={exportResult}
        exportError={exportError}
        onClose={() => setExportOpen(false)}
        onExport={handleExport}
      />
    </ClearLensScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingBottom: ClearLensSpacing.xxl,
    gap: ClearLensSpacing.md,
  },
  titleBlock: {
    gap: 4,
  },
  title: {
    ...ClearLensTypography.h1,
    color: ClearLensColors.navy,
  },
  subtitle: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textSecondary,
  },
  metricGrid: {
    padding: 0,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metric: {
    width: '50%',
    minHeight: 74,
    padding: ClearLensSpacing.md,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: ClearLensColors.borderLight,
    gap: 4,
  },
  metricValue: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  metricLabel: {
    ...ClearLensTypography.caption,
    fontFamily: ClearLensFonts.semiBold,
  },
  annualCard: {
    gap: ClearLensSpacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: ClearLensSpacing.md,
  },
  sectionTitle: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  sectionSubtitle: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  annualBars: {
    minHeight: 126,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: ClearLensSpacing.sm,
  },
  annualBarItem: {
    flex: 1,
    alignItems: 'center',
    gap: ClearLensSpacing.xs,
  },
  annualNet: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.navy,
    fontFamily: ClearLensFonts.bold,
  },
  annualBarTrack: {
    height: 88,
    width: 24,
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: ClearLensColors.border,
  },
  annualInvested: {
    width: 24,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: ClearLensColors.emerald,
  },
  annualWithdrawn: {
    width: 24,
    backgroundColor: ClearLensColors.amber,
  },
  annualLabel: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ClearLensSpacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  controlsBlock: {
    flexDirection: 'row',
    gap: ClearLensSpacing.sm,
  },
  searchBox: {
    flex: 1,
    minHeight: 46,
    borderRadius: ClearLensRadii.md,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    backgroundColor: ClearLensColors.surface,
    paddingHorizontal: ClearLensSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
  },
  searchInput: {
    ...ClearLensTypography.bodySmall,
    flex: 1,
    color: ClearLensColors.navy,
    paddingVertical: 0,
  },
  iconButton: {
    width: 46,
    minHeight: 46,
    borderRadius: ClearLensRadii.md,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    backgroundColor: ClearLensColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    gap: ClearLensSpacing.sm,
    paddingRight: ClearLensSpacing.md,
  },
  activeChip: {
    minHeight: 34,
    paddingHorizontal: ClearLensSpacing.md,
    borderRadius: ClearLensRadii.full,
    backgroundColor: ClearLensColors.mint50,
    justifyContent: 'center',
  },
  activeChipText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.emeraldDeep,
    fontFamily: ClearLensFonts.bold,
  },
  clearChip: {
    minHeight: 34,
    paddingHorizontal: ClearLensSpacing.md,
    borderRadius: ClearLensRadii.full,
    backgroundColor: ClearLensColors.surfaceSoft,
    justifyContent: 'center',
  },
  clearChipText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.slate,
    fontFamily: ClearLensFonts.bold,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ClearLensSpacing.md,
  },
  listTitle: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  listSubtitle: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  exportButton: {
    minHeight: 38,
    paddingHorizontal: ClearLensSpacing.md,
    borderRadius: ClearLensRadii.full,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    backgroundColor: ClearLensColors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.xs,
  },
  exportButtonText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.emeraldDeep,
    fontFamily: ClearLensFonts.bold,
  },
  transactionList: {
    borderRadius: ClearLensRadii.lg,
    backgroundColor: ClearLensColors.surface,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    overflow: 'hidden',
    ...ClearLensShadow,
  },
  transactionRow: {
    minHeight: 86,
    padding: ClearLensSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: ClearLensColors.borderLight,
  },
  transactionIcon: {
    width: 34,
    height: 34,
    borderRadius: ClearLensRadii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionCopy: {
    flex: 1,
    gap: 2,
  },
  transactionType: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.navy,
    fontFamily: ClearLensFonts.bold,
  },
  transactionFund: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textSecondary,
    fontFamily: ClearLensFonts.semiBold,
  },
  transactionDate: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  transactionAmountBlock: {
    alignItems: 'flex-end',
    gap: 3,
    minWidth: 82,
  },
  transactionAmount: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.bold,
  },
  statusText: {
    ...ClearLensTypography.caption,
    fontFamily: ClearLensFonts.semiBold,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: ClearLensSemanticColors.overlay.backdrop,
  },
  sheet: {
    maxHeight: '86%',
    borderTopLeftRadius: ClearLensRadii.xl,
    borderTopRightRadius: ClearLensRadii.xl,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    backgroundColor: ClearLensColors.surface,
    paddingBottom: ClearLensSpacing.lg,
    ...ClearLensShadow,
  },
  filterSheet: {
    maxHeight: '92%',
    borderTopLeftRadius: ClearLensRadii.xl,
    borderTopRightRadius: ClearLensRadii.xl,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    backgroundColor: ClearLensColors.surface,
    paddingBottom: ClearLensSpacing.lg,
    ...ClearLensShadow,
  },
  sheetHeader: {
    minHeight: 58,
    paddingHorizontal: ClearLensSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  sheetHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
  },
  sheetTrailing: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.emeraldDeep,
    fontFamily: ClearLensFonts.bold,
  },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: ClearLensRadii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ClearLensColors.surfaceSoft,
  },
  sheetOption: {
    minHeight: 54,
    paddingHorizontal: ClearLensSpacing.md,
    borderTopWidth: 1,
    borderTopColor: ClearLensColors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetOptionText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.navy,
    fontFamily: ClearLensFonts.medium,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: ClearLensColors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: ClearLensColors.emerald,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: ClearLensColors.emerald,
  },
  sheetActions: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingTop: ClearLensSpacing.md,
    flexDirection: 'row',
    gap: ClearLensSpacing.sm,
  },
  sheetSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: ClearLensRadii.md,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ClearLensColors.surface,
  },
  sheetPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: ClearLensRadii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ClearLensColors.emeraldDeep,
  },
  sheetSecondaryText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.navy,
    fontFamily: ClearLensFonts.bold,
  },
  sheetPrimaryText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textOnDark,
    fontFamily: ClearLensFonts.bold,
  },
  filterContent: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingBottom: ClearLensSpacing.md,
    gap: ClearLensSpacing.md,
  },
  filterGroup: {
    gap: ClearLensSpacing.sm,
  },
  filterGroupTitle: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
    fontFamily: ClearLensFonts.bold,
    textTransform: 'uppercase',
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ClearLensSpacing.sm,
  },
  choiceChip: {
    minHeight: 34,
    maxWidth: '100%',
    paddingHorizontal: ClearLensSpacing.md,
    borderRadius: ClearLensRadii.full,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    backgroundColor: ClearLensColors.surface,
    justifyContent: 'center',
  },
  choiceChipSelected: {
    borderColor: ClearLensColors.emerald,
    backgroundColor: ClearLensColors.mint50,
  },
  choiceChipText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.slate,
    fontFamily: ClearLensFonts.semiBold,
  },
  choiceChipTextSelected: {
    color: ClearLensColors.emeraldDeep,
    fontFamily: ClearLensFonts.bold,
  },
  inputRow: {
    flexDirection: 'row',
    gap: ClearLensSpacing.sm,
  },
  textInput: {
    ...ClearLensTypography.bodySmall,
    flex: 1,
    minHeight: 46,
    borderRadius: ClearLensRadii.md,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    paddingHorizontal: ClearLensSpacing.md,
    color: ClearLensColors.navy,
    backgroundColor: ClearLensColors.surface,
  },
  toggleRow: {
    minHeight: 58,
    padding: ClearLensSpacing.md,
    borderRadius: ClearLensRadii.md,
    backgroundColor: ClearLensColors.surfaceSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ClearLensSpacing.md,
  },
  toggleTitle: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.navy,
    fontFamily: ClearLensFonts.bold,
  },
  toggleSubtitle: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: ClearLensRadii.full,
    backgroundColor: ClearLensColors.border,
    padding: 3,
  },
  toggleTrackActive: {
    backgroundColor: ClearLensColors.emerald,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ClearLensColors.surface,
  },
  toggleKnobActive: {
    transform: [{ translateX: 18 }],
  },
  exportBody: {
    paddingHorizontal: ClearLensSpacing.md,
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
  },
  exportIcon: {
    width: 74,
    height: 74,
    borderRadius: ClearLensRadii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ClearLensColors.mint50,
  },
  exportBadge: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.emeraldDeep,
    fontFamily: ClearLensFonts.bold,
  },
  exportTitle: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  exportText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textSecondary,
    textAlign: 'center',
  },
  exportResult: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.emeraldDeep,
    textAlign: 'center',
  },
  errorBox: {
    alignSelf: 'stretch',
    padding: ClearLensSpacing.md,
    borderRadius: ClearLensRadii.md,
    backgroundColor: ClearLensColors.negativeBg,
    gap: 2,
  },
  errorBoxTitle: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensSemanticColors.sentiment.negativeText,
    fontFamily: ClearLensFonts.bold,
  },
  errorBoxText: {
    ...ClearLensTypography.caption,
    color: ClearLensSemanticColors.sentiment.negativeText,
  },
  emptyCard: {
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: ClearLensRadii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ClearLensColors.mint50,
  },
  emptyTitle: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  emptyText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textSecondary,
    textAlign: 'center',
  },
  emptyButton: {
    minHeight: 44,
    paddingHorizontal: ClearLensSpacing.lg,
    borderRadius: ClearLensRadii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ClearLensColors.emeraldDeep,
  },
  emptyButtonText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textOnDark,
    fontFamily: ClearLensFonts.bold,
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
  retryButton: {
    minHeight: 42,
    paddingHorizontal: ClearLensSpacing.lg,
    borderRadius: ClearLensRadii.md,
    backgroundColor: ClearLensColors.emeraldDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textOnDark,
    fontFamily: ClearLensFonts.bold,
  },
});

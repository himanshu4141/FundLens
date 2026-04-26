import { useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ClearLensCard,
  ClearLensHeader,
  ClearLensScreen,
} from '@/src/components/clearLens/ClearLensPrimitives';
import { usePortfolio, type FundCardData } from '@/src/hooks/usePortfolio';
import { usePortfolioInsights } from '@/src/hooks/usePortfolioInsights';
import { useAppStore } from '@/src/store/appStore';
import { formatCurrency } from '@/src/utils/formatting';
import { formatXirr } from '@/src/utils/xirr';
import { parseFundName } from '@/src/utils/fundName';
import { navStaleness } from '@/src/utils/navUtils';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensShadow,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';

type SortOption = 'currentValue' | 'invested' | 'xirr' | 'benchmarkLead' | 'alphabetical';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'currentValue', label: 'Current value' },
  { value: 'invested', label: 'Invested' },
  { value: 'xirr', label: 'XIRR' },
  { value: 'benchmarkLead', label: 'Lead vs benchmark' },
  { value: 'alphabetical', label: 'Alphabetical' },
];

function sortableNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function AllocationOverview({
  fundCount,
  topThreeShare,
  largestPosition,
}: {
  fundCount: number;
  topThreeShare: number;
  largestPosition: string;
}) {
  return (
    <ClearLensCard style={styles.overviewCard}>
      <Text style={styles.screenEyebrow}>Allocation overview</Text>
      <View style={styles.overviewGrid}>
        <View style={styles.overviewMetric}>
          <Text style={styles.metricLabel}>Active funds</Text>
          <Text style={styles.overviewValue}>{fundCount}</Text>
        </View>
        <View style={styles.overviewMetric}>
          <Text style={styles.metricLabel}>Top 3 share</Text>
          <Text style={styles.overviewValue}>{topThreeShare.toFixed(1)}%</Text>
        </View>
      </View>
      <View style={styles.largestBox}>
        <Text style={styles.metricLabel}>Largest position</Text>
        <Text style={styles.largestName} numberOfLines={2}>{largestPosition}</Text>
      </View>
    </ClearLensCard>
  );
}

function FundListItem({
  fund,
  portfolioPct,
  expanded,
  onToggle,
  onOpen,
  latestNavDate,
}: {
  fund: FundCardData;
  portfolioPct: number | null;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  latestNavDate: string | null;
}) {
  const { base, planBadge } = parseFundName(fund.schemeName);
  const gain = fund.currentValue != null ? fund.currentValue - fund.investedAmount : null;
  const gainPct = gain != null && fund.investedAmount > 0 ? (gain / fund.investedAmount) * 100 : null;
  const stale = navStaleness(latestNavDate);
  const dailyColor = (fund.dailyChangePct ?? 0) >= 0 ? ClearLensColors.emerald : ClearLensColors.slate;
  const gainColor = (gain ?? 0) >= 0 ? ClearLensColors.emerald : ClearLensColors.slate;

  return (
    <ClearLensCard style={styles.fundCard}>
      <View style={styles.fundTopRow}>
        <TouchableOpacity style={styles.fundMainTap} onPress={onOpen} activeOpacity={0.76}>
          <View style={styles.fundNameBlock}>
            <Text style={styles.fundName} numberOfLines={2}>{base}</Text>
            <Text style={styles.fundMeta} numberOfLines={1}>
              {fund.schemeCategory}{planBadge ? ` · ${planBadge}` : ''}
            </Text>
          </View>
          <View style={styles.valueBlock}>
            <Text style={styles.fundValue}>{fund.currentValue != null ? formatCurrency(fund.currentValue) : 'NAV pending'}</Text>
            <Text style={styles.shareText}>{portfolioPct != null ? `${portfolioPct.toFixed(1)}%` : '—'} of portfolio</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.expandButton} onPress={onToggle} activeOpacity={0.75}>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={ClearLensColors.slate} />
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.expandedPanel}>
          <View style={styles.detailGrid}>
            <DetailCell
              label="Today"
              value={fund.dailyChangePct != null ? `${fund.dailyChangePct >= 0 ? '+' : ''}${fund.dailyChangePct.toFixed(2)}%` : '—'}
              subvalue={fund.dailyChangeAmount != null ? `${fund.dailyChangeAmount >= 0 ? '+' : '-'}${formatCurrency(Math.abs(fund.dailyChangeAmount))}${stale.stale ? ` · ${stale.label}` : ''}` : undefined}
              color={dailyColor}
            />
            <DetailCell
              label="XIRR"
              value={Number.isFinite(fund.returnXirr) ? formatXirr(fund.returnXirr) : '—'}
              color={fund.returnXirr >= 0 ? ClearLensColors.emerald : ClearLensColors.slate}
            />
            <DetailCell label="Invested" value={formatCurrency(fund.investedAmount)} />
            <DetailCell
              label="Gain / Loss"
              value={gain != null ? `${gain >= 0 ? '+' : '-'}${formatCurrency(Math.abs(gain))}` : '—'}
              subvalue={gain != null && gainPct != null ? `(${gain >= 0 ? '+' : ''}${gainPct.toFixed(1)}%)` : undefined}
              color={gainColor}
            />
          </View>
          {fund.redeemedUnits > 0 && (
            <View style={styles.redemptionRow}>
              <DetailCell label="Redeemed" value={formatCurrency(fund.realizedAmount)} />
              <DetailCell
                label="Booked P&L"
                value={`${fund.realizedGain >= 0 ? '+' : '-'}${formatCurrency(Math.abs(fund.realizedGain))}`}
                color={fund.realizedGain >= 0 ? ClearLensColors.emerald : ClearLensColors.slate}
              />
            </View>
          )}
        </View>
      )}
    </ClearLensCard>
  );
}

function DetailCell({
  label,
  value,
  subvalue,
  color = ClearLensColors.navy,
}: {
  label: string;
  value: string;
  subvalue?: string;
  color?: string;
}) {
  return (
    <View style={styles.detailCell}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.detailValue, { color }]}>{value}</Text>
      {subvalue ? <Text style={[styles.detailSubvalue, { color }]}>{subvalue}</Text> : null}
    </View>
  );
}

function SortBottomSheet({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: SortOption;
  onSelect: (value: SortOption) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Sort funds by</Text>
          {SORT_OPTIONS.map((option, index) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.sheetRow, index > 0 && styles.sheetDivider]}
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
            >
              <Text style={styles.sheetRowText}>{option.label}</Text>
              {option.value === selected && (
                <Ionicons name="checkmark-circle" size={20} color={ClearLensColors.emerald} />
              )}
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function ClearLensFundsScreen() {
  const router = useRouter();
  const { defaultBenchmarkSymbol } = useAppStore();
  const [sortBy, setSortBy] = useState<SortOption>('currentValue');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [expandedFundId, setExpandedFundId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = usePortfolio(defaultBenchmarkSymbol);
  const fundCards = useMemo(() => data?.fundCards ?? [], [data?.fundCards]);
  const summary = data?.summary ?? null;
  const { insights } = usePortfolioInsights(fundCards);

  const allocationPctByFundId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of insights?.fundAllocation ?? []) map.set(item.fundId, item.pct);
    return map;
  }, [insights?.fundAllocation]);

  const largestPosition = insights?.fundAllocation[0]?.shortName ?? '—';
  const topThreeShare = (insights?.fundAllocation ?? []).slice(0, 3).reduce((sum, item) => sum + item.pct, 0);
  const benchmarkXirr = summary?.marketXirr ?? 0;
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sortBy)?.label ?? 'Current value';

  const sortedFunds = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const funds = fundCards.filter((fund) => {
      if (!query) return true;
      return fund.schemeName.toLowerCase().includes(query) || fund.schemeCategory.toLowerCase().includes(query);
    });

    return [...funds].sort((a, b) => {
      switch (sortBy) {
        case 'invested':
          return sortableNumber(b.investedAmount) - sortableNumber(a.investedAmount);
        case 'xirr':
          return sortableNumber(b.returnXirr) - sortableNumber(a.returnXirr);
        case 'benchmarkLead':
          return sortableNumber(b.returnXirr - benchmarkXirr) - sortableNumber(a.returnXirr - benchmarkXirr);
        case 'alphabetical':
          return parseFundName(a.schemeName).base.localeCompare(parseFundName(b.schemeName).base);
        case 'currentValue':
        default:
          return sortableNumber(b.currentValue) - sortableNumber(a.currentValue);
      }
    });
  }, [benchmarkXirr, fundCards, searchQuery, sortBy]);

  return (
    <ClearLensScreen>
      <ClearLensHeader title="Your Funds" onPressBack={() => router.back()} />
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ClearLensColors.emerald} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <AllocationOverview
            fundCount={fundCards.length}
            topThreeShare={topThreeShare}
            largestPosition={largestPosition}
          />

          <View style={styles.controls}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color={ClearLensColors.textTertiary} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search funds"
                placeholderTextColor={ClearLensColors.textTertiary}
                style={styles.searchInput}
              />
            </View>
            <TouchableOpacity style={styles.sortButton} onPress={() => setSortMenuOpen(true)}>
              <Ionicons name="swap-vertical-outline" size={18} color={ClearLensColors.navy} />
              <Text style={styles.sortButtonText}>{sortLabel}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Funds</Text>
            <Text style={styles.listCount}>{sortedFunds.length} shown</Text>
          </View>

          {sortedFunds.map((fund) => (
            <FundListItem
              key={fund.id}
              fund={fund}
              latestNavDate={summary?.latestNavDate ?? null}
              portfolioPct={allocationPctByFundId.get(fund.id) ?? null}
              expanded={expandedFundId === fund.id}
              onToggle={() => setExpandedFundId((current) => current === fund.id ? null : fund.id)}
              onOpen={() => router.push(`/fund/${fund.id}`)}
            />
          ))}
        </ScrollView>
      )}
      <SortBottomSheet
        visible={sortMenuOpen}
        selected={sortBy}
        onSelect={setSortBy}
        onClose={() => setSortMenuOpen(false)}
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
  overviewCard: {
    gap: ClearLensSpacing.md,
  },
  screenEyebrow: {
    ...ClearLensTypography.label,
    color: ClearLensColors.textTertiary,
    textTransform: 'uppercase',
  },
  overviewGrid: {
    flexDirection: 'row',
    gap: ClearLensSpacing.sm,
  },
  overviewMetric: {
    flex: 1,
    borderRadius: ClearLensRadii.md,
    backgroundColor: ClearLensColors.surfaceSoft,
    padding: ClearLensSpacing.sm,
    gap: 4,
  },
  metricLabel: {
    ...ClearLensTypography.label,
    color: ClearLensColors.textTertiary,
    textTransform: 'uppercase',
  },
  overviewValue: {
    ...ClearLensTypography.h2,
    color: ClearLensColors.navy,
  },
  largestBox: {
    padding: ClearLensSpacing.sm,
    borderRadius: ClearLensRadii.md,
    backgroundColor: '#DFF8ED',
    gap: 4,
  },
  largestName: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  controls: {
    gap: ClearLensSpacing.sm,
  },
  searchBox: {
    minHeight: 46,
    borderRadius: ClearLensRadii.full,
    backgroundColor: ClearLensColors.surface,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    paddingHorizontal: ClearLensSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
  },
  searchInput: {
    ...ClearLensTypography.body,
    flex: 1,
    color: ClearLensColors.navy,
    paddingVertical: 0,
  },
  sortButton: {
    minHeight: 44,
    borderRadius: ClearLensRadii.full,
    backgroundColor: ClearLensColors.surface,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    paddingHorizontal: ClearLensSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ClearLensSpacing.xs,
  },
  sortButtonText: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.bold,
    color: ClearLensColors.navy,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listTitle: {
    ...ClearLensTypography.h2,
    color: ClearLensColors.navy,
  },
  listCount: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  fundCard: {
    gap: 0,
  },
  fundTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
  },
  fundMainTap: {
    flex: 1,
    flexDirection: 'row',
    gap: ClearLensSpacing.sm,
  },
  fundNameBlock: {
    flex: 1,
    gap: 3,
  },
  fundName: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  fundMeta: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  valueBlock: {
    alignItems: 'flex-end',
    gap: 3,
    minWidth: 92,
  },
  fundValue: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  shareText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  expandButton: {
    width: 38,
    height: 38,
    borderRadius: ClearLensRadii.full,
    backgroundColor: ClearLensColors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedPanel: {
    marginTop: ClearLensSpacing.md,
    paddingTop: ClearLensSpacing.md,
    borderTopWidth: 1,
    borderTopColor: ClearLensColors.borderLight,
    gap: ClearLensSpacing.md,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ClearLensSpacing.sm,
  },
  detailCell: {
    flex: 1,
    minWidth: '46%',
    padding: ClearLensSpacing.sm,
    borderRadius: ClearLensRadii.md,
    backgroundColor: ClearLensColors.surfaceSoft,
    gap: 3,
  },
  detailValue: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.bold,
  },
  detailSubvalue: {
    ...ClearLensTypography.caption,
  },
  redemptionRow: {
    flexDirection: 'row',
    gap: ClearLensSpacing.sm,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(10, 20, 48, 0.28)',
  },
  sheet: {
    backgroundColor: ClearLensColors.surface,
    borderTopLeftRadius: ClearLensRadii.xl,
    borderTopRightRadius: ClearLensRadii.xl,
    paddingTop: ClearLensSpacing.sm,
    paddingBottom: ClearLensSpacing.lg,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    ...ClearLensShadow,
  },
  sheetHandle: {
    width: 46,
    height: 4,
    borderRadius: ClearLensRadii.full,
    alignSelf: 'center',
    marginBottom: ClearLensSpacing.sm,
    backgroundColor: ClearLensColors.border,
  },
  sheetTitle: {
    ...ClearLensTypography.h2,
    color: ClearLensColors.navy,
    paddingHorizontal: ClearLensSpacing.md,
    paddingBottom: ClearLensSpacing.sm,
  },
  sheetRow: {
    minHeight: 50,
    paddingHorizontal: ClearLensSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetDivider: {
    borderTopWidth: 1,
    borderTopColor: ClearLensColors.borderLight,
  },
  sheetRowText: {
    ...ClearLensTypography.body,
    color: ClearLensColors.navy,
    fontFamily: ClearLensFonts.medium,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

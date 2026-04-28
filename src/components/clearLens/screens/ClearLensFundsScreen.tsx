import { useEffect, useMemo, useState } from 'react';
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

const CLEAR_LENS_RED = '#E5484D';

const SORT_OPTIONS: { value: SortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'currentValue', label: 'Current value', icon: 'trending-up-outline' },
  { value: 'invested', label: 'Invested', icon: 'calendar-outline' },
  { value: 'xirr', label: 'XIRR', icon: 'analytics-outline' },
  { value: 'benchmarkLead', label: 'Lead vs benchmark', icon: 'rocket-outline' },
  { value: 'alphabetical', label: 'Alphabetical', icon: 'text-outline' },
];

function sortableNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

// ---------------------------------------------------------------------------
// Allocation overview card — matches design handoff layout
// ---------------------------------------------------------------------------

function AllocationOverview({
  fundCount,
  topThreeShare,
  largestPosition,
  largestPct,
}: {
  fundCount: number;
  topThreeShare: number;
  largestPosition: string;
  largestPct: number;
}) {
  return (
    <ClearLensCard style={styles.overviewCard}>
      <Text style={styles.screenEyebrow}>Allocation overview</Text>

      {/* Two stats side-by-side with vertical divider */}
      <View style={styles.overviewStatsRow}>
        <View style={styles.overviewStat}>
          <Text style={styles.overviewValue}>{fundCount}</Text>
          <Text style={styles.overviewStatLabel}>Active funds</Text>
        </View>
        <View style={styles.overviewDivider} />
        <View style={styles.overviewStat}>
          <Text style={styles.overviewValue}>{topThreeShare.toFixed(1)}%</Text>
          <Text style={styles.overviewStatLabel}>In top 3 funds</Text>
        </View>
      </View>

      {/* Largest position inline row */}
      <View style={styles.largestRow}>
        <View style={styles.largestDot} />
        <Text style={styles.largestLabel}>Largest: </Text>
        <Text style={styles.largestName} numberOfLines={1}>{largestPosition}</Text>
        <Text style={styles.largestPct}>{largestPct.toFixed(1)}%</Text>
      </View>
    </ClearLensCard>
  );
}

// ---------------------------------------------------------------------------
// Fund card — FLFundCard layout
// Header: name + plain category text | value + "X% of portfolio"
// Footer: "Today ▼ 0.45%" inline | "XIRR 16.65% p.a." inline
// ---------------------------------------------------------------------------

function FundListItem({
  fund,
  portfolioPct,
  onPress,
  latestNavDate,
}: {
  fund: FundCardData;
  portfolioPct: number | null;
  onPress: () => void;
  latestNavDate: string | null;
}) {
  const { base, planBadge } = parseFundName(fund.schemeName);
  const dailyChangePct = fund.dailyChangePct;
  const dailyColor = (dailyChangePct ?? 0) >= 0 ? ClearLensColors.emerald : CLEAR_LENS_RED;
  const xirrColor = fund.returnXirr >= 0 ? ClearLensColors.emerald : CLEAR_LENS_RED;
  const xirrLabel = Number.isFinite(fund.returnXirr) ? `${formatXirr(fund.returnXirr)} p.a.` : '—';
  const stale = navStaleness(latestNavDate);
  const categoryText = `${fund.schemeCategory}${planBadge ? ` · ${planBadge}` : ''}`;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.76}>
      <ClearLensCard style={styles.fundCard}>
        {/* Header row */}
        <View style={styles.fundHeader}>
          <View style={styles.fundNameBlock}>
            <Text style={styles.fundName} numberOfLines={2}>{base}</Text>
            <Text style={styles.fundCategory} numberOfLines={1}>{categoryText}</Text>
          </View>
          <View style={styles.fundValueBlock}>
            <Text style={styles.fundValue}>
              {fund.currentValue != null ? formatCurrency(fund.currentValue) : 'NAV pending'}
            </Text>
            {portfolioPct != null && (
              <Text style={styles.fundAllocation}>{portfolioPct.toFixed(1)}% of portfolio</Text>
            )}
          </View>
        </View>

        {/* Footer: label + value inline on one line, no divider */}
        <View style={styles.fundFooter}>
          <View style={styles.fundFooterCell}>
            {dailyChangePct != null ? (
              <Text numberOfLines={1}>
                <Text style={styles.fundFooterLabel}>Today </Text>
                <Text style={[styles.fundFooterChange, { color: dailyColor }]}>
                  {dailyChangePct >= 0 ? '▲' : '▼'} {dailyChangePct >= 0 ? '+' : ''}{dailyChangePct.toFixed(2)}%
                  {stale.stale ? ` · ${stale.label}` : ''}
                </Text>
              </Text>
            ) : (
              <Text style={styles.fundFooterLabel}>Today —</Text>
            )}
          </View>
          <View style={[styles.fundFooterCell, styles.fundFooterCellRight]}>
            <Text numberOfLines={1}>
              <Text style={styles.fundFooterLabel}>XIRR </Text>
              <Text style={[styles.fundFooterChange, { color: xirrColor }]}>{xirrLabel}</Text>
            </Text>
          </View>
        </View>
      </ClearLensCard>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Sort bottom sheet
// ---------------------------------------------------------------------------

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
  const [draft, setDraft] = useState<SortOption>(selected);

  useEffect(() => {
    if (visible) setDraft(selected);
  }, [selected, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Sort by</Text>
          {SORT_OPTIONS.map((option, index) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.sheetOption, index > 0 && styles.sheetDivider]}
              onPress={() => setDraft(option.value)}
              activeOpacity={0.76}
            >
              <View style={styles.sheetOptionLeft}>
                <View style={styles.sheetIcon}>
                  <Ionicons name={option.icon} size={18} color={ClearLensColors.slate} />
                </View>
                <Text style={styles.sheetRowText}>{option.label}</Text>
              </View>
              <View style={[styles.radioOuter, option.value === draft && styles.radioOuterActive]}>
                {option.value === draft && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => {
              onSelect(draft);
              onClose();
            }}
            activeOpacity={0.82}
          >
            <Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function ClearLensFundsScreen() {
  const router = useRouter();
  const { defaultBenchmarkSymbol } = useAppStore();
  const [sortBy, setSortBy] = useState<SortOption>('currentValue');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = usePortfolio(defaultBenchmarkSymbol);
  const fundCards = useMemo(() => data?.fundCards ?? [], [data?.fundCards]);
  const summary = data?.summary ?? null;
  const { insights } = usePortfolioInsights(fundCards);

  const allocationPctByFundId = useMemo(() => {
    const map = new Map<string, number>();
    const totalValue = summary?.totalValue ?? 0;
    if (totalValue > 0) {
      for (const fund of fundCards) {
        if (fund.currentValue != null) {
          map.set(fund.id, (fund.currentValue / totalValue) * 100);
        }
      }
    }
    for (const item of insights?.fundAllocation ?? []) map.set(item.fundId, item.pct);
    return map;
  }, [fundCards, insights?.fundAllocation, summary?.totalValue]);

  const valueSortedFunds = useMemo(
    () => [...fundCards].sort((a, b) => sortableNumber(b.currentValue) - sortableNumber(a.currentValue)),
    [fundCards],
  );
  const largestFund = insights?.fundAllocation[0] ?? null;
  const largestPosition =
    largestFund?.shortName ??
    (valueSortedFunds[0] ? parseFundName(valueSortedFunds[0].schemeName).base : '—');
  const largestPct =
    largestFund?.pct ??
    allocationPctByFundId.get(valueSortedFunds[0]?.id ?? '') ??
    0;
  const topThreeShare = insights?.fundAllocation.length
    ? insights.fundAllocation.slice(0, 3).reduce((sum, item) => sum + item.pct, 0)
    : valueSortedFunds
      .slice(0, 3)
      .reduce((sum, fund) => sum + (allocationPctByFundId.get(fund.id) ?? 0), 0);
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
            largestPct={largestPct}
          />

          {/* Search + Sort in a single row */}
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
              <Ionicons name="swap-vertical-outline" size={16} color={ClearLensColors.navy} />
              <Text style={styles.sortButtonText}>{sortLabel}</Text>
              <Ionicons name="chevron-down" size={14} color={ClearLensColors.textTertiary} />
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
              onPress={() => router.push(`/fund/${fund.id}`)}
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingBottom: ClearLensSpacing.xxl,
    gap: ClearLensSpacing.md,
  },
  // Allocation overview
  overviewCard: {
    gap: ClearLensSpacing.md,
  },
  screenEyebrow: {
    ...ClearLensTypography.label,
    color: ClearLensColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  overviewStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewStat: {
    flex: 1,
    gap: 2,
  },
  overviewDivider: {
    width: 1,
    height: 44,
    backgroundColor: ClearLensColors.borderLight,
    marginHorizontal: ClearLensSpacing.md,
  },
  overviewValue: {
    ...ClearLensTypography.h1,
    color: ClearLensColors.navy,
  },
  overviewStatLabel: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
  },
  largestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DFF8ED',
    borderRadius: ClearLensRadii.md,
    paddingVertical: ClearLensSpacing.sm,
    paddingHorizontal: ClearLensSpacing.sm,
    gap: ClearLensSpacing.xs,
  },
  largestDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ClearLensColors.emerald,
    flexShrink: 0,
  },
  largestLabel: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
    flexShrink: 0,
  },
  largestName: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.bold,
    color: ClearLensColors.navy,
    flex: 1,
  },
  largestPct: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.bold,
    color: ClearLensColors.emerald,
    flexShrink: 0,
  },
  // Controls — single row
  controls: {
    flexDirection: 'row',
    gap: ClearLensSpacing.sm,
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    minHeight: 46,
    borderRadius: ClearLensRadii.full,
    backgroundColor: ClearLensColors.surface,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    paddingHorizontal: ClearLensSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.xs,
  },
  searchInput: {
    ...ClearLensTypography.bodySmall,
    flex: 1,
    color: ClearLensColors.navy,
    paddingVertical: 0,
  },
  sortButton: {
    minHeight: 46,
    borderRadius: ClearLensRadii.full,
    backgroundColor: ClearLensColors.surface,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    paddingHorizontal: ClearLensSpacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  sortButtonText: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.semiBold,
    color: ClearLensColors.navy,
  },
  // List header
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
  // Fund card
  fundCard: {
    gap: 0,
    padding: ClearLensSpacing.md,
    ...ClearLensShadow,
  },
  fundHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ClearLensSpacing.sm,
    marginBottom: ClearLensSpacing.sm,
  },
  fundNameBlock: {
    flex: 1,
    gap: 4,
  },
  fundName: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  fundCategory: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
  },
  fundValueBlock: {
    alignItems: 'flex-end',
    gap: 3,
    flexShrink: 0,
  },
  fundValue: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  fundAllocation: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  // Footer — label + value inline on one line
  fundFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: ClearLensSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: ClearLensColors.borderLight,
  },
  fundFooterCell: {
    flex: 1,
  },
  fundFooterCellRight: {
    alignItems: 'flex-end',
  },
  fundFooterLabel: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
  },
  fundFooterChange: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.semiBold,
  },
  // Sort sheet
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
  sheetOption: {
    minHeight: 58,
    paddingHorizontal: ClearLensSpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ClearLensSpacing.md,
  },
  sheetDivider: {
    borderTopWidth: 1,
    borderTopColor: ClearLensColors.borderLight,
  },
  sheetOptionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
  },
  sheetIcon: {
    width: 30,
    height: 30,
    borderRadius: ClearLensRadii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ClearLensColors.surfaceSoft,
  },
  sheetRowText: {
    ...ClearLensTypography.body,
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
  applyButton: {
    minHeight: 48,
    marginHorizontal: ClearLensSpacing.md,
    marginTop: ClearLensSpacing.md,
    borderRadius: ClearLensRadii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ClearLensColors.emerald,
  },
  applyButtonText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textOnDark,
    fontFamily: ClearLensFonts.bold,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

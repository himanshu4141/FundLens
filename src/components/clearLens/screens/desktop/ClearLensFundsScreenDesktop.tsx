import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ClearLensCard } from '@/src/components/clearLens/ClearLensPrimitives';
import { usePortfolio, type FundCardData } from '@/src/hooks/usePortfolio';
import { usePortfolioInsights } from '@/src/hooks/usePortfolioInsights';
import { useAppStore, BENCHMARK_OPTIONS } from '@/src/store/appStore';
import { formatCurrency } from '@/src/utils/formatting';
import { formatXirr } from '@/src/utils/xirr';
import { parseFundName } from '@/src/utils/fundName';
import { MaxContentWidth } from '@/src/components/responsive';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensSemanticColors,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';
import {
  formatClearLensCurrencyDelta,
  formatClearLensPercentDelta,
} from '@/src/utils/clearLensFormat';

type SortOption = 'currentValue' | 'invested' | 'xirr' | 'benchmarkLead' | 'dailyChange' | 'alphabetical';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'currentValue', label: 'Current value' },
  { value: 'invested', label: 'Invested' },
  { value: 'xirr', label: 'XIRR' },
  { value: 'benchmarkLead', label: 'Lead vs benchmark' },
  { value: 'dailyChange', label: '1 day change' },
  { value: 'alphabetical', label: 'Alphabetical' },
];

const CLEAR_LENS_RED = ClearLensSemanticColors.sentiment.negative;

function sortableNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

export function ClearLensFundsScreenDesktop() {
  const router = useRouter();
  const { defaultBenchmarkSymbol } = useAppStore();
  const [sortBy, setSortBy] = useState<SortOption>('currentValue');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = usePortfolio(defaultBenchmarkSymbol);
  const fundCards = useMemo(() => data?.fundCards ?? [], [data?.fundCards]);
  const summary = data?.summary ?? null;
  const { insights } = usePortfolioInsights(fundCards);
  const benchmarkXirr = summary?.marketXirr ?? 0;
  const benchmarkLabel =
    BENCHMARK_OPTIONS.find((option) => option.symbol === defaultBenchmarkSymbol)?.label ?? defaultBenchmarkSymbol;

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
        case 'dailyChange':
          return sortableNumber(b.dailyChangePct) - sortableNumber(a.dailyChangePct);
        case 'alphabetical':
          return parseFundName(a.schemeName).base.localeCompare(parseFundName(b.schemeName).base);
        case 'currentValue':
        default:
          return sortableNumber(b.currentValue) - sortableNumber(a.currentValue);
      }
    });
  }, [benchmarkXirr, fundCards, searchQuery, sortBy]);

  const ahead = sortedFunds.filter((fund) => fund.returnXirr - benchmarkXirr > 0).length;
  const behind = sortedFunds.length - ahead;

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={ClearLensColors.emerald} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.frame}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>Funds</Text>
          <Text style={styles.title}>Your Funds</Text>
          <Text style={styles.subtitle}>Search, sort, and compare every holding against {benchmarkLabel}.</Text>
        </View>

        {summary && (
          <ClearLensCard style={styles.summaryCard}>
            <View style={styles.summaryGrid}>
              <SummaryMetric label="Holdings" value={String(fundCards.length)} />
              <View style={styles.summaryDivider} />
              <SummaryMetric
                label="Portfolio value"
                value={formatCurrency(summary.totalValue)}
              />
              <View style={styles.summaryDivider} />
              <SummaryMetric
                label="Your XIRR"
                value={formatXirr(summary.xirr)}
                tone={summary.xirr - summary.marketXirr >= 0 ? 'positive' : 'negative'}
              />
              <View style={styles.summaryDivider} />
              <SummaryMetric
                label={`vs ${benchmarkLabel}`}
                value={formatXirr(summary.marketXirr)}
              />
              <View style={styles.summaryDivider} />
              <SummaryMetric
                label="Ahead / behind"
                value={`${ahead} · ${behind}`}
                tone={ahead >= behind ? 'positive' : 'negative'}
              />
            </View>
          </ClearLensCard>
        )}

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
          <View style={styles.sortRow}>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.sortChip, sortBy === option.value && styles.sortChipActive]}
                onPress={() => setSortBy(option.value)}
                activeOpacity={0.78}
              >
                <Text
                  style={[
                    styles.sortChipText,
                    sortBy === option.value && styles.sortChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>{sortedFunds.length} fund{sortedFunds.length === 1 ? '' : 's'}</Text>
          <Text style={styles.listMeta}>Click a card to open the detail page</Text>
        </View>

        <View style={styles.grid}>
          {sortedFunds.map((fund) => (
            <FundDesktopCard
              key={fund.id}
              fund={fund}
              portfolioPct={allocationPctByFundId.get(fund.id) ?? null}
              benchmarkXirr={benchmarkXirr}
              onOpen={() => router.push(`/fund/${fund.id}`)}
            />
          ))}
          {sortedFunds.length === 0 && (
            <ClearLensCard style={styles.emptyCard}>
              <Ionicons name="search-outline" size={28} color={ClearLensColors.textTertiary} />
              <Text style={styles.emptyText}>No funds match your search.</Text>
            </ClearLensCard>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  const valueColor =
    tone === 'positive' ? ClearLensColors.emerald : tone === 'negative' ? CLEAR_LENS_RED : ClearLensColors.navy;
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: valueColor }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function FundDesktopCard({
  fund,
  portfolioPct,
  benchmarkXirr,
  onOpen,
}: {
  fund: FundCardData;
  portfolioPct: number | null;
  benchmarkXirr: number;
  onOpen: () => void;
}) {
  const { base, planBadge } = parseFundName(fund.schemeName);
  const dailyColor = (fund.dailyChangePct ?? 0) >= 0 ? ClearLensColors.emerald : CLEAR_LENS_RED;
  const xirrColor = fund.returnXirr - benchmarkXirr >= 0 ? ClearLensColors.emerald : CLEAR_LENS_RED;
  const alphaPp = (fund.returnXirr - benchmarkXirr) * 100;
  const isDebtLike = /debt|liquid|gilt|income|overnight|money market|ultra short/i.test(fund.schemeCategory);
  const accentColor = isDebtLike
    ? ClearLensSemanticColors.asset.debt
    : ClearLensSemanticColors.asset.equity;

  return (
    <TouchableOpacity onPress={onOpen} activeOpacity={0.78} style={styles.cardOuter}>
      <ClearLensCard style={[styles.fundCard, { borderLeftColor: accentColor }]}>
        <View style={styles.cardTop}>
          <View style={styles.cardName}>
            <Text style={styles.cardTitle} numberOfLines={2}>{base}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {fund.schemeCategory}{planBadge ? ` · ${planBadge}` : ''}
            </Text>
          </View>
          <View
            style={[
              styles.alphaBadge,
              { backgroundColor: alphaPp >= 0 ? ClearLensSemanticColors.sentiment.positiveSurface : ClearLensSemanticColors.sentiment.negativeSurface },
            ]}
          >
            <Text style={[styles.alphaBadgeText, { color: xirrColor }]}>
              {alphaPp >= 0 ? '+' : ''}{alphaPp.toFixed(1)} pp
            </Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>Current value</Text>
            <Text style={styles.metricValue}>
              {fund.currentValue != null ? formatCurrency(fund.currentValue) : 'NAV pending'}
            </Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>XIRR</Text>
            <Text style={[styles.metricValue, { color: xirrColor }]}>{formatXirr(fund.returnXirr)}</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>Today</Text>
            <Text style={[styles.metricValue, { color: dailyColor }]}>
              {fund.dailyChangePct != null ? formatClearLensPercentDelta(fund.dailyChangePct) : '—'}
            </Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>Allocation</Text>
            <Text style={styles.metricValue}>{portfolioPct != null ? `${portfolioPct.toFixed(1)}%` : '—'}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>
            Invested {formatCurrency(fund.investedAmount)}
            {fund.currentValue != null && fund.investedAmount > 0
              ? ` · Gain ${formatClearLensCurrencyDelta(fund.currentValue - fund.investedAmount)}`
              : ''}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={ClearLensColors.textTertiary} />
        </View>
      </ClearLensCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: ClearLensColors.background,
  },
  scrollContent: {
    paddingHorizontal: ClearLensSpacing.xl,
    paddingTop: ClearLensSpacing.xl,
    paddingBottom: ClearLensSpacing.xxl,
    alignItems: 'center',
  },
  frame: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: ClearLensSpacing.md,
  },
  titleBlock: {
    gap: 4,
  },
  eyebrow: {
    ...ClearLensTypography.label,
    color: ClearLensColors.emerald,
    textTransform: 'uppercase',
  },
  title: {
    ...ClearLensTypography.h1,
    color: ClearLensColors.navy,
  },
  subtitle: {
    ...ClearLensTypography.body,
    color: ClearLensColors.textSecondary,
  },
  summaryCard: {
    paddingVertical: ClearLensSpacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  summaryMetric: {
    flex: 1,
    gap: 4,
    paddingHorizontal: ClearLensSpacing.sm,
  },
  summaryLabel: {
    ...ClearLensTypography.label,
    color: ClearLensColors.textTertiary,
    textTransform: 'uppercase',
  },
  summaryValue: {
    ...ClearLensTypography.h3,
    fontFamily: ClearLensFonts.bold,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: ClearLensColors.borderLight,
    marginHorizontal: ClearLensSpacing.sm,
  },
  controls: {
    gap: ClearLensSpacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    paddingHorizontal: ClearLensSpacing.md,
    paddingVertical: 10,
    borderRadius: ClearLensRadii.md,
    backgroundColor: ClearLensColors.surface,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
  },
  searchInput: {
    flex: 1,
    ...ClearLensTypography.body,
    color: ClearLensColors.navy,
    outlineWidth: 0,
  } as never,
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sortChip: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingVertical: 8,
    borderRadius: ClearLensRadii.full,
    backgroundColor: ClearLensColors.surfaceSoft,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
  },
  sortChipActive: {
    backgroundColor: ClearLensColors.navy,
    borderColor: ClearLensColors.navy,
  },
  sortChipText: {
    ...ClearLensTypography.caption,
    fontFamily: ClearLensFonts.semiBold,
    color: ClearLensColors.textSecondary,
  },
  sortChipTextActive: {
    color: ClearLensColors.textOnDark,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: ClearLensSpacing.sm,
  },
  listTitle: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  listMeta: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ClearLensSpacing.md,
  },
  cardOuter: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 320,
  },
  fundCard: {
    gap: ClearLensSpacing.sm,
    borderLeftWidth: 3,
    minHeight: 180,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ClearLensSpacing.sm,
  },
  cardName: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  cardMeta: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  alphaBadge: {
    paddingHorizontal: ClearLensSpacing.sm,
    paddingVertical: 4,
    borderRadius: ClearLensRadii.full,
  },
  alphaBadgeText: {
    ...ClearLensTypography.caption,
    fontFamily: ClearLensFonts.bold,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ClearLensSpacing.md,
    marginTop: 4,
  },
  metricCell: {
    minWidth: 100,
    gap: 2,
  },
  metricLabel: {
    ...ClearLensTypography.label,
    color: ClearLensColors.textTertiary,
    textTransform: 'uppercase',
  },
  metricValue: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.bold,
    color: ClearLensColors.navy,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: ClearLensSpacing.xs,
    borderTopWidth: 1,
    borderTopColor: ClearLensColors.borderLight,
  },
  footerText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textSecondary,
  },
  emptyCard: {
    width: '100%',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    paddingVertical: ClearLensSpacing.xl,
  },
  emptyText: {
    ...ClearLensTypography.body,
    color: ClearLensColors.textSecondary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: ClearLensSpacing.xl,
  },
});

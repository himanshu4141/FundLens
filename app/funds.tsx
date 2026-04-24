import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePortfolio } from '@/src/hooks/usePortfolio';
import { usePortfolioInsights } from '@/src/hooks/usePortfolioInsights';
import { useAppStore } from '@/src/store/appStore';
import { categoryColor } from '@/src/components/FundCard';
import { Sparkline } from '@/src/components/Sparkline';
import { UtilityHeader } from '@/src/components/UtilityHeader';
import { useTheme } from '@/src/context/ThemeContext';
import type { DesignVariant } from '@/src/context/ThemeContext';
import { Spacing, Radii, Typography } from '@/src/constants/theme';
import { parseFundName } from '@/src/utils/fundName';
import { formatCurrency } from '@/src/utils/formatting';
import { formatXirr } from '@/src/utils/xirr';
import { navStaleness } from '@/src/utils/navUtils';
import type { FundCardData } from '@/src/hooks/usePortfolio';
import type { InsightFundAllocation } from '@/src/types/app';

type SortOption = 'currentValue' | 'invested' | 'xirr' | 'benchmarkLead' | 'alphabetical';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'currentValue', label: 'Current value' },
  { value: 'invested', label: 'Invested' },
  { value: 'xirr', label: 'XIRR' },
  { value: 'benchmarkLead', label: 'Lead vs benchmark' },
  { value: 'alphabetical', label: 'Alphabetical' },
];

function classifyFundCategory(category: string | null): string {
  if (!category) return 'Other';
  const value = category.toLowerCase();

  if (value.includes('hybrid')) return 'Hybrid';
  if (
    value.includes('debt') ||
    value.includes('liquid') ||
    value.includes('ultra short') ||
    value.includes('short duration') ||
    value.includes('money market') ||
    value.includes('overnight')
  ) {
    return 'Debt';
  }
  if (
    value.includes('fund of funds') ||
    value.includes('fof') ||
    value.includes('overseas') ||
    value.includes('international')
  ) {
    return 'Fund of Funds';
  }
  if (value.includes('index') || value.includes('etf')) return 'Index';
  if (
    value.includes('equity') ||
    value.includes('cap') ||
    value.includes('elss') ||
    value.includes('focused') ||
    value.includes('value') ||
    value.includes('contra')
  ) {
    return 'Equity';
  }

  return category;
}

function AllocationSummaryCard({
  fundAllocation,
  fundCount,
  fundCards,
}: {
  fundAllocation: InsightFundAllocation[];
  fundCount: number;
  fundCards: FundCardData[];
}) {
  const { colors, variant } = useTheme();
  const isClearLens = variant === 'v3';
  const largest = fundAllocation[0];
  const topThreeShare = fundAllocation.slice(0, 3).reduce((sum, item) => sum + item.pct, 0);
  const categoryMix = useMemo(() => {
    const totalValue = fundCards.reduce((sum, fund) => sum + (fund.currentValue ?? 0), 0);
    if (totalValue <= 0) return [];

    const map = new Map<string, { value: number; color: string }>();
    for (const fund of fundCards) {
      const value = fund.currentValue ?? 0;
      if (value <= 0) continue;
      const label = classifyFundCategory(fund.schemeCategory);
      const existing = map.get(label);
      const color = categoryColor(colors, fund.schemeCategory);
      if (existing) {
        existing.value += value;
      } else {
        map.set(label, { value, color });
      }
    }

    return [...map.entries()]
      .map(([label, item]) => ({
        label,
        pct: (item.value / totalValue) * 100,
        color: item.color,
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 4);
  }, [colors, fundCards]);

  return (
    <View style={[styles.summaryCard, { backgroundColor: isClearLens ? colors.surfaceAlt : colors.surface, borderColor: colors.border }]}>
      <View style={styles.summaryHeader}>
        <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>Allocation overview</Text>
      </View>

      <View style={styles.allocationBar}>
        {fundAllocation.map((fund) => (
          <View
            key={fund.fundId}
            style={[styles.allocationSegment, { flex: fund.pct, backgroundColor: fund.color }]}
          />
        ))}
      </View>

      <View style={styles.summaryStatsRow}>
        <View style={[styles.summaryStat, styles.summaryStatPrimary]}>
          <Text style={[styles.summaryStatLabel, { color: colors.textTertiary }]}>Largest position</Text>
          <Text style={[styles.summaryStatValue, styles.summaryStatValueWide, { color: colors.textPrimary }]}>
            {largest ? largest.shortName : '—'}
          </Text>
          <Text style={[styles.summaryStatSubValue, { color: colors.textSecondary }]}>
            {largest ? `${largest.pct.toFixed(1)}% of portfolio` : ''}
          </Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={[styles.summaryStatLabel, { color: colors.textTertiary }]}>Top 3 share</Text>
          <Text style={[styles.summaryStatValue, { color: colors.textPrimary }]}>{topThreeShare.toFixed(1)}%</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={[styles.summaryStatLabel, { color: colors.textTertiary }]}>Active funds</Text>
          <Text style={[styles.summaryStatValue, { color: colors.textPrimary }]}>{fundCount}</Text>
        </View>
      </View>

      {categoryMix.length > 0 && (
        <View style={[styles.categorySection, { borderTopColor: colors.borderLight }]}>
          <Text style={[styles.categorySectionTitle, { color: colors.textTertiary }]}>Category mix</Text>
          <View style={styles.categoryRows}>
            {categoryMix.map((category) => (
              <View key={category.label} style={styles.categoryRow}>
                <View style={styles.categoryLabelWrap}>
                  <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                  <Text style={[styles.categoryLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                    {category.label}
                  </Text>
                </View>
                <View style={[styles.categoryTrack, { backgroundColor: isClearLens ? colors.surfaceAlt : colors.background }]}>
                  <View
                    style={[
                      styles.categoryFill,
                      { backgroundColor: category.color, width: `${Math.max(category.pct, 6)}%` },
                    ]}
                  />
                </View>
                <Text style={[styles.categoryPct, { color: colors.textPrimary }]}>
                  {category.pct.toFixed(1)}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function CompactFundRow({
  fund,
  latestNavDate,
  portfolioPct,
  expanded,
  onToggleExpand,
  onOpenFund,
}: {
  fund: FundCardData;
  latestNavDate: string | null;
  portfolioPct: number | null;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpenFund: () => void;
}) {
  const { colors, variant } = useTheme();
  const isClearLens = variant === 'v3';
  const accentColor = categoryColor(colors, fund.schemeCategory);
  const { base: fundBaseName, planBadge } = parseFundName(fund.schemeName);
  const unrealizedGain = fund.currentValue != null ? fund.currentValue - fund.investedAmount : null;
  const unrealizedPct =
    unrealizedGain != null && fund.investedAmount > 0 ? (unrealizedGain / fund.investedAmount) * 100 : null;
  const unrealizedPositive = unrealizedGain != null ? unrealizedGain >= 0 : true;
  const hasRedemptions = fund.redeemedUnits > 0;
  const stale = navStaleness(latestNavDate);

  return (
    <View style={[styles.compactCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.compactAccent, { backgroundColor: accentColor }]} />
      <View style={styles.compactInner}>
        <View style={styles.compactTopRow}>
          <TouchableOpacity style={styles.compactSummaryTap} activeOpacity={0.8} onPress={onOpenFund}>
            <View style={styles.compactNameBlock}>
              <Text style={[styles.compactName, { color: colors.textPrimary }]} numberOfLines={1}>
                {fundBaseName}
              </Text>
              <Text style={[styles.compactMeta, { color: accentColor + 'cc' }]} numberOfLines={1}>
                {fund.schemeCategory}{planBadge ? ` · ${planBadge}` : ''}
              </Text>
            </View>
            <View style={styles.compactValueBlock}>
              <Text style={[styles.compactValue, { color: colors.textPrimary }]}>
                {fund.currentValue != null ? formatCurrency(fund.currentValue) : '—'}
              </Text>
              <Text style={[styles.compactShare, { color: colors.textTertiary }]}>
                {portfolioPct != null ? `${portfolioPct.toFixed(1)}% pf` : '—'}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.expandButton, { backgroundColor: colors.background, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={onToggleExpand}
          >
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {expanded && (
          <View style={[styles.expandPanel, {
            borderTopColor: colors.border,
            backgroundColor: isClearLens ? colors.surfaceAlt : undefined,
            marginHorizontal: isClearLens ? -Spacing.md : 0,
            marginBottom: isClearLens ? -Spacing.md : 0,
            paddingHorizontal: isClearLens ? Spacing.md : 0,
            paddingBottom: isClearLens ? Spacing.md : 0,
          }]}>
            <View style={styles.expandMetricsRow}>
              <View style={styles.expandMetric}>
                <Text style={[styles.expandLabel, { color: colors.textTertiary }]}>Today</Text>
                <Text
                  style={[
                    styles.expandValue,
                    { color: (fund.dailyChangePct ?? 0) >= 0 ? colors.positive : colors.negative },
                  ]}
                >
                  {fund.dailyChangePct != null
                    ? `${fund.dailyChangePct >= 0 ? '+' : ''}${fund.dailyChangePct.toFixed(2)}% ${stale.stale ? stale.label : 'today'}`
                    : '—'}
                </Text>
              </View>
              <View style={styles.expandMetric}>
                <Text style={[styles.expandLabel, { color: colors.textTertiary }]}>XIRR</Text>
                <Text
                  style={[
                    styles.expandValue,
                    { color: fund.returnXirr >= 0 ? colors.positive : colors.negative },
                  ]}
                >
                  {Number.isFinite(fund.returnXirr) ? `${formatXirr(fund.returnXirr)} XIRR` : '—'}
                </Text>
              </View>
            </View>

            <View style={styles.expandMetricsRow}>
              <View style={styles.expandMetric}>
                <Text style={[styles.expandLabel, { color: colors.textTertiary }]}>Invested</Text>
                <Text style={[styles.expandValue, { color: colors.textPrimary }]}>
                  {formatCurrency(fund.investedAmount)}
                </Text>
              </View>
              <View style={styles.expandMetric}>
                <Text style={[styles.expandLabel, { color: colors.textTertiary }]}>Gain / Loss</Text>
                <Text
                  style={[
                    styles.expandValue,
                    { color: unrealizedPositive ? colors.positive : colors.negative },
                  ]}
                >
                  {unrealizedGain != null
                    ? `${unrealizedPositive ? '+' : ''}${formatCurrency(Math.abs(unrealizedGain))} (${unrealizedPositive ? '+' : ''}${unrealizedPct!.toFixed(1)}%)`
                    : '—'}
                </Text>
              </View>
            </View>

            {hasRedemptions && (
              <View style={styles.expandMetricsRow}>
                <View style={styles.expandMetric}>
                  <Text style={[styles.expandLabel, { color: colors.textTertiary }]}>Redeemed</Text>
                  <Text style={[styles.expandValue, { color: colors.textPrimary }]}>
                    {formatCurrency(fund.realizedAmount)}
                  </Text>
                </View>
                <View style={styles.expandMetric}>
                  <Text style={[styles.expandLabel, { color: colors.textTertiary }]}>Booked P&amp;L</Text>
                  <Text
                    style={[
                      styles.expandValue,
                      { color: fund.realizedGain >= 0 ? colors.positive : colors.negative },
                    ]}
                  >
                    {fund.realizedGain >= 0 ? '+' : ''}
                    {formatCurrency(Math.abs(fund.realizedGain))}
                  </Text>
                </View>
              </View>
            )}

            {fund.navHistory30d.length >= 2 && (
              <View style={styles.expandSparklineRow}>
                <Text style={[styles.expandLabel, { color: colors.textTertiary }]}>30D</Text>
                <Sparkline
                  data={fund.navHistory30d.map((point) => point.value)}
                  color={fund.returnXirr >= 0 ? colors.positive : colors.negative}
                  width={120}
                  height={32}
                />
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

export default function FundsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { defaultBenchmarkSymbol } = useAppStore();
  const [sortBy, setSortBy] = useState<SortOption>('currentValue');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [expandedFundId, setExpandedFundId] = useState<string | null>(null);

  const { data, isLoading } = usePortfolio(defaultBenchmarkSymbol);
  const fundCards = useMemo(() => data?.fundCards ?? [], [data?.fundCards]);
  const summary = data?.summary ?? null;

  const { insights } = usePortfolioInsights(fundCards);
  const benchmarkXirr = summary?.marketXirr ?? 0;
  const allocationPctByFundId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of insights?.fundAllocation ?? []) {
      map.set(item.fundId, item.pct);
    }
    return map;
  }, [insights?.fundAllocation]);

  function sortableNumber(value: number | null | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
  }

  const sortedFundCards = useMemo(() => {
    const funds = [...fundCards];
    const benchmarkBase = Number.isFinite(benchmarkXirr) ? benchmarkXirr : 0;
    const benchmarkLeadValue = (fundXirr: number): number => {
      if (!Number.isFinite(fundXirr)) return Number.NEGATIVE_INFINITY;
      return fundXirr - benchmarkBase;
    };

    switch (sortBy) {
      case 'invested':
        return funds.sort((a, b) => sortableNumber(b.investedAmount) - sortableNumber(a.investedAmount));
      case 'xirr':
        return funds.sort((a, b) => sortableNumber(b.returnXirr) - sortableNumber(a.returnXirr));
      case 'benchmarkLead':
        return funds.sort((a, b) => benchmarkLeadValue(b.returnXirr) - benchmarkLeadValue(a.returnXirr));
      case 'alphabetical':
        return funds.sort((a, b) =>
          parseFundName(a.schemeName).base.localeCompare(parseFundName(b.schemeName).base),
        );
      case 'currentValue':
      default:
        return funds.sort((a, b) => sortableNumber(b.currentValue) - sortableNumber(a.currentValue));
    }
  }, [benchmarkXirr, fundCards, sortBy]);

  const sortLabel = SORT_OPTIONS.find((option) => option.value === sortBy)?.label ?? 'Current value';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <UtilityHeader title="Your Funds" />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {insights && (
            <AllocationSummaryCard
              fundAllocation={insights.fundAllocation}
              fundCount={fundCards.length}
              fundCards={fundCards}
            />
          )}

          <View style={styles.listHeader}>
            <Text style={[styles.listTitle, { color: colors.textPrimary }]}>Your Funds</Text>
            <View style={styles.listMeta}>
              <Text style={[styles.listCount, { color: colors.textTertiary }]}>
                {fundCards.length} fund{fundCards.length !== 1 ? 's' : ''}
              </Text>
              <TouchableOpacity
                style={[styles.sortButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setSortMenuOpen(true)}
                activeOpacity={0.75}
              >
                <Text style={[styles.sortButtonText, { color: colors.textPrimary }]}>
                  Sort: {sortLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {sortedFundCards.map((fund) => (
            <CompactFundRow
              key={fund.id}
              fund={fund}
              latestNavDate={summary?.latestNavDate ?? null}
              portfolioPct={allocationPctByFundId.get(fund.id) ?? null}
              expanded={expandedFundId === fund.id}
              onToggleExpand={() => {
                setExpandedFundId((current) => (current === fund.id ? null : fund.id));
              }}
              onOpenFund={() => router.push(`/fund/${fund.id}`)}
            />
          ))}

          <View style={styles.bottomPad} />
        </ScrollView>
      )}

      <Modal
        visible={sortMenuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSortMenuOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSortMenuOpen(false)}>
          <Pressable
            style={[styles.sortSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sortSheetTitle, { color: colors.textPrimary }]}>Sort funds by</Text>
            {SORT_OPTIONS.map((option, index) => (
              <TouchableOpacity
                key={option.value}
                style={styles.sortOption}
                onPress={() => {
                  setSortBy(option.value);
                  setSortMenuOpen(false);
                }}
                activeOpacity={0.75}
              >
                <Text style={[styles.sortOptionText, { color: colors.textPrimary }]}>{option.label}</Text>
                {sortBy === option.value && (
                  <Text style={[styles.sortSelected, { color: colors.primary }]}>Selected</Text>
                )}
                {index < SORT_OPTIONS.length - 1 && (
                  <View style={[styles.sortDivider, { backgroundColor: colors.border }]} />
                )}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
  },
  summaryHeader: {
    marginBottom: Spacing.sm + 2,
  },
  summaryTitle: {
    ...Typography.h3,
    fontWeight: '700',
  },
  allocationBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: Radii.full,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  allocationSegment: {
    height: '100%',
  },
  summaryStatsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  summaryStat: {
    flex: 1,
    gap: 4,
  },
  summaryStatPrimary: {
    flex: 1.7,
  },
  summaryStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryStatValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  summaryStatValueWide: {
    lineHeight: 20,
  },
  summaryStatSubValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  categorySection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  categorySectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  categoryRows: {
    gap: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  categoryLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 120,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoryTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  categoryFill: {
    height: '100%',
    borderRadius: 999,
  },
  categoryPct: {
    width: 48,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
  },
  listHeader: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  listMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  listTitle: {
    ...Typography.h3,
    fontWeight: '700',
  },
  listCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  sortButton: {
    borderWidth: 1,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 7,
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    justifyContent: 'flex-end',
  },
  sortSheet: {
    borderWidth: 1,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    overflow: 'hidden',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  sortSheetTitle: {
    ...Typography.h3,
    fontWeight: '700',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  sortOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    position: 'relative',
  },
  sortOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sortSelected: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  sortDivider: {
    position: 'absolute',
    left: Spacing.sm,
    right: Spacing.sm,
    bottom: 0,
    height: 1,
  },
  compactCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radii.lg,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  compactAccent: {
    width: 4,
  },
  compactInner: {
    flex: 1,
    padding: Spacing.md,
    gap: 10,
  },
  compactTopRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  compactSummaryTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  compactNameBlock: {
    flex: 1,
    gap: 3,
  },
  compactName: {
    fontSize: 15,
    fontWeight: '700',
  },
  compactMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  compactValueBlock: {
    alignItems: 'flex-end',
    gap: 3,
  },
  compactValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  compactShare: {
    fontSize: 11,
    fontWeight: '600',
  },
  expandButton: {
    width: 34,
    height: 34,
    borderRadius: Radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandPanel: {
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 10,
  },
  expandMetricsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  expandMetric: {
    flex: 1,
    gap: 3,
  },
  expandLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  expandValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  expandSparklineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomPad: { height: 32 },
});

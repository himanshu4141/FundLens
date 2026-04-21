import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { usePortfolio } from '@/src/hooks/usePortfolio';
import { usePortfolioInsights } from '@/src/hooks/usePortfolioInsights';
import { useAppStore } from '@/src/store/appStore';
import { FundCard } from '@/src/components/FundCard';
import { UtilityHeader } from '@/src/components/UtilityHeader';
import { useTheme } from '@/src/context/ThemeContext';
import { Spacing, Radii, Typography } from '@/src/constants/theme';
import { parseFundName } from '@/src/utils/fundName';
import type { InsightFundAllocation } from '@/src/types/app';

type SortOption = 'currentValue' | 'invested' | 'xirr' | 'benchmarkLead' | 'alphabetical';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'currentValue', label: 'Current value' },
  { value: 'invested', label: 'Invested' },
  { value: 'xirr', label: 'XIRR' },
  { value: 'benchmarkLead', label: 'Lead vs benchmark' },
  { value: 'alphabetical', label: 'Alphabetical' },
];

function AllocationSummaryCard({
  fundAllocation,
  fundCount,
}: {
  fundAllocation: InsightFundAllocation[];
  fundCount: number;
}) {
  const { colors } = useTheme();
  const largest = fundAllocation[0];
  const topThreeShare = fundAllocation.slice(0, 3).reduce((sum, item) => sum + item.pct, 0);

  return (
    <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.summaryHeader}>
        <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>Allocation overview</Text>
        <Text style={[styles.summaryCaption, { color: colors.textTertiary }]}>
          Color-coded by holding size
        </Text>
      </View>

      <View style={styles.allocationBar}>
        {fundAllocation.slice(0, 12).map((fund) => (
          <View
            key={fund.fundId}
            style={[styles.allocationSegment, { flex: fund.pct, backgroundColor: fund.color }]}
          />
        ))}
      </View>

      <View style={styles.summaryStatsRow}>
        <View style={styles.summaryStat}>
          <Text style={[styles.summaryStatLabel, { color: colors.textTertiary }]}>Largest position</Text>
          <Text style={[styles.summaryStatValue, { color: colors.textPrimary }]} numberOfLines={1}>
            {largest ? `${largest.shortName} · ${largest.pct.toFixed(1)}%` : '—'}
          </Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={[styles.summaryStatLabel, { color: colors.textTertiary }]}>Top 3 share</Text>
          <Text style={[styles.summaryStatValue, { color: colors.textPrimary }]}>
            {topThreeShare.toFixed(1)}%
          </Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={[styles.summaryStatLabel, { color: colors.textTertiary }]}>Active funds</Text>
          <Text style={[styles.summaryStatValue, { color: colors.textPrimary }]}>{fundCount}</Text>
        </View>
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
            <FundCard
              key={fund.id}
              fund={fund}
              latestNavDate={summary?.latestNavDate ?? null}
              portfolioPct={allocationPctByFundId.get(fund.id) ?? null}
              onPress={() => router.push(`/fund/${fund.id}`)}
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
    gap: 2,
    marginBottom: Spacing.md,
  },
  summaryTitle: {
    ...Typography.h3,
    fontWeight: '700',
  },
  summaryCaption: {
    fontSize: 12,
    fontWeight: '600',
  },
  allocationBar: {
    flexDirection: 'row',
    height: 10,
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
  },
  summaryStat: {
    flex: 1,
    gap: 4,
  },
  summaryStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryStatValue: {
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
  bottomPad: { height: 32 },
});

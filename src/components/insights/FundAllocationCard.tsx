import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { useTheme } from '@/src/context/ThemeContext';
import { Spacing, Radii, Typography } from '@/src/constants/theme';
import { formatCurrency } from '@/src/utils/formatting';
import type { InsightFundAllocation } from '@/src/types/app';

interface Props {
  fundAllocation: InsightFundAllocation[];
  totalValue: number;
}

export function FundAllocationCard({ fundAllocation }: Props) {
  const { colors } = useTheme();

  const pieData = fundAllocation.map((f) => ({
    value: f.pct,
    color: f.color,
  }));

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Fund Allocation</Text>

      <View style={styles.chartRow}>
        <PieChart
          data={pieData}
          donut
          radius={52}
          innerRadius={34}
          strokeWidth={0}
          focusOnPress={false}
        />
        <View style={styles.legend}>
          {fundAllocation.slice(0, 6).map((f) => (
            <View key={f.fundId} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: f.color }]} />
              <Text style={[styles.legendLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {f.shortName}
              </Text>
              <Text style={[styles.legendPct, { color: colors.textPrimary }]}>
                {f.pct.toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {fundAllocation.map((f) => (
        <View key={f.fundId} style={[styles.tableRow, { borderTopColor: colors.borderLight }]}>
          <View style={[styles.dot, { backgroundColor: f.color }]} />
          <Text style={[styles.fundName, { color: colors.textPrimary }]} numberOfLines={1}>
            {f.shortName}
          </Text>
          <Text style={[styles.fundValue, { color: colors.textSecondary }]}>
            {formatCurrency(f.value)}
          </Text>
          <Text style={[styles.fundPct, { color: colors.textPrimary }]}>
            {f.pct.toFixed(1)}%
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  legend: {
    flex: 1,
    gap: Spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  legendLabel: {
    ...Typography.bodySmall,
    flex: 1,
  },
  legendPct: {
    ...Typography.bodySmall,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginBottom: Spacing.xs,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  fundName: {
    ...Typography.bodySmall,
    flex: 1,
    fontWeight: '500',
  },
  fundValue: {
    ...Typography.bodySmall,
    minWidth: 60,
    textAlign: 'right',
  },
  fundPct: {
    ...Typography.bodySmall,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
});

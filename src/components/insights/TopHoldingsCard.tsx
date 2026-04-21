import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Spacing, Radii, Typography } from '@/src/constants/theme';
import { formatCurrency } from '@/src/utils/formatting';
import type { InsightHolding } from '@/src/types/app';

interface Props {
  holdings: InsightHolding[];
  fundCount: number;
}

export function TopHoldingsCard({ holdings, fundCount }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Top Holdings</Text>
      <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
        Aggregated across {fundCount} fund{fundCount !== 1 ? 's' : ''} · stock names normalised
      </Text>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.colStock, { color: colors.textTertiary }]}>STOCK</Text>
        <Text style={[styles.colValue, { color: colors.textTertiary }]}>VALUE</Text>
        <Text style={[styles.colPct, { color: colors.textTertiary }]}>PORTFOLIO WT.</Text>
      </View>

      {holdings.map((h, idx) => (
        <View key={h.isin || h.name} style={[styles.tableRow, { borderTopColor: colors.borderLight }]}>
          <View style={styles.stockCell}>
            <Text style={[styles.rankNum, { color: colors.textTertiary }]}>{idx + 1}</Text>
            <Text style={[styles.stockName, { color: colors.textPrimary }]} numberOfLines={2}>
              {h.name}
            </Text>
          </View>
          <Text style={[styles.valueText, { color: colors.textSecondary }]}>
            {formatCurrency(h.value)}
          </Text>
          <Text style={[styles.pctText, { color: colors.textPrimary }]}>
            {h.portfolioWeight.toFixed(2)}%
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
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    ...Typography.bodySmall,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  divider: {
    height: 1,
    marginBottom: Spacing.xs,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  colStock: {
    ...Typography.caption,
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  colValue: {
    ...Typography.caption,
    width: 80,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  colPct: {
    ...Typography.caption,
    width: 88,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  stockCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  rankNum: {
    ...Typography.caption,
    marginTop: 2,
    minWidth: 18,
  },
  stockName: {
    ...Typography.bodySmall,
    fontWeight: '600',
    flex: 1,
  },
  valueText: {
    ...Typography.bodySmall,
    width: 80,
    textAlign: 'right',
    fontWeight: '600',
  },
  pctText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    width: 88,
    textAlign: 'right',
  },
});

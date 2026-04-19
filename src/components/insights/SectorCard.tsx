import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { useTheme } from '@/src/context/ThemeContext';
import { Spacing, Radii, Typography } from '@/src/constants/theme';
import { formatCurrency } from '@/src/utils/formatting';

interface SectorRow {
  sector: string;
  weight: number;
  value: number;
}

interface Props {
  sectors: SectorRow[];
  totalValue: number;
}

// Fixed colour palette for consistent sector-to-colour mapping across renders
const SECTOR_COLORS = [
  '#3b82f6', // Financial — blue
  '#f97316', // Consumer Disc. — orange
  '#22c55e', // Healthcare — green
  '#14b8a6', // Industrials — teal
  '#a855f7', // Technology — purple
  '#ef4444', // Energy & Utilities — red
  '#8b5cf6', // Materials — violet
  '#84cc16', // Consumer Staples — lime
  '#06b6d4', // Telecom — cyan
  '#f59e0b', // Real Estate — amber
  '#ec4899', // Others — pink
  '#6366f1', // Diversified — indigo
];

export function SectorCard({ sectors, totalValue }: Props) {
  const { colors } = useTheme();

  const coloredSectors = sectors.map((s, i) => ({
    ...s,
    color: SECTOR_COLORS[i % SECTOR_COLORS.length],
  }));

  const pieData = coloredSectors.map((s) => ({ value: s.weight, color: s.color }));

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Sector Break-up</Text>

      {/* Donut + legend grid */}
      <View style={styles.chartRow}>
        <PieChart
          data={pieData}
          donut
          radius={56}
          innerRadius={36}
          strokeWidth={0}
          focusOnPress={false}
        />
        <View style={styles.legendGrid}>
          {coloredSectors.slice(0, 8).map((s) => (
            <View key={s.sector} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]} numberOfLines={1}>
                {s.sector} ({s.weight.toFixed(1)}%)
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Ranked table */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.tableHeader}>
        <Text style={[styles.colNum, { color: colors.textTertiary }]}>#</Text>
        <Text style={[styles.colSector, { color: colors.textTertiary }]}>SECTOR</Text>
        <Text style={[styles.colWeight, { color: colors.textTertiary }]}>WEIGHT</Text>
        <Text style={[styles.colExposure, { color: colors.textTertiary }]}>₹ EXPOSURE</Text>
      </View>

      {coloredSectors.map((s, idx) => (
        <View key={s.sector} style={[styles.tableRow, { borderTopColor: colors.borderLight }]}>
          <Text style={[styles.rowNum, { color: colors.textTertiary }]}>{idx + 1}</Text>
          <View style={styles.sectorBadge}>
            <View style={[styles.badgeDot, { backgroundColor: s.color }]} />
            <Text style={[styles.badgeText, { color: s.color }]} numberOfLines={1}>
              {s.sector}
            </Text>
          </View>
          <Text style={[styles.rowWeight, { color: colors.textPrimary }]}>
            {s.weight.toFixed(1)}%
          </Text>
          <Text style={[styles.rowExposure, { color: colors.textPrimary }]}>
            {formatCurrency(s.value)}
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
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  legendGrid: {
    flex: 1,
    gap: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '400',
    flex: 1,
  },
  divider: {
    height: 1,
    marginBottom: Spacing.xs,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  colNum: {
    ...Typography.caption,
    width: 20,
    textTransform: 'uppercase',
  },
  colSector: {
    ...Typography.caption,
    flex: 1,
    textTransform: 'uppercase',
  },
  colWeight: {
    ...Typography.caption,
    width: 52,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  colExposure: {
    ...Typography.caption,
    width: 64,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  rowNum: {
    ...Typography.bodySmall,
    width: 20,
  },
  sectorBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  rowWeight: {
    ...Typography.bodySmall,
    fontWeight: '700',
    width: 52,
    textAlign: 'right',
  },
  rowExposure: {
    ...Typography.bodySmall,
    fontWeight: '600',
    width: 64,
    textAlign: 'right',
  },
});

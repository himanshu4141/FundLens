import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { Spacing, Radii, Typography } from '@/src/constants/theme';
import { formatCurrency } from '@/src/utils/formatting';
import type { InsightDebtFund } from '@/src/types/app';

interface Props {
  totalValue: number;
  debtPct: number;
  cashPct: number;
  debtFunds: InsightDebtFund[];
}

const DEBT_COLOR = '#3b82f6';
const CASH_COLOR = '#f97316';

export function DebtCard({ totalValue, debtPct, cashPct, debtFunds }: Props) {
  const { colors } = useTheme();

  const debtValue = (debtPct / 100) * totalValue;
  const cashValue = (cashPct / 100) * totalValue;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Debt & Cash</Text>

      {/* Summary row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <View style={[styles.summaryAccent, { backgroundColor: DEBT_COLOR }]} />
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
            {debtPct.toFixed(1)}%
          </Text>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Debt</Text>
          <Text style={[styles.summaryAmount, { color: colors.textSecondary }]}>
            {formatCurrency(debtValue)}
          </Text>
        </View>

        <View style={[styles.summaryDivider, { backgroundColor: colors.borderLight }]} />

        <View style={styles.summaryItem}>
          <View style={[styles.summaryAccent, { backgroundColor: CASH_COLOR }]} />
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
            {cashPct.toFixed(1)}%
          </Text>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Cash & Equiv.</Text>
          <Text style={[styles.summaryAmount, { color: colors.textSecondary }]}>
            {formatCurrency(cashValue)}
          </Text>
        </View>
      </View>

      {/* Fund breakdown — only if any fund has debt */}
      {debtFunds.length > 0 && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.tableHeader}>
            <Text style={[styles.colFund, { color: colors.textTertiary }]}>FUND</Text>
            <Text style={[styles.colDebt, { color: colors.textTertiary }]}>DEBT %</Text>
            <Text style={[styles.colCash, { color: colors.textTertiary }]}>CASH %</Text>
          </View>

          {debtFunds.map((f) => (
            <View key={f.fundId} style={[styles.tableRow, { borderTopColor: colors.borderLight }]}>
              <Text
                style={[styles.fundName, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {f.shortName}
              </Text>
              <Text style={[styles.debtCell, { color: DEBT_COLOR }]}>
                {f.debtPct > 0 ? `${f.debtPct.toFixed(1)}%` : '—'}
              </Text>
              <Text style={[styles.cashCell, { color: CASH_COLOR }]}>
                {f.cashPct > 0 ? `${f.cashPct.toFixed(1)}%` : '—'}
              </Text>
            </View>
          ))}

          <Text style={[styles.footnote, { color: colors.textTertiary }]}>
            Percentages show each fund&apos;s internal allocation, not portfolio weight.
          </Text>
        </>
      )}
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
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.sm,
  },
  summaryAccent: {
    width: 24,
    height: 3,
    borderRadius: 2,
    marginBottom: Spacing.xs,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  summaryLabel: {
    ...Typography.bodySmall,
  },
  summaryAmount: {
    ...Typography.bodySmall,
    fontWeight: '500',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: Spacing.sm,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  tableHeader: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  colFund: {
    ...Typography.caption,
    flex: 1,
    textTransform: 'uppercase',
  },
  colDebt: {
    ...Typography.caption,
    width: 56,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  colCash: {
    ...Typography.caption,
    width: 56,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fundName: {
    ...Typography.bodySmall,
    fontWeight: '500',
    flex: 1,
  },
  debtCell: {
    ...Typography.bodySmall,
    fontWeight: '700',
    width: 56,
    textAlign: 'right',
  },
  cashCell: {
    ...Typography.bodySmall,
    fontWeight: '700',
    width: 56,
    textAlign: 'right',
  },
  footnote: {
    ...Typography.caption,
    marginTop: Spacing.sm,
    lineHeight: 16,
  },
});

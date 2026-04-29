import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ClearLensCard } from '@/src/components/clearLens/ClearLensPrimitives';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';
import { formatCurrency } from '@/src/utils/formatting';
import {
  getCurrentFinancialYear,
  getFinancialYearShortLabel,
  type AnnualMoneyFlow,
  type MoneyTrailSummary,
} from '@/src/utils/moneyTrail';

export function MoneyTrailPreviewCard({
  annualFlows,
  summary,
  onPress,
}: {
  annualFlows: AnnualMoneyFlow[];
  summary: MoneyTrailSummary;
  onPress: () => void;
}) {
  const currentFinancialYear = getCurrentFinancialYear();
  const currentFlow =
    annualFlows.find((flow) => flow.financialYear === currentFinancialYear) ??
    annualFlows[annualFlows.length - 1] ??
    null;
  const chartFlows = annualFlows.slice(-5);
  const maxFlow = Math.max(
    1,
    ...chartFlows.flatMap((flow) => [flow.invested, flow.withdrawn, Math.abs(flow.netInvested)]),
  );

  return (
    <ClearLensCard style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Money Trail</Text>
          <Text style={styles.subtitle}>Your investments and withdrawals by financial year</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="trail-sign-outline" size={20} color={ClearLensColors.emerald} />
        </View>
      </View>

      {currentFlow ? (
        <>
          <View style={styles.currentSummary}>
            <View>
              <Text style={styles.fyLabel}>{currentFlow.financialYear}</Text>
              <Text style={styles.netValue}>{formatCurrency(currentFlow.netInvested)}</Text>
              <Text style={styles.netLabel}>Net invested</Text>
            </View>
            <View style={styles.currentBreakdown}>
              <View style={styles.breakdownItem}>
                <Text style={styles.investedValue}>{formatCurrency(currentFlow.invested)}</Text>
                <Text style={styles.breakdownLabel}>Invested</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.withdrawnValue}>{formatCurrency(currentFlow.withdrawn)}</Text>
                <Text style={styles.breakdownLabel}>Withdrawn</Text>
              </View>
            </View>
          </View>

          {chartFlows.length > 0 && (
            <View style={styles.chartRow}>
              {chartFlows.map((flow) => {
                const investedHeight = Math.max(8, (flow.invested / maxFlow) * 62);
                const withdrawnHeight = flow.withdrawn > 0 ? Math.max(3, (flow.withdrawn / maxFlow) * 30) : 0;
                return (
                  <View key={flow.financialYear} style={styles.barWrap}>
                    <View style={styles.barTrack}>
                      <View style={[styles.barInvested, { height: investedHeight }]} />
                      {withdrawnHeight > 0 && (
                        <View style={[styles.barWithdrawn, { height: withdrawnHeight }]} />
                      )}
                    </View>
                    <Text style={styles.barLabel}>{getFinancialYearShortLabel(flow.financialYear)}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.totalsRow}>
            <PreviewTotal label="Total invested" value={summary.totalInvested} tone="in" />
            <View style={styles.totalDivider} />
            <PreviewTotal label="Total withdrawn" value={summary.totalWithdrawn} tone="out" />
            <View style={styles.totalDivider} />
            <PreviewTotal label="Net invested" value={summary.netInvested} tone="net" />
          </View>
        </>
      ) : (
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Text style={styles.emptyText}>Upload your CAS statement to see your complete Money Trail.</Text>
        </View>
      )}

      <TouchableOpacity style={styles.cta} onPress={onPress} activeOpacity={0.78}>
        <Text style={styles.ctaText}>View all</Text>
        <Ionicons name="arrow-forward" size={17} color={ClearLensColors.emeraldDeep} />
      </TouchableOpacity>
    </ClearLensCard>
  );
}

function PreviewTotal({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'in' | 'out' | 'net';
}) {
  const color = tone === 'out' ? ClearLensColors.slate : ClearLensColors.navy;
  return (
    <View style={styles.totalItem}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={[styles.totalValue, { color }]}>{formatCurrency(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: ClearLensSpacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ClearLensSpacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  title: {
    ...ClearLensTypography.h2,
    color: ClearLensColors.navy,
  },
  subtitle: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: ClearLensRadii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ClearLensColors.mint50,
  },
  currentSummary: {
    minHeight: 96,
    padding: ClearLensSpacing.md,
    borderRadius: ClearLensRadii.md,
    backgroundColor: ClearLensColors.surfaceSoft,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: ClearLensSpacing.md,
  },
  fyLabel: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
    fontFamily: ClearLensFonts.semiBold,
  },
  netValue: {
    ...ClearLensTypography.h1,
    color: ClearLensColors.emeraldDeep,
    marginTop: 4,
  },
  netLabel: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textSecondary,
  },
  currentBreakdown: {
    justifyContent: 'center',
    gap: ClearLensSpacing.sm,
    minWidth: 96,
  },
  breakdownItem: {
    alignItems: 'flex-end',
    gap: 2,
  },
  investedValue: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.emeraldDeep,
  },
  withdrawnValue: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.amber,
  },
  breakdownLabel: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  chartRow: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: ClearLensSpacing.sm,
  },
  barWrap: {
    flex: 1,
    alignItems: 'center',
    gap: ClearLensSpacing.xs,
  },
  barTrack: {
    height: 76,
    width: 24,
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: ClearLensColors.border,
  },
  barInvested: {
    width: 24,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: ClearLensColors.emerald,
  },
  barWithdrawn: {
    width: 24,
    backgroundColor: ClearLensColors.amber,
  },
  barLabel: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingTop: ClearLensSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: ClearLensColors.borderLight,
  },
  totalItem: {
    flex: 1,
    gap: 3,
  },
  totalDivider: {
    width: 1,
    marginHorizontal: ClearLensSpacing.sm,
    backgroundColor: ClearLensColors.borderLight,
  },
  totalLabel: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  totalValue: {
    ...ClearLensTypography.h3,
  },
  emptyBlock: {
    paddingVertical: ClearLensSpacing.md,
    gap: ClearLensSpacing.xs,
  },
  emptyTitle: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  emptyText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textSecondary,
  },
  cta: {
    minHeight: 38,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.xs,
  },
  ctaText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.emeraldDeep,
    fontFamily: ClearLensFonts.bold,
  },
});

import { useMemo, useState } from 'react';
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
} from '@/src/utils/moneyTrail';

export function MoneyTrailPreviewCard({
  annualFlows,
  onPress,
}: {
  annualFlows: AnnualMoneyFlow[];
  onPress: () => void;
}) {
  const chartFlows = useMemo(() => annualFlows.slice(-5), [annualFlows]);
  const currentFinancialYear = getCurrentFinancialYear();
  const defaultFy =
    chartFlows.find((flow) => flow.financialYear === currentFinancialYear)?.financialYear ??
    chartFlows[chartFlows.length - 1]?.financialYear ??
    null;
  const [selectedFy, setSelectedFy] = useState<string | null>(null);
  const activeFy = selectedFy ?? defaultFy;
  const activeFlow = activeFy ? chartFlows.find((flow) => flow.financialYear === activeFy) ?? null : null;
  const maxFlow = Math.max(
    1,
    ...chartFlows.flatMap((flow) => [flow.invested, flow.withdrawn, Math.abs(flow.netInvested)]),
  );

  return (
    <ClearLensCard style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Money Trail</Text>
          <Text style={styles.subtitle}>Tap a year to see invested vs withdrawn</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="trail-sign-outline" size={20} color={ClearLensColors.emerald} />
        </View>
      </View>

      {activeFlow ? (
        <>
          <View style={styles.currentSummary}>
            <View>
              <Text style={styles.fyLabel}>{activeFlow.financialYear}</Text>
              <Text style={styles.netValue}>{formatCurrency(activeFlow.netInvested)}</Text>
              <Text style={styles.netLabel}>Net invested</Text>
            </View>
            <View style={styles.currentBreakdown}>
              <View style={styles.breakdownItem}>
                <Text style={styles.investedValue}>{formatCurrency(activeFlow.invested)}</Text>
                <Text style={styles.breakdownLabel}>Invested</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.withdrawnValue}>{formatCurrency(activeFlow.withdrawn)}</Text>
                <Text style={styles.breakdownLabel}>Withdrawn</Text>
              </View>
            </View>
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: ClearLensColors.emerald }]} />
              <Text style={styles.legendText}>Invested</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: ClearLensColors.amber }]} />
              <Text style={styles.legendText}>Withdrawn</Text>
            </View>
          </View>

          {chartFlows.length > 0 && (
            <View style={styles.chartRow}>
              {chartFlows.map((flow) => {
                const investedHeight = Math.max(8, (flow.invested / maxFlow) * 62);
                const withdrawnHeight = flow.withdrawn > 0 ? Math.max(3, (flow.withdrawn / maxFlow) * 30) : 0;
                const isActive = flow.financialYear === activeFy;
                return (
                  <TouchableOpacity
                    key={flow.financialYear}
                    style={styles.barWrap}
                    onPress={() => setSelectedFy(flow.financialYear)}
                    activeOpacity={0.7}
                    accessibilityLabel={`${flow.financialYear}: invested ${formatCurrency(flow.invested)}, withdrawn ${formatCurrency(flow.withdrawn)}`}
                  >
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barInvested,
                          { height: investedHeight },
                          !isActive && styles.barDim,
                        ]}
                      />
                      {withdrawnHeight > 0 && (
                        <View
                          style={[
                            styles.barWithdrawn,
                            { height: withdrawnHeight },
                            !isActive && styles.barDim,
                          ]}
                        />
                      )}
                    </View>
                    <Text style={[styles.barLabel, isActive && styles.barLabelActive]}>
                      {getFinancialYearShortLabel(flow.financialYear)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
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
  barDim: {
    opacity: 0.42,
  },
  barLabel: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  barLabelActive: {
    color: ClearLensColors.navy,
    fontFamily: ClearLensFonts.bold,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: ClearLensSpacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
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

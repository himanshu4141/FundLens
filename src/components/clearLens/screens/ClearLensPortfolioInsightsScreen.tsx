import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
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
import { usePortfolio } from '@/src/hooks/usePortfolio';
import { usePortfolioInsights } from '@/src/hooks/usePortfolioInsights';
import { useAppStore } from '@/src/store/appStore';
import { formatCurrency } from '@/src/utils/formatting';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';

function formatDisclosureDate(value: string | null | undefined): string {
  if (!value) return 'Disclosure pending';
  return new Date(value).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function ExposureCard({
  title,
  rows,
  total,
  disclosure,
}: {
  title: string;
  rows: { label: string; pct: number; value?: number; color: string }[];
  total?: number;
  disclosure?: string;
}) {
  const max = Math.max(...rows.map((row) => row.pct), 1);

  return (
    <ClearLensCard style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {disclosure ? <Text style={styles.cardMeta}>{disclosure}</Text> : null}
      </View>
      <View style={styles.stackedBar}>
        {rows.map((row) => (
          row.pct > 0 ? (
            <View key={row.label} style={[styles.stackedSegment, { flex: row.pct, backgroundColor: row.color }]} />
          ) : null
        ))}
      </View>
      <View style={styles.rows}>
        {rows.map((row) => (
          <View key={row.label} style={styles.exposureRow}>
            <View style={styles.rowNameWrap}>
              <View style={[styles.dot, { backgroundColor: row.color }]} />
              <Text style={styles.rowName} numberOfLines={1}>{row.label}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.trackFill, { width: `${Math.max((row.pct / max) * 100, 6)}%`, backgroundColor: row.color }]} />
            </View>
            <Text style={styles.rowPct}>{row.pct.toFixed(1)}%</Text>
            {row.value !== undefined || total !== undefined ? (
              <Text style={styles.rowValue}>
                {formatCurrency(row.value ?? ((row.pct / 100) * (total ?? 0)))}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </ClearLensCard>
  );
}

function HoldingsCard({
  holdings,
}: {
  holdings: { name: string; portfolioWeight: number; value: number }[];
}) {
  return (
    <ClearLensCard style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Top holdings</Text>
        <Text style={styles.cardMeta}>Portfolio weight</Text>
      </View>
      <View>
        {holdings.slice(0, 8).map((holding, index) => (
          <View key={holding.name} style={[styles.holdingRow, index > 0 && styles.divider]}>
            <Text style={styles.holdingRank}>{index + 1}</Text>
            <Text style={styles.holdingName} numberOfLines={1}>{holding.name}</Text>
            <Text style={styles.holdingPct}>{holding.portfolioWeight.toFixed(2)}%</Text>
            <Text style={styles.holdingValue}>{formatCurrency(holding.value)}</Text>
          </View>
        ))}
      </View>
    </ClearLensCard>
  );
}

function PendingCard({ title, onSync, isSyncing }: { title: string; onSync: () => void; isSyncing: boolean }) {
  return (
    <ClearLensCard style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.pendingText}>
        FundLens will fill this from AMFI monthly portfolio disclosures.
      </Text>
      <TouchableOpacity style={styles.syncButton} onPress={onSync} disabled={isSyncing}>
        {isSyncing ? (
          <ActivityIndicator size="small" color={ClearLensColors.emerald} />
        ) : (
          <Ionicons name="refresh-outline" size={16} color={ClearLensColors.emerald} />
        )}
        <Text style={styles.syncButtonText}>{isSyncing ? 'Syncing' : 'Sync now'}</Text>
      </TouchableOpacity>
    </ClearLensCard>
  );
}

export function ClearLensPortfolioInsightsScreen() {
  const router = useRouter();
  const { defaultBenchmarkSymbol } = useAppStore();
  const { data } = usePortfolio(defaultBenchmarkSymbol);
  const fundCards = data?.fundCards ?? [];
  const { insights, isLoading, isStale, isSyncing, triggerSync, hasNoData } =
    usePortfolioInsights(fundCards);
  const didAutoTrigger = useRef(false);

  useEffect(() => {
    if (!didAutoTrigger.current && (hasNoData || isStale) && !isSyncing) {
      didAutoTrigger.current = true;
      triggerSync();
    }
  }, [hasNoData, isStale, isSyncing, triggerSync]);

  const disclosure = insights ? `AMFI disclosure: ${formatDisclosureDate(insights.dataAsOf)}` : 'AMFI disclosure';

  return (
    <ClearLensScreen>
      <ClearLensHeader title="Portfolio Insights" onPressBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isSyncing && (
          <View style={styles.infoBanner}>
            <ActivityIndicator size="small" color={ClearLensColors.emerald} />
            <Text style={styles.infoBannerText}>Syncing composition data from AMFI disclosures.</Text>
          </View>
        )}
        {isStale && !isSyncing && (
          <TouchableOpacity style={styles.infoBanner} onPress={() => triggerSync()}>
            <Ionicons name="refresh-outline" size={16} color={ClearLensColors.emerald} />
            <Text style={styles.infoBannerText}>Disclosure data may be outdated. Tap to refresh.</Text>
          </TouchableOpacity>
        )}

        {isLoading || (hasNoData && isSyncing) ? (
          <View style={styles.centeredCard}>
            <ActivityIndicator size="large" color={ClearLensColors.emerald} />
          </View>
        ) : !insights ? (
          <ClearLensCard style={styles.emptyCard}>
            <Ionicons name="pie-chart-outline" size={36} color={ClearLensColors.emerald} />
            <Text style={styles.emptyTitle}>No insights yet</Text>
            <Text style={styles.pendingText}>Load fund composition data to see allocation, sectors, and top holdings.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => triggerSync()}>
              <Text style={styles.primaryButtonText}>Load insights</Text>
            </TouchableOpacity>
          </ClearLensCard>
        ) : (
          <>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>What you own</Text>
              <Text style={styles.heroSubtitle}>
                A beginner-friendly view of asset mix, market-cap tilt, sectors, and stock overlap.
              </Text>
            </View>

            <ExposureCard
              title="Asset allocation"
              total={insights.totalValue}
              disclosure={disclosure}
              rows={[
                { label: 'Equity', pct: insights.assetMix.equity, color: ClearLensColors.emerald },
                { label: 'Debt', pct: insights.assetMix.debt, color: ClearLensColors.slate },
                { label: 'Cash & Others', pct: insights.assetMix.cash + insights.assetMix.other, color: ClearLensColors.mint },
              ]}
            />

            <ExposureCard
              title="Market-cap mix"
              total={insights.totalValue * (insights.assetMix.equity / 100)}
              rows={[
                { label: 'Large Cap', pct: insights.marketCapMix.large, color: ClearLensColors.navy },
                { label: 'Mid Cap', pct: insights.marketCapMix.mid, color: ClearLensColors.emerald },
                { label: 'Small Cap', pct: insights.marketCapMix.small, color: ClearLensColors.slate },
              ]}
            />

            {insights.sectorBreakdown ? (
              <ExposureCard
                title="Sector exposure"
                rows={insights.sectorBreakdown.slice(0, 8).map((sector, index) => ({
                  label: sector.sector,
                  pct: sector.weight,
                  value: sector.value,
                  color: [
                    ClearLensColors.emerald,
                    ClearLensColors.navy,
                    ClearLensColors.slate,
                    ClearLensColors.mint,
                    ClearLensColors.lightGrey,
                  ][index % 5],
                }))}
              />
            ) : (
              <PendingCard title="Sector exposure" isSyncing={isSyncing} onSync={triggerSync} />
            )}

            {insights.topHoldings ? (
              <HoldingsCard holdings={insights.topHoldings} />
            ) : (
              <PendingCard title="Top holdings" isSyncing={isSyncing} onSync={triggerSync} />
            )}
          </>
        )}
      </ScrollView>
    </ClearLensScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingBottom: ClearLensSpacing.xxl,
    gap: ClearLensSpacing.md,
  },
  heroCopy: {
    gap: ClearLensSpacing.xs,
  },
  heroTitle: {
    ...ClearLensTypography.h1,
    color: ClearLensColors.navy,
  },
  heroSubtitle: {
    ...ClearLensTypography.body,
    color: ClearLensColors.textSecondary,
  },
  card: {
    gap: ClearLensSpacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ClearLensSpacing.sm,
  },
  cardTitle: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  cardMeta: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  stackedBar: {
    height: 12,
    borderRadius: ClearLensRadii.full,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: ClearLensColors.surfaceSoft,
  },
  stackedSegment: {
    height: '100%',
  },
  rows: {
    gap: ClearLensSpacing.sm,
  },
  exposureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
  },
  rowNameWrap: {
    width: 132,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  rowName: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textSecondary,
    flex: 1,
  },
  track: {
    flex: 1,
    height: 7,
    borderRadius: ClearLensRadii.full,
    overflow: 'hidden',
    backgroundColor: ClearLensColors.surfaceSoft,
  },
  trackFill: {
    height: '100%',
    borderRadius: ClearLensRadii.full,
  },
  rowPct: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.bold,
    color: ClearLensColors.navy,
    width: 52,
    textAlign: 'right',
  },
  rowValue: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
    width: 74,
    textAlign: 'right',
  },
  holdingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    paddingVertical: ClearLensSpacing.sm,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: ClearLensColors.borderLight,
  },
  holdingRank: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
    width: 20,
    textAlign: 'center',
  },
  holdingName: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.navy,
    flex: 1,
    fontFamily: ClearLensFonts.semiBold,
  },
  holdingPct: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.navy,
    fontFamily: ClearLensFonts.bold,
    width: 58,
    textAlign: 'right',
  },
  holdingValue: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
    width: 72,
    textAlign: 'right',
  },
  pendingText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textSecondary,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.xs,
    alignSelf: 'flex-start',
    minHeight: 38,
    paddingHorizontal: ClearLensSpacing.md,
    borderRadius: ClearLensRadii.full,
    backgroundColor: '#DFF8ED',
  },
  syncButtonText: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.bold,
    color: '#087A5B',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    padding: ClearLensSpacing.md,
    borderRadius: ClearLensRadii.lg,
    backgroundColor: '#DFF8ED',
  },
  infoBannerText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.slate,
    flex: 1,
  },
  centeredCard: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    gap: ClearLensSpacing.md,
  },
  emptyTitle: {
    ...ClearLensTypography.h2,
    color: ClearLensColors.navy,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 44,
    paddingHorizontal: ClearLensSpacing.lg,
    borderRadius: ClearLensRadii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ClearLensColors.emerald,
  },
  primaryButtonText: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.bold,
    color: ClearLensColors.textOnDark,
  },
});

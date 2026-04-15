import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LineChart } from 'react-native-gifted-charts';
import { usePortfolio, type FundCardData } from '@/src/hooks/usePortfolio';
import { usePortfolioTimeline, type FundRef } from '@/src/hooks/usePortfolioTimeline';
import { formatXirr } from '@/src/utils/xirr';
import { formatCurrency, formatChange } from '@/src/utils/formatting';
import { parseFundName } from '@/src/utils/fundName';
import { navStaleness } from '@/src/utils/navUtils';
import { supabase } from '@/src/lib/supabase';
import { useSession } from '@/src/hooks/useSession';
import { useAppStore, BENCHMARK_OPTIONS } from '@/src/store/appStore';
import Logo from '@/src/components/Logo';
import { Sparkline } from '@/src/components/Sparkline';
import { Colors, Spacing, Radii, Typography } from '@/src/constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - Spacing.md * 2;

// Category → accent colour for fund card left-border indicator
const CATEGORY_COLOR: Record<string, string> = {
  'Equity':    Colors.primary,
  'Large Cap': Colors.primary,
  'Mid Cap':   '#7c3aed',
  'Small Cap': Colors.negative,
  'Flexi Cap': '#0891b2',
  'Multi Cap': '#0891b2',
  'ELSS':      Colors.positive,
  'Debt':      Colors.warning,
  'Hybrid':    '#db2777',
};

function categoryColor(category: string | null): string {
  if (!category) return Colors.primary;
  for (const [key, color] of Object.entries(CATEGORY_COLOR)) {
    if (category.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return Colors.primary;
}

function BenchmarkSelector({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (symbol: string) => void;
}) {
  return (
    <View style={styles.benchmarkRow}>
      <Text style={styles.benchmarkRowLabel}>vs</Text>
      {BENCHMARK_OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.symbol}
          style={[styles.benchmarkPill, selected === opt.symbol && styles.benchmarkPillActive]}
          onPress={() => onChange(opt.symbol)}
        >
          <Text
            style={[
              styles.benchmarkPillText,
              selected === opt.symbol && styles.benchmarkPillTextActive,
            ]}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}


function PortfolioHeader({
  totalValue,
  totalInvested,
  dailyChangeAmount,
  dailyChangePct,
  xirr: xirrRate,
  marketXirr,
  benchmarkSymbol,
  latestNavDate,
  onBenchmarkChange,
}: {
  totalValue: number;
  totalInvested: number;
  dailyChangeAmount: number;
  dailyChangePct: number;
  xirr: number;
  marketXirr: number;
  benchmarkSymbol: string;
  latestNavDate: string | null;
  onBenchmarkChange: (symbol: string) => void;
}) {
  const isPositiveDay = dailyChangeAmount >= 0;
  const gain = totalValue - totalInvested;
  const gainPct = totalInvested > 0 ? (gain / totalInvested) * 100 : null;
  const gainPositive = gain >= 0;
  const isAheadOfMarket =
    isFinite(xirrRate) && isFinite(marketXirr) ? xirrRate >= marketXirr : null;
  const benchmarkLabel =
    BENCHMARK_OPTIONS.find((b) => b.symbol === benchmarkSymbol)?.label ?? benchmarkSymbol;
  const delta = isAheadOfMarket !== null ? Math.abs((xirrRate - marketXirr) * 100) : 0;
  const staleness = navStaleness(latestNavDate);

  return (
    <LinearGradient
      colors={Colors.gradientHeader}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.portfolioHeader}
    >
      {/* Stale-data warning when NAV is more than 2 days old */}
      {staleness.stale && (
        <View style={styles.staleBanner}>
          <Ionicons name="warning-outline" size={13} color={staleness.veryStale ? '#fca5a5' : '#fcd34d'} />
          <Text style={[styles.staleBannerText, staleness.veryStale && styles.staleBannerTextRed]}>
            Portfolio based on {staleness.label} NAV — sync may be paused
          </Text>
        </View>
      )}

      {/* Narrative-first: verdict leads */}
      {isAheadOfMarket !== null && (
        <View style={styles.verdictBlock}>
          <Text style={styles.verdictHeadline}>
            {isAheadOfMarket ? 'Beating the market' : 'Lagging the market'}
          </Text>
          <Text style={styles.verdictDelta}>
            {isAheadOfMarket ? '↑' : '↓'} {delta.toFixed(1)}%{' '}
            {isAheadOfMarket ? 'ahead' : 'behind'} · vs {benchmarkLabel}
          </Text>
        </View>
      )}

      {/* Portfolio value + today's change on one row */}
      <View style={styles.valueRow}>
        <Text style={styles.totalValue}>{formatCurrency(totalValue)}</Text>
        <View style={styles.dailyPill}>
          <Ionicons
            name={isPositiveDay ? 'trending-up' : 'trending-down'}
            size={13}
            color={isPositiveDay ? '#86efac' : '#fca5a5'}
          />
          <Text style={[styles.dailyChange, { color: isPositiveDay ? '#86efac' : '#fca5a5' }]}>
            {formatChange(dailyChangeAmount, dailyChangePct)}{' '}
            {staleness.stale ? staleness.label : 'today'}
          </Text>
        </View>
      </View>

      {/* Portfolio overall Gain / Loss */}
      {gainPct !== null && (
        <Text style={[styles.portfolioGainLoss, { color: gainPositive ? '#86efac' : '#fca5a5' }]}>
          {gainPositive ? '+' : ''}{formatCurrency(Math.abs(gain))} ({gainPositive ? '+' : ''}{gainPct.toFixed(1)}%) overall
        </Text>
      )}

      {/* Two-column Your Return | Benchmark */}
      <View style={styles.xirrRow}>
        <View style={styles.xirrItem}>
          <Text style={styles.xirrLabel}>Your Return</Text>
          <Text style={styles.xirrValue}>{formatXirr(xirrRate)}</Text>
        </View>
        <View style={styles.xirrDivider} />
        <View style={styles.xirrItem}>
          <Text style={styles.xirrLabel}>{benchmarkLabel}</Text>
          <Text style={styles.xirrValue}>{formatXirr(marketXirr)}</Text>
        </View>
      </View>

      <BenchmarkSelector selected={benchmarkSymbol} onChange={onBenchmarkChange} />
    </LinearGradient>
  );
}

function FundCard({ fund, latestNavDate, onPress }: { fund: FundCardData; latestNavDate: string | null; onPress: () => void }) {
  const isPositiveDay = fund.dailyChangeAmount != null ? fund.dailyChangeAmount >= 0 : true;
  const accentColor = categoryColor(fund.schemeCategory);
  const hasRedemptions = fund.redeemedUnits > 0;
  const isPressable = !fund.navUnavailable;
  const { base: fundBaseName, planBadge } = parseFundName(fund.schemeName);
  const cardStaleness = navStaleness(latestNavDate);

  // Unrealized P&L on current holdings (only when NAV is available)
  const unrealizedGain = fund.currentValue != null ? fund.currentValue - fund.investedAmount : null;
  const unrealizedPct =
    unrealizedGain != null && fund.investedAmount > 0
      ? (unrealizedGain / fund.investedAmount) * 100
      : null;
  const unrealizedPositive = unrealizedGain != null ? unrealizedGain >= 0 : true;

  return (
    <TouchableOpacity
      style={[styles.fundCard, !isPressable && styles.fundCardDisabled]}
      onPress={onPress}
      activeOpacity={isPressable ? 0.78 : 1}
      disabled={!isPressable}
    >
      {/* Category accent bar */}
      <View style={[styles.fundCardAccent, { backgroundColor: accentColor }]} />

      <View style={styles.fundCardInner}>
        {/* Fund name + value / pending badge */}
        <View style={styles.fundCardTop}>
          <View style={styles.fundNameBlock}>
            <Text style={styles.fundName} numberOfLines={2}>
              {fundBaseName}
            </Text>
            <Text style={[styles.fundCategory, { color: accentColor + 'cc' }]}>
              {fund.schemeCategory}
            </Text>
            {planBadge !== null && (
              <Text style={styles.fundPlanBadge}>{planBadge}</Text>
            )}
          </View>
          <View style={styles.fundValueBlock}>
            {fund.navUnavailable ? (
              <View style={styles.navPendingBadge}>
                <Text style={styles.navPendingText}>NAV pending</Text>
              </View>
            ) : (
              <>
                <Text style={styles.fundValue}>{formatCurrency(fund.currentValue!)}</Text>
                <View style={styles.dailyChangePill}>
                  <Text style={[styles.fundDailyChange, { color: isPositiveDay ? Colors.positive : Colors.negative }]}>
                    {fund.dailyChangePct! >= 0 ? '+' : ''}{fund.dailyChangePct!.toFixed(2)}%{' '}
                    {cardStaleness.stale ? cardStaleness.label : 'today'}
                  </Text>
                </View>
                {isFinite(fund.returnXirr) && (
                  <Text style={[styles.fundXirr, { color: fund.returnXirr >= 0 ? Colors.positive : Colors.negative }]}>
                    {formatXirr(fund.returnXirr)} XIRR
                  </Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* P&L row: Invested → Current → Gain/Loss */}
        <View style={styles.fundCardBottom}>
          <View style={styles.fundMeta}>
            <Text style={styles.fundMetaLabel}>Invested</Text>
            <Text style={styles.fundMetaValue}>{formatCurrency(fund.investedAmount)}</Text>
          </View>
          <View style={styles.fundMetaDivider} />
          <View style={styles.fundMeta}>
            <Text style={styles.fundMetaLabel}>30d</Text>
            {fund.navHistory30d.length >= 2 ? (
              <Sparkline
                data={fund.navHistory30d.map((p) => p.value)}
                color={fund.returnXirr >= 0 ? Colors.positive : Colors.negative}
                width={72}
                height={36}
              />
            ) : (
              <Text style={styles.fundMetaValue}>
                {fund.currentNav != null ? `₹${fund.currentNav.toFixed(2)}` : '—'}
              </Text>
            )}
          </View>
          <View style={styles.fundMetaDivider} />
          <View style={styles.fundMeta}>
            <Text style={styles.fundMetaLabel}>Gain / Loss</Text>
            {unrealizedGain != null ? (
              <>
                <Text style={[styles.fundMetaValue, { color: unrealizedPositive ? Colors.positive : Colors.negative }]}>
                  {unrealizedPositive ? '+' : ''}{formatCurrency(Math.abs(unrealizedGain))}
                </Text>
                <Text style={[styles.fundMetaSub, { color: unrealizedPositive ? Colors.positive : Colors.negative }]}>
                  ({unrealizedPositive ? '+' : ''}{unrealizedPct!.toFixed(1)}%)
                </Text>
              </>
            ) : (
              <Text style={styles.fundMetaValue}>—</Text>
            )}
          </View>
        </View>

        {/* Redemption summary row */}
        {hasRedemptions && (
          <View style={styles.realizedRow}>
            <View style={styles.realizedItem}>
              <Text style={styles.realizedLabel}>Redeemed</Text>
              <Text style={styles.realizedValue}>{formatCurrency(fund.realizedAmount)}</Text>
            </View>
            <View style={styles.realizedItem}>
              <Text style={styles.realizedLabel}>Realized P&amp;L</Text>
              <Text style={[styles.realizedValue, { color: fund.realizedGain >= 0 ? Colors.positive : Colors.negative }]}>
                {fund.realizedGain >= 0 ? '+' : ''}{formatCurrency(Math.abs(fund.realizedGain))}
              </Text>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

type ChartWindow = '1Y' | '3Y';

function PortfolioChartSection({
  funds,
  userId,
  benchmarkSymbol,
}: {
  funds: FundRef[];
  userId: string | undefined;
  benchmarkSymbol: string;
}) {
  const [window, setWindow] = useState<ChartWindow>('1Y');
  const { portfolioPoints, benchmarkPoints, xAxisLabels, isLoading } = usePortfolioTimeline(
    funds,
    userId,
    benchmarkSymbol,
    window,
  );
  const benchmarkLabel = BENCHMARK_OPTIONS.find((b) => b.symbol === benchmarkSymbol)?.label ?? benchmarkSymbol;

  const chartData = portfolioPoints.map((p) => ({ value: p.value }));
  const benchmarkData = benchmarkPoints.map((p) => ({ value: p.value }));

  // Compute y-axis floor so indexed-to-100 lines fill the chart height
  // rather than floating in the top quarter above a large empty area.
  const allChartVals = [...portfolioPoints, ...benchmarkPoints].map((p) => p.value);
  const chartYMax = allChartVals.length > 0 ? Math.max(...allChartVals) : 120;
  const chartYMin = allChartVals.length > 0 ? Math.min(...allChartVals) : 90;
  const chartYPad = ((chartYMax - chartYMin) || chartYMax * 0.1 || 1) * 0.15;
  const chartMaxValue = Math.ceil((chartYMax + chartYPad) / 10) * 10;
  const chartMinValue = Math.floor((chartYMin - chartYPad) / 10) * 10;

  if (!isLoading && chartData.length === 0) return null;

  return (
    <View style={styles.chartSection}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Portfolio vs Market</Text>
        <View style={styles.windowSelector}>
          {(['1Y', '3Y'] as ChartWindow[]).map((w) => (
            <TouchableOpacity
              key={w}
              style={[styles.windowPill, window === w && styles.windowPillActive]}
              onPress={() => setWindow(w)}
            >
              <Text style={[styles.windowPillText, window === w && styles.windowPillTextActive]}>
                {w}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.chartSkeleton} />
      ) : (
        <>
          <LineChart
            data={chartData}
            data2={benchmarkData}
            width={CHART_WIDTH - 32}
            height={140}
            color1={Colors.primary}
            color2="#f59e0b"
            thickness1={3}
            thickness2={2.5}
            curved
            hideDataPoints
            yAxisLabelWidth={40}
            yAxisTextStyle={styles.chartAxisText}
            xAxisLabelTexts={xAxisLabels}
            xAxisLabelTextStyle={styles.chartAxisText}
            xAxisLabelsHeight={16}
            labelsExtraHeight={40}
            hideRules
            xAxisColor={Colors.borderLight}
            yAxisColor="transparent"
            formatYLabel={(v) => `${Math.round(Number(v))}`}
            maxValue={chartMaxValue - chartMinValue}
            yAxisOffset={chartMinValue}
            noOfSections={4}
            initialSpacing={0}
            endSpacing={32}
            spacing={Math.max(8, (CHART_WIDTH - 56) / Math.max(chartData.length - 1, 1))}
          />
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.legendText}>Your Portfolio</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.legendText}>{benchmarkLabel}</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function GainersLosersRow({ fundCards }: { fundCards: FundCardData[] }) {
  const withDailyChange = fundCards.filter(
    (f) => f.dailyChangePct !== null && f.currentValue !== null,
  );
  if (withDailyChange.length < 2) return null;

  const sorted = [...withDailyChange].sort(
    (a, b) => (a.dailyChangePct ?? 0) - (b.dailyChangePct ?? 0),
  );
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];

  function GainerCard({ fund, label, color }: { fund: FundCardData; label: string; color: string }) {
    const { base } = parseFundName(fund.schemeName);
    const pct = fund.dailyChangePct!;
    const amt = fund.dailyChangeAmount!;
    return (
      <View style={[styles.gainerCard, { borderLeftColor: color }]}>
        <Text style={[styles.gainerLabel, { color }]}>{label}</Text>
        <Text style={styles.gainerName} numberOfLines={1}>{base}</Text>
        <Text style={styles.gainerCategory}>{fund.schemeCategory}</Text>
        <Text style={[styles.gainerPct, { color }]}>
          {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
        </Text>
        <Text style={[styles.gainerAmt, { color }]}>
          {amt >= 0 ? '+' : ''}{formatCurrency(Math.abs(amt))}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.gainersRow}>
      <GainerCard fund={best} label="Today's Best" color={Colors.positive} />
      <GainerCard fund={worst} label="Today's Worst" color={Colors.negative} />
    </View>
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="pie-chart-outline" size={40} color={Colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>No portfolio yet</Text>
      <Text style={styles.emptySub}>
        Import your CAS statement to see your mutual fund portfolio, your return, and how you
        compare to the market.
      </Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onImport} activeOpacity={0.85}>
        <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
        <Text style={styles.emptyBtnText}>Import CAS</Text>
      </TouchableOpacity>
    </View>
  );
}

type SyncState = 'idle' | 'syncing' | 'requested' | 'error';

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;

  const { defaultBenchmarkSymbol, setDefaultBenchmarkSymbol } = useAppStore();

  const { data: profile } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profile')
        .select('kfintech_email')
        .eq('user_id', userId!)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [overflowOpen, setOverflowOpen] = useState(false);

  async function handleSync() {
    if (!profile?.kfintech_email) {
      router.push('/onboarding');
      return;
    }
    setSyncState('syncing');
    const { error } = await supabase.functions.invoke('request-cas', {
      method: 'POST',
      body: { email: profile.kfintech_email },
    });
    setSyncState(error ? 'error' : 'requested');
    setTimeout(() => setSyncState('idle'), 4000);
  }

  const { data, isLoading, isError, refetch, isRefetching } = usePortfolio(defaultBenchmarkSymbol);

  const fundCards = data?.fundCards ?? [];
  const summary = data?.summary ?? null;
  const fundRefs: FundRef[] = fundCards.map((f) => ({ id: f.id, schemeCode: f.schemeCode }));

  return (
    <SafeAreaView style={styles.container}>
      {/* Dark header bar — seamlessly joins the gradient below */}
      <View style={styles.header}>
        <Logo size={28} showWordmark light />
        <View style={styles.headerActions}>
          <TouchableOpacity
            hitSlop={8}
            onPress={() => setOverflowOpen(true)}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Overflow menu */}
      <Modal
        visible={overflowOpen}
        transparent
        animationType="none"
        onRequestClose={() => setOverflowOpen(false)}
      >
        <TouchableOpacity
          style={styles.overflowBackdrop}
          activeOpacity={1}
          onPress={() => setOverflowOpen(false)}
        >
          <View style={styles.overflowMenu}>
            <TouchableOpacity
              style={styles.overflowItem}
              onPress={() => {
                setOverflowOpen(false);
                handleSync();
              }}
              disabled={syncState === 'syncing'}
            >
              {syncState === 'syncing' ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Ionicons name="sync-outline" size={18} color={Colors.textPrimary} />
              )}
              <Text style={styles.overflowItemText}>Sync Portfolio</Text>
            </TouchableOpacity>
            <View style={styles.overflowDivider} />
            <TouchableOpacity
              style={styles.overflowItem}
              onPress={() => {
                setOverflowOpen(false);
                router.push(profile?.kfintech_email ? '/onboarding/pdf' : '/onboarding');
              }}
            >
              <Ionicons name="cloud-upload-outline" size={18} color={Colors.textPrimary} />
              <Text style={styles.overflowItemText}>Import CAS</Text>
            </TouchableOpacity>
            <View style={styles.overflowDivider} />
            <TouchableOpacity
              style={styles.overflowItem}
              onPress={() => {
                setOverflowOpen(false);
                router.push('/(tabs)/settings');
              }}
            >
              <Ionicons name="settings-outline" size={18} color={Colors.textPrimary} />
              <Text style={styles.overflowItemText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {syncState === 'requested' && (
        <View style={styles.syncBanner}>
          <Text style={styles.syncBannerText}>
            CAS requested! Check your email — forward it to your inbound address.
          </Text>
        </View>
      )}
      {syncState === 'error' && (
        <View style={[styles.syncBanner, styles.syncBannerError]}>
          <Text style={styles.syncBannerText}>Sync failed. Please try again.</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load portfolio.</Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={styles.retryLink}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !summary || fundCards.length === 0 ? (
        <EmptyState onImport={() => router.push('/onboarding')} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />
          }
        >
          <PortfolioHeader
            totalValue={summary.totalValue}
            totalInvested={summary.totalInvested}
            dailyChangeAmount={summary.dailyChangeAmount}
            dailyChangePct={summary.dailyChangePct}
            xirr={summary.xirr}
            marketXirr={summary.marketXirr}
            benchmarkSymbol={defaultBenchmarkSymbol}
            latestNavDate={summary.latestNavDate ?? null}
            onBenchmarkChange={setDefaultBenchmarkSymbol}
          />

          <PortfolioChartSection
            funds={fundRefs}
            userId={userId}
            benchmarkSymbol={defaultBenchmarkSymbol}
          />

          <GainersLosersRow fundCards={fundCards} />

          <View style={styles.fundListHeader}>
            <Text style={styles.fundListTitle}>Your Funds</Text>
            <Text style={styles.fundCount}>{fundCards.length} fund{fundCards.length !== 1 ? 's' : ''}</Text>
          </View>

          {fundCards.map((fund) => (
            <FundCard
              key={fund.id}
              fund={fund}
              latestNavDate={summary.latestNavDate ?? null}
              onPress={() => router.push(`/fund/${fund.id}`)}
            />
          ))}

          <View style={styles.bottomPad} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Dark header — matches gradientHeader[0] for seamless join with portfolio gradient
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 14,
    backgroundColor: '#0a2e25',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  // Overflow menu
  overflowBackdrop: {
    flex: 1,
  },
  overflowMenu: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  overflowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  overflowItemText: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  overflowDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
  },

  syncBanner: {
    backgroundColor: Colors.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary + '33',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  syncBannerError: { backgroundColor: '#fef2f2', borderBottomColor: '#fecaca' },
  syncBannerText: { fontSize: 13, color: Colors.primaryDark, lineHeight: 18 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 15, color: Colors.textSecondary },
  retryLink: { fontSize: 14, color: Colors.primary, fontWeight: '600' },

  // Full-bleed portfolio header — no margin, no radius
  portfolioHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.xs,
  },

  // Stale-data warning
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: Radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: Spacing.xs,
    alignSelf: 'flex-start',
  },
  staleBannerText: { fontSize: 12, color: '#fcd34d', fontWeight: '500' },
  staleBannerTextRed: { color: '#fca5a5' },

  // Verdict block — the signal, shown first
  verdictBlock: {
    marginBottom: Spacing.xs,
  },
  verdictHeadline: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  verdictDelta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },

  // Portfolio value + daily change on one line
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    marginTop: Spacing.xs,
  },
  totalValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
  },
  dailyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dailyChange: { fontSize: 14, fontWeight: '600' },
  portfolioGainLoss: { fontSize: 13, fontWeight: '500', marginTop: 4 },

  // Two-column Your Return | Benchmark
  xirrRow: {
    flexDirection: 'row',
    marginTop: Spacing.sm,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  xirrItem: { flex: 1, alignItems: 'center', gap: 3 },
  xirrDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  xirrLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  xirrValue: { fontSize: 15, fontWeight: '700', color: '#fff' },

  benchmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  benchmarkRowLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginRight: 2,
  },
  benchmarkPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  benchmarkPillActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
  benchmarkPillText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  benchmarkPillTextActive: { color: Colors.primaryDark },

  fundListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  fundListTitle: { ...Typography.h3, color: Colors.textPrimary },
  fundCount: { fontSize: 13, color: Colors.textTertiary },

  // Fund cards — borders-only depth (no shadows)
  fundCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginBottom: 10,
    borderRadius: Radii.md,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fundCardDisabled: {
    opacity: 0.92,
  },
  fundCardAccent: { width: 4 },
  fundCardInner: { flex: 1, padding: Spacing.md, gap: 10 },
  fundCardTop: { flexDirection: 'row', gap: 12 },
  fundNameBlock: { flex: 1, gap: 3 },
  fundName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, lineHeight: 20 },
  fundCategory: { fontSize: 12, fontWeight: '500' },
  fundPlanBadge: { fontSize: 11, color: Colors.textTertiary, fontWeight: '400' },
  fundValueBlock: { alignItems: 'flex-end', gap: 4 },
  fundValue: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  dailyChangePill: {
    backgroundColor: Colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fundDailyChange: { fontSize: 12, fontWeight: '600' },
  fundXirr: { fontSize: 11, fontWeight: '600' },

  navPendingBadge: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  navPendingText: { fontSize: 11, fontWeight: '600', color: Colors.textTertiary },

  fundCardBottom: {
    flexDirection: 'row',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    alignItems: 'center',
  },
  fundMeta: { flex: 1, alignItems: 'center', gap: 4 },
  fundMetaLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fundMetaValue: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  fundMetaDivider: { width: 1, backgroundColor: Colors.borderLight, marginHorizontal: 4 },
  fundMetaSub: { fontSize: 11, fontWeight: '500' },

  realizedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  realizedItem: { gap: 3 },
  realizedLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  realizedValue: { fontSize: 13, fontWeight: '700' },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: { ...Typography.h2, color: Colors.textPrimary },
  emptySub: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    marginTop: Spacing.sm,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  bottomPad: { height: 32 },

  // Portfolio vs Market chart
  chartSection: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  chartTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  windowSelector: { flexDirection: 'row', gap: 6 },
  windowPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  windowPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  windowPillText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  windowPillTextActive: { color: '#fff' },
  chartSkeleton: {
    height: 140,
    backgroundColor: Colors.borderLight,
    borderRadius: Radii.sm,
  },
  chartLegend: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  chartAxisText: { fontSize: 10, color: Colors.textTertiary },

  // Gainers / Losers row
  gainersRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  gainerCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    padding: Spacing.sm,
    gap: 3,
  },
  gainerLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  gainerName: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  gainerCategory: { fontSize: 11, color: Colors.textTertiary },
  gainerPct: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  gainerAmt: { fontSize: 11, fontWeight: '500' },
});

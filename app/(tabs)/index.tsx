import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { usePortfolio, type FundCardData } from '@/src/hooks/usePortfolio';
import { formatXirr } from '@/src/utils/xirr';
import { formatCurrency, formatChange } from '@/src/utils/formatting';
import { supabase } from '@/src/lib/supabase';
import { useSession } from '@/src/hooks/useSession';
import { useAppStore, BENCHMARK_OPTIONS } from '@/src/store/appStore';
import Logo from '@/src/components/Logo';
import { Sparkline } from '@/src/components/Sparkline';
import { Colors, Spacing, Radii, Typography } from '@/src/constants/theme';

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

function navStaleness(latestNavDate: string | null): { label: string; stale: boolean; veryStale: boolean } {
  if (!latestNavDate) return { label: '', stale: false, veryStale: false };
  const today = new Date().toISOString().split('T')[0];
  if (latestNavDate >= today) return { label: 'today', stale: false, veryStale: false };
  const diffMs = new Date(today).getTime() - new Date(latestNavDate).getTime();
  const diffDays = Math.round(diffMs / 86_400_000);
  const d = new Date(latestNavDate);
  const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return { label: `as of ${label}`, stale: diffDays >= 2, veryStale: diffDays > 3 };
}

function PortfolioHeader({
  totalValue,
  dailyChangeAmount,
  dailyChangePct,
  xirr: xirrRate,
  marketXirr,
  benchmarkSymbol,
  latestNavDate,
  onBenchmarkChange,
}: {
  totalValue: number;
  dailyChangeAmount: number;
  dailyChangePct: number;
  xirr: number;
  marketXirr: number;
  benchmarkSymbol: string;
  latestNavDate: string | null;
  onBenchmarkChange: (symbol: string) => void;
}) {
  const isPositiveDay = dailyChangeAmount >= 0;
  const isAheadOfMarket =
    isFinite(xirrRate) && isFinite(marketXirr) ? xirrRate >= marketXirr : null;
  const benchmarkLabel =
    BENCHMARK_OPTIONS.find((b) => b.symbol === benchmarkSymbol)?.label ?? benchmarkSymbol;
  const delta = isAheadOfMarket !== null ? Math.abs(xirrRate - marketXirr) : 0;
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

function FundCard({ fund, onPress }: { fund: FundCardData; onPress: () => void }) {
  const isPositiveDay = fund.dailyChangeAmount != null ? fund.dailyChangeAmount >= 0 : true;
  const accentColor = categoryColor(fund.schemeCategory);
  const hasRedemptions = fund.redeemedUnits > 0;
  const isPressable = !fund.navUnavailable;

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
              {fund.schemeName}
            </Text>
            <Text style={[styles.fundCategory, { color: accentColor + 'cc' }]}>
              {fund.schemeCategory}
            </Text>
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
                    {fund.dailyChangePct! >= 0 ? '+' : ''}{fund.dailyChangePct!.toFixed(2)}% today
                  </Text>
                </View>
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
                width={60}
                height={24}
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Dark header bar — seamlessly joins the gradient below */}
      <View style={styles.header}>
        <Logo size={28} showWordmark light />
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.syncBtn, syncState === 'syncing' && styles.syncBtnDisabled]}
            onPress={handleSync}
            disabled={syncState === 'syncing'}
          >
            {syncState === 'syncing' ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
            ) : (
              <Text style={styles.syncBtnText}>↻ Sync</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              router.push(profile?.kfintech_email ? '/onboarding/pdf' : '/onboarding')
            }
          >
            <Text style={styles.importLink}>Import</Text>
          </TouchableOpacity>
        </View>
      </View>

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
            dailyChangeAmount={summary.dailyChangeAmount}
            dailyChangePct={summary.dailyChangePct}
            xirr={summary.xirr}
            marketXirr={summary.marketXirr}
            benchmarkSymbol={defaultBenchmarkSymbol}
            latestNavDate={summary.latestNavDate ?? null}
            onBenchmarkChange={setDefaultBenchmarkSymbol}
          />

          <View style={styles.fundListHeader}>
            <Text style={styles.fundListTitle}>Your Funds</Text>
            <Text style={styles.fundCount}>{fundCards.length} fund{fundCards.length !== 1 ? 's' : ''}</Text>
          </View>

          {fundCards.map((fund) => (
            <FundCard
              key={fund.id}
              fund={fund}
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
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: Radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 64,
    justifyContent: 'center',
  },
  syncBtnDisabled: { opacity: 0.6 },
  syncBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  importLink: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },

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
  fundValueBlock: { alignItems: 'flex-end', gap: 4 },
  fundValue: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  dailyChangePill: {
    backgroundColor: Colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fundDailyChange: { fontSize: 12, fontWeight: '600' },
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
});

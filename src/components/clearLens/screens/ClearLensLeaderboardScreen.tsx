import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePortfolio, type FundCardData } from '@/src/hooks/usePortfolio';
import { useSession } from '@/src/hooks/useSession';
import { supabase } from '@/src/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useAppStore, BENCHMARK_OPTIONS } from '@/src/store/appStore';
import { formatCurrency } from '@/src/utils/formatting';
import { formatXirr } from '@/src/utils/xirr';
import { parseFundName } from '@/src/utils/fundName';
import {
  ClearLensScreen,
  ClearLensCard,
  ClearLensHeader,
  ClearLensPill,
} from '@/src/components/clearLens/ClearLensPrimitives';
import { AppOverflowMenu } from '@/src/components/AppOverflowMenu';
import {
  ClearLensColors,
  ClearLensSpacing,
  ClearLensTypography,
  ClearLensRadii,
  ClearLensShadow,
  ClearLensFonts,
} from '@/src/constants/clearLensTheme';

// ---------------------------------------------------------------------------
// Alpha Insight Card
// ---------------------------------------------------------------------------

function AlphaInsightCard({
  portfolioXirr,
  marketXirr,
  benchmarkLabel,
}: {
  portfolioXirr: number;
  marketXirr: number;
  benchmarkLabel: string;
}) {
  const alphaPp = (portfolioXirr - marketXirr) * 100;
  const isAhead = alphaPp >= 0;
  const alphaColor = isAhead ? ClearLensColors.positive : ClearLensColors.negative;

  return (
    <ClearLensCard style={styles.alphaCard}>
      <Text style={styles.alphaTitle}>Alpha Insight</Text>
      <View style={styles.alphaRow}>
        <View style={styles.alphaColumn}>
          <Text style={styles.alphaLabel}>Your Portfolio</Text>
          <Text style={[styles.alphaValue, { color: ClearLensColors.navy }]}>{formatXirr(portfolioXirr)}</Text>
        </View>
        <View style={styles.alphaDivider} />
        <View style={styles.alphaColumn}>
          <Text style={styles.alphaLabel}>{benchmarkLabel}</Text>
          <Text style={[styles.alphaValue, { color: ClearLensColors.textSecondary }]}>{formatXirr(marketXirr)}</Text>
        </View>
      </View>
      <View style={[styles.alphaFooter, { backgroundColor: isAhead ? '#E7FAF2' : '#FEEDEE' }]}>
        <Text style={[styles.alphaFooterText, { color: alphaColor }]}>
          {isAhead ? '▲' : '▼'} {isAhead ? '+' : ''}{alphaPp.toFixed(1)} pp{' '}
          {isAhead ? 'ahead of the market annually' : 'behind the market annually'}
        </Text>
      </View>
    </ClearLensCard>
  );
}

// ---------------------------------------------------------------------------
// Fund Rank Card
// ---------------------------------------------------------------------------

function FundRankCard({
  fund,
  rank,
  marketXirr,
  onPress,
}: {
  fund: FundCardData;
  rank: number;
  marketXirr: number;
  onPress: () => void;
}) {
  const { base: shortName } = parseFundName(fund.schemeName);
  const alphaPp = (fund.returnXirr - marketXirr) * 100;
  const isLeader = alphaPp >= 0;
  const alphaColor = isLeader ? ClearLensColors.positive : ClearLensColors.negative;
  const badgeBg = isLeader ? '#E7FAF2' : '#FEEDEE';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <ClearLensCard style={styles.fundCard}>
        <View style={[styles.rankBadge, { backgroundColor: badgeBg }]}>
          <Text style={[styles.rankText, { color: alphaColor }]}>#{rank}</Text>
        </View>

        <View style={styles.fundBody}>
          <View style={styles.fundTop}>
            <Text style={styles.fundName} numberOfLines={1}>{shortName}</Text>
            <View style={[styles.alphaBadge, { backgroundColor: badgeBg }]}>
              <Text style={[styles.alphaBadgeText, { color: alphaColor }]}>
                {isLeader ? '▲' : '▼'} {isLeader ? '+' : ''}{alphaPp.toFixed(1)} pp
              </Text>
            </View>
          </View>
          <Text style={styles.fundCategory}>{fund.schemeCategory}</Text>
          <View style={styles.fundBottom}>
            <Text style={styles.fundValue}>
              {fund.currentValue != null ? formatCurrency(fund.currentValue) : '—'}
            </Text>
            <Text style={[styles.fundXirr, { color: alphaColor }]}>
              {formatXirr(fund.returnXirr)} XIRR
            </Text>
          </View>
        </View>
      </ClearLensCard>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Section divider pill
// ---------------------------------------------------------------------------

function SectionDivider({ label, count, positive }: { label: string; count: number; positive: boolean }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionDot, { backgroundColor: positive ? ClearLensColors.positive : ClearLensColors.negative }]} />
      <Text style={styles.sectionTitle}>{label}</Text>
      <Text style={styles.sectionCount}>{count} fund{count !== 1 ? 's' : ''}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

type SyncState = 'idle' | 'syncing' | 'requested' | 'error';

export function ClearLensLeaderboardScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { defaultBenchmarkSymbol, setDefaultBenchmarkSymbol } = useAppStore();
  const [benchmarkSymbol, setBenchmarkSymbol] = useState(defaultBenchmarkSymbol);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');

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

  const { data, isLoading } = usePortfolio(benchmarkSymbol);
  const fundCards = useMemo(() => data?.fundCards ?? [], [data?.fundCards]);
  const summary = data?.summary ?? null;

  const benchmarkLabel =
    BENCHMARK_OPTIONS.find((b) => b.symbol === benchmarkSymbol)?.label ?? benchmarkSymbol;

  function handleBenchmarkChange(symbol: string) {
    setBenchmarkSymbol(symbol);
    setDefaultBenchmarkSymbol(symbol);
  }

  const rankedFunds = useMemo(
    () =>
      [...fundCards]
        .filter((f) => !f.navUnavailable)
        .sort((a, b) => b.returnXirr - a.returnXirr),
    [fundCards],
  );

  const marketXirr = summary?.marketXirr ?? 0;
  const leaders = rankedFunds.filter((f) => (f.returnXirr - marketXirr) * 100 > 0);
  const laggards = rankedFunds.filter((f) => (f.returnXirr - marketXirr) * 100 <= 0);

  return (
    <ClearLensScreen>
      <ClearLensHeader
        title="Leaderboard"
        onPressMenu={() => setOverflowOpen(true)}
      />

      <AppOverflowMenu
        visible={overflowOpen}
        syncState={syncState}
        onClose={() => setOverflowOpen(false)}
        onSync={handleSync}
        onImport={() => router.push(profile?.kfintech_email ? '/onboarding/pdf' : '/onboarding')}
        onSettings={() => router.push('/(tabs)/settings')}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Benchmark selector */}
        <View style={styles.benchmarkRow}>
          <Text style={styles.benchmarkLabel}>vs</Text>
          {BENCHMARK_OPTIONS.map((opt) => (
            <ClearLensPill
              key={opt.symbol}
              label={opt.label}
              active={opt.symbol === benchmarkSymbol}
              onPress={() => handleBenchmarkChange(opt.symbol)}
            />
          ))}
        </View>

        {/* Loading */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ClearLensColors.emerald} />
          </View>
        )}

        {/* No data */}
        {!isLoading && fundCards.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={48} color={ClearLensColors.textTertiary} />
            <Text style={styles.emptyTitle}>No funds yet</Text>
            <Text style={styles.emptySubtitle}>Import your portfolio to see the leaderboard.</Text>
          </View>
        )}

        {/* Alpha Insight */}
        {!isLoading && summary != null && (
          <AlphaInsightCard
            portfolioXirr={summary.xirr}
            marketXirr={summary.marketXirr}
            benchmarkLabel={benchmarkLabel}
          />
        )}

        {/* Leaders */}
        {!isLoading && leaders.length > 0 && (
          <View style={styles.section}>
            <SectionDivider label="Leaders" count={leaders.length} positive />
            {leaders.map((fund, i) => (
              <FundRankCard
                key={fund.id}
                fund={fund}
                rank={i + 1}
                marketXirr={marketXirr}
                onPress={() => router.push(`/fund/${fund.id}`)}
              />
            ))}
          </View>
        )}

        {/* Laggards */}
        {!isLoading && laggards.length > 0 && (
          <View style={styles.section}>
            <SectionDivider label="Laggards" count={laggards.length} positive={false} />
            {laggards.map((fund, i) => (
              <FundRankCard
                key={fund.id}
                fund={fund}
                rank={leaders.length + i + 1}
                marketXirr={marketXirr}
                onPress={() => router.push(`/fund/${fund.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </ClearLensScreen>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingBottom: ClearLensSpacing.xl,
    gap: ClearLensSpacing.md,
  },
  benchmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.xs,
    marginTop: ClearLensSpacing.sm,
  },
  benchmarkLabel: {
    ...ClearLensTypography.label,
    color: ClearLensColors.textTertiary,
    marginRight: 2,
  },
  // Alpha Insight
  alphaCard: {
    overflow: 'hidden',
  },
  alphaTitle: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
    marginBottom: ClearLensSpacing.md,
  },
  alphaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ClearLensSpacing.sm,
  },
  alphaColumn: {
    flex: 1,
    alignItems: 'center',
  },
  alphaDivider: {
    width: 1,
    height: 36,
    backgroundColor: ClearLensColors.border,
  },
  alphaLabel: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
    marginBottom: 2,
  },
  alphaValue: {
    ...ClearLensTypography.h3,
  },
  alphaFooter: {
    borderRadius: ClearLensRadii.sm,
    paddingVertical: ClearLensSpacing.xs,
    paddingHorizontal: ClearLensSpacing.sm,
    alignItems: 'center',
    marginTop: ClearLensSpacing.xs,
  },
  alphaFooterText: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.semiBold,
  },
  // Fund rank card
  fundCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    marginBottom: 0,
    ...ClearLensShadow,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: ClearLensRadii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rankText: {
    ...ClearLensTypography.label,
    fontFamily: ClearLensFonts.bold,
  },
  fundBody: {
    flex: 1,
  },
  fundTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  fundName: {
    ...ClearLensTypography.body,
    fontFamily: ClearLensFonts.semiBold,
    color: ClearLensColors.navy,
    flex: 1,
    marginRight: ClearLensSpacing.xs,
  },
  alphaBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: ClearLensRadii.sm,
    flexShrink: 0,
  },
  alphaBadgeText: {
    ...ClearLensTypography.caption,
    fontFamily: ClearLensFonts.semiBold,
  },
  fundCategory: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
    marginBottom: ClearLensSpacing.xs,
  },
  fundBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fundValue: {
    ...ClearLensTypography.body,
    fontFamily: ClearLensFonts.bold,
    color: ClearLensColors.navy,
  },
  fundXirr: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.semiBold,
  },
  // Section
  section: {
    gap: ClearLensSpacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.xs,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  sectionCount: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
    fontFamily: ClearLensFonts.semiBold,
  },
  // Loading / empty
  loadingContainer: {
    paddingVertical: ClearLensSpacing.xl * 2,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ClearLensSpacing.xl * 2,
    gap: ClearLensSpacing.sm,
  },
  emptyTitle: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  emptySubtitle: {
    ...ClearLensTypography.body,
    color: ClearLensColors.textSecondary,
    textAlign: 'center',
  },
});

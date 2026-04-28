import { useMemo, useState } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { AppOverflowMenu } from '@/src/components/AppOverflowMenu';
import {
  ClearLensCard,
  ClearLensHeader,
  ClearLensPill,
  ClearLensScreen,
} from '@/src/components/clearLens/ClearLensPrimitives';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensSpacing,
  ClearLensSemanticColors,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';
import { usePortfolio, type FundCardData } from '@/src/hooks/usePortfolio';
import { useSession } from '@/src/hooks/useSession';
import { supabase } from '@/src/lib/supabase';
import { BENCHMARK_OPTIONS, useAppStore } from '@/src/store/appStore';
import { formatCurrency } from '@/src/utils/formatting';
import { formatXirr } from '@/src/utils/xirr';
import { parseFundName } from '@/src/utils/fundName';
import {
  clearLensDeltaArrow,
  clearLensDeltaSign,
  formatClearLensPercentDelta,
} from '@/src/utils/clearLensFormat';

type SyncState = 'idle' | 'syncing' | 'requested' | 'error';

function formatAlphaDelta(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${clearLensDeltaArrow(value)} ${clearLensDeltaSign(value)}${Math.abs(value).toFixed(1)} pp`;
}

function BenchmarkSelector({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (symbol: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.benchmarkRow}>
      {BENCHMARK_OPTIONS.map((option) => (
        <ClearLensPill
          key={option.symbol}
          label={option.label}
          active={selected === option.symbol}
          onPress={() => onChange(option.symbol)}
        />
      ))}
    </ScrollView>
  );
}

function AlphaCard({
  portfolioXirr,
  marketXirr,
  benchmarkLabel,
}: {
  portfolioXirr: number;
  marketXirr: number;
  benchmarkLabel: string;
}) {
  const alphaPp = (portfolioXirr - marketXirr) * 100;
  const ahead = alphaPp >= 0;
  const color = ahead ? ClearLensSemanticColors.sentiment.positive : ClearLensSemanticColors.sentiment.negative;

  return (
    <ClearLensCard style={styles.alphaCard}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.sectionTitle}>Leaderboard signal</Text>
          <Text style={styles.sectionSubtitle}>SIP-aware return compared with {benchmarkLabel}</Text>
        </View>
        <View style={[styles.alphaBadge, !ahead && styles.alphaBadgeNegative]}>
          <Ionicons
            name={ahead ? 'trending-up-outline' : 'trending-down-outline'}
            size={16}
            color={color}
          />
          <Text style={[styles.alphaBadgeText, { color }]}>{formatAlphaDelta(alphaPp)}</Text>
        </View>
      </View>

      <View style={styles.alphaGrid}>
        <View style={styles.alphaMetric}>
          <Text style={styles.metricLabel}>Your portfolio</Text>
          <Text style={[styles.alphaValue, { color: ClearLensColors.navy }]}>{formatXirr(portfolioXirr)}</Text>
        </View>
        <View style={styles.alphaDivider} />
        <View style={styles.alphaMetric}>
          <Text style={styles.metricLabel}>{benchmarkLabel}</Text>
          <Text style={[styles.alphaValue, { color: ClearLensColors.slate }]}>{formatXirr(marketXirr)}</Text>
        </View>
      </View>
      <Text style={styles.alphaCopy}>
        {ahead ? 'Your fund mix is ahead of the benchmark on annualized returns.' : 'Your fund mix is trailing the benchmark on annualized returns.'}
      </Text>
    </ClearLensCard>
  );
}

function RankCard({
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
  const { base, planBadge } = parseFundName(fund.schemeName);
  const alphaPp = (fund.returnXirr - marketXirr) * 100;
  const ahead = alphaPp >= 0;
  const color = ahead ? ClearLensSemanticColors.sentiment.positive : ClearLensSemanticColors.sentiment.negative;
  const surface = ahead ? ClearLensSemanticColors.sentiment.positiveSurface : ClearLensSemanticColors.sentiment.negativeSurface;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.76}>
      <ClearLensCard style={[styles.rankCard, { borderLeftColor: color }]}>
        <View style={[styles.rankBadge, { backgroundColor: surface }]}>
          <Text style={[styles.rankBadgeText, { color }]}>{rank}</Text>
        </View>
        <View style={styles.rankBody}>
          <View style={styles.rankTop}>
            <View style={styles.rankNameBlock}>
              <Text style={styles.rankName} numberOfLines={2}>{base}</Text>
              <Text style={styles.rankMeta} numberOfLines={1}>
                {fund.schemeCategory}{planBadge ? ` · ${planBadge}` : ''}
              </Text>
            </View>
            <View style={[styles.alphaMiniBadge, { backgroundColor: surface }]}>
              <Text style={[styles.alphaMiniText, { color }]}>{formatAlphaDelta(alphaPp)}</Text>
            </View>
          </View>

          <View style={styles.rankMetrics}>
            <View>
              <Text style={styles.metricLabel}>Current value</Text>
              <Text style={styles.rankValue}>{fund.currentValue != null ? formatCurrency(fund.currentValue) : 'NAV pending'}</Text>
            </View>
            <View style={styles.rankMetricRight}>
              <Text style={styles.metricLabel}>XIRR</Text>
              <Text style={[styles.rankXirr, { color }]}>{formatXirr(fund.returnXirr)}</Text>
            </View>
          </View>
          {fund.dailyChangePct != null && (
            <Text style={[styles.dailyDelta, { color }]}>
              Today {formatClearLensPercentDelta(fund.dailyChangePct)}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={ClearLensColors.textTertiary} />
      </ClearLensCard>
    </TouchableOpacity>
  );
}

function Section({
  title,
  subtitle,
  color,
  funds,
  marketXirr,
  rankOffset,
  onOpenFund,
}: {
  title: string;
  subtitle: string;
  color: string;
  funds: FundCardData[];
  marketXirr: number;
  rankOffset: number;
  onOpenFund: (fundId: string) => void;
}) {
  if (funds.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionDot, { backgroundColor: color }]} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      {funds.map((fund, index) => (
        <RankCard
          key={fund.id}
          fund={fund}
          rank={rankOffset + index + 1}
          marketXirr={marketXirr}
          onPress={() => onOpenFund(fund.id)}
        />
      ))}
    </View>
  );
}

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

  const { data, isLoading, isError, refetch } = usePortfolio(benchmarkSymbol);
  const fundCards = useMemo(() => data?.fundCards ?? [], [data?.fundCards]);
  const summary = data?.summary ?? null;
  const benchmarkLabel =
    BENCHMARK_OPTIONS.find((option) => option.symbol === benchmarkSymbol)?.label ?? benchmarkSymbol;

  const rankedFunds = useMemo(
    () =>
      [...fundCards]
        .filter((fund) => !fund.navUnavailable)
        .sort((a, b) => b.returnXirr - a.returnXirr),
    [fundCards],
  );
  const marketXirr = summary?.marketXirr ?? 0;
  const leaders = rankedFunds.filter((fund) => (fund.returnXirr - marketXirr) * 100 > 0);
  const laggards = rankedFunds.filter((fund) => (fund.returnXirr - marketXirr) * 100 <= 0);

  function handleBenchmarkChange(symbol: string) {
    setBenchmarkSymbol(symbol);
    setDefaultBenchmarkSymbol(symbol);
  }

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

  return (
    <ClearLensScreen>
      <ClearLensHeader onPressMenu={() => setOverflowOpen(true)} showTagline />
      <AppOverflowMenu
        visible={overflowOpen}
        syncState={syncState}
        onClose={() => setOverflowOpen(false)}
        onSync={handleSync}
        onImport={() => router.push(profile?.kfintech_email ? '/onboarding/pdf' : '/onboarding')}
        onSettings={() => router.push('/(tabs)/settings')}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Leaderboard</Text>
          <Text style={styles.heroSubtitle}>See which funds are adding alpha against your benchmark.</Text>
        </View>

        <BenchmarkSelector selected={benchmarkSymbol} onChange={handleBenchmarkChange} />

        {isLoading ? (
          <View style={styles.centeredCard}>
            <ActivityIndicator size="large" color={ClearLensColors.emerald} />
          </View>
        ) : isError ? (
          <ClearLensCard style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={36} color={ClearLensSemanticColors.state.danger} />
            <Text style={styles.emptyTitle}>Could not load leaderboard</Text>
            <Text style={styles.emptyText}>Retry after a moment.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => refetch()}>
              <Text style={styles.primaryButtonText}>Retry</Text>
            </TouchableOpacity>
          </ClearLensCard>
        ) : !summary || fundCards.length === 0 ? (
          <ClearLensCard style={styles.emptyCard}>
            <Ionicons name="trophy-outline" size={36} color={ClearLensColors.emerald} />
            <Text style={styles.emptyTitle}>No funds yet</Text>
            <Text style={styles.emptyText}>Import your CAS to compare your funds against the market.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/onboarding')}>
              <Text style={styles.primaryButtonText}>Import CAS</Text>
            </TouchableOpacity>
          </ClearLensCard>
        ) : (
          <>
            <AlphaCard
              portfolioXirr={summary.xirr}
              marketXirr={summary.marketXirr}
              benchmarkLabel={benchmarkLabel}
            />

            <Section
              title="Leaders"
              subtitle={`${leaders.length} ahead of ${benchmarkLabel}`}
              color={ClearLensSemanticColors.sentiment.positive}
              funds={leaders}
              marketXirr={marketXirr}
              rankOffset={0}
              onOpenFund={(fundId) => router.push(`/fund/${fundId}`)}
            />

            <Section
              title="Laggards"
              subtitle={`${laggards.length} trailing or matching ${benchmarkLabel}`}
              color={ClearLensSemanticColors.sentiment.negative}
              funds={laggards}
              marketXirr={marketXirr}
              rankOffset={leaders.length}
              onOpenFund={(fundId) => router.push(`/fund/${fundId}`)}
            />
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
  benchmarkRow: {
    gap: ClearLensSpacing.sm,
  },
  alphaCard: {
    gap: ClearLensSpacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: ClearLensSpacing.sm,
  },
  sectionTitle: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  sectionSubtitle: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
    marginTop: 2,
  },
  alphaBadge: {
    minHeight: 34,
    borderRadius: ClearLensRadii.full,
    paddingHorizontal: ClearLensSpacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.xs,
    backgroundColor: ClearLensSemanticColors.sentiment.positiveSurface,
  },
  alphaBadgeNegative: {
    backgroundColor: ClearLensSemanticColors.sentiment.negativeSurface,
  },
  alphaBadgeText: {
    ...ClearLensTypography.caption,
    fontFamily: ClearLensFonts.bold,
  },
  alphaGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: ClearLensRadii.md,
    backgroundColor: ClearLensColors.surfaceSoft,
    padding: ClearLensSpacing.md,
  },
  alphaMetric: {
    flex: 1,
    gap: 4,
  },
  alphaDivider: {
    width: 1,
    marginHorizontal: ClearLensSpacing.md,
    backgroundColor: ClearLensColors.border,
  },
  alphaValue: {
    ...ClearLensTypography.h2,
  },
  alphaCopy: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textSecondary,
  },
  metricLabel: {
    ...ClearLensTypography.label,
    color: ClearLensColors.textTertiary,
    textTransform: 'uppercase',
  },
  section: {
    gap: ClearLensSpacing.sm,
  },
  sectionHeader: {
    gap: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.xs,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    borderLeftWidth: 3,
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: ClearLensRadii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    ...ClearLensTypography.h3,
    fontFamily: ClearLensFonts.bold,
  },
  rankBody: {
    flex: 1,
    gap: ClearLensSpacing.sm,
  },
  rankTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ClearLensSpacing.sm,
  },
  rankNameBlock: {
    flex: 1,
    gap: 3,
  },
  rankName: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  rankMeta: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  alphaMiniBadge: {
    borderRadius: ClearLensRadii.full,
    paddingHorizontal: ClearLensSpacing.sm,
    paddingVertical: 4,
  },
  alphaMiniText: {
    ...ClearLensTypography.caption,
    fontFamily: ClearLensFonts.bold,
  },
  rankMetrics: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: ClearLensSpacing.sm,
  },
  rankValue: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.bold,
    color: ClearLensColors.navy,
  },
  rankMetricRight: {
    alignItems: 'flex-end',
  },
  rankXirr: {
    ...ClearLensTypography.bodySmall,
    fontFamily: ClearLensFonts.bold,
  },
  dailyDelta: {
    ...ClearLensTypography.caption,
    fontFamily: ClearLensFonts.semiBold,
  },
  centeredCard: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
    padding: ClearLensSpacing.xl,
  },
  emptyTitle: {
    ...ClearLensTypography.h2,
    color: ClearLensColors.navy,
    textAlign: 'center',
  },
  emptyText: {
    ...ClearLensTypography.body,
    color: ClearLensColors.textSecondary,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 44,
    paddingHorizontal: ClearLensSpacing.xl,
    borderRadius: ClearLensRadii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ClearLensColors.emerald,
  },
  primaryButtonText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textOnDark,
    fontFamily: ClearLensFonts.bold,
  },
});

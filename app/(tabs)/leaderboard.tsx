import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { usePortfolio, type FundCardData } from '@/src/hooks/usePortfolio';
import { formatCurrency } from '@/src/utils/formatting';
import { formatXirr } from '@/src/utils/xirr';
import { parseFundName } from '@/src/utils/fundName';
import { useAppStore, BENCHMARK_OPTIONS } from '@/src/store/appStore';
import Logo from '@/src/components/Logo';
import { Spacing, Radii, Typography } from '@/src/constants/theme';
import { useTheme } from '@/src/context/ThemeContext';
import type { AppColors } from '@/src/context/ThemeContext';

// ---------------------------------------------------------------------------
// Benchmark Selector (same pattern as Home)
// ---------------------------------------------------------------------------

function BenchmarkSelector({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (symbol: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // xirr values are decimal fractions (e.g. 0.0703 = 7.03%)
  const alphaPp = (portfolioXirr - marketXirr) * 100;
  const isAhead = alphaPp >= 0;
  const alphaColor = isAhead ? colors.positive : colors.negative;
  const alphaSign = isAhead ? '+' : '';

  return (
    <View style={styles.alphaCard}>
      <Text style={styles.alphaTitle}>Alpha Insight</Text>
      <View style={styles.alphaRow}>
        <View style={styles.alphaColumn}>
          <Text style={styles.alphaLabel}>Your Portfolio</Text>
          <Text style={styles.alphaValue}>{formatXirr(portfolioXirr)}</Text>
        </View>
        <View style={styles.alphaDivider} />
        <View style={styles.alphaColumn}>
          <Text style={styles.alphaLabel}>{benchmarkLabel}</Text>
          <Text style={styles.alphaValue}>{formatXirr(marketXirr)}</Text>
        </View>
      </View>
      <View style={[styles.alphaFooter, { backgroundColor: isAhead ? '#dcfce7' : '#fee2e2' }]}>
        <Text style={[styles.alphaFooterText, { color: alphaColor }]}>
          {alphaSign}{alphaPp.toFixed(1)} pp{' '}
          {isAhead ? 'ahead of the market annually' : 'behind the market annually'}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Fund Rank Card
// ---------------------------------------------------------------------------

function FundRankCard({
  fund,
  marketXirr,
  onPress,
}: {
  fund: FundCardData;
  marketXirr: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { base: shortName } = parseFundName(fund.schemeName);
  // returnXirr and marketXirr are decimal fractions (e.g. 0.0881 = 8.81%)
  const alphaPp = (fund.returnXirr - marketXirr) * 100;
  const isLeader = alphaPp >= 0;
  const alphaColor = isLeader ? colors.positive : colors.negative;
  const alphaSign = isLeader ? '+' : '';

  return (
    <TouchableOpacity style={styles.fundCard} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.fundCardAccent, { backgroundColor: alphaColor }]} />
      <View style={styles.fundCardBody}>
        <View style={styles.fundCardTop}>
          <View style={styles.fundCardInfo}>
            <Text style={styles.fundCardName} numberOfLines={1}>{shortName}</Text>
            <Text style={styles.fundCardCategory}>{fund.schemeCategory}</Text>
          </View>
          <View style={styles.fundCardBadge}>
            <Text style={[styles.fundCardBadgeText, { color: alphaColor }]}>
              {alphaSign}{alphaPp.toFixed(1)} pp
            </Text>
          </View>
        </View>
        <View style={styles.fundCardBottom}>
          <Text style={styles.fundCardValue}>
            {fund.currentValue != null ? formatCurrency(fund.currentValue) : '—'}
          </Text>
          <Text style={[styles.fundCardXirr, { color: alphaColor }]}>
            {formatXirr(fund.returnXirr)} XIRR
          </Text>
        </View>
        <Text style={[styles.fundCardVerdict, { color: alphaColor }]}>
          {isLeader ? 'Beating market' : 'Trailing market'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function SkeletonCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, { width: '60%', marginTop: 8 }]} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function LeaderboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { defaultBenchmarkSymbol, setDefaultBenchmarkSymbol } = useAppStore();
  const [benchmarkSymbol, setBenchmarkSymbol] = useState(defaultBenchmarkSymbol);

  const { data, isLoading } = usePortfolio(benchmarkSymbol);
  const fundCards = data?.fundCards ?? [];
  const summary = data?.summary ?? null;

  const benchmarkLabel =
    BENCHMARK_OPTIONS.find((b) => b.symbol === benchmarkSymbol)?.label ?? benchmarkSymbol;

  function handleBenchmarkChange(symbol: string) {
    setBenchmarkSymbol(symbol);
    setDefaultBenchmarkSymbol(symbol);
  }

  // Sort by returnXirr descending; exclude navUnavailable funds
  const rankedFunds = [...fundCards]
    .filter((f) => !f.navUnavailable)
    .sort((a, b) => b.returnXirr - a.returnXirr);

  const marketXirr = summary?.marketXirr ?? 0;
  const leaders = rankedFunds.filter((f) => (f.returnXirr - marketXirr) * 100 > 0);
  const laggards = rankedFunds.filter((f) => (f.returnXirr - marketXirr) * 100 <= 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={colors.gradientHeader}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Logo size={28} showWordmark light />
        <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} hitSlop={8}>
          <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Benchmark selector */}
        <BenchmarkSelector selected={benchmarkSymbol} onChange={handleBenchmarkChange} />

        {/* Loading */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        )}

        {/* No data */}
        {!isLoading && fundCards.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No funds yet</Text>
            <Text style={styles.emptySubtitle}>Import your portfolio to see the leaderboard.</Text>
          </View>
        )}

        {/* Alpha Insight card */}
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
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: colors.positive }]} />
              <Text style={styles.sectionTitle}>Leaders</Text>
              <Text style={styles.sectionCount}>{leaders.length} fund{leaders.length > 1 ? 's' : ''}</Text>
            </View>
            {leaders.map((fund) => (
              <FundRankCard
                key={fund.id}
                fund={fund}
                marketXirr={marketXirr}
                onPress={() => router.push(`/fund/${fund.id}`)}
              />
            ))}
          </View>
        )}

        {/* Laggards */}
        {!isLoading && laggards.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: colors.negative }]} />
              <Text style={styles.sectionTitle}>Laggards</Text>
              <Text style={styles.sectionCount}>{laggards.length} fund{laggards.length > 1 ? 's' : ''}</Text>
            </View>
            {laggards.map((fund) => (
              <FundRankCard
                key={fund.id}
                fund={fund}
                marketXirr={marketXirr}
                onPress={() => router.push(`/fund/${fund.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.xl,
      gap: Spacing.md,
    },
    // Benchmark selector
    benchmarkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
    },
    benchmarkRowLabel: {
      ...Typography.label,
      color: colors.textSecondary,
      marginRight: 4,
    },
    benchmarkPill: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: Radii.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    benchmarkPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    benchmarkPillText: {
      ...Typography.label,
      color: colors.textSecondary,
    },
    benchmarkPillTextActive: {
      color: '#fff',
    },
    // Alpha Insight
    alphaCard: {
      backgroundColor: colors.surface,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    alphaTitle: {
      ...Typography.label,
      color: colors.textSecondary,
      marginBottom: Spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    alphaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    alphaColumn: {
      flex: 1,
      alignItems: 'center',
    },
    alphaDivider: {
      width: 1,
      height: 36,
      backgroundColor: colors.border,
    },
    alphaLabel: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    alphaValue: {
      ...Typography.h3,
      color: colors.textPrimary,
    },
    alphaFooter: {
      borderRadius: Radii.sm,
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      alignItems: 'center',
      marginTop: Spacing.xs,
    },
    alphaFooterText: {
      ...Typography.label,
      fontWeight: '600',
    },
    // Fund rank card
    fundCard: {
      backgroundColor: colors.surface,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      overflow: 'hidden',
      marginBottom: Spacing.xs,
    },
    fundCardAccent: {
      width: 4,
    },
    fundCardBody: {
      flex: 1,
      padding: Spacing.sm,
    },
    fundCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 4,
    },
    fundCardInfo: {
      flex: 1,
      marginRight: Spacing.sm,
    },
    fundCardName: {
      ...Typography.body,
      color: colors.textPrimary,
    },
    fundCardCategory: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    fundCardBadge: {
      paddingHorizontal: Spacing.xs,
      paddingVertical: 2,
      borderRadius: Radii.sm,
      backgroundColor: colors.background,
    },
    fundCardBadgeText: {
      ...Typography.label,
      fontWeight: '700',
    },
    fundCardBottom: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    fundCardValue: {
      ...Typography.body,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    fundCardXirr: {
      ...Typography.label,
      fontWeight: '600',
    },
    fundCardVerdict: {
      ...Typography.caption,
      fontWeight: '500',
    },
    // Section headers
    section: {
      gap: Spacing.xs,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: 4,
    },
    sectionDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    sectionTitle: {
      ...Typography.h3,
      color: colors.textPrimary,
    },
    sectionCount: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    // Loading
    loadingContainer: {
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    skeletonCard: {
      backgroundColor: colors.surface,
      borderRadius: Radii.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      height: 80,
      justifyContent: 'center',
    },
    skeletonLine: {
      height: 14,
      width: '80%',
      borderRadius: Radii.sm,
      backgroundColor: colors.border,
    },
    // Empty
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.xl * 2,
      gap: Spacing.sm,
    },
    emptyTitle: {
      ...Typography.h3,
      color: colors.textPrimary,
    },
    emptySubtitle: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
}

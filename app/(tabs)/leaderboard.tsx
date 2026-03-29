import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppScreenHeader } from '@/src/components/AppScreenHeader';
import { useLeaderboard } from '@/src/hooks/useLeaderboard';
import { useThemeVariant } from '@/src/hooks/useThemeVariant';
import { useSession } from '@/src/hooks/useSession';
import { BENCHMARK_OPTIONS, useAppStore } from '@/src/store/appStore';
import { formatCurrency } from '@/src/utils/formatting';

export default function LeaderboardScreen() {
  const theme = useThemeVariant();
  const router = useRouter();
  const { session } = useSession();
  const { defaultBenchmarkSymbol, setDefaultBenchmarkSymbol } = useAppStore();
  const { data: rows = [], isLoading } = useLeaderboard(session?.user.id, defaultBenchmarkSymbol);
  const leaders = rows.filter((row) => row.verdict === 'leader');
  const laggards = rows.filter((row) => row.verdict === 'laggard');
  const hasBenchmarkFallback = rows.some((row) => !row.benchmarkAvailable);
  const benchmarkLabel =
    BENCHMARK_OPTIONS.find((option) => option.symbol === defaultBenchmarkSymbol)?.label ?? defaultBenchmarkSymbol;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <AppScreenHeader
        title="Leaderboard"
        subtitle="Which funds are beating or trailing the market over the last year."
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryChip, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>{leaders.length}</Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Leaders</Text>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>{laggards.length}</Text>
            <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Laggards</Text>
          </View>
        </View>

        <View style={styles.benchmarkRow}>
          {BENCHMARK_OPTIONS.map((option) => {
            const selected = option.symbol === defaultBenchmarkSymbol;
            return (
              <TouchableOpacity
                key={option.symbol}
                style={[
                  styles.benchmarkPill,
                  { backgroundColor: selected ? theme.colors.primary : theme.colors.surface },
                ]}
                onPress={() => setDefaultBenchmarkSymbol(option.symbol)}
              >
                <Text style={[styles.benchmarkText, { color: selected ? '#fff' : theme.colors.textSecondary }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.alphaCard, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.alphaTitle}>Portfolio Insight</Text>
          <Text style={styles.alphaBody}>
            {hasBenchmarkFallback
              ? `Benchmark history for ${benchmarkLabel} is stale in this environment, so affected funds are ranked by absolute 1Y return until market data catches up.`
              : `Ranked by 1Y fund return minus ${benchmarkLabel}. Positive delta means a fund is outperforming the chosen benchmark over the same window.`}
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : rows.length === 0 ? (
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>No ranked funds yet</Text>
            <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
              Import holdings first so FundLens can rank your portfolio against the selected benchmark.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {rows.map((row) => (
              <TouchableOpacity
                key={row.id}
                activeOpacity={0.8}
                onPress={() => router.push(`/fund/${row.id}`)}
                style={[styles.card, { backgroundColor: theme.colors.surface }]}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                      {row.schemeName}
                    </Text>
                    <Text style={[styles.category, { color: theme.colors.textSecondary }]}>
                      {row.schemeCategory}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: row.verdict === 'leader' ? '#ecfdf3' : '#fef2f2' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: row.verdict === 'leader' ? '#15803d' : '#b91c1c' },
                      ]}
                    >
                      {row.verdict === 'leader' ? 'Leader' : 'Laggard'}
                    </Text>
                  </View>
                </View>

                <View style={styles.metricRow}>
                  <View style={styles.metric}>
                    <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Current Value</Text>
                    <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>
                      {formatCurrency(row.currentValue)}
                    </Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Fund (1Y)</Text>
                    <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>
                      {row.fundReturnPct >= 0 ? '+' : ''}{row.fundReturnPct.toFixed(1)}%
                    </Text>
                  </View>
                </View>

                <View style={styles.metricRow}>
                  <View style={styles.metric}>
                    <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                      {row.benchmarkAvailable ? benchmarkLabel : 'Benchmark'}
                    </Text>
                    {row.benchmarkAvailable ? (
                      <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>
                        {row.benchmarkReturnPct >= 0 ? '+' : ''}{row.benchmarkReturnPct.toFixed(1)}%
                      </Text>
                    ) : (
                      <Text style={[styles.metricValue, { color: theme.colors.textTertiary }]}>
                        Unavailable
                      </Text>
                    )}
                  </View>
                  <View style={styles.metric}>
                    <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>
                      {row.benchmarkAvailable ? 'Delta' : '1Y Return'}
                    </Text>
                    <Text
                      style={[
                        styles.metricValue,
                        { color: row.deltaPct >= 0 ? '#15803d' : '#b91c1c' },
                      ]}
                    >
                      {row.deltaPct >= 0 ? '+' : ''}{row.deltaPct.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
  },
  summaryChip: {
    borderRadius: 18,
    flex: 1,
    padding: 16,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  benchmarkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
  },
  benchmarkPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  benchmarkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  alphaCard: {
    borderRadius: 22,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
  },
  alphaTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  alphaBody: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 14,
    lineHeight: 21,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
  },
  list: {
    gap: 12,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 20,
    padding: 20,
  },
  cardTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  category: {
    fontSize: 13,
    marginTop: 4,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
  },
});

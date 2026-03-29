import { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LineChart } from 'react-native-gifted-charts';
import Logo from '@/src/components/Logo';
import { Colors, Spacing, Radii, Typography } from '@/src/constants/theme';
import { usePortfolio } from '@/src/hooks/usePortfolio';
import { useSession } from '@/src/hooks/useSession';
import { supabase } from '@/src/lib/supabase';
import { formatCurrency } from '@/src/utils/formatting';
import { projectWealth, getMilestones } from '@/src/utils/simulatorCalc';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - Spacing.md * 2;

const SIP_BOOST = 5000;

// ─── Estimate monthly SIP from the last 12 months of purchase transactions ───

async function estimateMonthlySip(userId: string): Promise<number> {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const { data } = await supabase
    .from('transaction')
    .select('transaction_date, amount, transaction_type')
    .eq('user_id', userId)
    .in('transaction_type', ['purchase', 'switch_in'])
    .gte('transaction_date', oneYearAgo.toISOString().split('T')[0]);

  if (!data?.length) return 0;

  // Sum purchase amounts per calendar month
  const byMonth = new Map<string, number>();
  for (const tx of data) {
    const month = (tx.transaction_date as string).substring(0, 7); // YYYY-MM
    byMonth.set(month, (byMonth.get(month) ?? 0) + (tx.amount as number));
  }

  if (byMonth.size === 0) return 0;

  const totalMonthly = [...byMonth.values()].reduce((a, b) => a + b, 0);
  const avgMonthly = totalMonthly / byMonth.size;

  // Round to the nearest ₹500
  return Math.round(avgMonthly / 500) * 500;
}

// ─── Step control ────────────────────────────────────────────────────────────

interface StepControlProps {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  prefix?: string;
  suffix?: string;
  onChange: (v: number) => void;
}

function StepControl({
  label,
  value,
  step,
  min,
  max,
  prefix,
  suffix,
  onChange,
}: StepControlProps) {
  const displayValue = prefix
    ? `${prefix}${value.toLocaleString('en-IN')}`
    : `${value}${suffix ?? ''}`;

  const decrement = () => onChange(Math.max(min, value - step));
  const increment = () => onChange(Math.min(max, value + step));

  return (
    <View style={styles.stepRow}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepControl}>
        <TouchableOpacity
          onPress={decrement}
          disabled={value <= min}
          style={[styles.stepBtn, value <= min && styles.stepBtnDisabled]}
          hitSlop={8}
        >
          <Ionicons
            name="remove"
            size={18}
            color={value <= min ? Colors.textTertiary : Colors.primary}
          />
        </TouchableOpacity>
        <Text style={styles.stepValue}>{displayValue}</Text>
        <TouchableOpacity
          onPress={increment}
          disabled={value >= max}
          style={[styles.stepBtn, value >= max && styles.stepBtnDisabled]}
          hitSlop={8}
        >
          <Ionicons
            name="add"
            size={18}
            color={value >= max ? Colors.textTertiary : Colors.primary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SimulatorScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;

  // Portfolio summary for personalization
  const { data: portfolioData, isLoading: portfolioLoading } = usePortfolio();

  // Estimated monthly SIP from recent transaction history
  const { data: estimatedSip } = useQuery({
    queryKey: ['estimated-sip', userId],
    enabled: !!userId,
    queryFn: () => estimateMonthlySip(userId!),
    staleTime: 10 * 60 * 1000,
  });

  const hasPortfolio =
    portfolioData?.summary != null && portfolioData.summary.totalValue > 0;

  // ── Simulator state ─────────────────────────────────────────────────────────
  // Defaults are generic; once portfolio data arrives we override with real values.
  const [sip, setSip] = useState(5000);
  const [lumpsum, setLumpsum] = useState(0);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(15);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (seeded || portfolioLoading) return;
    const summary = portfolioData?.summary;
    if (!summary) return;

    // Current corpus → initial lumpsum
    if (summary.totalValue > 0) {
      setLumpsum(Math.round(summary.totalValue / 1000) * 1000);
    }

    // Portfolio XIRR → expected return, clamped to [6, 20]%
    if (Number.isFinite(summary.xirr) && summary.xirr > 0) {
      const pct = Math.round(summary.xirr * 100);
      setRate(Math.min(20, Math.max(6, pct)));
    }

    setSeeded(true);
  }, [portfolioData, portfolioLoading, seeded]);

  // Apply estimated SIP once available (separate effect so it doesn't block corpus seeding)
  useEffect(() => {
    if (!seeded || estimatedSip == null || estimatedSip === 0) return;
    setSip(estimatedSip);
  }, [estimatedSip, seeded]);

  // ── Projections ──────────────────────────────────────────────────────────────
  const basePoints = useMemo(
    () => projectWealth(sip, lumpsum, rate, years),
    [sip, lumpsum, rate, years],
  );

  const boostedPoints = useMemo(
    () => projectWealth(sip + SIP_BOOST, lumpsum, rate, years),
    [sip, lumpsum, rate, years],
  );

  const milestones = useMemo(() => getMilestones(basePoints), [basePoints]);

  const horizonBase = basePoints[basePoints.length - 1]?.value ?? 0;
  const horizonBoosted = boostedPoints[boostedPoints.length - 1]?.value ?? 0;
  const sipBoostGain = horizonBoosted - horizonBase;

  // Build chart data — two datasets
  const baseChartData = basePoints.map((p) => ({
    value: Math.round(p.value / 1000),
    label: p.year % 5 === 0 || p.year === 1 || p.year === years ? `${p.year}Y` : '',
  }));
  const boostedChartData = boostedPoints.map((p) => ({
    value: Math.round(p.value / 1000),
  }));

  const chartMax = Math.ceil(horizonBoosted / 1000 / 10) * 10 * 1.1;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={Colors.gradientHeader}
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>
            {hasPortfolio ? 'Your Future Journey' : 'Wealth Simulator'}
          </Text>
          <Text style={styles.subtitle}>
            {hasPortfolio
              ? 'Pre-filled from your portfolio — adjust to explore different scenarios.'
              : 'See how your investments grow over time.'}
          </Text>
        </View>

        {/* Portfolio context card — only shown when user has data */}
        {portfolioLoading && (
          <View style={[styles.card, styles.loadingCard]}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading your portfolio data…</Text>
          </View>
        )}

        {!portfolioLoading && hasPortfolio && portfolioData?.summary && (
          <View style={styles.contextCard}>
            <View style={styles.contextHeader}>
              <Ionicons name="person-circle-outline" size={16} color={Colors.primary} />
              <Text style={styles.contextLabel}>YOUR PORTFOLIO TODAY</Text>
            </View>
            <View style={styles.contextRow}>
              <View style={styles.contextStat}>
                <Text style={styles.contextStatValue}>
                  {formatCurrency(portfolioData.summary.totalValue)}
                </Text>
                <Text style={styles.contextStatLabel}>Current corpus</Text>
              </View>
              {Number.isFinite(portfolioData.summary.xirr) && (
                <View style={styles.contextStat}>
                  <Text style={[styles.contextStatValue, { color: Colors.positive }]}>
                    {(portfolioData.summary.xirr * 100).toFixed(1)}% p.a.
                  </Text>
                  <Text style={styles.contextStatLabel}>Your XIRR</Text>
                </View>
              )}
              {estimatedSip != null && estimatedSip > 0 && (
                <View style={styles.contextStat}>
                  <Text style={styles.contextStatValue}>
                    {formatCurrency(estimatedSip)}/mo
                  </Text>
                  <Text style={styles.contextStatLabel}>Avg monthly SIP</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Input card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {hasPortfolio ? 'Adjust Your Plan' : 'Your Investment Plan'}
          </Text>
          <StepControl
            label="Monthly SIP"
            value={sip}
            step={500}
            min={0}
            max={100000}
            prefix="₹"
            onChange={setSip}
          />
          <StepControl
            label={hasPortfolio ? 'Existing Corpus' : 'One-time Lumpsum'}
            value={lumpsum}
            step={hasPortfolio ? 25000 : 10000}
            min={0}
            max={50000000}
            prefix="₹"
            onChange={setLumpsum}
          />
          <StepControl
            label="Expected Return"
            value={rate}
            step={1}
            min={1}
            max={30}
            suffix="% p.a."
            onChange={setRate}
          />
          <StepControl
            label="Investment Period"
            value={years}
            step={1}
            min={1}
            max={30}
            suffix=" yrs"
            onChange={setYears}
          />
        </View>

        {/* Milestones */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Projected Wealth</Text>
          <View style={styles.milestonesGrid}>
            {milestones.map((m) => (
              <View key={m.year} style={styles.milestoneItem}>
                <Text style={styles.milestoneYear}>{m.year}Y</Text>
                <Text style={styles.milestoneValue}>{formatCurrency(m.value)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Chart */}
        <View style={[styles.card, { paddingHorizontal: 0 }]}>
          <Text style={[styles.sectionTitle, { paddingHorizontal: Spacing.md }]}>
            Growth Chart
          </Text>
          <Text style={[styles.chartNote, { paddingHorizontal: Spacing.md }]}>
            Values in ₹ thousands
          </Text>
          <View style={{ overflow: 'hidden', marginTop: Spacing.xs }}>
            <LineChart
              data={baseChartData}
              data2={boostedChartData}
              width={CHART_WIDTH - 32}
              height={180}
              color1={Colors.primary}
              color2={Colors.positive}
              dataPointsColor1={Colors.primary}
              dataPointsColor2={Colors.positive}
              dataPointsRadius={3}
              thickness={2}
              maxValue={chartMax}
              noOfSections={4}
              isAnimated
              curved
              yAxisLabelWidth={48}
              formatYLabel={(v: string) =>
                Number(v) >= 1000
                  ? `${(Number(v) / 1000).toFixed(0)}L`
                  : `${Number(v)}k`
              }
              hideDataPoints={basePoints.length > 20}
              scrollToEnd
            />
          </View>
          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.legendLabel}>Your plan</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.positive }]} />
              <Text style={styles.legendLabel}>+₹5k SIP boost</Text>
            </View>
          </View>
        </View>

        {/* SIP boost insight */}
        {sipBoostGain > 0 && (
          <View style={styles.insightCard}>
            <Ionicons name="bulb-outline" size={20} color={Colors.primary} />
            <Text style={styles.insightText}>
              Increasing your SIP by{' '}
              <Text style={styles.insightHighlight}>₹5,000/month</Text> would
              earn you an extra{' '}
              <Text style={styles.insightHighlight}>
                {formatCurrency(sipBoostGain)}
              </Text>{' '}
              over {years} years.
            </Text>
          </View>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  titleBlock: {
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  // ── Portfolio context card ─────────────────────────────────────────────────
  contextCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  contextLabel: {
    ...Typography.label,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  contextRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  contextStat: {
    flex: 1,
  },
  contextStatValue: {
    ...Typography.body,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  contextStatLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  // ── Step control ──────────────────────────────────────────────────────────
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  stepLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
    flex: 1,
  },
  stepControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: Radii.sm,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    backgroundColor: Colors.borderLight,
  },
  stepValue: {
    ...Typography.body,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    minWidth: 96,
    textAlign: 'center',
  },
  // ── Milestones ────────────────────────────────────────────────────────────
  milestonesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  milestoneItem: {
    flex: 1,
    minWidth: 100,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  milestoneYear: {
    ...Typography.label,
    color: Colors.primary,
    marginBottom: 4,
  },
  milestoneValue: {
    ...Typography.bodySmall,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  // ── Chart ─────────────────────────────────────────────────────────────────
  chartNote: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginBottom: Spacing.xs,
  },
  legend: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  // ── Insight ───────────────────────────────────────────────────────────────
  insightCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radii.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  insightText: {
    ...Typography.body,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 22,
  },
  insightHighlight: {
    ...Typography.body,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Platform,
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

// ─── SIP pattern detection ────────────────────────────────────────────────────
//
// A "SIP" is a purchase that recurs on roughly the same day of the month
// (±3 days to allow for weekends/holidays) across ≥3 of the last 6 months.
// One-off lumpsum purchases that fall outside any recurring day cluster are
// excluded from the estimate.

async function estimateMonthlySip(userId: string): Promise<number> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data } = await supabase
    .from('transaction')
    .select('transaction_date, amount, transaction_type')
    .eq('user_id', userId)
    .eq('transaction_type', 'purchase') // switch_in excluded (STP/fund switches, not SIPs)
    .gte('transaction_date', sixMonthsAgo.toISOString().split('T')[0]);

  if (!data?.length) return 0;

  const purchases = data.map((tx) => ({
    month: (tx.transaction_date as string).substring(0, 7), // YYYY-MM
    day: parseInt((tx.transaction_date as string).substring(8, 10), 10),
    amount: tx.amount as number,
  }));

  // Sort by day-of-month to enable anchor-based clustering
  const sorted = [...purchases].sort((a, b) => a.day - b.day);

  // Build day clusters: each cluster has an anchor day; purchases within ±3
  // days of the anchor belong to it. The anchor is set by the first purchase
  // seen for that range.
  const clusters: { anchor: number; items: typeof purchases }[] = [];
  for (const p of sorted) {
    const existing = clusters.find((c) => Math.abs(p.day - c.anchor) <= 3);
    if (existing) {
      existing.items.push(p);
    } else {
      clusters.push({ anchor: p.day, items: [p] });
    }
  }

  // For each cluster that appears in ≥3 distinct months, it is a recurring SIP.
  // Average its per-month spend and add to the total.
  let totalSip = 0;
  for (const cluster of clusters) {
    const monthAmounts = new Map<string, number>();
    for (const p of cluster.items) {
      monthAmounts.set(p.month, (monthAmounts.get(p.month) ?? 0) + p.amount);
    }
    if (monthAmounts.size < 3) continue; // not recurring enough — lumpsum pattern

    const avg =
      [...monthAmounts.values()].reduce((a, b) => a + b, 0) / monthAmounts.size;
    totalSip += avg;
  }

  return Math.round(totalSip / 500) * 500;
}

// ─── Input control ────────────────────────────────────────────────────────────
//
// ± buttons for quick ±1 step increments, plus a tappable value that opens a
// keyboard input so the user can type any number directly.

interface InputControlProps {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  prefix?: string;
  suffix?: string;
  onChange: (v: number) => void;
}

function InputControl({
  label,
  value,
  step,
  min,
  max,
  prefix,
  suffix,
  onChange,
}: InputControlProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const displayValue = prefix
    ? `${prefix}${value.toLocaleString('en-IN')}`
    : `${value}${suffix ?? ''}`;

  const startEdit = useCallback(() => {
    setDraft(String(value));
    setEditing(true);
  }, [value]);

  const commit = useCallback(
    (text: string) => {
      const raw = text.replace(/[^0-9]/g, '');
      const n = parseInt(raw, 10);
      if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
      setEditing(false);
    },
    [min, max, onChange],
  );

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

        {editing ? (
          <TextInput
            style={styles.stepInput}
            value={draft}
            onChangeText={setDraft}
            onBlur={() => commit(draft)}
            onSubmitEditing={() => commit(draft)}
            keyboardType="numeric"
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
          />
        ) : (
          <TouchableOpacity onPress={startEdit} hitSlop={4} style={styles.stepValueTouchable}>
            <Text style={styles.stepValue}>{displayValue}</Text>
          </TouchableOpacity>
        )}

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

  const { data: portfolioData, isLoading: portfolioLoading } = usePortfolio();
  const { data: estimatedSip } = useQuery({
    queryKey: ['estimated-sip', userId],
    enabled: !!userId,
    queryFn: () => estimateMonthlySip(userId!),
    staleTime: 10 * 60 * 1000,
  });

  const hasPortfolio =
    portfolioData?.summary != null && portfolioData.summary.totalValue > 0;

  // ── Seeded baseline (frozen from portfolio data) ─────────────────────────────
  // These represent the user's current plan — they never change after seeding.
  // We only seed once per session; subsequent re-renders don't overwrite.
  const [seededSip, setSeededSip] = useState(5000);
  const [seededLumpsum, setSeededLumpsum] = useState(0);
  const [seeded, setSeeded] = useState(false);

  // ── Adjustable state (what the user tweaks) ──────────────────────────────────
  const [sip, setSip] = useState(5000);
  const [lumpsum, setLumpsum] = useState(0);
  const [rate, setRate] = useState(12); // shared with baseline (market assumption)
  const [years, setYears] = useState(15);

  // Seed from portfolio summary
  useEffect(() => {
    if (seeded || portfolioLoading) return;
    const summary = portfolioData?.summary;
    if (!summary) return;

    const corpus = Math.round(summary.totalValue / 1000) * 1000;
    setSeededLumpsum(corpus);
    setLumpsum(corpus);

    if (Number.isFinite(summary.xirr) && summary.xirr > 0) {
      const pct = Math.min(20, Math.max(6, Math.round(summary.xirr * 100)));
      setRate(pct);
    }

    setSeeded(true);
  }, [portfolioData, portfolioLoading, seeded]);

  // Seed SIP once estimated (separate effect so corpus seeding isn't blocked)
  useEffect(() => {
    if (!seeded || estimatedSip == null || estimatedSip === 0) return;
    setSeededSip(estimatedSip);
    setSip(estimatedSip);
  }, [estimatedSip, seeded]);

  // ── Projections ───────────────────────────────────────────────────────────────
  //
  // "Current plan" baseline: locked to seeded SIP + seeded corpus.
  //   Rate IS shared — it's a market assumption that applies to both scenarios.
  // "Adjusted plan": whatever the user has set via the controls.
  //
  // Both start at year 0 = seededLumpsum (actual current corpus).

  const baselinePoints = useMemo(
    () => projectWealth(seededSip, seededLumpsum, rate, years),
    [seededSip, seededLumpsum, rate, years],
  );

  const adjustedPoints = useMemo(
    () => projectWealth(sip, lumpsum, rate, years),
    [sip, lumpsum, rate, years],
  );

  const milestones = useMemo(() => getMilestones(adjustedPoints), [adjustedPoints]);

  const horizonBaseline = baselinePoints[baselinePoints.length - 1]?.value ?? 0;
  const horizonAdjusted = adjustedPoints[adjustedPoints.length - 1]?.value ?? 0;
  const planDelta = horizonAdjusted - horizonBaseline;

  // Show two lines only when user has a real portfolio AND has changed something
  // (otherwise both lines overlap exactly and the chart looks broken)
  const scenarioChanged =
    sip !== seededSip || lumpsum !== seededLumpsum;
  const showTwoLines = hasPortfolio && seeded && scenarioChanged;

  // Chart data — prepend year-0 at the actual current corpus so the chart
  // starts from today's real value, not from zero.
  const year0Value = Math.round(seededLumpsum / 1000);

  const baselineChartData = [
    { value: year0Value, label: '0Y' },
    ...baselinePoints.map((p) => ({
      value: Math.round(p.value / 1000),
      label:
        p.year % 5 === 0 || p.year === 1 || p.year === years ? `${p.year}Y` : '',
    })),
  ];

  const adjustedChartData = [
    { value: Math.round(lumpsum / 1000) },
    ...adjustedPoints.map((p) => ({
      value: Math.round(p.value / 1000),
    })),
  ];

  // No explicit maxValue — let gifted-charts auto-scale so the y-axis floor
  // sits near the smallest data value (current corpus), giving visual room
  // to show year-0 meaningfully rather than squashed at the bottom.

  // Dynamic spacing so all year points fit without clipping.
  // Total chart points = 1 (year0) + years; minimum 16px per point.
  const totalChartPoints = 1 + years;
  const chartSpacing = Math.max(16, Math.floor((CHART_WIDTH - 56) / totalChartPoints));

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

        {/* Portfolio loading indicator */}
        {portfolioLoading && (
          <View style={[styles.card, styles.loadingCard]}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading your portfolio data…</Text>
          </View>
        )}

        {/* Portfolio context card */}
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

        {/* Controls */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {hasPortfolio ? 'Adjust Your Plan' : 'Your Investment Plan'}
          </Text>
          <InputControl
            label="Monthly SIP"
            value={sip}
            step={500}
            min={0}
            max={1000000}
            prefix="₹"
            onChange={setSip}
          />
          <InputControl
            label={hasPortfolio ? 'Existing Corpus' : 'One-time Lumpsum'}
            value={lumpsum}
            step={hasPortfolio ? 25000 : 10000}
            min={0}
            max={100000000}
            prefix="₹"
            onChange={setLumpsum}
          />
          <InputControl
            label="Expected Return"
            value={rate}
            step={1}
            min={1}
            max={30}
            suffix="% p.a."
            onChange={setRate}
          />
          <InputControl
            label="Investment Period"
            value={years}
            step={1}
            min={1}
            max={30}
            suffix=" yrs"
            onChange={setYears}
          />
        </View>

        {/* Milestones — from the adjusted plan */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {showTwoLines ? 'Adjusted Plan Projection' : 'Projected Wealth'}
          </Text>
          <View style={styles.milestonesGrid}>
            {milestones.map((m) => (
              <View key={m.year} style={styles.milestoneItem}>
                <Text style={styles.milestoneYear}>{m.year}Y</Text>
                <Text style={styles.milestoneValue}>{formatCurrency(m.value)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Growth chart */}
        <View style={[styles.card, { paddingHorizontal: 0 }]}>
          <Text style={[styles.sectionTitle, { paddingHorizontal: Spacing.md }]}>
            Growth Chart
          </Text>
          <Text style={[styles.chartNote, { paddingHorizontal: Spacing.md }]}>
            Values in ₹ thousands
          </Text>
          <View style={{ marginTop: Spacing.xs }}>
            <LineChart
              data={baselineChartData}
              data2={showTwoLines ? adjustedChartData : undefined}
              width={CHART_WIDTH - 32}
              height={180}
              color1={Colors.primary}
              color2={Colors.positive}
              dataPointsColor1={Colors.primary}
              dataPointsColor2={Colors.positive}
              dataPointsRadius={3}
              thickness={2}
              noOfSections={4}
              isAnimated
              curved
              yAxisLabelWidth={48}
              spacing={chartSpacing}
              initialSpacing={0}
              endSpacing={8}
              formatYLabel={(v: string) => {
                const n = Number(v);
                if (n >= 10000) return `${(n / 10000).toFixed(1)}Cr`;
                if (n >= 100) return `${(n / 100).toFixed(0)}L`;
                return `${n}L`;
              }}
              hideDataPoints={totalChartPoints > 20}
            />
          </View>
          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.legendLabel}>
                {showTwoLines ? 'Current plan' : 'Projected'}
              </Text>
            </View>
            {showTwoLines && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.positive }]} />
                <Text style={styles.legendLabel}>Adjusted plan</Text>
              </View>
            )}
          </View>
        </View>

        {/* Insight: difference between adjusted and baseline */}
        {showTwoLines && Math.abs(planDelta) > 0 && (
          <View
            style={[
              styles.insightCard,
              planDelta < 0 && { backgroundColor: 'rgba(192,57,43,0.08)' },
            ]}
          >
            <Ionicons
              name={planDelta >= 0 ? 'trending-up-outline' : 'trending-down-outline'}
              size={20}
              color={planDelta >= 0 ? Colors.primary : Colors.negative}
            />
            <Text style={styles.insightText}>
              {planDelta >= 0 ? (
                <>
                  Your adjusted plan grows your wealth by an extra{' '}
                  <Text style={styles.insightHighlight}>
                    {formatCurrency(planDelta)}
                  </Text>{' '}
                  over {years} years compared to continuing as-is.
                </>
              ) : (
                <>
                  Your adjusted plan results in{' '}
                  <Text style={[styles.insightHighlight, { color: Colors.negative }]}>
                    {formatCurrency(Math.abs(planDelta))}
                  </Text>{' '}
                  less over {years} years compared to continuing as-is.
                </>
              )}
            </Text>
          </View>
        )}

        {/* Generic insight for no-portfolio users */}
        {!showTwoLines && horizonAdjusted > 0 && (
          <View style={styles.insightCard}>
            <Ionicons name="bulb-outline" size={20} color={Colors.primary} />
            <Text style={styles.insightText}>
              At {rate}% p.a. your ₹{sip.toLocaleString('en-IN')}/month SIP
              could grow to{' '}
              <Text style={styles.insightHighlight}>
                {formatCurrency(horizonAdjusted)}
              </Text>{' '}
              in {years} years.
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
  stepValueTouchable: {
    minWidth: 96,
    alignItems: 'center',
  },
  stepValue: {
    ...Typography.body,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    minWidth: 96,
    textAlign: 'center',
  },
  stepInput: {
    ...Typography.body,
    fontWeight: '600' as const,
    color: Colors.primary,
    minWidth: 96,
    textAlign: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.primary,
    paddingVertical: 2,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' } as object),
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

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
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LineChart } from 'react-native-gifted-charts';
import Logo from '@/src/components/Logo';
import { Spacing, Radii, Typography } from '@/src/constants/theme';
import { useTheme } from '@/src/context/ThemeContext';
import type { AppColors } from '@/src/context/ThemeContext';
import { usePortfolio } from '@/src/hooks/usePortfolio';
import { useSession } from '@/src/hooks/useSession';
import { supabase } from '@/src/lib/supabase';
import { formatCurrency } from '@/src/utils/formatting';
import { projectWealth, getMilestones } from '@/src/utils/simulatorCalc';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - Spacing.md * 2;

// ─── SIP pattern detection ────────────────────────────────────────────────────
//
// A "SIP" is a purchase that recurs with the same amount on roughly the same
// day of the month (±2 days) across ≥3 of the last 12 months, per fund.
// Lumpsums are excluded because they rarely repeat at the same amount on the
// same day. We group by (fund_id, amount-bucket-₹100, day-bucket-3-day-window)
// so two schemes with identical SIP amounts are counted separately.

async function estimateMonthlySip(userId: string): Promise<number> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const { data } = await supabase
    .from('transaction')
    .select('transaction_date, amount, transaction_type, fund_id')
    .eq('user_id', userId)
    .eq('transaction_type', 'purchase')
    .gte('transaction_date', twelveMonthsAgo.toISOString().split('T')[0]);

  if (!data?.length) return 0;

  // Group by (fund_id, amountBucket ₹100, dayBucket 3-day window) → set of months
  const groups = new Map<string, { months: Set<string>; amounts: number[] }>();

  for (const tx of data) {
    const dateStr = tx.transaction_date as string;
    const month = dateStr.substring(0, 7);
    const day = parseInt(dateStr.substring(8, 10), 10);
    const amount = tx.amount as number;
    const fundId = (tx.fund_id as string) ?? 'unknown';

    const amountBucket = Math.round(amount / 100) * 100;
    const dayBucket = Math.round(day / 3) * 3;
    const key = `${fundId}|${amountBucket}|${dayBucket}`;

    if (!groups.has(key)) groups.set(key, { months: new Set(), amounts: [] });
    const g = groups.get(key)!;
    g.months.add(month);
    g.amounts.push(amount);
  }

  // Keep only patterns that recur in ≥3 distinct months — those are real SIPs.
  // For each fund, if multiple keys qualify, take the one with the most months
  // (handles SIP step-ups: the current instalment wins because it's most recent).
  const fundBestSip = new Map<string, { months: number; median: number }>();

  for (const [key, { months, amounts }] of groups) {
    if (months.size < 3) continue;

    const fundId = key.split('|')[0];
    const sorted = [...amounts].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];

    const prev = fundBestSip.get(fundId);
    if (!prev || months.size > prev.months) {
      fundBestSip.set(fundId, { months: months.size, median });
    }
  }

  const total = [...fundBestSip.values()].reduce((sum, { median }) => sum + median, 0);
  return Math.round(total / 500) * 500;
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
  const { colors } = useTheme();
  const stepStyles = useMemo(() => makeStepStyles(colors), [colors]);
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
    <View style={stepStyles.row}>
      <Text style={stepStyles.label}>{label}</Text>
      <View style={stepStyles.control}>
        <TouchableOpacity
          onPress={decrement}
          disabled={value <= min}
          style={[stepStyles.btn, value <= min && stepStyles.btnDisabled]}
          hitSlop={8}
        >
          <Ionicons
            name="remove"
            size={18}
            color={value <= min ? colors.textTertiary : colors.primary}
          />
        </TouchableOpacity>

        {editing ? (
          <TextInput
            style={stepStyles.input}
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
          <TouchableOpacity onPress={startEdit} hitSlop={4} style={stepStyles.valueTouchable}>
            <Text style={stepStyles.value}>{displayValue}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={increment}
          disabled={value >= max}
          style={[stepStyles.btn, value >= max && stepStyles.btnDisabled]}
          hitSlop={8}
        >
          <Ionicons
            name="add"
            size={18}
            color={value >= max ? colors.textTertiary : colors.primary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStepStyles(colors: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    label: {
      ...Typography.body,
      color: colors.textSecondary,
      flex: 1,
    },
    control: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    btn: {
      width: 32,
      height: 32,
      borderRadius: Radii.sm,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnDisabled: {
      backgroundColor: colors.borderLight,
    },
    value: {
      ...Typography.body,
      fontWeight: '600' as const,
      color: colors.textPrimary,
      minWidth: 96,
      textAlign: 'center',
    },
    valueTouchable: {
      minWidth: 96,
      alignItems: 'center' as const,
    },
    input: {
      ...Typography.body,
      fontWeight: '600' as const,
      color: colors.primary,
      minWidth: 96,
      textAlign: 'center' as const,
      borderBottomWidth: 1.5,
      borderBottomColor: colors.primary,
      paddingVertical: 2,
      ...(Platform.OS === 'web' && { outlineStyle: 'none' } as object),
    },
  });
}

// ─── Main screen ─────────────────────────────────────────────────────────────

type SyncState = 'idle' | 'syncing' | 'requested' | 'error';

export default function SimulatorScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { session } = useSession();
  const userId = session?.user.id;

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
    if (!profile?.kfintech_email) { router.push('/onboarding'); return; }
    setSyncState('syncing');
    const { error } = await supabase.functions.invoke('request-cas', {
      method: 'POST',
      body: { email: profile.kfintech_email },
    });
    setSyncState(error ? 'error' : 'requested');
    setTimeout(() => setSyncState('idle'), 4000);
  }

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
        colors={colors.gradientHeader}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.push('/(tabs)')} hitSlop={8}>
          <Logo size={28} showWordmark light />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity hitSlop={8} onPress={() => setOverflowOpen(true)}>
            <Ionicons name="ellipsis-horizontal" size={22} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} hitSlop={8}>
            <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

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
              onPress={() => { setOverflowOpen(false); handleSync(); }}
              disabled={syncState === 'syncing'}
            >
              {syncState === 'syncing' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="sync-outline" size={18} color={colors.textPrimary} />
              )}
              <Text style={styles.overflowItemText}>Sync Portfolio</Text>
            </TouchableOpacity>
            <View style={styles.overflowDivider} />
            <TouchableOpacity
              style={styles.overflowItem}
              onPress={() => { setOverflowOpen(false); router.push(profile?.kfintech_email ? '/onboarding/pdf' : '/onboarding'); }}
            >
              <Ionicons name="cloud-upload-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.overflowItemText}>Import CAS</Text>
            </TouchableOpacity>
            <View style={styles.overflowDivider} />
            <TouchableOpacity
              style={styles.overflowItem}
              onPress={() => { setOverflowOpen(false); router.push('/(tabs)/settings'); }}
            >
              <Ionicons name="settings-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.overflowItemText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading your portfolio data…</Text>
          </View>
        )}

        {/* Portfolio context card */}
        {!portfolioLoading && hasPortfolio && portfolioData?.summary && (
          <View style={styles.contextCard}>
            <View style={styles.contextHeader}>
              <Ionicons name="person-circle-outline" size={16} color={colors.primary} />
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
                  <Text style={[styles.contextStatValue, { color: colors.positive }]}>
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
              color1={colors.primary}
              color2={colors.positive}
              dataPointsColor1={colors.primary}
              dataPointsColor2={colors.positive}
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
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendLabel}>
                {showTwoLines ? 'Current plan' : 'Projected'}
              </Text>
            </View>
            {showTwoLines && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.positive }]} />
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
              color={planDelta >= 0 ? colors.primary : colors.negative}
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
                  <Text style={[styles.insightHighlight, { color: colors.negative }]}>
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
            <Ionicons name="bulb-outline" size={20} color={colors.primary} />
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
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    overflowBackdrop: { flex: 1 },
    overflowMenu: {
      position: 'absolute',
      top: 60,
      right: 16,
      backgroundColor: colors.surface,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
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
    overflowItemText: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' as const },
    overflowDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: Spacing.sm },
    scrollContent: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
    },
    titleBlock: {
      marginBottom: Spacing.md,
    },
    title: {
      ...Typography.h2,
      color: colors.textPrimary,
    },
    subtitle: {
      ...Typography.body,
      color: colors.textSecondary,
      marginTop: 4,
    },
    // ── Portfolio context card ─────────────────────────────────────────────
    contextCard: {
      backgroundColor: colors.primaryLight,
      borderRadius: Radii.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    contextHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: Spacing.sm,
    },
    contextLabel: {
      ...Typography.label,
      color: colors.primary,
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
      color: colors.textPrimary,
    },
    contextStatLabel: {
      ...Typography.caption,
      color: colors.textTertiary,
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
      color: colors.textSecondary,
    },
    // ── Card ──────────────────────────────────────────────────────────────
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radii.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      ...Typography.h3,
      color: colors.textPrimary,
      marginBottom: Spacing.sm,
    },
    milestonesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    milestoneItem: {
      flex: 1,
      minWidth: 100,
      backgroundColor: colors.primaryLight,
      borderRadius: Radii.sm,
      padding: Spacing.sm,
      alignItems: 'center',
    },
    milestoneYear: {
      ...Typography.label,
      color: colors.primary,
      marginBottom: 4,
    },
    milestoneValue: {
      ...Typography.bodySmall,
      fontWeight: '600' as const,
      color: colors.textPrimary,
    },
    chartNote: {
      ...Typography.caption,
      color: colors.textTertiary,
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
      color: colors.textSecondary,
    },
    insightCard: {
      backgroundColor: colors.primaryLight,
      borderRadius: Radii.md,
      padding: Spacing.md,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    insightText: {
      ...Typography.body,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 22,
    },
    insightHighlight: {
      ...Typography.body,
      fontWeight: '600' as const,
      color: colors.primary,
    },
  });
}

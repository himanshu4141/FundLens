import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LineChart } from 'react-native-gifted-charts';
import { AppOverflowMenu } from '@/src/components/AppOverflowMenu';
import { PrimaryShellHeader } from '@/src/components/PrimaryShellHeader';
import { Radii, Spacing, Typography } from '@/src/constants/theme';
import { useTheme } from '@/src/context/ThemeContext';
import type { AppColors } from '@/src/context/ThemeContext';
import { usePortfolio } from '@/src/hooks/usePortfolio';
import { useSession } from '@/src/hooks/useSession';
import { supabase } from '@/src/lib/supabase';
import {
  useAppStore,
  type WealthJourneyReturnPreset,
} from '@/src/store/appStore';
import { formatCurrency } from '@/src/utils/formatting';
import {
  getMilestones,
  projectRetirementIncome,
  projectWealth,
  toPresentValueEquivalent,
} from '@/src/utils/simulatorCalc';
import {
  buildReturnProfile,
  estimateRecurringMonthlySip,
  type ReturnPreset,
} from '@/src/utils/wealthJourney';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - Spacing.md * 2;
const FIXED_INFLATION_RATE = 6;

type SyncState = 'idle' | 'syncing' | 'requested' | 'error';

interface ChoiceChip {
  label: string;
  value: number;
}

interface ValueFieldProps {
  label: string;
  helperText?: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  chips: ChoiceChip[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatCompactCurrency(value: number): string {
  return formatCurrency(value).replace('.00', '').replace('.0K', 'K');
}

function formatPercent(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatAxisValue(value: number): string {
  if (value >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(1)}Cr`;
  if (value >= 1_00_000) return `${Math.round(value / 1_00_000)}L`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return `${Math.round(value)}`;
}

function ValueField({
  label,
  helperText,
  value,
  onChange,
  prefix,
  suffix,
  chips,
}: ValueFieldProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = useCallback(() => {
    const numeric = parseFloat(draft.replace(/[^0-9.]/g, ''));
    if (!Number.isNaN(numeric)) {
      onChange(numeric);
    } else {
      setDraft(String(value));
    }
  }, [draft, onChange, value]);

  return (
    <View style={styles.inputBlock}>
      <View style={styles.inputHeader}>
        <Text style={styles.inputLabel}>{label}</Text>
        {helperText ? <Text style={styles.inputHelper}>{helperText}</Text> : null}
      </View>
      <View style={styles.inputShell}>
        {prefix ? <Text style={styles.inputAffix}>{prefix}</Text> : null}
        <TextInput
          style={[styles.input, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="numeric"
          returnKeyType="done"
          {...(Platform.OS === 'web' ? { inputMode: 'numeric' } : null)}
        />
        {suffix ? <Text style={styles.inputAffix}>{suffix}</Text> : null}
      </View>
      <View style={styles.chipRow}>
        {chips.map((chip) => {
          const active = Math.abs(value - chip.value) < 0.001;
          return (
            <TouchableOpacity
              key={`${label}-${chip.label}`}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(chip.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function ReturnPresetField({
  presets,
  selectedPreset,
  value,
  onPresetChange,
  onCustomChange,
}: {
  presets: ReturnPreset[];
  selectedPreset: WealthJourneyReturnPreset | null;
  value: number;
  onPresetChange: (key: Exclude<WealthJourneyReturnPreset, 'custom'>, value: number) => void;
  onCustomChange: (value: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = useCallback(() => {
    const numeric = parseFloat(draft.replace(/[^0-9.]/g, ''));
    if (!Number.isNaN(numeric)) {
      onCustomChange(numeric);
    } else {
      setDraft(String(value));
    }
  }, [draft, onCustomChange, value]);

  return (
    <View style={styles.inputBlock}>
      <View style={styles.inputHeader}>
        <Text style={styles.inputLabel}>Expected return</Text>
        <Text style={styles.inputHelper}>Use a cautious long-term assumption.</Text>
      </View>
      <View style={styles.chipRow}>
        {presets.map((preset) => {
          const active = selectedPreset === preset.key;
          return (
            <TouchableOpacity
              key={preset.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onPresetChange(preset.key, preset.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {preset.label} · {formatPercent(preset.value)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.inputShell}>
        <TextInput
          style={[styles.input, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="numeric"
          returnKeyType="done"
          {...(Platform.OS === 'web' ? { inputMode: 'decimal' } : null)}
        />
        <Text style={styles.inputAffix}>% p.a.</Text>
      </View>
    </View>
  );
}

export default function WealthJourneyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useSession();
  const userId = session?.user.id;
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');

  const { wealthJourney, updateWealthJourney } = useAppStore();

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

  const { data: portfolioData, isLoading: portfolioLoading } = usePortfolio();
  const summary = portfolioData?.summary ?? null;
  const currentCorpus = summary?.totalValue ?? 0;
  const returnProfile = useMemo(() => buildReturnProfile(summary?.xirr), [summary?.xirr]);

  const sixMonthsAgo = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return date.toISOString().split('T')[0];
  }, []);

  const { data: transactions } = useQuery({
    queryKey: ['wealth-journey-transactions', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction')
        .select('transaction_date, amount, transaction_type, fund_id')
        .eq('user_id', userId!)
        .gte('transaction_date', sixMonthsAgo)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const detectedSip = useMemo(() => estimateRecurringMonthlySip(transactions ?? []), [transactions]);

  useEffect(() => {
    if (!wealthJourney.hasOpened) {
      updateWealthJourney({ hasOpened: true });
    }
  }, [updateWealthJourney, wealthJourney.hasOpened]);

  useEffect(() => {
    const patch: Record<string, number | WealthJourneyReturnPreset> = {};
    if (wealthJourney.expectedReturn == null) {
      patch.expectedReturn = returnProfile.presets.find(
        (preset) => preset.key === returnProfile.defaultPresetKey,
      )?.value ?? 10;
    }
    if (wealthJourney.expectedReturnPreset == null) {
      patch.expectedReturnPreset = returnProfile.defaultPresetKey;
    }
    if (wealthJourney.postRetirementReturn == null) {
      patch.postRetirementReturn = returnProfile.postRetirementDefault;
    }
    if (Object.keys(patch).length > 0) {
      updateWealthJourney(patch);
    }
  }, [
    returnProfile.defaultPresetKey,
    returnProfile.postRetirementDefault,
    returnProfile.presets,
    updateWealthJourney,
    wealthJourney.expectedReturn,
    wealthJourney.expectedReturnPreset,
    wealthJourney.postRetirementReturn,
  ]);

  const currentSip = wealthJourney.sipOverride ?? detectedSip ?? 0;
  const adjustedSip = currentSip;
  const additionalTopUp = wealthJourney.additionalTopUp;
  const yearsToRetirement = wealthJourney.yearsToRetirement;
  const expectedReturn =
    wealthJourney.expectedReturn ??
    returnProfile.presets.find((preset) => preset.key === returnProfile.defaultPresetKey)?.value ??
    10;
  const retirementDurationYears = wealthJourney.retirementDurationYears;
  const withdrawalRate = wealthJourney.withdrawalRate;
  const postRetirementReturn =
    wealthJourney.postRetirementReturn ?? returnProfile.postRetirementDefault;

  const baselinePoints = useMemo(
    () => projectWealth(detectedSip, currentCorpus, expectedReturn, yearsToRetirement, 0),
    [currentCorpus, detectedSip, expectedReturn, yearsToRetirement],
  );

  const adjustedPoints = useMemo(
    () =>
      projectWealth(
        adjustedSip,
        currentCorpus,
        expectedReturn,
        yearsToRetirement,
        additionalTopUp,
      ),
    [additionalTopUp, adjustedSip, currentCorpus, expectedReturn, yearsToRetirement],
  );

  const milestones = useMemo(() => getMilestones(adjustedPoints), [adjustedPoints]);
  const projectedCorpus = adjustedPoints[adjustedPoints.length - 1]?.value ?? currentCorpus;
  const baselineCorpus = baselinePoints[baselinePoints.length - 1]?.value ?? currentCorpus;
  const planDelta = projectedCorpus - baselineCorpus;
  const presentValueToday = toPresentValueEquivalent(
    projectedCorpus,
    FIXED_INFLATION_RATE,
    yearsToRetirement,
  );
  const retirementProjection = useMemo(
    () =>
      projectRetirementIncome(
        projectedCorpus,
        withdrawalRate,
        retirementDurationYears,
        postRetirementReturn,
      ),
    [projectedCorpus, withdrawalRate, retirementDurationYears, postRetirementReturn],
  );

  const scenarioChanged =
    wealthJourney.sipOverride != null ||
    additionalTopUp > 0 ||
    wealthJourney.hasSavedPlan;

  const chartSpacing = Math.max(
    16,
    Math.floor((CHART_WIDTH - 48) / Math.max(yearsToRetirement, 6)),
  );
  const baselineChartData = [
    { value: currentCorpus, label: 'Today' },
    ...baselinePoints.map((point) => ({
      value: point.value,
      label:
        point.year === 5 ||
        point.year === 10 ||
        point.year === yearsToRetirement
          ? `${point.year}Y`
          : '',
    })),
  ];
  const adjustedChartData = [
    { value: currentCorpus, label: 'Today' },
    ...adjustedPoints.map((point) => ({
      value: point.value,
      label:
        point.year === 5 ||
        point.year === 10 ||
        point.year === yearsToRetirement
          ? `${point.year}Y`
          : '',
    })),
  ];

  const monthlySipChips = useMemo<ChoiceChip[]>(() => {
    const base = detectedSip > 0 ? detectedSip : 50000;
    return [
      { label: formatCompactCurrency(Math.max(25000, Math.round(base * 0.75))), value: Math.max(25000, Math.round(base * 0.75)) },
      { label: formatCompactCurrency(base), value: base },
      { label: formatCompactCurrency(Math.round(base * 1.5)), value: Math.round(base * 1.5) },
    ];
  }, [detectedSip]);

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

  const markSaved = useCallback(
    (patch: Parameters<typeof updateWealthJourney>[0]) => {
      updateWealthJourney({ ...patch, hasSavedPlan: true });
    },
    [updateWealthJourney],
  );

  return (
    <SafeAreaView style={styles.container}>
      <PrimaryShellHeader
        onPressLogo={() => router.push('/(tabs)')}
        onPressMenu={() => setOverflowOpen(true)}
      />

      <AppOverflowMenu
        visible={overflowOpen}
        syncState={syncState}
        onClose={() => setOverflowOpen(false)}
        onSync={handleSync}
        onImport={() =>
          router.push(profile?.kfintech_email ? '/onboarding/pdf' : '/onboarding')
        }
        onSettings={() => router.push('/(tabs)/settings')}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Wealth Journey</Text>
          <Text style={styles.subtitle}>
            See how small changes to your plan affect your future corpus and retirement
            income.
          </Text>
        </View>

        {portfolioLoading ? (
          <View style={[styles.card, styles.loadingCard]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Reading your portfolio and recent SIP pattern…</Text>
          </View>
        ) : (
          <View style={styles.contextCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your portfolio today</Text>
              <Text style={styles.sectionCaption}>Pre-filled from your current holdings.</Text>
            </View>
            <View style={styles.contextStats}>
              <View style={styles.contextStat}>
                <Text style={styles.contextValue}>{formatCurrency(currentCorpus)}</Text>
                <Text style={styles.contextLabel}>Current corpus</Text>
              </View>
              <View style={styles.contextStat}>
                <Text style={styles.contextValue}>{formatCurrency(currentSip)}/mo</Text>
                <Text style={styles.contextLabel}>Detected monthly SIP</Text>
              </View>
              <View style={styles.contextStat}>
                <Text style={[styles.contextValue, { color: colors.positive }]}>
                  {Number.isFinite(summary?.xirr) ? `${(summary!.xirr * 100).toFixed(1)}%` : formatPercent(expectedReturn)}
                </Text>
                <Text style={styles.contextLabel}>Current XIRR</Text>
              </View>
            </View>
            <View style={styles.noteRow}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
              <Text style={styles.noteText}>
                {wealthJourney.sipOverride != null
                  ? `Detected ${formatCurrency(detectedSip)}/mo from recurring buys across the last 6 months — using your override.`
                  : 'Detected from recurring buys across the last 6 months.'}
              </Text>
            </View>
            {wealthJourney.sipOverride != null ? (
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => updateWealthJourney({ sipOverride: null })}
              >
                <Text style={styles.resetButtonText}>Reset to detected SIP</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Adjust your plan</Text>
            <Text style={styles.sectionCaption}>
              Use quick presets or type your own numbers.
            </Text>
          </View>

          <ValueField
            label="Monthly SIP"
            helperText="Use your real pace or override it if detection is off."
            value={adjustedSip}
            onChange={(value) => markSaved({ sipOverride: clamp(Math.round(value), 0, 25_00_000) })}
            prefix="₹"
            chips={monthlySipChips}
          />

          <ValueField
            label="Additional top-up"
            helperText="Extra money you plan to add now."
            value={additionalTopUp}
            onChange={(value) => markSaved({ additionalTopUp: clamp(Math.round(value), 0, 10_00_00_000) })}
            prefix="₹"
            chips={[
              { label: '₹0', value: 0 },
              { label: '₹5L', value: 5_00_000 },
              { label: '₹10L', value: 10_00_000 },
              { label: '₹25L', value: 25_00_000 },
            ]}
          />

          <ValueField
            label="Years to retirement"
            helperText="This is your accumulation window."
            value={yearsToRetirement}
            onChange={(value) => markSaved({ yearsToRetirement: clamp(Math.round(value), 1, 40) })}
            suffix="years"
            chips={[
              { label: '10Y', value: 10 },
              { label: '15Y', value: 15 },
              { label: '20Y', value: 20 },
              { label: '25Y', value: 25 },
            ]}
          />

          <ReturnPresetField
            presets={returnProfile.presets}
            selectedPreset={wealthJourney.expectedReturnPreset}
            value={expectedReturn}
            onPresetChange={(presetKey, value) =>
              markSaved({ expectedReturn: value, expectedReturnPreset: presetKey })
            }
            onCustomChange={(value) =>
              markSaved({
                expectedReturn: clamp(Number(value.toFixed(1)), 4, 18),
                expectedReturnPreset: 'custom',
              })
            }
          />
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Projected wealth</Text>
            <Text style={styles.sectionCaption}>
              Both lines start from your current portfolio value today.
            </Text>
          </View>

          <Text style={styles.outcomeValue}>{formatCurrency(projectedCorpus)}</Text>
          <Text style={styles.outcomeSubtle}>
            {scenarioChanged
              ? `${planDelta >= 0 ? '+' : '-'}${formatCurrency(Math.abs(planDelta))} vs current plan over ${yearsToRetirement} years`
              : `Based on your current corpus and ${formatCurrency(adjustedSip)}/month`}
          </Text>

          <View style={styles.noteRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
            <Text style={styles.noteText}>
              Nominal, pre-tax. At {FIXED_INFLATION_RATE}% inflation, {formatCurrency(projectedCorpus)} in{' '}
              {yearsToRetirement}y ≈ {formatCurrency(presentValueToday)} today.
            </Text>
          </View>

          <View style={styles.milestonesGrid}>
            {milestones.map((milestone) => (
              <View key={milestone.year} style={styles.milestoneItem}>
                <Text style={styles.milestoneYear}>{milestone.year}Y</Text>
                <Text style={styles.milestoneValue}>{formatCurrency(milestone.value)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.chartWrap}>
            <LineChart
              data={baselineChartData}
              data2={adjustedChartData}
              width={CHART_WIDTH - 32}
              height={208}
              curved
              isAnimated
              hideDataPoints={yearsToRetirement > 18}
              color1={colors.textTertiary}
              color2={colors.primary}
              dataPointsColor1={colors.textTertiary}
              dataPointsColor2={colors.primary}
              thickness1={2.5}
              thickness2={3}
              yAxisLabelWidth={56}
              noOfSections={4}
              spacing={chartSpacing}
              initialSpacing={0}
              endSpacing={8}
              xAxisLabelTextStyle={styles.chartAxisText}
              yAxisTextStyle={styles.chartAxisText}
              xAxisLabelsHeight={18}
              labelsExtraHeight={40}
              xAxisColor={colors.borderLight}
              yAxisColor="transparent"
              hideRules={false}
              rulesColor={colors.borderLight}
              formatYLabel={(value) => formatAxisValue(Number(value))}
            />
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.textTertiary }]} />
                <Text style={styles.legendText}>Current plan</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={styles.legendText}>Adjusted plan</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Retirement income</Text>
            <Text style={styles.sectionCaption}>
              Turn your projected corpus into a simple drawdown scenario.
            </Text>
          </View>

          <Text style={styles.outcomeValue}>{formatCurrency(retirementProjection.monthlyIncome)}/mo</Text>
          <Text style={styles.outcomeSubtle}>
            {retirementProjection.riskLabel} withdrawal pace · {formatPercent(withdrawalRate)} withdrawal rate
          </Text>

          <ValueField
            label="Retirement duration"
            helperText="How long should your withdrawals last?"
            value={retirementDurationYears}
            onChange={(value) =>
              markSaved({ retirementDurationYears: clamp(Math.round(value), 5, 40) })
            }
            suffix="years"
            chips={[
              { label: '20Y', value: 20 },
              { label: '25Y', value: 25 },
              { label: '30Y', value: 30 },
            ]}
          />

          <ValueField
            label="Withdrawal rate"
            helperText="Annual withdrawal as a percentage of retirement corpus."
            value={withdrawalRate}
            onChange={(value) =>
              markSaved({ withdrawalRate: clamp(Number(value.toFixed(1)), 2, 8) })
            }
            suffix="%"
            chips={[
              { label: '3%', value: 3 },
              { label: '4%', value: 4 },
              { label: '5%', value: 5 },
            ]}
          />

          <ValueField
            label="Post-retirement return"
            helperText="Use a more conservative rate after retirement."
            value={postRetirementReturn}
            onChange={(value) =>
              markSaved({ postRetirementReturn: clamp(Number(value.toFixed(1)), 3, 12) })
            }
            suffix="% p.a."
            chips={[
              { label: '5%', value: 5 },
              { label: '6%', value: 6 },
              { label: '7%', value: 7 },
            ]}
          />

          <View style={styles.retirementSummaryRow}>
            <View style={styles.retirementSummaryItem}>
              <Text style={styles.retirementSummaryLabel}>Retirement corpus</Text>
              <Text style={styles.retirementSummaryValue}>
                {formatCurrency(retirementProjection.retirementCorpus)}
              </Text>
            </View>
            <View style={styles.retirementSummaryItem}>
              <Text style={styles.retirementSummaryLabel}>Residual corpus</Text>
              <Text style={styles.retirementSummaryValue}>
                {formatCurrency(retirementProjection.endCorpus)}
              </Text>
            </View>
          </View>

          <View style={styles.noteRow}>
            <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
            <Text style={styles.noteText}>
              {retirementProjection.depletionYear == null
                ? `This path leaves ${formatCurrency(retirementProjection.endCorpus)} after ${retirementDurationYears} years.`
                : `At this pace the corpus runs out around year ${retirementProjection.depletionYear}.`}
            </Text>
          </View>
        </View>

        <View style={styles.bottomPad} />
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
    scrollContent: {
      paddingBottom: Spacing.xl,
    },
    titleBlock: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.lg,
      gap: 6,
    },
    title: {
      ...Typography.h1,
      color: colors.textPrimary,
    },
    subtitle: {
      ...Typography.body,
      color: colors.textSecondary,
      lineHeight: 24,
    },
    card: {
      marginHorizontal: Spacing.md,
      marginTop: Spacing.md,
      padding: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: Spacing.md,
    },
    contextCard: {
      marginHorizontal: Spacing.md,
      marginTop: Spacing.md,
      padding: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.primaryLight,
      gap: Spacing.md,
    },
    sectionHeader: {
      gap: 4,
    },
    sectionTitle: {
      ...Typography.h2,
      color: colors.textPrimary,
    },
    sectionCaption: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    contextStats: {
      flexDirection: 'row',
      gap: Spacing.sm,
      flexWrap: 'wrap',
    },
    contextStat: {
      minWidth: 100,
      flex: 1,
      gap: 4,
    },
    contextValue: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    contextLabel: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
    },
    noteRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
    },
    noteText: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 19,
    },
    resetButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radii.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    resetButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    loadingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    loadingText: {
      ...Typography.body,
      color: colors.textSecondary,
    },
    inputBlock: {
      gap: Spacing.sm,
      paddingTop: Spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    inputHeader: {
      gap: 3,
    },
    inputLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    inputHelper: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
      lineHeight: 18,
    },
    inputShell: {
      minHeight: 52,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    inputAffix: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    input: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      paddingVertical: 0,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radii.full,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: '#fff',
    },
    outcomeValue: {
      fontSize: 34,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -1,
    },
    outcomeSubtle: {
      ...Typography.body,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    milestonesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    milestoneItem: {
      flexBasis: '48%',
      flexGrow: 1,
      minWidth: 130,
      padding: Spacing.md,
      borderRadius: Radii.md,
      backgroundColor: colors.primaryLight,
      gap: 4,
    },
    milestoneYear: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    milestoneValue: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    chartWrap: {
      marginTop: Spacing.xs,
    },
    chartAxisText: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    chartLegend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.lg,
      marginTop: Spacing.md,
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
    legendText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    retirementSummaryRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    retirementSummaryItem: {
      flex: 1,
      padding: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      gap: 6,
    },
    retirementSummaryLabel: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
    },
    retirementSummaryValue: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    bottomPad: {
      height: 28,
    },
  });
}

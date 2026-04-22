import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
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
  buildSipPresetChips,
  buildSipTargetChips,
  buildReturnProfile,
  estimateRecurringMonthlySip,
  type ReturnPreset,
} from '@/src/utils/wealthJourney';

const FIXED_INFLATION_RATE = 6;
const MOBILE_CHART_BREAKPOINT = 430;

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

function formatPercent(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatAxisValue(value: number): string {
  if (value >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(1)}Cr`;
  if (value >= 1_00_000) return `${Math.round(value / 1_00_000)}L`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return `${Math.round(value)}`;
}

function buildCheckpointYears(horizonYears: number, compact: boolean) {
  if (!compact) {
    return Array.from({ length: horizonYears + 1 }, (_, idx) => idx);
  }

  const checkpoints = new Set<number>([0, horizonYears]);
  const interval = horizonYears <= 12 ? 3 : 5;

  for (let year = interval; year < horizonYears; year += interval) {
    checkpoints.add(year);
  }

  return [...checkpoints].sort((a, b) => a - b);
}

function formatCheckpointLabel(year: number, startLabel: string) {
  if (year === 0) return startLabel;
  return `${year}Y`;
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
  const { width: viewportWidth } = useWindowDimensions();
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

  const currentSip = wealthJourney.currentSipOverride ?? detectedSip ?? 0;
  const monthlySipIncrease = wealthJourney.monthlySipIncrease;
  const futureSipTarget =
    wealthJourney.futureSipTarget ??
    clamp(currentSip + monthlySipIncrease, 0, 25_00_000);
  const adjustedSip = futureSipTarget;
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

  useEffect(() => {
    if (wealthJourney.futureSipTarget == null && wealthJourney.monthlySipIncrease !== 0) {
      updateWealthJourney({
        futureSipTarget: clamp(currentSip + wealthJourney.monthlySipIncrease, 0, 25_00_000),
        monthlySipIncrease: 0,
      });
    }
  }, [
    currentSip,
    updateWealthJourney,
    wealthJourney.futureSipTarget,
    wealthJourney.monthlySipIncrease,
  ]);

  const baselinePoints = useMemo(
    () => projectWealth(currentSip, currentCorpus, expectedReturn, yearsToRetirement, 0),
    [currentCorpus, currentSip, expectedReturn, yearsToRetirement],
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
    wealthJourney.currentSipOverride != null ||
    adjustedSip !== currentSip ||
    additionalTopUp > 0 ||
    wealthJourney.hasSavedPlan;

  const screenWidth = Math.max(320, viewportWidth || 360);
  const chartOuterWidth = screenWidth - Spacing.md * 2;
  const isCompactChart = screenWidth <= MOBILE_CHART_BREAKPOINT;
  const chartWidth = chartOuterWidth - (isCompactChart ? 96 : 88);
  const chartPlotWidth = chartWidth - 72;
  const accumulationYears = useMemo(
    () => buildCheckpointYears(yearsToRetirement, isCompactChart),
    [yearsToRetirement, isCompactChart],
  );
  const baselineChartData = accumulationYears.map((year) => ({
    value:
      year === 0
        ? currentCorpus
        : baselinePoints.find((point) => point.year === year)?.value ?? currentCorpus,
    label: formatCheckpointLabel(year, 'Now'),
  }));
  const adjustedChartData = accumulationYears.map((year) => ({
    value:
      year === 0
        ? currentCorpus
        : adjustedPoints.find((point) => point.year === year)?.value ?? currentCorpus,
    label: formatCheckpointLabel(year, 'Now'),
  }));
  const accumulationChartSpacing = Math.max(
    isCompactChart ? 30 : 18,
    Math.floor(chartPlotWidth / Math.max(adjustedChartData.length - 1, 1)),
  );
  const accumulationXAxisLabels = baselineChartData.map((point) => point.label);

  const currentSipChips = useMemo<ChoiceChip[]>(
    () => buildSipPresetChips(detectedSip > 0 ? detectedSip : currentSip || 100000),
    [currentSip, detectedSip],
  );
  const futureSipChips = useMemo<ChoiceChip[]>(
    () => buildSipTargetChips(currentSip || 100000),
    [currentSip],
  );
  const drawdownYears = useMemo(
    () => buildCheckpointYears(retirementDurationYears, isCompactChart),
    [retirementDurationYears, isCompactChart],
  );
  const drawdownChartData = drawdownYears.map((year) => ({
    value: retirementProjection.trajectory.find((point) => point.year === year)?.value ?? 0,
    label: formatCheckpointLabel(year, 'Start'),
  }));
  const drawdownChartSpacing = Math.max(
    isCompactChart ? 30 : 18,
    Math.floor(chartPlotWidth / Math.max(drawdownChartData.length - 1, 1)),
  );
  const drawdownXAxisLabels = drawdownChartData.map((point) => point.label);

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
            See how small changes to your plan affect your future corpus and withdrawal
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
                {wealthJourney.currentSipOverride != null
                  ? `Detected ${formatCurrency(detectedSip)}/mo from recurring buys across the last 6 months — using your override.`
                  : 'Detected from recurring buys across the last 6 months.'}
              </Text>
            </View>
            <ValueField
              label="Current monthly SIP"
              helperText="Fix the system's estimate here. This does not change your future plan yet."
              value={currentSip}
              onChange={(value) =>
                updateWealthJourney({
                  currentSipOverride: clamp(Math.round(value), 0, 25_00_000),
                })
              }
              prefix="₹"
              chips={currentSipChips}
            />
            {wealthJourney.currentSipOverride != null ? (
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => updateWealthJourney({ currentSipOverride: null })}
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

          <View style={styles.planCompareCard}>
            <View style={styles.planCompareItem}>
              <Text style={styles.planCompareLabel}>Current plan</Text>
              <Text style={styles.planCompareValue}>{formatCurrency(currentSip)}/mo</Text>
            </View>
            <View style={styles.planCompareDivider} />
            <View style={styles.planCompareItem}>
              <Text style={styles.planCompareLabel}>Going forward</Text>
              <Text style={styles.planCompareValue}>{formatCurrency(adjustedSip)}/mo</Text>
            </View>
          </View>

          <ValueField
            label="Monthly SIP going forward"
            helperText="Set the SIP you want from now on. This can be lower, higher, or zero."
            value={adjustedSip}
            onChange={(value) =>
              markSaved({ futureSipTarget: clamp(Math.round(value), 0, 25_00_000) })
            }
            prefix="₹"
            chips={futureSipChips}
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
            label="Saving period"
            helperText="How long you'll keep investing before withdrawals begin."
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
              ? `${planDelta >= 0 ? '+' : '-'}${formatCurrency(Math.abs(planDelta))} vs keeping your current plan for ${yearsToRetirement} years`
              : `Based on your current corpus and ${formatCurrency(currentSip)}/month`}
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
              width={chartWidth}
              parentWidth={chartWidth}
              adjustToWidth={isCompactChart}
              disableScroll={isCompactChart}
              bounces={false}
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
              spacing={accumulationChartSpacing}
              initialSpacing={isCompactChart ? 8 : 0}
              endSpacing={isCompactChart ? 8 : 0}
              xAxisLabelTexts={accumulationXAxisLabels}
              xAxisLabelTextStyle={styles.chartAxisText}
              yAxisTextStyle={styles.chartAxisText}
              xAxisLabelsHeight={isCompactChart ? 20 : 24}
              labelsExtraHeight={isCompactChart ? 34 : 40}
              xAxisLabelsVerticalShift={isCompactChart ? 4 : 8}
              xAxisColor={colors.borderLight}
              yAxisColor="transparent"
              hideRules={false}
              rulesColor={colors.borderLight}
              formatYLabel={(value) => formatAxisValue(Number(value))}
              pointerConfig={{
                showPointerStrip: true,
                pointerStripHeight: 236,
                pointerStripWidth: 1,
                pointerStripColor: colors.textTertiary + '88',
                pointerColor: colors.primary,
                radius: 5,
                pointerLabelWidth: 150,
                pointerLabelHeight: 54,
                activatePointersOnLongPress: true,
                autoAdjustPointerLabelPosition: true,
                pointerLabelComponent: (_items: unknown, _sec: unknown, pointerIndex: number) => {
                  const baselinePoint = baselineChartData[pointerIndex];
                  const adjustedPoint = adjustedChartData[pointerIndex];
                  const horizonLabel = baselinePoint?.label ?? `Year ${pointerIndex}`;

                  return (
                    <View style={styles.pointerLabel}>
                      <Text style={styles.pointerDate}>{horizonLabel}</Text>
                      {baselinePoint ? (
                        <Text style={styles.pointerSeriesText}>
                          <Text style={{ color: colors.textTertiary }}>● </Text>
                          Current: {formatCurrency(baselinePoint.value)}
                        </Text>
                      ) : null}
                      {adjustedPoint ? (
                        <Text style={styles.pointerSeriesText}>
                          <Text style={{ color: colors.primary }}>● </Text>
                          Adjusted: {formatCurrency(adjustedPoint.value)}
                        </Text>
                      ) : null}
                    </View>
                  );
                },
              }}
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
            <Text style={styles.sectionTitle}>Withdrawal income</Text>
            <Text style={styles.sectionCaption}>
              Turn your projected corpus into a simple withdrawal scenario.
            </Text>
          </View>

          <Text style={styles.outcomeValue}>{formatCurrency(retirementProjection.monthlyIncome)}/mo</Text>
          <Text style={styles.outcomeSubtle}>
            {retirementProjection.riskLabel} withdrawal pace · {formatPercent(withdrawalRate)} withdrawal rate
          </Text>

          <ValueField
            label="Withdrawal duration"
            helperText="How long should withdrawals last?"
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
            helperText="Annual withdrawal as a percentage of the starting corpus."
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
            label="Post-withdrawal return"
            helperText="Use a more conservative rate during withdrawals."
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
              <Text style={styles.retirementSummaryLabel}>Corpus at start</Text>
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
          <View style={styles.drawdownChartWrap}>
            <Text style={styles.drawdownTitle}>Drawdown path</Text>
            <LineChart
              data={drawdownChartData}
              width={chartWidth}
              parentWidth={chartWidth}
              adjustToWidth={isCompactChart}
              disableScroll={isCompactChart}
              bounces={false}
              height={176}
              curved
              isAnimated
              hideDataPoints={retirementDurationYears > 20}
              color1={colors.primary}
              dataPointsColor1={colors.primary}
              thickness1={3}
              yAxisLabelWidth={56}
              noOfSections={4}
              spacing={drawdownChartSpacing}
              initialSpacing={isCompactChart ? 8 : 0}
              endSpacing={isCompactChart ? 8 : 0}
              xAxisLabelTexts={drawdownXAxisLabels}
              xAxisLabelTextStyle={styles.chartAxisText}
              yAxisTextStyle={styles.chartAxisText}
              xAxisLabelsHeight={isCompactChart ? 20 : 24}
              labelsExtraHeight={isCompactChart ? 34 : 40}
              xAxisLabelsVerticalShift={isCompactChart ? 4 : 8}
              xAxisColor={colors.borderLight}
              yAxisColor="transparent"
              hideRules={false}
              rulesColor={colors.borderLight}
              formatYLabel={(value) => formatAxisValue(Number(value))}
              pointerConfig={{
                showPointerStrip: true,
                pointerStripHeight: 204,
                pointerStripWidth: 1,
                pointerStripColor: colors.textTertiary + '88',
                pointerColor: colors.primary,
                radius: 5,
                pointerLabelWidth: 144,
                pointerLabelHeight: 40,
                activatePointersOnLongPress: true,
                autoAdjustPointerLabelPosition: true,
                pointerLabelComponent: (_items: unknown, _sec: unknown, pointerIndex: number) => {
                  const point = drawdownChartData[pointerIndex];
                  if (!point) return null;
                  const horizonLabel = point.label ?? `Year ${pointerIndex}`;

                  return (
                    <View style={styles.pointerLabel}>
                      <Text style={styles.pointerDate}>{horizonLabel}</Text>
                      <Text style={styles.pointerSeriesText}>
                        <Text style={{ color: colors.primary }}>● </Text>
                        Corpus: {formatCurrency(point.value)}
                      </Text>
                    </View>
                  );
                },
              }}
            />
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
    planCompareCard: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.primaryLight,
      overflow: 'hidden',
    },
    planCompareItem: {
      flex: 1,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      gap: 4,
    },
    planCompareDivider: {
      width: 1,
      backgroundColor: colors.border,
    },
    planCompareLabel: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    planCompareValue: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
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
      overflow: 'hidden',
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
    pointerLabel: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: Radii.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
      gap: 2,
    },
    pointerDate: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textTertiary,
    },
    pointerSeriesText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    drawdownChartWrap: {
      marginTop: Spacing.sm,
      overflow: 'hidden',
      gap: Spacing.xs,
    },
    drawdownTitle: {
      ...Typography.body,
      fontWeight: '700',
      color: colors.textPrimary,
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

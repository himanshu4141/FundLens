import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LineChart } from 'react-native-gifted-charts';
import { AppOverflowMenu } from '@/src/components/AppOverflowMenu';
import {
  ClearLensScreen,
  ClearLensCard,
  ClearLensHeader,
  ClearLensSegmentedControl,
} from '@/src/components/clearLens/ClearLensPrimitives';
import { usePortfolio } from '@/src/hooks/usePortfolio';
import { useSession } from '@/src/hooks/useSession';
import { supabase } from '@/src/lib/supabase';
import { useAppStore, type WealthJourneyReturnPreset } from '@/src/store/appStore';
import { formatCurrency } from '@/src/utils/formatting';
import {
  getMilestones,
  projectRetirementIncome,
  projectWealth,
  toPresentValueEquivalent,
} from '@/src/utils/simulatorCalc';
import {
  buildReturnProfile,
  buildSipPresetChips,
  buildSipTargetChips,
  estimateRecurringMonthlySip,
  type ReturnPreset,
} from '@/src/utils/wealthJourney';
import {
  ClearLensColors,
  ClearLensSpacing,
  ClearLensTypography,
  ClearLensRadii,
  ClearLensShadow,
  ClearLensFonts,
} from '@/src/constants/clearLensTheme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIXED_INFLATION_RATE = 6;
const MAX_SIP = 25_00_000;
const MAX_TOP_UP = 10_00_00_000;

type ScreenMode = 'summary' | 'adjust';
type ResultsView = 'growth' | 'withdrawal';
type SipEditorMode = 'review' | 'manual' | null;
type SyncState = 'idle' | 'syncing' | 'requested' | 'error';

interface ChoiceChip {
  label: string;
  value: number;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

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

function buildVisibleYears(horizonYears: number): number[] {
  if (horizonYears <= 6) {
    return Array.from({ length: horizonYears + 1 }, (_, idx) => idx);
  }
  const interval =
    horizonYears <= 8 ? 2 : horizonYears <= 15 ? 3 : horizonYears <= 25 ? 5 : 6;
  const years = new Set<number>([0, horizonYears]);
  for (let year = interval; year < horizonYears; year += interval) {
    years.add(year);
  }
  return [...years].sort((a, b) => a - b);
}

function formatCheckpointLabel(year: number, startLabel: string) {
  if (year === 0) return startLabel;
  return `${year}Y`;
}

function spacingFor(width: number, pointCount: number) {
  return Math.max(28, Math.floor((width - 84) / Math.max(pointCount - 1, 1)));
}

// ---------------------------------------------------------------------------
// ValueField
// ---------------------------------------------------------------------------

interface ValueFieldProps {
  label: string;
  helperText?: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  chips: ChoiceChip[];
}

function ValueField({ label, helperText, value, onChange, prefix, suffix, chips }: ValueFieldProps) {
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
    <View style={styles.fieldBlock}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {helperText ? <Text style={styles.fieldHelper}>{helperText}</Text> : null}
      </View>
      <View style={styles.fieldShell}>
        {prefix ? <Text style={styles.fieldAffix}>{prefix}</Text> : null}
        <TextInput
          style={[styles.fieldInput, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="numeric"
          returnKeyType="done"
          placeholderTextColor={ClearLensColors.textTertiary}
          {...(Platform.OS === 'web' ? { inputMode: 'numeric' } : null)}
        />
        {suffix ? <Text style={styles.fieldAffix}>{suffix}</Text> : null}
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
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ReturnPresetField
// ---------------------------------------------------------------------------

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
    <View style={styles.fieldBlock}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>Expected return</Text>
        <Text style={styles.fieldHelper}>Use a cautious long-term assumption.</Text>
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
      <View style={styles.fieldShell}>
        <TextInput
          style={[styles.fieldInput, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="numeric"
          returnKeyType="done"
          placeholderTextColor={ClearLensColors.textTertiary}
          {...(Platform.OS === 'web' ? { inputMode: 'decimal' } : null)}
        />
        <Text style={styles.fieldAffix}>% p.a.</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// JourneyChart
// ---------------------------------------------------------------------------

function JourneyChart({
  data,
  data2,
  chartWidth,
  compact,
  labels,
  pointerHeight,
  primaryLabel,
  secondaryLabel,
}: {
  data: { value: number; label: string }[];
  data2?: { value: number; label: string }[];
  chartWidth: number;
  compact: boolean;
  labels: string[];
  pointerHeight: number;
  primaryLabel: string;
  secondaryLabel?: string;
}) {
  const spacing = useMemo(() => spacingFor(chartWidth, data.length), [chartWidth, data.length]);

  return (
    <LineChart
      data={data}
      data2={data2}
      width={chartWidth}
      parentWidth={chartWidth}
      adjustToWidth
      disableScroll
      bounces={false}
      height={compact ? 220 : 236}
      curved
      isAnimated
      hideDataPoints
      color1={data2 ? ClearLensColors.textTertiary : ClearLensColors.emerald}
      color2={ClearLensColors.emerald}
      thickness1={data2 ? 2.5 : 3}
      thickness2={3}
      yAxisLabelWidth={56}
      noOfSections={4}
      spacing={spacing}
      initialSpacing={10}
      endSpacing={10}
      xAxisLabelTexts={labels}
      xAxisLabelTextStyle={styles.chartAxisText}
      yAxisTextStyle={styles.chartAxisText}
      xAxisLabelsHeight={24}
      labelsExtraHeight={36}
      xAxisLabelsVerticalShift={8}
      xAxisColor={ClearLensColors.borderLight}
      yAxisColor="transparent"
      hideRules={false}
      rulesColor={ClearLensColors.borderLight}
      formatYLabel={(value) => formatAxisValue(Number(value))}
      pointerConfig={{
        showPointerStrip: true,
        pointerStripHeight: pointerHeight,
        pointerStripWidth: 1,
        pointerStripColor: `${ClearLensColors.textTertiary}88`,
        pointerColor: ClearLensColors.emerald,
        radius: 4,
        pointerLabelWidth: data2 ? 152 : 144,
        pointerLabelHeight: data2 ? 56 : 40,
        activatePointersOnLongPress: true,
        autoAdjustPointerLabelPosition: true,
        pointerLabelComponent: (_items: unknown, _sec: unknown, pointerIndex: number) => {
          const first = data[pointerIndex];
          const second = data2?.[pointerIndex];
          if (!first) return null;
          return (
            <View style={styles.pointerLabel}>
              <Text style={styles.pointerDate}>{first.label}</Text>
              {data2 ? (
                <>
                  <Text style={styles.pointerSeriesText}>
                    <Text style={{ color: ClearLensColors.textTertiary }}>● </Text>
                    {primaryLabel}: {formatCurrency(first.value)}
                  </Text>
                  {second ? (
                    <Text style={styles.pointerSeriesText}>
                      <Text style={{ color: ClearLensColors.emerald }}>● </Text>
                      {secondaryLabel}: {formatCurrency(second.value)}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.pointerSeriesText}>
                  <Text style={{ color: ClearLensColors.emerald }}>● </Text>
                  {primaryLabel}: {formatCurrency(first.value)}
                </Text>
              )}
            </View>
          );
        },
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function ClearLensWealthJourneyScreen() {
  const router = useRouter();
  const { width: viewportWidth } = useWindowDimensions();
  const { session } = useSession();
  const userId = session?.user.id;
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [screenMode, setScreenMode] = useState<ScreenMode>('summary');
  const [resultsView, setResultsView] = useState<ResultsView>('growth');
  const [sipEditorMode, setSipEditorMode] = useState<SipEditorMode>(null);
  const [sipDraft, setSipDraft] = useState('');

  const { wealthJourney, updateWealthJourney, resetWealthJourney } = useAppStore();

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
      patch.expectedReturn =
        returnProfile.presets.find((p) => p.key === returnProfile.defaultPresetKey)?.value ?? 10;
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
  const futureSipTarget =
    wealthJourney.futureSipTarget ?? clamp(currentSip + wealthJourney.monthlySipIncrease, 0, MAX_SIP);
  const adjustedSip = futureSipTarget;
  const additionalTopUp = wealthJourney.additionalTopUp;
  const yearsToRetirement = wealthJourney.yearsToRetirement;
  const expectedReturn =
    wealthJourney.expectedReturn ??
    returnProfile.presets.find((p) => p.key === returnProfile.defaultPresetKey)?.value ??
    10;
  const retirementDurationYears = wealthJourney.retirementDurationYears;
  const withdrawalRate = wealthJourney.withdrawalRate;
  const postRetirementReturn = wealthJourney.postRetirementReturn ?? returnProfile.postRetirementDefault;

  useEffect(() => {
    if (wealthJourney.futureSipTarget == null && wealthJourney.monthlySipIncrease !== 0) {
      updateWealthJourney({
        futureSipTarget: clamp(currentSip + wealthJourney.monthlySipIncrease, 0, MAX_SIP),
        monthlySipIncrease: 0,
      });
    }
  }, [currentSip, updateWealthJourney, wealthJourney.futureSipTarget, wealthJourney.monthlySipIncrease]);

  const baselinePoints = useMemo(
    () => projectWealth(currentSip, currentCorpus, expectedReturn, yearsToRetirement, 0),
    [currentCorpus, currentSip, expectedReturn, yearsToRetirement],
  );

  const adjustedPoints = useMemo(
    () => projectWealth(adjustedSip, currentCorpus, expectedReturn, yearsToRetirement, additionalTopUp),
    [additionalTopUp, adjustedSip, currentCorpus, expectedReturn, yearsToRetirement],
  );

  const projectedCorpus = adjustedPoints[adjustedPoints.length - 1]?.value ?? currentCorpus;
  const baselineCorpus = baselinePoints[baselinePoints.length - 1]?.value ?? currentCorpus;
  const planDelta = projectedCorpus - baselineCorpus;
  const presentValueToday = toPresentValueEquivalent(projectedCorpus, FIXED_INFLATION_RATE, yearsToRetirement);
  const withdrawalProjection = useMemo(
    () => projectRetirementIncome(projectedCorpus, withdrawalRate, retirementDurationYears, postRetirementReturn),
    [postRetirementReturn, projectedCorpus, retirementDurationYears, withdrawalRate],
  );

  const scenarioChanged =
    wealthJourney.currentSipOverride != null ||
    adjustedSip !== currentSip ||
    additionalTopUp > 0 ||
    wealthJourney.hasSavedPlan;

  const screenWidth = Math.max(320, viewportWidth || 360);
  const compact = screenWidth <= 430;
  const chartWidth = Math.max(250, screenWidth - ClearLensSpacing.md * 4 - 8);

  const visibleGrowthYears = useMemo(() => buildVisibleYears(yearsToRetirement), [yearsToRetirement]);
  const baselineChartData = useMemo(
    () =>
      visibleGrowthYears.map((year) => ({
        value: year === 0 ? currentCorpus : baselinePoints.find((p) => p.year === year)?.value ?? currentCorpus,
        label: formatCheckpointLabel(year, 'Now'),
      })),
    [baselinePoints, currentCorpus, visibleGrowthYears],
  );
  const adjustedChartData = useMemo(
    () =>
      visibleGrowthYears.map((year) => ({
        value: year === 0 ? currentCorpus : adjustedPoints.find((p) => p.year === year)?.value ?? currentCorpus,
        label: formatCheckpointLabel(year, 'Now'),
      })),
    [adjustedPoints, currentCorpus, visibleGrowthYears],
  );

  const visibleWithdrawalYears = useMemo(() => buildVisibleYears(retirementDurationYears), [retirementDurationYears]);
  const withdrawalChartData = useMemo(
    () =>
      visibleWithdrawalYears.map((year) => ({
        value: withdrawalProjection.trajectory.find((p) => p.year === year)?.value ?? 0,
        label: formatCheckpointLabel(year, 'Start'),
      })),
    [visibleWithdrawalYears, withdrawalProjection.trajectory],
  );

  const displayedMilestones = useMemo(() => getMilestones(adjustedPoints).slice(0, 3), [adjustedPoints]);

  const currentSipChips = useMemo<ChoiceChip[]>(
    () => buildSipPresetChips(detectedSip > 0 ? detectedSip : currentSip || 100000),
    [currentSip, detectedSip],
  );
  const futureSipChips = useMemo<ChoiceChip[]>(() => buildSipTargetChips(currentSip || 100000), [currentSip]);

  const openSipReview = useCallback(() => {
    setSipDraft(String(currentSip || detectedSip || 0));
    setSipEditorMode('review');
  }, [currentSip, detectedSip]);

  const closeSipReview = useCallback(() => setSipEditorMode(null), []);

  const saveSipDraft = useCallback(() => {
    const numeric = parseFloat(sipDraft.replace(/[^0-9.]/g, ''));
    if (!Number.isNaN(numeric)) {
      updateWealthJourney({ currentSipOverride: clamp(Math.round(numeric), 0, MAX_SIP) });
      setSipEditorMode(null);
    }
  }, [sipDraft, updateWealthJourney]);

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

  const growthBadgeLabel =
    wealthJourney.expectedReturnPreset === 'custom'
      ? `Custom ${formatPercent(expectedReturn)}`
      : `${returnProfile.suggestedLabel} ${formatPercent(expectedReturn)}`;

  const resultsViewOptions: { value: ResultsView; label: string }[] = [
    { value: 'growth', label: 'Wealth growth' },
    { value: 'withdrawal', label: 'Withdrawal income' },
  ];

  return (
    <ClearLensScreen>
      <ClearLensHeader
        title={screenMode === 'summary' ? 'Wealth Journey' : 'Adjust your plan'}
        onPressBack={screenMode === 'adjust' ? () => setScreenMode('summary') : undefined}
        onPressMenu={screenMode === 'summary' ? () => setOverflowOpen(true) : undefined}
      />

      <AppOverflowMenu
        visible={overflowOpen}
        syncState={syncState}
        onClose={() => setOverflowOpen(false)}
        onSync={handleSync}
        onImport={() => router.push(profile?.kfintech_email ? '/onboarding/pdf' : '/onboarding')}
        onSettings={() => router.push('/(tabs)/settings')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {screenMode === 'summary' ? (
          <>
            {/* Your portfolio today — navy hero card */}
            {portfolioLoading ? (
              <ClearLensCard style={styles.heroCard}>
                <ActivityIndicator size="small" color={ClearLensColors.textOnDark} />
                <Text style={styles.heroLoadingText}>Reading your portfolio…</Text>
              </ClearLensCard>
            ) : (
              <ClearLensCard style={styles.heroCard}>
                <Text style={styles.heroCardTitle}>Your portfolio today</Text>
                <Text style={styles.heroCorpus}>{formatCurrency(currentCorpus)}</Text>
                <View style={styles.heroStats}>
                  <TouchableOpacity style={styles.heroStat} onPress={openSipReview} activeOpacity={0.75}>
                    <Text style={styles.heroStatValue}>{formatCurrency(currentSip)}/mo</Text>
                    <View style={styles.heroStatLabelRow}>
                      <Text style={styles.heroStatLabel}>Monthly SIP</Text>
                      <Ionicons name="pencil-outline" size={11} color={ClearLensColors.mint} />
                    </View>
                  </TouchableOpacity>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStat}>
                    <Text style={[styles.heroStatValue, styles.heroXirrValue]}>
                      {Number.isFinite(summary?.xirr)
                        ? `${(summary!.xirr * 100).toFixed(1)}%`
                        : formatPercent(expectedReturn)}
                    </Text>
                    <Text style={styles.heroStatLabel}>XIRR</Text>
                  </View>
                </View>
                {wealthJourney.currentSipOverride != null && (
                  <Text style={styles.heroNote}>
                    Detected {formatCurrency(detectedSip)}/mo — using your override.
                  </Text>
                )}
              </ClearLensCard>
            )}

            {/* Plan at a glance */}
            <ClearLensCard style={styles.planCard}>
              <Text style={styles.planTitle}>Your plan at a glance</Text>
              <ClearLensSegmentedControl
                options={resultsViewOptions}
                selected={resultsView}
                onChange={setResultsView}
              />

              {resultsView === 'growth' ? (
                <View style={styles.planSection}>
                  <View style={styles.planHeadRow}>
                    <View>
                      <Text style={styles.planLabel}>Projected corpus</Text>
                      <Text style={styles.planSublabel}>In {yearsToRetirement} years</Text>
                    </View>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{growthBadgeLabel}</Text>
                    </View>
                  </View>

                  <Text style={styles.planValue}>{formatCurrency(projectedCorpus)}</Text>
                  <Text style={styles.planSubtleText}>
                    {scenarioChanged
                      ? `${planDelta >= 0 ? '+' : '-'}${formatCurrency(Math.abs(planDelta))} vs current plan`
                      : `Based on current corpus and ${formatCurrency(currentSip)}/month`}
                  </Text>

                  <View style={styles.noteRow}>
                    <Ionicons name="information-circle-outline" size={14} color={ClearLensColors.textTertiary} />
                    <Text style={styles.noteText}>
                      At {FIXED_INFLATION_RATE}% inflation, {formatCurrency(projectedCorpus)} in {yearsToRetirement}y ≈{' '}
                      {formatCurrency(presentValueToday)} today.
                    </Text>
                  </View>

                  <View style={styles.chartWrap}>
                    <JourneyChart
                      data={baselineChartData}
                      data2={adjustedChartData}
                      chartWidth={chartWidth}
                      compact={compact}
                      labels={baselineChartData.map((p) => p.label)}
                      pointerHeight={236}
                      primaryLabel="Current"
                      secondaryLabel="Adjusted"
                    />
                    <View style={styles.chartLegend}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendLine, { backgroundColor: ClearLensColors.textTertiary }]} />
                        <Text style={styles.legendText}>Current plan</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendLine, { backgroundColor: ClearLensColors.emerald }]} />
                        <Text style={styles.legendText}>Adjusted plan</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.milestonesRow}>
                    {displayedMilestones.map((m) => (
                      <View key={m.year} style={styles.milestoneChip}>
                        <Text style={styles.milestoneYear}>{m.year}Y</Text>
                        <Text style={styles.milestoneValue}>{formatCurrency(m.value)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.planSection}>
                  <View style={styles.withdrawalStatsRow}>
                    <View style={styles.withdrawalStat}>
                      <Text style={styles.planLabel}>Monthly income</Text>
                      <Text style={styles.planValue}>{formatCurrency(withdrawalProjection.monthlyIncome)}/mo</Text>
                      <Text style={styles.planSublabel}>{formatPercent(withdrawalRate)} withdrawal rate</Text>
                    </View>
                    <View style={styles.heroStatDivider} />
                    <View style={styles.withdrawalStat}>
                      <Text style={styles.planLabel}>Lasts for</Text>
                      <Text style={styles.planValue}>{retirementDurationYears} years</Text>
                      <Text style={styles.planSublabel}>At {formatPercent(postRetirementReturn)} return</Text>
                    </View>
                  </View>

                  <View style={styles.chartWrap}>
                    <Text style={styles.planLabel}>Withdrawal path</Text>
                    <JourneyChart
                      data={withdrawalChartData}
                      chartWidth={chartWidth}
                      compact={compact}
                      labels={withdrawalChartData.map((p) => p.label)}
                      pointerHeight={208}
                      primaryLabel="Corpus"
                    />
                  </View>

                  <View style={styles.noteRow}>
                    <Ionicons name="sparkles-outline" size={14} color={ClearLensColors.emerald} />
                    <Text style={styles.noteText}>
                      {withdrawalProjection.depletionYear == null
                        ? `Leaves ${formatCurrency(withdrawalProjection.endCorpus)} after ${retirementDurationYears} years.`
                        : `At this pace the corpus runs out around year ${withdrawalProjection.depletionYear}.`}
                    </Text>
                  </View>
                </View>
              )}
            </ClearLensCard>

            {/* Adjust CTA */}
            <TouchableOpacity style={styles.primaryCta} onPress={() => setScreenMode('adjust')}>
              <Text style={styles.primaryCtaText}>Adjust your plan →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Adjust view */}
            <ClearLensCard>
              <Text style={styles.groupEyebrow}>1 · Investment plan</Text>

              <View style={styles.compareBanner}>
                <View style={styles.compareItem}>
                  <Text style={styles.compareLabel}>Current plan</Text>
                  <Text style={styles.compareValue}>{formatCurrency(currentSip)}/mo</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.compareItem}>
                  <Text style={styles.compareLabel}>Going forward</Text>
                  <Text style={styles.compareValue}>{formatCurrency(adjustedSip)}/mo</Text>
                </View>
              </View>

              <ValueField
                label="Monthly SIP (going forward)"
                helperText="Choose the SIP you want from now on."
                value={adjustedSip}
                onChange={(v) => markSaved({ futureSipTarget: clamp(Math.round(v), 0, MAX_SIP) })}
                prefix="₹"
                chips={futureSipChips}
              />

              <ValueField
                label="Additional top-up"
                helperText="One-time extra money you plan to add now."
                value={additionalTopUp}
                onChange={(v) => markSaved({ additionalTopUp: clamp(Math.round(v), 0, MAX_TOP_UP) })}
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
                onChange={(v) => markSaved({ yearsToRetirement: clamp(Math.round(v), 1, 40) })}
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
                onPresetChange={(key, v) => markSaved({ expectedReturn: v, expectedReturnPreset: key })}
                onCustomChange={(v) =>
                  markSaved({ expectedReturn: clamp(Number(v.toFixed(1)), 4, 18), expectedReturnPreset: 'custom' })
                }
              />
            </ClearLensCard>

            <ClearLensCard>
              <Text style={styles.groupEyebrow}>2 · Withdrawal plan</Text>

              <ValueField
                label="Withdrawal rate"
                helperText="Annual withdrawals as a % of the starting corpus."
                value={withdrawalRate}
                onChange={(v) => markSaved({ withdrawalRate: clamp(Number(v.toFixed(1)), 2, 8) })}
                suffix="%"
                chips={[
                  { label: '3%', value: 3 },
                  { label: '4%', value: 4 },
                  { label: '5%', value: 5 },
                ]}
              />

              <ValueField
                label="Post-withdrawal return"
                helperText="Use a conservative rate during withdrawals."
                value={postRetirementReturn}
                onChange={(v) => markSaved({ postRetirementReturn: clamp(Number(v.toFixed(1)), 3, 12) })}
                suffix="% p.a."
                chips={[
                  { label: '5%', value: 5 },
                  { label: '6%', value: 6 },
                  { label: '7%', value: 7 },
                ]}
              />

              <ValueField
                label="Withdrawal duration"
                helperText="How long should withdrawals last?"
                value={retirementDurationYears}
                onChange={(v) => markSaved({ retirementDurationYears: clamp(Math.round(v), 5, 40) })}
                suffix="years"
                chips={[
                  { label: '20Y', value: 20 },
                  { label: '25Y', value: 25 },
                  { label: '30Y', value: 30 },
                ]}
              />
            </ClearLensCard>

            <View style={styles.adjustActions}>
              <TouchableOpacity style={styles.primaryCta} onPress={() => setScreenMode('summary')}>
                <Text style={styles.primaryCtaText}>See results →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.resetButton} onPress={() => { resetWealthJourney(); setScreenMode('summary'); }}>
                <Text style={styles.resetButtonText}>Start over</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: ClearLensSpacing.xl }} />
      </ScrollView>

      {/* SIP Editor Modal */}
      <Modal visible={sipEditorMode != null} transparent animationType="fade" onRequestClose={closeSipReview}>
        <Pressable style={styles.modalBackdrop} onPress={closeSipReview}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {sipEditorMode === 'review' ? 'Review detected SIP' : 'Enter monthly SIP'}
              </Text>
              <TouchableOpacity onPress={closeSipReview}>
                <Ionicons name="close" size={18} color={ClearLensColors.textTertiary} />
              </TouchableOpacity>
            </View>

            {sipEditorMode === 'review' ? (
              <>
                <Text style={styles.modalBody}>
                  We estimated this from recurring investments in the last 6 months.
                </Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalRowLabel}>Detected SIP</Text>
                  <Text style={styles.modalRowValue}>{formatCurrency(detectedSip)}/mo</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalRowLabel}>Used for projections</Text>
                  <Text style={styles.modalRowValue}>{formatCurrency(currentSip)}/mo</Text>
                </View>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalSecondary}
                    onPress={() => { updateWealthJourney({ currentSipOverride: null }); setSipEditorMode(null); }}
                  >
                    <Text style={styles.modalSecondaryText}>Use detected</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalPrimary}
                    onPress={() => { setSipDraft(String(currentSip || detectedSip || 0)); setSipEditorMode('manual'); }}
                  >
                    <Text style={styles.modalPrimaryText}>Enter manually</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalBody}>
                  Set the monthly SIP to use as your current baseline.
                </Text>
                <View style={styles.fieldShell}>
                  <Text style={styles.fieldAffix}>₹</Text>
                  <TextInput
                    style={[styles.fieldInput, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
                    value={sipDraft}
                    onChangeText={setSipDraft}
                    keyboardType="numeric"
                    returnKeyType="done"
                    placeholderTextColor={ClearLensColors.textTertiary}
                    {...(Platform.OS === 'web' ? { inputMode: 'numeric' } : null)}
                  />
                </View>
                <View style={styles.chipRow}>
                  {currentSipChips.map((chip) => (
                    <TouchableOpacity
                      key={`modal-${chip.label}`}
                      style={[
                        styles.chip,
                        Math.abs(Number(sipDraft || 0) - chip.value) < 0.001 && styles.chipActive,
                      ]}
                      onPress={() => setSipDraft(String(chip.value))}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          Math.abs(Number(sipDraft || 0) - chip.value) < 0.001 && styles.chipTextActive,
                        ]}
                      >
                        {chip.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.modalHint}>
                  This only changes your Wealth Journey estimate.
                </Text>
                <TouchableOpacity style={[styles.modalPrimary, { marginTop: ClearLensSpacing.sm }]} onPress={saveSipDraft}>
                  <Text style={styles.modalPrimaryText}>Save</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ClearLensScreen>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingBottom: ClearLensSpacing.xl,
    gap: ClearLensSpacing.md,
  },
  // Hero card (navy)
  heroCard: {
    backgroundColor: ClearLensColors.navy,
    gap: ClearLensSpacing.md,
    ...ClearLensShadow,
  },
  heroLoadingText: {
    ...ClearLensTypography.body,
    color: ClearLensColors.textOnDark,
    opacity: 0.7,
    marginTop: ClearLensSpacing.xs,
  },
  heroCardTitle: {
    ...ClearLensTypography.label,
    color: ClearLensColors.textOnDark,
    opacity: 0.7,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroCorpus: {
    ...ClearLensTypography.hero,
    color: ClearLensColors.textOnDark,
    marginTop: 2,
    marginBottom: ClearLensSpacing.sm,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.xs,
    paddingTop: ClearLensSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: `${ClearLensColors.textOnDark}20`,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  heroStatLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  heroStatValue: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.textOnDark,
    fontFamily: ClearLensFonts.bold,
    textAlign: 'center',
  },
  heroXirrValue: {
    color: ClearLensColors.mint,
  },
  heroStatLabel: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textOnDark,
    opacity: 0.6,
    textAlign: 'center',
  },
  heroStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: `${ClearLensColors.textOnDark}22`,
    alignSelf: 'center',
  },
  heroNote: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textOnDark,
    opacity: 0.6,
  },
  // Plan card
  planCard: {
    gap: ClearLensSpacing.md,
  },
  planTitle: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  planSection: {
    gap: ClearLensSpacing.md,
  },
  planHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planLabel: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
    fontFamily: ClearLensFonts.semiBold,
  },
  planSublabel: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
    marginTop: 2,
  },
  planValue: {
    ...ClearLensTypography.h1,
    color: ClearLensColors.navy,
  },
  planSubtleText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textSecondary,
  },
  badge: {
    paddingHorizontal: ClearLensSpacing.sm,
    paddingVertical: 3,
    borderRadius: ClearLensRadii.full,
    backgroundColor: '#E7FAF2',
  },
  badgeText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.emerald,
    fontFamily: ClearLensFonts.semiBold,
  },
  noteRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  noteText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
    flex: 1,
    lineHeight: 17,
  },
  chartWrap: {
    gap: ClearLensSpacing.sm,
  },
  chartLegend: {
    flexDirection: 'row',
    gap: ClearLensSpacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendLine: {
    width: 20,
    height: 2,
    borderRadius: 1,
  },
  legendText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  milestonesRow: {
    flexDirection: 'row',
    gap: ClearLensSpacing.sm,
  },
  milestoneChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: ClearLensSpacing.sm,
    backgroundColor: ClearLensColors.surfaceSoft,
    borderRadius: ClearLensRadii.md,
    gap: 2,
  },
  milestoneYear: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  milestoneValue: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.navy,
    fontFamily: ClearLensFonts.bold,
  },
  withdrawalStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.sm,
  },
  withdrawalStat: {
    flex: 1,
    gap: 2,
  },
  // Chart axis
  chartAxisText: {
    fontSize: 10,
    color: ClearLensColors.textTertiary,
    fontFamily: ClearLensFonts.regular,
  } as object,
  pointerLabel: {
    backgroundColor: ClearLensColors.surface,
    borderRadius: ClearLensRadii.sm,
    padding: 6,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    gap: 2,
  },
  pointerDate: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  pointerSeriesText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textPrimary,
  },
  // Primary CTA
  primaryCta: {
    backgroundColor: ClearLensColors.emerald,
    borderRadius: ClearLensRadii.md,
    paddingVertical: ClearLensSpacing.md,
    alignItems: 'center',
  },
  primaryCtaText: {
    ...ClearLensTypography.body,
    fontFamily: ClearLensFonts.semiBold,
    color: '#FFFFFF',
  },
  adjustActions: {
    gap: ClearLensSpacing.sm,
  },
  resetButton: {
    borderRadius: ClearLensRadii.md,
    paddingVertical: ClearLensSpacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ClearLensColors.border,
  },
  resetButtonText: {
    ...ClearLensTypography.body,
    fontFamily: ClearLensFonts.medium,
    color: ClearLensColors.textTertiary,
  },
  // Adjust view
  groupEyebrow: {
    ...ClearLensTypography.label,
    color: ClearLensColors.textTertiary,
    letterSpacing: 1,
  },
  compareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ClearLensColors.surfaceSoft,
    borderRadius: ClearLensRadii.sm,
    padding: ClearLensSpacing.sm,
    gap: ClearLensSpacing.sm,
  },
  compareItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  compareLabel: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  compareValue: {
    ...ClearLensTypography.body,
    fontFamily: ClearLensFonts.bold,
    color: ClearLensColors.navy,
  },
  // Fields
  fieldBlock: {
    gap: ClearLensSpacing.xs,
  },
  fieldHeader: {
    gap: 2,
  },
  fieldLabel: {
    ...ClearLensTypography.body,
    fontFamily: ClearLensFonts.semiBold,
    color: ClearLensColors.navy,
  },
  fieldHelper: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  fieldShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    borderRadius: ClearLensRadii.sm,
    paddingHorizontal: ClearLensSpacing.sm,
    backgroundColor: ClearLensColors.surface,
    gap: 4,
  },
  fieldAffix: {
    ...ClearLensTypography.body,
    color: ClearLensColors.textTertiary,
  },
  fieldInput: {
    flex: 1,
    ...ClearLensTypography.body,
    fontFamily: ClearLensFonts.semiBold,
    color: ClearLensColors.navy,
    paddingVertical: ClearLensSpacing.sm,
  } as object,
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: ClearLensSpacing.sm,
    paddingVertical: 4,
    borderRadius: ClearLensRadii.full,
    backgroundColor: ClearLensColors.surfaceSoft,
    borderWidth: 1,
    borderColor: ClearLensColors.borderLight,
  },
  chipActive: {
    backgroundColor: ClearLensColors.emerald,
    borderColor: ClearLensColors.emerald,
  },
  chipText: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontFamily: ClearLensFonts.semiBold,
  },
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,20,48,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: ClearLensColors.surface,
    borderTopLeftRadius: ClearLensRadii.xl,
    borderTopRightRadius: ClearLensRadii.xl,
    padding: ClearLensSpacing.lg,
    gap: ClearLensSpacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  modalBody: {
    ...ClearLensTypography.body,
    color: ClearLensColors.textSecondary,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: ClearLensSpacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: ClearLensColors.borderLight,
  },
  modalRowLabel: {
    ...ClearLensTypography.body,
    color: ClearLensColors.textSecondary,
  },
  modalRowValue: {
    ...ClearLensTypography.body,
    fontFamily: ClearLensFonts.bold,
    color: ClearLensColors.navy,
  },
  modalActions: {
    flexDirection: 'row',
    gap: ClearLensSpacing.sm,
    marginTop: ClearLensSpacing.xs,
  },
  modalSecondary: {
    flex: 1,
    paddingVertical: ClearLensSpacing.sm,
    borderRadius: ClearLensRadii.sm,
    borderWidth: 1,
    borderColor: ClearLensColors.border,
    alignItems: 'center',
  },
  modalSecondaryText: {
    ...ClearLensTypography.body,
    fontFamily: ClearLensFonts.medium,
    color: ClearLensColors.textSecondary,
  },
  modalPrimary: {
    flex: 1,
    paddingVertical: ClearLensSpacing.sm,
    borderRadius: ClearLensRadii.sm,
    backgroundColor: ClearLensColors.emerald,
    alignItems: 'center',
  },
  modalPrimaryText: {
    ...ClearLensTypography.body,
    fontFamily: ClearLensFonts.semiBold,
    color: '#FFFFFF',
  },
  modalHint: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
});

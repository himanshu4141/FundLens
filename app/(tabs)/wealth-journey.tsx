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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LineChart } from 'react-native-gifted-charts';
import { AppOverflowMenu } from '@/src/components/AppOverflowMenu';
import { ClearLensWealthJourneyScreen } from '@/src/components/clearLens/screens/ClearLensWealthJourneyScreen';
import { PrimaryShellHeader } from '@/src/components/PrimaryShellHeader';
import { Radii, Spacing, Typography } from '@/src/constants/theme';
import { useTheme } from '@/src/context/ThemeContext';
import type { AppColors } from '@/src/context/ThemeContext';
import { useAppDesignMode } from '@/src/hooks/useAppDesignMode';
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
  buildSipPresetChips,
  buildSipTargetChips,
  estimateRecurringMonthlySip,
  type ReturnPreset,
} from '@/src/utils/wealthJourney';

const FIXED_INFLATION_RATE = 6;
const MAX_SIP = 25_00_000;
const MAX_TOP_UP = 10_00_00_000;

type SyncState = 'idle' | 'syncing' | 'requested' | 'error';
type ScreenMode = 'summary' | 'adjust';
type ResultsView = 'growth' | 'withdrawal';
type SipEditorMode = 'review' | 'manual' | null;

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

interface JourneyLineChartProps {
  data: { value: number; label: string }[];
  data2?: { value: number; label: string }[];
  colors: AppColors;
  chartWidth: number;
  compact: boolean;
  labels: string[];
  pointerHeight: number;
  primaryLabel: string;
  secondaryLabel?: string;
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
              style={[styles.choiceChip, active && styles.choiceChipActive]}
              onPress={() => onChange(chip.value)}
            >
              <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>
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
              style={[styles.choiceChip, active && styles.choiceChipActive]}
              onPress={() => onPresetChange(preset.key, preset.value)}
            >
              <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>
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
          {...(Platform.OS === 'web' ? { inputMode: 'decimal' } : null)}
        />
        <Text style={styles.fieldAffix}>% p.a.</Text>
      </View>
    </View>
  );
}

function JourneyLineChart({
  data,
  data2,
  colors,
  chartWidth,
  compact,
  labels,
  pointerHeight,
  primaryLabel,
  secondaryLabel,
}: JourneyLineChartProps) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const hasSecondSeries = !!data2;
  const spacing = useMemo(() => spacingFor(chartWidth, data.length), [chartWidth, data.length]);
  const formatChartYLabel = useCallback((value: string) => formatAxisValue(Number(value)), []);
  const pointerLabelComponent = useCallback(
    (_items: unknown, _sec: unknown, pointerIndex: number) => {
      const first = data[pointerIndex];
      const second = data2?.[pointerIndex];
      if (!first) return null;

      return (
        <View style={styles.pointerLabel}>
          <Text style={styles.pointerDate}>{first.label}</Text>
          {hasSecondSeries ? (
            <>
              <Text style={styles.pointerSeriesText}>
                <Text style={{ color: colors.textTertiary }}>● </Text>
                {primaryLabel}: {formatCurrency(first.value)}
              </Text>
              {second ? (
                <Text style={styles.pointerSeriesText}>
                  <Text style={{ color: colors.primary }}>● </Text>
                  {secondaryLabel}: {formatCurrency(second.value)}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.pointerSeriesText}>
              <Text style={{ color: colors.primary }}>● </Text>
              {primaryLabel}: {formatCurrency(first.value)}
            </Text>
          )}
        </View>
      );
    },
    [colors.primary, colors.textTertiary, data, data2, hasSecondSeries, primaryLabel, secondaryLabel, styles],
  );
  const pointerConfig = useMemo(
    () => ({
      showPointerStrip: true,
      pointerStripHeight: pointerHeight,
      pointerStripWidth: 1,
      pointerStripColor: `${colors.textTertiary}88`,
      pointerColor: colors.primary,
      radius: 4,
      pointerLabelWidth: hasSecondSeries ? 152 : 144,
      pointerLabelHeight: hasSecondSeries ? 56 : 40,
      activatePointersOnLongPress: true,
      autoAdjustPointerLabelPosition: true,
      pointerLabelComponent,
    }),
    [colors.primary, colors.textTertiary, hasSecondSeries, pointerHeight, pointerLabelComponent],
  );

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
      hideDataPoints
      color1={hasSecondSeries ? colors.textTertiary : colors.primary}
      color2={colors.primary}
      thickness1={hasSecondSeries ? 2.5 : 3}
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
      xAxisColor={colors.borderLight}
      yAxisColor="transparent"
      hideRules={false}
      rulesColor={colors.borderLight}
      formatYLabel={formatChartYLabel}
      pointerConfig={pointerConfig}
    />
  );
}

function ClassicWealthJourneyScreen() {
  const router = useRouter();
  const { width: viewportWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useSession();
  const userId = session?.user.id;
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [screenMode, setScreenMode] = useState<ScreenMode>('summary');
  const [resultsView, setResultsView] = useState<ResultsView>('growth');
  const [sipEditorMode, setSipEditorMode] = useState<SipEditorMode>(null);
  const [sipDraft, setSipDraft] = useState('');

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
      patch.expectedReturn =
        returnProfile.presets.find((preset) => preset.key === returnProfile.defaultPresetKey)?.value ??
        10;
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
    wealthJourney.futureSipTarget ??
    clamp(currentSip + wealthJourney.monthlySipIncrease, 0, MAX_SIP);
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
        futureSipTarget: clamp(currentSip + wealthJourney.monthlySipIncrease, 0, MAX_SIP),
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

  const projectedCorpus = adjustedPoints[adjustedPoints.length - 1]?.value ?? currentCorpus;
  const baselineCorpus = baselinePoints[baselinePoints.length - 1]?.value ?? currentCorpus;
  const planDelta = projectedCorpus - baselineCorpus;
  const presentValueToday = toPresentValueEquivalent(
    projectedCorpus,
    FIXED_INFLATION_RATE,
    yearsToRetirement,
  );
  const withdrawalProjection = useMemo(
    () =>
      projectRetirementIncome(
        projectedCorpus,
        withdrawalRate,
        retirementDurationYears,
        postRetirementReturn,
      ),
    [postRetirementReturn, projectedCorpus, retirementDurationYears, withdrawalRate],
  );

  const scenarioChanged =
    wealthJourney.currentSipOverride != null ||
    adjustedSip !== currentSip ||
    additionalTopUp > 0 ||
    wealthJourney.hasSavedPlan;

  const screenWidth = Math.max(320, viewportWidth || 360);
  const compact = screenWidth <= 430;
  const chartWidth = Math.max(250, screenWidth - Spacing.md * 4 - 8);

  const visibleGrowthYears = useMemo(() => buildVisibleYears(yearsToRetirement), [yearsToRetirement]);
  const baselineChartData = useMemo(
    () =>
      visibleGrowthYears.map((year) => ({
        value:
          year === 0
            ? currentCorpus
            : baselinePoints.find((point) => point.year === year)?.value ?? currentCorpus,
        label: formatCheckpointLabel(year, 'Now'),
      })),
    [baselinePoints, currentCorpus, visibleGrowthYears],
  );
  const adjustedChartData = useMemo(
    () =>
      visibleGrowthYears.map((year) => ({
        value:
          year === 0
            ? currentCorpus
            : adjustedPoints.find((point) => point.year === year)?.value ?? currentCorpus,
        label: formatCheckpointLabel(year, 'Now'),
      })),
    [adjustedPoints, currentCorpus, visibleGrowthYears],
  );

  const visibleWithdrawalYears = useMemo(
    () => buildVisibleYears(retirementDurationYears),
    [retirementDurationYears],
  );
  const withdrawalChartData = useMemo(
    () =>
      visibleWithdrawalYears.map((year) => ({
        value: withdrawalProjection.trajectory.find((point) => point.year === year)?.value ?? 0,
        label: formatCheckpointLabel(year, 'Start'),
      })),
    [visibleWithdrawalYears, withdrawalProjection.trajectory],
  );

  const displayedMilestones = useMemo(() => {
    const milestones = getMilestones(adjustedPoints);
    return milestones.slice(0, 3);
  }, [adjustedPoints]);

  const currentSipChips = useMemo<ChoiceChip[]>(
    () => buildSipPresetChips(detectedSip > 0 ? detectedSip : currentSip || 100000),
    [currentSip, detectedSip],
  );
  const futureSipChips = useMemo<ChoiceChip[]>(
    () => buildSipTargetChips(currentSip || 100000),
    [currentSip],
  );

  const openSipReview = useCallback(() => {
    setSipDraft(String(currentSip || detectedSip || 0));
    setSipEditorMode('review');
  }, [currentSip, detectedSip]);

  const closeSipReview = useCallback(() => {
    setSipEditorMode(null);
  }, []);

  const saveSipDraft = useCallback(() => {
    const numeric = parseFloat(sipDraft.replace(/[^0-9.]/g, ''));
    if (!Number.isNaN(numeric)) {
      updateWealthJourney({
        currentSipOverride: clamp(Math.round(numeric), 0, MAX_SIP),
      });
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
        onMoneyTrail={() => router.push('/money-trail')}
        onSettings={() => router.push('/(tabs)/settings')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {screenMode === 'summary' ? (
          <>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>Wealth Journey</Text>
              <Text style={styles.subtitle}>Plan today. See your future with clarity.</Text>
            </View>

            {portfolioLoading ? (
              <View style={[styles.card, styles.loadingCard]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Reading your portfolio and recent SIP pattern…</Text>
              </View>
            ) : (
              <View style={styles.summaryCard}>
                <View style={styles.summaryCardHeader}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Your portfolio today</Text>
                    <Text style={styles.sectionCaption}>
                      Started from your current portfolio. You can edit assumptions anytime.
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.ghostButton} onPress={openSipReview}>
                    <Text style={styles.ghostButtonText}>Edit</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.contextStats}>
                  <View style={styles.contextStat}>
                    <Text style={styles.contextValue}>{formatCurrency(currentCorpus)}</Text>
                    <Text style={styles.contextLabel}>Corpus</Text>
                  </View>
                  <View style={styles.contextStat}>
                    <Text style={styles.contextValue}>{formatCurrency(currentSip)}/mo</Text>
                    <Text style={styles.contextLabel}>Monthly SIP used</Text>
                  </View>
                  <View style={styles.contextStat}>
                    <Text style={[styles.contextValue, { color: colors.positive }]}>
                      {Number.isFinite(summary?.xirr)
                        ? `${(summary!.xirr * 100).toFixed(1)}%`
                        : formatPercent(expectedReturn)}
                    </Text>
                    <Text style={styles.contextLabel}>XIRR</Text>
                  </View>
                </View>

                <View style={styles.noteRow}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.textTertiary} />
                  <Text style={styles.noteText}>
                    {wealthJourney.currentSipOverride != null
                      ? `Detected ${formatCurrency(detectedSip)}/mo from recurring buys in the last 6 months — using your override.`
                      : 'Detected from recurring buys in the last 6 months.'}
                  </Text>
                </View>

                <TouchableOpacity style={styles.inlineLink} onPress={openSipReview}>
                  <Text style={styles.inlineLinkText}>Review / edit</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Your plan at a glance</Text>
                <Text style={styles.sectionCaption}>
                  Switch between future corpus and withdrawal income.
                </Text>
              </View>

              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentedButton,
                    resultsView === 'growth' && styles.segmentedButtonActive,
                  ]}
                  onPress={() => setResultsView('growth')}
                >
                  <Text
                    style={[
                      styles.segmentedText,
                      resultsView === 'growth' && styles.segmentedTextActive,
                    ]}
                  >
                    Wealth growth
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentedButton,
                    resultsView === 'withdrawal' && styles.segmentedButtonActive,
                  ]}
                  onPress={() => setResultsView('withdrawal')}
                >
                  <Text
                    style={[
                      styles.segmentedText,
                      resultsView === 'withdrawal' && styles.segmentedTextActive,
                    ]}
                  >
                    Withdrawal income
                  </Text>
                </TouchableOpacity>
              </View>

              {resultsView === 'growth' ? (
                <View style={styles.resultsStack}>
                  <View style={styles.resultSummaryHeader}>
                    <View>
                      <Text style={styles.resultLabel}>Projected corpus</Text>
                      <Text style={styles.resultSubtle}>In {yearsToRetirement} years</Text>
                    </View>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{growthBadgeLabel}</Text>
                    </View>
                  </View>

                  <Text style={styles.outcomeValue}>{formatCurrency(projectedCorpus)}</Text>
                  <Text style={styles.outcomeSubtle}>
                    {scenarioChanged
                      ? `${planDelta >= 0 ? '+' : '-'}${formatCurrency(Math.abs(planDelta))} vs your current plan`
                      : `Based on your current corpus and ${formatCurrency(currentSip)}/month`}
                  </Text>

                  <View style={styles.noteRow}>
                    <Ionicons
                      name="information-circle-outline"
                      size={16}
                      color={colors.textTertiary}
                    />
                    <Text style={styles.noteText}>
                      Nominal, pre-tax. At {FIXED_INFLATION_RATE}% inflation,{' '}
                      {formatCurrency(projectedCorpus)} in {yearsToRetirement}y ≈{' '}
                      {formatCurrency(presentValueToday)} today.
                    </Text>
                  </View>

                  <View style={styles.chartWrap}>
                    <JourneyLineChart
                      data={baselineChartData}
                      data2={adjustedChartData}
                      colors={colors}
                      chartWidth={chartWidth}
                      compact={compact}
                      labels={baselineChartData.map((point) => point.label)}
                      pointerHeight={236}
                      primaryLabel="Current"
                      secondaryLabel="Adjusted"
                    />
                    <View style={styles.chartLegend}>
                      <View style={styles.legendItem}>
                        <View
                          style={[styles.legendLine, { backgroundColor: colors.textTertiary }]}
                        />
                        <Text style={styles.legendText}>Current plan</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendLine, { backgroundColor: colors.primary }]} />
                        <Text style={styles.legendText}>Adjusted plan</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.milestonesGrid}>
                    {displayedMilestones.map((milestone) => (
                      <View key={milestone.year} style={styles.milestoneItem}>
                        <Text style={styles.milestoneYear}>{milestone.year}Y</Text>
                        <Text style={styles.milestoneValue}>{formatCurrency(milestone.value)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.resultsStack}>
                  <View style={styles.resultsTopStats}>
                    <View style={styles.resultTopStat}>
                      <Text style={styles.resultLabel}>Monthly income</Text>
                      <Text style={styles.resultTopValue}>
                        {formatCurrency(withdrawalProjection.monthlyIncome)}/mo
                      </Text>
                      <Text style={styles.resultSubtle}>
                        {formatPercent(withdrawalRate)} withdrawal rate
                      </Text>
                    </View>
                    <View style={styles.resultTopStat}>
                      <Text style={styles.resultLabel}>Lasts for</Text>
                      <Text style={styles.resultTopValue}>{retirementDurationYears} years</Text>
                      <Text style={styles.resultSubtle}>
                        At {formatPercent(postRetirementReturn)} post-withdrawal return
                      </Text>
                    </View>
                  </View>

                  <View style={styles.retirementSummaryRow}>
                    <View style={styles.retirementSummaryItem}>
                      <Text style={styles.retirementSummaryLabel}>Corpus at start</Text>
                      <Text style={styles.retirementSummaryValue}>
                        {formatCurrency(withdrawalProjection.retirementCorpus)}
                      </Text>
                    </View>
                    <View style={styles.retirementSummaryItem}>
                      <Text style={styles.retirementSummaryLabel}>Residual corpus</Text>
                      <Text style={styles.retirementSummaryValue}>
                        {formatCurrency(withdrawalProjection.endCorpus)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.drawdownChartWrap}>
                    <Text style={styles.drawdownTitle}>Withdrawal path</Text>
                    <JourneyLineChart
                      data={withdrawalChartData}
                      colors={colors}
                      chartWidth={chartWidth}
                      compact={compact}
                      labels={withdrawalChartData.map((point) => point.label)}
                      pointerHeight={208}
                      primaryLabel="Corpus"
                    />
                  </View>

                  <View style={styles.noteRow}>
                    <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
                    <Text style={styles.noteText}>
                      {withdrawalProjection.depletionYear == null
                        ? `This path leaves ${formatCurrency(withdrawalProjection.endCorpus)} after ${retirementDurationYears} years.`
                        : `At this pace the corpus runs out around year ${withdrawalProjection.depletionYear}.`}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.primaryCta} onPress={() => setScreenMode('adjust')}>
              <Text style={styles.primaryCtaText}>Adjust your plan</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.editHeader}>
              <TouchableOpacity style={styles.backButton} onPress={() => setScreenMode('summary')}>
                <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <View style={styles.editHeaderCopy}>
                <Text style={styles.editTitle}>Adjust your plan</Text>
                <Text style={styles.editSubtitle}>Build your plan using simple inputs.</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.groupEyebrow}>1. Investment plan</Text>

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
                label="Monthly SIP (going forward)"
                helperText="Choose the SIP you want from now on. You can reduce it, stop it, or increase it."
                value={adjustedSip}
                onChange={(value) =>
                  markSaved({ futureSipTarget: clamp(Math.round(value), 0, MAX_SIP) })
                }
                prefix="₹"
                chips={futureSipChips}
              />

              <ValueField
                label="Additional top-up"
                helperText="One-time or periodic extra money you plan to add now."
                value={additionalTopUp}
                onChange={(value) =>
                  markSaved({ additionalTopUp: clamp(Math.round(value), 0, MAX_TOP_UP) })
                }
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
                onChange={(value) =>
                  markSaved({ yearsToRetirement: clamp(Math.round(value), 1, 40) })
                }
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
              <Text style={styles.groupEyebrow}>2. Withdrawal plan (future)</Text>

              <ValueField
                label="Withdrawal rate"
                helperText="Annual withdrawals as a percentage of the starting corpus."
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
            </View>

            <TouchableOpacity style={styles.primaryCta} onPress={() => setScreenMode('summary')}>
              <Text style={styles.primaryCtaText}>See results</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      <Modal visible={sipEditorMode != null} transparent animationType="fade" onRequestClose={closeSipReview}>
        <Pressable style={styles.modalBackdrop} onPress={closeSipReview}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {sipEditorMode === 'review' ? 'Review detected SIP' : 'Enter monthly SIP'}
              </Text>
              <TouchableOpacity onPress={closeSipReview}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {sipEditorMode === 'review' ? (
              <>
                <Text style={styles.modalBodyText}>
                  We estimated this from recurring investments in the last 6 months.
                </Text>
                <View style={styles.modalSummaryBox}>
                  <Text style={styles.modalSummaryLabel}>Detected SIP</Text>
                  <Text style={styles.modalSummaryValue}>{formatCurrency(detectedSip)}/mo</Text>
                </View>
                <View style={styles.modalSummaryBox}>
                  <Text style={styles.modalSummaryLabel}>Used for projections</Text>
                  <Text style={styles.modalSummaryValue}>{formatCurrency(currentSip)}/mo</Text>
                </View>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.secondaryCta}
                    onPress={() => {
                      updateWealthJourney({ currentSipOverride: null });
                      setSipEditorMode(null);
                    }}
                  >
                    <Text style={styles.secondaryCtaText}>Use detected SIP</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryCtaInline}
                    onPress={() => {
                      setSipDraft(String(currentSip || detectedSip || 0));
                      setSipEditorMode('manual');
                    }}
                  >
                    <Text style={styles.primaryCtaInlineText}>Enter manually</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalBodyText}>
                  Set the monthly SIP you want Wealth Journey to use as your current baseline.
                </Text>
                <View style={styles.fieldShell}>
                  <Text style={styles.fieldAffix}>₹</Text>
                  <TextInput
                    style={[styles.fieldInput, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
                    value={sipDraft}
                    onChangeText={setSipDraft}
                    keyboardType="numeric"
                    returnKeyType="done"
                    {...(Platform.OS === 'web' ? { inputMode: 'numeric' } : null)}
                  />
                </View>
                <View style={styles.chipRow}>
                  {currentSipChips.map((chip) => (
                    <TouchableOpacity
                      key={`manual-${chip.label}`}
                      style={[
                        styles.choiceChip,
                        Math.abs(Number(sipDraft || 0) - chip.value) < 0.001 &&
                          styles.choiceChipActive,
                      ]}
                      onPress={() => setSipDraft(String(chip.value))}
                    >
                      <Text
                        style={[
                          styles.choiceChipText,
                          Math.abs(Number(sipDraft || 0) - chip.value) < 0.001 &&
                            styles.choiceChipTextActive,
                        ]}
                      >
                        {chip.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.modalHint}>
                  This only changes your Wealth Journey estimate. It does not change portfolio data.
                </Text>
                <TouchableOpacity style={styles.primaryCtaInlineFull} onPress={saveSipDraft}>
                  <Text style={styles.primaryCtaInlineText}>Save</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

export default function WealthJourneyScreen() {
  const { isClearLens } = useAppDesignMode();
  return isClearLens ? <ClearLensWealthJourneyScreen /> : <ClassicWealthJourneyScreen />;
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
    summaryCard: {
      marginHorizontal: Spacing.md,
      marginTop: Spacing.md,
      padding: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: Spacing.md,
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
    loadingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    loadingText: {
      ...Typography.body,
      color: colors.textSecondary,
    },
    summaryCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      alignItems: 'flex-start',
    },
    sectionHeader: {
      gap: 4,
      flex: 1,
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
    ghostButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    ghostButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    contextStats: {
      flexDirection: 'row',
      gap: Spacing.sm,
      flexWrap: 'wrap',
    },
    contextStat: {
      flex: 1,
      minWidth: 92,
      gap: 4,
    },
    contextValue: {
      fontSize: 20,
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
    inlineLink: {
      alignSelf: 'flex-start',
    },
    inlineLinkText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    segmentedControl: {
      flexDirection: 'row',
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 4,
      gap: 4,
    },
    segmentedButton: {
      flex: 1,
      minHeight: 36,
      borderRadius: Radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    segmentedButtonActive: {
      backgroundColor: colors.primary,
    },
    segmentedText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    segmentedTextActive: {
      color: '#fff',
    },
    resultsStack: {
      gap: Spacing.md,
    },
    resultSummaryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      alignItems: 'flex-start',
    },
    resultLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    resultSubtle: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: Radii.sm,
      backgroundColor: colors.primaryLight,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primary,
    },
    outcomeValue: {
      fontSize: 38,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -1.2,
    },
    outcomeSubtle: {
      ...Typography.body,
      color: colors.textSecondary,
      lineHeight: 24,
    },
    chartWrap: {
      overflow: 'hidden',
      gap: Spacing.sm,
    },
    chartAxisText: {
      fontSize: 11,
      color: colors.textTertiary,
    },
    chartLegend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.lg,
      marginTop: 4,
      flexWrap: 'wrap',
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendLine: {
      width: 14,
      height: 3,
      borderRadius: 2,
    },
    legendText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    milestonesGrid: {
      flexDirection: 'row',
      gap: Spacing.sm,
      flexWrap: 'wrap',
    },
    milestoneItem: {
      flex: 1,
      minWidth: 96,
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
    resultsTopStats: {
      flexDirection: 'row',
      gap: Spacing.sm,
      flexWrap: 'wrap',
    },
    resultTopStat: {
      flex: 1,
      minWidth: 120,
      padding: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      gap: 4,
    },
    resultTopValue: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: -0.8,
    },
    retirementSummaryRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      flexWrap: 'wrap',
    },
    retirementSummaryItem: {
      flex: 1,
      minWidth: 120,
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
    drawdownChartWrap: {
      gap: Spacing.sm,
      overflow: 'hidden',
    },
    drawdownTitle: {
      ...Typography.body,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    primaryCta: {
      marginHorizontal: Spacing.md,
      marginTop: Spacing.md,
      minHeight: 52,
      borderRadius: Radii.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.md,
    },
    primaryCtaText: {
      fontSize: 16,
      fontWeight: '800',
      color: '#fff',
    },
    editHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.lg,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    editHeaderCopy: {
      gap: 4,
      flex: 1,
    },
    editTitle: {
      ...Typography.h2,
      color: colors.textPrimary,
    },
    editSubtitle: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
    groupEyebrow: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
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
    fieldBlock: {
      gap: Spacing.sm,
      paddingTop: Spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    fieldHeader: {
      gap: 3,
    },
    fieldLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    fieldHelper: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
      lineHeight: 18,
    },
    fieldShell: {
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
    fieldAffix: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    fieldInput: {
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
    choiceChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radii.full,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    choiceChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    choiceChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    choiceChipTextActive: {
      color: '#fff',
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
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(12, 20, 34, 0.3)',
      justifyContent: 'center',
      padding: Spacing.md,
    },
    modalCard: {
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: Spacing.md,
      gap: Spacing.md,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    modalTitle: {
      ...Typography.h3,
      color: colors.textPrimary,
      flex: 1,
    },
    modalBodyText: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    modalSummaryBox: {
      padding: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      gap: 4,
    },
    modalSummaryLabel: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
    },
    modalSummaryValue: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    modalActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    secondaryCta: {
      flex: 1,
      minHeight: 46,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
    },
    secondaryCtaText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    primaryCtaInline: {
      flex: 1,
      minHeight: 46,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
    },
    primaryCtaInlineFull: {
      minHeight: 46,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
    },
    primaryCtaInlineText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#fff',
    },
    modalHint: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
      lineHeight: 18,
    },
    bottomPad: {
      height: 28,
    },
  });
}

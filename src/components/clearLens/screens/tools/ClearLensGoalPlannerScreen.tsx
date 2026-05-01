import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { G, Line as SvgLine, Path as SvgPath, Text as SvgText } from 'react-native-svg';
import { useRouter } from 'expo-router';
import {
  ClearLensCard,
  ClearLensHeader,
  ClearLensScreen,
  ClearLensSegmentedControl,
} from '@/src/components/clearLens/ClearLensPrimitives';
import {
  ClearLensColors,
  ClearLensFonts,
  ClearLensRadii,
  ClearLensSpacing,
  ClearLensTypography,
} from '@/src/constants/clearLensTheme';
import {
  buildGoalProjectionSeries,
  computeGoalPlan,
  GOAL_RETURN_PRESET_RATES,
  type GoalPlanInput,
  type GoalReturnPreset,
  type ProjectionPoint,
} from '@/src/utils/goalPlanner';
import { formatCurrency } from '@/src/utils/formatting';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function ClearLensGoalPlannerScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  const [goalName, setGoalName] = useState('');
  const [targetStr, setTargetStr] = useState('');
  const [yearsStr, setYearsStr] = useState('10');
  const [lumpSumStr, setLumpSumStr] = useState('');
  const [currentMonthlyStr, setCurrentMonthlyStr] = useState('');
  const [returnPreset, setReturnPreset] = useState<GoalReturnPreset>('balanced');
  const [hasCalculated, setHasCalculated] = useState(false);

  const targetAmount = useMemo(() => parseRupees(targetStr), [targetStr]);
  const years = useMemo(() => parsePositiveNumber(yearsStr), [yearsStr]);
  const lumpSum = useMemo(() => parseRupees(lumpSumStr), [lumpSumStr]);
  const currentMonthly = useMemo(() => parseRupees(currentMonthlyStr), [currentMonthlyStr]);

  const planInput = useMemo<GoalPlanInput>(
    () => ({ targetAmount, years, lumpSum, currentMonthly, returnPreset }),
    [targetAmount, years, lumpSum, currentMonthly, returnPreset],
  );

  const isInputValid = targetAmount > 0 && years > 0;

  const result = useMemo(() => {
    if (!hasCalculated || !isInputValid) return null;
    return computeGoalPlan(planInput);
  }, [hasCalculated, isInputValid, planInput]);

  const projectionSeries = useMemo(() => {
    if (!result) return null;
    return buildGoalProjectionSeries(planInput, result.requiredMonthly);
  }, [result, planInput]);

  const chartWidth = windowWidth - ClearLensSpacing.md * 2;

  const presetRate = GOAL_RETURN_PRESET_RATES[returnPreset];
  const presetLabel = returnPreset.charAt(0).toUpperCase() + returnPreset.slice(1);
  const assumptionsText = result
    ? `Based on: ${goalName.trim() || 'your goal'}, ${formatCurrency(targetAmount)} target, ${years} year${years !== 1 ? 's' : ''}, ${(presetRate * 100).toFixed(0)}% p.a. (${presetLabel}). Results are estimates. Past performance is not indicative of future returns.`
    : 'Results are estimates based on assumptions. Past performance is not indicative of future returns.';

  function handleCalculate() {
    if (!isInputValid) return;
    setHasCalculated(true);
  }

  return (
    <ClearLensScreen>
      <ClearLensHeader title="Goal Planner" onPressBack={() => router.back()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Input card */}
          <ClearLensCard style={styles.inputCard}>
            <Text style={styles.cardTitle}>{"What's your goal?"}</Text>

            <InputRow label="Goal name (optional)">
              <TextInput
                style={styles.textInput}
                placeholder="e.g. House, Education, Retirement"
                placeholderTextColor={ClearLensColors.textTertiary}
                value={goalName}
                onChangeText={setGoalName}
                returnKeyType="next"
              />
            </InputRow>

            <InputRow label="Target amount (₹)">
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 5000000"
                placeholderTextColor={ClearLensColors.textTertiary}
                value={targetStr}
                onChangeText={setTargetStr}
                keyboardType="numeric"
                returnKeyType="next"
              />
            </InputRow>

            <InputRow label="Timeline (years)">
              <TextInput
                style={styles.textInput}
                placeholder="1 – 30"
                placeholderTextColor={ClearLensColors.textTertiary}
                value={yearsStr}
                onChangeText={setYearsStr}
                keyboardType="numeric"
                returnKeyType="next"
              />
            </InputRow>

            <InputRow label="Amount already saved (₹)">
              <TextInput
                style={styles.textInput}
                placeholder="0"
                placeholderTextColor={ClearLensColors.textTertiary}
                value={lumpSumStr}
                onChangeText={setLumpSumStr}
                keyboardType="numeric"
                returnKeyType="next"
              />
            </InputRow>

            <InputRow label="Current monthly investment (₹)">
              <TextInput
                style={styles.textInput}
                placeholder="0"
                placeholderTextColor={ClearLensColors.textTertiary}
                value={currentMonthlyStr}
                onChangeText={setCurrentMonthlyStr}
                keyboardType="numeric"
                returnKeyType="done"
              />
            </InputRow>

            <View style={styles.segmentedRow}>
              <Text style={styles.inputLabel}>Return assumption</Text>
              <ClearLensSegmentedControl
                options={PRESET_OPTIONS}
                selected={returnPreset}
                onChange={setReturnPreset}
              />
            </View>
          </ClearLensCard>

          {/* Calculate button */}
          <TouchableOpacity
            style={[styles.calculateButton, !isInputValid && styles.calculateButtonDisabled]}
            onPress={handleCalculate}
            activeOpacity={0.8}
            disabled={!isInputValid}
          >
            <Text style={styles.calculateButtonText}>Calculate</Text>
          </TouchableOpacity>

          {/* Result card */}
          {result ? (
            <GoalResultCard result={result} />
          ) : hasCalculated && !isInputValid ? (
            <ClearLensCard style={styles.errorCard}>
              <Text style={styles.errorText}>
                Please enter a valid target amount and timeline to see results.
              </Text>
            </ClearLensCard>
          ) : null}

          {/* Projection chart */}
          {projectionSeries && projectionSeries.length > 1 ? (
            <ClearLensCard style={styles.chartCard}>
              <Text style={styles.cardTitle}>Projected path</Text>
              <View style={styles.chartLegend}>
                <LegendDot color={ClearLensColors.emerald} label="Corpus" />
                <LegendDot color={ClearLensColors.navy} label="Invested" dashed />
              </View>
              <GoalProjectionChart points={projectionSeries} chartWidth={chartWidth - ClearLensSpacing.md * 2} />
            </ClearLensCard>
          ) : null}

          <Text style={styles.disclaimer}>{assumptionsText}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ClearLensScreen>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InputRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.inputRow}>
      <Text style={styles.inputLabel}>{label}</Text>
      {children}
    </View>
  );
}

function GoalResultCard({ result }: { result: ReturnType<typeof computeGoalPlan> }) {
  const gapAbs = Math.abs(result.gap);
  const gapTone = result.onTrack ? 'positive' : 'negative';

  return (
    <ClearLensCard style={styles.resultCard}>
      <Text style={styles.cardTitle}>Your plan</Text>

      <View style={styles.resultRow}>
        <View style={styles.resultItem}>
          <Text style={styles.resultLabel}>Required monthly</Text>
          <Text style={styles.resultValue}>{formatCurrency(result.requiredMonthly)}</Text>
          <Text style={styles.resultSub}>per month</Text>
        </View>

        <View style={styles.resultDivider} />

        <View style={styles.resultItem}>
          <Text style={styles.resultLabel}>{result.onTrack ? 'You are on track' : 'Additional needed'}</Text>
          <Text style={[styles.resultValue, gapTone === 'positive' ? styles.positive : styles.negative]}>
            {result.onTrack ? (
              <Ionicons name="checkmark-circle-outline" size={20} color={ClearLensColors.positive} />
            ) : (
              formatCurrency(gapAbs)
            )}
          </Text>
          {!result.onTrack ? (
            <Text style={styles.resultSub}>more per month</Text>
          ) : null}
        </View>
      </View>
    </ClearLensCard>
  );
}

function LegendDot({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendLine, { backgroundColor: dashed ? 'transparent' : color, borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Projection chart (SVG)
// ---------------------------------------------------------------------------

function GoalProjectionChart({
  points,
  chartWidth,
}: {
  points: ProjectionPoint[];
  chartWidth: number;
}) {
  const chartHeight = 200;
  const plotTop = 12;
  const plotBottom = 30;
  const plotLeft = 52;
  const plotRight = 8;
  const plotWidth = Math.max(1, chartWidth - plotLeft - plotRight);
  const plotHeight = Math.max(1, chartHeight - plotTop - plotBottom);

  const allValues = points.flatMap((p) => [p.invested, p.corpus]);
  const yMax = Math.max(1, Math.max(...allValues) * 1.1);

  function xFor(index: number): number {
    return plotLeft + (points.length <= 1 ? 0 : (index / (points.length - 1)) * plotWidth);
  }

  function yFor(value: number): number {
    return plotTop + plotHeight - (Math.max(0, value) / yMax) * plotHeight;
  }

  function pathFor(values: number[]): string {
    return values
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`)
      .join(' ');
  }

  const ticks = [0, 1, 2, 3, 4].map((t) => ({
    value: (yMax / 4) * t,
    y: yFor((yMax / 4) * t),
  }));

  const labelEvery = points.length <= 6 ? 1 : Math.ceil(points.length / 5);

  return (
    <Svg width={chartWidth} height={chartHeight}>
      {ticks.map((tick) => (
        <G key={`tick-${tick.value}`}>
          <SvgLine
            x1={plotLeft}
            x2={plotLeft + plotWidth}
            y1={tick.y}
            y2={tick.y}
            stroke={ClearLensColors.borderLight}
            strokeWidth={0.5}
          />
          <SvgText
            x={plotLeft - 4}
            y={tick.y + 4}
            textAnchor="end"
            fontSize={9}
            fill={ClearLensColors.textTertiary}
          >
            {formatCompact(tick.value)}
          </SvgText>
        </G>
      ))}

      <SvgPath
        d={pathFor(points.map((p) => p.invested))}
        stroke={ClearLensColors.navy}
        strokeWidth={1.5}
        strokeDasharray="4 3"
        fill="none"
        opacity={0.5}
      />

      <SvgPath
        d={pathFor(points.map((p) => p.corpus))}
        stroke={ClearLensColors.emerald}
        strokeWidth={2}
        fill="none"
      />

      {points.map((p, i) => {
        if (i % labelEvery !== 0 && i !== points.length - 1) return null;
        const yearLabel = Math.round(p.month / 12);
        return (
          <SvgText
            key={`xlabel-${i}`}
            x={xFor(i)}
            y={chartHeight - 6}
            textAnchor="middle"
            fontSize={9}
            fill={ClearLensColors.textTertiary}
          >
            {yearLabel === 0 ? 'Now' : `${yearLabel}y`}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseRupees(str: string): number {
  const n = parseFloat(str.replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parsePositiveNumber(str: string): number {
  const n = parseFloat(str);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatCompact(value: number): string {
  if (value >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(0)}Cr`;
  if (value >= 1_00_000) return `${(value / 1_00_000).toFixed(0)}L`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value === 0 ? '0' : Math.round(value).toString();
}

const PRESET_OPTIONS: { value: GoalReturnPreset; label: string }[] = [
  { value: 'cautious', label: 'Cautious' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'growth', label: 'Growth' },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: ClearLensSpacing.md,
    paddingTop: ClearLensSpacing.xs,
    paddingBottom: ClearLensSpacing.xxl,
    gap: ClearLensSpacing.md,
  },
  inputCard: {
    gap: ClearLensSpacing.md,
    paddingVertical: ClearLensSpacing.md,
    paddingHorizontal: ClearLensSpacing.md,
  },
  cardTitle: {
    ...ClearLensTypography.h3,
    color: ClearLensColors.navy,
  },
  inputRow: {
    gap: ClearLensSpacing.xs,
  },
  inputLabel: {
    ...ClearLensTypography.label,
    color: ClearLensColors.textTertiary,
    letterSpacing: 0.5,
  },
  textInput: {
    fontFamily: ClearLensFonts.regular,
    fontSize: 15,
    color: ClearLensColors.textPrimary,
    borderWidth: 1,
    borderColor: ClearLensColors.borderLight,
    borderRadius: ClearLensRadii.sm,
    paddingHorizontal: ClearLensSpacing.sm,
    paddingVertical: ClearLensSpacing.sm,
    backgroundColor: ClearLensColors.surfaceSoft,
  },
  segmentedRow: {
    gap: ClearLensSpacing.xs,
  },
  calculateButton: {
    backgroundColor: ClearLensColors.emerald,
    borderRadius: ClearLensRadii.md,
    paddingVertical: ClearLensSpacing.sm + 4,
    alignItems: 'center',
  },
  calculateButtonDisabled: {
    opacity: 0.5,
  },
  calculateButtonText: {
    fontFamily: ClearLensFonts.semiBold,
    fontSize: 16,
    color: ClearLensColors.textOnDark,
  },
  resultCard: {
    gap: ClearLensSpacing.md,
    paddingVertical: ClearLensSpacing.md,
    paddingHorizontal: ClearLensSpacing.md,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.md,
  },
  resultItem: {
    flex: 1,
    gap: 2,
  },
  resultDivider: {
    width: 1,
    height: 48,
    backgroundColor: ClearLensColors.borderLight,
  },
  resultLabel: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
  },
  resultValue: {
    fontFamily: ClearLensFonts.bold,
    fontSize: 20,
    color: ClearLensColors.navy,
    lineHeight: 28,
  },
  resultSub: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  positive: {
    color: ClearLensColors.positive,
  },
  negative: {
    color: ClearLensColors.negative,
  },
  chartCard: {
    gap: ClearLensSpacing.sm,
    paddingVertical: ClearLensSpacing.md,
    paddingHorizontal: ClearLensSpacing.md,
    overflow: 'hidden',
  },
  chartLegend: {
    flexDirection: 'row',
    gap: ClearLensSpacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ClearLensSpacing.xs,
  },
  legendLine: {
    width: 16,
    height: 2,
    borderWidth: 1,
  },
  legendLabel: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
  },
  errorCard: {
    paddingVertical: ClearLensSpacing.md,
    paddingHorizontal: ClearLensSpacing.md,
  },
  errorText: {
    ...ClearLensTypography.bodySmall,
    color: ClearLensColors.textTertiary,
    textAlign: 'center',
  },
  disclaimer: {
    ...ClearLensTypography.caption,
    color: ClearLensColors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: ClearLensSpacing.sm,
    lineHeight: 17,
  },
});

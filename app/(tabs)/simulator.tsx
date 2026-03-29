import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
import Logo from '@/src/components/Logo';
import { Colors, Spacing, Radii, Typography } from '@/src/constants/theme';
import { formatCurrency } from '@/src/utils/formatting';
import { projectWealth, getMilestones } from '@/src/utils/simulatorCalc';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - Spacing.md * 2;

const SIP_BOOST = 5000;

// ─── Step control ────────────────────────────────────────────────────────────

interface StepControlProps {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  prefix?: string;
  suffix?: string;
  format?: (v: number) => string;
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
  format,
  onChange,
}: StepControlProps) {
  const displayValue = format
    ? format(value)
    : prefix
      ? `${prefix}${value.toLocaleString('en-IN')}`
      : `${value}${suffix ?? ''}`;

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
            color={value <= min ? Colors.textTertiary : Colors.primary}
          />
        </TouchableOpacity>
        <Text style={stepStyles.value}>{displayValue}</Text>
        <TouchableOpacity
          onPress={increment}
          disabled={value >= max}
          style={[stepStyles.btn, value >= max && stepStyles.btnDisabled]}
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

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  label: {
    ...Typography.body,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    backgroundColor: Colors.borderLight,
  },
  value: {
    ...Typography.body,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    minWidth: 96,
    textAlign: 'center',
  },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SimulatorScreen() {
  const router = useRouter();

  const [sip, setSip] = useState(5000);
  const [lumpsum, setLumpsum] = useState(0);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(15);

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
    value: Math.round(p.value / 1000), // display in thousands for readability
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
          <Text style={styles.title}>Wealth Simulator</Text>
          <Text style={styles.subtitle}>
            See how your investments grow over time.
          </Text>
        </View>

        {/* Input card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Investment Plan</Text>
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
            label="One-time Lumpsum"
            value={lumpsum}
            step={10000}
            min={0}
            max={5000000}
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

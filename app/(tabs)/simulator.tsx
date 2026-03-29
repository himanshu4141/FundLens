import { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { AppScreenHeader } from '@/src/components/AppScreenHeader';
import { useThemeVariant } from '@/src/hooks/useThemeVariant';
import { buildSimulationSummary, buildSimulationTimeline } from '@/src/utils/simulator';
import { formatCurrency } from '@/src/utils/formatting';

export default function SimulatorScreen() {
  const theme = useThemeVariant();
  const [monthlySip, setMonthlySip] = useState(25000);
  const [sipDelta, setSipDelta] = useState(5000);
  const [lumpSum, setLumpSum] = useState(500000);
  const [annualReturnPct, setAnnualReturnPct] = useState(12);
  const [years, setYears] = useState(15);

  const scenarioSip = monthlySip + sipDelta;
  const baseline = useMemo(
    () => buildSimulationSummary({ monthlySip, lumpSum, annualReturnPct, years }),
    [annualReturnPct, lumpSum, monthlySip, years],
  );
  const scenario = useMemo(
    () => buildSimulationSummary({ monthlySip: scenarioSip, lumpSum, annualReturnPct, years }),
    [annualReturnPct, lumpSum, scenarioSip, years],
  );
  const timeline = useMemo(
    () => buildSimulationTimeline({ baselineSip: monthlySip, scenarioSip, lumpSum, annualReturnPct, years }),
    [annualReturnPct, lumpSum, monthlySip, scenarioSip, years],
  );
  const chartData = timeline.map((point) => ({ value: point.baselineValue / 100000 }));
  const chartData2 = timeline.map((point) => ({ value: point.scenarioValue / 100000 }));
  const xLabels = timeline.map((point) => `Y${point.year}`);
  const maxValue = Math.max(...chartData.map((point) => point.value), ...chartData2.map((point) => point.value));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <AppScreenHeader
        title="Simulator"
        subtitle="See how small changes to your SIP can compound over time."
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.heroLabel}>Scenario projection</Text>
          <Text style={styles.heroValue}>{formatCurrency(scenario.terminalValue)}</Text>
          <Text style={styles.heroSub}>
            +{formatCurrency(scenario.terminalValue - baseline.terminalValue)} versus your current SIP over {years} years
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.smallLabel, { color: theme.colors.textSecondary }]}>Current plan</Text>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{formatCurrency(baseline.terminalValue)}</Text>
          </View>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.smallLabel, { color: theme.colors.textSecondary }]}>New plan</Text>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{formatCurrency(scenario.terminalValue)}</Text>
          </View>
        </View>

        <View style={[styles.chartCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.chartTitle, { color: theme.colors.textPrimary }]}>Wealth Accumulation</Text>
          <LineChart
            data={chartData}
            data2={chartData2}
            width={320}
            height={200}
            curved
            hideDataPoints
            initialSpacing={0}
            endSpacing={0}
            spacing={timeline.length > 1 ? 320 / (timeline.length - 1) : 20}
            color1={theme.colors.textSecondary}
            color2={theme.colors.primary}
            thickness1={2}
            thickness2={2.5}
            xAxisLabelTexts={xLabels}
            xAxisLabelTextStyle={styles.axisLabel}
            yAxisTextStyle={styles.axisLabel}
            formatYLabel={(value: string) => `${Number(value).toFixed(0)}L`}
            yAxisLabelWidth={36}
            noOfSections={4}
            maxValue={maxValue * 1.1}
            xAxisColor={theme.colors.borderLight}
            yAxisColor="transparent"
            rulesColor={theme.colors.borderLight}
          />
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.chartTitle, { color: theme.colors.textPrimary }]}>Adjust Parameters</Text>
          <NumberField label="Current monthly SIP" value={monthlySip} onChange={setMonthlySip} />
          <NumberField label="SIP increase" value={sipDelta} onChange={setSipDelta} />
          <NumberField label="One-time lump sum" value={lumpSum} onChange={setLumpSum} />
          <NumberField label="Expected annual return (%)" value={annualReturnPct} onChange={setAnnualReturnPct} />
          <NumberField label="Investment horizon (years)" value={years} onChange={setYears} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        keyboardType="numeric"
        onChangeText={(text) => onChange(Number(text.replace(/[^0-9.]/g, '')) || 0)}
        style={styles.fieldInput}
        value={String(value)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroCard: {
    borderRadius: 24,
    margin: 16,
    padding: 20,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 8,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
  },
  card: {
    borderRadius: 20,
    padding: 20,
  },
  chartCard: {
    borderRadius: 20,
    margin: 16,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  smallLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  axisLabel: {
    fontSize: 10,
  },
  field: {
    marginTop: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  fieldInput: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
});

import { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { LineChart } from 'react-native-gifted-charts';
import { AppScreenHeader } from '@/src/components/AppScreenHeader';
import { usePortfolio } from '@/src/hooks/usePortfolio';
import { useSession } from '@/src/hooks/useSession';
import { useThemeVariant } from '@/src/hooks/useThemeVariant';
import { supabase } from '@/src/lib/supabase';
import { useAppStore } from '@/src/store/appStore';
import {
  buildPersonalizedSimulationBaseline,
  buildSimulationSummary,
  buildSimulationTimeline,
} from '@/src/utils/simulator';
import { formatCurrency } from '@/src/utils/formatting';
import { formatXirr, type Transaction } from '@/src/utils/xirr';

function formatCompactCurrency(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  return `₹${(value / 100000).toFixed(1)}L`;
}

function formatAxisCurrency(value: number) {
  if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(0)}L`;
  return `${Math.round(value / 1000)}K`;
}

export default function SimulatorScreen() {
  const theme = useThemeVariant();
  const { width: viewportWidth } = useWindowDimensions();
  const { session } = useSession();
  const { defaultBenchmarkSymbol } = useAppStore();
  const { data: portfolioData, isLoading: portfolioLoading } = usePortfolio(defaultBenchmarkSymbol);
  const summary = portfolioData?.summary ?? null;
  const userId = session?.user.id;

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['simulator-transactions', userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction')
        .select('fund_id, transaction_date, transaction_type, units, amount')
        .eq('user_id', userId!)
        .order('transaction_date', { ascending: true });

      if (error) throw error;
      return (data ?? []) as (Transaction & { fund_id?: string | null })[];
    },
  });

  const baselineProfile = useMemo(
    () => buildPersonalizedSimulationBaseline({
      transactions,
      currentCorpus: summary?.totalValue ?? 0,
      portfolioXirr: summary?.xirr ?? Number.NaN,
    }),
    [summary?.totalValue, summary?.xirr, transactions],
  );

  const [monthlySipInput, setMonthlySipInput] = useState<number | null>(null);
  const [scenarioSipInput, setScenarioSipInput] = useState<number | null>(null);
  const [oneTimeTopUpInput, setOneTimeTopUpInput] = useState<number | null>(null);
  const [annualReturnPctInput, setAnnualReturnPctInput] = useState<number | null>(null);
  const [yearsInput, setYearsInput] = useState<number | null>(null);
  const [chartViewportWidth, setChartViewportWidth] = useState(0);

  const monthlySip = monthlySipInput ?? baselineProfile.monthlySip;
  const scenarioSip = scenarioSipInput ?? (baselineProfile.monthlySip + 5000);
  const oneTimeTopUp = oneTimeTopUpInput ?? baselineProfile.trailingLumpSumAverage;
  const annualReturnPct = annualReturnPctInput ?? baselineProfile.annualReturnPct;
  const years = yearsInput ?? 15;

  const baseline = useMemo(
    () => buildSimulationSummary({
      startingCorpus: baselineProfile.currentCorpus,
      monthlyContribution: monthlySip,
      oneTimeTopUp: 0,
      annualReturnPct,
      years,
    }),
    [annualReturnPct, baselineProfile.currentCorpus, monthlySip, years],
  );

  const scenario = useMemo(
    () => buildSimulationSummary({
      startingCorpus: baselineProfile.currentCorpus,
      monthlyContribution: scenarioSip,
      oneTimeTopUp,
      annualReturnPct,
      years,
    }),
    [annualReturnPct, baselineProfile.currentCorpus, oneTimeTopUp, scenarioSip, years],
  );

  const timeline = useMemo(
    () => buildSimulationTimeline({
      startingCorpus: baselineProfile.currentCorpus,
      baselineContribution: monthlySip,
      scenarioContribution: scenarioSip,
      scenarioTopUp: oneTimeTopUp,
      annualReturnPct,
      years,
    }),
    [annualReturnPct, baselineProfile.currentCorpus, monthlySip, oneTimeTopUp, scenarioSip, years],
  );

  const chartData = timeline.map((point) => ({ value: point.baselineValue }));
  const chartData2 = timeline.map((point) => ({ value: point.scenarioValue }));
  const xLabels = timeline.map((point) => {
    if (point.year === 0) return 'Today';
    if (point.year === years || point.year % 5 === 0) return `${point.year}Y`;
    return '';
  });
  const maxValue = Math.max(
    1,
    ...chartData.map((point) => point.value),
    ...chartData2.map((point) => point.value),
  );
  const chartBodyWidth = Math.max(180, chartViewportWidth > 0 ? chartViewportWidth - 28 : viewportWidth - 220);
  const chartSpacing = timeline.length > 1 ? Math.max(36, (chartBodyWidth - 12) / (timeline.length - 1)) : 20;

  const deltaValue = scenario.terminalValue - baseline.terminalValue;
  const sipDelta = scenarioSip - monthlySip;

  if (portfolioLoading || txLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <AppScreenHeader
          title="Simulator"
          subtitle="Building a projection from your actual portfolio history."
        />
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <AppScreenHeader
        title="Simulator"
        subtitle="Start from your current portfolio, then model a better path forward."
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.heroCard, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.heroLabel}>Projected outcome</Text>
          <Text style={styles.heroValue}>{formatCurrency(scenario.terminalValue)}</Text>
          <Text style={styles.heroSub}>
            {sipDelta >= 0 ? '+' : ''}{formatCurrency(sipDelta)} per month
            {oneTimeTopUp > 0 ? ` and ${formatCurrency(oneTimeTopUp)} upfront` : ''}
            {' '}could change your outcome by {formatCurrency(deltaValue)} over {years} years.
          </Text>
        </View>

        <View style={styles.metricsRow}>
          <MetricCard
            label="Current portfolio"
            value={formatCurrency(baselineProfile.currentCorpus)}
            helper={baselineProfile.currentXirrPct == null ? 'XIRR unavailable' : `${formatXirr(baselineProfile.currentXirrPct / 100)} realized`}
            theme={theme}
          />
          <MetricCard
            label="Typical SIP pace"
            value={formatCurrency(baselineProfile.monthlySip)}
            helper={`${formatCurrency(baselineProfile.monthlyNetContribution)} net after redemptions`}
            theme={theme}
          />
        </View>

        <View style={styles.metricsRow}>
          <MetricCard
            label="Recent one-offs"
            value={baselineProfile.trailingLumpSumAverage > 0 ? formatCurrency(baselineProfile.trailingLumpSumAverage) : 'None'}
            helper="Average top-up from recent months"
            theme={theme}
          />
          <MetricCard
            label="Annual redemptions"
            value={baselineProfile.annualRedemptionRate > 0 ? formatCurrency(baselineProfile.annualRedemptionRate) : 'None'}
            helper="Based on recent redemption behaviour"
            theme={theme}
          />
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.chartTitle, { color: theme.colors.textPrimary }]}>Adjust your plan</Text>
          <Text style={[styles.chartBody, { color: theme.colors.textSecondary }]}>
            Your projection currently assumes a {annualReturnPct.toFixed(1)}% annualised return, anchored to your realized XIRR and open to adjustment.
          </Text>
          <NumberField
            label="Current monthly SIP"
            helper="Baseline plan"
            value={monthlySip}
            onChange={setMonthlySipInput}
            theme={theme}
          />
          <NumberField
            label="Proposed monthly SIP"
            helper="What you want to test"
            value={scenarioSip}
            onChange={setScenarioSipInput}
            theme={theme}
          />
          <NumberField
            label="One-time top-up"
            helper="Optional lump sum to add right now"
            value={oneTimeTopUp}
            onChange={setOneTimeTopUpInput}
            theme={theme}
          />
          <NumberField
            label="Expected annual return (%)"
            helper="Uses your realized XIRR as the starting assumption"
            value={annualReturnPct}
            onChange={setAnnualReturnPctInput}
            theme={theme}
          />
          <NumberField
            label="Investment horizon (years)"
            helper="Projection length"
            value={years}
            onChange={setYearsInput}
            theme={theme}
          />
        </View>

        <View style={[styles.chartCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.chartTitle, { color: theme.colors.textPrimary }]}>Current plan vs proposed plan</Text>
          <Text style={[styles.chartBody, { color: theme.colors.textSecondary }]}>
            Both lines start from your current portfolio value today. Changes you make below only affect the future path.
          </Text>
          <Text style={[styles.chartHint, { color: theme.colors.textTertiary }]}>
            Press and drag on the chart to inspect values at any point.
          </Text>
          <View
            style={styles.chartViewport}
            onLayout={(event) => setChartViewportWidth(event.nativeEvent.layout.width)}
          >
            <LineChart
              data={chartData}
              data2={chartData2}
              width={chartBodyWidth}
              height={240}
              curved
              hideDataPoints
              initialSpacing={20}
              endSpacing={12}
              spacing={chartSpacing}
              color1={theme.colors.textSecondary}
              color2={theme.colors.primary}
              thickness1={2}
              thickness2={3}
              xAxisLabelTexts={xLabels}
              xAxisLabelTextStyle={[styles.axisLabel, { color: theme.colors.textTertiary }]}
              yAxisTextStyle={[styles.axisLabel, { color: theme.colors.textTertiary }]}
              formatYLabel={(value: string) => formatAxisCurrency(Number(value))}
              yAxisLabelWidth={72}
              noOfSections={4}
              maxValue={maxValue * 1.08}
              xAxisColor={theme.colors.borderLight}
              yAxisColor="transparent"
              rulesColor={theme.colors.borderLight}
              pointerConfig={{
                showPointerStrip: true,
                pointerStripHeight: 240,
                pointerStripWidth: 1,
                pointerStripColor: theme.colors.textTertiary + '88',
                pointerColor: theme.colors.primary,
                radius: 5,
                pointerLabelWidth: 150,
                pointerLabelHeight: 54,
                activatePointersOnLongPress: true,
                autoAdjustPointerLabelPosition: true,
                pointerLabelComponent: (_items: unknown, _sec: unknown, pointerIndex: number) => {
                  const point = timeline[pointerIndex];
                  if (!point) return null;
                  return (
                    <View style={[styles.pointerLabel, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.borderLight }]}>
                      <Text style={[styles.pointerDate, { color: theme.colors.textPrimary }]}>
                        {point.year === 0 ? 'Today' : `${point.year} years`}
                      </Text>
                      <Text style={[styles.pointerSeriesText, { color: theme.colors.textSecondary }]}>
                        <Text style={{ color: theme.colors.textSecondary }}>● </Text>
                        Current: {formatCompactCurrency(point.baselineValue)}
                      </Text>
                      <Text style={[styles.pointerSeriesText, { color: theme.colors.textPrimary }]}>
                        <Text style={{ color: theme.colors.primary }}>● </Text>
                        Proposed: {formatCompactCurrency(point.scenarioValue)}
                      </Text>
                    </View>
                  );
                },
              }}
            />
          </View>
          <View style={styles.legendRow}>
            <LegendItem color={theme.colors.textSecondary} label={`Current plan · ${formatCompactCurrency(baseline.terminalValue)}`} />
            <LegendItem color={theme.colors.primary} label={`Proposed plan · ${formatCompactCurrency(scenario.terminalValue)}`} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({
  label,
  value,
  helper,
  theme,
}: {
  label: string;
  value: string;
  helper: string;
  theme: ReturnType<typeof useThemeVariant>;
}) {
  return (
    <View style={[styles.metricCard, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: theme.colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.metricHelper, { color: theme.colors.textTertiary }]}>{helper}</Text>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function NumberField({
  label,
  helper,
  value,
  onChange,
  theme,
}: {
  label: string;
  helper: string;
  value: number;
  onChange: (value: number) => void;
  theme: ReturnType<typeof useThemeVariant>;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.colors.textPrimary }]}>{label}</Text>
      <Text style={[styles.fieldHelper, { color: theme.colors.textSecondary }]}>{helper}</Text>
      <TextInput
        keyboardType="numeric"
        onChangeText={(text) => onChange(Number(text.replace(/[^0-9.]/g, '')) || 0)}
        style={[
          styles.fieldInput,
          {
            borderColor: theme.colors.borderLight,
            color: theme.colors.textPrimary,
            backgroundColor: theme.colors.surfaceAlt,
          },
        ]}
        value={String(value)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  loadingState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
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
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  metricCard: {
    borderRadius: 18,
    flex: 1,
    padding: 18,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 21,
    fontWeight: '800',
  },
  metricHelper: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  chartCard: {
    borderRadius: 20,
    margin: 16,
    marginTop: 12,
    padding: 20,
  },
  card: {
    borderRadius: 20,
    marginHorizontal: 16,
    padding: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  chartBody: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  axisLabel: {
    fontSize: 11,
    lineHeight: 14,
  },
  chartViewport: {
    overflow: 'hidden',
  },
  chartHint: {
    fontSize: 12,
    marginBottom: 10,
  },
  legendRow: {
    gap: 8,
    marginTop: 14,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  legendDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pointerLabel: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pointerDate: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  pointerSeriesText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  field: {
    marginTop: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  fieldHelper: {
    fontSize: 12,
    marginBottom: 8,
  },
  fieldInput: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});

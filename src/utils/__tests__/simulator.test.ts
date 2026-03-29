import {
  buildPersonalizedSimulationBaseline,
  buildSimulationSummary,
  buildSimulationTimeline,
} from '../simulator';

describe('simulator utils', () => {
  it('projects a higher terminal value than invested capital for positive return assumptions', () => {
    const summary = buildSimulationSummary({
      startingCorpus: 500000,
      monthlyContribution: 25000,
      oneTimeTopUp: 0,
      annualReturnPct: 12,
      years: 15,
    });

    expect(summary.terminalValue).toBeGreaterThan(summary.investedCapital);
    expect(summary.wealthGain).toBe(summary.terminalValue - summary.investedCapital);
  });

  it('builds a yearly comparison timeline for baseline vs scenario contributions', () => {
    const timeline = buildSimulationTimeline({
      startingCorpus: 500000,
      baselineContribution: 25000,
      scenarioContribution: 30000,
      scenarioTopUp: 250000,
      annualReturnPct: 12,
      years: 5,
    });

    expect(timeline).toHaveLength(5);
    expect(timeline[4].scenarioValue).toBeGreaterThan(timeline[4].baselineValue);
  });

  it('derives a personalized baseline from transaction history and portfolio stats', () => {
    const baseline = buildPersonalizedSimulationBaseline({
      currentCorpus: 1800000,
      portfolioXirr: 0.1425,
      transactions: [
        { transaction_date: '2025-09-05', transaction_type: 'purchase', units: 5, amount: 15000 },
        { transaction_date: '2025-10-05', transaction_type: 'purchase', units: 5, amount: 15000 },
        { transaction_date: '2025-11-05', transaction_type: 'purchase', units: 5, amount: 15000 },
        { transaction_date: '2025-12-15', transaction_type: 'purchase', units: 12, amount: 60000 },
        { transaction_date: '2026-01-05', transaction_type: 'purchase', units: 5, amount: 15000 },
        { transaction_date: '2026-02-10', transaction_type: 'redemption', units: 2, amount: 10000 },
      ],
    });

    expect(baseline.currentCorpus).toBe(1800000);
    expect(baseline.currentXirrPct).toBeCloseTo(14.25);
    expect(baseline.monthlySip).toBe(15000);
    expect(baseline.monthlyNetContribution).toBeGreaterThan(0);
    expect(baseline.trailingLumpSumAverage).toBe(60000);
    expect(baseline.annualRedemptionRate).toBeGreaterThan(0);
  });

  it('falls back to sane defaults when xirr is unavailable and ignores unsupported transaction types', () => {
    const baseline = buildPersonalizedSimulationBaseline({
      currentCorpus: 250000,
      portfolioXirr: Number.NaN,
      transactions: [
        { transaction_date: '2026-01-05', transaction_type: 'switch_in', units: 4, amount: 8000 },
        { transaction_date: '2026-02-05', transaction_type: 'dividend_reinvestment', units: 1, amount: 1200 },
        { transaction_date: '2026-03-05', transaction_type: 'bonus', units: 0, amount: 999999 },
      ],
    });

    expect(baseline.currentXirrPct).toBeNull();
    expect(baseline.annualReturnPct).toBe(12);
    expect(baseline.monthlySip).toBeGreaterThan(0);
    expect(baseline.monthlyNetContribution).toBeLessThan(999999);
  });
});

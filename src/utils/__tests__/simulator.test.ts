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

    expect(timeline).toHaveLength(6);
    expect(timeline[0].baselineValue).toBe(500000);
    expect(timeline[4].scenarioValue).toBeGreaterThan(timeline[4].baselineValue);
  });

  it('derives a personalized baseline from transaction history and portfolio stats', () => {
    const baseline = buildPersonalizedSimulationBaseline({
      currentCorpus: 1800000,
      portfolioXirr: 0.1425,
      transactions: [
        { fund_id: 'fund-a', transaction_date: '2025-09-05', transaction_type: 'purchase', units: 5, amount: 15000 },
        { fund_id: 'fund-a', transaction_date: '2025-10-05', transaction_type: 'purchase', units: 5, amount: 15000 },
        { fund_id: 'fund-a', transaction_date: '2025-11-05', transaction_type: 'purchase', units: 5, amount: 15000 },
        { fund_id: 'fund-b', transaction_date: '2025-12-15', transaction_type: 'purchase', units: 12, amount: 60000 },
        { fund_id: 'fund-a', transaction_date: '2026-01-05', transaction_type: 'purchase', units: 5, amount: 15000 },
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

  it('ignores switch-ins and only counts recurring purchase patterns as SIP pace', () => {
    const baseline = buildPersonalizedSimulationBaseline({
      currentCorpus: 5000000,
      portfolioXirr: 0.1269,
      transactions: [
        { fund_id: 'fund-1', transaction_date: '2025-10-06', transaction_type: 'purchase', units: 10, amount: 20000 },
        { fund_id: 'fund-2', transaction_date: '2025-10-07', transaction_type: 'purchase', units: 10, amount: 25000 },
        { fund_id: 'fund-3', transaction_date: '2025-11-07', transaction_type: 'purchase', units: 10, amount: 50000 },
        { fund_id: 'fund-1', transaction_date: '2025-11-07', transaction_type: 'purchase', units: 10, amount: 20000 },
        { fund_id: 'fund-2', transaction_date: '2025-11-07', transaction_type: 'purchase', units: 10, amount: 25000 },
        { fund_id: 'fund-3', transaction_date: '2025-11-11', transaction_type: 'switch_in', units: 10, amount: 45000 },
        { fund_id: 'fund-1', transaction_date: '2025-12-08', transaction_type: 'purchase', units: 10, amount: 20000 },
        { fund_id: 'fund-2', transaction_date: '2025-12-08', transaction_type: 'purchase', units: 10, amount: 25000 },
        { fund_id: 'fund-3', transaction_date: '2025-12-08', transaction_type: 'purchase', units: 10, amount: 50000 },
        { fund_id: 'fund-1', transaction_date: '2026-01-07', transaction_type: 'purchase', units: 10, amount: 20000 },
        { fund_id: 'fund-2', transaction_date: '2026-01-07', transaction_type: 'purchase', units: 10, amount: 25000 },
        { fund_id: 'fund-3', transaction_date: '2026-01-09', transaction_type: 'switch_in', units: 10, amount: 45000 },
        { fund_id: 'fund-3', transaction_date: '2026-01-07', transaction_type: 'purchase', units: 10, amount: 50000 },
        { fund_id: 'fund-1', transaction_date: '2026-02-09', transaction_type: 'purchase', units: 10, amount: 20000 },
        { fund_id: 'fund-2', transaction_date: '2026-02-09', transaction_type: 'purchase', units: 10, amount: 25000 },
        { fund_id: 'fund-3', transaction_date: '2026-02-09', transaction_type: 'purchase', units: 10, amount: 50000 },
        { fund_id: 'fund-4', transaction_date: '2026-02-09', transaction_type: 'purchase', units: 10, amount: 100000 },
        { fund_id: 'fund-1', transaction_date: '2026-03-09', transaction_type: 'purchase', units: 10, amount: 20000 },
        { fund_id: 'fund-2', transaction_date: '2026-03-09', transaction_type: 'purchase', units: 10, amount: 25000 },
        { fund_id: 'fund-3', transaction_date: '2026-03-09', transaction_type: 'purchase', units: 10, amount: 50000 },
        { fund_id: 'fund-4', transaction_date: '2026-03-18', transaction_type: 'purchase', units: 10, amount: 100000 },
      ],
    });

    expect(baseline.monthlySip).toBe(95000);
    expect(baseline.trailingLumpSumAverage).toBe(100000);
  });

  it('uses a representative long-run median when a fund SIP amount changes recently', () => {
    const baseline = buildPersonalizedSimulationBaseline({
      currentCorpus: 5000000,
      portfolioXirr: 0.1269,
      transactions: [
        { fund_id: 'fund-a', transaction_date: '2025-05-05', transaction_type: 'purchase', units: 10, amount: 10000 },
        { fund_id: 'fund-a', transaction_date: '2025-06-05', transaction_type: 'purchase', units: 10, amount: 10000 },
        { fund_id: 'fund-a', transaction_date: '2025-07-07', transaction_type: 'purchase', units: 10, amount: 10000 },
        { fund_id: 'fund-a', transaction_date: '2025-08-07', transaction_type: 'purchase', units: 10, amount: 10000 },
        { fund_id: 'fund-a', transaction_date: '2025-09-08', transaction_type: 'purchase', units: 10, amount: 10000 },
        { fund_id: 'fund-a', transaction_date: '2025-10-06', transaction_type: 'purchase', units: 10, amount: 10000 },
        { fund_id: 'fund-a', transaction_date: '2025-11-07', transaction_type: 'purchase', units: 10, amount: 20000 },
        { fund_id: 'fund-a', transaction_date: '2025-12-08', transaction_type: 'purchase', units: 10, amount: 20000 },
        { fund_id: 'fund-a', transaction_date: '2026-01-07', transaction_type: 'purchase', units: 10, amount: 20000 },
        { fund_id: 'fund-a', transaction_date: '2026-02-09', transaction_type: 'purchase', units: 10, amount: 20000 },
        { fund_id: 'fund-a', transaction_date: '2026-03-09', transaction_type: 'purchase', units: 10, amount: 20000 },
      ],
    });

    expect(baseline.monthlySip).toBe(10000);
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

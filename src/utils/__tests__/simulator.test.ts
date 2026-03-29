import { buildSimulationSummary, buildSimulationTimeline } from '../simulator';

describe('simulator utils', () => {
  it('projects a higher terminal value than invested capital for positive return assumptions', () => {
    const summary = buildSimulationSummary({
      monthlySip: 25000,
      lumpSum: 500000,
      annualReturnPct: 12,
      years: 15,
    });

    expect(summary.terminalValue).toBeGreaterThan(summary.investedCapital);
    expect(summary.wealthGain).toBe(summary.terminalValue - summary.investedCapital);
  });

  it('builds a yearly comparison timeline for baseline vs scenario SIP', () => {
    const timeline = buildSimulationTimeline({
      baselineSip: 25000,
      scenarioSip: 30000,
      lumpSum: 0,
      annualReturnPct: 12,
      years: 5,
    });

    expect(timeline).toHaveLength(5);
    expect(timeline[4].scenarioValue).toBeGreaterThan(timeline[4].baselineValue);
  });
});

import {
  computeGoalPlan,
  buildGoalProjectionSeries,
  assumptionsToRates,
  yearsFromNow,
  GOAL_RETURN_PRESET_RATES,
  type GoalPlanInput,
} from '../goalPlanner';

const BASE_INPUT: GoalPlanInput = {
  targetAmount: 50_00_000,
  years: 10,
  lumpSum: 0,
  currentMonthly: 0,
  returnPreset: 'balanced',
};

describe('computeGoalPlan', () => {
  describe('normal case — no lump sum, balanced preset', () => {
    const r = GOAL_RETURN_PRESET_RATES.balanced / 12;
    const n = 120;
    const target = 50_00_000;
    const expectedRequired = (target * r) / (Math.pow(1 + r, n) - 1);

    it('computes requiredMonthly using annuity formula', () => {
      const result = computeGoalPlan(BASE_INPUT);
      expect(result.requiredMonthly).toBeCloseTo(expectedRequired, 0);
    });

    it('fvLumpSum is 0 when lumpSum is 0', () => {
      const result = computeGoalPlan(BASE_INPUT);
      expect(result.fvLumpSum).toBe(0);
    });

    it('projectedCorpus equals target when lumpSum is 0', () => {
      const result = computeGoalPlan(BASE_INPUT);
      expect(result.projectedCorpus).toBeCloseTo(target, 0);
    });

    it('onTrack is false when currentMonthly is 0', () => {
      const result = computeGoalPlan(BASE_INPUT);
      expect(result.onTrack).toBe(false);
    });
  });

  describe('lump sum covers the goal entirely', () => {
    it('sets requiredMonthly to 0', () => {
      const result = computeGoalPlan({ ...BASE_INPUT, lumpSum: 5_00_00_000 });
      expect(result.requiredMonthly).toBe(0);
    });

    it('sets onTrack to true', () => {
      const result = computeGoalPlan({ ...BASE_INPUT, lumpSum: 5_00_00_000 });
      expect(result.onTrack).toBe(true);
    });
  });

  describe('user is on track — currentMonthly > required', () => {
    it('sets gap negative and onTrack true', () => {
      const result = computeGoalPlan({ ...BASE_INPUT, currentMonthly: 5_00_000 });
      expect(result.onTrack).toBe(true);
      expect(result.gap).toBeLessThan(0);
    });
  });

  describe('lump sum reduces required SIP', () => {
    it('requires less monthly investment with a lump sum', () => {
      const withLump = computeGoalPlan({ ...BASE_INPUT, lumpSum: 10_00_000 });
      const withoutLump = computeGoalPlan(BASE_INPUT);
      expect(withLump.requiredMonthly).toBeLessThan(withoutLump.requiredMonthly);
    });
  });

  describe('cautious preset requires higher monthly than balanced', () => {
    it('lower return = higher required SIP', () => {
      const cautious = computeGoalPlan({ ...BASE_INPUT, returnPreset: 'cautious' });
      const balanced = computeGoalPlan(BASE_INPUT);
      expect(cautious.requiredMonthly).toBeGreaterThan(balanced.requiredMonthly);
    });
  });

  describe('higher return rate requires less monthly investment', () => {
    it('higher custom rate = lower required SIP', () => {
      const lowerRates = { cautious: 0.08, balanced: 0.12, growth: 0.12 };
      const higherRates = { cautious: 0.08, balanced: 0.12, growth: 0.15 };
      const atLower = computeGoalPlan({ ...BASE_INPUT, returnPreset: 'growth' }, lowerRates);
      const atHigher = computeGoalPlan({ ...BASE_INPUT, returnPreset: 'growth' }, higherRates);
      expect(atHigher.requiredMonthly).toBeLessThan(atLower.requiredMonthly);
    });
  });

  describe('edge cases', () => {
    it('target = 0 → requiredMonthly = 0, onTrack = true', () => {
      const result = computeGoalPlan({ ...BASE_INPUT, targetAmount: 0 });
      expect(result.requiredMonthly).toBe(0);
      expect(result.onTrack).toBe(true);
    });

    it('years = 0 → requiredMonthly = 0, onTrack = true', () => {
      const result = computeGoalPlan({ ...BASE_INPUT, years: 0 });
      expect(result.requiredMonthly).toBe(0);
      expect(result.onTrack).toBe(true);
    });

    it('negative lump sum is clamped to 0', () => {
      const withNeg = computeGoalPlan({ ...BASE_INPUT, lumpSum: -10_00_000 });
      const withZero = computeGoalPlan({ ...BASE_INPUT, lumpSum: 0 });
      expect(withNeg.requiredMonthly).toBeCloseTo(withZero.requiredMonthly, 0);
    });

    it('negative currentMonthly is clamped to 0', () => {
      const result = computeGoalPlan({ ...BASE_INPUT, currentMonthly: -5000 });
      expect(result.gap).toBeGreaterThan(0);
    });

    it('1-year horizon returns a finite positive monthly', () => {
      const result = computeGoalPlan({ ...BASE_INPUT, years: 1 });
      expect(result.requiredMonthly).toBeGreaterThan(0);
      expect(Number.isFinite(result.requiredMonthly)).toBe(true);
    });
  });

  describe('gap calculation', () => {
    it('gap = requiredMonthly - currentMonthly', () => {
      const current = 20_000;
      const result = computeGoalPlan({ ...BASE_INPUT, currentMonthly: current });
      expect(result.gap).toBeCloseTo(result.requiredMonthly - current, 0);
    });
  });
});

describe('buildGoalProjectionSeries', () => {
  it('starts at month 0', () => {
    const result = computeGoalPlan(BASE_INPUT);
    const series = buildGoalProjectionSeries(BASE_INPUT, result.requiredMonthly);
    expect(series[0].month).toBe(0);
  });

  it('ends at the target month', () => {
    const result = computeGoalPlan(BASE_INPUT);
    const series = buildGoalProjectionSeries(BASE_INPUT, result.requiredMonthly);
    expect(series[series.length - 1].month).toBe(120);
  });

  it('corpus at month 0 equals lump sum', () => {
    const input: GoalPlanInput = { ...BASE_INPUT, lumpSum: 5_00_000 };
    const result = computeGoalPlan(input);
    const series = buildGoalProjectionSeries(input, result.requiredMonthly);
    expect(series[0].corpus).toBeCloseTo(5_00_000, 0);
  });

  it('corpus is monotonically non-decreasing', () => {
    const result = computeGoalPlan(BASE_INPUT);
    const series = buildGoalProjectionSeries(BASE_INPUT, result.requiredMonthly);
    for (let i = 1; i < series.length; i++) {
      expect(series[i].corpus).toBeGreaterThanOrEqual(series[i - 1].corpus);
    }
  });

  it('corpus at last point is approximately equal to target', () => {
    const result = computeGoalPlan(BASE_INPUT);
    const series = buildGoalProjectionSeries(BASE_INPUT, result.requiredMonthly);
    const last = series[series.length - 1];
    expect(last.corpus).toBeCloseTo(BASE_INPUT.targetAmount, -3);
  });

  it('returns at most ~61 points for a 10-year horizon', () => {
    const result = computeGoalPlan(BASE_INPUT);
    const series = buildGoalProjectionSeries(BASE_INPUT, result.requiredMonthly);
    expect(series.length).toBeLessThanOrEqual(62);
  });

  it('returns a single point when years = 0', () => {
    const series = buildGoalProjectionSeries({ ...BASE_INPUT, years: 0 }, 0);
    expect(series).toHaveLength(1);
    expect(series[0].month).toBe(0);
  });

  it('requiredMonthly = 0 means invested stays flat (lump sum only)', () => {
    const series = buildGoalProjectionSeries(
      { ...BASE_INPUT, lumpSum: 10_00_000 },
      0,
    );
    const last = series[series.length - 1];
    expect(last.invested).toBeCloseTo(10_00_000, 0);
  });

  it('last point is exactly the target month even when step does not divide evenly', () => {
    // 130 months: step = ceil(130/60) = 3, last loop m = 129 ≠ 130 → end-point inserted
    const input: GoalPlanInput = { ...BASE_INPUT, years: 130 / 12 };
    const result = computeGoalPlan(input);
    const series = buildGoalProjectionSeries(input, result.requiredMonthly);
    expect(series[series.length - 1].month).toBe(130);
  });
});

describe('assumptionsToRates', () => {
  it('converts percentage values to decimal rates', () => {
    const rates = assumptionsToRates({ cautious: 8, balanced: 12, growth: 12 });
    expect(rates.cautious).toBeCloseTo(0.08, 10);
    expect(rates.balanced).toBeCloseTo(0.12, 10);
    expect(rates.growth).toBeCloseTo(0.12, 10);
  });

  it('matches GOAL_RETURN_PRESET_RATES for default assumptions', () => {
    const rates = assumptionsToRates({ cautious: 8, balanced: 12, growth: 12 });
    expect(rates.cautious).toBeCloseTo(GOAL_RETURN_PRESET_RATES.cautious, 10);
    expect(rates.balanced).toBeCloseTo(GOAL_RETURN_PRESET_RATES.balanced, 10);
    expect(rates.growth).toBeCloseTo(GOAL_RETURN_PRESET_RATES.growth, 10);
  });

  it('handles custom assumption values', () => {
    const rates = assumptionsToRates({ cautious: 6, balanced: 10, growth: 14 });
    expect(rates.cautious).toBeCloseTo(0.06, 10);
    expect(rates.balanced).toBeCloseTo(0.10, 10);
    expect(rates.growth).toBeCloseTo(0.14, 10);
  });
});

describe('yearsFromNow', () => {
  const now = new Date('2025-01-01T00:00:00Z');

  it('returns approximately the right number of years for a future date', () => {
    const years = yearsFromNow('2035-01-01', now);
    expect(years).toBeCloseTo(10, 0);
  });

  it('returns 0 for a past date', () => {
    expect(yearsFromNow('2020-01-01', now)).toBe(0);
  });

  it('returns 0 for an invalid date string', () => {
    expect(yearsFromNow('not-a-date', now)).toBe(0);
  });

  it('returns a positive fractional value for a date 6 months away', () => {
    const years = yearsFromNow('2025-07-01', now);
    expect(years).toBeGreaterThan(0);
    expect(years).toBeLessThan(1);
  });
});

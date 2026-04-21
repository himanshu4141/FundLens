import {
  getMilestones,
  projectRetirementIncome,
  projectWealth,
  toPresentValueEquivalent,
} from '../simulatorCalc';

describe('projectWealth', () => {
  it('zero rate gives linear growth from corpus + SIP', () => {
    const points = projectWealth(1000, 10000, 0, 3);
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ year: 1, value: 22000 });
    expect(points[1]).toEqual({ year: 2, value: 34000 });
    expect(points[2]).toEqual({ year: 3, value: 46000 });
  });

  it('supports an additional top-up at year 0', () => {
    const withoutTopUp = projectWealth(0, 100000, 12, 10);
    const withTopUp = projectWealth(0, 100000, 12, 10, 50000);
    expect(withTopUp[9].value).toBeGreaterThan(withoutTopUp[9].value);
  });

  it('compounds a lumpsum-only portfolio correctly at 12% annual', () => {
    const points = projectWealth(0, 100000, 12, 1);
    expect(points[0].value).toBeCloseTo(112683, -2);
  });

  it('compounds SIP-only flows correctly at 12% annual', () => {
    const points = projectWealth(1000, 0, 12, 1);
    expect(points[0].value).toBeCloseTo(12683, -2);
  });

  it('clamps negative inputs to zero', () => {
    const points = projectWealth(-1000, -5000, -12, 3, -1000);
    expect(points.every((point) => point.value === 0)).toBe(true);
  });
});

describe('getMilestones', () => {
  it('extracts 5Y, 10Y, 15Y, and horizon', () => {
    const points = projectWealth(5000, 0, 12, 20);
    expect(getMilestones(points).map((point) => point.year)).toEqual([5, 10, 15, 20]);
  });

  it('deduplicates when horizon matches a fixed milestone', () => {
    const points = projectWealth(5000, 0, 12, 15);
    expect(getMilestones(points).map((point) => point.year)).toEqual([5, 10, 15]);
  });
});

describe('projectRetirementIncome', () => {
  it('computes monthly income from withdrawal rate', () => {
    const projection = projectRetirementIncome(1_20_00_000, 4, 25, 6);
    expect(projection.monthlyIncome).toBeCloseTo(40000, -1);
    expect(projection.riskLabel).toBe('Moderate');
  });

  it('marks aggressive withdrawals when they outrun returns', () => {
    const projection = projectRetirementIncome(1_00_00_000, 6, 25, 3);
    expect(projection.riskLabel).toBe('Aggressive');
    expect(projection.depletionYear).not.toBeNull();
  });

  it('keeps conservative withdrawals invested for longer', () => {
    const projection = projectRetirementIncome(1_00_00_000, 3, 25, 6);
    expect(projection.riskLabel).toBe('Conservative');
    expect(projection.endCorpus).toBeGreaterThan(0);
  });
});

describe('toPresentValueEquivalent', () => {
  it('translates a future nominal value into today value at 6% inflation', () => {
    expect(toPresentValueEquivalent(12_00_00_000, 6, 15)).toBeCloseTo(5_00_00_000, -7);
  });

  it('returns the same number when inflation or years are zero', () => {
    expect(toPresentValueEquivalent(500000, 0, 15)).toBe(500000);
    expect(toPresentValueEquivalent(500000, 6, 0)).toBe(500000);
  });
});

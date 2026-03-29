import { buildQuarterlyReturns, computePortfolioImpact } from '../fundInsights';

describe('fundInsights', () => {
  it('returns empty quarterly data when there are fewer than two quarter endpoints', () => {
    expect(buildQuarterlyReturns([{ date: '2024-01-15', value: 100 }])).toEqual([]);
  });

  it('builds trailing quarterly returns from NAV history', () => {
    const result = buildQuarterlyReturns([
      { date: '2024-01-15', value: 100 },
      { date: '2024-03-31', value: 110 },
      { date: '2024-06-30', value: 121 },
      { date: '2024-09-30', value: 115 },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('2024 Q2');
    expect(result[0].returnPct).toBeCloseTo(10, 1);
    expect(result[1].returnPct).toBeCloseTo(-4.96, 1);
  });

  it('skips non-positive starting quarters and limits the output to the trailing six entries', () => {
    const result = buildQuarterlyReturns([
      { date: '2023-03-31', value: 0 },
      { date: '2023-06-30', value: 10 },
      { date: '2023-09-30', value: 12 },
      { date: '2023-12-31', value: 13 },
      { date: '2024-03-31', value: 14 },
      { date: '2024-06-30', value: 15 },
      { date: '2024-09-30', value: 16 },
      { date: '2024-12-31', value: 18 },
      { date: '2025-03-31', value: 20 },
    ]);

    expect(result).toHaveLength(6);
    expect(result[0].label).toBe('2023 Q4');
    expect(result[result.length - 1].label).toBe('2025 Q1');
  });

  it('computes portfolio share and rank for a holding', () => {
    const impact = computePortfolioImpact({
      currentValue: 3000,
      holdingValues: [5000, 3000, 1000],
    });

    expect(impact).not.toBeNull();
    expect(impact!.sharePct).toBeCloseTo(33.33, 1);
    expect(impact!.rank).toBe(2);
    expect(impact!.holdingCount).toBe(3);
  });

  it('returns null when current value is missing or the portfolio total is non-positive', () => {
    expect(computePortfolioImpact({ currentValue: null, holdingValues: [100, 200] })).toBeNull();
    expect(computePortfolioImpact({ currentValue: 100, holdingValues: [0, 0] })).toBeNull();
  });

  it('falls back to the holding count when the current value is not found in the sorted values', () => {
    expect(computePortfolioImpact({ currentValue: 150, holdingValues: [200, 100] })).toEqual({
      sharePct: 50,
      rank: 2,
      holdingCount: 2,
    });
  });
});

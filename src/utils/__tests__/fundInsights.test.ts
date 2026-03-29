import { buildQuarterlyReturns, computePortfolioImpact } from '../fundInsights';

describe('fundInsights', () => {
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
});

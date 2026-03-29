import { buildPortfolioTimelineSeries } from '../portfolioTimeline';

describe('buildPortfolioTimelineSeries()', () => {
  it('builds indexed portfolio and benchmark series from holdings over time', () => {
    const result = buildPortfolioTimelineSeries({
      funds: [
        { id: 'fund-1', scheme_code: 101 },
        { id: 'fund-2', scheme_code: 202 },
      ],
      transactions: [
        { fund_id: 'fund-1', transaction_date: '2024-01-01', transaction_type: 'purchase', units: 10 },
        { fund_id: 'fund-2', transaction_date: '2024-01-03', transaction_type: 'purchase', units: 5 },
      ],
      navRows: [
        { scheme_code: 101, nav_date: '2024-01-01', nav: 100 },
        { scheme_code: 101, nav_date: '2024-01-03', nav: 110 },
        { scheme_code: 202, nav_date: '2024-01-03', nav: 200 },
      ],
      indexRows: [
        { index_date: '2024-01-01', close_value: 1000 },
        { index_date: '2024-01-02', close_value: 1010 },
        { index_date: '2024-01-03', close_value: 1050 },
      ],
      window: '1Y',
    });

    expect(result.points).toHaveLength(3);
    expect(result.points[0].portfolioValue).toBe(1000);
    expect(result.points[0].portfolioIndexed).toBeCloseTo(100, 5);
    expect(result.points[2].portfolioValue).toBe(2100);
    expect(result.points[2].portfolioIndexed).toBeCloseTo(210, 5);
    expect(result.points[2].benchmarkIndexed).toBeCloseTo(105, 5);
  });

  it('applies redemptions when calculating units held', () => {
    const result = buildPortfolioTimelineSeries({
      funds: [{ id: 'fund-1', scheme_code: 101 }],
      transactions: [
        { fund_id: 'fund-1', transaction_date: '2024-01-01', transaction_type: 'purchase', units: 10 },
        { fund_id: 'fund-1', transaction_date: '2024-01-03', transaction_type: 'redemption', units: 4 },
      ],
      navRows: [
        { scheme_code: 101, nav_date: '2024-01-01', nav: 100 },
        { scheme_code: 101, nav_date: '2024-01-03', nav: 120 },
      ],
      indexRows: [
        { index_date: '2024-01-01', close_value: 1000 },
        { index_date: '2024-01-03', close_value: 1100 },
      ],
      window: '1Y',
    });

    expect(result.points[1].portfolioValue).toBe(720);
  });

  it('drops leading dates before the portfolio has any value', () => {
    const result = buildPortfolioTimelineSeries({
      funds: [{ id: 'fund-1', scheme_code: 101 }],
      transactions: [
        { fund_id: 'fund-1', transaction_date: '2024-01-03', transaction_type: 'purchase', units: 2 },
      ],
      navRows: [
        { scheme_code: 101, nav_date: '2024-01-03', nav: 100 },
      ],
      indexRows: [
        { index_date: '2024-01-01', close_value: 1000 },
        { index_date: '2024-01-02', close_value: 1005 },
        { index_date: '2024-01-03', close_value: 1010 },
      ],
      window: '1Y',
    });

    expect(result.points).toHaveLength(1);
    expect(result.points[0].date).toBe('2024-01-03');
    expect(result.points[0].portfolioIndexed).toBeCloseTo(100, 5);
  });

  it('returns no points when benchmark data is empty', () => {
    const result = buildPortfolioTimelineSeries({
      funds: [{ id: 'fund-1', scheme_code: 101 }],
      transactions: [],
      navRows: [],
      indexRows: [],
      window: '1Y',
    });

    expect(result.points).toEqual([]);
  });
});

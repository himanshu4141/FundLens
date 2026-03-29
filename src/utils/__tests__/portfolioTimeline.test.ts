import { buildPortfolioTimelineSeries } from '../portfolioTimeline';

describe('buildPortfolioTimelineSeries()', () => {
  const isoDaysAgo = (daysAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  };

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
    expect(result.benchmarkAvailable).toBe(true);
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

  it('falls back to a portfolio-only timeline when benchmark data is empty', () => {
    const result = buildPortfolioTimelineSeries({
      funds: [{ id: 'fund-1', scheme_code: 101 }],
      transactions: [
        { fund_id: 'fund-1', transaction_date: isoDaysAgo(30), transaction_type: 'purchase', units: 10 },
      ],
      navRows: [
        { scheme_code: 101, nav_date: isoDaysAgo(30), nav: 100 },
        { scheme_code: 101, nav_date: isoDaysAgo(1), nav: 120 },
      ],
      indexRows: [],
      window: '1Y',
    });

    expect(result.benchmarkAvailable).toBe(false);
    expect(result.points).toHaveLength(2);
    expect(result.points[1].benchmarkIndexed).toBe(100);
  });

  it('ignores unknown transaction types when applying unit changes', () => {
    const result = buildPortfolioTimelineSeries({
      funds: [{ id: 'fund-1', scheme_code: 101 }],
      transactions: [
        { fund_id: 'fund-1', transaction_date: isoDaysAgo(300), transaction_type: 'purchase', units: 10 },
        { fund_id: 'fund-1', transaction_date: isoDaysAgo(150), transaction_type: 'bonus', units: 999 },
      ],
      navRows: [
        { scheme_code: 101, nav_date: isoDaysAgo(300), nav: 100 },
        { scheme_code: 101, nav_date: isoDaysAgo(1), nav: 120 },
      ],
      indexRows: [
        { index_date: isoDaysAgo(300), close_value: 1000 },
        { index_date: isoDaysAgo(1), close_value: 1100 },
      ],
      window: '1Y',
    });

    expect(result.points).toHaveLength(2);
    expect(result.points[1].portfolioValue).toBe(1200);
  });

  it('falls back to portfolio-only dates when benchmark history ends before holdings start', () => {
    const result = buildPortfolioTimelineSeries({
      funds: [{ id: 'fund-1', scheme_code: 101 }],
      transactions: [
        { fund_id: 'fund-1', transaction_date: isoDaysAgo(30), transaction_type: 'purchase', units: 10 },
      ],
      navRows: [
        { scheme_code: 101, nav_date: isoDaysAgo(30), nav: 100 },
        { scheme_code: 101, nav_date: isoDaysAgo(1), nav: 120 },
      ],
      indexRows: [
        { index_date: isoDaysAgo(400), close_value: 1000 },
        { index_date: isoDaysAgo(365), close_value: 1010 },
      ],
      window: '1Y',
    });

    expect(result.benchmarkAvailable).toBe(false);
    expect(result.points[0].portfolioIndexed).toBe(100);
  });
});

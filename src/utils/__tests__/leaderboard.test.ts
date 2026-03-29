import { buildLeaderboardRows } from '../leaderboard';

describe('buildLeaderboardRows()', () => {
  const isoDaysAgo = (daysAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  };

  it('sorts rows by fund return minus benchmark return', () => {
    const rows = buildLeaderboardRows({
      funds: [
        { id: 'fund-1', schemeName: 'Fund A', schemeCategory: 'Flexi Cap', schemeCode: 101 },
        { id: 'fund-2', schemeName: 'Fund B', schemeCategory: 'Large Cap', schemeCode: 202 },
      ],
      transactionsByFund: new Map([
        ['fund-1', [{ transaction_date: isoDaysAgo(300), transaction_type: 'purchase', units: 10, amount: 1000 }]],
        ['fund-2', [{ transaction_date: isoDaysAgo(300), transaction_type: 'purchase', units: 10, amount: 1000 }]],
      ]),
      navHistoryByScheme: new Map([
        [101, [
          { date: isoDaysAgo(300), value: 100 },
          { date: isoDaysAgo(1), value: 120 },
        ]],
        [202, [
          { date: isoDaysAgo(300), value: 100 },
          { date: isoDaysAgo(1), value: 104 },
        ]],
      ]),
      benchmarkHistory: [
        { date: isoDaysAgo(300), value: 1000 },
        { date: isoDaysAgo(1), value: 1100 },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('fund-1');
    expect(rows[0].verdict).toBe('leader');
    expect(rows[1].verdict).toBe('laggard');
  });

  it('uses the previous benchmark point when the latest fund date falls between benchmark dates', () => {
    const rows = buildLeaderboardRows({
      funds: [{ id: 'fund-1', schemeName: 'Alpha', schemeCategory: 'Flexi Cap', schemeCode: 101 }],
      transactionsByFund: new Map([
        ['fund-1', [{ transaction_date: isoDaysAgo(300), transaction_type: 'purchase', units: 10, amount: 1000 }]],
      ]),
      navHistoryByScheme: new Map([
        [101, [
          { date: isoDaysAgo(300), value: 100 },
          { date: isoDaysAgo(1), value: 120 },
        ]],
      ]),
      benchmarkHistory: [
        { date: isoDaysAgo(300), value: 1000 },
        { date: isoDaysAgo(2), value: 1090 },
        { date: isoDaysAgo(0), value: 1110 },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].benchmarkReturnPct).toBeCloseTo(9);
  });

  it('returns no rows when a fund has no transaction history', () => {
    const rows = buildLeaderboardRows({
      funds: [{ id: 'fund-1', schemeName: 'Alpha', schemeCategory: 'Flexi Cap', schemeCode: 101 }],
      transactionsByFund: new Map(),
      navHistoryByScheme: new Map([
        [101, [
          { date: isoDaysAgo(300), value: 100 },
          { date: isoDaysAgo(1), value: 120 },
        ]],
      ]),
      benchmarkHistory: [
        { date: isoDaysAgo(300), value: 1000 },
        { date: isoDaysAgo(1), value: 1100 },
      ],
    });

    expect(rows).toEqual([]);
  });

  it('returns no rows when the fund position is fully redeemed', () => {
    const rows = buildLeaderboardRows({
      funds: [{ id: 'fund-1', schemeName: 'Alpha', schemeCategory: 'Flexi Cap', schemeCode: 101 }],
      transactionsByFund: new Map([
        ['fund-1', [
          { transaction_date: isoDaysAgo(300), transaction_type: 'purchase', units: 10, amount: 1000 },
          { transaction_date: isoDaysAgo(100), transaction_type: 'redemption', units: 10, amount: 1200 },
        ]],
      ]),
      navHistoryByScheme: new Map([
        [101, [
          { date: isoDaysAgo(300), value: 100 },
          { date: isoDaysAgo(1), value: 120 },
        ]],
      ]),
      benchmarkHistory: [
        { date: isoDaysAgo(300), value: 1000 },
        { date: isoDaysAgo(1), value: 1100 },
      ],
    });

    expect(rows).toEqual([]);
  });

  it('returns no rows when there is not enough aligned benchmark data after the common start', () => {
    const rows = buildLeaderboardRows({
      funds: [{ id: 'fund-1', schemeName: 'Alpha', schemeCategory: 'Flexi Cap', schemeCode: 101 }],
      transactionsByFund: new Map([
        ['fund-1', [{ transaction_date: isoDaysAgo(30), transaction_type: 'purchase', units: 10, amount: 1000 }]],
      ]),
      navHistoryByScheme: new Map([
        [101, [
          { date: isoDaysAgo(30), value: 100 },
          { date: isoDaysAgo(1), value: 120 },
        ]],
      ]),
      benchmarkHistory: [
        { date: isoDaysAgo(300), value: 1000 },
        { date: isoDaysAgo(31), value: 1050 },
      ],
    });

    expect(rows).toEqual([]);
  });
});

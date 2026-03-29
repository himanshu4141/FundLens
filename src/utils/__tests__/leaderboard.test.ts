import { buildLeaderboardRows } from '../leaderboard';

describe('buildLeaderboardRows()', () => {
  it('sorts rows by fund return minus benchmark return', () => {
    const rows = buildLeaderboardRows({
      funds: [
        { id: 'fund-1', schemeName: 'Fund A', schemeCategory: 'Flexi Cap', schemeCode: 101 },
        { id: 'fund-2', schemeName: 'Fund B', schemeCategory: 'Large Cap', schemeCode: 202 },
      ],
      transactionsByFund: new Map([
        ['fund-1', [{ transaction_date: '2024-01-01', transaction_type: 'purchase', units: 10, amount: 1000 }]],
        ['fund-2', [{ transaction_date: '2024-01-01', transaction_type: 'purchase', units: 10, amount: 1000 }]],
      ]),
      navHistoryByScheme: new Map([
        [101, [
          { date: '2024-01-01', value: 100 },
          { date: '2024-06-01', value: 120 },
        ]],
        [202, [
          { date: '2024-01-01', value: 100 },
          { date: '2024-06-01', value: 104 },
        ]],
      ]),
      benchmarkHistory: [
        { date: '2024-01-01', value: 1000 },
        { date: '2024-06-01', value: 1100 },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('fund-1');
    expect(rows[0].verdict).toBe('leader');
    expect(rows[1].verdict).toBe('laggard');
  });
});

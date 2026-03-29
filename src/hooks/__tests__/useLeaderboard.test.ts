import { fetchLeaderboardData, useLeaderboard } from '../useLeaderboard';
import { supabase } from '@/src/lib/supabase';
import { useQuery } from '@tanstack/react-query';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

function makeChain(response: { data: unknown; error: unknown }): any {
  const chain = {
    data: response.data,
    error: response.error,
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    order: jest.fn(),
  };
  ['select', 'eq', 'in', 'order'].forEach((method) =>
    (chain as Record<string, jest.Mock>)[method].mockReturnValue(chain),
  );
  return chain;
}

const mockFrom = supabase.from as jest.Mock;
const mockUseQuery = useQuery as jest.Mock;

describe('fetchLeaderboardData()', () => {
  const isoDaysAgo = (daysAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty rows when the user has no funds', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'fund') return makeChain({ data: [], error: null });
      return makeChain({ data: [], error: null });
    });

    await expect(fetchLeaderboardData('user-1', '^NSEI')).resolves.toEqual([]);
  });

  it('builds ranked rows from fund, transaction, nav, and index data', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'fund') {
        return makeChain({
          data: [
            {
              id: 'fund-1',
              scheme_code: 101,
              scheme_name: 'Alpha Fund',
              scheme_category: 'Equity',
            },
          ],
          error: null,
        });
      }
      if (table === 'transaction') {
        return makeChain({
          data: [
            {
              fund_id: 'fund-1',
              transaction_date: isoDaysAgo(300),
              transaction_type: 'purchase',
              units: 10,
              amount: 1000,
            },
          ],
          error: null,
        });
      }
      if (table === 'nav_history') {
        return makeChain({
          data: [
            { scheme_code: 101, nav_date: isoDaysAgo(300), nav: 100 },
            { scheme_code: 101, nav_date: isoDaysAgo(1), nav: 120 },
          ],
          error: null,
        });
      }
      if (table === 'index_history') {
        return makeChain({
          data: [
            { index_date: isoDaysAgo(300), close_value: 100 },
            { index_date: isoDaysAgo(1), close_value: 110 },
          ],
          error: null,
        });
      }
      return makeChain({ data: [], error: null });
    });

    const rows = await fetchLeaderboardData('user-1', '^NSEI');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'fund-1',
      schemeName: 'Alpha Fund',
      verdict: 'leader',
    });
  });

  it('throws when the transactions query fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'fund') {
        return makeChain({
          data: [{ id: 'fund-1', scheme_code: 101, scheme_name: 'Alpha', scheme_category: 'Equity' }],
          error: null,
        });
      }
      if (table === 'transaction') {
        return makeChain({ data: null, error: new Error('tx failed') });
      }
      return makeChain({ data: [], error: null });
    });

    await expect(fetchLeaderboardData('user-1', '^NSEI')).rejects.toThrow('tx failed');
  });
});

describe('useLeaderboard()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('configures react-query with the expected key and enabled flag', () => {
    mockUseQuery.mockReturnValue({ data: [] });

    const result = useLeaderboard('user-1', '^NSEI');

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['leaderboard', 'user-1', '^NSEI'],
        enabled: true,
        staleTime: 5 * 60 * 1000,
      }),
    );
    expect(result).toEqual({ data: [] });
  });

  it('disables the query when userId is missing', () => {
    mockUseQuery.mockReturnValue({ data: [] });

    useLeaderboard(null, '^NSEI');

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    );
  });
});

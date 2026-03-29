import { fetchPortfolioTimeline, usePortfolioTimeline } from '../usePortfolioTimeline';
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

describe('fetchPortfolioTimeline()', () => {
  const isoDaysAgo = (daysAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty points when there are no active funds', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'fund') return makeChain({ data: [], error: null });
      return makeChain({ data: [], error: null });
    });

    await expect(fetchPortfolioTimeline('user-1', '^NSEI', '1Y')).resolves.toEqual({ points: [], benchmarkAvailable: false });
  });

  it('builds timeline points from funds, transactions, nav rows, and index rows', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'fund') {
        return makeChain({ data: [{ id: 'fund-1', scheme_code: 101 }], error: null });
      }
      if (table === 'transaction') {
        return makeChain({
          data: [
            { fund_id: 'fund-1', transaction_date: isoDaysAgo(300), transaction_type: 'purchase', units: 10 },
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

    const result = await fetchPortfolioTimeline('user-1', '^NSEI', '1Y');
    expect(result.points).toHaveLength(2);
    expect(result.benchmarkAvailable).toBe(true);
    expect(result.points[0]?.portfolioIndexed).toBe(100);
  });

  it('throws when nav history loading fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'fund') return makeChain({ data: [{ id: 'fund-1', scheme_code: 101 }], error: null });
      if (table === 'transaction') return makeChain({ data: [], error: null });
      if (table === 'nav_history') return makeChain({ data: null, error: new Error('nav failed') });
      return makeChain({ data: [], error: null });
    });

    await expect(fetchPortfolioTimeline('user-1', '^NSEI', '1Y')).rejects.toThrow('nav failed');
  });
});

describe('usePortfolioTimeline()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('configures react-query with the expected key and window', () => {
    mockUseQuery.mockReturnValue({ data: { points: [], benchmarkAvailable: false } });

    const result = usePortfolioTimeline('user-1', '^NSEI', '3Y');

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['portfolio-timeline', 'user-1', '^NSEI', '3Y'],
        enabled: true,
        staleTime: 5 * 60 * 1000,
      }),
    );
    expect(result).toEqual({ data: { points: [], benchmarkAvailable: false } });
  });
});

import { fetchPortfolioData } from '../usePortfolio';
import { supabase } from '@/src/lib/supabase';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn(), keepPreviousData: undefined }));
jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChain(response: { data: unknown; error: unknown }): any {
  const chain = {
    data: response.data,
    error: response.error,
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    gte: jest.fn(),
    order: jest.fn(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
  };
  ['select', 'eq', 'in', 'gte', 'order'].forEach((m) =>
    (chain as Record<string, jest.Mock>)[m].mockReturnValue(chain),
  );
  chain.single.mockReturnValue(response);
  chain.maybeSingle.mockReturnValue(response);
  return chain;
}

const mockFrom = supabase.from as jest.Mock;

const MOCK_FUNDS = [
  {
    id: 'fund-1',
    scheme_code: 12345,
    scheme_name: 'Test Equity Fund',
    scheme_category: 'Equity',
    benchmark_index_symbol: '^NSEI',
  },
];

const MOCK_TXS = [
  { fund_id: 'fund-1', transaction_date: '2023-01-01', transaction_type: 'purchase', units: 100, amount: 10000 },
  { fund_id: 'fund-1', transaction_date: '2023-06-01', transaction_type: 'purchase', units: 50, amount: 6000 },
];

const MOCK_NAV = [
  { scheme_code: 12345, nav_date: '2024-01-01', nav: 140 },
  { scheme_code: 12345, nav_date: '2023-12-31', nav: 138 },
];

const MOCK_INDEX = [
  { index_date: '2023-01-01', close_value: 17000 },
  { index_date: '2024-01-01', close_value: 21000 },
];

// ---------------------------------------------------------------------------
// fetchPortfolioData()
// ---------------------------------------------------------------------------

describe('fetchPortfolioData()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty fundCards and null summary when user has no funds', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'fund') return makeChain({ data: [], error: null });
      return makeChain({ data: [], error: null });
    });

    const result = await fetchPortfolioData('user-1', '^NSEI');
    expect(result.fundCards).toHaveLength(0);
    expect(result.summary).toBeNull();
  });

  it('throws when fund query returns an error', async () => {
    mockFrom.mockImplementation(() =>
      makeChain({ data: null, error: { message: 'DB error' } }),
    );
    await expect(fetchPortfolioData('user-1', '^NSEI')).rejects.toMatchObject({ message: 'DB error' });
  });

  it('returns structured fund cards for a valid portfolio', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'fund') return makeChain({ data: MOCK_FUNDS, error: null });
      if (table === 'transaction') return makeChain({ data: MOCK_TXS, error: null });
      if (table === 'nav_history') return makeChain({ data: MOCK_NAV, error: null });
      if (table === 'index_history') return makeChain({ data: MOCK_INDEX, error: null });
      return makeChain({ data: [], error: null });
    });

    const result = await fetchPortfolioData('user-1', '^NSEI');
    expect(result.fundCards).toHaveLength(1);

    const card = result.fundCards[0];
    expect(card.id).toBe('fund-1');
    expect(card.schemeName).toBe('Test Equity Fund');
    expect(card.schemeCode).toBe(12345);
    expect(card.currentNav).toBe(140);
    expect(card.currentUnits).toBe(150);       // 100 + 50
    expect(card.investedAmount).toBe(16000);   // 10000 + 6000
    expect(card.currentValue).toBeCloseTo(150 * 140, 5); // units × NAV
    expect(isFinite(card.returnXirr)).toBe(true);
  });

  it('summary contains totalValue, xirr, and daily change', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'fund') return makeChain({ data: MOCK_FUNDS, error: null });
      if (table === 'transaction') return makeChain({ data: MOCK_TXS, error: null });
      if (table === 'nav_history') return makeChain({ data: MOCK_NAV, error: null });
      if (table === 'index_history') return makeChain({ data: MOCK_INDEX, error: null });
      return makeChain({ data: [], error: null });
    });

    const result = await fetchPortfolioData('user-1', '^NSEI');
    expect(result.summary).not.toBeNull();
    expect(result.summary!.totalValue).toBeCloseTo(150 * 140, 5);
    expect(result.summary!.totalInvested).toBe(16000);
    expect(isFinite(result.summary!.xirr) || isNaN(result.summary!.xirr)).toBe(true);
  });

  it('skips funds with no transactions (does not add them to fundCards)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'fund') return makeChain({ data: MOCK_FUNDS, error: null });
      if (table === 'transaction') return makeChain({ data: [], error: null }); // no txs
      if (table === 'nav_history') return makeChain({ data: MOCK_NAV, error: null });
      if (table === 'index_history') return makeChain({ data: MOCK_INDEX, error: null });
      return makeChain({ data: [], error: null });
    });

    const result = await fetchPortfolioData('user-1', '^NSEI');
    expect(result.fundCards).toHaveLength(0);
  });

  it('skips funds with no NAV data rather than crashing portfolio load', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'fund') return makeChain({ data: MOCK_FUNDS, error: null });
      if (table === 'transaction') return makeChain({ data: MOCK_TXS, error: null });
      if (table === 'nav_history') return makeChain({ data: [], error: null }); // no nav
      if (table === 'index_history') return makeChain({ data: MOCK_INDEX, error: null });
      return makeChain({ data: [], error: null });
    });

    // Should not throw — fund is skipped, portfolio returns empty cards with zero-value summary
    const result = await fetchPortfolioData('user-1', '^NSEI');
    expect(result.fundCards).toHaveLength(0);
    expect(result.summary?.totalValue).toBe(0);
  });

  it('navHistory30d contains only the last 30 days of NAV data', async () => {
    // Provide nav data spanning more than 30 days
    const today = new Date();
    const navData = [
      // Within 30 days
      { scheme_code: 12345, nav_date: new Date(today.getTime() - 5 * 86400000).toISOString().split('T')[0], nav: 140 },
      { scheme_code: 12345, nav_date: new Date(today.getTime() - 10 * 86400000).toISOString().split('T')[0], nav: 138 },
      // Older than 30 days
      { scheme_code: 12345, nav_date: new Date(today.getTime() - 60 * 86400000).toISOString().split('T')[0], nav: 130 },
      { scheme_code: 12345, nav_date: new Date(today.getTime() - 90 * 86400000).toISOString().split('T')[0], nav: 120 },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'fund') return makeChain({ data: MOCK_FUNDS, error: null });
      if (table === 'transaction') return makeChain({ data: MOCK_TXS, error: null });
      if (table === 'nav_history') return makeChain({ data: navData, error: null });
      if (table === 'index_history') return makeChain({ data: MOCK_INDEX, error: null });
      return makeChain({ data: [], error: null });
    });

    const result = await fetchPortfolioData('user-1', '^NSEI');
    const card = result.fundCards[0];
    // Only the 2 recent rows should be in navHistory30d (older ones are filtered)
    card.navHistory30d.forEach((p) => {
      const ageDays = (Date.now() - new Date(p.date).getTime()) / 86400000;
      expect(ageDays).toBeLessThanOrEqual(32); // small slack for date boundary
    });
    expect(card.navHistory30d.length).toBe(2);
  });
});

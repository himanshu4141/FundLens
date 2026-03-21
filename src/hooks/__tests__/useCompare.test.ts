import { buildChartSeries, fetchCompareData, type CompareData } from '../useCompare';
import { supabase } from '@/src/lib/supabase';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

type CommonNavSeries = CompareData['commonNavSeries'];

// ---------------------------------------------------------------------------
// buildChartSeries()
// ---------------------------------------------------------------------------

function makeSeries(
  dates: string[],
  fundValues: Record<string, number[]>,
): CommonNavSeries {
  return dates.map((date, i) => ({
    date,
    funds: Object.fromEntries(
      Object.entries(fundValues).map(([id, vals]) => [id, vals[i]]),
    ),
  }));
}

describe('buildChartSeries()', () => {
  it('returns one empty sub-array per fund id when series is empty', () => {
    // fundIds.map always produces one entry per id, even when input series is empty
    const result = buildChartSeries([], ['a'], 'All');
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(0);
  });

  it('returns one array per fund id', () => {
    const series = makeSeries(
      ['2023-01-01', '2023-06-01'],
      { a: [100, 120], b: [200, 210] },
    );
    const result = buildChartSeries(series, ['a', 'b'], 'All');
    expect(result).toHaveLength(2);
  });

  it('re-indexes to 100 at the first point for each fund', () => {
    const series = makeSeries(
      ['2023-01-01', '2023-06-01', '2024-01-01'],
      { a: [200, 250, 300] },
    );
    const result = buildChartSeries(series, ['a'], 'All');
    expect(result[0][0].value).toBeCloseTo(100, 5);
    expect(result[0][1].value).toBeCloseTo(125, 5); // 250/200*100
    expect(result[0][2].value).toBeCloseTo(150, 5); // 300/200*100
  });

  it('two funds indexed independently from their own base values', () => {
    const series = makeSeries(
      ['2023-01-01', '2023-06-01'],
      { a: [100, 120], b: [500, 600] },
    );
    const result = buildChartSeries(series, ['a', 'b'], 'All');
    expect(result[0][0].value).toBeCloseTo(100, 5);
    expect(result[0][1].value).toBeCloseTo(120, 5);
    expect(result[1][0].value).toBeCloseTo(100, 5);
    expect(result[1][1].value).toBeCloseTo(120, 5);
  });

  it('samples to ≤60 points for long series', () => {
    const dates = Array.from({ length: 200 }, (_, i) => {
      const d = new Date(2020, 0, i + 1);
      return d.toISOString().split('T')[0];
    });
    const series = makeSeries(dates, { a: dates.map((_, i) => 100 + i) });
    const result = buildChartSeries(series, ['a'], 'All');
    expect(result[0].length).toBeLessThanOrEqual(60);
  });

  it('applies time window filter before re-indexing', () => {
    const series = makeSeries(
      ['2020-01-01', '2021-01-01', '2022-01-01', '2023-01-01', '2024-01-01'],
      { a: [50, 75, 100, 120, 150] },
    );
    // With '1Y' window, only recent points survive; base should be the first surviving point
    const result = buildChartSeries(series, ['a'], '1Y');
    // First point of the filtered window must be 100
    expect(result[0][0].value).toBeCloseTo(100, 5);
  });

  it('preserves fund id ordering in output', () => {
    const series = makeSeries(
      ['2023-01-01', '2023-12-31'],
      { a: [100, 200], b: [100, 110] },
    );
    const resultAB = buildChartSeries(series, ['a', 'b'], 'All');
    const resultBA = buildChartSeries(series, ['b', 'a'], 'All');
    // a: 100% gain; b: 10% gain
    expect(resultAB[0][1].value).toBeCloseTo(200, 5);
    expect(resultAB[1][1].value).toBeCloseTo(110, 5);
    expect(resultBA[0][1].value).toBeCloseTo(110, 5);
    expect(resultBA[1][1].value).toBeCloseTo(200, 5);
  });

  it('handles base value of 0 without division by zero', () => {
    const series = makeSeries(
      ['2023-01-01', '2023-06-01'],
      { a: [0, 100] },
    );
    const result = buildChartSeries(series, ['a'], 'All');
    // base is 0 — guard: value stays as-is (100 / 0 should not produce Infinity)
    expect(isFinite(result[0][1].value)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// fetchCompareData() — mocked supabase
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

const MOCK_FUNDS_DB = [
  { id: 'fund-1', scheme_code: 12345, scheme_name: 'Test Fund A', scheme_category: 'Equity' },
  { id: 'fund-2', scheme_code: 67890, scheme_name: 'Test Fund B', scheme_category: 'Debt' },
];

const MOCK_NAV_DB = [
  { scheme_code: 12345, nav_date: '2023-01-01', nav: 100 },
  { scheme_code: 12345, nav_date: '2023-06-01', nav: 120 },
  { scheme_code: 12345, nav_date: '2024-01-01', nav: 140 },
  { scheme_code: 67890, nav_date: '2023-01-01', nav: 50 },
  { scheme_code: 67890, nav_date: '2023-06-01', nav: 55 },
  { scheme_code: 67890, nav_date: '2024-01-01', nav: 60 },
];

const MOCK_TXS_DB = [
  { fund_id: 'fund-1', transaction_date: '2023-01-01', transaction_type: 'purchase', units: 100, amount: 10000 },
  { fund_id: 'fund-2', transaction_date: '2023-01-01', transaction_type: 'purchase', units: 200, amount: 10000 },
];

describe('fetchCompareData()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty result immediately for empty fundIds', async () => {
    const result = await fetchCompareData([]);
    expect(result.funds).toHaveLength(0);
    expect(result.commonNavSeries).toHaveLength(0);
  });

  it('throws on fund query error', async () => {
    mockFrom.mockImplementation(() =>
      makeChain({ data: null, error: { message: 'DB error' } }),
    );
    await expect(fetchCompareData(['fund-1'])).rejects.toMatchObject({ message: 'DB error' });
  });

  it('returns per-fund data for valid fund ids', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'fund') return makeChain({ data: MOCK_FUNDS_DB, error: null });
      if (table === 'nav_history') return makeChain({ data: MOCK_NAV_DB, error: null });
      if (table === 'transaction') return makeChain({ data: MOCK_TXS_DB, error: null });
      return makeChain({ data: [], error: null });
    });

    const result = await fetchCompareData(['fund-1', 'fund-2']);
    expect(result.funds).toHaveLength(2);
    expect(result.funds[0].id).toBe('fund-1');
    expect(result.funds[0].currentNav).toBe(140);
    expect(result.funds[1].id).toBe('fund-2');
    expect(result.funds[1].currentNav).toBe(60);
  });

  it('builds commonNavSeries indexed to 100 at first common date', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'fund') return makeChain({ data: MOCK_FUNDS_DB, error: null });
      if (table === 'nav_history') return makeChain({ data: MOCK_NAV_DB, error: null });
      if (table === 'transaction') return makeChain({ data: MOCK_TXS_DB, error: null });
      return makeChain({ data: [], error: null });
    });

    const result = await fetchCompareData(['fund-1', 'fund-2']);
    expect(result.commonNavSeries.length).toBeGreaterThan(0);
    // First entry: both funds at 100
    const first = result.commonNavSeries[0];
    expect(first.funds['fund-1']).toBeCloseTo(100, 5);
    expect(first.funds['fund-2']).toBeCloseTo(100, 5);
  });

  it('returns 1Y return as percentage when nav history is available', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'fund') return makeChain({ data: [MOCK_FUNDS_DB[0]], error: null });
      if (table === 'nav_history') return makeChain({ data: MOCK_NAV_DB.filter((r) => r.scheme_code === 12345), error: null });
      if (table === 'transaction') return makeChain({ data: [MOCK_TXS_DB[0]], error: null });
      return makeChain({ data: [], error: null });
    });

    const result = await fetchCompareData(['fund-1']);
    expect(result.funds[0].return1Y).not.toBeNull();
    expect(typeof result.funds[0].return1Y).toBe('number');
  });
});

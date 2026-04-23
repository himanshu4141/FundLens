import {
  normaliseTxType,
  parseDate,
  importCASData,
  type CASParseResult,
  type CASTransaction,
  type SupabaseClient,
} from '../import-cas';

// ---------------------------------------------------------------------------
// Mock Supabase client builder
// ---------------------------------------------------------------------------

/**
 * Builds a chainable mock SupabaseClient.
 *
 * Tracks:
 *  - `deleteCalls`  — each array is the ordered [col, val] pairs passed to
 *                     .eq() on a single delete chain (one entry per reversal).
 *  - `upsertedRows` — the rows array passed to the transaction .upsert() call.
 */
function buildMockSupabase({
  fundId = 'fund-id-1',
  benchmarkRows = [],
  schemeMasterError = null,
  txUpsertError = null,
}: {
  fundId?: string;
  benchmarkRows?: Array<{
    scheme_category: string;
    benchmark_index: string;
    benchmark_index_symbol: string;
  }>;
  schemeMasterError?: { message: string } | null;
  txUpsertError?: { message: string } | null;
} = {}) {
  const deleteCalls: Array<Array<[string, unknown]>> = [];
  let upsertedRows: Record<string, unknown>[] = [];
  let upsertedSchemeRow: Record<string, unknown> | null = null;

  function makeDeleteChain(): Record<string, unknown> {
    const eqLog: Array<[string, unknown]> = [];
    deleteCalls.push(eqLog);

    // Each .eq() logs its args and returns the same chain.
    // `await chain` resolves because await on a non-thenable returns the value.
    const chain: Record<string, unknown> = {};
    chain['eq'] = jest.fn((col: string, val: unknown) => {
      eqLog.push([col, val]);
      return chain;
    });
    return chain;
  }

  const deleteMock = jest.fn(() => makeDeleteChain());

  const txUpsertMock = jest.fn((rows: Record<string, unknown>[]) => {
    upsertedRows = rows;
    return { error: txUpsertError, count: txUpsertError ? null : rows.length };
  });

  const singleMock = jest.fn(() => ({ data: { id: fundId }, error: null }));
  const userFundSelectMock = jest.fn(() => ({ single: singleMock }));
  const userFundUpsertMock = jest.fn(() => ({ select: userFundSelectMock }));
  const schemeMasterUpsertMock = jest.fn((row: Record<string, unknown>) => {
    upsertedSchemeRow = row;
    return { error: schemeMasterError };
  });

  const benchmarkSelectMock = jest.fn(() => ({ data: benchmarkRows }));

  const fromMock = jest.fn((table: string) => {
    if (table === 'benchmark_mapping') return { select: benchmarkSelectMock };
    if (table === 'scheme_master') return { upsert: schemeMasterUpsertMock };
    if (table === 'user_fund') return { upsert: userFundUpsertMock };
    if (table === 'transaction') return { delete: deleteMock, upsert: txUpsertMock };
    return {};
  });

  return {
    supabase: { from: fromMock } as unknown as SupabaseClient,
    fromMock,
    deleteMock,
    deleteCalls,
    txUpsertMock,
    getUpsertedRows: () => upsertedRows,
    getUpsertedSchemeRow: () => upsertedSchemeRow,
  };
}

// ---------------------------------------------------------------------------
// Minimal CAS payload helper
// ---------------------------------------------------------------------------

function minimalCAS(transactions: CASTransaction[]): CASParseResult {
  return {
    mutual_funds: [{
      folio_number: '12345678/01',
      amc: 'DSP Mutual Fund',
      schemes: [{
        name: 'DSP Small Cap Fund - Regular Plan - Growth',
        isin: 'INF740K01601',
        type: 'Equity',
        additional_info: { amfi: '119551' },
        transactions,
      }],
    }],
  };
}

// ===========================================================================
// normaliseTxType()
// ===========================================================================

describe('normaliseTxType()', () => {
  // ── Purchase types ─────────────────────────────────────────────────────────
  describe('purchase types', () => {
    it.each([
      ['PURCHASE', 'purchase'],
      ['PURCHASE_SIP', 'purchase'],
      ['purchase', 'purchase'],
      ['buy', 'purchase'],
      ['sip', 'purchase'],
      ['Buy', 'purchase'],
    ])('maps %s → %s', (input, expected) => {
      expect(normaliseTxType(input)).toBe(expected);
    });
  });

  // ── Redemption types ───────────────────────────────────────────────────────
  describe('redemption types', () => {
    it.each([
      ['REDEMPTION', 'redemption'],
      ['redemption', 'redemption'],
      ['withdrawal', 'redemption'],
      ['partial redemption', 'redemption'],
    ])('maps %s → %s', (input, expected) => {
      expect(normaliseTxType(input)).toBe(expected);
    });
  });

  // ── Switch types ───────────────────────────────────────────────────────────
  describe('switch types', () => {
    it.each([
      ['SWITCH_IN', 'switch_in'],
      ['SWITCH_IN_MERGER', 'switch_in'],
      ['switch in to growth', 'switch_in'],
      ['SWITCH_OUT', 'switch_out'],
      ['SWITCH_OUT_MERGER', 'switch_out'],
      ['switch out to direct', 'switch_out'],
    ])('maps %s → %s', (input, expected) => {
      expect(normaliseTxType(input)).toBe(expected);
    });
  });

  // ── Dividend types ─────────────────────────────────────────────────────────
  describe('dividend types', () => {
    it.each([
      ['DIVIDEND_REINVEST', 'dividend_reinvest'],
      ['dividend reinvest', 'dividend_reinvest'],
      ['DIVIDEND_PAYOUT', 'dividend'],
      ['dividend payout', 'dividend'],
      ['dividend', 'dividend'],
    ])('maps %s → %s', (input, expected) => {
      expect(normaliseTxType(input)).toBe(expected);
    });
  });

  // ── REVERSAL — the critical bug fix ────────────────────────────────────────
  describe('REVERSAL (failed-payment undo)', () => {
    it('maps REVERSAL → redemption so units are subtracted, not added', () => {
      expect(normaliseTxType('REVERSAL')).toBe('redemption');
    });

    it('is case-insensitive for REVERSAL', () => {
      expect(normaliseTxType('reversal')).toBe('redemption');
      expect(normaliseTxType('Reversal')).toBe('redemption');
    });
  });

  // ── Types that must return null (skipped, not imported) ───────────────────
  describe('non-actionable types → null', () => {
    it.each([
      'SEGREGATION',
      'STAMP_DUTY_TAX',
      'TDS_TAX',
      'STT_TAX',
      'MISC',
      'UNKNOWN',
    ])('maps %s → null', (input) => {
      expect(normaliseTxType(input)).toBeNull();
    });

    it('maps an empty string → null (not purchase)', () => {
      expect(normaliseTxType('')).toBeNull();
    });

    it('maps a completely unrecognised string → null (not purchase)', () => {
      expect(normaliseTxType('SOME_FUTURE_TYPE')).toBeNull();
      expect(normaliseTxType('bonus_units')).toBeNull();
    });
  });
});

// ===========================================================================
// parseDate()
// ===========================================================================

describe('parseDate()', () => {
  it('passes through an ISO date unchanged', () => {
    expect(parseDate('2024-01-15')).toBe('2024-01-15');
    expect(parseDate('2023-12-31')).toBe('2023-12-31');
  });

  it.each([
    ['15-Jan-2024', '2024-01-15'],
    ['01-Feb-2023', '2023-02-01'],
    ['28-Mar-2022', '2022-03-28'],
    ['05-Apr-2021', '2021-04-05'],
    ['31-May-2020', '2020-05-31'],
    ['30-Jun-2019', '2019-06-30'],
    ['04-Jul-2018', '2018-07-04'],
    ['15-Aug-2017', '2017-08-15'],
    ['01-Sep-2016', '2016-09-01'],
    ['10-Oct-2015', '2015-10-10'],
    ['11-Nov-2014', '2014-11-11'],
    ['25-Dec-2013', '2013-12-25'],
  ])('converts DD-MMM-YYYY %s → %s', (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });

  it('handles DD-MMM-YYYY case-insensitively', () => {
    expect(parseDate('15-JAN-2024')).toBe('2024-01-15');
    expect(parseDate('15-jan-2024')).toBe('2024-01-15');
  });

  it('returns a string for an empty input', () => {
    // Falls back to today's date — just verify it is a non-empty string
    const result = parseDate('');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('passes through an unrecognised raw date unchanged', () => {
    expect(parseDate('15/01/2024')).toBe('15/01/2024');
  });
});

// ===========================================================================
// importCASData() — integration with mocked SupabaseClient
// ===========================================================================

describe('importCASData()', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Happy-path: normal purchase ────────────────────────────────────────────

  it('imports a normal purchase with correct type, units and amount', async () => {
    const { supabase, getUpsertedRows } = buildMockSupabase();

    const parsed = minimalCAS([
      { date: '2024-01-10', type: 'PURCHASE', units: 100, amount: 10000, nav: 100 },
    ]);

    await importCASData(supabase, 'user-1', 'import-1', parsed);

    const rows = getUpsertedRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].transaction_type).toBe('purchase');
    expect(rows[0].units).toBe(100);
    expect(rows[0].amount).toBe(10000);
    expect(rows[0].transaction_date).toBe('2024-01-10');
  });

  it('uses benchmark mapping when the scheme category is present', async () => {
    const { supabase, getUpsertedSchemeRow } = buildMockSupabase({
      benchmarkRows: [
        {
          scheme_category: 'Equity',
          benchmark_index: 'Nifty 100',
          benchmark_index_symbol: '^NIFTY100',
        },
      ],
    });

    const parsed = minimalCAS([
      { date: '2024-01-10', type: 'PURCHASE', units: 100, amount: 10000, nav: 100 },
    ]);

    await importCASData(supabase, 'user-1', 'import-1', parsed);

    expect(getUpsertedSchemeRow()).toMatchObject({
      scheme_code: 119551,
      scheme_name: 'DSP Small Cap Fund - Regular Plan - Growth',
      scheme_category: 'Equity',
      benchmark_index: 'Nifty 100',
      benchmark_index_symbol: '^NIFTY100',
    });
  });

  it('applies Math.abs to negative units and amounts from the CAS', async () => {
    const { supabase, getUpsertedRows } = buildMockSupabase();

    const parsed = minimalCAS([
      { date: '2024-03-01', type: 'REDEMPTION', units: -50, amount: -6000, nav: 120 },
    ]);

    await importCASData(supabase, 'user-1', 'import-1', parsed);

    const rows = getUpsertedRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].units).toBe(50);
    expect(rows[0].amount).toBe(6000);
    expect(rows[0].transaction_type).toBe('redemption');
  });

  // ── REVERSAL handling ──────────────────────────────────────────────────────

  it('maps REVERSAL → redemption type in the upserted row', async () => {
    const { supabase, getUpsertedRows } = buildMockSupabase();

    const parsed = minimalCAS([
      { date: '2024-01-10', type: 'PURCHASE', units: 100, amount: 10000, nav: 100 },
      { date: '2024-01-15', type: 'REVERSAL', units: -100, amount: -10000, nav: 100 },
    ]);

    await importCASData(supabase, 'user-1', 'import-1', parsed);

    const rows = getUpsertedRows();
    const reversalRow = rows.find((r) => r.transaction_date === '2024-01-15');
    expect(reversalRow).toBeDefined();
    expect(reversalRow!.transaction_type).toBe('redemption');
    expect(reversalRow!.units).toBe(100);   // Math.abs applied
    expect(reversalRow!.amount).toBe(10000); // Math.abs applied
  });

  it('issues a compensating delete for a REVERSAL to remove the previously mis-imported purchase row', async () => {
    const { supabase, deleteMock, deleteCalls } = buildMockSupabase();

    const parsed = minimalCAS([
      { date: '2024-01-10', type: 'PURCHASE', units: 100, amount: 10000, nav: 100 },
      { date: '2024-01-15', type: 'REVERSAL', units: -100, amount: -10000, nav: 100 },
    ]);

    await importCASData(supabase, 'user-1', 'import-1', parsed);

    // Exactly one delete chain — one REVERSAL in the CAS
    expect(deleteMock).toHaveBeenCalledTimes(1);

    // The delete targets 'purchase' rows matching the reversal's date/units/amount
    const eqPairs = deleteCalls[0];
    expect(eqPairs).toContainEqual(['transaction_type', 'purchase']);
    expect(eqPairs).toContainEqual(['transaction_date', '2024-01-15']);
    expect(eqPairs).toContainEqual(['units', 100]);
    expect(eqPairs).toContainEqual(['amount', 10000]);
    expect(eqPairs).toContainEqual(['fund_id', 'fund-id-1']);
  });

  it('issues one delete per REVERSAL when multiple reversals are present', async () => {
    const { supabase, deleteMock } = buildMockSupabase();

    const parsed = minimalCAS([
      { date: '2024-01-10', type: 'PURCHASE', units: 100, amount: 10000, nav: 100 },
      { date: '2024-01-15', type: 'REVERSAL', units: -100, amount: -10000, nav: 100 },
      { date: '2024-02-05', type: 'PURCHASE', units: 50, amount: 6000, nav: 120 },
      { date: '2024-02-08', type: 'REVERSAL', units: -50, amount: -6000, nav: 120 },
    ]);

    await importCASData(supabase, 'user-1', 'import-1', parsed);

    expect(deleteMock).toHaveBeenCalledTimes(2);
  });

  it('does not issue a delete when there are no REVERSALs', async () => {
    const { supabase, deleteMock } = buildMockSupabase();

    const parsed = minimalCAS([
      { date: '2024-01-10', type: 'PURCHASE', units: 100, amount: 10000, nav: 100 },
      { date: '2024-06-01', type: 'REDEMPTION', units: 50, amount: 7000, nav: 140 },
    ]);

    await importCASData(supabase, 'user-1', 'import-1', parsed);

    expect(deleteMock).not.toHaveBeenCalled();
  });

  // ── Null-type filtering ────────────────────────────────────────────────────

  it.each([
    ['STAMP_DUTY_TAX', 0, 5],
    ['TDS_TAX', 0, 120],
    ['STT_TAX', 0, 8],
    ['MISC', 0, 0],
    ['UNKNOWN', 0, 0],
    ['SEGREGATION', 10, 0],   // non-zero units — must still be skipped
  ])('filters out %s transactions (null type, never imported)', async (type, units, amount) => {
    const { supabase, getUpsertedRows, txUpsertMock } = buildMockSupabase();

    const parsed = minimalCAS([
      { date: '2024-01-10', type: 'PURCHASE', units: 100, amount: 10000, nav: 100 },
      { date: '2024-01-10', type, units, amount, nav: 0 },
    ]);

    await importCASData(supabase, 'user-1', 'import-1', parsed);

    const rows = getUpsertedRows();
    // Only the PURCHASE row should be upserted
    expect(rows).toHaveLength(1);
    expect(rows[0].transaction_type).toBe('purchase');
    // No null transaction_type should exist
    expect(rows.every((r) => r.transaction_type !== null)).toBe(true);
  });

  it('filters out zero-unit transactions regardless of type', async () => {
    const { supabase, getUpsertedRows } = buildMockSupabase();

    const parsed = minimalCAS([
      { date: '2024-01-10', type: 'PURCHASE', units: 100, amount: 10000, nav: 100 },
      { date: '2024-01-10', type: 'PURCHASE', units: 0, amount: 0, nav: 100 },
    ]);

    await importCASData(supabase, 'user-1', 'import-1', parsed);

    const rows = getUpsertedRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].units).toBe(100);
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  it('skips a scheme with no AMFI code and does not error', async () => {
    const { supabase, fromMock } = buildMockSupabase();

    const parsed: CASParseResult = {
      mutual_funds: [{
        folio_number: '12345678/01',
        amc: 'Unknown AMC',
        schemes: [{
          name: 'Unknown Fund',
          additional_info: {},   // no amfi key
          transactions: [
            { date: '2024-01-10', type: 'PURCHASE', units: 100, amount: 10000, nav: 100 },
          ],
        }],
      }],
    };

    const result = await importCASData(supabase, 'user-1', 'import-1', parsed);

    // Nothing was upserted — fund was skipped
    expect(fromMock).not.toHaveBeenCalledWith('user_fund');
    expect(result.fundsUpdated).toBe(0);
  });

  it('records an error when the fund upsert fails and continues to next scheme', async () => {
    const { supabase } = buildMockSupabase();

    // Override the user-fund upsert to fail
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'benchmark_mapping') return { select: jest.fn(() => ({ data: [] })) };
      if (table === 'scheme_master') {
        return { upsert: jest.fn(() => ({ error: null })) };
      }
      if (table === 'user_fund') {
        return {
          upsert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => ({ data: null, error: { message: 'DB error' } })),
            })),
          })),
        };
      }
      return {};
    });

    const parsed = minimalCAS([
      { date: '2024-01-10', type: 'PURCHASE', units: 100, amount: 10000, nav: 100 },
    ]);

    const result = await importCASData(supabase, 'user-1', 'import-1', parsed);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Fund upsert failed/);
    expect(result.fundsUpdated).toBe(0);
  });

  it('records an error when the shared scheme upsert fails and skips fund creation', async () => {
    const { supabase, fromMock } = buildMockSupabase({
      schemeMasterError: { message: 'scheme write failed' },
    });

    const parsed = minimalCAS([
      { date: '2024-01-10', type: 'PURCHASE', units: 100, amount: 10000, nav: 100 },
    ]);

    const result = await importCASData(supabase, 'user-1', 'import-1', parsed);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Scheme upsert failed/);
    expect(result.fundsUpdated).toBe(0);
    expect(fromMock).not.toHaveBeenCalledWith('user_fund');
  });

  it('records an error when transaction upsert fails after fund creation', async () => {
    const { supabase } = buildMockSupabase({
      txUpsertError: { message: 'transaction write failed' },
    });

    const parsed = minimalCAS([
      { date: '2024-01-10', type: 'PURCHASE', units: 100, amount: 10000, nav: 100 },
    ]);

    const result = await importCASData(supabase, 'user-1', 'import-1', parsed);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Transaction upsert failed/);
    expect(result.fundsUpdated).toBe(1);
    expect(result.transactionsAdded).toBe(0);
  });

  it('returns correct counts for funds and transactions', async () => {
    const { supabase } = buildMockSupabase();

    const parsed = minimalCAS([
      { date: '2024-01-10', type: 'PURCHASE', units: 100, amount: 10000, nav: 100 },
      { date: '2024-06-01', type: 'PURCHASE_SIP', units: 50, amount: 6000, nav: 120 },
    ]);

    const result = await importCASData(supabase, 'user-1', 'import-1', parsed);

    expect(result.fundsUpdated).toBe(1);
    expect(result.errors).toHaveLength(0);
  });
});

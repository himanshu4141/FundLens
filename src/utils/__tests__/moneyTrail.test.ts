import {
  DEFAULT_MONEY_TRAIL_FILTERS,
  applyMoneyTrailControls,
  buildAnnualMoneyFlows,
  buildMoneyTrailCsv,
  buildMoneyTrailSummary,
  buildMoneyTrailTransactions,
  buildPortfolioTransaction,
  compareFinancialYears,
  directionLabel,
  filterMoneyTrailTransactions,
  formatMoneyTrailDate,
  getCurrentFinancialYear,
  getDatePresetRange,
  getFilterDateRange,
  getFinancialYearShortLabel,
  getIndianFinancialYear,
  getUniqueAmcOptions,
  getUniqueFundOptions,
  mapMoneyTrailType,
  normalizeMoneyTrailType,
  parseMoneyTrailAmountInput,
  searchMoneyTrailTransactions,
  sortMoneyTrailTransactions,
  statusLabel,
  transactionUseExplanation,
  type RawMoneyTrailTransaction,
} from '../moneyTrail';
import { buildCashflowsFromTransactions } from '../xirr';

function raw(overrides: Partial<RawMoneyTrailTransaction>): RawMoneyTrailTransaction {
  return {
    id: overrides.id ?? 'tx-1',
    fund_id: overrides.fund_id ?? 'fund-1',
    fund_name: overrides.fund_name ?? 'DSP Large & Mid Cap Fund',
    transaction_date: overrides.transaction_date ?? '2026-04-24',
    transaction_type: overrides.transaction_type ?? 'purchase',
    units: overrides.units ?? 10,
    amount: overrides.amount ?? 1000,
    nav_at_transaction: overrides.nav_at_transaction ?? 100,
    folio_number: overrides.folio_number ?? '12345678/01',
    cas_import_id: overrides.cas_import_id ?? 'import-1',
    ...overrides,
  };
}

describe('moneyTrail transaction type mapping', () => {
  it('maps source transaction types to beginner-friendly labels and directions', () => {
    expect(normalizeMoneyTrailType('PURCHASE_SIP')).toBe('sip_purchase');
    expect(normalizeMoneyTrailType('purchase')).toBe('purchase');
    expect(normalizeMoneyTrailType('redemption')).toBe('redemption');
    expect(normalizeMoneyTrailType('switch_in')).toBe('switch_in');
    expect(normalizeMoneyTrailType('DIVIDEND_REINVEST')).toBe('dividend_reinvestment');
    expect(normalizeMoneyTrailType('DIVIDEND_PAYOUT')).toBe('dividend_payout');

    expect(mapMoneyTrailType('sip_purchase')).toMatchObject({
      userFacingType: 'SIP investment',
      direction: 'money_in',
      includedInInvestedAmount: true,
      includedInXirr: true,
    });
    expect(mapMoneyTrailType('redemption')).toMatchObject({
      userFacingType: 'Withdrawal',
      direction: 'money_out',
      includedInXirr: true,
    });
    expect(normalizeMoneyTrailType('STP IN')).toBe('stp_in');
    expect(normalizeMoneyTrailType('stp-out')).toBe('stp_out');
    expect(normalizeMoneyTrailType('SYSTEMATIC_WITHDRAWAL')).toBe('swp');
    expect(normalizeMoneyTrailType('transfer out')).toBe('transfer');
    expect(normalizeMoneyTrailType('something_else')).toBe('unknown');

    expect(mapMoneyTrailType('stp_in')).toMatchObject({ userFacingType: 'Transfer in', direction: 'internal' });
    expect(mapMoneyTrailType('stp_out')).toMatchObject({ userFacingType: 'Transfer out', direction: 'internal' });
    expect(mapMoneyTrailType('swp')).toMatchObject({ userFacingType: 'Withdrawal', direction: 'money_out' });
    expect(mapMoneyTrailType('transfer')).toMatchObject({ userFacingType: 'Transfer', direction: 'internal' });
    expect(mapMoneyTrailType('unknown')).toMatchObject({ userFacingType: 'Other movement', direction: 'neutral' });
  });

  it('builds a transaction detail display model without raw CAS noise', () => {
    const tx = buildPortfolioTransaction(raw({
      id: 'tx-detail',
      transaction_type: 'purchase_sip',
      amount: 60000,
      units: 87.234,
      nav_at_transaction: 685.329,
      reference_id: 'SIP240426123456',
    }));

    expect(tx).toMatchObject({
      id: 'tx-detail',
      userFacingType: 'SIP investment',
      direction: 'money_in',
      amount: 60000,
      units: 87.234,
      nav: 685.329,
      folioNumber: '12345678/01',
      referenceId: 'SIP240426123456',
      source: 'cas',
      includedInInvestedAmount: true,
      includedInXirr: true,
      includedInCurrentHoldings: true,
    });
  });

  it('normalizes source status and optional fields conservatively', () => {
    expect(buildPortfolioTransaction(raw({ status: 'Rejected by bank' }))).toMatchObject({
      status: 'failed',
      userFacingType: 'Failed',
      hiddenByDefault: true,
    });
    expect(buildPortfolioTransaction(raw({ status: 'Reversed by registrar' }))).toMatchObject({
      status: 'reversed',
      userFacingType: 'Reversal',
      hiddenByDefault: true,
    });
    expect(buildPortfolioTransaction(raw({ status: 'hidden' }))).toMatchObject({
      status: 'hidden',
      hiddenByDefault: true,
    });
    expect(buildPortfolioTransaction(raw({ status: 'Completed' }))).toMatchObject({
      status: 'success',
      hiddenByDefault: false,
    });

    const missing = buildPortfolioTransaction(raw({
      amount: null,
      units: null,
      nav_at_transaction: null,
      folio_number: null,
      cas_import_id: null,
      fund_name: 'Unknown Fund',
      transaction_date: 'not-a-date',
      status: 'pending',
    }));

    expect(missing).toMatchObject({
      amount: 0,
      financialYear: 'Unknown FY',
      amcName: undefined,
      units: undefined,
      nav: undefined,
      folioNumber: undefined,
      referenceId: undefined,
      status: 'success',
    });
  });
});

describe('moneyTrail financial-year grouping', () => {
  it('uses Indian financial years from April through March', () => {
    expect(getIndianFinancialYear('2026-03-31')).toBe('FY 2025-26');
    expect(getIndianFinancialYear('2026-04-01')).toBe('FY 2026-27');
    expect(getIndianFinancialYear('bad-date')).toBe('Unknown FY');
    expect(getFinancialYearShortLabel('FY 2026-27')).toBe('FY27');
    expect(getFinancialYearShortLabel('Unknown FY')).toBe('Unknown FY');
    expect(getCurrentFinancialYear(new Date('2026-04-29T12:00:00Z'))).toBe('FY 2026-27');
  });

  it('builds annual summary totals from external cashflows only', () => {
    const txs = buildMoneyTrailTransactions([
      raw({ id: 'old-buy', transaction_date: '2024-03-10', transaction_type: 'purchase', amount: 500 }),
      raw({ id: 'buy-1', transaction_date: '2025-04-10', transaction_type: 'purchase', amount: 1000 }),
      raw({ id: 'sell-1', transaction_date: '2025-05-10', transaction_type: 'redemption', amount: 250 }),
      raw({ id: 'switch-1', transaction_date: '2025-06-10', transaction_type: 'switch_in', amount: 900 }),
    ]);

    expect(buildAnnualMoneyFlows(txs)).toEqual([
      {
        financialYear: 'FY 2023-24',
        invested: 500,
        withdrawn: 0,
        netInvested: 500,
        transactionCount: 1,
      },
      {
        financialYear: 'FY 2025-26',
        invested: 1000,
        withdrawn: 250,
        netInvested: 750,
        transactionCount: 3,
      },
    ]);
    expect(compareFinancialYears('Unknown FY', 'FY 2025-26')).toBeLessThan(0);
  });

  it('builds filter date ranges for presets and custom inputs', () => {
    const now = new Date('2026-04-29T00:00:00Z');

    expect(getDatePresetRange('all_time', now)).toBeNull();
    expect(getDatePresetRange('custom', now)).toBeNull();
    expect(getDatePresetRange('this_fy', now)).toEqual({ start: '2026-04-01', end: '2027-03-31' });
    expect(getDatePresetRange('last_fy', now)).toEqual({ start: '2025-04-01', end: '2026-03-31' });
    expect(getDatePresetRange('last_3_months', now)).toEqual({ start: '2026-01-29', end: '2026-04-29' });
    expect(getDatePresetRange('this_fy', new Date('2026-02-10T00:00:00Z'))).toEqual({
      start: '2025-04-01',
      end: '2026-03-31',
    });

    expect(getFilterDateRange({ datePreset: 'custom' }, now)).toBeNull();
    expect(getFilterDateRange({ datePreset: 'custom', customStartDate: '2026-01-01' }, now)).toEqual({
      start: '2026-01-01',
      end: '2026-04-29',
    });
    expect(getFilterDateRange({ datePreset: 'custom', customEndDate: '2026-02-01' }, now)).toEqual({
      start: '0000-01-01',
      end: '2026-02-01',
    });
  });
});

describe('moneyTrail hidden and internal transaction handling', () => {
  it('hides failed and reversed transactions by default', () => {
    const transactions = buildMoneyTrailTransactions([
      raw({ id: 'ok', transaction_type: 'purchase', amount: 1000 }),
      raw({ id: 'failed', transaction_type: 'failed', amount: 1000 }),
      raw({ id: 'reversal', transaction_date: '2026-04-25', transaction_type: 'reversal', amount: 1000 }),
    ]);

    const visible = filterMoneyTrailTransactions(transactions, DEFAULT_MONEY_TRAIL_FILTERS);

    expect(visible.map((tx) => tx.id)).toEqual(['ok']);
    expect(transactions.find((tx) => tx.id === 'failed')).toMatchObject({
      status: 'failed',
      hiddenByDefault: true,
    });
    expect(transactions.find((tx) => tx.id === 'reversal')).toMatchObject({
      status: 'reversed',
      hiddenByDefault: true,
    });
  });

  it('also hides original transaction when a reversal pair can be matched', () => {
    const transactions = buildMoneyTrailTransactions([
      raw({ id: 'original', transaction_date: '2026-04-24', transaction_type: 'purchase', amount: 1000, units: 10 }),
      raw({ id: 'reversal', transaction_date: '2026-04-24', transaction_type: 'reversal', amount: 1000, units: 10 }),
    ]);

    expect(transactions.find((tx) => tx.id === 'original')).toMatchObject({
      status: 'hidden',
      hiddenByDefault: true,
      includedInXirr: false,
    });
    expect(filterMoneyTrailTransactions(transactions, DEFAULT_MONEY_TRAIL_FILTERS)).toHaveLength(0);
  });

  it('hides original transaction when a legacy reversed status row matches it', () => {
    const transactions = buildMoneyTrailTransactions([
      raw({ id: 'original', transaction_date: '2026-04-24', transaction_type: 'purchase', amount: 1000, units: 10 }),
      raw({
        id: 'status-reversed',
        transaction_date: '2026-04-24',
        transaction_type: 'unknown',
        status: 'reversed',
        amount: 1000,
        units: 10,
      }),
    ]);

    expect(transactions.find((tx) => tx.id === 'original')).toMatchObject({
      status: 'hidden',
      hiddenReason: 'Matched reversal',
    });
    expect(filterMoneyTrailTransactions(transactions, DEFAULT_MONEY_TRAIL_FILTERS)).toHaveLength(0);
  });

  it('keeps unmatched and already-hidden rows unchanged', () => {
    const switchTx = buildPortfolioTransaction(raw({ id: 'switch', transaction_type: 'switch_in' }));
    const hiddenTx = buildPortfolioTransaction(raw({ id: 'hidden', status: 'hidden' }));

    const transactions = buildMoneyTrailTransactions([
      raw({ id: 'purchase', transaction_type: 'purchase', amount: 1000 }),
      raw({ id: 'different-reversal', transaction_type: 'reversal', amount: 2000 }),
    ]);

    expect(transactions.find((tx) => tx.id === 'purchase')).toMatchObject({
      status: 'success',
      hiddenByDefault: false,
    });
    expect(filterMoneyTrailTransactions([switchTx, hiddenTx], {
      ...DEFAULT_MONEY_TRAIL_FILTERS,
      includeHidden: true,
    })).toEqual([switchTx, hiddenTx]);
  });

  it('hides purchase and redemption pairs imported from failed payments', () => {
    const transactions = buildMoneyTrailTransactions([
      raw({
        id: 'payment-reversal',
        fund_id: 'hdfc-small-cap',
        fund_name: 'HDFC Small Cap Fund - Direct Growth',
        transaction_date: '2025-10-09',
        transaction_type: 'redemption',
        amount: 25000,
        units: 0,
      }),
      raw({
        id: 'failed-purchase',
        fund_id: 'hdfc-small-cap',
        fund_name: 'HDFC Small Cap Fund - Direct Growth',
        transaction_date: '2025-10-09',
        transaction_type: 'purchase',
        amount: 25000,
        units: 101.12,
      }),
    ]);

    expect(filterMoneyTrailTransactions(transactions, DEFAULT_MONEY_TRAIL_FILTERS)).toHaveLength(0);
    expect(buildMoneyTrailSummary(transactions)).toEqual({
      totalInvested: 0,
      totalWithdrawn: 0,
      netInvested: 0,
      transactionCount: 0,
    });
    expect(transactions.find((tx) => tx.id === 'payment-reversal')).toMatchObject({
      userFacingType: 'Reversal',
      status: 'hidden',
      hiddenByDefault: true,
      includedInCurrentHoldings: false,
    });
    expect(transactions.find((tx) => tx.id === 'failed-purchase')).toMatchObject({
      userFacingType: 'Cancelled',
      status: 'hidden',
      hiddenByDefault: true,
      includedInInvestedAmount: false,
    });
  });

  it('hides stale zero-unit reversal rows left after parser-side cleanup', () => {
    const transactions = buildMoneyTrailTransactions([
      raw({
        id: 'stale-reversal',
        fund_id: 'hdfc-small-cap',
        fund_name: 'HDFC Small Cap Fund - Direct Growth',
        transaction_date: '2025-10-09',
        transaction_type: 'redemption',
        amount: 25000,
        units: 0,
      }),
    ]);

    expect(filterMoneyTrailTransactions(transactions, DEFAULT_MONEY_TRAIL_FILTERS)).toHaveLength(0);
    expect(buildMoneyTrailSummary(transactions)).toEqual({
      totalInvested: 0,
      totalWithdrawn: 0,
      netInvested: 0,
      transactionCount: 0,
    });
    expect(transactions[0]).toMatchObject({
      userFacingType: 'Reversal',
      status: 'hidden',
      hiddenByDefault: true,
      includedInInvestedAmount: false,
      includedInXirr: false,
      includedInCurrentHoldings: false,
    });
  });

  it('treats switches as internal movement rather than external net investment', () => {
    const switchIn = buildPortfolioTransaction(raw({ transaction_type: 'switch_in', amount: 5000 }));
    const switchOut = buildPortfolioTransaction(raw({ transaction_type: 'switch_out', amount: 5000 }));

    expect(switchIn.direction).toBe('internal');
    expect(switchOut.direction).toBe('internal');
    expect(switchIn.includedInInvestedAmount).toBe(false);
    expect(transactionUseExplanation(switchIn)).toContain('not counted as fresh investment');
    expect(buildMoneyTrailSummary([switchIn, switchOut])).toEqual({
      totalInvested: 0,
      totalWithdrawn: 0,
      netInvested: 0,
      transactionCount: 2,
    });
  });

  it('classifies dividend payout and reinvestment separately', () => {
    const payout = buildPortfolioTransaction(raw({ transaction_type: 'dividend_payout', amount: 250 }));
    const reinvested = buildPortfolioTransaction(raw({ transaction_type: 'dividend_reinvest', amount: 250 }));

    expect(payout).toMatchObject({
      userFacingType: 'Dividend received',
      direction: 'money_out',
      includedInXirr: false,
    });
    expect(reinvested).toMatchObject({
      userFacingType: 'Dividend reinvested',
      direction: 'internal',
      includedInXirr: true,
    });
  });
});

describe('moneyTrail controls and export', () => {
  const transactions = buildMoneyTrailTransactions([
    raw({ id: 'sip', fund_id: 'fund-a', fund_name: 'DSP Large & Mid Cap Fund', transaction_date: '2026-04-24', transaction_type: 'purchase_sip', amount: 60000 }),
    raw({ id: 'withdrawal', fund_id: 'fund-b', fund_name: 'ICICI Prudential Bluechip Fund', transaction_date: '2026-04-12', transaction_type: 'redemption', amount: 50000 }),
    raw({ id: 'switch', fund_id: 'fund-c', fund_name: 'Axis Balanced Advantage Fund', transaction_date: '2026-04-05', transaction_type: 'switch_out', amount: 30000 }),
  ]);

  it('sorts by every supported option', () => {
    expect(sortMoneyTrailTransactions(transactions, 'newest').map((tx) => tx.id)).toEqual(['sip', 'withdrawal', 'switch']);
    expect(sortMoneyTrailTransactions(transactions, 'oldest').map((tx) => tx.id)).toEqual(['switch', 'withdrawal', 'sip']);
    expect(sortMoneyTrailTransactions(transactions, 'amount_desc').map((tx) => tx.id)).toEqual(['sip', 'withdrawal', 'switch']);
    expect(sortMoneyTrailTransactions(transactions, 'amount_asc').map((tx) => tx.id)).toEqual(['switch', 'withdrawal', 'sip']);
    expect(sortMoneyTrailTransactions(transactions, 'fund_asc').map((tx) => tx.id)).toEqual(['switch', 'sip', 'withdrawal']);
    expect(sortMoneyTrailTransactions(transactions, 'fund_desc').map((tx) => tx.id)).toEqual(['withdrawal', 'sip', 'switch']);
  });

  it('filters by date, type, direction, fund, AMC, amount, and hidden toggle', () => {
    const withHidden = [
      ...transactions,
      buildPortfolioTransaction(raw({ id: 'failed', transaction_type: 'failed', amount: 70000 })),
    ];
    const filtered = filterMoneyTrailTransactions(withHidden, {
      ...DEFAULT_MONEY_TRAIL_FILTERS,
      datePreset: 'this_fy',
      transactionTypes: ['sip_purchase'],
      directions: ['money_in'],
      fundIds: ['fund-a'],
      amcNames: ['DSP Mutual Fund'],
      minAmount: 50000,
      maxAmount: 70000,
    }, new Date('2026-04-29T00:00:00Z'));

    expect(filtered.map((tx) => tx.id)).toEqual(['sip']);
    expect(filterMoneyTrailTransactions(withHidden, DEFAULT_MONEY_TRAIL_FILTERS).map((tx) => tx.id)).not.toContain('failed');
    expect(filterMoneyTrailTransactions(withHidden, {
      ...DEFAULT_MONEY_TRAIL_FILTERS,
      includeHidden: true,
    }).map((tx) => tx.id)).toContain('failed');
    expect(filterMoneyTrailTransactions(transactions, {
      ...DEFAULT_MONEY_TRAIL_FILTERS,
      datePreset: 'custom',
      customStartDate: '2026-04-13',
    }, new Date('2026-04-29T00:00:00Z')).map((tx) => tx.id)).toEqual(['sip']);
    expect(filterMoneyTrailTransactions(transactions, {
      ...DEFAULT_MONEY_TRAIL_FILTERS,
      maxAmount: 40000,
    }).map((tx) => tx.id)).toEqual(['switch']);
  });

  it('parses blank amount filter inputs as unset', () => {
    expect(parseMoneyTrailAmountInput('')).toBeUndefined();
    expect(parseMoneyTrailAmountInput('   ')).toBeUndefined();
    expect(parseMoneyTrailAmountInput('1,00,000')).toBe(100000);
    expect(parseMoneyTrailAmountInput('abc')).toBeUndefined();
    expect(parseMoneyTrailAmountInput('-1')).toBeUndefined();
  });

  it('searches by fund, AMC, amount, type, folio, and reference', () => {
    const [tx] = transactions;
    expect(searchMoneyTrailTransactions(transactions, 'DSP')).toContain(tx);
    expect(searchMoneyTrailTransactions(transactions, 'Mutual Fund')).toContain(tx);
    expect(searchMoneyTrailTransactions(transactions, '60000')).toContain(tx);
    expect(searchMoneyTrailTransactions(transactions, 'SIP investment')).toContain(tx);
    expect(searchMoneyTrailTransactions(transactions, '12345678')).toContain(tx);
    expect(searchMoneyTrailTransactions(transactions, 'import-1')).toContain(tx);
  });

  it('applies filter, search, and sort together', () => {
    const visible = applyMoneyTrailControls(
      transactions,
      { ...DEFAULT_MONEY_TRAIL_FILTERS, directions: ['money_out', 'internal'] },
      'fund',
      'amount_asc',
    );

    expect(visible.map((tx) => tx.id)).toEqual(['switch', 'withdrawal']);
  });

  it('exports user-friendly CSV columns with numeric amounts', () => {
    const csv = buildMoneyTrailCsv([transactions[0]]);

    expect(csv.split('\n')[0]).toBe(
      'Date,Financial Year,Transaction Type,Direction,Fund Name,AMC,Folio Number,Amount,Units,NAV,Status,Included In Invested Amount,Used In XIRR Calculation,Reference ID',
    );
    expect(csv).toContain('2026-04-24,FY 2026-27,SIP investment,Money in,DSP Large & Mid Cap Fund,DSP Mutual Fund,12345678/01,60000,10,100,Success,Yes,Yes,import-1');

    const escaped = buildMoneyTrailCsv([
      {
        ...transactions[0],
        fundName: 'Quoted, Fund "A"\nGrowth',
        amcName: undefined,
        folioNumber: undefined,
        units: undefined,
        nav: undefined,
        referenceId: undefined,
        status: 'hidden',
        includedInInvestedAmount: false,
        includedInXirr: false,
      },
    ]);
    expect(escaped).toContain('"Quoted, Fund ""A""\nGrowth",,,60000,,,Cancelled,No,No,');
  });

  it('formats labels, dates, explanations, and option lists', () => {
    const hidden = buildPortfolioTransaction(raw({ id: 'hidden', status: 'hidden' }));
    const reversed = buildPortfolioTransaction(raw({ id: 'reversed', status: 'reversed' }));
    const dividendPayout = buildPortfolioTransaction(raw({ id: 'payout', transaction_type: 'dividend_payout' }));
    const dividendReinvested = buildPortfolioTransaction(raw({ id: 'reinvested', transaction_type: 'dividend_reinvest' }));
    const stpOut = buildPortfolioTransaction(raw({ id: 'stp', transaction_type: 'stp_out' }));
    const noAmc = buildPortfolioTransaction(raw({
      id: 'no-amc',
      fund_id: 'fund-z',
      fund_name: 'Unlisted Opportunities Fund',
    }));

    expect(directionLabel('money_in')).toBe('Money in');
    expect(directionLabel('money_out')).toBe('Money out');
    expect(directionLabel('internal')).toBe('Internal movement');
    expect(directionLabel('neutral')).toBe('Neutral');
    expect(statusLabel('success')).toBe('Success');
    expect(statusLabel('failed')).toBe('Failed');
    expect(statusLabel('reversed')).toBe('Reversed');
    expect(statusLabel('hidden')).toBe('Cancelled');
    expect(statusLabel('unknown' as never)).toBe('Success');
    expect(transactionUseExplanation(reversed)).toContain('not included in your portfolio totals');
    expect(transactionUseExplanation(transactions[0])).toContain('included in your portfolio history');
    expect(transactionUseExplanation(stpOut)).toContain('moved money between funds');
    expect(transactionUseExplanation(dividendReinvested)).toContain('reinvested');
    expect(transactionUseExplanation(dividendPayout)).toContain('paid out');
    expect(formatMoneyTrailDate('2026-04-24')).toBe('24 Apr 2026');
    expect(formatMoneyTrailDate('bad-date')).toBe('bad-date');
    expect(getUniqueFundOptions([transactions[1], transactions[0]])).toEqual([
      { id: 'fund-a', name: 'DSP Large & Mid Cap Fund' },
      { id: 'fund-b', name: 'ICICI Prudential Bluechip Fund' },
    ]);
    expect(getUniqueAmcOptions([noAmc, hidden])).toEqual(['DSP Mutual Fund', 'Not available']);
  });

  it('keeps existing portfolio/XIRR transaction semantics unchanged', () => {
    const result = buildCashflowsFromTransactions(
      [
        { transaction_date: '2023-01-01', transaction_type: 'purchase', units: 100, amount: 10000 },
        { transaction_date: '2023-03-01', transaction_type: 'dividend_reinvest', units: 10, amount: 1000 },
        { transaction_date: '2023-12-01', transaction_type: 'switch_out', units: 50, amount: 6000 },
      ],
      7000,
      new Date('2024-01-01T00:00:00Z'),
    );

    expect(result.historicalCashflows.map((flow) => flow.amount)).toEqual([-10000, -1000, 6000]);
    expect(result.investedAmount).toBe(6000);
  });
});

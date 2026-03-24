import {
  xirr,
  formatXirr,
  computeRealizedGains,
  buildCashflowsFromTransactions,
  type Cashflow,
  type Transaction,
} from '../xirr';

// Helper: offset date by N days
function daysFrom(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 3600 * 1000);
}

// Helper: create a date exactly N "xirr-years" (365.25 days) from a base
function yearsFrom(base: Date, years: number): Date {
  return new Date(base.getTime() + years * 365.25 * 24 * 3600 * 1000);
}

const ORIGIN = new Date('2023-01-01T00:00:00Z');

// ---------------------------------------------------------------------------
// xirr()
// ---------------------------------------------------------------------------

describe('xirr()', () => {
  it('returns NaN for fewer than 2 cashflows', () => {
    expect(xirr([])).toBeNaN();
    expect(xirr([{ date: ORIGIN, amount: -100000 }])).toBeNaN();
  });

  it('returns NaN when all cashflows are negative (no positive)', () => {
    const flows: Cashflow[] = [
      { date: ORIGIN, amount: -50000 },
      { date: daysFrom(ORIGIN, 30), amount: -50000 },
    ];
    expect(xirr(flows)).toBeNaN();
  });

  it('returns NaN when all cashflows are positive (no negative)', () => {
    const flows: Cashflow[] = [
      { date: ORIGIN, amount: 50000 },
      { date: daysFrom(ORIGIN, 30), amount: 50000 },
    ];
    expect(xirr(flows)).toBeNaN();
  });

  it('computes 15% XIRR for lump-sum investment over exactly 1 year', () => {
    const flows: Cashflow[] = [
      { date: ORIGIN, amount: -100000 },
      { date: yearsFrom(ORIGIN, 1), amount: 115000 },
    ];
    expect(xirr(flows)).toBeCloseTo(0.15, 4);
  });

  it('computes 0% XIRR when proceeds equal investment (breakeven)', () => {
    const flows: Cashflow[] = [
      { date: ORIGIN, amount: -100000 },
      { date: yearsFrom(ORIGIN, 1), amount: 100000 },
    ];
    expect(xirr(flows)).toBeCloseTo(0.0, 4);
  });

  it('computes a negative XIRR for a loss-making investment', () => {
    const flows: Cashflow[] = [
      { date: ORIGIN, amount: -100000 },
      { date: yearsFrom(ORIGIN, 1), amount: 85000 },
    ];
    const rate = xirr(flows);
    expect(rate).not.toBeNaN();
    expect(rate).toBeLessThan(0);
    expect(rate).toBeCloseTo(-0.15, 4);
  });

  it('handles 30% annualised return over 2 years', () => {
    // 100000 → 169000 over 2 years ≈ 30% p.a.  (1.3^2 = 1.69)
    const flows: Cashflow[] = [
      { date: ORIGIN, amount: -100000 },
      { date: yearsFrom(ORIGIN, 2), amount: 169000 },
    ];
    expect(xirr(flows)).toBeCloseTo(0.30, 2);
  });

  it('handles multiple cashflows (SIP-like)', () => {
    // 12 monthly investments of 10,000 each; terminal value of 130,000
    // → positive XIRR (invested 120,000, got back 130,000 over ~1 year)
    const flows: Cashflow[] = Array.from({ length: 12 }, (_, i) => ({
      date: daysFrom(ORIGIN, i * 30),
      amount: -10000,
    }));
    flows.push({ date: daysFrom(ORIGIN, 365), amount: 130000 });
    const rate = xirr(flows);
    expect(rate).not.toBeNaN();
    expect(rate).toBeGreaterThan(0);
  });

  it('sorts unsorted cashflows before computing', () => {
    // Same flows as the 15% test but passed in reverse order
    const flows: Cashflow[] = [
      { date: yearsFrom(ORIGIN, 1), amount: 115000 },
      { date: ORIGIN, amount: -100000 },
    ];
    expect(xirr(flows)).toBeCloseTo(0.15, 4);
  });

  it('handles a short-duration investment (30 days)', () => {
    const flows: Cashflow[] = [
      { date: ORIGIN, amount: -100000 },
      { date: daysFrom(ORIGIN, 30), amount: 101000 },
    ];
    const rate = xirr(flows);
    expect(rate).not.toBeNaN();
    // 1% over 30 days annualises to ~13–14% p.a.
    expect(rate).toBeGreaterThan(0.1);
    expect(rate).toBeLessThan(0.2);
  });

  it('handles a very long investment (10 years)', () => {
    // 100,000 compounded at 12% for 10 years ≈ 310,585
    const flows: Cashflow[] = [
      { date: ORIGIN, amount: -100000 },
      { date: yearsFrom(ORIGIN, 10), amount: 310585 },
    ];
    expect(xirr(flows)).toBeCloseTo(0.12, 2);
  });
});

// ---------------------------------------------------------------------------
// formatXirr()
// ---------------------------------------------------------------------------

describe('formatXirr()', () => {
  it('formats a normal positive rate (default 2 decimals)', () => {
    expect(formatXirr(0.15)).toBe('15.00%');
  });

  it('formats a normal negative rate', () => {
    expect(formatXirr(-0.08)).toBe('-8.00%');
  });

  it('formats zero', () => {
    expect(formatXirr(0)).toBe('0.00%');
  });

  it('returns N/A for NaN', () => {
    expect(formatXirr(NaN)).toBe('N/A');
  });

  it('returns N/A for +Infinity', () => {
    expect(formatXirr(Infinity)).toBe('N/A');
  });

  it('returns N/A for -Infinity', () => {
    expect(formatXirr(-Infinity)).toBe('N/A');
  });

  it('respects custom decimals parameter', () => {
    expect(formatXirr(0.12345, 1)).toBe('12.3%');
    expect(formatXirr(0.12345, 4)).toBe('12.3450%');
  });

  it('handles tiny rate (0.1%)', () => {
    expect(formatXirr(0.001)).toBe('0.10%');
  });

  it('handles large rate (200%)', () => {
    expect(formatXirr(2.0)).toBe('200.00%');
  });
});

// ---------------------------------------------------------------------------
// computeRealizedGains()
// ---------------------------------------------------------------------------

describe('computeRealizedGains()', () => {
  it('returns zeros for empty transactions', () => {
    expect(computeRealizedGains([])).toEqual({
      realizedGain: 0,
      realizedAmount: 0,
      redeemedUnits: 0,
    });
  });

  it('returns zeros when there are only purchases (no redemptions)', () => {
    const txs: Transaction[] = [
      { transaction_date: '2023-01-01', transaction_type: 'purchase', units: 100, amount: 10000 },
      { transaction_date: '2023-06-01', transaction_type: 'purchase', units: 50, amount: 6000 },
    ];
    expect(computeRealizedGains(txs)).toEqual({
      realizedGain: 0,
      realizedAmount: 0,
      redeemedUnits: 0,
    });
  });

  it('computes gain correctly for simple buy-then-sell', () => {
    // Buy 100 units at ₹100 each; sell all 100 at ₹120 each
    const txs: Transaction[] = [
      { transaction_date: '2023-01-01', transaction_type: 'purchase', units: 100, amount: 10000 },
      { transaction_date: '2024-01-01', transaction_type: 'redemption', units: 100, amount: 12000 },
    ];
    const result = computeRealizedGains(txs);
    expect(result.realizedGain).toBeCloseTo(2000, 5);
    expect(result.realizedAmount).toBe(12000);
    expect(result.redeemedUnits).toBe(100);
  });

  it('uses average cost method across multiple purchases', () => {
    // Buy 100 units @ ₹10 (cost 1000) then 100 units @ ₹20 (cost 2000)
    // avgCost = 3000/200 = 15; sell 100 units @ ₹25 (proceeds 2500)
    // gain = 2500 - 100*15 = 2500 - 1500 = 1000
    const txs: Transaction[] = [
      { transaction_date: '2023-01-01', transaction_type: 'purchase', units: 100, amount: 1000 },
      { transaction_date: '2023-06-01', transaction_type: 'purchase', units: 100, amount: 2000 },
      { transaction_date: '2024-01-01', transaction_type: 'redemption', units: 100, amount: 2500 },
    ];
    const result = computeRealizedGains(txs);
    expect(result.realizedGain).toBeCloseTo(1000, 5);
    expect(result.realizedAmount).toBe(2500);
    expect(result.redeemedUnits).toBe(100);
  });

  it('computes a loss scenario', () => {
    // Buy 100 units @ ₹20 (cost 2000); sell at ₹15 (proceeds 1500)
    const txs: Transaction[] = [
      { transaction_date: '2023-01-01', transaction_type: 'purchase', units: 100, amount: 2000 },
      { transaction_date: '2024-01-01', transaction_type: 'redemption', units: 100, amount: 1500 },
    ];
    const result = computeRealizedGains(txs);
    expect(result.realizedGain).toBeCloseTo(-500, 5);
    expect(result.realizedAmount).toBe(1500);
    expect(result.redeemedUnits).toBe(100);
  });

  it('handles partial redemption — residual cost recalculated', () => {
    // Buy 100 units @ ₹10 (cost 1000); sell 50 @ ₹15 (proceeds 750)
    // avgCost=10, costBasis=500, gain=250
    const txs: Transaction[] = [
      { transaction_date: '2023-01-01', transaction_type: 'purchase', units: 100, amount: 1000 },
      { transaction_date: '2024-01-01', transaction_type: 'redemption', units: 50, amount: 750 },
    ];
    const result = computeRealizedGains(txs);
    expect(result.realizedGain).toBeCloseTo(250, 5);
    expect(result.realizedAmount).toBe(750);
    expect(result.redeemedUnits).toBe(50);
  });

  it('accumulates across multiple redemptions', () => {
    const txs: Transaction[] = [
      { transaction_date: '2023-01-01', transaction_type: 'purchase', units: 200, amount: 2000 },
      { transaction_date: '2023-06-01', transaction_type: 'redemption', units: 100, amount: 1200 },
      { transaction_date: '2024-01-01', transaction_type: 'redemption', units: 100, amount: 1500 },
    ];
    // avgCost = 2000/200 = 10
    // First redemption: gain = 1200 - 1000 = 200
    // Second redemption: gain = 1500 - 1000 = 500
    const result = computeRealizedGains(txs);
    expect(result.realizedGain).toBeCloseTo(700, 5);
    expect(result.realizedAmount).toBe(2700);
    expect(result.redeemedUnits).toBe(200);
  });

  it('treats switch_in as outflow (purchase)', () => {
    const txs: Transaction[] = [
      { transaction_date: '2023-01-01', transaction_type: 'switch_in', units: 100, amount: 1000 },
      { transaction_date: '2024-01-01', transaction_type: 'redemption', units: 100, amount: 1200 },
    ];
    expect(computeRealizedGains(txs).realizedGain).toBeCloseTo(200, 5);
  });

  it('treats dividend_reinvest as outflow (purchase)', () => {
    const txs: Transaction[] = [
      { transaction_date: '2023-01-01', transaction_type: 'purchase', units: 100, amount: 1000 },
      { transaction_date: '2023-03-01', transaction_type: 'dividend_reinvest', units: 10, amount: 120 },
      { transaction_date: '2024-01-01', transaction_type: 'redemption', units: 110, amount: 1430 },
    ];
    // avgCost = (1000+120)/110 ≈ 10.18; gain = 1430 - 110*10.18 ≈ 1430-1120 = 310
    const result = computeRealizedGains(txs);
    expect(result.realizedAmount).toBe(1430);
    expect(result.redeemedUnits).toBe(110);
    expect(result.realizedGain).toBeCloseTo(310, 0);
  });

  it('treats switch_out as inflow (redemption)', () => {
    const txs: Transaction[] = [
      { transaction_date: '2023-01-01', transaction_type: 'purchase', units: 100, amount: 1000 },
      { transaction_date: '2024-01-01', transaction_type: 'switch_out', units: 100, amount: 1100 },
    ];
    expect(computeRealizedGains(txs).realizedGain).toBeCloseTo(100, 5);
  });

  it('ignores unknown transaction types', () => {
    const txs: Transaction[] = [
      { transaction_date: '2023-01-01', transaction_type: 'purchase', units: 100, amount: 1000 },
      { transaction_date: '2023-06-01', transaction_type: 'unknown_type', units: 50, amount: 600 },
    ];
    // Unknown type should be ignored; no redemptions → zeros
    expect(computeRealizedGains(txs)).toEqual({
      realizedGain: 0,
      realizedAmount: 0,
      redeemedUnits: 0,
    });
  });

  it('processes redemption before any purchase (avgCost=0, gain=full proceeds)', () => {
    const txs: Transaction[] = [
      { transaction_date: '2024-01-01', transaction_type: 'redemption', units: 50, amount: 500 },
    ];
    const result = computeRealizedGains(txs);
    // totalUnits=0 → avgCost=0 → gain=500-0=500
    expect(result.realizedGain).toBeCloseTo(500, 5);
    expect(result.realizedAmount).toBe(500);
    expect(result.redeemedUnits).toBe(50);
  });

  it('sorts by date regardless of input order', () => {
    // Same as multiple-redemption test but passed out of date order
    const txs: Transaction[] = [
      { transaction_date: '2024-01-01', transaction_type: 'redemption', units: 100, amount: 1500 },
      { transaction_date: '2023-01-01', transaction_type: 'purchase', units: 200, amount: 2000 },
      { transaction_date: '2023-06-01', transaction_type: 'redemption', units: 100, amount: 1200 },
    ];
    const result = computeRealizedGains(txs);
    expect(result.realizedGain).toBeCloseTo(700, 5);
  });
});

// ---------------------------------------------------------------------------
// buildCashflowsFromTransactions()
// ---------------------------------------------------------------------------

describe('buildCashflowsFromTransactions()', () => {
  const today = new Date('2024-06-01T00:00:00Z');

  it('returns empty results for no transactions', () => {
    const result = buildCashflowsFromTransactions([], 0, today);
    expect(result.netUnits).toBe(0);
    expect(result.investedAmount).toBe(0);
    expect(result.historicalCashflows).toHaveLength(0);
    expect(result.xirrCashflows).toHaveLength(1); // only terminal inflow (currentValue=0)
  });

  it('single purchase produces correct net units, invested amount, and cashflows', () => {
    const txs: Transaction[] = [
      { transaction_date: '2023-01-01', transaction_type: 'purchase', units: 100, amount: 10000 },
    ];
    const result = buildCashflowsFromTransactions(txs, 12000, today);

    expect(result.netUnits).toBe(100);
    expect(result.investedAmount).toBe(10000);
    expect(result.historicalCashflows).toHaveLength(1);
    expect(result.historicalCashflows[0].amount).toBe(-10000); // outflow is negative
    expect(result.xirrCashflows).toHaveLength(2);
    expect(result.xirrCashflows[1]).toEqual({ date: today, amount: 12000 });
  });

  it('purchase + partial redemption reduces netUnits correctly', () => {
    const txs: Transaction[] = [
      { transaction_date: '2023-01-01', transaction_type: 'purchase', units: 100, amount: 10000 },
      { transaction_date: '2023-06-01', transaction_type: 'redemption', units: 40, amount: 4500 },
    ];
    const result = buildCashflowsFromTransactions(txs, 7000, today);

    expect(result.netUnits).toBe(60);
    // investedAmount = cost basis of remaining units (avg cost deducted on sell):
    // avg cost = 10000/100 = ₹100/unit; 40 sold → ₹4000 deducted; remaining = ₹6000
    expect(result.investedAmount).toBe(6000);
    expect(result.historicalCashflows).toHaveLength(2);
    expect(result.historicalCashflows[0].amount).toBe(-10000);
    expect(result.historicalCashflows[1].amount).toBe(4500); // redemption is positive
  });

  it('switch_in is treated as an outflow (negative cashflow)', () => {
    const txs: Transaction[] = [
      { transaction_date: '2023-01-01', transaction_type: 'switch_in', units: 50, amount: 5000 },
    ];
    const result = buildCashflowsFromTransactions(txs, 6000, today);
    expect(result.netUnits).toBe(50);
    expect(result.historicalCashflows[0].amount).toBe(-5000);
  });

  it('switch_out is treated as an inflow (positive cashflow)', () => {
    const txs: Transaction[] = [
      { transaction_date: '2023-01-01', transaction_type: 'purchase', units: 100, amount: 10000 },
      { transaction_date: '2023-12-01', transaction_type: 'switch_out', units: 100, amount: 11000 },
    ];
    const result = buildCashflowsFromTransactions(txs, 0, today);
    expect(result.netUnits).toBe(0);
    expect(result.historicalCashflows[1].amount).toBe(11000);
  });

  it('dividend_reinvest is treated as an outflow', () => {
    const txs: Transaction[] = [
      { transaction_date: '2023-03-01', transaction_type: 'dividend_reinvest', units: 10, amount: 1000 },
    ];
    const result = buildCashflowsFromTransactions(txs, 1100, today);
    expect(result.netUnits).toBe(10);
    expect(result.historicalCashflows[0].amount).toBe(-1000);
  });

  it('unknown transaction type is ignored', () => {
    const txs: Transaction[] = [
      { transaction_date: '2023-01-01', transaction_type: 'purchase', units: 100, amount: 10000 },
      { transaction_date: '2023-06-01', transaction_type: 'bonus', units: 10, amount: 0 },
    ];
    const result = buildCashflowsFromTransactions(txs, 12000, today);
    // bonus is unknown → ignored → netUnits=100 (not 110)
    expect(result.netUnits).toBe(100);
    expect(result.historicalCashflows).toHaveLength(1);
  });

  it('historicalCashflows does NOT include the terminal value', () => {
    const txs: Transaction[] = [
      { transaction_date: '2023-01-01', transaction_type: 'purchase', units: 100, amount: 10000 },
    ];
    const { historicalCashflows, xirrCashflows } = buildCashflowsFromTransactions(txs, 15000, today);
    expect(historicalCashflows).toHaveLength(1);
    expect(xirrCashflows).toHaveLength(2);
    expect(xirrCashflows[1].amount).toBe(15000);
  });

  it('correctly parses transaction_date string as a Date', () => {
    const txs: Transaction[] = [
      { transaction_date: '2023-07-15', transaction_type: 'purchase', units: 100, amount: 10000 },
    ];
    const result = buildCashflowsFromTransactions(txs, 0, today);
    expect(result.historicalCashflows[0].date).toBeInstanceOf(Date);
    expect(result.historicalCashflows[0].date.toISOString().startsWith('2023-07-15')).toBe(true);
  });

  it('multiple purchases accumulate netUnits and investedAmount', () => {
    const txs: Transaction[] = [
      { transaction_date: '2023-01-01', transaction_type: 'purchase', units: 100, amount: 10000 },
      { transaction_date: '2023-04-01', transaction_type: 'purchase', units: 50, amount: 5500 },
      { transaction_date: '2023-10-01', transaction_type: 'purchase', units: 25, amount: 3000 },
    ];
    const result = buildCashflowsFromTransactions(txs, 20000, today);
    expect(result.netUnits).toBe(175);
    expect(result.investedAmount).toBe(18500);
    expect(result.historicalCashflows).toHaveLength(3);
  });
});

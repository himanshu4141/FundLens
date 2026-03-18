/**
 * XIRR — Extended Internal Rate of Return
 *
 * Computes the annualised return rate for an irregular series of cashflows.
 * Negative amounts = money invested (outflows).
 * Positive amounts = current value or redemptions (inflows).
 *
 * Uses Newton-Raphson iteration. Returns NaN if it fails to converge.
 */

export interface Cashflow {
  date: Date;
  amount: number;
}

const TOLERANCE = 1e-7;
const MAX_ITERATIONS = 1000;

/**
 * Computes XNPV (Net Present Value for irregular cashflows).
 * rate: annualised discount rate
 * flows: cashflows sorted by date
 * origin: the reference date (usually the first cashflow date)
 */
function xnpv(rate: number, flows: Cashflow[], origin: Date): number {
  return flows.reduce((sum, cf) => {
    const years = (cf.date.getTime() - origin.getTime()) / (365.25 * 24 * 3600 * 1000);
    return sum + cf.amount / Math.pow(1 + rate, years);
  }, 0);
}

/**
 * Derivative of XNPV with respect to rate (for Newton-Raphson).
 */
function xnpvDerivative(rate: number, flows: Cashflow[], origin: Date): number {
  return flows.reduce((sum, cf) => {
    const years = (cf.date.getTime() - origin.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (years === 0) return sum;
    return sum - (years * cf.amount) / Math.pow(1 + rate, years + 1);
  }, 0);
}

/**
 * Returns the XIRR as a decimal (e.g. 0.12 = 12% p.a.)
 * Returns NaN if the cashflows are invalid or Newton-Raphson fails to converge.
 */
export function xirr(cashflows: Cashflow[]): number {
  if (cashflows.length < 2) return NaN;

  // Must have at least one positive and one negative cashflow
  const hasPositive = cashflows.some((cf) => cf.amount > 0);
  const hasNegative = cashflows.some((cf) => cf.amount < 0);
  if (!hasPositive || !hasNegative) return NaN;

  const sorted = [...cashflows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const origin = sorted[0].date;

  // Initial guess: 10%
  let rate = 0.1;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const npv = xnpv(rate, sorted, origin);
    const dnpv = xnpvDerivative(rate, sorted, origin);

    if (Math.abs(dnpv) < 1e-10) break;

    const nextRate = rate - npv / dnpv;

    if (Math.abs(nextRate - rate) < TOLERANCE) {
      return nextRate;
    }

    rate = nextRate;

    // Guard against divergence
    if (rate < -0.999 || rate > 100) {
      // Try a different starting guess
      rate = rate < -0.999 ? 0.0 : -0.5;
    }
  }

  // Final check: verify the result is reasonable
  const finalNpv = xnpv(rate, sorted, origin);
  if (Math.abs(finalNpv) > 1) return NaN;

  return rate;
}

/**
 * Formats an XIRR rate as a percentage string.
 * e.g. xirr returns 0.1234 → "12.34%"
 */
export function formatXirr(rate: number, decimals = 2): string {
  if (!isFinite(rate) || isNaN(rate)) return 'N/A';
  return `${(rate * 100).toFixed(decimals)}%`;
}

export interface Transaction {
  transaction_date: string;
  transaction_type: string;
  units: number;
  amount: number;
}

export interface TransactionCashflows {
  /** Historical cashflows derived from transactions (no terminal inflow). */
  historicalCashflows: Cashflow[];
  /** Full XIRR-ready cashflows: historical + terminal inflow at currentDate. */
  xirrCashflows: Cashflow[];
  netUnits: number;
  investedAmount: number;
}

/**
 * Converts a list of fund transactions into XIRR-ready cashflows.
 *
 * Outflows (purchase, switch_in, dividend_reinvest): negative cashflows.
 * Inflows (redemption, switch_out): positive cashflows.
 *
 * Appends a terminal inflow of `currentValue` on `currentDate` to represent
 * the current portfolio value, making the result directly usable with xirr().
 *
 * Returns both the historical-only cashflows (for aggregating across funds)
 * and the full xirrCashflows (for per-fund XIRR), along with netUnits and
 * investedAmount derived from the transactions.
 */
export function buildCashflowsFromTransactions(
  transactions: Transaction[],
  currentValue: number,
  currentDate: Date,
): TransactionCashflows {
  let netUnits = 0;
  let investedAmount = 0;
  const historicalCashflows: Cashflow[] = [];

  for (const tx of transactions) {
    const date = new Date(tx.transaction_date);
    const isOutflow =
      tx.transaction_type === 'purchase' ||
      tx.transaction_type === 'switch_in' ||
      tx.transaction_type === 'dividend_reinvest';
    const isInflow =
      tx.transaction_type === 'redemption' || tx.transaction_type === 'switch_out';

    if (isOutflow) {
      netUnits += tx.units;
      investedAmount += tx.amount;
      historicalCashflows.push({ date, amount: -tx.amount });
    } else if (isInflow) {
      netUnits -= tx.units;
      historicalCashflows.push({ date, amount: tx.amount });
    }
  }

  const xirrCashflows: Cashflow[] = [
    ...historicalCashflows,
    { date: currentDate, amount: currentValue },
  ];

  return { historicalCashflows, xirrCashflows, netUnits, investedAmount };
}

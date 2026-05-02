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
  fund_id?: string | null;
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

export interface RealizedGains {
  /** Total realized profit/loss from all redemptions (can be negative). */
  realizedGain: number;
  /** Total proceeds from all redemptions. */
  realizedAmount: number;
  /** Total units redeemed across all redemption transactions. */
  redeemedUnits: number;
}

type ReversalPairCandidate = {
  fund_id?: string | null;
  transaction_date: string;
  transaction_type: string;
  units?: number | null;
  amount?: number | null;
};

/**
 * Older imports stored failed-payment reversals as a purchase plus a same-day
 * redemption. Current imports skip reversal rows, but a re-import can still
 * leave behind the old zero-unit redemption after deleting the paired purchase.
 * Treat both shapes as non-portfolio transactions so cancelled allocations
 * cannot leave phantom units, cost basis, or cashflows behind.
 */
export function findReversedTransactionPairIndexes<T extends ReversalPairCandidate>(
  transactions: T[],
): Set<number> {
  const byKey = new Map<string, { purchases: number[]; reversals: number[] }>();

  transactions.forEach((tx, index) => {
    const key = reversalPairKey(tx);
    if (!key) return;

    const bucket = byKey.get(key) ?? { purchases: [], reversals: [] };
    if (isReversalPairPurchase(tx.transaction_type)) {
      bucket.purchases.push(index);
    } else if (isReversalPairRedemption(tx.transaction_type)) {
      bucket.reversals.push(index);
    }
    byKey.set(key, bucket);
  });

  const paired = new Set<number>();
  for (const { purchases, reversals } of byKey.values()) {
    const remainingReversals = [...reversals];
    for (const purchaseIndex of purchases) {
      const reversalIndex = remainingReversals.findIndex((candidateIndex) =>
        unitsCompatible(transactions[purchaseIndex], transactions[candidateIndex]),
      );
      if (reversalIndex === -1) continue;

      paired.add(purchaseIndex);
      paired.add(remainingReversals[reversalIndex]);
      remainingReversals.splice(reversalIndex, 1);
    }
  }

  transactions.forEach((tx, index) => {
    if (isStandaloneZeroUnitReversal(tx)) paired.add(index);
  });

  return paired;
}

export function filterReversedTransactionPairs<T extends ReversalPairCandidate>(
  transactions: T[],
): T[] {
  const paired = findReversedTransactionPairIndexes(transactions);
  if (paired.size === 0) return transactions;
  return transactions.filter((_, index) => !paired.has(index));
}

function isReversalPairPurchase(type: string): boolean {
  return ['purchase', 'purchase_sip', 'sip_purchase'].includes(normalizeTransactionType(type));
}

function isReversalPairRedemption(type: string): boolean {
  return ['redemption', 'reversal', 'reversed', 'cancelled', 'canceled'].includes(
    normalizeTransactionType(type),
  );
}

function isStandaloneZeroUnitReversal(tx: ReversalPairCandidate): boolean {
  return (
    isReversalPairRedemption(tx.transaction_type) &&
    positiveNumber(tx.amount) != null &&
    positiveNumber(tx.units) == null
  );
}

function reversalPairKey(tx: ReversalPairCandidate): string | null {
  const amount = positiveNumber(tx.amount);
  if (amount == null) return null;
  return [
    tx.fund_id ?? '',
    tx.transaction_date,
    amount.toFixed(2),
  ].join('|');
}

function unitsCompatible(a: ReversalPairCandidate, b: ReversalPairCandidate): boolean {
  const aUnits = positiveNumber(a.units);
  const bUnits = positiveNumber(b.units);
  if (aUnits == null || bUnits == null) return true;

  const tolerance = Math.max(0.0001, Math.max(aUnits, bUnits) * 0.000001);
  return Math.abs(aUnits - bUnits) <= tolerance;
}

function positiveNumber(value: number | null | undefined): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.abs(numeric) : null;
}

function normalizeTransactionType(type: string): string {
  return type.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Computes realized gains from a list of fund transactions using the
 * average cost method.
 *
 * On each purchase, the running average cost per unit is updated.
 * On each redemption, gain = proceeds - (units × avg_cost_at_redemption).
 */
export function computeRealizedGains(transactions: Transaction[]): RealizedGains {
  const sorted = filterReversedTransactionPairs(transactions).sort((a, b) =>
    a.transaction_date.localeCompare(b.transaction_date),
  );

  let totalCost = 0;
  let totalUnits = 0;
  let realizedGain = 0;
  let realizedAmount = 0;
  let redeemedUnits = 0;

  for (const tx of sorted) {
    const isOutflow =
      tx.transaction_type === 'purchase' ||
      tx.transaction_type === 'switch_in' ||
      tx.transaction_type === 'dividend_reinvest';
    const isInflow =
      tx.transaction_type === 'redemption' || tx.transaction_type === 'switch_out';

    if (isOutflow) {
      totalUnits += tx.units;
      totalCost += tx.amount;
    } else if (isInflow) {
      const avgCost = totalUnits > 0 ? totalCost / totalUnits : 0;
      const costBasis = tx.units * avgCost;
      realizedGain += tx.amount - costBasis;
      realizedAmount += tx.amount;
      redeemedUnits += tx.units;
      totalCost = Math.max(0, totalCost - costBasis);
      totalUnits = Math.max(0, totalUnits - tx.units);
    }
  }

  return { realizedGain, realizedAmount, redeemedUnits };
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
 *
 * investedAmount is the cost basis of REMAINING units (not lifetime buys).
 * On each redemption the average-cost basis of the sold units is deducted,
 * exactly mirroring the computeRealizedGains logic.
 */
export function buildCashflowsFromTransactions(
  transactions: Transaction[],
  currentValue: number,
  currentDate: Date,
): TransactionCashflows {
  let netUnits = 0;
  let totalCost = 0; // running cost basis — deducted on sells
  const historicalCashflows: Cashflow[] = [];

  for (const tx of filterReversedTransactionPairs(transactions)) {
    const date = new Date(tx.transaction_date);
    const isOutflow =
      tx.transaction_type === 'purchase' ||
      tx.transaction_type === 'switch_in' ||
      tx.transaction_type === 'dividend_reinvest';
    const isInflow =
      tx.transaction_type === 'redemption' || tx.transaction_type === 'switch_out';

    if (isOutflow) {
      netUnits += tx.units;
      totalCost += tx.amount;
      historicalCashflows.push({ date, amount: -tx.amount });
    } else if (isInflow) {
      // Deduct the avg-cost basis of sold units from running cost
      const avgCost = netUnits > 0 ? totalCost / netUnits : 0;
      const costBasis = tx.units * avgCost;
      totalCost = Math.max(0, totalCost - costBasis);
      netUnits = Math.max(0, netUnits - tx.units);
      historicalCashflows.push({ date, amount: tx.amount });
    }
  }

  const xirrCashflows: Cashflow[] = [
    ...historicalCashflows,
    { date: currentDate, amount: currentValue },
  ];

  return { historicalCashflows, xirrCashflows, netUnits, investedAmount: totalCost };
}

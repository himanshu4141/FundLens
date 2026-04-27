/**
 * Pure utility functions for fund portfolio composition logic.
 * Extracted to _shared/ so they can be tested under Jest (no Deno deps).
 */

export interface CategoryComposition {
  equity: number;
  debt: number;
  cash: number;
  other: number;
  large: number;
  mid: number;
  small: number;
}

export interface DebtHolding {
  holding_type?: string;
  credit_rating?: string;
  weight_pct?: number;
}

/** Returns true if value is a numeric string (e.g. "-14.30", "23.23"). */
export function isNumericString(value: string | undefined | null): boolean {
  if (!value) return false;
  return /^-?\d+(\.\d+)?$/.test(value.trim());
}

/**
 * Returns true if the debt_holdings array is corrupted.
 *
 * Some fund families (confirmed: pure-equity large-cap and overseas funds)
 * have benchmark performance data injected into debt_holdings with numeric
 * strings as holding_type or credit_rating. Discard the entire array when
 * this pattern is detected rather than silently computing a wrong debt_pct.
 */
export function isDebtDataCorrupted(debtHoldings: DebtHolding[]): boolean {
  return debtHoldings.some(
    (h) => isNumericString(h.holding_type) || isNumericString(h.credit_rating),
  );
}

/** Sum weight_pct across all debt holdings to derive debt_pct. */
export function deriveDebtPct(debtHoldings: DebtHolding[]): number {
  return debtHoldings.reduce((sum, h) => sum + (h.weight_pct ?? 0), 0);
}

/**
 * Returns false if equity_pct is obviously wrong for the given category rules.
 *
 * Two guards:
 *   1. Pure equity funds (catRules.equity >= 80): reject if equity_pct < 50.
 *      These funds are legally required to hold 80%+ equity; reporting <50% is
 *      a corrupt API response, not a real allocation shift.
 *   2. Pure debt funds (catRules.debt >= 80): reject if equity_pct > 20.
 *      Deliberately uses debt >= 80 rather than equity <= 10 to avoid rejecting
 *      overseas FoF funds, which also have equity=0 in catRules but legitimately
 *      return high equity_pct values from mfdata.in (ETFs in equity_holdings).
 */
export function isEquityPctPlausible(equityPct: number, catRules: CategoryComposition): boolean {
  if (catRules.equity >= 80 && equityPct < 50) return false;
  if (catRules.debt >= 80 && equityPct > 20) return false;
  return true;
}

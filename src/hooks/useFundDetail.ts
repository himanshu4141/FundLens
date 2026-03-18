/**
 * useFundDetail — loads data for the Fund Detail screen.
 *
 * Returns:
 *  - fund: fund metadata (name, category, benchmark)
 *  - transactions: all transactions for this fund (for XIRR)
 *  - navHistory: NAV history sorted ascending (for NAV History tab)
 *  - indexHistory: benchmark index history sorted ascending (for Performance tab)
 *  - currentUnits: net units held
 *  - investedAmount: total amount invested
 *  - currentValue: net units * latest NAV
 *  - xirr: fund-level XIRR
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { xirr, type Cashflow } from '@/src/utils/xirr';

export type TimeWindow = '1M' | '3M' | '6M' | '1Y' | '3Y' | 'All';

export interface NavPoint {
  date: string;
  value: number;
}

export interface FundDetailData {
  id: string;
  schemeName: string;
  schemeCategory: string;
  schemeCode: number;
  benchmarkIndex: string | null;
  benchmarkSymbol: string | null;
  currentNav: number;
  currentUnits: number;
  currentValue: number;
  investedAmount: number;
  fundXirr: number;
  navHistory: NavPoint[];      // ascending by date
  indexHistory: NavPoint[];    // ascending by date (benchmark)
}

async function fetchFundDetail(fundId: string): Promise<FundDetailData | null> {
  // Load fund metadata
  const { data: fund, error: fundError } = await supabase
    .from('fund')
    .select('id, scheme_code, scheme_name, scheme_category, benchmark_index, benchmark_index_symbol')
    .eq('id', fundId)
    .single();

  if (fundError || !fund) return null;

  // Load transactions for this fund
  const { data: txs, error: txError } = await supabase
    .from('transaction')
    .select('transaction_date, transaction_type, units, amount')
    .eq('fund_id', fundId)
    .order('transaction_date', { ascending: true });

  if (txError) throw txError;

  // Compute net units and cashflows
  let netUnits = 0;
  let investedAmount = 0;
  const cashflows: Cashflow[] = [];

  for (const tx of txs ?? []) {
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
      cashflows.push({ date, amount: -tx.amount });
    } else if (isInflow) {
      netUnits -= tx.units;
      cashflows.push({ date, amount: tx.amount });
    }
  }

  // Load full NAV history
  const { data: navRows, error: navError } = await supabase
    .from('nav_history')
    .select('nav_date, nav')
    .eq('scheme_code', fund.scheme_code)
    .order('nav_date', { ascending: true });

  if (navError) throw navError;

  const navHistory: NavPoint[] = (navRows ?? []).map((r) => ({
    date: r.nav_date as string,
    value: r.nav as number,
  }));

  const currentNav = navHistory.length > 0 ? navHistory[navHistory.length - 1].value : 0;
  const currentValue = netUnits * currentNav;

  // XIRR
  const xirrFlows: Cashflow[] = [...cashflows, { date: new Date(), amount: currentValue }];
  const fundXirr = cashflows.length > 0 ? xirr(xirrFlows) : NaN;

  // Load benchmark index history (if available)
  let indexHistory: NavPoint[] = [];
  if (fund.benchmark_index_symbol) {
    const { data: idxRows } = await supabase
      .from('index_history')
      .select('index_date, close_value')
      .eq('index_symbol', fund.benchmark_index_symbol)
      .order('index_date', { ascending: true });

    indexHistory = (idxRows ?? []).map((r) => ({
      date: r.index_date as string,
      value: r.close_value as number,
    }));
  }

  return {
    id: fund.id,
    schemeName: fund.scheme_name,
    schemeCategory: fund.scheme_category ?? '',
    schemeCode: fund.scheme_code,
    benchmarkIndex: fund.benchmark_index,
    benchmarkSymbol: fund.benchmark_index_symbol,
    currentNav,
    currentUnits: netUnits,
    currentValue,
    investedAmount,
    fundXirr,
    navHistory,
    indexHistory,
  };
}

export function useFundDetail(fundId: string) {
  return useQuery({
    queryKey: ['fund-detail', fundId],
    enabled: !!fundId,
    queryFn: () => fetchFundDetail(fundId),
    staleTime: 5 * 60 * 1000,
  });
}

/** Filter NAV/index history to a given time window */
export function filterToWindow(history: NavPoint[], window: TimeWindow): NavPoint[] {
  if (window === 'All' || history.length === 0) return history;

  const today = new Date();
  const cutoff = new Date(today);

  switch (window) {
    case '1M': cutoff.setMonth(today.getMonth() - 1); break;
    case '3M': cutoff.setMonth(today.getMonth() - 3); break;
    case '6M': cutoff.setMonth(today.getMonth() - 6); break;
    case '1Y': cutoff.setFullYear(today.getFullYear() - 1); break;
    case '3Y': cutoff.setFullYear(today.getFullYear() - 3); break;
  }

  const cutoffStr = cutoff.toISOString().split('T')[0];
  return history.filter((p) => p.date >= cutoffStr);
}

/** Index a series to 100 at its first point (for relative comparison charts) */
export function indexTo100(history: NavPoint[]): NavPoint[] {
  if (history.length === 0) return [];
  const base = history[0].value;
  if (base === 0) return history;
  return history.map((p) => ({ date: p.date, value: (p.value / base) * 100 }));
}

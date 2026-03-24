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
import { xirr, buildCashflowsFromTransactions } from '@/src/utils/xirr';
import type { NavPoint } from '@/src/utils/navUtils';

// Pure windowing utils live in navUtils so they can be unit-tested without
// pulling in React Native / Supabase dependencies.
export { filterToWindow, indexTo100 } from '@/src/utils/navUtils';
export type { TimeWindow, NavPoint } from '@/src/utils/navUtils';

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

export async function fetchFundDetail(fundId: string): Promise<FundDetailData | null> {
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
  const { historicalCashflows: cashflows, netUnits, investedAmount } =
    buildCashflowsFromTransactions(txs ?? [], 0, new Date());

  // Load NAV history descending so the most-recent rows always fall within
  // Supabase's default 1000-row API limit. Then reverse to ascending for charting.
  const { data: navRows, error: navError } = await supabase
    .from('nav_history')
    .select('nav_date, nav')
    .eq('scheme_code', fund.scheme_code)
    .order('nav_date', { ascending: false });

  if (navError) throw navError;

  const navHistory: NavPoint[] = [...(navRows ?? [])]
    .sort((a, b) => String(b.nav_date).localeCompare(String(a.nav_date)))
    .map((r) => ({ date: r.nav_date as string, value: r.nav as number }))
    .reverse(); // ascending for chart rendering

  if (navHistory.length === 0) {
    throw new Error(`No NAV data found for scheme ${fund.scheme_code} — cannot compute current value`);
  }
  const currentNav = navHistory[navHistory.length - 1].value;
  const currentValue = netUnits * currentNav;

  // XIRR
  const { xirrCashflows } = buildCashflowsFromTransactions(txs ?? [], currentValue, new Date());
  const fundXirr = cashflows.length > 0 ? xirr(xirrCashflows) : NaN;

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
    staleTime: 0, // always fetch fresh so current value matches portfolio
  });
}

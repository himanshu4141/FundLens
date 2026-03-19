/**
 * useCompare — loads NAV history + holdings data for 2-3 funds to compare.
 *
 * For each selected fund:
 *  - NAV history (full, for the chart)
 *  - Transactions (for XIRR and 1Y return)
 *  - Metadata (name, category, benchmark)
 *
 * The chart shows each fund's NAV indexed to 100 from a common start date
 * (the earliest date where all selected funds have NAV data).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { xirr, buildCashflowsFromTransactions } from '@/src/utils/xirr';
import { filterToWindow, type TimeWindow, type NavPoint } from '@/src/utils/navUtils';

export interface CompareFundData {
  id: string;
  schemeName: string;
  schemeCategory: string;
  schemeCode: number;
  currentNav: number;
  fundXirr: number;
  return1Y: number | null; // % return over last 1 year based on NAV
  navHistory: NavPoint[];
}

export interface CompareData {
  funds: CompareFundData[];
  commonNavSeries: { date: string; funds: Record<string, number> }[]; // indexed to 100
}

async function fetchCompareData(fundIds: string[]): Promise<CompareData> {
  if (fundIds.length === 0) return { funds: [], commonNavSeries: [] };

  // Load metadata for all selected funds
  const { data: fundsData, error: fundsError } = await supabase
    .from('fund')
    .select('id, scheme_code, scheme_name, scheme_category')
    .in('id', fundIds);

  if (fundsError) throw fundsError;

  const schemeCodes = (fundsData ?? []).map((f) => f.scheme_code);

  // Load NAV histories for all schemes in one query
  const { data: navRows, error: navError } = await supabase
    .from('nav_history')
    .select('scheme_code, nav_date, nav')
    .in('scheme_code', schemeCodes)
    .order('nav_date', { ascending: true });

  if (navError) throw navError;

  // Group NAV by scheme_code
  const navByScheme = new Map<number, NavPoint[]>();
  for (const row of navRows ?? []) {
    const code = row.scheme_code as number;
    const existing = navByScheme.get(code) ?? [];
    existing.push({ date: row.nav_date as string, value: row.nav as number });
    navByScheme.set(code, existing);
  }

  // Load transactions for all funds
  const { data: allTxs, error: txError } = await supabase
    .from('transaction')
    .select('fund_id, transaction_date, transaction_type, units, amount')
    .in('fund_id', fundIds)
    .order('transaction_date', { ascending: true });

  if (txError) throw txError;

  const txByFund = new Map<string, typeof allTxs>();
  for (const tx of allTxs ?? []) {
    const existing = txByFund.get(tx.fund_id) ?? [];
    existing.push(tx);
    txByFund.set(tx.fund_id, existing);
  }

  // Build per-fund data
  const compareFunds: CompareFundData[] = [];

  for (const fund of fundsData ?? []) {
    const navHistory = navByScheme.get(fund.scheme_code) ?? [];
    const txs = txByFund.get(fund.id) ?? [];

    const currentNav = navHistory.length > 0 ? navHistory[navHistory.length - 1].value : 0;

    // Cashflows for XIRR — pass currentValue=0 first to get netUnits, then recompute
    const { historicalCashflows, netUnits } = buildCashflowsFromTransactions(txs, 0, new Date());
    const currentValue = netUnits * currentNav;
    const { xirrCashflows } = buildCashflowsFromTransactions(txs, currentValue, new Date());
    const fundXirr = historicalCashflows.length > 0 ? xirr(xirrCashflows) : NaN;

    // 1Y return based on NAV
    const nav1Y = filterToWindow(navHistory, '1Y');
    const return1Y =
      nav1Y.length > 1
        ? ((nav1Y[nav1Y.length - 1].value - nav1Y[0].value) / nav1Y[0].value) * 100
        : null;

    compareFunds.push({
      id: fund.id,
      schemeName: fund.scheme_name,
      schemeCategory: fund.scheme_category ?? '',
      schemeCode: fund.scheme_code,
      currentNav,
      fundXirr,
      return1Y,
      navHistory,
    });
  }

  // Build common date series: find latest "start date" across all funds' histories
  // so all funds have data from that point forward
  let commonStart = '';
  for (const f of compareFunds) {
    if (f.navHistory.length > 0) {
      const firstDate = f.navHistory[0].date;
      if (!commonStart || firstDate > commonStart) commonStart = firstDate;
    }
  }

  // Build indexed series
  const commonNavSeries: { date: string; funds: Record<string, number> }[] = [];

  if (commonStart && compareFunds.length > 0) {
    // Get all dates from the fund with the most data after commonStart
    const referenceFund = compareFunds.reduce((best, f) => {
      const count = f.navHistory.filter((p) => p.date >= commonStart).length;
      const bestCount = best.navHistory.filter((p) => p.date >= commonStart).length;
      return count > bestCount ? f : best;
    }, compareFunds[0]);

    const referenceDates = referenceFund.navHistory
      .filter((p) => p.date >= commonStart)
      .map((p) => p.date);

    // For each fund, build a date→value map
    const navMaps = compareFunds.map((f) => {
      const map = new Map<string, number>();
      for (const p of f.navHistory) map.set(p.date, p.value);
      return { id: f.id, map };
    });

    // Find base values (first date in common range)
    const baseValues: Record<string, number> = {};
    for (const { id, map } of navMaps) {
      baseValues[id] = map.get(commonStart) ?? (map.get(referenceDates[0]) ?? 0);
    }

    for (const date of referenceDates) {
      const entry: { date: string; funds: Record<string, number> } = { date, funds: {} };
      let allHaveData = true;

      for (const { id, map } of navMaps) {
        const val = map.get(date);
        if (val === undefined || baseValues[id] === 0) {
          allHaveData = false;
          break;
        }
        entry.funds[id] = (val / baseValues[id]) * 100;
      }

      if (allHaveData) commonNavSeries.push(entry);
    }
  }

  return { funds: compareFunds, commonNavSeries };
}

export function useCompare(fundIds: string[]) {
  return useQuery({
    queryKey: ['compare', [...fundIds].sort()],
    enabled: fundIds.length > 0,
    queryFn: () => fetchCompareData(fundIds),
    staleTime: 5 * 60 * 1000,
  });
}

/** Build per-fund data series for the LineChart from commonNavSeries */
export function buildChartSeries(
  commonNavSeries: CompareData['commonNavSeries'],
  fundIds: string[],
  window: TimeWindow,
): { value: number }[][] {
  // Apply time window filter
  const filtered = filterToWindow(commonNavSeries, window);

  // Re-index to 100 from the first point in the filtered window
  const reindexed = filtered.map((entry) => {
    const rebaseEntry: { date: string; funds: Record<string, number> } = {
      date: entry.date,
      funds: {},
    };
    for (const id of fundIds) {
      rebaseEntry.funds[id] = entry.funds[id];
    }
    return rebaseEntry;
  });

  if (reindexed.length > 0) {
    const base: Record<string, number> = {};
    for (const id of fundIds) base[id] = reindexed[0].funds[id];
    for (const entry of reindexed) {
      for (const id of fundIds) {
        if (base[id] && base[id] !== 0) {
          entry.funds[id] = (entry.funds[id] / base[id]) * 100;
        }
      }
    }
  }

  // Sample to ~60 points
  const step = Math.ceil(reindexed.length / 60);
  const sampled = reindexed.filter((_, i) => i % step === 0 || i === reindexed.length - 1);

  return fundIds.map((id) => sampled.map((entry) => ({ value: entry.funds[id] ?? 100 })));
}

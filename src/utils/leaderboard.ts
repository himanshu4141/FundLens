import { buildCashflowsFromTransactions, type Transaction } from '@/src/utils/xirr';
import { filterToWindow, indexTo100, type NavPoint } from '@/src/utils/navUtils';

export interface LeaderboardFund {
  id: string;
  schemeName: string;
  schemeCategory: string;
  schemeCode: number;
}

export interface LeaderboardRow {
  id: string;
  schemeName: string;
  schemeCategory: string;
  currentValue: number;
  fundReturnPct: number;
  benchmarkReturnPct: number;
  deltaPct: number;
  verdict: 'leader' | 'laggard';
}

function nearestBenchmarkValue(series: NavPoint[], targetDate: string): number | null {
  if (series.length === 0) return null;
  let lo = 0;
  let hi = series.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].date < targetDate) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return series[0].value;
  if (lo >= series.length) return series[series.length - 1].value;
  if (series[lo].date === targetDate) return series[lo].value;
  return series[lo - 1].value;
}

export function buildLeaderboardRows(params: {
  funds: LeaderboardFund[];
  transactionsByFund: Map<string, Transaction[]>;
  navHistoryByScheme: Map<number, NavPoint[]>;
  benchmarkHistory: NavPoint[];
}): LeaderboardRow[] {
  const benchmark1Y = filterToWindow(params.benchmarkHistory, '1Y');

  const rows = params.funds.flatMap((fund) => {
    const navHistory = params.navHistoryByScheme.get(fund.schemeCode) ?? [];
    const txs = params.transactionsByFund.get(fund.id) ?? [];
    if (!navHistory.length || !txs.length || !benchmark1Y.length) return [];

    const latestNav = navHistory[navHistory.length - 1].value;
    const { netUnits } = buildCashflowsFromTransactions(txs, 0, new Date());
    if (netUnits <= 0) return [];

    const currentValue = netUnits * latestNav;
    const filteredNav = filterToWindow(navHistory, '1Y');
    if (filteredNav.length < 2) return [];

    const navStart = filteredNav[0]?.date ?? '';
    const filteredBenchmark = benchmark1Y.filter((point) => point.date >= navStart);
    if (filteredBenchmark.length < 2) return [];

    const commonStart = filteredBenchmark[0].date > navStart ? filteredBenchmark[0].date : navStart;
    const alignedNav = filteredNav.filter((point) => point.date >= commonStart);
    const alignedBenchmark = filteredBenchmark.filter((point) => point.date >= commonStart);
    if (alignedNav.length < 2 || alignedBenchmark.length < 2) return [];

    const indexedNav = indexTo100(alignedNav);
    const indexedBenchmark = indexTo100(alignedBenchmark);
    const latestFund = indexedNav[indexedNav.length - 1]?.value ?? 100;
    const latestBenchmark = nearestBenchmarkValue(indexedBenchmark, indexedNav[indexedNav.length - 1]?.date ?? '');
    if (latestBenchmark == null) return [];

    const fundReturnPct = latestFund - 100;
    const benchmarkReturnPct = latestBenchmark - 100;
    const deltaPct = fundReturnPct - benchmarkReturnPct;

    return [{
      id: fund.id,
      schemeName: fund.schemeName,
      schemeCategory: fund.schemeCategory,
      currentValue,
      fundReturnPct,
      benchmarkReturnPct,
      deltaPct,
      verdict: deltaPct >= 0 ? ('leader' as const) : ('laggard' as const),
    }];
  });

  return rows.sort((a, b) => b.deltaPct - a.deltaPct);
}

/**
 * usePortfolio — loads the user's portfolio data for the Home Screen.
 *
 * Fetches all active funds for the current user, their latest NAV,
 * yesterday's NAV (for daily movement), and all transactions (for XIRR).
 *
 * Returns:
 *  - fundCards: per-fund display data (name, current value, daily change, return)
 *  - portfolioTotal: sum of all fund current values
 *  - dailyChange: total daily change in INR and %
 *  - portfolioXirr: overall portfolio XIRR using all transactions
 *  - vsMarket: portfolio XIRR vs selected benchmark XIRR over same period
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import {
  xirr,
  buildCashflowsFromTransactions,
  computeRealizedGains,
  type Cashflow,
} from '@/src/utils/xirr';
import { useSession } from '@/src/hooks/useSession';

export interface FundCardData {
  id: string;
  schemeName: string;
  schemeCategory: string;
  schemeCode: number;
  currentNav: number;
  previousNav: number;
  currentUnits: number;
  currentValue: number;
  investedAmount: number;
  dailyChangeAmount: number;
  dailyChangePct: number;
  returnXirr: number;
  realizedGain: number;
  realizedAmount: number;
  redeemedUnits: number;
  navHistory30d: { date: string; value: number }[];
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  dailyChangeAmount: number;
  dailyChangePct: number;
  xirr: number;
  marketXirr: number;
  benchmarkSymbol: string;
}

async function fetchPortfolioData(userId: string, benchmarkSymbol: string) {
  // Load active funds
  const { data: funds, error: fundsError } = await supabase
    .from('fund')
    .select('id, scheme_code, scheme_name, scheme_category, benchmark_index_symbol')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (fundsError) throw fundsError;
  if (!funds?.length) return { fundCards: [], summary: null };

  // Load all transactions for this user (for XIRR)
  const { data: allTxs, error: txError } = await supabase
    .from('transaction')
    .select('fund_id, transaction_date, transaction_type, units, amount')
    .eq('user_id', userId)
    .order('transaction_date', { ascending: true });

  if (txError) throw txError;

  // Group transactions by fund_id
  const txByFund = new Map<string, typeof allTxs>();
  for (const tx of allTxs ?? []) {
    const existing = txByFund.get(tx.fund_id) ?? [];
    existing.push(tx);
    txByFund.set(tx.fund_id, existing);
  }

  const schemeCodes = funds.map((f) => f.scheme_code);

  // Load full NAV history for each scheme, most-recent first.
  // No date cutoff — we always want the closest available NAV to today, regardless of
  // how recently the sync ran.  The navByScheme loop below takes only the first 2 rows
  // per scheme (current + previous) so the extra rows are cheap to process.
  const { data: navRows, error: navError } = await supabase
    .from('nav_history')
    .select('scheme_code, nav_date, nav')
    .in('scheme_code', schemeCodes)
    .order('nav_date', { ascending: false });

  if (navError) throw navError;

  // Build map: scheme_code → { current, previous } using the two most-recent rows.
  const navByScheme = new Map<number, { current: number; previous: number; date: string }>();
  for (const row of navRows ?? []) {
    const code = row.scheme_code as number;
    const existing = navByScheme.get(code);
    if (!existing) {
      navByScheme.set(code, { current: row.nav as number, previous: row.nav as number, date: row.nav_date as string });
    } else if (existing.current === existing.previous) {
      // second row = previous trading day's NAV
      navByScheme.set(code, { ...existing, previous: row.nav as number });
    }
  }

  // Build sparkline history map (rows came descending — reverse to ascending for rendering)
  const navHistoryByScheme = new Map<number, { date: string; value: number }[]>();
  for (const row of navRows ?? []) {
    const code = row.scheme_code as number;
    const pts = navHistoryByScheme.get(code) ?? [];
    pts.push({ date: row.nav_date as string, value: row.nav as number });
    navHistoryByScheme.set(code, pts);
  }
  for (const [code, pts] of navHistoryByScheme) {
    navHistoryByScheme.set(code, [...pts].reverse());
  }

  // Load benchmark index history for market comparison
  const { data: benchmarkRows } = await supabase
    .from('index_history')
    .select('index_date, close_value')
    .eq('index_symbol', benchmarkSymbol)
    .order('index_date', { ascending: true });

  const benchmarkMap = new Map<string, number>();
  for (const row of benchmarkRows ?? []) {
    benchmarkMap.set(row.index_date as string, row.close_value as number);
  }

  // Compute per-fund card data
  const fundCards: FundCardData[] = [];
  let portfolioTotalValue = 0;
  let portfolioTotalPreviousValue = 0;
  let portfolioTotalInvested = 0;

  const allCashflows: Cashflow[] = [];

  for (const fund of funds) {
    const navInfo = navByScheme.get(fund.scheme_code);
    const txs = txByFund.get(fund.id) ?? [];

    if (txs.length === 0) continue;
    if (!navInfo) throw new Error(`No NAV data found for scheme ${fund.scheme_code} — cannot compute current value`);

    const today = new Date();

    // First pass: get netUnits and historical cashflows (currentValue unknown yet)
    const { historicalCashflows, netUnits, investedAmount } = buildCashflowsFromTransactions(
      txs,
      0,
      today,
    );

    if (netUnits < 0.001) continue; // skip fully-exited funds (guards against floating-point residuals)

    const currentValue = netUnits * navInfo.current;
    const previousValue = netUnits * navInfo.previous;
    const dailyChangeAmount = currentValue - previousValue;
    const dailyChangePct = previousValue > 0 ? (dailyChangeAmount / previousValue) * 100 : 0;

    // Accumulate historical cashflows for portfolio-level XIRR
    allCashflows.push(...historicalCashflows);

    // Build fund-level XIRR cashflows with terminal inflow
    const { xirrCashflows: fundXirrFlows } = buildCashflowsFromTransactions(
      txs,
      currentValue,
      today,
    );
    const fundXirr = xirr(fundXirrFlows);

    // Realized gains for partially/fully redeemed funds
    const { realizedGain, realizedAmount, redeemedUnits } = computeRealizedGains(txs);

    fundCards.push({
      id: fund.id,
      schemeName: fund.scheme_name,
      schemeCategory: fund.scheme_category ?? '',
      schemeCode: fund.scheme_code,
      currentNav: navInfo.current,
      previousNav: navInfo.previous,
      currentUnits: netUnits,
      currentValue,
      investedAmount,
      dailyChangeAmount,
      dailyChangePct,
      returnXirr: fundXirr,
      realizedGain,
      realizedAmount,
      redeemedUnits,
      navHistory30d: navHistoryByScheme.get(fund.scheme_code) ?? [],
    });

    portfolioTotalValue += currentValue;
    portfolioTotalPreviousValue += previousValue;
    portfolioTotalInvested += investedAmount;
  }

  // Portfolio-level XIRR
  const portfolioDailyChange = portfolioTotalValue - portfolioTotalPreviousValue;
  const portfolioDailyChangePct =
    portfolioTotalPreviousValue > 0
      ? (portfolioDailyChange / portfolioTotalPreviousValue) * 100
      : 0;

  const today = new Date();
  const portfolioXirrFlows: Cashflow[] = [
    ...allCashflows,
    { date: today, amount: portfolioTotalValue },
  ];
  const portfolioXirrRate = allCashflows.length > 0 ? xirr(portfolioXirrFlows) : NaN;

  // Market XIRR: apple-to-apple comparison — simulate investing the SAME amounts
  // on the SAME dates in the selected benchmark, then compute XIRR on those flows.
  let marketXirr = NaN;
  if (allCashflows.length > 0 && benchmarkRows?.length) {
    const sortedBenchmark = [...(benchmarkRows ?? [])].sort((a, b) =>
      (a.index_date as string).localeCompare(b.index_date as string),
    );

    // Build a date → close_value lookup with ±7 day fallback for weekends/holidays
    const benchmarkValueMap = new Map<string, number>();
    for (const row of sortedBenchmark) {
      benchmarkValueMap.set(row.index_date as string, row.close_value as number);
    }

    function findNearestBenchmark(dateStr: string): number | null {
      for (let offset = 0; offset <= 7; offset++) {
        const d = new Date(dateStr);
        d.setDate(d.getDate() + offset);
        const val = benchmarkValueMap.get(d.toISOString().split('T')[0]);
        if (val) return val;
        if (offset > 0) {
          const d2 = new Date(dateStr);
          d2.setDate(d2.getDate() - offset);
          const val2 = benchmarkValueMap.get(d2.toISOString().split('T')[0]);
          if (val2) return val2;
        }
      }
      return null;
    }

    // Mirror each outflow (investment) into hypothetical benchmark units
    let benchmarkUnits = 0;
    const benchmarkFlows: Cashflow[] = [];

    for (const cf of allCashflows) {
      const dateStr = cf.date.toISOString().split('T')[0];
      const benchmarkVal = findNearestBenchmark(dateStr);
      if (!benchmarkVal) continue;

      if (cf.amount < 0) {
        // Outflow: buy benchmark units worth |amount|
        benchmarkUnits += Math.abs(cf.amount) / benchmarkVal;
        benchmarkFlows.push({ date: cf.date, amount: cf.amount });
      } else {
        // Inflow (redemption): pass through as a positive cashflow
        benchmarkFlows.push({ date: cf.date, amount: cf.amount });
      }
    }

    const latestBenchmarkEntry = sortedBenchmark[sortedBenchmark.length - 1];
    if (benchmarkUnits > 0 && latestBenchmarkEntry && benchmarkFlows.length > 0) {
      const benchmarkTerminalValue = benchmarkUnits * (latestBenchmarkEntry.close_value as number);
      benchmarkFlows.push({
        date: new Date(latestBenchmarkEntry.index_date as string),
        amount: benchmarkTerminalValue,
      });
      marketXirr = xirr(benchmarkFlows);
    }
  }

  const summary: PortfolioSummary = {
    totalValue: portfolioTotalValue,
    totalInvested: portfolioTotalInvested,
    dailyChangeAmount: portfolioDailyChange,
    dailyChangePct: portfolioDailyChangePct,
    xirr: portfolioXirrRate,
    marketXirr,
    benchmarkSymbol,
  };

  return { fundCards, summary };
}

export function usePortfolio(benchmarkSymbol: string = '^NSEI') {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['portfolio', userId, benchmarkSymbol],
    enabled: !!userId,
    queryFn: () => fetchPortfolioData(userId!, benchmarkSymbol),
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: keepPreviousData, // no jarring flash when switching benchmark
  });
}

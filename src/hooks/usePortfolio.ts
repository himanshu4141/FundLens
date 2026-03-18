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
 *  - vsMarket: portfolio XIRR vs Nifty 50 XIRR over same period
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { xirr, type Cashflow } from '@/src/utils/xirr';
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
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  dailyChangeAmount: number;
  dailyChangePct: number;
  xirr: number;
  marketXirr: number; // Nifty 50 XIRR over same period
}

async function fetchPortfolioData(userId: string) {
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

  // Load latest 2 NAV entries for each scheme (for current NAV + yesterday)
  const { data: navRows, error: navError } = await supabase
    .from('nav_history')
    .select('scheme_code, nav_date, nav')
    .in('scheme_code', schemeCodes)
    .order('nav_date', { ascending: false });

  if (navError) throw navError;

  // Build map: scheme_code → [latest, previous]
  const navByScheme = new Map<number, { current: number; previous: number; date: string }>();
  for (const row of navRows ?? []) {
    const code = row.scheme_code as number;
    const existing = navByScheme.get(code);
    if (!existing) {
      navByScheme.set(code, { current: row.nav as number, previous: row.nav as number, date: row.nav_date as string });
    } else if (!existing.previous || existing.current === existing.previous) {
      // second row = yesterday's NAV
      navByScheme.set(code, { ...existing, previous: row.nav as number });
    }
  }

  // Load Nifty 50 index history for market comparison
  const { data: niftyRows } = await supabase
    .from('index_history')
    .select('index_date, close_value')
    .eq('index_symbol', '^NSEI')
    .order('index_date', { ascending: true });

  const niftyMap = new Map<string, number>();
  for (const row of niftyRows ?? []) {
    niftyMap.set(row.index_date as string, row.close_value as number);
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

    if (!navInfo || txs.length === 0) continue;

    // Compute net units (purchases - redemptions)
    let netUnits = 0;
    let investedAmount = 0;
    const fundCashflows: Cashflow[] = [];

    for (const tx of txs) {
      const date = new Date(tx.transaction_date);
      const isOutflow = tx.transaction_type === 'purchase' ||
        tx.transaction_type === 'switch_in' ||
        tx.transaction_type === 'dividend_reinvest';
      const isInflow = tx.transaction_type === 'redemption' || tx.transaction_type === 'switch_out';

      if (isOutflow) {
        netUnits += tx.units;
        investedAmount += tx.amount;
        fundCashflows.push({ date, amount: -tx.amount });
        allCashflows.push({ date, amount: -tx.amount });
      } else if (isInflow) {
        netUnits -= tx.units;
        fundCashflows.push({ date, amount: tx.amount });
        allCashflows.push({ date, amount: tx.amount });
      }
    }

    if (netUnits <= 0) continue;

    const currentValue = netUnits * navInfo.current;
    const previousValue = netUnits * navInfo.previous;
    const dailyChangeAmount = currentValue - previousValue;
    const dailyChangePct = previousValue > 0 ? (dailyChangeAmount / previousValue) * 100 : 0;

    // XIRR: add current value as final inflow (as of today)
    const today = new Date();
    const fundXirrFlows: Cashflow[] = [...fundCashflows, { date: today, amount: currentValue }];
    const fundXirr = xirr(fundXirrFlows);

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

  // Market XIRR: simulate investing ₹1 on first investment date, redeeming on today
  // using Nifty 50 index values
  let marketXirr = NaN;
  if (allCashflows.length > 0 && niftyRows?.length) {
    const firstDate = allCashflows.reduce(
      (min, cf) => (cf.date < min ? cf.date : min),
      allCashflows[0].date,
    );
    const firstDateStr = firstDate.toISOString().split('T')[0];

    // Find first available Nifty value on or after first investment date
    const sortedNifty = [...(niftyRows ?? [])].sort((a, b) =>
      (a.index_date as string).localeCompare(b.index_date as string),
    );
    const firstEntry = sortedNifty.find((r) => (r.index_date as string) >= firstDateStr);
    const lastEntry = sortedNifty[sortedNifty.length - 1];

    if (firstEntry && lastEntry && firstEntry !== lastEntry) {
      const firstVal = firstEntry.close_value as number;
      const lastVal = lastEntry.close_value as number;
      const marketFlows: Cashflow[] = [
        { date: new Date(firstEntry.index_date as string), amount: -1 },
        { date: new Date(lastEntry.index_date as string), amount: lastVal / firstVal },
      ];
      marketXirr = xirr(marketFlows);
    }
  }

  const summary: PortfolioSummary = {
    totalValue: portfolioTotalValue,
    totalInvested: portfolioTotalInvested,
    dailyChangeAmount: portfolioDailyChange,
    dailyChangePct: portfolioDailyChangePct,
    xirr: portfolioXirrRate,
    marketXirr,
  };

  return { fundCards, summary };
}

export function usePortfolio() {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ['portfolio', userId],
    enabled: !!userId,
    queryFn: () => fetchPortfolioData(userId!),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

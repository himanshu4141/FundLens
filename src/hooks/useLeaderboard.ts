import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { buildLeaderboardRows, type LeaderboardFund, type LeaderboardRow } from '@/src/utils/leaderboard';
import type { Transaction } from '@/src/utils/xirr';
import type { NavPoint } from '@/src/utils/navUtils';

export async function fetchLeaderboardData(userId: string, benchmarkSymbol: string): Promise<LeaderboardRow[]> {
  const { data: funds, error: fundsError } = await supabase
    .from('fund')
    .select('id, scheme_code, scheme_name, scheme_category')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (fundsError) throw fundsError;
  if (!funds?.length) return [];

  const { data: transactions, error: txError } = await supabase
    .from('transaction')
    .select('fund_id, transaction_date, transaction_type, units, amount')
    .eq('user_id', userId)
    .order('transaction_date', { ascending: true });

  if (txError) throw txError;

  const { data: navRows, error: navError } = await supabase
    .from('nav_history')
    .select('scheme_code, nav_date, nav')
    .in('scheme_code', funds.map((fund) => fund.scheme_code))
    .order('nav_date', { ascending: true });

  if (navError) throw navError;

  const { data: indexRows, error: indexError } = await supabase
    .from('index_history')
    .select('index_date, close_value')
    .eq('index_symbol', benchmarkSymbol)
    .order('index_date', { ascending: true });

  if (indexError) throw indexError;

  const transactionsByFund = new Map<string, Transaction[]>();
  for (const tx of (transactions ?? []) as Transaction[] & { fund_id?: string }[]) {
    const fundId = (tx as Transaction & { fund_id: string }).fund_id;
    const existing = transactionsByFund.get(fundId) ?? [];
    existing.push(tx);
    transactionsByFund.set(fundId, existing);
  }

  const navHistoryByScheme = new Map<number, NavPoint[]>();
  for (const row of navRows ?? []) {
    const schemeCode = row.scheme_code as number;
    const existing = navHistoryByScheme.get(schemeCode) ?? [];
    existing.push({ date: row.nav_date as string, value: row.nav as number });
    navHistoryByScheme.set(schemeCode, existing);
  }

  return buildLeaderboardRows({
    funds: (funds ?? []).map((fund) => ({
      id: fund.id,
      schemeName: fund.scheme_name,
      schemeCategory: fund.scheme_category ?? '',
      schemeCode: fund.scheme_code,
    })) as LeaderboardFund[],
    transactionsByFund,
    navHistoryByScheme,
    benchmarkHistory: (indexRows ?? []).map((row) => ({
      date: row.index_date as string,
      value: row.close_value as number,
    })),
  });
}

export function useLeaderboard(userId: string | null | undefined, benchmarkSymbol: string) {
  return useQuery({
    queryKey: ['leaderboard', userId, benchmarkSymbol],
    enabled: !!userId,
    queryFn: () => fetchLeaderboardData(userId!, benchmarkSymbol),
    staleTime: 5 * 60 * 1000,
  });
}

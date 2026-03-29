import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import {
  buildPortfolioTimelineSeries,
  type TimelineFundRow,
  type TimelineIndexRow,
  type TimelineNavRow,
  type TimelineTxRow,
  type PortfolioTimelineData,
  type PortfolioTimelinePoint,
  type PortfolioTimelineWindow,
} from '@/src/utils/portfolioTimeline';

export type { PortfolioTimelineData, PortfolioTimelinePoint, PortfolioTimelineWindow };

const PAGE_SIZE = 1000;

async function fetchPagedRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

export async function fetchPortfolioTimeline(
  userId: string,
  benchmarkSymbol: string,
  window: PortfolioTimelineWindow,
): Promise<PortfolioTimelineData> {
  const { data: funds, error: fundsError } = await supabase
    .from('fund')
    .select('id, scheme_code')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (fundsError) throw fundsError;
  if (!funds?.length) return { points: [], benchmarkAvailable: false };

  const { data: transactions, error: txError } = await supabase
    .from('transaction')
    .select('fund_id, transaction_date, transaction_type, units')
    .eq('user_id', userId)
    .order('transaction_date', { ascending: true });

  if (txError) throw txError;

  const navRows = await fetchPagedRows<TimelineNavRow>(async (from, to) =>
    await supabase
      .from('nav_history')
      .select('scheme_code, nav_date, nav')
      .in('scheme_code', funds.map((fund) => fund.scheme_code))
      .order('nav_date', { ascending: true })
      .range(from, to),
  );

  const indexRows = await fetchPagedRows<TimelineIndexRow>(async (from, to) =>
    await supabase
      .from('index_history')
      .select('index_date, close_value')
      .eq('index_symbol', benchmarkSymbol)
      .order('index_date', { ascending: true })
      .range(from, to),
  );

  return buildPortfolioTimelineSeries({
    funds: (funds ?? []) as TimelineFundRow[],
    transactions: (transactions ?? []) as TimelineTxRow[],
    navRows,
    indexRows,
    window,
  });
}

export function usePortfolioTimeline(
  userId: string | null | undefined,
  benchmarkSymbol: string,
  window: PortfolioTimelineWindow,
) {
  return useQuery({
    queryKey: ['portfolio-timeline', userId, benchmarkSymbol, window],
    enabled: !!userId,
    queryFn: () => fetchPortfolioTimeline(userId!, benchmarkSymbol, window),
    staleTime: 5 * 60 * 1000,
  });
}

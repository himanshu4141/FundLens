import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { buildXAxisLabels } from '@/src/hooks/usePerformanceTimeline';
import { filterToWindow, type NavPoint, type TimeWindow } from '@/src/utils/navUtils';
import type { FundRef } from '@/src/hooks/usePortfolioTimeline';

export interface InvestmentVsBenchmarkPoint {
  date: string;
  investedValue: number;
  portfolioValue: number;
  benchmarkValue: number;
}

export interface InvestmentVsBenchmarkTimeline {
  points: InvestmentVsBenchmarkPoint[];
  xAxisLabels: string[];
  isLoading: boolean;
  error: string | null;
}

interface RawNavRow { scheme_code: number; nav_date: string; nav: number }
interface RawTxRow {
  fund_id: string;
  transaction_date: string;
  transaction_type: string;
  units: number;
  amount: number;
}
interface RawIdxRow { index_date: string; close_value: number }

function isInvestment(type: string): boolean {
  return type === 'purchase' || type === 'switch_in' || type === 'dividend_reinvest';
}

function isRedemption(type: string): boolean {
  return type === 'redemption' || type === 'switch_out';
}

function getLatestAt<T extends { date: string }>(history: T[], targetDate: string): T | null {
  let lo = 0;
  let hi = history.length - 1;
  let result: T | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (history[mid].date <= targetDate) {
      result = history[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

function getUnitsAt(history: { date: string; units: number }[], targetDate: string): number {
  return Math.max(0, getLatestAt(history, targetDate)?.units ?? 0);
}

function getInvestedAt(history: { date: string; investedValue: number }[], targetDate: string): number {
  return Math.max(0, getLatestAt(history, targetDate)?.investedValue ?? 0);
}

function getBenchmarkUnitsAt(history: { date: string; units: number }[], targetDate: string): number {
  return Math.max(0, getLatestAt(history, targetDate)?.units ?? 0);
}

function samplePoints(points: InvestmentVsBenchmarkPoint[], maxPoints = 32): InvestmentVsBenchmarkPoint[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const sampled = points.filter((_, index) => index % step === 0);
  const last = points[points.length - 1];
  if (sampled[sampled.length - 1]?.date !== last.date) sampled.push(last);
  return sampled;
}

export function computeInvestmentVsBenchmarkTimeline(
  navRows: RawNavRow[],
  txRows: RawTxRow[],
  idxRows: RawIdxRow[],
  funds: FundRef[],
  window: TimeWindow,
): { points: InvestmentVsBenchmarkPoint[]; xAxisLabels: string[] } {
  if (funds.length === 0 || navRows.length === 0 || txRows.length === 0 || idxRows.length === 0) {
    return { points: [], xAxisLabels: [] };
  }

  const fundIds = new Set(funds.map((fund) => fund.id));
  const schemeByFund = new Map(funds.map((fund) => [fund.id, fund.schemeCode]));

  const navByScheme = new Map<number, Map<string, number>>();
  const allDates = new Set<string>();
  for (const row of navRows) {
    if (!navByScheme.has(row.scheme_code)) navByScheme.set(row.scheme_code, new Map());
    navByScheme.get(row.scheme_code)!.set(row.nav_date, row.nav);
    allDates.add(row.nav_date);
  }

  const benchmarkHistory: NavPoint[] = [...idxRows]
    .sort((a, b) => a.index_date.localeCompare(b.index_date))
    .map((row) => ({ date: row.index_date, value: row.close_value }));

  const benchmarkByDate = new Map(benchmarkHistory.map((point) => [point.date, point.value]));
  function benchmarkValueAt(date: string): number | null {
    const exact = benchmarkByDate.get(date);
    if (exact !== undefined) return exact;
    return getLatestAt(benchmarkHistory, date)?.value ?? null;
  }

  const sortedTransactions = [...txRows]
    .filter((tx) => fundIds.has(tx.fund_id))
    .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

  const unitHistory = new Map<string, { date: string; units: number }[]>();
  const investedHistory: { date: string; investedValue: number }[] = [];
  const benchmarkUnitHistory: { date: string; units: number }[] = [];
  const fundUnits = new Map<string, number>();
  const fundCost = new Map<string, number>();
  let totalInvested = 0;
  let benchmarkUnits = 0;

  for (const fund of funds) {
    unitHistory.set(fund.id, []);
    fundUnits.set(fund.id, 0);
    fundCost.set(fund.id, 0);
  }

  for (const tx of sortedTransactions) {
    const date = tx.transaction_date;
    const previousUnits = fundUnits.get(tx.fund_id) ?? 0;
    const previousCost = fundCost.get(tx.fund_id) ?? 0;
    const closeValue = benchmarkValueAt(date);

    if (isInvestment(tx.transaction_type)) {
      const nextUnits = previousUnits + tx.units;
      const nextCost = previousCost + tx.amount;
      fundUnits.set(tx.fund_id, nextUnits);
      fundCost.set(tx.fund_id, nextCost);
      totalInvested += tx.amount;
      if (closeValue && closeValue > 0) {
        benchmarkUnits += tx.amount / closeValue;
      }
    } else if (isRedemption(tx.transaction_type)) {
      const averageCost = previousUnits > 0 ? previousCost / previousUnits : 0;
      const costBasis = tx.units * averageCost;
      const nextUnits = Math.max(0, previousUnits - tx.units);
      const nextCost = Math.max(0, previousCost - costBasis);
      fundUnits.set(tx.fund_id, nextUnits);
      fundCost.set(tx.fund_id, nextCost);
      totalInvested = Math.max(0, totalInvested - costBasis);
      if (closeValue && closeValue > 0) {
        benchmarkUnits = Math.max(0, benchmarkUnits - (tx.amount / closeValue));
      }
    }

    unitHistory.get(tx.fund_id)!.push({ date, units: fundUnits.get(tx.fund_id) ?? 0 });
    investedHistory.push({ date, investedValue: totalInvested });
    benchmarkUnitHistory.push({ date, units: benchmarkUnits });
    allDates.add(date);
    const schemeCode = schemeByFund.get(tx.fund_id);
    if (schemeCode !== undefined && navByScheme.get(schemeCode)?.has(date)) allDates.add(date);
  }

  const rawPoints: InvestmentVsBenchmarkPoint[] = [];
  for (const date of [...allDates].sort()) {
    let portfolioValue = 0;
    let hasPortfolioValue = false;

    for (const fund of funds) {
      const units = getUnitsAt(unitHistory.get(fund.id) ?? [], date);
      if (units <= 0) continue;
      const nav = navByScheme.get(fund.schemeCode)?.get(date);
      if (nav === undefined) continue;
      portfolioValue += units * nav;
      hasPortfolioValue = true;
    }

    const benchmarkClose = benchmarkValueAt(date);
    const simulatedBenchmarkUnits = getBenchmarkUnitsAt(benchmarkUnitHistory, date);
    const investedValue = getInvestedAt(investedHistory, date);

    if (
      hasPortfolioValue &&
      portfolioValue > 0 &&
      investedValue > 0 &&
      benchmarkClose !== null &&
      simulatedBenchmarkUnits > 0
    ) {
      rawPoints.push({
        date,
        investedValue,
        portfolioValue,
        benchmarkValue: simulatedBenchmarkUnits * benchmarkClose,
      });
    }
  }

  const filteredPoints = filterToWindow(
    rawPoints.map((point) => ({ date: point.date, value: point.portfolioValue })),
    window,
  );
  const firstDate = filteredPoints[0]?.date;
  if (!firstDate) return { points: [], xAxisLabels: [] };

  const sampled = samplePoints(rawPoints.filter((point) => point.date >= firstDate));
  return {
    points: sampled,
    xAxisLabels: buildXAxisLabels(sampled.map((point) => point.date)),
  };
}

export async function fetchInvestmentVsBenchmarkTimeline(
  funds: FundRef[],
  userId: string,
  benchmarkSymbol: string,
  window: TimeWindow,
): Promise<{ points: InvestmentVsBenchmarkPoint[]; xAxisLabels: string[] }> {
  const fundIds = funds.map((fund) => fund.id);
  const schemeCodes = funds.map((fund) => fund.schemeCode);

  const [navResult, txResult, idxResult] = await Promise.all([
    supabase
      .from('nav_history')
      .select('scheme_code, nav_date, nav')
      .in('scheme_code', schemeCodes)
      .order('nav_date', { ascending: false })
      .limit(10000),
    supabase
      .from('transaction')
      .select('fund_id, transaction_date, transaction_type, units, amount')
      .eq('user_id', userId)
      .in('fund_id', fundIds)
      .order('transaction_date', { ascending: true }),
    supabase
      .from('index_history')
      .select('index_date, close_value')
      .eq('index_symbol', benchmarkSymbol)
      .order('index_date', { ascending: false })
      .limit(10000),
  ]);

  if (navResult.error) throw navResult.error;
  if (txResult.error) throw txResult.error;
  if (idxResult.error) throw idxResult.error;

  return computeInvestmentVsBenchmarkTimeline(
    (navResult.data ?? []) as RawNavRow[],
    (txResult.data ?? []) as RawTxRow[],
    (idxResult.data ?? []) as RawIdxRow[],
    funds,
    window,
  );
}

export function useInvestmentVsBenchmarkTimeline(
  funds: FundRef[],
  userId: string | undefined,
  benchmarkSymbol: string,
  window: TimeWindow,
): InvestmentVsBenchmarkTimeline {
  const fundKey = funds.map((fund) => fund.id).sort().join(',');
  const { data, isLoading, error } = useQuery({
    queryKey: ['investmentVsBenchmarkTimeline', userId, fundKey, benchmarkSymbol, window],
    enabled: funds.length > 0 && !!userId,
    queryFn: () => fetchInvestmentVsBenchmarkTimeline(funds, userId!, benchmarkSymbol, window),
    staleTime: 5 * 60 * 1000,
  });

  return {
    points: data?.points ?? [],
    xAxisLabels: data?.xAxisLabels ?? [],
    isLoading,
    error: error ? String(error) : null,
  };
}

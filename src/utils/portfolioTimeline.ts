import { filterToWindow, type NavPoint } from '@/src/utils/navUtils';

export type PortfolioTimelineWindow = '1Y' | '3Y';

export interface TimelineFundRow {
  id: string;
  scheme_code: number;
}

export interface TimelineTxRow {
  fund_id: string;
  transaction_date: string;
  transaction_type: string;
  units: number;
}

export interface TimelineNavRow {
  scheme_code: number;
  nav_date: string;
  nav: number;
}

export interface TimelineIndexRow {
  index_date: string;
  close_value: number;
}

export interface PortfolioTimelinePoint {
  date: string;
  portfolioValue: number;
  benchmarkValue: number;
  portfolioIndexed: number;
  benchmarkIndexed: number;
}

export interface PortfolioTimelineData {
  points: PortfolioTimelinePoint[];
}

function unitDelta(tx: TimelineTxRow): number {
  if (
    tx.transaction_type === 'purchase' ||
    tx.transaction_type === 'switch_in' ||
    tx.transaction_type === 'dividend_reinvest'
  ) {
    return tx.units;
  }
  if (tx.transaction_type === 'redemption' || tx.transaction_type === 'switch_out') {
    return -tx.units;
  }
  return 0;
}

export function buildPortfolioTimelineSeries(params: {
  funds: TimelineFundRow[];
  transactions: TimelineTxRow[];
  navRows: TimelineNavRow[];
  indexRows: TimelineIndexRow[];
  window: PortfolioTimelineWindow;
}): PortfolioTimelineData {
  const benchmarkHistory: NavPoint[] = params.indexRows.map((row) => ({
    date: row.index_date,
    value: row.close_value,
  }));
  const filteredBenchmark = filterToWindow(benchmarkHistory, params.window);

  if (filteredBenchmark.length === 0 || params.funds.length === 0) {
    return { points: [] };
  }

  const txByFund = new Map<string, TimelineTxRow[]>();
  for (const tx of [...params.transactions].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))) {
    const existing = txByFund.get(tx.fund_id) ?? [];
    existing.push(tx);
    txByFund.set(tx.fund_id, existing);
  }

  const navByScheme = new Map<number, NavPoint[]>();
  for (const row of [...params.navRows].sort((a, b) => a.nav_date.localeCompare(b.nav_date))) {
    const existing = navByScheme.get(row.scheme_code) ?? [];
    existing.push({ date: row.nav_date, value: row.nav });
    navByScheme.set(row.scheme_code, existing);
  }

  const fundState = params.funds.map((fund) => ({
    ...fund,
    txs: txByFund.get(fund.id) ?? [],
    txIndex: 0,
    unitsHeld: 0,
    navs: navByScheme.get(fund.scheme_code) ?? [],
    navIndex: 0,
    latestNav: null as number | null,
  }));

  const rawPoints = filteredBenchmark.map((benchPoint) => {
    let portfolioValue = 0;

    for (const fund of fundState) {
      while (
        fund.txIndex < fund.txs.length &&
        fund.txs[fund.txIndex].transaction_date <= benchPoint.date
      ) {
        fund.unitsHeld = Math.max(0, fund.unitsHeld + unitDelta(fund.txs[fund.txIndex]));
        fund.txIndex += 1;
      }

      while (
        fund.navIndex < fund.navs.length &&
        fund.navs[fund.navIndex].date <= benchPoint.date
      ) {
        fund.latestNav = fund.navs[fund.navIndex].value;
        fund.navIndex += 1;
      }

      if (fund.unitsHeld > 0 && fund.latestNav != null) {
        portfolioValue += fund.unitsHeld * fund.latestNav;
      }
    }

    return {
      date: benchPoint.date,
      portfolioValue,
      benchmarkValue: benchPoint.value,
    };
  });

  const firstValid = rawPoints.find((point) => point.portfolioValue > 0 && point.benchmarkValue > 0);
  if (!firstValid) return { points: [] };

  const trimmed = rawPoints.filter((point) => point.date >= firstValid.date);

  return {
    points: trimmed.map((point) => ({
      ...point,
      portfolioIndexed: (point.portfolioValue / firstValid.portfolioValue) * 100,
      benchmarkIndexed: (point.benchmarkValue / firstValid.benchmarkValue) * 100,
    })),
  };
}

import type { Transaction } from '@/src/utils/xirr';

export interface SimulationInputs {
  startingCorpus: number;
  monthlyContribution: number;
  oneTimeTopUp: number;
  annualReturnPct: number;
  years: number;
}

export interface SimulationSummary {
  terminalValue: number;
  investedCapital: number;
  wealthGain: number;
}

export interface SimulationPoint {
  year: number;
  baselineValue: number;
  scenarioValue: number;
}

export interface PersonalizedSimulationBaseline {
  currentCorpus: number;
  currentXirrPct: number | null;
  monthlySip: number;
  monthlyNetContribution: number;
  annualReturnPct: number;
  trailingLumpSumAverage: number;
  annualRedemptionRate: number;
}

function monthlyRate(annualReturnPct: number) {
  return annualReturnPct / 100 / 12;
}

function projectFutureValue(
  startingCorpus: number,
  monthlyContribution: number,
  oneTimeTopUp: number,
  annualReturnPct: number,
  years: number,
) {
  const months = years * 12;
  const rate = monthlyRate(annualReturnPct);
  let value = startingCorpus + oneTimeTopUp;

  for (let month = 0; month < months; month += 1) {
    value = value * (1 + rate) + monthlyContribution;
  }

  return value;
}

export function buildSimulationSummary(inputs: SimulationInputs): SimulationSummary {
  const terminalValue = projectFutureValue(
    inputs.startingCorpus,
    inputs.monthlyContribution,
    inputs.oneTimeTopUp,
    inputs.annualReturnPct,
    inputs.years,
  );
  const investedCapital =
    inputs.startingCorpus + inputs.oneTimeTopUp + inputs.monthlyContribution * inputs.years * 12;
  return {
    terminalValue,
    investedCapital,
    wealthGain: terminalValue - investedCapital,
  };
}

export function buildSimulationTimeline(params: {
  startingCorpus: number;
  baselineContribution: number;
  scenarioContribution: number;
  scenarioTopUp: number;
  annualReturnPct: number;
  years: number;
}): SimulationPoint[] {
  const points: SimulationPoint[] = [];

  for (let year = 1; year <= params.years; year += 1) {
    points.push({
      year,
      baselineValue: projectFutureValue(
        params.startingCorpus,
        params.baselineContribution,
        0,
        params.annualReturnPct,
        year,
      ),
      scenarioValue: projectFutureValue(
        params.startingCorpus,
        params.scenarioContribution,
        params.scenarioTopUp,
        params.annualReturnPct,
        year,
      ),
    });
  }

  return points;
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function sortNumbersAsc(values: number[]) {
  return [...values].sort((a, b) => a - b);
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = sortNumbersAsc(values);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function clampAnnualReturn(value: number) {
  return Math.max(-10, Math.min(25, value));
}

function transactionContribution(tx: Transaction) {
  if (
    tx.transaction_type === 'purchase' ||
    tx.transaction_type === 'switch_in' ||
    tx.transaction_type === 'dividend_reinvest' ||
    tx.transaction_type === 'dividend_reinvestment'
  ) {
    return tx.amount;
  }

  if (tx.transaction_type === 'redemption' || tx.transaction_type === 'switch_out') {
    return -tx.amount;
  }

  return 0;
}

export function buildPersonalizedSimulationBaseline(params: {
  transactions: Transaction[];
  currentCorpus: number;
  portfolioXirr: number;
}): PersonalizedSimulationBaseline {
  const monthlyTotals = new Map<string, { purchases: number; redemptions: number; net: number }>();

  for (const tx of params.transactions) {
    const key = monthKey(tx.transaction_date);
    const existing = monthlyTotals.get(key) ?? { purchases: 0, redemptions: 0, net: 0 };
    const amount = transactionContribution(tx);

    if (amount > 0) existing.purchases += amount;
    if (amount < 0) existing.redemptions += Math.abs(amount);
    existing.net += amount;

    monthlyTotals.set(key, existing);
  }

  const recentMonths = [...monthlyTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  const purchaseMonths = recentMonths.map(([, month]) => month.purchases).filter((value) => value > 0);
  const netMonths = recentMonths.map(([, month]) => month.net);
  const redemptionMonths = recentMonths.map(([, month]) => month.redemptions);
  const monthlySip = median(purchaseMonths) || Math.max(0, median(netMonths));
  const monthlyNetContribution = netMonths.length
    ? netMonths.reduce((sum, value) => sum + value, 0) / netMonths.length
    : monthlySip;
  const trailingLumpSums = purchaseMonths.filter((value) => value > monthlySip * 1.35);
  const currentXirrPct = Number.isFinite(params.portfolioXirr) ? params.portfolioXirr * 100 : null;
  const annualReturnPct = currentXirrPct != null ? clampAnnualReturn(currentXirrPct) : 12;

  return {
    currentCorpus: params.currentCorpus,
    currentXirrPct,
    monthlySip: Math.round(monthlySip),
    monthlyNetContribution: Math.round(monthlyNetContribution),
    annualReturnPct,
    trailingLumpSumAverage: trailingLumpSums.length
      ? Math.round(trailingLumpSums.reduce((sum, value) => sum + value, 0) / trailingLumpSums.length)
      : 0,
    annualRedemptionRate: Math.round(
      (redemptionMonths.reduce((sum, value) => sum + value, 0) / Math.max(redemptionMonths.length, 1)) * 12,
    ),
  };
}

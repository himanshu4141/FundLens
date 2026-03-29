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
  const points: SimulationPoint[] = [
    {
      year: 0,
      baselineValue: params.startingCorpus,
      scenarioValue: params.startingCorpus,
    },
  ];

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

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function parseDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function monthDiff(startMonth: string, endMonth: string) {
  const start = parseDate(`${startMonth}-01`);
  const end = parseDate(`${endMonth}-01`);
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function dayOfMonth(date: string) {
  return parseDate(date).getDate();
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

type SimulatorTransaction = Transaction & { fund_id?: string | null };

function isCashPurchase(tx: SimulatorTransaction) {
  return tx.transaction_type === 'purchase' && tx.amount > 0;
}

function isCashRedemption(tx: SimulatorTransaction) {
  return tx.transaction_type === 'redemption' && tx.amount > 0;
}

function amountBucket(amount: number) {
  if (amount <= 0) return 0;
  if (amount >= 100000) return Math.round(amount / 5000) * 5000;
  return Math.round(amount / 1000) * 1000;
}

interface SipCandidate {
  fundId: string;
  amountBucket: number;
  anchorDay: number;
  monthlyAmounts: number[];
  matchedMonths: string[];
  matchedTransactionKeys: string[];
}

function buildRecurringSipCandidates(transactions: SimulatorTransaction[]) {
  const purchases = transactions.filter(isCashPurchase);
  if (!purchases.length) return [] as SipCandidate[];

  const latestMonth = purchases[purchases.length - 1].transaction_date.slice(0, 7);
  const recentMonths = [...new Set(purchases.map((tx) => monthKey(tx.transaction_date)))]
    .filter((month) => monthDiff(month, latestMonth) >= 0 && monthDiff(month, latestMonth) < 6)
    .sort();

  const recentPurchases = purchases.filter((tx) => recentMonths.includes(monthKey(tx.transaction_date)));
  const purchasesByFund = new Map<string, SimulatorTransaction[]>();

  for (const tx of recentPurchases) {
    const fundId = tx.fund_id ?? 'unknown';
    const fundTxs = purchasesByFund.get(fundId) ?? [];
    fundTxs.push(tx);
    purchasesByFund.set(fundId, fundTxs);
  }

  const candidates: SipCandidate[] = [];

  for (const [fundId, fundTxs] of purchasesByFund.entries()) {
    const byAmountBucket = new Map<number, SimulatorTransaction[]>();

    for (const tx of fundTxs) {
      const bucket = amountBucket(tx.amount);
      const bucketTxs = byAmountBucket.get(bucket) ?? [];
      bucketTxs.push(tx);
      byAmountBucket.set(bucket, bucketTxs);
    }

    for (const [bucket, bucketTxs] of byAmountBucket.entries()) {
      const sorted = [...bucketTxs].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
      const days = sorted.map((tx) => dayOfMonth(tx.transaction_date));
      const anchorDay = Math.round(median(days));
      const bestByMonth = new Map<string, SimulatorTransaction>();

      for (const tx of sorted) {
        const month = monthKey(tx.transaction_date);
        if (Math.abs(dayOfMonth(tx.transaction_date) - anchorDay) > 3) continue;

        const existing = bestByMonth.get(month);
        if (!existing) {
          bestByMonth.set(month, tx);
          continue;
        }

        if (Math.abs(tx.amount - bucket) < Math.abs(existing.amount - bucket)) {
          bestByMonth.set(month, tx);
        }
      }

      if (bestByMonth.size < 4) continue;

      candidates.push({
        fundId,
        amountBucket: bucket,
        anchorDay,
        monthlyAmounts: [...bestByMonth.values()].map((tx) => tx.amount),
        matchedMonths: [...bestByMonth.keys()].sort(),
        matchedTransactionKeys: [...bestByMonth.values()].map(
          (tx) => `${fundId}:${tx.transaction_date}:${amountBucket(tx.amount)}`,
        ),
      });
    }
  }

  return candidates;
}

export function buildPersonalizedSimulationBaseline(params: {
  transactions: SimulatorTransaction[];
  currentCorpus: number;
  portfolioXirr: number;
}): PersonalizedSimulationBaseline {
  const monthlyTotals = new Map<string, { purchases: number; redemptions: number; net: number }>();

  for (const tx of params.transactions) {
    const key = monthKey(tx.transaction_date);
    const existing = monthlyTotals.get(key) ?? { purchases: 0, redemptions: 0, net: 0 };

    if (isCashPurchase(tx)) {
      existing.purchases += tx.amount;
      existing.net += tx.amount;
    } else if (isCashRedemption(tx)) {
      existing.redemptions += tx.amount;
      existing.net -= tx.amount;
    }

    monthlyTotals.set(key, existing);
  }

  const recentMonths = [...monthlyTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  const netMonths = recentMonths.map(([, month]) => month.net);
  const redemptionMonths = recentMonths.map(([, month]) => month.redemptions);
  const recentPurchaseMonths = [...recentMonths];
  if (
    recentPurchaseMonths.length >= 5 &&
    recentPurchaseMonths[recentPurchaseMonths.length - 1]?.[0] === currentMonthKey()
  ) {
    recentPurchaseMonths.pop();
  }
  const recurringSipCandidates = buildRecurringSipCandidates(params.transactions);
  const recurringSipTotal = recurringSipCandidates.reduce(
    (sum, candidate) => sum + median(candidate.monthlyAmounts),
    0,
  );
  const typicalPurchaseMedian = median(
    recentPurchaseMonths
      .map(([, month]) => month.purchases)
      .filter((value) => value > 0),
  );
  const fallbackSip = Math.max(10_000, median(netMonths.filter((value) => value > 0)));
  const monthlySip =
    recurringSipTotal > 0 && typicalPurchaseMedian > 0
      ? Math.min(recurringSipTotal, typicalPurchaseMedian)
      : recurringSipTotal || typicalPurchaseMedian || fallbackSip;
  const monthlyNetContribution = netMonths.length
    ? netMonths.reduce((sum, value) => sum + value, 0) / netMonths.length
    : monthlySip;

  const recurringTransactionKeys = new Set(
    recurringSipCandidates.flatMap((candidate) =>
      candidate.matchedTransactionKeys,
    ),
  );
  const trailingLumpSums = params.transactions
    .filter(
      (tx) =>
        isCashPurchase(tx) &&
        recentMonths.some(([month]) => month === monthKey(tx.transaction_date)) &&
        !recurringTransactionKeys.has(
          `${tx.fund_id ?? 'unknown'}:${tx.transaction_date}:${amountBucket(tx.amount)}`,
        ),
    )
    .map((tx) => tx.amount)
    .filter((amount) => amount >= Math.max(5000, monthlySip * 0.2));

  const currentXirrPct = Number.isFinite(params.portfolioXirr) ? params.portfolioXirr * 100 : null;
  const annualReturnPct = currentXirrPct != null
    ? Math.round(clampAnnualReturn(currentXirrPct) * 10) / 10
    : 12;

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

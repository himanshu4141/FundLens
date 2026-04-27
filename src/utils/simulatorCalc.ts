export type ProjectionPoint = { year: number; value: number };

export interface RetirementProjection {
  retirementCorpus: number;
  annualWithdrawal: number;
  monthlyIncome: number;
  endCorpus: number;
  depletionYear: number | null;
  riskLabel: 'Conservative' | 'Moderate' | 'Aggressive';
  trajectory: ProjectionPoint[];
}

function clampCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function clampYears(value: number, fallback = 1): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.round(value));
}

function projectValueAtMonths(
  monthlySip: number,
  initialCorpus: number,
  annualRate: number,
  months: number,
  additionalTopUp = 0,
): number {
  const safeSip = clampCurrency(monthlySip);
  const safeCorpus = clampCurrency(initialCorpus);
  const safeTopUp = clampCurrency(additionalTopUp);
  const safeRate = clampPercent(annualRate);
  const startingValue = safeCorpus + safeTopUp;

  if (safeRate === 0) {
    return Math.round(startingValue + safeSip * months);
  }

  const monthlyRate = safeRate / 12 / 100;
  const growth = Math.pow(1 + monthlyRate, months);
  const sipFutureValue = safeSip * ((growth - 1) / monthlyRate);
  return Math.round(startingValue * growth + sipFutureValue);
}

/**
 * Project future wealth using an initial corpus, optional year-0 top-up,
 * and monthly SIP contribution. Returns one data point per year.
 */
export function projectWealth(
  monthlySip: number,
  initialCorpus: number,
  annualRate: number,
  years: number,
  additionalTopUp = 0,
): ProjectionPoint[] {
  const safeYears = clampYears(years);
  const points: ProjectionPoint[] = [];

  for (let year = 1; year <= safeYears; year++) {
    points.push({
      year,
      value: projectValueAtMonths(
        monthlySip,
        initialCorpus,
        annualRate,
        year * 12,
        additionalTopUp,
      ),
    });
  }

  return points;
}

/**
 * Extract milestone values at years 5, 10, 15, and the full horizon.
 */
export function getMilestones(
  points: ProjectionPoint[],
): { year: number; value: number }[] {
  const horizon = points[points.length - 1]?.year ?? 0;
  const wantYears = Array.from(new Set([5, 10, 15, horizon])).filter(
    (year) => year <= horizon,
  );

  return wantYears
    .map((year) => points.find((point) => point.year === year))
    .filter((point): point is ProjectionPoint => point !== undefined);
}

export function toPresentValueEquivalent(
  futureValue: number,
  inflationRate: number,
  years: number,
): number {
  const safeFutureValue = clampCurrency(futureValue);
  const safeInflation = clampPercent(inflationRate);
  const safeYears = Math.max(0, Math.round(years));

  if (safeInflation === 0 || safeYears === 0) {
    return Math.round(safeFutureValue);
  }

  return Math.round(safeFutureValue / Math.pow(1 + safeInflation / 100, safeYears));
}

export function projectRetirementIncome(
  retirementCorpus: number,
  withdrawalRate: number,
  retirementYears: number,
  postRetirementReturn: number,
): RetirementProjection {
  const safeCorpus = clampCurrency(retirementCorpus);
  const safeWithdrawalRate = clampPercent(withdrawalRate);
  const safeRetirementYears = clampYears(retirementYears);
  const safePostRetirementReturn = clampPercent(postRetirementReturn);

  const annualWithdrawal = safeCorpus * (safeWithdrawalRate / 100);
  const monthlyIncome = annualWithdrawal / 12;
  const annualReturnFactor = 1 + safePostRetirementReturn / 100;

  let balance = safeCorpus;
  let depletionYear: number | null = null;
  const trajectory: ProjectionPoint[] = [{ year: 0, value: Math.round(safeCorpus) }];

  for (let year = 1; year <= safeRetirementYears; year++) {
    balance = balance * annualReturnFactor - annualWithdrawal;
    if (balance <= 0) {
      balance = 0;
      depletionYear = year;
      trajectory.push({ year, value: 0 });
      break;
    }
    trajectory.push({ year, value: Math.round(balance) });
  }

  let riskLabel: RetirementProjection['riskLabel'] = 'Moderate';
  if (safeWithdrawalRate <= 3.5) {
    riskLabel = 'Conservative';
  } else if (safeWithdrawalRate >= 5.5 || safeWithdrawalRate > safePostRetirementReturn + 1) {
    riskLabel = 'Aggressive';
  }

  return {
    retirementCorpus: Math.round(safeCorpus),
    annualWithdrawal: Math.round(annualWithdrawal),
    monthlyIncome: Math.round(monthlyIncome),
    endCorpus: Math.round(balance),
    depletionYear,
    riskLabel,
    trajectory,
  };
}

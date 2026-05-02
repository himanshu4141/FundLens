import type { GoalReturnPreset, ReturnAssumptions } from '@/src/store/appStore';

export type { GoalReturnPreset };

// Default rates match DEFAULT_RETURN_ASSUMPTIONS in appStore (percentages → decimals)
export const GOAL_RETURN_PRESET_RATES: Record<GoalReturnPreset, number> = {
  cautious: 0.08,
  balanced: 0.12,
  growth: 0.12,
};

export function assumptionsToRates(
  assumptions: ReturnAssumptions,
): Record<GoalReturnPreset, number> {
  return {
    cautious: assumptions.cautious / 100,
    balanced: assumptions.balanced / 100,
    growth: assumptions.growth / 100,
  };
}

export interface GoalPlanInput {
  targetAmount: number;
  years: number;
  lumpSum: number;
  currentMonthly: number;
  returnPreset: GoalReturnPreset;
}

export interface GoalPlanResult {
  requiredMonthly: number;
  gap: number;
  onTrack: boolean;
  fvLumpSum: number;
  projectedCorpus: number;
}

export interface ProjectionPoint {
  month: number;
  invested: number;
  corpus: number;
}

export function computeGoalPlan(
  input: GoalPlanInput,
  rates = GOAL_RETURN_PRESET_RATES,
): GoalPlanResult {
  const { targetAmount, years, lumpSum, currentMonthly, returnPreset } = input;
  const months = Math.round(Math.max(0, years) * 12);
  const monthlyRate = rates[returnPreset] / 12;
  const safeLumpSum = Math.max(0, lumpSum);
  const safeCurrentMonthly = Math.max(0, currentMonthly);
  const safeTarget = Math.max(0, targetAmount);

  if (months <= 0 || safeTarget <= 0) {
    return {
      requiredMonthly: 0,
      gap: -safeCurrentMonthly,
      onTrack: true,
      fvLumpSum: safeLumpSum,
      projectedCorpus: safeLumpSum,
    };
  }

  const fvLumpSum =
    monthlyRate === 0
      ? safeLumpSum
      : safeLumpSum * Math.pow(1 + monthlyRate, months);

  const remaining = safeTarget - fvLumpSum;

  let requiredMonthly = 0;
  if (remaining > 0) {
    requiredMonthly =
      monthlyRate === 0
        ? remaining / months
        : (remaining * monthlyRate) / (Math.pow(1 + monthlyRate, months) - 1);
  }

  const fvSip =
    monthlyRate === 0
      ? requiredMonthly * months
      : (requiredMonthly * (Math.pow(1 + monthlyRate, months) - 1)) / monthlyRate;

  return {
    requiredMonthly: Math.max(0, requiredMonthly),
    gap: requiredMonthly - safeCurrentMonthly,
    onTrack: requiredMonthly - safeCurrentMonthly <= 0,
    fvLumpSum,
    projectedCorpus: fvLumpSum + fvSip,
  };
}

export function yearsFromNow(targetDate: string, now = new Date()): number {
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return 0;
  const ms = target.getTime() - now.getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24 * 365.25));
}

export function buildGoalProjectionSeries(
  input: GoalPlanInput,
  requiredMonthly: number,
  rates = GOAL_RETURN_PRESET_RATES,
): ProjectionPoint[] {
  const { years, lumpSum, returnPreset } = input;
  const months = Math.round(Math.max(0, years) * 12);
  const monthlyRate = rates[returnPreset] / 12;
  const safeLumpSum = Math.max(0, lumpSum);
  const safeRequired = Math.max(0, requiredMonthly);

  if (months === 0) {
    return [{ month: 0, invested: safeLumpSum, corpus: safeLumpSum }];
  }

  const step = Math.max(1, Math.ceil(months / 60));
  const points: ProjectionPoint[] = [];

  for (let m = 0; m <= months; m += step) {
    points.push(makeProjectionPoint(m, safeLumpSum, safeRequired, monthlyRate));
  }

  if (points[points.length - 1].month !== months) {
    points.push(makeProjectionPoint(months, safeLumpSum, safeRequired, monthlyRate));
  }

  return points;
}

function makeProjectionPoint(
  m: number,
  lumpSum: number,
  monthly: number,
  monthlyRate: number,
): ProjectionPoint {
  const invested = lumpSum + monthly * m;
  const fvLump = monthlyRate === 0 ? lumpSum : lumpSum * Math.pow(1 + monthlyRate, m);
  const fvSip =
    m === 0 || monthlyRate === 0
      ? monthly * m
      : (monthly * (Math.pow(1 + monthlyRate, m) - 1)) / monthlyRate;
  return { month: m, invested, corpus: fvLump + fvSip };
}

import type { NavPoint } from '@/src/utils/navUtils';

export interface QuarterlyReturn {
  label: string;
  returnPct: number;
}

export function buildQuarterlyReturns(navHistory: NavPoint[]): QuarterlyReturn[] {
  if (navHistory.length < 2) return [];

  const quarterEndByKey = new Map<string, NavPoint>();
  for (const point of navHistory) {
    const [year, month] = point.date.split('-');
    const quarter = Math.floor((parseInt(month, 10) - 1) / 3) + 1;
    quarterEndByKey.set(`${year}-Q${quarter}`, point);
  }

  const ordered = [...quarterEndByKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, point]) => ({ key, point }));

  const results: QuarterlyReturn[] = [];
  for (let i = 1; i < ordered.length; i += 1) {
    const prev = ordered[i - 1];
    const current = ordered[i];
    if (prev.point.value <= 0) continue;
    results.push({
      label: current.key.replace('-', ' '),
      returnPct: ((current.point.value - prev.point.value) / prev.point.value) * 100,
    });
  }

  return results.slice(-6);
}

export interface PortfolioImpact {
  sharePct: number;
  rank: number;
  holdingCount: number;
}

export function computePortfolioImpact(params: {
  currentValue: number | null;
  holdingValues: number[];
}): PortfolioImpact | null {
  if (params.currentValue == null || params.currentValue <= 0 || params.holdingValues.length === 0) {
    return null;
  }

  const total = params.holdingValues.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;

  const sorted = [...params.holdingValues].sort((a, b) => b - a);
  const rank = sorted.findIndex((value) => value === params.currentValue) + 1;

  return {
    sharePct: (params.currentValue / total) * 100,
    rank: rank > 0 ? rank : sorted.length,
    holdingCount: sorted.length,
  };
}

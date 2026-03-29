import type { NavPoint } from './navUtils';

export type QuarterBar = {
  value: number;
  label: string;
  frontColor: string;
};

/**
 * Compute quarterly returns from a NAV history series (ascending by date).
 * Caps at the last 12 quarters (3 years) from the most recent NAV date.
 * Returns an empty array if fewer than 2 quarters with data are found.
 */
export function computeQuarterlyReturns(
  navHistory: NavPoint[],
  positiveColor: string,
  negativeColor: string,
): QuarterBar[] {
  if (navHistory.length < 2) return [];

  // Cap at last 3 years from latest nav date
  const lastDate = navHistory[navHistory.length - 1].date;
  const [lastYearStr, lastMonthStr] = lastDate.split('-');
  const lastYear = parseInt(lastYearStr, 10);
  const lastMonth = parseInt(lastMonthStr, 10);

  // Quarter start month for the current quarter (1-based)
  const currentQStartMonth = lastMonth - ((lastMonth - 1) % 3);
  // Cutoff: 3 full years before the start of the current quarter
  const cutoffYear = lastYear - 3;
  const cutoffMonth = currentQStartMonth; // same quarter offset, 3 years back

  // Group NAV points by "YYYY-QN" key
  const quarters: Record<string, NavPoint[]> = {};
  for (const point of navHistory) {
    const [yearStr, monthStr] = point.date.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    // Skip points before cutoff
    if (year < cutoffYear) continue;
    if (year === cutoffYear && month < cutoffMonth) continue;

    const q = Math.ceil(month / 3);
    const key = `${year}-Q${q}`;
    if (!quarters[key]) quarters[key] = [];
    quarters[key].push(point);
  }

  const sorted = Object.keys(quarters).sort();
  // Cap to last 12 quarters
  const capped = sorted.slice(-12);

  const bars: QuarterBar[] = [];
  for (const key of capped) {
    const pts = quarters[key].sort((a, b) => a.date.localeCompare(b.date));
    if (pts.length < 2) continue;
    const firstNav = pts[0].value;
    const lastNav = pts[pts.length - 1].value;
    if (firstNav === 0) continue;
    const ret = ((lastNav - firstNav) / firstNav) * 100;
    const [yearStr, qPart] = key.split('-');
    const yr2 = yearStr.slice(2);
    bars.push({
      value: parseFloat(ret.toFixed(2)),
      label: `${qPart}'${yr2}`,
      frontColor: ret >= 0 ? positiveColor : negativeColor,
    });
  }
  return bars;
}

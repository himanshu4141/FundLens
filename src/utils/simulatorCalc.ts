export type ProjectionPoint = { year: number; value: number };

/**
 * Project future wealth using the standard FV formula:
 *   FV = lumpsum * (1 + r)^n  +  SIP * ((1 + r)^n - 1) / r
 * where r = annualRate / 12 / 100 (monthly rate) and n = years * 12 (months).
 *
 * Returns one data point per year from year 1 to `years`.
 * All negative inputs are clamped to 0.
 */
export function projectWealth(
  sip: number,
  lumpsum: number,
  annualRate: number,
  years: number,
): ProjectionPoint[] {
  const safeSip = Math.max(0, sip);
  const safeLumpsum = Math.max(0, lumpsum);
  const safeRate = Math.max(0, annualRate);
  const safeYears = Math.max(1, Math.round(years));

  const points: ProjectionPoint[] = [];

  if (safeRate === 0) {
    // Linear growth — avoid 0/0 in the compound formula
    for (let year = 1; year <= safeYears; year++) {
      const n = year * 12;
      const value = Math.round(safeLumpsum + safeSip * n);
      points.push({ year, value });
    }
    return points;
  }

  const r = safeRate / 12 / 100; // monthly rate

  for (let year = 1; year <= safeYears; year++) {
    const n = year * 12;
    const growth = Math.pow(1 + r, n);
    const fv = safeLumpsum * growth + safeSip * (growth - 1) / r;
    points.push({ year, value: Math.round(fv) });
  }

  return points;
}

/**
 * Extract milestone values at years 5, 10, 15, and the full horizon.
 * De-duplicates if horizon coincides with a fixed milestone.
 */
export function getMilestones(
  points: ProjectionPoint[],
): { year: number; value: number }[] {
  const horizon = points[points.length - 1]?.year ?? 0;
  const wantYears = Array.from(new Set([5, 10, 15, horizon])).filter(
    (y) => y <= horizon,
  );
  return wantYears
    .map((y) => points.find((p) => p.year === y))
    .filter((p): p is ProjectionPoint => p !== undefined);
}

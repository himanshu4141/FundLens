/**
 * Pure nav-related utilities — no React Native or Supabase dependencies.
 * These are extracted here so they can be unit-tested in a Node environment.
 */

export type TimeWindow = '1M' | '3M' | '6M' | '1Y' | '3Y' | 'All';

export interface NavPoint {
  date: string;
  value: number;
}

/**
 * Filter any date-keyed series to a given time window.
 *
 * If the filtered result is empty (e.g. NAV data is older than the cutoff),
 * falls back to the full history so the chart always has something to render.
 */
export function filterToWindow<T extends { date: string }>(history: T[], window: TimeWindow): T[] {
  if (window === 'All' || history.length === 0) return history;

  const today = new Date();
  const cutoff = new Date(today);

  switch (window) {
    case '1M': cutoff.setMonth(today.getMonth() - 1); break;
    case '3M': cutoff.setMonth(today.getMonth() - 3); break;
    case '6M': cutoff.setMonth(today.getMonth() - 6); break;
    case '1Y': cutoff.setFullYear(today.getFullYear() - 1); break;
    case '3Y': cutoff.setFullYear(today.getFullYear() - 3); break;
  }

  const cutoffStr = cutoff.toISOString().split('T')[0];
  const filtered = history.filter((p) => p.date >= cutoffStr);
  // Fallback: if no data within the requested window, show all available data
  return filtered.length > 0 ? filtered : history;
}

/** Index a series to 100 at its first point (for relative comparison charts) */
export function indexTo100(history: NavPoint[]): NavPoint[] {
  if (history.length === 0) return [];
  const base = history[0].value;
  if (base === 0) return history;
  return history.map((p) => ({ date: p.date, value: (p.value / base) * 100 }));
}

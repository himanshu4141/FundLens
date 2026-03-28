# ExecPlan: Milestone 8 — UX Improvements

## Status
Complete

## Goal

Polish the portfolio experience with realized gains visibility, a configurable benchmark selector, a completely redesigned Compare screen (fund + index, % return chart, crosshair, legend toggles), and chart improvements (crosshair tooltip, date labels) on the Fund Detail screen.

## User Value

- **Realized gains** — users with partial/full redemptions see realized P&L alongside current value, so "current value < invested" is immediately understandable.
- **Benchmark selector** — users can switch the home screen market comparison from Nifty 50 to Nifty Bank, SENSEX, or Nifty IT with one tap. The selection persists for the session.
- **Compare redesign** — users can compare any mix of their funds and benchmark indexes on the same chart, with % return from 0 so the Y-axis is intuitive, crosshair tooltips for reading exact values, and legend toggles to show/hide individual lines.
- **Chart improvements** — fund detail charts now show a crosshair on touch and date labels on the X-axis so users can orient themselves in time.

## Context

Builds on Milestone 7. The app is fully functional. This milestone focuses on analytical depth and chart readability.

## Branch

`milestone/8-improvements` → targets `milestone/7-improvements`

## Scope

- `src/store/appStore.ts` — Zustand store with `defaultBenchmarkSymbol` and `BENCHMARK_OPTIONS` constant.
- `src/utils/xirr.ts` — `computeRealizedGains(transactions)` using average cost method.
- `src/hooks/usePortfolio.ts` — accept `benchmarkSymbol` param; add `realizedGain`/`redeemedUnits` to `FundCardData`.
- `src/hooks/usePerformanceTimeline.ts` — fetches raw NAV + index histories for any mix of funds and indexes; `buildTimelineSeries()` computes % return from common start.
- `app/(tabs)/index.tsx` — benchmark selector row; pass `defaultBenchmarkSymbol` to `usePortfolio`.
- `app/(tabs)/compare.tsx` — full redesign: unified fund+index selector, % return chart, crosshair, show/hide legend toggles, metrics table for funds.
- `app/fund/[id].tsx` — crosshair tooltip + date labels on both Performance and NAV History charts.

## Out of Scope

- Per-fund benchmark override on fund detail screen (fund uses its assigned `benchmark_index_symbol`).
- Persistent benchmark selection (resets on app restart — Zustand without persistence is fine for v1).
- More than 3 series in the Compare chart (gifted-charts hard limit of `data`/`data2`/`data3`).
- Saving or exporting comparisons.

## Approach

### computeRealizedGains

Average cost method: track running `totalUnits` and `totalCost`. On purchase, accumulate. On redemption, compute `avgCost = totalCost / totalUnits`, then `gain = redemption_amount - (units × avgCost)`. Reduce `totalCost` and `totalUnits` proportionally.

Returns `{ realizedGain, realizedAmount, redeemedUnits }`. `realizedGain` can be negative (loss on redemption).

### FundCard realized gain display

If `redeemedUnits > 0`, render a secondary row below the metrics strip:
```
Realized P&L: +₹12,345   (green if positive, red if negative)
```
Only shown when the user has actually redeemed units.

### Benchmark selector on home screen

```typescript
// appStore.ts
export const useAppStore = create<AppStore>((set) => ({
  defaultBenchmarkSymbol: '^NSEI',
  setDefaultBenchmarkSymbol: (symbol) => set({ defaultBenchmarkSymbol: symbol }),
}));
```

`usePortfolio(benchmarkSymbol)` includes `benchmarkSymbol` in `queryKey` so switching benchmark triggers a fresh fetch. The `PortfolioHeader` renders a horizontal row of benchmark pills (Nifty 50 / Nifty Bank / SENSEX / Nifty IT). Tapping one updates the Zustand store.

### usePerformanceTimeline

Two-pass fetch: one for fund NAV histories (by `scheme_code`), one for index histories (by `index_symbol`). Both in single `in` queries. Returns `TimelineEntry[]` — each entry has `{ type, id, name, history: NavPoint[] }`.

`buildTimelineSeries(entries, ids, window)`:
1. Filter each history to the time window.
2. Find `commonStart` = latest first-date across all series.
3. Trim all series to `commonStart`.
4. Use the longest series as the reference date list.
5. For each reference date, include only dates where ALL series have data.
6. Compute `% return = ((value / base) - 1) * 100` so Y-axis reads 0% at start.
7. Sample to 60 points for render performance.
8. Return `{ points: { value: number }[][], dates: string[] }` — `dates` parallel to `points[*]` for crosshair lookups.

### Compare screen redesign

**Selection model:**
```typescript
interface SelectedItem {
  type: 'fund' | 'index';
  id: string;          // fund ID or index symbol
  name: string;
  color: string;       // assigned from SERIES_COLORS when added
}
const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
```

Max 3 items total (any mix of funds and indexes). Colors assigned from a fixed pool:
- Position 0: `#1a56db` (blue)
- Position 1: `#16a34a` (green)
- Position 2: `#f59e0b` (amber)

The **Add modal** (`AddItemModal`) shows two sections:
1. **Your Funds** — user's active funds from Supabase
2. **Benchmark Indexes** — fixed list (Nifty 50, Nifty Bank, SENSEX, Nifty IT)

Already-selected IDs/symbols excluded from results.

**Chart:**
- `usePerformanceTimeline` for raw histories; `buildTimelineSeries` for % return points.
- `visibleItems = selectedItems.filter(id not in hiddenIds)` — rebuild `data`/`data2`/`data3` from visible items only.
- Fund lines: 2.5px solid. Index lines: 1.5px, slightly lighter color (append `'b0'` alpha to hex).
- `showStripOnFocus`, `showDataPointOnFocus`, `onFocus={(_, i) => setFocusedIndex(i)}` on first series.
- Tooltip overlay positioned at `left = (focusedIndex / (total-1)) * chartWidth`, clamped to bounds.

**Legend:**
- Each selected item (including hidden ones) shows as a row with colored dot, name, and eye icon toggle.
- Tapping toggles `hiddenIds`.

**Metrics table:**
- Only shown for fund items in `selectedItems`.
- Uses `useCompare(selectedFundIds)` for XIRR, 1Y return, NAV, category.

### Fund detail chart crosshair + date labels

In `PerformanceTab` and `NavHistoryTab`:
- Build `dates: string[]` parallel to chart points (from filtered+sampled history dates).
- Build `xAxisLabels: string[]` — 5 evenly-spaced formatted dates (e.g. `"Jan '24"`).
- Add `showStripOnFocus`, `showDataPointOnFocus`, `onFocus={(_, i) => setFocusedIndex(i)}`, `xAxisLabelTexts={xAxisLabels}` to `LineChart`.
- Absolute-positioned tooltip View shows `dates[focusedIndex]` + value.

## New Files

- `src/store/appStore.ts`
- `src/hooks/usePerformanceTimeline.ts`

## Modified Files

- `src/utils/xirr.ts` — add `computeRealizedGains`
- `src/hooks/usePortfolio.ts` — `benchmarkSymbol` param, `realizedGain`/`redeemedUnits` on `FundCardData`
- `app/(tabs)/index.tsx` — benchmark selector pills
- `app/(tabs)/compare.tsx` — full redesign
- `app/fund/[id].tsx` — crosshair + date labels

## Validation

    npm run typecheck   -- zero errors
    npm run lint        -- zero warnings

    # Home screen:
    # → benchmark pills visible below XIRR row
    # → tap "Nifty Bank" → market XIRR updates to Nifty Bank comparison
    # → fund with redemptions shows "Realized P&L: +₹X,XXX" on card

    # Compare screen:
    # → add fund → chip with blue color
    # → add Nifty 50 index → chip with green, chart shows 2 lines
    # → touch chart → crosshair strip + tooltip with date and % values
    # → tap eye icon on legend → line disappears; eye icon changes
    # → metrics table shows fund-only XIRR / 1Y / NAV / category rows

    # Fund detail:
    # → Performance tab → touch chart → crosshair + tooltip
    # → X-axis shows date labels (e.g. "Jan '24")
    # → NAV History tab → same behavior

## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| `onFocus` only fires for `data` (first series) in gifted-charts | Crosshair index from first series is used to read all other series' values at same index — works if all series have same length after sampling (guaranteed by `buildTimelineSeries`) |
| Index has no data for the selected time window | `buildTimelineSeries` returns empty `dates`/`points`; chart shows "No data" message |
| `usePortfolio` re-fetches every benchmark switch (staleTime: 5min) | Acceptable: benchmarks share the portfolio query and re-fetch is fast; can be optimized in a later milestone |
| Tooltip position overflows chart bounds | Left clamped to `[8, chartWidth - tooltipWidth - 8]` |

## Decision Log

- **% return from 0 (not indexed to 100)** — "20%" is more intuitive than "120" for a comparison chart. Both are mathematically equivalent; % is the user's natural mental model.
- **Dashed lines via lighter weight** — gifted-charts `LineChart` doesn't expose per-series `dashArray`; using 1.5px vs 2.5px + lighter color (hex + `b0` alpha) is a practical workaround that visually separates fund lines from index lines.
- **Zustand without persistence** — benchmark selection resets on restart. Persisting it would require AsyncStorage setup. Not worth it for v1.
- **`hiddenIds` vs removing items** — hiding keeps the item in the chips list so user can re-enable. Removing and re-adding would lose position/color consistency.

## Progress

- [x] Write `docs/plans/08-improvements.md`
- [x] Create `src/store/appStore.ts`
- [x] Add `computeRealizedGains` to `src/utils/xirr.ts`
- [x] Update `src/hooks/usePortfolio.ts`
- [x] Create `src/hooks/usePerformanceTimeline.ts`
- [x] Update `app/(tabs)/index.tsx`
- [x] Redesign `app/(tabs)/compare.tsx`
- [x] Update `app/fund/[id].tsx`
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero warnings

## Amendments (post-implementation)

### Test session 1 feedback — performance comparison rework (PR #32)

Several issues found during user testing changed the approach in `app/fund/[id].tsx`:

**Per-fund benchmark override (was Out of Scope):** User testing showed that locking the fund detail to its assigned `benchmark_index_symbol` was confusing — users wanted to compare against their preferred index. Scrollable benchmark selector pills added to `PerformanceTab`, driven by an internal `useQuery` per selected symbol. Initialised from `fund.benchmarkSymbol` if it matches a known `BENCHMARK_OPTIONS` entry, otherwise defaults to `^NSEI`.

**Period-consistent comparison (replaces XIRR card in Performance tab):** The original Milestone 8 plan left XIRR in the Performance tab and showed it alongside a benchmark period return — an apples-to-oranges comparison. Post-testing rework: XIRR moved to the fund header card; the comparison card now shows Fund (window) % vs Benchmark (window) %, both computed from the same `indexTo100` baseline and the same time window.

**Chart overflow fix:** Default gifted-charts `spacing` (60px per point) × 60 sampled points overflowed the container. Fixed by computing `spacing = chartBodyWidth / (n-1)`.

**Index alignment fix (`commonStart`):** When benchmark data started after the window cutoff, `nearestBenchmarkValue` returned the first indexed benchmark value (100) for all preceding dates, making the index appear flat while the fund grew. Fixed by clipping both series to `commonStart = max(navStart, idxStart)` before calling `indexTo100`.

**Supabase 1000-row ascending bug:** `usePerformanceTimeline` fetched `nav_history` and `index_history` with `ascending: true`, returning the oldest 1000 rows. For long-history indexes and multi-scheme NAV queries, this excluded all recent data. Changed to `ascending: false` + `.limit(5000)`, with per-group `.reverse()` after grouping to restore ascending order.


# M2 — Home Enhancements: Portfolio Chart + Gainers/Losers

## Context

The designer's concept shows two new sections on the Home screen that are currently missing:
1. **Portfolio vs Market line chart** — dual-line chart indexed to 100 at the start of the selected window, showing the user's blended portfolio return vs the selected benchmark
2. **Top Gainers / Losers row** — two-card row showing today's best and worst performing fund in the portfolio

Both sections sit between the existing portfolio header (total value / XIRR / daily change summary) and the fund list.

## Stack Position

`main` → M1 Nav → **[M2 Home ← you are here]** → M3 Leaderboard → M4 Fund Tech → M5 Fund Detail+ → M6 Simulator → M7 Theme

---

## Files Changed

| File | Change |
|---|---|
| `src/hooks/usePortfolioTimeline.ts` | New — computes daily blended portfolio value from transactions + nav history |
| `src/hooks/__tests__/usePortfolioTimeline.test.ts` | New — unit tests for the timeline hook logic |
| `app/(tabs)/index.tsx` | Add `PortfolioChart` section + `GainersLosers` section between header and fund list |

---

## Algorithm: usePortfolioTimeline

The hook must compute a time-series of the portfolio's total value indexed to 100, comparable with the benchmark.

### Data sources (already in DB)
- `nav_history` — daily NAV per scheme_code (same table used by `usePerformanceTimeline`)
- `transaction` — all buy/switch-in/sell/switch-out events with date, units, type, scheme_code
- `index_history` — benchmark index values (Nifty 50, Nifty 100, BSE Sensex) — same table as `usePerformanceTimeline`

### Algorithm

**Step 1 — Fetch raw data**
- Fetch all `nav_history` rows for the user's active scheme_codes, ordered ascending by date. Use `.limit(10000)` (multi-fund, multi-year). Join via the user's fund list (same pattern as `usePortfolio`).
- Fetch all `transaction` rows for the user, ordered ascending by date.
- Fetch all `index_history` rows for the selected benchmark symbol, ordered ascending by date.

**Step 2 — Build per-fund units step function**
For each fund (scheme_code), walk transactions chronologically:
```
unitsHeld[schemeCode] = 0
for each transaction (sorted ascending by date):
  if type is BUY or SWITCH_IN:  unitsHeld[schemeCode] += units
  if type is SELL or SWITCH_OUT: unitsHeld[schemeCode] -= units
```
This produces a cumulative units map per fund as of each transaction date.

**Step 3 — Build portfolio value time series**
For each NAV date D (across all funds, union of dates):
- For each fund, find the units held as of date D (last transaction on or before D, or 0 if no transactions yet)
- Multiply units × nav[D] for that fund, sum across all funds
- Result: `{ date: D, value: totalPortfolioValue }`

Only include dates where total value > 0 (i.e. after the first purchase).

**Step 4 — Filter to window and index**
- Apply `filterToWindow(portfolioPoints, window)` to restrict to the selected time window
- Find the common start date: `max(portfolioPoints[0].date, benchmarkPoints[0].date)`
- Trim both series to start at the common date
- Apply `indexTo100` to both series independently (each starts at 100)

**Step 5 — Build chart labels**
- Use `buildXAxisLabels` from `usePerformanceTimeline` logic (or inline equivalent) for the x-axis

### Return type
```ts
interface PortfolioTimelineResult {
  portfolioPoints: NavPoint[];      // indexed to 100
  benchmarkPoints: NavPoint[];      // indexed to 100
  xAxisLabels: string[];
  isLoading: boolean;
  error: string | null;
}
```

Hook signature:
```ts
function usePortfolioTimeline(
  schemeCodes: number[],
  benchmarkSymbol: string,
  window: TimeWindow
): PortfolioTimelineResult
```

Hook is disabled (returns empty + loading=false) when `schemeCodes` is empty.

---

## Home Screen Changes

### 2a. Portfolio vs Market chart

Insert between `<PortfolioHeader>` and the fund list section in `app/(tabs)/index.tsx`.

**Window selector**: 1Y | 3Y (only two options — longer windows have clearer trends for portfolio-level comparison; 1M/3M/6M charts are noisy at portfolio level). Default: `1Y`.

**Chart**: `LineChart` from `react-native-gifted-charts`
- `data={portfolioPoints}` (solid, `Colors.primary`)
- `data2={benchmarkPoints}` (dashed, `#f59e0b`)
- `height={160}`, `width={CHART_WIDTH - 32}`
- `curved`, `hideDataPoints`, `areaChart`
- No crosshair/pointer (keeps it simple — this is an overview chart, not the interactive fund detail chart)
- Legend row below: "● Your Portfolio" + "● Nifty 50" (or active benchmark)

**Loading state**: Show a skeleton placeholder (grey rounded rect, same height as chart) while `isLoading`.

**Empty/error state**: If `portfolioPoints.length === 0`, show nothing (hide the section entirely).

**Benchmark selector**: Reuse the existing benchmark pills pattern from `PortfolioHeader` — the `benchmarkSymbol` state is already managed in `index.tsx` (`BENCH_OPTIONS` + `activeBenchmark` state). Pass the same `activeBenchmark` into `usePortfolioTimeline`.

### 2b. Top Gainers / Losers

Insert below the portfolio chart, above the fund list header.

**Data**: Derived from `fundCards` — sort by `dailyChangePct` (nulls last), take first (max) and last (min).

**Only show when**: At least 2 funds AND both have non-null `dailyChangePct`.

**Layout**: Horizontal row, two equal-width cards side by side.

Each card shows:
- Label: "Today's Best" (green left border) or "Today's Worst" (red left border)
- Fund name (truncated to 1 line)
- Category
- Daily change %: formatted as "+1.23%" or "-0.45%"
- Daily change INR: formatted as "+₹1,234" or "-₹567"

Colors: positive uses `Colors.positive`, negative uses `Colors.negative`.

---

## Implementation Steps

### Step 1 — `src/hooks/usePortfolioTimeline.ts`
1. Create the file with the hook as described above
2. Use `useQuery` from `@tanstack/react-query` (same pattern as `usePerformanceTimeline`)
3. Query key: `['portfolioTimeline', userId, schemeCodes.join(','), benchmarkSymbol, window]`
4. The query fetches nav_history + transactions + index_history, computes the series, and returns the result

### Step 2 — `src/hooks/__tests__/usePortfolioTimeline.test.ts`
Tests must cover:
- Single fund: 100 units of a fund bought on day 0, NAV doubles by day N → portfolio value doubles, index at 200 on day N
- Two funds: partial sell of one fund reduces portfolio value correctly
- Zero transactions before first purchase date → no points returned for that period
- `filterToWindow` integration: 3Y window with only 1Y of data → falls back to full history
- `indexTo100` alignment: both portfolio and benchmark start at exactly 100
- Empty `schemeCodes` → returns empty arrays, no fetch attempted
- Benchmark points align to portfolio window dates (common start trimming)

### Step 3 — `app/(tabs)/index.tsx`
1. Add `window` state: `const [chartWindow, setChartWindow] = useState<'1Y' | '3Y'>('1Y')`
2. Call `usePortfolioTimeline(schemeCodes, activeBenchmark, chartWindow)` — extract `schemeCodes` from `fundCards`
3. Add `PortfolioChartSection` inline component or inline JSX between `<PortfolioHeader />` and fund list
4. Add `GainersLosersRow` inline JSX below the chart

---

## Verification Checklist

- [ ] Home screen shows Portfolio vs Market chart with 1Y/3Y toggle
- [ ] Chart lines: portfolio (solid blue) vs benchmark (dashed amber)
- [ ] Legend shows portfolio and benchmark labels
- [ ] Switching benchmark pills updates both the header stats AND the chart
- [ ] Switching 1Y/3Y window updates the chart
- [ ] Gainers/losers row shows below chart (only when 2+ funds with daily data)
- [ ] Gainers card has green left border; Losers card has red left border
- [ ] Loading state shows skeleton placeholder
- [ ] `npm run typecheck && npm run lint && npm test` all pass with zero errors/warnings
- [ ] Playwright: navigate to Portfolio tab, verify chart renders, verify gainers/losers visible

---

## Test Cases

See Step 2 above. Test file: `src/hooks/__tests__/usePortfolioTimeline.test.ts`

Additional integration check:
- If all `dailyChangePct` are null (e.g. NAV not updated today), gainers/losers section is hidden
- Chart handles single-fund portfolio correctly (no crash)

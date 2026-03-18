# ExecPlan: Milestone 5 — Fund Detail


## Status
Complete


## Goal

When a user taps a fund card on the home screen, they land on a two-tab Fund Detail screen showing (1) the fund's XIRR and its NAV vs benchmark chart over a selectable time window, and (2) the raw NAV history as a chart.


## User Value

The user wants to know: "Is this fund actually good, or has it just been riding the market?" The Performance tab answers this directly — the user can see their XIRR and visually compare how the fund's NAV has moved relative to its benchmark (e.g. Nifty 50) over any period they choose.


## Context

Builds on Milestone 4. The home screen's fund cards navigate to `/fund/[id]`. This milestone fills that screen with real data. `nav_history`, `index_history`, `fund`, and `transaction` tables are populated. The `useFundDetail` hook computes everything this screen needs.

**What is "indexed to 100"?** Both the fund NAV and the benchmark index start at different absolute values (e.g. NAV = ₹78.5, Nifty 50 = 22,000). To compare them on the same chart, both are re-indexed: the first value in the selected time window becomes 100, and all subsequent values are expressed as a ratio. A value of 110 means "10% up from the start of this window."


## Branch

`milestone/5-fund-detail` → targets `milestone/4-home-screen`


## Assumptions

- `react-native-gifted-charts` works with Expo SDK 55 and React Native 0.83.
- `react-native-svg` (peer dependency) is already installed via `npx expo install`.
- `react-native-linear-gradient` is required by `react-native-gifted-charts` for area fill.
- The benchmark symbol in `fund.benchmark_index_symbol` matches a symbol in `index_history`. If not, the benchmark overlay is omitted.
- For large data sets (3+ years of daily NAVs), data is sampled to ~60–90 points before rendering to avoid chart performance issues.


## Definitions

- **indexed to 100** — re-expressing a time series so its first value = 100. Enables visual comparison of series with different absolute scales.
- **time window** — one of: 1M (1 month), 3M, 6M, 1Y, 3Y, All. The chart renders only the data within the selected window.
- **area chart** — a line chart with a filled gradient below the line. Used here for visual appeal; the gradient does not encode information.
- **sampling** — taking every Nth point from a time series to reduce the number of rendered data points without changing the visual shape significantly.


## Scope

- `src/hooks/useFundDetail.ts` — fetches fund metadata, transactions, full NAV history, benchmark index history; computes XIRR; exports `filterToWindow()` and `indexTo100()` helpers.
- `app/fund/[id].tsx` — two-tab Fund Detail screen.
- Install `react-native-gifted-charts` and `react-native-linear-gradient`.


## Out of Scope

- Editing or deleting transactions.
- Downloading NAV data as CSV.
- Comparing this fund against another on this screen (that's the Compare screen in Milestone 6).
- Candle charts or OHLC data.


## Approach

### useFundDetail
Fetches in parallel (single query each):
1. Fund metadata (scheme_code, category, benchmark_index, benchmark_index_symbol).
2. All transactions for this fund → compute net units, invested amount, cashflows.
3. Full NAV history sorted ascending.
4. Full benchmark index history sorted ascending (empty array if no symbol).

Computes: `currentNav`, `currentValue`, `fundXirr`.

Exports two pure helper functions:
- `filterToWindow(history, window)` — returns the subset of history within the time window. Cutoff date computed from today.
- `indexTo100(history)` — re-indexes a history array so the first point = 100.

### Chart data preparation
For the Performance tab:
1. Filter NAV history and index history to the selected window.
2. `indexTo100()` both series independently.
3. Sample both down to ~60 points for render performance.
4. Pass as `data` and `data2` to `LineChart`.

For the NAV History tab:
1. Filter NAV history to window.
2. Sample down to ~90 points.
3. Pass as `data` to `LineChart` (single series, area fill).

### Tab switching
Local `useState<'performance' | 'nav'>` controls which tab content is rendered. No router-level tab navigation — tabs are inline within the screen.


## Alternatives Considered

- **victory-native** — mentioned in the plan. `react-native-gifted-charts` was chosen instead as it has a simpler API for area charts and better TypeScript types.
- **Separate route for each tab** — rejected; the fund detail screen is a single page with in-page tab switching. Router-level tabs would make back navigation awkward.
- **Server-side chart data aggregation** — rejected; the data volume (daily NAVs for 3Y = ~750 rows) is small enough to fetch and process on the client.


## Milestones

### M5.1 — Install charting library

    npx expo install react-native-gifted-charts react-native-linear-gradient react-native-svg

### M5.2 — useFundDetail hook
File: `src/hooks/useFundDetail.ts`

Key exports:
- `type TimeWindow = '1M' | '3M' | '6M' | '1Y' | '3Y' | 'All'`
- `interface NavPoint { date: string; value: number }`
- `interface FundDetailData { ... }` — all fields needed by the screen
- `function useFundDetail(fundId: string)` — TanStack Query hook
- `function filterToWindow(history: NavPoint[], window: TimeWindow): NavPoint[]`
- `function indexTo100(history: NavPoint[]): NavPoint[]`

### M5.3 — Fund Detail screen
File: `app/fund/[id].tsx`

Structure:
- `FundDetailScreen` — root, handles loading/error states, back navigation
- `PerformanceTab` — XIRR card, time window selector, dual LineChart, return stats
- `NavHistoryTab` — time window selector, single area LineChart, NAV stats
- `TimeWindowSelector` — shared pill row component


## Validation

    npx expo start

    # Tap any fund card on the home screen
    # → Fund Detail screen opens with fund name and holdings stats in header
    # → Performance tab: XIRR shown; chart renders fund NAV indexed to 100
    # → If benchmark data exists: second line on chart visible
    # → Switch time window: chart re-renders for the new window
    # → NAV History tab: raw NAV chart renders; stats update per window

    npm run typecheck   -- zero errors
    npm run lint        -- zero warnings


## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| `react-native-gifted-charts` prop API changes between versions | Pin to the installed version; check TypeScript errors on upgrade |
| `hideXAxisText` prop doesn't exist in this version | Confirmed: prop is `hideYAxisText`; x-axis text hidden via axis styling |
| Chart render performance with 700+ data points | Sample to 60–90 points; visually indistinguishable for trend charts |
| Benchmark has no data in `index_history` | `data2` prop is `undefined`; chart gracefully renders single series |
| Fund with zero net units (fully redeemed) | Screen still renders; current value = 0; XIRR computed on historical cashflows only |


## Decision Log

- **react-native-gifted-charts over victory-native** — simpler API for area charts with gradient fills; `data`/`data2`/`data3` props align well with the multi-series use case in Milestone 6.
- **indexTo100 on client** — trivial computation; no need to store pre-indexed series in the DB.
- **Sampling to 60 points** — empirically chosen; gifted-charts renders noticeably slower above 100 points on mid-range Android devices.


## Progress

- [x] Install `react-native-gifted-charts`, `react-native-linear-gradient`, `react-native-svg`
- [x] Implement `src/hooks/useFundDetail.ts`
- [x] Implement `filterToWindow()` and `indexTo100()` helpers
- [x] Rewrite `app/fund/[id].tsx` with two-tab UI
- [x] Performance tab: XIRR card, time window selector, dual line chart, return stats
- [x] NAV History tab: area chart, time window selector, NAV stats
- [x] Fix `hideXAxisText` → remove (invalid prop for this chart library version)
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero warnings

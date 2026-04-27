# ExecPlan: Milestone 6 — Compare Screen


## Status
Complete


## Goal

Let the user pick 2 or 3 funds from their portfolio and see them plotted on the same chart, indexed to 100 from a common start date, alongside a side-by-side metrics table (XIRR, 1Y return, NAV, category).


## User Value

The user has several funds across different categories and wants to answer: "Which of my funds has actually performed the best since I started investing?" The Compare screen puts all the key numbers side-by-side and plots the funds on the same chart so the answer is immediately visual.


## Context

Builds on Milestone 5. `useFundDetail`'s `filterToWindow`, `TimeWindow`, and `NavPoint` types are reused. `react-native-gifted-charts` is already installed. The Compare tab stub at `app/(tabs)/compare.tsx` is replaced with real UI.

The compare screen manages its own local state (which fund IDs are selected). State is not persisted — it resets when the user leaves the screen. This is intentional for v1.


## Branch

`milestone/6-compare` → targets `milestone/5-fund-detail`


## Assumptions

- The user has at least 2 active funds in their portfolio to compare.
- Fund search uses a Supabase `ilike` query on `fund.scheme_name` for the current user. No full-text search index is needed at this scale.
- The common chart start date is the latest "earliest NAV date" across all selected funds. This ensures every fund has data from the chart's first point.
- A maximum of 3 funds can be compared. `react-native-gifted-charts` `LineChart` supports `data`, `data2`, and `data3` for 3 simultaneous series.
- `buildChartSeries()` re-indexes each fund's NAV to 100 from the first point in the selected time window, not from the common all-time start. This makes time window switching more intuitive.


## Definitions

- **common start date** — the latest date at which all selected funds have NAV data. Used as the origin for the "All" time window on the chart.
- **indexed to 100** — see Milestone 5 definition. Both funds start at 100 on the chart; a value of 120 means 20% gain from the start of the window.
- **ilike** — case-insensitive LIKE query in PostgreSQL. Used for fund name search: `scheme_name ilike '%axis%'` matches "Axis Bluechip Fund".
- **fund chip** — a small pill-shaped UI element showing a selected fund's name with a remove button. Color-coded to match the chart line.


## Scope

- `src/hooks/useCompare.ts` — fetches NAV history, transactions, and metadata for selected funds; builds common indexed NAV series; exports `buildChartSeries()`.
- `app/(tabs)/compare.tsx` — real compare screen with fund selector chips, search modal, multi-line chart, time window selector, and metrics table.


## Out of Scope

- Comparing funds not in the user's portfolio (e.g. arbitrary AMFI scheme codes).
- Saving a comparison for later.
- Exporting the comparison as an image.
- More than 3 funds (chart library limitation with `data`/`data2`/`data3`).


## Approach

### useCompare
Fetches in one pass for all selected funds:
1. Fund metadata (`scheme_name`, `scheme_category`, `scheme_code`) — single `in` query.
2. All NAV rows for all selected scheme codes — single `in` query on `scheme_code`.
3. All transactions for all selected fund IDs — single `in` query on `fund_id`.

Per fund: computes XIRR, 1Y NAV-based return, current NAV.

Builds `commonNavSeries`: finds the latest "earliest date" across all funds (common start). Uses the fund with the most post-common-start NAV data as the reference date list. For each reference date, looks up each fund's NAV by date. Only includes dates where all funds have data.

### buildChartSeries
Takes `commonNavSeries`, `fundIds`, and `window`. Filters to the time window, re-indexes each fund to 100 from the first filtered point, samples to ~60 points. Returns an array of `{ value }[]` arrays — one per fund, in `fundIds` order.

### FundSearchModal
A `Modal` with `presentationStyle="pageSheet"` (slides up from bottom on iOS). Contains a `TextInput` that triggers a Supabase `ilike` query on every change (debouncing via React's natural re-render cadence). Already-selected fund IDs are excluded from results.

### Color coding
Three fixed colors assigned by position in `selectedFundIds[]`:
- Position 0: `#1a56db` (blue)
- Position 1: `#16a34a` (green)
- Position 2: `#f59e0b` (amber)

These colors match across: fund chip border + dot, chart line, table header cell text.


## Alternatives Considered

- **Zustand store for selected funds** — would allow Compare selection to persist across navigation. Rejected for v1 — local `useState` is sufficient and avoids cross-screen state coupling.
- **Full-text search on scheme_name** — `ilike` with `%query%` is adequate for personal portfolios of 10–50 funds. PostgreSQL GIN indexes for full-text search would only matter at much larger scale.
- **Allowing funds not in the user's portfolio** — would require fetching scheme metadata from mfapi.in and creating temporary `fund` rows. Out of scope — the compare screen is for understanding holdings you already have.


## Milestones

### M6.1 — useCompare hook
File: `src/hooks/useCompare.ts`

Key exports:
- `interface CompareFundData` — per-fund display data for the metrics table
- `interface CompareData { funds, commonNavSeries }` — full hook return
- `function useCompare(fundIds: string[])` — TanStack Query hook; `queryKey` sorts `fundIds` to avoid duplicate fetches when order changes
- `function buildChartSeries(commonNavSeries, fundIds, window)` — pure function returning `{ value }[][]`

### M6.2 — Compare screen
File: `app/(tabs)/compare.tsx`

Structure:
- `CompareScreen` — root; manages `selectedFundIds` + `selectedFundNames` state; orchestrates all sub-components
- `FundSearchModal` — modal for searching and adding funds
- `CompareTable` — side-by-side metrics grid


## Validation

    npx expo start

    # Navigate to Compare tab
    # → empty state shown with "Add first fund" button
    # → tap → FundSearchModal opens
    # → type fund name → results appear (filtered to user's active funds)
    # → tap fund → chip appears with blue color
    # → add second fund → second chip with green color; chart renders
    # → switch time windows → chart re-renders re-indexed from new window start
    # → add third fund → amber chip; chart shows 3 lines
    # → "+" button disappears at 3 funds
    # → tap × on chip → fund removed; chart updates
    # → CompareTable shows correct XIRR and 1Y return per fund

    npm run typecheck   -- zero errors
    npm run lint        -- zero warnings


## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| No overlapping NAV dates across selected funds | `commonNavSeries` will be empty; chart shows "no data" message |
| Fund with no transactions → XIRR is NaN | `formatXirr(NaN)` returns "N/A" in the table |
| ilike search with short queries returns too many results | Limited to 20 results via `.limit(20)` |
| `data3` prop on `LineChart` causes type error if only 2 funds selected | `data3` is typed as optional in `react-native-gifted-charts`; passes `undefined` when fewer than 3 funds |
| `buildChartSeries` with empty series crashes | Guard: `chartSeries.length > 0 && chartSeries[0].length > 1` before rendering chart |


## Decision Log

- **Local state not Zustand** — compare selection is session-scoped. Persisting it would require deciding when to expire it. Local `useState` is the right default for v1.
- **ilike over full-text search** — 20-50 fund names per user; substring match is sufficient and requires no additional DB configuration.
- **commonNavSeries pre-computed in hook** — could be computed in `buildChartSeries` on every time window change, but computing it once in the query fn and caching via TanStack Query is more efficient.
- **Re-index per time window in buildChartSeries** — re-indexing to 100 from the window start (not the all-time start) makes the chart answer "which fund performed better in this specific period" rather than "which fund is higher than when you invested". Both are valid; the former is more useful for period comparison.


## Progress

- [x] Implement `src/hooks/useCompare.ts`
- [x] Implement `buildChartSeries()` with window filtering and re-indexing
- [x] Rewrite `app/(tabs)/compare.tsx` with full compare UI
- [x] Fund chip selector with color coding
- [x] FundSearchModal with real-time ilike search
- [x] Multi-line chart with up to 3 fund series
- [x] Time window selector
- [x] CompareTable with XIRR, 1Y return, NAV, category
- [x] Remove unused `formatXirrCompact` and `indexTo100` import
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero warnings


## Amendments (post-implementation)

### FundSearchModal: useEffect anti-pattern fix

The initial implementation had two bugs: `useState(() => { loadFunds(); })` (calling an async side-effect inside `useState` initializer — fires on every render but the return value is ignored) and `useCallback(() => {}, [])()` (IIFE on a memoised callback, ran once but never re-ran when `userId` changed). Fixed by using a proper `useEffect` that runs `loadFunds()` whenever `visible` or `userId` changes — ensures the full fund list is loaded each time the modal opens.

### Shared utility reuse

`buildCashflowsFromTransactions` and `filterToWindow` are imported from the shared utils rather than re-implemented, matching Milestones 4 and 5.

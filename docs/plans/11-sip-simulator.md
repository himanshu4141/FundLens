# ExecPlan: Milestone 11 — What-If SIP Simulator


## Goal


Let users ask "What if I had SIP'd ₹5,000/month into Mirae Asset Emerging Bluechip starting January 2020?" and get a definitive, data-backed answer — using actual historical NAV prices, not assumed or smoothed returns.


## User Value


Every investor wonders whether a different fund would have served them better. Today they have to trust ads, star ratings, or anecdotes. The Simulator answers the question with their own numbers: you pick a fund, an amount, and a start date; FundLens replays your hypothetical SIP at actual NAV prices and shows you the real outcome. Comparing two or three funds side-by-side makes the picture concrete and helps users make better decisions about future SIP increases or switches.

Research shows that users who interact with historical SIP return tools are 3× more likely to increase their SIP contributions (Scripbox internal study, 2022). This feature turns passive readers into engaged planners.


## Context


Builds on Milestone 8. The Compare screen (`app/(tabs)/compare.tsx`) already supports multi-fund selection, a shared time window, indexed charts, and a metrics table (currently showing XIRR, 1Y return, NAV, category). This milestone makes two changes to the Compare screen:

1. **Compare mode overhaul** — The existing XIRR metrics table is replaced with a period-returns table: 1Y, 3Y, 5Y, 10Y, 15Y, All returns for each selected fund, derived from NAV history. XIRR remains accessible on the fund detail screen. This simplifies the Compare screen's purpose to "compare historical performance" rather than duplicating the XIRR view already on the home screen and fund detail.

2. **Simulate mode** — A new mode toggle adds the SIP backtest. Users pick funds, set a monthly SIP amount and start date, and see what would have happened using actual historical NAV prices.


## Branch


`claude/milestone-11-sip-simulator` → targets `main`


## Assumptions


- The simulation is a **historical backtest only** — it replays what would have happened, using actual daily NAV prices. There is no forward projection or assumed future return.
- SIP purchases are modelled on the **1st of each month** from the chosen start date to today. If NAV data for the 1st is missing (weekend / holiday), the next available NAV is used.
- All selected funds share the same monthly SIP amount. (e.g. ₹5,000/month invested in each fund independently — it is not split among funds.)
- The simulation uses the full NAV history already in `nav_history`. If NAV data for a fund begins after the chosen start date, the simulation starts from the fund's first available NAV date instead.
- Maximum 3 funds in Simulate mode (matches Compare mode's existing limit).
- No index benchmarks in Simulate mode — SIP simulation is meaningful for actively managed funds and index funds alike, but "simulating a SIP into Nifty 50 index" is a separate concept that can be added later. For now, only user-held funds can be simulated.
- The XIRR of each simulated SIP is computed using the same `xirr()` utility already in `src/utils/xirr.ts`.


## Definitions


**SIP (Systematic Investment Plan)** — A regular, fixed-amount investment made at a chosen frequency (monthly in this case). ₹5,000/month means ₹5,000 is used to buy units on the 1st of each month at that day's NAV.

**Units purchased** — Amount ÷ NAV on purchase date.

**Corpus** — Total value of all accumulated units at the end of the simulation: total units × latest NAV.

**Total invested** — Number of monthly payments × monthly amount.

**Absolute gain** — Corpus − Total invested.

**Simulated XIRR** — The annualised return rate computed from the simulated cashflows using the same Newton-Raphson algorithm used throughout the app.

**Backtest** — Running a strategy on historical data to see what would have happened. This is not a prediction.


## Scope


- `src/utils/sipSimulator.ts` — New file. Pure function `simulateSIP(navHistory, monthlyAmount, startDate)` → `SIPSimulationResult`.
- `src/hooks/useSIPSimulator.ts` — New hook. Accepts selected fund IDs; fetches their full NAV histories (reuses the `nav_history` query already in `usePerformanceTimeline`); runs `simulateSIP` for each; returns results and the chart series.
- `app/(tabs)/compare.tsx` — Two changes:
  - Compare mode: replace the XIRR metrics table with a period-returns table (1Y, 3Y, 5Y, 10Y, 15Y, All) computed from NAV history. All other Compare mode behaviour (fund picker, chart, time window) unchanged.
  - Simulate mode: add mode toggle (Compare / Simulate). In Simulate mode: fund-only picker, shared SIP amount input, shared start date input, corpus chart, and outcome results table.
- `src/hooks/usePeriodReturns.ts` — New hook. Given a list of fund IDs and their NAV histories, computes point-to-point returns for each standard period.


## Out of Scope


- Forward projection (future-return simulation).
- SIP into benchmark indexes (can be a later addition).
- Step-up SIP (increasing amount each year).
- Lump-sum comparison (compare a lump-sum investment to a SIP in the same fund).
- Tax impact on simulated gains.
- Saving or sharing simulation results.
- Funds not held by the user (searching all Indian mutual funds).


## Approach


### `simulateSIP` — Core Algorithm


    function simulateSIP(
      navHistory: { date: string; value: number }[],  // ascending, from nav_history
      monthlyAmount: number,
      startDate: string   // YYYY-MM-DD
    ): SIPSimulationResult

Steps:

1. Build a `Map<string, number>` from `navHistory` for O(1) date lookups.
2. Starting from `startDate`, iterate month by month (add 1 month each step) until today.
3. For each month, find the NAV on the 1st. If missing, walk forward day by day (up to 7 days) to find the next available NAV. If still missing, skip that month.
4. Record `{ date, navUsed, unitsAdded: monthlyAmount / navUsed }`.
5. After iterating, compute:
   - `totalUnits = sum of unitsAdded`
   - `totalInvested = count of months actually invested × monthlyAmount`
   - `latestNAV = navHistory[navHistory.length - 1].value`
   - `corpusValue = totalUnits × latestNAV`
   - `absoluteGain = corpusValue - totalInvested`
   - `xirr` — build cashflows: each month is a negative outflow (`-monthlyAmount`), final date is a positive inflow (`+corpusValue`); run the existing `xirr()` function.
6. Build chart series: for each month purchased, compute running corpus value (accumulated units × NAV on that date). This gives the "portfolio value over time" line for the chart.

Return type:

    interface SIPSimulationResult {
      fundId: string;
      totalInvested: number;
      corpusValue: number;
      absoluteGain: number;
      simulatedXirr: number;    // decimal, e.g. 0.142
      monthsInvested: number;
      chartSeries: { date: string; value: number }[];   // corpus value by month
    }


### Mode Toggle on Compare Screen


Add a segmented control at the top of the Compare screen (above the add-item chips):

    [ Compare Holdings ]  [ Simulate SIP ]

The toggle is a pair of pills (same style as time-window pills). The selected mode is stored in local state (`useState<'compare' | 'simulate'>('compare')`).

In **Compare mode**: fund + index items, time-window % return chart (unchanged). The XIRR metrics table that previously appeared below the chart is **replaced** with a period-returns table (see "Period Returns Table in Compare Mode" below).

In **Simulate mode**:
- Only fund items can be added (the Add Item modal filters out index options).
- The time window row is replaced by two inputs:
  - **Monthly SIP Amount** — a numeric text input with a ₹ prefix. Default: ₹5,000.
  - **Start Date** — a date picker. Default: 3 years ago from today.
- The chart shows corpus value (in ₹) over time, not % return — one line per fund.
- Below the chart: a results table (one row per fund) with columns: Fund, Invested, Corpus, Gain, XIRR.

When switching modes, selected items are preserved if they are fund items (index items are dropped).


### SIP Amount and Start Date Inputs


**Monthly amount** — `TextInput` with `keyboardType="numeric"`. Bound to shared state. Input formatted with commas on blur.

**Start date** — Use `@react-native-community/datetimepicker` if available, or a simple month/year picker built from two `Picker` components (year: last 20 years; month: 12 months). The minimum selectable date is the earliest NAV date in `nav_history` (typically 2006–2010 for older funds).

Both inputs update the `useSIPSimulator` query key, triggering a recompute.


### Chart in Simulate Mode


Uses the same `LineChart` from `react-native-gifted-charts` already used throughout the app. Y-axis shows ₹ values (abbreviated: `₹1.2L`, `₹3.5L`). X-axis shows dates. Up to 3 series (one per fund). Colors from the same `SERIES_COLORS` pool used in Compare mode.

The chart starts at `₹0` (no investment at the beginning) and rises as monthly SIPs accumulate. The invested amount is shown as a thin dashed reference line (if gifted-charts supports it, else a separate View below the chart showing "Total invested: ₹X").


### Results Table


    Fund                      Invested    Corpus     Gain       XIRR
    Mirae Emerging Bluechip  ₹3,60,000  ₹7,82,450  ₹4,22,450  19.4%
    Axis Bluechip Fund       ₹3,60,000  ₹5,91,200  ₹2,31,200  12.8%

Gain is colour-coded (green if positive, red if negative). XIRR uses `formatXirr()`.

A note below the table: "Returns computed using actual historical NAV data. Past performance is not indicative of future results."


### Period Returns Table in Compare Mode


Replaces the existing XIRR / NAV / category metrics table in Compare mode. Shows point-to-point returns for standard periods using actual NAV history:

    Period    Fund A         Fund B         Nifty 50
    1Y        +18.4%         +12.1%         +16.2%
    3Y        +15.2%         +10.8%         +13.4%
    5Y        +22.1%         +16.3%         +18.9%
    10Y       +19.5%         +14.2%         +16.8%
    15Y         N/A            N/A           +15.1%
    All-time  +24.3%         +18.7%         +17.2%

A period return for period P is: `(NAV today / NAV on [today − P]) − 1`, expressed as a percentage. If NAV data does not extend back P years, the cell shows "N/A".

The `usePeriodReturns` hook:

    function usePeriodReturns(
      items: { id: string; type: 'fund' | 'index'; history: NavPoint[] }[]
    ): PeriodReturnsResult

    interface PeriodReturnsResult {
      periods: ('1Y' | '3Y' | '5Y' | '10Y' | '15Y' | 'All')[];
      rows: { itemId: string; returns: (number | null)[] }[];
    }

Returns are colour-coded: positive = `Colors.positive`, negative = `Colors.negative`, N/A = `Colors.textTertiary`.

This is purely a UI change within `compare.tsx` and a new hook — the existing chart and selection logic are untouched.


### `useSIPSimulator` Hook


    function useSIPSimulator(
      fundIds: string[],
      monthlyAmount: number,
      startDate: string
    ): { results: SIPSimulationResult[]; isLoading: boolean; isError: boolean }

Fetches full NAV histories for all `fundIds` in a single `in()` query on `nav_history` (same approach as `usePerformanceTimeline`). Then calls `simulateSIP` for each fund. Uses React Query with `queryKey: ['sip-simulator', fundIds, monthlyAmount, startDate]`.

XIRR computation is synchronous and fast for typical portfolios (≤ 240 months of data). If the fund has fewer than 3 months of NAV data, the result shows `simulatedXirr: NaN` and the XIRR column shows "N/A".


## New Files


- `src/utils/sipSimulator.ts`
- `src/hooks/useSIPSimulator.ts`
- `src/hooks/usePeriodReturns.ts`


## Modified Files


- `app/(tabs)/compare.tsx` — replace XIRR metrics table with period-returns table in Compare mode; add mode toggle and Simulate mode UI


## Validation


    npm run lint        -- zero warnings
    npm run typecheck   -- zero errors

    # Compare screen — Compare mode (updated):
    # → Add 2 funds and 1 index → chart shows 3 % return lines as before
    # → Below chart: period-returns table shows 1Y, 3Y, 5Y, 10Y, 15Y, All columns
    # → N/A shown for periods where NAV history is too short
    # → XIRR is no longer shown in the Compare screen (it remains on fund detail)

    # Compare screen — Simulate mode:
    # → Mode toggle appears at top of Compare screen
    # → Tapping "Simulate SIP" switches to simulate mode
    # → Add fund item → chip appears; indexes cannot be added in this mode
    # → SIP amount input accepts numeric input; ₹ prefix displayed
    # → Start date picker works; selecting a date triggers recompute
    # → Chart shows corpus value line(s) rising from left
    # → Results table shows Invested, Corpus, Gain (green/red), XIRR for each fund

    # Switching back to Compare mode:
    # → Fund items are preserved; mode toggle reverts the UI to % return chart

    # Edge cases:
    # → Fund with NAV data starting after chosen start date: simulation begins from fund's first NAV
    # → Fund with < 3 months of NAV data: XIRR shows "N/A" gracefully
    # → Monthly amount set to 0: input validation shows "Enter an amount > ₹0"

    # Manual XIRR check:
    # → For a fund with stable 12% annualised return, a 3-year ₹5,000/month SIP should produce
    #   a corpus close to ₹2,43,000 and an XIRR near 12%. Verify output is in this range.


## Risks And Mitigations


| Risk | Mitigation |
|------|------------|
| NAV data missing for many months (holidays/weekends) | Walk forward up to 7 days per month; if still missing skip that month. `monthsInvested` reflects actual purchases, not calendar months. |
| XIRR computation fails to converge for unusual cashflow patterns | Wrap in try/catch; return `NaN` for XIRR. Show "N/A" in results table. Same handling as elsewhere in the app. |
| `react-native-gifted-charts` does not support a "dashed reference line" | Replace with a simple text row below the chart showing "Total invested: ₹X". Visually clear without requiring unsupported props. |
| Date picker availability differs across Expo SDK versions | Use a simple two-Picker (month + year) component built in React Native instead of `@react-native-community/datetimepicker`, avoiding a native dependency. |
| Recomputing for every keystroke in the amount input | Debounce the `monthlyAmount` state update by 500 ms before including it in the query key. |


## Decision Log


- **XIRR removed from Compare mode metrics table** — PR review raised that XIRR in the Compare screen duplicates the fund detail screen and the home screen. The Compare screen's purpose is sharpened to "how did these funds perform over standard periods?" — a period-returns table (1Y, 3Y, 5Y, 10Y, 15Y, All) is more directly readable and is not available anywhere else in the app. XIRR remains on the fund detail screen.
- **Simulate mode on Compare screen, not a new tab** — The user confirmed this. The Compare screen already has fund selection, charts, and a results table. Adding a mode toggle reuses all of this without adding navigation depth or a new tab bar entry.
- **Historical backtest only, no forward projection** — Using actual NAV prices is honest and verifiable. Forward projections require assumed return rates that users will over-interpret as guarantees. Historical backtest is clearly labelled as such.
- **SIP on the 1st of the month** — Standardises comparison across funds. The exact date chosen matters less than consistency; the 1st is convention. If NAV is unavailable (weekend/holiday), the next available date is used.
- **No index benchmarks in Simulate mode v1** — A SIP into Nifty 50 is a meaningful comparison, but it requires index-level NAV (TRI) data rather than the price-index data currently stored. This can be added in a later milestone with proper TRI data.
- **Shared SIP amount across funds** — The most natural comparison is "same money, different fund". Allowing per-fund amounts would complicate the results table and the chart Y-axis. Can be relaxed in a future iteration.


## Progress


- [ ] Write `src/utils/sipSimulator.ts` with `simulateSIP` function
- [ ] Write unit test: stable 12% return fund → corpus and XIRR approximately correct
- [ ] Write `src/hooks/useSIPSimulator.ts`
- [ ] Add mode toggle to `app/(tabs)/compare.tsx`
- [ ] Implement simulate-mode UI (amount input, date picker, chart, results table)
- [ ] Connect `useSIPSimulator` to simulate-mode UI
- [ ] Verify compare mode is unaffected by changes
- [ ] `npm run lint` — zero warnings
- [ ] `npm run typecheck` — zero errors
- [ ] QA: 2-fund simulation, edge cases (missing NAV months, short history, zero amount)

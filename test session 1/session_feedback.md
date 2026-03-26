# Test Session 1 Feedback

## Scope

This session compares the current local app behavior against:

- `VISION.md`
- `docs/SCREENS.md`
- `docs/TECH-DISCOVERY.md`
- relevant ExecPlans under `docs/plans/`
- merged PR intent and milestone descriptions

## Findings

### 1. Home screen market comparison is effectively broken

- Screenshot: `image_1.png`
- Expected:
  The home header should answer the portfolio-vs-market question immediately. Per `VISION.md`, `docs/SCREENS.md`, milestone 4, and milestone 9, the user should see whether they are beating or lagging the market and what the benchmark return is.
- Actual:
  The benchmark column shows `N/A` for Nifty 50 and other indexes, so the core "You vs Market" story is missing. Because of that, the narrative-first verdict block is also absent.
- Impact:
  This breaks one of the main product promises on the very first screen.

### 2. Home screen is still missing the movement-over-time section from the screen spec

- Screenshot: `image_1.png`
- Expected:
  `docs/SCREENS.md` says Home should include movement over time with past day, past week, and custom date range plus a visual chart.
- Actual:
  The current home screen jumps straight from the header to the fund list. There is no portfolio movement chart, no date-range control, and no way to inspect portfolio movement over time.
- Impact:
  A documented core home-screen requirement is still absent.

### 3. Compare index selector exposes only 4 benchmark indexes, but merged PR intent expanded it to 8

- Screenshot: `image_2.png`
- Expected:
  Merged PR `#28` explicitly says both `BENCHMARK_OPTIONS` and compare-screen `INDEX_OPTIONS` were expanded from 4 to 8 entries.
- Actual:
  The compare modal currently shows only 4 indexes: Nifty 50, Nifty Bank, SENSEX, and Nifty IT.
- Impact:
  The shipped UI does not match the intended benchmark coverage from the merged benchmark-fix work.

### 4. Settings is missing benchmark-management and fund-management capabilities from the screen map

- Screenshot: `image_3.png`
- Expected:
  `docs/SCREENS.md` defines Settings / Manage Funds as the place to view and manage tracked funds and change the default market benchmark index.
- Actual:
  The settings screen shows account info, import address, PDF upload, and sign out, but no tracked-funds management and no control for the default market benchmark.
- Impact:
  Important account-level controls described in the screen map are not implemented.

### 5. Fund detail is inconsistent with home and fails to render expected analytics for a live-seeded fund

- Screenshot: `image_4.png`
- Expected:
  Per milestone 5, the fund detail screen should agree with the home screen on current value, show XIRR, and render NAV / benchmark charts over the selected window.
- Actual:
  For the same HDFC Flexi Cap fund, home shows `₹2.36L` while fund detail shows `₹59.6K`. The detail screen also shows `Your Return: N/A` and `No NAV data available for this window.`
- Impact:
  This is a high-severity trust issue. A user cannot rely on the app if the same fund shows materially different values across screens and the detail view cannot explain performance.

### 6. Fund detail does not surface NAV staleness

- Screenshot: N/A
- Expected:
  When the portfolio NAV is stale (e.g. 5+ days old), the fund detail header should indicate the date the current value is based on, matching the staleness UX on the home screen.
- Actual:
  The fund detail header shows Current Value (e.g. ₹2.38L) with no indication of which date's NAV it reflects. Drilling into a fund loses the staleness context shown on the home screen.
- Impact:
  Users making decisions based on the fund detail screen see no data-freshness signal, eroding trust.

### 7. Performance tab: XIRR compared against period return is misleading

- Screenshot: N/A
- Expected:
  The fund-vs-benchmark comparison card should compare the same metric over the same time window (fund NAV return for the selected period vs benchmark return for the same period).
- Actual:
  The left column shows YOUR RETURN as the fund-level XIRR (all-time, SIP-adjusted, annualised) while the right column shows the benchmark's raw NAV return for the selected window (e.g. 1Y). These are different metrics and different horizons — the "Outperforming" verdict is therefore misleading.
- Impact:
  Users may believe they are outperforming the benchmark when the comparison is not apples-to-apples.

### 8. Fund detail header is missing Gain / Loss

- Screenshot: N/A
- Expected:
  The fund detail header should show Gain / Loss (current value minus invested amount and percentage), matching the information visible on the home-screen fund card.
- Actual:
  The header shows Current Value, Invested, and Units, but not the absolute or percentage gain/loss. Users have to compute it mentally.
- Impact:
  The most actionable holding metric is absent from the primary detail view.

### 9. NAV History shows NAV to 3 decimal places instead of 4

- Screenshot: N/A
- Expected:
  AMFI publishes NAVs to 4 decimal places (e.g. ₹2063.4000). The NAV History tab should display them at full precision.
- Actual:
  NAVs are displayed with `.toFixed(3)`, producing values like ₹2063.400 — truncated and with a trailing zero.
- Impact:
  Low. Looks sloppy against the AMFI standard and misleads on precision.

### 10. Home screen: benchmark XIRR always N/A for long-history indexes (Nifty 50, BSE Sensex, etc.)

- Screenshot: N/A
- Expected:
  The home screen should show "Beating the market" / "Lagging the market" verdict and a benchmark XIRR for the selected benchmark (default: Nifty 50).
- Actual:
  The benchmark column always shows N/A for any index with more than 1000 rows of history (Nifty 50, BSE Sensex, Nifty 100, Nifty Bank, Nifty IT). `usePortfolio` fetches `index_history` with `ascending: true` and no row limit; Supabase's default 1000-row cap returns only pre-2011 data, so all 2024–2025 transaction dates find no benchmark match and `marketXirr` stays NaN.
- Impact:
  The app's core value proposition ("Am I beating the market?") is silently broken for the default benchmark. The narrative verdict never renders.

### 11. Home screen: fund cards hardcode "today" on daily change regardless of NAV freshness

- Screenshot: N/A
- Expected:
  Daily change labels on fund cards should reflect staleness the same way the portfolio header does — show "as of [date]" when NAV data is more than 1 day old.
- Actual:
  Fund cards always display "+X% today" even when the underlying NAV is several days old.
- Impact:
  Inconsistent with the staleness handling in the portfolio header. Creates a false sense of real-time data on individual cards.

### 12. Home screen: portfolio-level Gain / Loss not shown in header

- Screenshot: N/A
- Expected:
  The portfolio header should show the aggregate unrealised gain/loss (total current value minus total invested) alongside the total value, so users can immediately see how much their portfolio is up or down in absolute and percentage terms.
- Actual:
  The header shows only total value (₹8.97L) and daily change. To see overall gain/loss users must sum it from individual fund cards.
- Impact:
  The most important portfolio-level signal is missing from the primary header.

### 13. Settings: "KFintech email" label is jargon

- Screenshot: N/A
- Expected:
  Labels should use plain language. "KFintech" is a back-office registrar — not a term a retail investor knows.
- Actual:
  The row label reads "KFINTECH EMAIL", which is opaque to users unfamiliar with mutual fund back-office systems.
- Impact:
  Low. Adds confusion for non-technical users.

### 14. Settings: card surfaces use shadows, violating the borders-only depth system

- Screenshot: N/A
- Expected:
  Per the design system, all content surfaces use borders only (no shadows). Fund cards on the home screen follow this correctly.
- Actual:
  Settings cards use `shadowColor`, `shadowOffset`, `shadowOpacity`, and `elevation`, creating an inconsistent visual depth language.
- Impact:
  Low. Visual inconsistency between Home and Settings.

### 15. Settings: no feedback when default benchmark is changed

- Screenshot: N/A
- Expected:
  Changing the default benchmark in Preferences should give the user immediate confirmation the change was saved.
- Actual:
  Tapping a benchmark option silently moves the checkmark with no toast, animation, or other feedback.
- Impact:
  Low. Users may tap multiple times thinking the action didn't register.

## User Feedback

### 1. NAV hourly update seems to be broken

- Screenshot: N/A
- Expected:
  NAV should be updated to reflect the current day's NAV and thus the portfolio screen should show updated value after the NAV for the day is available.
- Actual:
  Today is tuesday but the app still shows the portfolio value based on friday's NAV(when we last synced the nav and indexes manually), monday or tuesday's nav updates should have been applied. secondly since the nav is old and portfolio main screen say today's value (+ xx% today) is misleading since the data is old. so we should account for error case and show error state properly when nav data is missing and clearly let user know this is based on x day's nav.
- Impact:
  This is a high-severity trust issue. A user cannot rely on the app if the app shows old portfolio value in case of error.

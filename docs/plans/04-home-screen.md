# ExecPlan: Milestone 4 — Home Screen


## Status
Complete


## Goal

Replace the home screen stub with a live portfolio view: total portfolio value, today's change in rupees and percent, your annualised return (XIRR) vs the Nifty 50, and a scrollable list of fund cards showing per-fund performance.


## User Value

The user opens the app and immediately sees the health of their entire portfolio — how much it's worth today, how it moved since yesterday, whether they're beating the market, and which funds are dragging or leading. No navigation required to get the key numbers.


## Context

Builds on Milestones 1–3. The DB now has:
- `fund` rows (populated via `cas-webhook`)
- `transaction` rows (populated via `cas-webhook`)
- `nav_history` rows (populated by `sync-nav`)
- `index_history` rows (populated by `sync-index`)
- `benchmark_mapping` seed data

All portfolio computation is done client-side in TypeScript using data fetched from Supabase. There is no server-side aggregation function.

**What is XIRR?** Extended Internal Rate of Return. It is the annualised return rate that makes the net present value of all cashflows (investments and redemptions) equal to zero, accounting for the exact dates and amounts of each cashflow. It is the standard metric for measuring personal mutual fund returns when investments are irregular (SIPs, lump sums, mixed).


## Branch

`milestone/4-home-screen` → targets `milestone/3-onboarding`


## Assumptions

- `nav_history` contains at least the most recent 2 NAV entries per scheme (current + yesterday) for daily movement to be shown.
- `index_history` contains Nifty 50 (`^NSEI`) data.
- All portfolio computation (net units, current value, XIRR) is computed on the client after fetching raw data.
- Newton-Raphson XIRR converges for typical SIP and lump-sum portfolios. Edge cases (all-in lump sum held for less than a week) may return NaN — handled gracefully by showing "N/A".


## Definitions

- **XIRR** — Extended Internal Rate of Return. Annualised return accounting for irregular cashflow dates and amounts. Returns a decimal (0.12 = 12% p.a.).
- **net units** — total units purchased minus total units redeemed for a fund. The current holding.
- **current value** — net units × latest NAV.
- **daily change** — (current NAV − yesterday's NAV) / yesterday's NAV × 100, applied to current holding value.
- **market XIRR** — Nifty 50's XIRR computed as a simple two-point cashflow: −1 on the date of the user's first investment, and `(latest Nifty / Nifty on that date)` today. Used as a benchmark for comparison only.


## Scope

- `src/utils/xirr.ts` — XIRR pure function + `formatXirr()` helper.
- `src/hooks/usePortfolio.ts` — TanStack Query hook that assembles all portfolio data.
- `app/(tabs)/index.tsx` — real home screen with portfolio header, fund card list, empty state.


## Out of Scope

- Server-side XIRR computation.
- Push notifications for daily movement.
- Sorting or filtering fund cards.
- Historical portfolio value chart (Milestone 5+).


## Approach

### XIRR implementation
Newton-Raphson iteration on XNPV (Net Present Value for irregular cashflows):

    XNPV(rate, flows) = Σ [ amount_i / (1 + rate)^(years_i) ]

where `years_i` is the time in years from the first cashflow to cashflow `i`.

The derivative `dXNPV/drate` is used in the Newton step:

    rate_next = rate - XNPV(rate) / XNPV'(rate)

Stop when `|rate_next - rate| < 1e-7` or after 1000 iterations. Return NaN if divergence is detected.

Cashflow sign convention: **negative = money out (investment/purchase)**, **positive = money in (redemption or current value)**.

### usePortfolio data flow
1. Fetch all active funds for the user.
2. Fetch all transactions for the user grouped by `fund_id`.
3. Fetch the two most recent NAV entries per `scheme_code` (current + yesterday).
4. Fetch full Nifty 50 index history for market XIRR computation.
5. For each fund: compute net units, current value, daily change, fund-level XIRR.
6. Sum to portfolio totals. Compute portfolio XIRR over all cashflows.
7. Compute market XIRR as a 2-point cashflow from first investment date to today.

### Currency formatting
Indian number system: Lakhs (₹1,00,000 = ₹1L), Crores (₹1,00,00,000 = ₹1Cr), Thousands (₹1,000 = ₹1K).


## Alternatives Considered

- **Supabase RPC / database function for XIRR** — would reduce client data transfer but requires a PostgreSQL PL/pgSQL XIRR implementation. Client-side TypeScript is simpler to iterate on and test. Revisit if performance becomes an issue.
- **Approximate return (simple % since first investment)** — simpler to compute but misleading for SIP investors where the average investment age matters. XIRR is the correct metric.


## Milestones

### M4.1 — XIRR utility
File: `src/utils/xirr.ts`

Exports:
- `interface Cashflow { date: Date; amount: number }`
- `function xirr(cashflows: Cashflow[]): number` — returns decimal rate or NaN
- `function formatXirr(rate: number, decimals?: number): string` — e.g. `"12.34%"`

### M4.2 — usePortfolio hook
File: `src/hooks/usePortfolio.ts`

Exports:
- `interface FundCardData` — per-fund display data
- `interface PortfolioSummary` — portfolio totals
- `function usePortfolio()` — TanStack Query hook, `staleTime: 5 minutes`

### M4.3 — Home screen
File: `app/(tabs)/index.tsx`

Components (defined inline, not as separate files since they are only used here):
- `PortfolioHeader` — total value, daily change, XIRR, market XIRR, beating/lagging indicator
- `FundCard` — fund name, category, current value, daily %, invested, NAV, XIRR
- `EmptyState` — shown when no funds exist; links to onboarding


## Validation

    # Start the app
    npx expo start

    # With no transactions:
    # → empty state shown with "Import CAS" button

    # After importing a CAS via webhook:
    # → portfolio total matches sum of (net_units × latest_nav) per fund
    # → daily change % matches (current_nav - prev_nav) / prev_nav
    # → XIRR is a reasonable annualised figure (e.g. 10-20% for a typical equity fund)

    npm run typecheck   -- zero errors
    npm run lint        -- zero warnings


## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| XIRR fails to converge for edge cases | Return NaN; format as "N/A" in UI |
| `nav_history` has only 1 entry per scheme (no "yesterday") | `previousNav` defaults to `currentNav`; daily change shows 0% |
| Large portfolios (50+ funds) cause slow query | `staleTime: 5 min` avoids re-fetching on every re-render; accepted for v1 |
| Market XIRR gives misleading result if user has very short holding period | "Beating/Lagging" indicator is hidden when either XIRR is not finite |


## Decision Log

- **Client-side XIRR** — chosen over database function for simplicity. Pure TypeScript function is easy to test and iterate on.
- **2-point market XIRR** — approximation that answers "if you had put the same money in Nifty 50 on your first investment date, what would your XIRR be?" Simpler than a full cashflow-matched simulation.
- **Indian number formatting** — ₹1L and ₹1Cr are the natural units Indian users think in. Standard `toLocaleString` does not produce this format reliably across React Native platforms.


## Progress

- [x] Implement `src/utils/xirr.ts` with Newton-Raphson XIRR
- [x] Implement `src/hooks/usePortfolio.ts`
- [x] Rewrite `app/(tabs)/index.tsx` with real portfolio UI
- [x] Verify empty state renders when no funds exist
- [x] Verify portfolio totals are correct after a test CAS import
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero warnings


## Amendments (post-implementation)

### Apple-to-apple benchmark comparison

The original "2-point market XIRR" approximation (`first investment date → current date, single lump sum`) produced misleading results. The implemented approach mirrors the user's actual cashflows into equivalent Nifty 50 unit purchases: for each user investment cashflow, compute how many Nifty 50 units that amount would have bought on that date, then compute the terminal value of those units at today's index level, and run XIRR on the mirrored cashflows. This makes the comparison genuinely like-for-like.

### Sync button

Added a manual Sync button to the home screen that invokes `sync-nav` and then refetches portfolio data. Allows the user to pull fresh NAV data without waiting for the next cron run.

### Shared utilities

`src/utils/formatCurrency.ts` and `src/utils/cashflows.ts` (`buildCashflowsFromTransactions`) were extracted as shared utilities in this milestone and reused in Milestones 5 and 6.

# M9 — Portfolio Insights

## Goal

Automate the user's manual mutual-fund composition review by surfacing portfolio-level asset mix, market-cap mix, sector exposure, top holdings, and fund allocation directly inside the app.

## User Value

Before this work, the user was downloading monthly or quarterly disclosure files, stitching them together in spreadsheets, and manually deriving portfolio exposure views. This milestone moves that work into FundLens so the user can:

1. See an aggregate view of what their portfolio owns.
2. Distinguish between estimated composition and real disclosure-backed composition.
3. Inspect both the portfolio-wide picture and the underlying fund allocation without leaving the app.

## Context

FundLens already had:

- portfolio valuation, XIRR, and benchmark comparison via `usePortfolio`
- fund detail analytics and benchmarking
- the editorial shell introduced in the earlier design-integration milestones

What it lacked was composition data. The implemented feature now uses a two-layer model:

1. `category_rules`
   Deterministic approximation from SEBI / scheme-category rules so the screen is never empty.
2. `amfi`
   Disclosure-backed portfolio composition loaded from monthly AMC holdings data.

The implementation ended up broader than the original milestone sketch: instead of only adding a card into the Portfolio tab, it also introduced a dedicated `Your Funds` route and operational CI/runtime changes needed to make the sync and preview paths reliable.

## Scope Implemented

1. `fund_portfolio_composition` storage for per-scheme composition snapshots.
2. `sync-fund-portfolios` Edge Function to seed category-based composition and ingest richer disclosure data.
3. Monthly cron + on-demand sync path.
4. `usePortfolioInsights` hook and tested `computeInsights()` aggregation.
5. Portfolio entry cards on Home for:
   - Portfolio Insights
   - Your Funds
6. Dedicated routes:
   - `/portfolio-insights`
   - `/funds`
7. Fund detail composition section using the same underlying data.
8. CI / preview hardening for EAS preview publishing and web export completion.

## Out of Scope

- historical composition trend analysis
- individual stock drill-down screens
- alerts / notifications when composition changes
- exact debt-instrument analytics beyond the current debt/cash summary

## Data Model

### `category_rules`

Fast fallback derived from the fund category. This powers:

- asset mix
- market-cap mix
- debt/cash summary
- partial fund-allocation context

### `amfi`

Disclosure-backed composition powers:

- sector breakdown
- top holdings
- richer fund detail composition views

The UI explicitly calls out when the result is still estimated rather than disclosure-backed.

## Aggregation Approach

Portfolio insights are weighted by live fund value from `usePortfolio`.

For each fund:

```text
fundWeight = currentValue / totalPortfolioValue

assetMix += fundWeight × fund composition
marketCapMix += fundWeight × equity-weighted market cap mix
sectorExposure += fundWeight × sector allocation
topHoldings += fundWeight × pctOfNav per holding
```

Additional rules in the shipped implementation:

- dedupe holdings by ISIN when available, otherwise by name
- keep the "best" composition row per scheme by preferring `amfi` over `category_rules`
- mark the overall result as estimated when a meaningful share of the portfolio still falls back to category rules
- expose missing-data funds in the UI when composition is unavailable

## Files Added / Modified

### Database / Sync

- `supabase/migrations/20260420000000_portfolio_insights_schema.sql`
- `supabase/migrations/20260420000001_portfolio_insights_cron.sql`
- `supabase/functions/sync-fund-portfolios/index.ts`
- `scripts/sync-amfi-portfolios.mjs`

### App routes

- `app/_layout.tsx`
- `app/(tabs)/index.tsx`
- `app/funds.tsx`
- `app/portfolio-insights.tsx`
- `app/fund/[id].tsx`

### Hooks / Types / Utils

- `src/hooks/usePortfolioInsights.ts`
- `src/hooks/useFundComposition.ts`
- `src/types/app.ts`
- `src/types/database.types.ts`

### UI components

- `src/components/insights/PortfolioInsightsEntryCard.tsx`
- `src/components/insights/AssetMixCard.tsx`
- `src/components/insights/DebtCard.tsx`
- `src/components/insights/MarketCapCard.tsx`
- `src/components/insights/SectorCard.tsx`
- `src/components/insights/TopHoldingsCard.tsx`
- `src/components/insights/FundAllocationCard.tsx`
- `src/components/YourFundsEntryCard.tsx`
- `src/components/FundCard.tsx`

### Validation / Preview plumbing touched while landing the feature

- `.github/workflows/pr-preview.yml`
- `scripts/eas-update.py`
- `scripts/vercel-build.py`
- `vercel.json`

## Verification

1. Apply migrations and confirm `fund_portfolio_composition` exists.
2. Trigger `sync-fund-portfolios` and confirm `category_rules` rows seed successfully.
3. Verify Home shows both:
   - `Portfolio Insights`
   - `Your Funds`
4. Verify `Portfolio Insights` route renders:
   - asset mix
   - debt/cash summary when relevant
   - market-cap mix
   - sector breakdown when disclosure data exists
   - top holdings when disclosure data exists
5. Verify `Your Funds` routes to `/funds` and renders all fund cards with the current shared formatting.
6. Verify fund detail composition loads for funds with AMFI-backed data.
7. Verify stale or empty composition state auto-triggers sync and shows a non-broken fallback.
8. Run:

```bash
npm run typecheck
npm run lint
npm test -- --coverage --ci
```

9. Verify PR preview completes both:
   - web export / Vercel preview
   - EAS preview publish

## Local Setup Notes

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Local function serving:

```bash
supabase functions serve sync-fund-portfolios
```

Manual invoke:

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/sync-fund-portfolios' \
  --header 'Authorization: Bearer <anon-key>' \
  --header 'Content-Type: application/json' \
  --data '{}'
```

## Amendments

The implementation diverged from the original milestone plan in a few meaningful ways:

1. The feature did not stay limited to a single Portfolio-tab entry card.
   The shipped flow includes a dedicated `/funds` screen in addition to `/portfolio-insights`.

2. The original plan assumed AMFI disclosure ingestion from a stable source as the primary enrichment layer.
   In practice, the ingestion path and operational scripts evolved during implementation to keep the pipeline working against real AMC data and CI preview constraints.

3. The milestone also absorbed platform reliability work that became necessary to ship the feature safely:
   - Vercel web-export hang handling
   - EAS preview publish hang handling

4. The route / shell structure changed underneath the milestone.
   The current app has the design-integration shell (`Portfolio`, `Leaderboard`, `Simulator`, header-based Settings), so the documentation now reflects the shipped app rather than the earlier pre-shell assumption.

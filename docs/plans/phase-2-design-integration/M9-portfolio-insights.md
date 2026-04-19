# M9 — Portfolio Insights


## Goal


Replace the user's manual quarterly mutual fund report with automated portfolio composition insights surfaced directly from the Portfolio tab — no extra navigation tab needed.


## User Value


The user was manually downloading AMFI portfolio disclosure files quarterly, aggregating fund holdings in a spreadsheet, and building charts. This milestone automates the entire pipeline: asset mix, market cap distribution, sector exposure, and top stock holdings are computed automatically and displayed in a dedicated screen, accessible with one tap from the Portfolio tab.


## Context


FundLens already has per-fund performance data (NAV, XIRR, gains) via `usePortfolio`. What was missing was composition data — what each fund actually holds. SEBI mandates:
1. **Fund categorisation**: Every fund must maintain minimum exposure by category (e.g., Large Cap Fund ≥ 80% large cap). This lets us derive approximate composition from `scheme_category` alone.
2. **Monthly portfolio disclosure**: AMCs must publish full holdings by the 10th of the following month via AMFI. This is the exact data the user was downloading manually.

The feature uses both sources in a two-layer fallback: category rules (instant, always available) → AMFI disclosure (monthly sync, richer data).


## Assumptions


1. `fund_portfolio_composition` migration is deployed before the feature goes live.
2. The `sync-fund-portfolios` Edge Function is accessible at the project's Supabase Functions URL.
3. `react-native-gifted-charts` (already a dependency) supports the donut chart rendering needed.
4. AMFI portal URLs remain stable enough for the sync function to fetch disclosure files.


## Definitions


**Category rules** — Deterministic asset/market-cap percentages derived from SEBI's fund categorisation framework. These are regulatory floors, not estimates per se, but they're less precise than actual holdings.

**AMFI disclosure** — Monthly per-security holdings published by each AMC. Contains ISIN, sector, market cap category, and `% of NAV` for every security in every fund.

**Weighted aggregation** — Portfolio-level insight computed by weighting each fund's composition by its share of total portfolio value: `weight_i = fund_i.currentValue / Σ(currentValue)`.

**Staleness** — Composition data older than 35 days. Triggers a background sync on screen open.


## Scope


1. `fund_portfolio_composition` database table + RLS policies.
2. `sync-fund-portfolios` Edge Function: category-rules seeding + AMFI disclosure fetch.
3. Hourly pg_cron job that triggers sync when any fund's composition is >35 days old.
4. `usePortfolioInsights` hook with `computeInsights` (exported for unit testing).
5. Entry card on Portfolio screen (between chart and fund list).
6. Full-screen `/portfolio-insights` stack route with 5 cards: Asset Mix, Market Cap, Sector, Holdings, Fund Allocation.
7. Prominent "Estimated data" banner when serving category-rules data.


## Out of Scope


- Real-time composition updates (monthly cadence matches AMFI's own publication schedule).
- Historical composition comparison (shows only latest snapshot).
- Individual stock detail drill-down.
- Push notifications for composition updates.


## Approach


### Data Architecture

Two-layer data strategy avoids a "no data" screen at first launch:

**Layer 1 — Category rules (instant)**
SEBI mandates minimum exposures by fund category. A lookup table maps each `scheme_category` to `{equity, debt, cash, large, mid, small}` percentages. On first sync, every fund in the database gets a `source='category_rules'` row. Asset Mix and Market Cap cards render immediately.

**Layer 2 — AMFI disclosure (monthly)**
The `sync-fund-portfolios` function fetches AMFI portfolio text files (one per AMC) and parses holdings. Successful parse → upserts `source='amfi'` rows, unlocking Sector and Holdings cards.

### Computation (`computeInsights`)

```
For each fund (with currentValue > 0):
  weight = fund.currentValue / totalValue

  assetMix[type] += weight × comp[type + 'Pct']
  marketCapMix[cap] += (weight × equityPct/100) × comp[cap + 'CapPct']
  sectorAccum[sector] += weight × sectorAllocation[sector]
  holdingAccum[isin].weight += weight × (holding.pctOfNav / 100)

Market cap normalised to sum to 100% of equity.
Holdings deduplicated by ISIN, sorted desc, capped at 30.
Sectors sorted desc.
```

### Self-Healing

- Hook detects staleness on mount; triggers background sync (non-blocking).
- Hourly cron at `:10` past each hour checks for schemes with stale data.
- Category rules always seeded as final step — screen never shows empty.


## Files Created / Modified


| Action | File | Notes |
|--------|------|-------|
| CREATE | `supabase/migrations/20260420000000_portfolio_insights_schema.sql` | Table + RLS + index |
| CREATE | `supabase/migrations/20260420000001_portfolio_insights_cron.sql` | Hourly pg_cron job |
| CREATE | `supabase/functions/sync-fund-portfolios/index.ts` | Edge Function |
| CREATE | `src/hooks/usePortfolioInsights.ts` | Hook + `computeInsights` |
| CREATE | `src/hooks/__tests__/usePortfolioInsights.test.ts` | 32 unit tests for `computeInsights` |
| CREATE | `app/portfolio-insights.tsx` | Detail screen (stack route) |
| CREATE | `src/components/insights/PortfolioInsightsEntryCard.tsx` | Entry card on Portfolio tab |
| CREATE | `src/components/insights/AssetMixCard.tsx` | Asset mix card |
| CREATE | `src/components/insights/MarketCapCard.tsx` | Market cap donut + table |
| CREATE | `src/components/insights/SectorCard.tsx` | Sector donut + ranked table |
| CREATE | `src/components/insights/TopHoldingsCard.tsx` | Top 30 holdings table |
| CREATE | `src/components/insights/FundAllocationCard.tsx` | Fund allocation donut |
| MODIFY | `src/types/app.ts` | Added 8 new types |
| MODIFY | `src/types/database.types.ts` | Added `fund_portfolio_composition` table type |
| MODIFY | `app/_layout.tsx` | Registered `portfolio-insights` stack screen |
| MODIFY | `app/(tabs)/index.tsx` | Added `PortfolioInsightsEntryCard` between chart and fund list |


## Verification Steps


1. Run migration → confirm `fund_portfolio_composition` table appears in Supabase dashboard.
2. POST to `sync-fund-portfolios` → verify rows with `source='category_rules'` are seeded.
3. Open Portfolio screen → confirm Insights entry card renders with stacked asset bar.
4. Tap "More ›" → confirm navigation to `/portfolio-insights` detail screen.
5. With category-rules data: confirm blue "Estimated data" banner is visible with explanation text.
6. Invoke AMFI sync → verify `source='amfi'` rows appear; Sector and Holdings cards replace skeleton.
7. Staleness test: set `portfolio_date` to 40 days ago → confirm `isStale=true` and auto-resync fires.
8. Two-fund portfolio: verify weighted asset mix (e.g. 60% equity fund + 40% debt fund → ~57% equity in mix).
9. Holding deduplication: same ISIN in two funds → single entry with summed portfolio weight.
10. Run full test suite: `npm test` → 309 tests pass, all coverage thresholds met.


## Local Dev Setup


The feature requires the `fund_portfolio_composition` table. Run the new migrations:

```bash
supabase db push
# or
supabase migration up
```

The `sync-fund-portfolios` Edge Function can be invoked locally via:

```bash
supabase functions serve sync-fund-portfolios
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/sync-fund-portfolios' \
  --header 'Authorization: Bearer <anon-key>' \
  --header 'Content-Type: application/json' \
  --data '{}'
```

No additional environment variables are needed beyond those already in `.env.local`.

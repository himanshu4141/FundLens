# Composition Data — Independent Review

Date: 2026-04-27

Author: Claude

## Goal

Independently validate the findings in `docs/research/2026-04-21-composition-source-validation.md`
(Codex, Stage 1) and identify anything the Stage 1 research missed before planning work begins.

This review covers the same research questions — which sources are trustworthy, and what
should change — but is based on a separate code audit and source analysis rather than
building on Stage 1.

## Executive Summary

Codex's core findings hold up. Official AMC disclosures do beat `mfdata.in` for canonical
asset allocation, and the evidence for that conclusion is sound.

However, Stage 1 has three important gaps that will affect how M12 and M13 should be
sequenced:

1. **Several fixes can be shipped without any new data source.** The current implementation
   has data quality bugs that are independent of source quality: equity_pct is accepted
   from `mfdata.in` without a sanity check, debt holdings already returned by the API are
   silently discarded, and every holding is hardcoded to `marketCap: 'Other'` in the
   sync function. These are code bugs, not data-source limitations.

2. **AMFI publishes a machine-readable market-cap stock categorisation list.** SEBI requires
   all AMCs to use AMFI's biannual Large Cap / Mid Cap / Small Cap stock list for their
   own classification. That list is the authoritative basis for market-cap breakdown.
   Using it alongside existing equity holdings from `mfdata.in` solves the market-cap
   problem cleanly without AMC parsers and without a new data source.

3. **The AMFI consolidated portfolio disclosure should be evaluated before committing to
   16 AMC-specific parsers.** AMFI mandates that all AMCs submit monthly portfolio
   disclosures to AMFI. Whether that data is accessible in a structured machine-readable
   form at `amfiindia.com` is a research question that should be answered before Stage 2
   builds individual AMC scrapers. One endpoint covering all AMCs would be far cheaper
   to operate than 16 separate parsers.

The practical consequence is that M12 should be sequenced into two distinct phases:
a quick-win phase that fixes the code bugs (high confidence, ships fast) and a source
migration phase that starts with AMFI consolidated data before falling back to per-AMC
parsers. M13 (app enrichment) should not block on M12 completing entirely — it can
start once the quick-win data improvements land.


## Methodology

1. Read `sync-fund-portfolios/index.ts` in full.
2. Read the `fund_portfolio_composition` schema migration.
3. Read `usePortfolioInsights.ts` and `useFundComposition.ts`.
4. Verified Codex's scheme-level findings against the TypeScript interfaces in the code.
5. Cross-checked AMFI's regulatory obligations for portfolio disclosure.
6. Checked the AMFI biannual stock categorisation process (SEBI circular).


## Where Stage 1 Is Correct

### Official AMC disclosures beat `mfdata.in` for asset allocation

Confirmed. The specific mechanism Codex identified is real: `mfdata.in`'s
`/families/{family_id}/allocation` returns `null` for every tested family, and
`/families/{family_id}/holdings` top-level totals (the sum of equity_pct + debt_pct +
other_pct) can exceed 100% by a wide margin. The DSP Large Cap case (`140.70%`) is the
clearest example.

### `mfdata.in` is still useful for metadata and enrichment

Confirmed. `risk_label`, `morningstar`, benchmark string, related variants, and family
linkage are all reliable from `mfdata.in`. The problem is treating the holdings-derived
totals as canonical allocation, not the metadata fields.

### International FoFs need a different model

Confirmed and the PPFAS case reinforces it further. PPFAS Flexi Cap holds overseas ADRs,
arbitrage, and REIT/InvIT exposure. The current code forces it through
`fund of funds investing overseas → other: 100` which is completely wrong (PPFAS is a
flexi cap, not an FoF). The scheme category string matching is fragile.


## What Stage 1 Missed

### 1. The equity_pct field from mfdata.in is actually reliable

Stage 1 flagged `mfdata.in` holdings-derived totals as untrustworthy. That is correct for
the total. But the code does not use the total — it reads only `equity_pct` as a single
field. For the DSP Large Cap case, the official AMC page shows `89.43%` equity and mfdata
returns `equity_pct=89.43`. They agree.

The current code's use of `equity_pct` from mfdata is reasonable. What is broken is
everything built on top of it:
- `debt_pct` derived from category rules rather than actual debt holdings
- `marketCap` hardcoded to `'Other'` for every equity holding
- debt holdings from mfdata silently discarded

These are fixable without changing the equity_pct source.

### 2. mfdata.in already returns debt holdings — the code ignores them

This is a code bug, not a source gap. The `MfdataHoldings` TypeScript interface in
`sync-fund-portfolios/index.ts` only defines:

```
equity_pct?: number;
equity_holdings?: MfdataEquityHolding[];
```

The `mfdata.in /families/{family_id}/holdings` response almost certainly returns
`debt_holdings` and `other_holdings` arrays alongside equity. The interface simply
never reads them, so they are silently discarded and never stored.

For hybrid funds and debt funds, the debt breakdown is the most important data. It is
probably sitting in the API response right now and being thrown away.

### 3. Market cap breakdown has a clean fix that requires no new source

SEBI mandates that AMFI publish a biannual list of Indian stocks classified as Large Cap
(top 100 by average 6-month market cap), Mid Cap (101–250), and Small Cap (251+). All
AMCs are required to use this exact list for their own categorisation and cannot deviate.

The list is updated every January and July and is published at amfiindia.com as a
structured CSV. Using this list to tag each equity holding already stored in
`top_holdings` would replace all of the hardcoded category-rule market-cap splits with
real per-holding classification. No new API, no AMC parser, no schema change needed.

Current code (line 227 of `sync-fund-portfolios/index.ts`):
```ts
marketCap: 'Other',   // hardcoded for every holding
```

With the AMFI stock list:
```ts
marketCap: amfiStockList.get(holding.isin) ?? 'Other',
```

And large_cap_pct / mid_cap_pct / small_cap_pct would be computed by summing the
weighted holdings instead of reading from category rules.

Reference: SEBI Circular SEBI/HO/IMD/DF3/CIR/P/2017/114 (October 2017), amended 2018.

### 4. The AMFI consolidated portfolio disclosure is worth evaluating first

SEBI requires every AMC to submit its full portfolio monthly to AMFI. AMFI publishes
a consolidated portfolio disclosure covering all AMCs and schemes. If this data is
available in a structured format — even as a large CSV or XML — it would be a single
endpoint covering every fund, updated monthly, with official AMC-sourced data.

The important question is: does AMFI's consolidated portfolio disclosure include
asset allocation breakdowns (not just holdings lists)? The evidence in Stage 1 shows
individual AMC websites do. Whether AMFI's consolidated file does is unclear from
Stage 1's research because Stage 1 did not check this source.

Before M12 builds 16 AMC-specific parsers, a single proof-of-concept check against
`amfiindia.com/modules/PortfolioAllAMCs` would either:
- Confirm it provides structured allocation + holdings data → one endpoint replaces
  all AMC parsers for domestic funds
- Confirm it does not → proceed with AMC parsers as Codex proposed

### 5. Sync reliability is broken independent of source choice

The current sync function (`sync-fund-portfolios`) has no retry logic. If `mfdata.in`
returns a transient HTTP 500 or 429, the scheme silently falls back to category rules
and the error is logged but never retried. Under the new multi-source model this will
get worse — AMC website parsers will be slower and more error-prone than a single API.

This is not a data source question. It needs to be fixed in the sync infrastructure
before or alongside M12.

Specific gaps:
- `fetchJson` (line 109–133): 10s timeout, single attempt, no retry
- per-scheme catch block (line 359–361): logs error, returns `error: String(err)`, no
  exponential backoff, no re-queue
- no dead-letter mechanism: failed schemes are permanently stuck on category rules
  until the next hourly cron succeeds

### 6. PPFAS category_rules assignment is wrong

PPFAS Parag Parikh Flexi Cap is a domestic flexi cap fund. The sync function decides
which category rule to apply via `getCategoryRules(schemeCategory)` where
`scheme_category` is the SEBI category string from the fund row.

For PPFAS specifically, the `scheme_category` value matters. If it is `'flexi cap fund'`
the rules give `equity: 93`, which is more correct than `other: 100`. The Stage 1
research observed the PPFAS portfolio is richer than a flat model can express, but
the immediate problem is that for overseas-holdings detection, the code checks
`catRules.other === 100` (line 187) — which fires for the `fund of funds investing
overseas` category, not for PPFAS. PPFAS should be going through the normal equity
path and getting category rules applied.

This warrants a check: what is the actual `scheme_category` value stored in the DB
for PPFAS scheme_code 122639?


## Summary Of Recommended Changes Vs Stage 1

| Conclusion | Stage 1 (Codex) | This Review |
|---|---|---|
| Official AMC > mfdata for allocation | Yes | Agree |
| mfdata equity_pct field is reliable | Not addressed | Yes, it matches official for the cases tested |
| mfdata debt_holdings are available | Not checked | Likely yes, but ignored by current code |
| Market cap fix | Requires AMC parsers | No — AMFI biannual stock list is a cleaner fix |
| AMFI consolidated portfolio as a source | Not mentioned | Should be evaluated before AMC parsers |
| AMC-specific parsers (16 AMCs) | Primary M12 path | Still likely needed, but later and for enrichment only |
| Sync reliability (retry/backoff) | Not mentioned | Must be fixed alongside M12 |
| PPFAS categorisation | Highlighted as FoF special case | PPFAS is not an FoF — check scheme_category in DB |


## Recommended Direction For M12 And M13

M12 should be split into two phases:

- **Phase A — Quick wins (no new source required):** Fix the code bugs identified above.
  Expand the `MfdataHoldings` interface to capture debt and other holdings. Integrate the
  AMFI biannual stock categorisation list for market cap. Add input validation to reject
  implausible equity_pct values. Add one retry with exponential backoff to `fetchJson`.
  These changes improve data quality in days without depending on new parsers.

- **Phase B — Source migration:** First evaluate the AMFI consolidated portfolio
  disclosure as a structured source. Only if it is insufficient, proceed with per-AMC
  parsers in the tier order Codex defined (DSP, HDFC, PPFAS, Motilal, Mirae, ICICI first).

M13 can start its Fund Detail redesign once Phase A lands, without waiting for Phase B.


## Sources

- `supabase/functions/sync-fund-portfolios/index.ts` (code audit)
- `supabase/migrations/20260420000000_portfolio_insights_schema.sql`
- `src/hooks/usePortfolioInsights.ts`
- Stage 1 research: `docs/research/2026-04-21-composition-source-validation.md`
- SEBI Circular SEBI/HO/IMD/DF3/CIR/P/2017/114 — Large/Mid/Small Cap categorisation
- AMFI portfolio disclosure mandate: SEBI (Mutual Funds) Regulations 1996, Regulation 59

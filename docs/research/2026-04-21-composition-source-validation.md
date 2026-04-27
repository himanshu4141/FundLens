# Composition Source Validation

Date: 2026-04-21

Author: Codex

## Goal

Decide which source should be treated as the best available source of truth for fund composition data before planning any sync-layer or app-layer implementation changes.

This report is intentionally limited to research and findings. It does not propose schema changes, sync changes, or UI changes beyond high-level implications that feed Stage 2 and Stage 3 planning.

## Executive Summary

The evidence from the current portfolio sample and representative AMC source checks supports these conclusions:

1. Official AMC disclosures are the strongest candidate for canonical asset-allocation data.
2. Official AMC disclosures often also win for sector and holding data for domestic schemes.
3. `mfdata.in` is still useful, but mostly for metadata, related variants, family linkage, and selective enrichment.
4. `mfdata.in /families/{family_id}/allocation` does not currently have enough coverage to be treated as a primary source.
5. International fund-of-funds schemes justify a richer source-native model because both official and unofficial sources expose structures that are more informative than a flat `equity / debt / cash / other` split.

The most important practical conclusion is:

- For domestic funds, official AMC data should be treated as the preferred source for asset allocation, sectors, and holdings when available.
- For international FoFs, official AMC data often gives the best top-level structure, while `mfdata.in` can still add useful underlying fund or ETF detail when official holdings are partial or absent.

## Scope

This research pass covered:

- top AMC shortlist built from March 2026 AUM leaders plus folio-relevance signals
- concrete comparison of current held funds and representative high-priority schemes
- official AMC disclosure coverage for:
  - asset allocation
  - sector breakdown
  - holdings
  - international FoF disclosures
- `mfdata.in` coverage for:
  - `/schemes/{scheme_code}`
  - `/families/{family_id}/allocation`
  - `/families/{family_id}/holdings`

This research pass did not attempt a full crawler-grade audit of 45 schemes. It is a source-validation study intended to support the next planning step.

## Methodology

1. Reviewed the current repository implementation:
   - `supabase/functions/sync-fund-portfolios/index.ts`
   - `supabase/functions/sync-fund-meta/index.ts`
   - `src/hooks/usePortfolioInsights.ts`
   - `src/hooks/useFundComposition.ts`
   - `app/portfolio-insights.tsx`
   - `app/fund/[id].tsx`
2. Queried live `mfdata.in` endpoints for held schemes and representative families.
3. Pulled official AMC pages, factsheets, and disclosure snippets from primary AMC websites.
4. Compared:
   - top-level asset allocation coverage
   - sector coverage
   - holdings coverage
   - special handling for international FoFs

## Current Repository Findings

The current app behavior is important context for evaluating source quality:

- `sync-fund-portfolios` currently pulls richer composition from `mfdata.in` holdings, not from official AMC disclosures.
- For `source='amfi'` rows, the app currently keeps `equity_pct` from `mfdata.in` but derives `debt_pct`, `cash_pct`, `other_pct`, and market-cap splits from category rules.
- Debt and other holdings are not stored in `fund_portfolio_composition`.
- `Portfolio Insights` and the fund composition tab only render:
  - asset mix
  - market-cap mix
  - sector breakdown
  - top holdings
- The fund detail composition tab does not currently expose debt holdings or other holdings.

This means the current pipeline is already lossy even before comparing source quality.

## AMC Shortlist

### March 2026 AUM leaders

Source: Cafemutual, April 7 2026, based on March 2026 AAUM data:

- SBI Mutual Fund
- ICICI Prudential Mutual Fund
- HDFC Mutual Fund
- Nippon India Mutual Fund
- Kotak Mahindra Mutual Fund
- Aditya Birla Sun Life Mutual Fund
- UTI Mutual Fund
- Axis Mutual Fund
- Tata Mutual Fund
- DSP Mutual Fund
- Mirae Asset Mutual Fund
- Bandhan Mutual Fund
- Edelweiss Mutual Fund
- PPFAS Mutual Fund
- Invesco Mutual Fund

Reference:

- https://cafemutual.com/news/industry/37406-which-are-the-top-mutual-fund-companies-as-of-fy-2026

### Folio-relevance signals

Latest reliably discoverable folio-leader evidence in this pass came from FY25 articles and snippets rather than a single March 2026 AMC folio ranking table.

Strong folio-relevance signals were found for:

- Nippon India Mutual Fund
- ICICI Prudential Mutual Fund
- HDFC Mutual Fund
- SBI Mutual Fund
- Axis Mutual Fund
- Aditya Birla Sun Life Mutual Fund
- Kotak Mutual Fund
- Motilal Oswal Mutual Fund
- DSP Mutual Fund
- Tata Mutual Fund
- PPFAS Mutual Fund

References:

- https://cafemutual.com/news/industry/34821-which-fund-houses-command-the-highest-folios-in-fy-2025
- https://www.business-standard.com/markets/news/top-five-fund-houses-account-for-58-percent-of-folio-growth-in-fy25-125050800597_1.html

### Practical shortlist used for research

For the purposes of Stage 1, the high-priority shortlist is:

1. SBI Mutual Fund
2. ICICI Prudential Mutual Fund
3. HDFC Mutual Fund
4. Nippon India Mutual Fund
5. Kotak Mahindra Mutual Fund
6. Aditya Birla Sun Life Mutual Fund
7. UTI Mutual Fund
8. Axis Mutual Fund
9. Tata Mutual Fund
10. DSP Mutual Fund
11. Mirae Asset Mutual Fund
12. Bandhan Mutual Fund
13. Edelweiss Mutual Fund
14. PPFAS Mutual Fund
15. Invesco Mutual Fund
16. Motilal Oswal Mutual Fund

The union produced 16 names because Motilal Oswal was folio-relevant while sitting outside the March 2026 top-15 AUM list.

## Concrete Scheme Comparisons

### Evidence Matrix

| Scheme | Official asset allocation | Official sectors | Official holdings | `mfdata` `/allocation` | `mfdata` `/holdings` | Key finding |
|---|---|---|---|---|---|---|
| DSP Large Cap Fund (`119250`) | Yes | Yes | Yes | `null` | Yes | Official AMC page is clearly better for canonical asset mix. |
| DSP Aggressive Hybrid Fund (`119019`) | Yes | Yes | Yes | `null` | No live scheme payload returned in this pass | Official AMC page is clearly better for canonical asset mix. |
| HDFC Flexi Cap Fund (`118955`) | Yes | Yes | Yes | not checked in this pass | Yes | Official HDFC factsheet is richer and internally sane. |
| Parag Parikh Flexi Cap Fund (`122639`) | Yes, richer than 4 buckets | Yes | Yes | `null` | Yes | Official source wins for truthful structure; `mfdata` may still help as enrichment. |
| DSP Global Innovation Overseas Equity Omni FoF (`149816`) | Yes, top-level only | No useful official sector data | Underlying fund/ETF weights only | `null` | Yes | Official source gives better top-level structure; `mfdata` adds underlying detail. |
| DSP US Specific Equity Omni FoF (`119252`) | Official portfolio page exists, but holdings/sector coverage is effectively absent in sampled page | No | No useful official holdings in sampled page | `null` | Yes | `mfdata` adds useful FoF detail, but top-level totals are unreliable. |
| Motilal Oswal Nifty 500 Momentum 50 Index Fund (`152875`) | Yes | Yes | Yes | not checked in this pass | not checked in this pass | Official scheme page directly exposes composition and portfolio downloads. |
| Mirae Asset Multicap Fund (representative factsheet sample) | Yes | Yes | Top holdings shown | not checked in this pass | not checked in this pass | Official factsheet is rich enough for allocation, market-cap, sectors, and top holdings. |

### Detailed Notes

#### DSP Large Cap Fund (`119250`)

Official DSP scheme page:

- Benchmark: `BSE 100 (TRI)`
- Current asset allocation as of Feb 28, 2026:
  - Equity & equity related securities: `89.43%`
  - Debt instruments: `9.83%`
  - TREPS: `9.83%`
- Equity holdings, sector allocation, and debt holdings are all exposed on the same official page.

Reference:

- https://www.dspim.com/ifaxpress/mutual-fund-schemes/equity-funds/large-cap-fund/dspte-regular-growth

`mfdata.in` results:

- `/schemes/119250` returned expected metadata, including benchmark and `morningstar=3`.
- `/families/760/allocation` returned:
  - `allocations: null`
  - `portfolio_date: null`
- `/families/760/holdings` returned:
  - `equity_pct=89.43`
  - `debt_pct=49.29`
  - `other_pct=1.98`
  - total = `140.70`

Finding:

- The official AMC page is suitable for canonical asset allocation.
- `mfdata` holdings are useful for enrichment, but the top-level mix is not safe as a canonical split.

#### DSP Aggressive Hybrid Fund (`119019`)

Official DSP scheme page:

- Current asset allocation as of Mar 31, 2026:
  - Equity & equity related securities: `71.01%`
  - Debt instruments: `29.4%`
  - Cash & cash equivalents: `-0.41%`
- The page also exposes debt instrument break-up, debt holdings, equity holdings, and sector details.

Reference:

- https://www.dspim.com/ifaxpress/mutual-fund-schemes/hybrid-funds/aggressive-hybrid-fund/dspbl-regular-growth

`mfdata.in` results gathered earlier in this session:

- `/schemes/119019` previously returned:
  - benchmark: `CRISIL Hybrid 35+65 - Agg TR INR`
  - `risk_label: High Risk`
  - `morningstar: 4`
- `/families/772/allocation` returned `null`
- `/families/772/holdings` previously returned:
  - `equity_pct=66.68`
  - `debt_pct=27.47`
  - `other_pct=2.23`
  - total = `96.38`

Finding:

- Even where `mfdata` totals are not obviously impossible, the official AMC source is still richer and more trustworthy for canonical allocation.

#### HDFC Flexi Cap Fund (`118955`)

Official HDFC March 2026 factsheet:

- `EQUITY & EQUITY RELATED`: `95.48`
- `DEBT & DEBT RELATED`: `0.55`
- `Cash, Cash Equivalents and Net Current Assets`: `3.97`
- Top holdings, sector distribution, and market-cap exposure are all present.

Reference:

- https://files.hdfcfund.com/s3fs-public/2026-04/HDFC%20MF%20Factsheet%20-%20March%202026.pdf

`mfdata.in` results:

- `/families/{family_id}/holdings` for this scheme previously returned:
  - `equity_pct=90.43`
  - `debt_pct=0.51`
  - `other_pct=0.06`
  - total = `91.00`

Finding:

- Official HDFC disclosure is richer and more complete than `mfdata` for both canonical asset mix and holdings context.

#### Parag Parikh Flexi Cap Fund (`122639`)

Official PPFAS March 2026 factsheet and portfolio disclosure show a much richer structure than a flat four-bucket model, including:

- core equity
- arbitrage and special situations
- overseas securities / ADRs
- debt and money market instruments
- mutual fund units
- REIT / InvIT exposure

References:

- https://amc.ppfas.com/downloads/factsheet/2026/ppfas-mf-factsheet-for-March-2026.pdf?10042026=
- https://amc.ppfas.com/downloads/factsheet/

`mfdata.in` results:

- `/families/7428/allocation` returned `null`
- `/families/7428/holdings` returned:
  - `equity_pct=78.46`
  - `debt_pct=13.95`
  - `other_pct=4.35`
  - total = `96.76`
  - plus many equity, debt, and other entries

Finding:

- PPFAS is the clearest example that a source-native model is more truthful than blindly normalizing everything into four buckets.
- `mfdata` may still help as enrichment, but official source structure is superior.

#### DSP Global Innovation Overseas Equity Omni FoF (`149816`)

Official DSP scheme page exposes:

- top-level split between `Global` and `Indian`
- Indian side break-up into TREPS and cash equivalents
- underlying holding weights at the fund/ETF level

The same official page also explicitly says:

- overseas portfolio holdings disclosed here may lag
- `NO DATA FOUND` for holdings and sectors in the sampled page state

Reference:

- https://www.dspim.com/invest/mutual-fund-schemes/international-funds/global-innovation-fund-of-fund/dgiof-direct-growth

`mfdata.in` results:

- `/families/784/allocation` returned `null`
- `/families/784/holdings` returned:
  - `equity_pct=52.64`
  - `debt_pct=0`
  - `other_pct=43.67`
  - total = `96.31`
  - useful underlying entries such as:
    - `iShares NASDAQ 100 ETF USD Acc`
    - `BlueBox Funds Global Technology I Acc`

Finding:

- Official source is better for top-level structure.
- `mfdata` can still add useful underlying-fund / ETF detail when official international holdings are sparse or missing.

#### DSP US Specific Equity Omni FoF (`119252`)

Official DSP US FoF page exists, but in the sampled official portfolio section:

- holdings and sector views returned `NO DATA FOUND`

Reference:

- https://www.dspim.com/invest/mutual-fund-schemes/international-funds/us-flexible-equity-fund/dspus-direct-growth

`mfdata.in` results:

- `/families/786/allocation` returned `null`
- `/families/786/holdings` returned:
  - `equity_pct=0`
  - `debt_pct=23.36`
  - `other_pct=95.77`
  - total = `119.13`
  - useful underlying entry:
    - `BGF US Flexible Equity I2`

Finding:

- `mfdata` is useful for identifying the underlying fund and weights.
- `mfdata` is not trustworthy for canonical top-level asset allocation here.
- International FoF support should explicitly allow official top-level data and unofficial enrichment to coexist.

#### Motilal Oswal Nifty 500 Momentum 50 Index Fund (`152875`)

Official Motilal scheme page exposes:

- factsheet and downloadable portfolio files
- direct portfolio composition block
- holdings
- benchmark
- AUM

Reference:

- https://www.motilaloswalmf.com/mutual-funds/motilal-oswal-nifty-500-momentum-50-index-fund

Finding:

- Official scheme pages can be rich enough to support composition without relying on `mfdata`.

#### Mirae Asset representative factsheet sample

Official Mirae factsheet snippet exposes:

- asset allocation
- market-cap split
- top holdings
- top sectors

Reference:

- https://www.miraeassetmf.co.in/docs/default-source/fachsheet/active-factsheet---april-2026.pdf

Finding:

- At least some major AMC official factsheets are already rich enough to support domestic composition directly.

## `mfdata.in` Findings

### What `mfdata.in` is good at

- scheme metadata:
  - benchmark labels
  - `risk_label`
  - `morningstar`
  - `related_variants`
  - family linkage
- holdings enrichment:
  - equity holdings
  - debt holdings
  - other holdings
  - some international FoF underlying fund / ETF detail

### What `mfdata.in` is weak at

- dedicated allocation coverage:
  - `/families/{family_id}/allocation` returned `null` for multiple sampled families:
    - `760`
    - `772`
    - `784`
    - `786`
    - `7428`
- top-level holdings-derived mix:
  - can exceed 100 by a wide margin
  - can contain derivative offset entries and classifications that are not safe to interpret as a clean asset-allocation split

### Concrete `mfdata` examples

| Scheme | Family | `allocation` | `holdings` top-level total | Interpretation |
|---|---:|---|---:|---|
| DSP Large Cap | 760 | `null` | `140.70` | unusable as canonical split |
| DSP Aggressive Hybrid | 772 | `null` | `96.38` | plausible total but still weaker than official |
| Parag Parikh Flexi Cap | 7428 | `null` | `96.76` | plausible total, but official source is richer |
| DSP Global Innovation FoF | 784 | `null` | `96.31` | useful as enrichment |
| DSP US Specific FoF | 786 | `null` | `119.13` | unusable as canonical split |

## Official Source Richness Findings

### Asset allocation

Official AMC disclosures are the best candidate canonical source for asset allocation because they:

- are published by the fund house
- are intended for investor disclosure
- usually present sane totals or explicit sub-bucket structure
- expose information that `mfdata` either misses or flattens

### Sectors

For domestic funds, official AMC pages and factsheets often expose:

- top sector allocations
- market-cap splits
- top holdings

This was directly observed in:

- DSP domestic scheme pages
- HDFC factsheets
- PPFAS factsheets
- Motilal scheme pages
- Mirae factsheets

Conclusion:

- Official sources can often win for sector data too, not just asset allocation.

### Holdings

For domestic funds, official sources often publish:

- full or top holdings
- debt instrument break-up
- cash / TREPS / money-market components

Conclusion:

- Official sources frequently win for holdings as well, especially when debt holdings matter.

### International FoFs

International FoFs are different:

- official sources often provide a better top-level structure
- official sources may only expose underlying fund names and weights
- official sources may fail to expose sectors or security-level holdings at all
- `mfdata` sometimes fills that gap with useful underlying detail

Conclusion:

- International FoFs are the strongest argument for a richer source-native model instead of a flat four-bucket-only model.

## Final Findings

### 1. Can official AMC / AMFI be canonical for asset allocation?

Yes, that is the best default conclusion from this research.

Reason:

- official AMC sources consistently outperform `mfdata` on top-level composition truthfulness in the sampled schemes
- `mfdata` allocation endpoint coverage was effectively absent in the sampled families
- `mfdata` holdings-derived totals were often impossible or ambiguous

### 2. Can official sources also win for sectors and holdings?

Often yes, especially for domestic schemes.

Reason:

- multiple official AMC sources sampled in this pass already expose sectors and holdings directly
- DSP and HDFC official disclosures are richer than the current app model
- PPFAS official disclosure is richer than both the current app model and the simplified `mfdata` interpretation

### 3. Do international FoFs justify a richer source-native model?

Yes.

Reason:

- official sources expose meaningful buckets like `Global`, `Indian`, `TREPS`, cash equivalents, underlying funds, REITs, and arbitrage
- `mfdata` sometimes adds underlying ETF or fund detail that official pages omit
- flattening these structures into `equity / debt / cash / other` loses decision-useful information

### 4. Where is `mfdata.in` still valuable?

`mfdata` still looks valuable for:

- `risk_label`
- `morningstar`
- benchmark labels
- related variants
- family linkage
- enrichment for missing holdings or international FoF underlying detail

It does not currently look strong enough to be the primary source of canonical asset allocation.

## Recommended Direction For Stage 2 And Stage 3

This section is intentionally high-level. Detailed plans live in the Stage 2 and Stage 3 documents.

- Stage 2 should assume:
  - official AMC / AMFI first for asset allocation
  - official sources first for sectors and holdings when available
  - `mfdata` for metadata, variants, and gap-filling enrichment
  - a source-native storage model is likely warranted
- Stage 3 should assume:
  - the app should surface richer fund composition where it exists
  - debt and other holdings should no longer be discarded
  - international FoFs need a different presentation model than domestic equity funds

## Sources

- https://cafemutual.com/news/industry/37406-which-are-the-top-mutual-fund-companies-as-of-fy-2026
- https://cafemutual.com/news/industry/34821-which-fund-houses-command-the-highest-folios-in-fy-2025
- https://www.business-standard.com/markets/news/top-five-fund-houses-account-for-58-percent-of-folio-growth-in-fy25-125050800597_1.html
- https://www.dspim.com/ifaxpress/mutual-fund-schemes/equity-funds/large-cap-fund/dspte-regular-growth
- https://www.dspim.com/ifaxpress/mutual-fund-schemes/hybrid-funds/aggressive-hybrid-fund/dspbl-regular-growth
- https://files.hdfcfund.com/s3fs-public/2026-04/HDFC%20MF%20Factsheet%20-%20March%202026.pdf
- https://amc.ppfas.com/downloads/factsheet/2026/ppfas-mf-factsheet-for-March-2026.pdf?10042026=
- https://amc.ppfas.com/downloads/factsheet/
- https://www.motilaloswalmf.com/mutual-funds/motilal-oswal-nifty-500-momentum-50-index-fund
- https://www.miraeassetmf.co.in/docs/default-source/fachsheet/active-factsheet---april-2026.pdf
- https://mfdata.in/

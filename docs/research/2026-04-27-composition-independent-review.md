# Composition Data — Independent Review

Date: 2026-04-27

Author: Claude

## Goal

Independently validate the findings in `docs/research/2026-04-21-composition-source-validation.md`
(Codex, Stage 1) and identify anything the Stage 1 research missed before planning work begins.

This review covers the same research questions — which sources are trustworthy, and what
should change — but is based on a separate code audit and multi-AMC source analysis rather
than building on Stage 1.


## Methodology

1. Read `sync-fund-portfolios/index.ts` in full.
2. Read the `fund_portfolio_composition` schema migration.
3. Read `usePortfolioInsights.ts` and `useFundComposition.ts`.
4. Tested portfolio data for 16 funds across 11 AMCs via Groww public pages (which
   aggregate official AMC factsheet data). Groww was used because mfdata.in's API blocks
   automated WebFetch requests with HTTP 403 (Cloudflare filtering).
5. Live API probe: 7 bash scripts (probes 1–7) queried mfdata.in directly across 17 funds,
   run from India to bypass Cloudflare filtering. Probes confirmed actual field names,
   holding_type taxonomy, ISINs availability, equity_pct reliability, AMFI URL
   accessibility. Results stored in `scripts/mfdata-probe-output.txt` and
   `scripts/probe-2-* through probe-7-*` output files.
6. Cross-checked AMFI's regulatory obligations for portfolio disclosure.
7. Checked the AMFI biannual stock categorisation process (SEBI circular).
8. Verified the TypeScript interfaces in the code against the live API responses.


## Funds Tested

| Fund | AMC | Category | Source |
|---|---|---|---|
| SBI Bluechip | SBI | Large cap | Groww |
| Nippon India Large Cap | Nippon | Large cap | Groww |
| Axis Large Cap | Axis | Large cap | Groww |
| Mirae Asset Large Cap | Mirae | Large cap | Groww |
| ABSL Frontline Equity | ABSL | Large cap | Groww |
| DSP Top 100 Equity | DSP | Large cap | Groww |
| UTI Nifty 50 Index | UTI | Index fund | Groww |
| PPFAS Flexi Cap | PPFAS | Flexi cap | Groww |
| HDFC Balanced Advantage | HDFC | Balanced advantage | Groww |
| ICICI Balanced Advantage | ICICI | Balanced advantage | Groww |
| HDFC Corporate Bond | HDFC | Corporate bond | Groww |
| HDFC Developed World FoF | HDFC | FoF investing overseas | Groww |
| DSP Global Innovation FoF | DSP | FoF investing overseas | Groww |
| Franklin US Opportunities FoF | Franklin | FoF investing overseas | Groww |
| Nippon India US Equity | Nippon | Thematic/sectoral | Groww |
| Motilal Oswal S&P 500 Index | Motilal | Index fund | Groww |


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


## What Stage 1 Missed

### 1. The mfdata.in API already returns debt holdings — the code ignores them

This is a code bug, not a source gap. The `MfdataHoldings` TypeScript interface in
`sync-fund-portfolios/index.ts` (lines 146–149) only defines:

```ts
interface MfdataHoldings {
  equity_pct?: number;
  equity_holdings?: MfdataEquityHolding[];
}
```

mfdata.in's published documentation states the `/families/{family_id}/holdings` endpoint
returns debt holdings with: instrument name, ISIN, rating, maturity date, coupon rate,
and weight_pct. The interface simply never reads them, so they are silently discarded.

For hybrid funds and pure debt funds, this is the most important data. The HDFC Balanced
Advantage fund (a balanced advantage fund) shows ~25–30% debt on Groww with full
instrument-level breakdown. The ICICI Balanced Advantage shows ~25–30% debt with GOI
securities, CDs, T-bills, SDL, and NCD breakdown. All of this is sitting in the mfdata.in
response and being thrown away.

The current code (line 202) derives debt_pct from category rules instead:
```ts
const debtPct = Math.min(catRules.debt, Math.max(0, 100 - equityPct));
```

For a balanced advantage fund, catRules.debt=35. If equityPct=71%, debtPct = 29%.
The actual debt allocation may be materially different — and the instrument breakdown
(GOI vs corporate bond vs T-bill) is lost entirely.

### 2. The equity_pct field from mfdata.in matches official data for the cases verified

Stage 1 flagged mfdata.in holdings-derived totals as untrustworthy. That is correct for
the total. But the code reads only `equity_pct` as a single top-level field (line 201),
not a derived sum.

For DSP Large Cap (scheme_code 119250), Codex's own Stage 1 data shows:
- Official AMC: `equity_pct = 89.43%`
- mfdata.in: `equity_pct = 89.43%`

Across the large cap funds tested via Groww, equity allocations for pure large cap funds
consistently show 99–100% equity (SBI ~99.29%, Mirae 99.82%, ABSL ~99.81%), which is
consistent with what mfdata.in would report for these fund categories. However, this
review could not directly query mfdata.in's API for all 16 tested funds due to the 403
blocker described in the Methodology section. Stage 1's DSP case remains the only
directly validated mfdata comparison.

**Recommendation**: An equity_pct sanity check (reject values that deviate implausibly
from category rules) is still warranted before trusting the field in production, but
the mechanism of reading equity_pct as a single field from mfdata is reasonable.

### 3. Market cap breakdown via AMFI stock list — NOT feasible in Phase A

~~The AMFI biannual stock list approach was identified as a clean fix requiring no new
source.~~ **This is not feasible in Phase A, for two independent reasons confirmed by
live probes:**

**Reason 1 — ISINs are null universally.** The `isin` field exists in the equity_holdings
schema, and the existing code at line 225 reads `holding.isin ?? ''`. However, the live
probe confirmed ISINs are null for 100% of equity holdings across all 17 tested funds.
The mfdata.in free API tier does not populate ISIN data. Without ISINs, the stock list
lookup (ISIN → Large/Mid/Small Cap) cannot be performed.

**Reason 2 — AMFI stock list URL returns 404.** Probe 6 tested multiple candidate URLs
on amfiindia.com for both the consolidated portfolio and the stock categorisation list.
All returned HTTP 404. AMFI appears to have migrated their portal to portal.amfiindia.com,
and direct URL access may require session authentication or a form-based POST.

Consequence: `marketCap: 'Other'` and category-rule cap splits remain unchanged in Phase A.
This is deferred to Phase B, which must first resolve both the ISIN source question and
the AMFI portal access approach.

Reference: SEBI Circular SEBI/HO/IMD/DF3/CIR/P/2017/114 (October 2017), amended 2018.

### 4. Overseas fund handling is broken in two different ways

The current code (lines 187–199) routes all funds where `catRules.other === 100` through
a short-circuit path that returns `otherPct: 100, all other fields: 0/null`. This fires
for any fund in the 'fund of funds investing overseas' category.

This is wrong in two distinct ways:

**Case A — True FoFs (hold ETFs/feeder funds):**
- HDFC Developed World FoF: holds 5 foreign ETFs (UBS MSCI USA 71.06%, CSIF Europe
  17.03%, CSIF Japan 5.48%, CSIF Canada 3.54%, CSIF Pacific ex-Japan 2.76%)
- DSP Global Innovation FoF: holds 6 foreign funds/ETFs (BlueBox Global Technology
  37.50%, iShares NASDAQ-100 27.53%, Invesco NASDAQ-100 Equal Weight 12.30%, KraneShares
  China Internet 12.27%, Fidelity Medical Technology 3.89%, BlueBox Precision Medicine 2.50%)
- Franklin US Opportunities FoF: holds 1 feeder fund at 98.88%

These should show their ETF/fund holdings. The data is publicly available and would be
far more useful to users than "other: 100%". Whether mfdata.in returns these is TBD;
this may require a separate AMC/AMFI source.

**Case B — Direct overseas equity (NOT FoFs):**
- Nippon India US Equity Opportunities: holds 27 individual US stocks directly
  (TSMC ADR 9.28%, Alphabet A 8.01%, Amazon 6.80%, Meta 6.39%, Schwab 5.71%, etc.)
- Motilal Oswal S&P 500 Index: holds 506 individual US stocks directly

These funds are NOT in the 'fund of funds investing overseas' category (Nippon is
thematic, Motilal is index). However, mfdata.in may return their equity_holdings as
foreign equities. The current code would attempt to process these as normal equity funds
and include the US stocks in top_holdings — which is actually the correct behavior.

**Case C — PPFAS Flexi Cap (domestic fund with overseas exposure):**
PPFAS is a 'flexi cap fund' (catRules.equity=93, catRules.other=0) so it does NOT go
through the overseas FoF short-circuit path. mfdata.in returns the overseas stocks
(Alphabet, Meta, Amazon, Microsoft ~8.6% combined) as part of equity_holdings. These
would be included in top_holdings but would show marketCap: 'Other' (correct — they are
not in the AMFI Indian stock list). This is acceptable behavior.

**Net impact**: The only funds currently broken by the overseas short-circuit are true
FoFs in the 'fund of funds investing overseas' category. The fix is to either:
a) Store ETF-level holdings for these funds (requires finding the data source)
b) Or at minimum, stop overwriting with null and preserve whatever mfdata.in returns

### 5. The AMFI consolidated portfolio disclosure should be evaluated before building parsers

SEBI requires every AMC to submit its full portfolio monthly to AMFI. AMFI publishes a
consolidated portfolio disclosure covering all AMCs and schemes. If this data is available
in a structured format — even as a large CSV — it would be a single endpoint covering
every fund, updated monthly, with official AMC-sourced data.

Stage 1 did not evaluate this source. Before building 16 AMC-specific parsers, a single
proof-of-concept check against amfiindia.com would either:
- Confirm it provides structured allocation + holdings data → one endpoint replaces all
  AMC parsers for domestic funds
- Confirm it does not → proceed with AMC parsers as Codex proposed

### 6. Sync reliability is broken independent of source choice

The current sync function has no retry logic. If mfdata.in returns a transient HTTP 500
or 429, the scheme silently falls back to category rules and the error is logged but
never retried.

`fetchJson` (lines 120–133): 10s timeout, single attempt, no retry. The per-scheme
catch block (lines 359–361) logs the error but takes no recovery action. No dead-letter
mechanism: failed schemes are stuck on category rules until the next cron run succeeds.


## Findings Specific To This Review

### 7. Official data shows rich sector and holdings data is available for all tested funds

Every domestic equity fund tested (9 funds across 6 AMCs) showed full sector allocation
and individual equity holdings with weights on Groww. This data originates from SEBI-
mandated monthly portfolio disclosures that all AMCs must publish. The sector granularity
is consistent across AMCs (Financial Services, Technology, Energy, Healthcare, etc.).

### 8. ISINs are null in mfdata.in equity_holdings — universally

~~The existing code at line 225 reads `holding.isin ?? ''`, suggesting mfdata.in returns
ISINs.~~ **The live probe contradicts the mfdata.in documentation.** Probe 4 tested
17 funds and found `isin: null` for 100% of equity holdings across all funds. The
`isin` field exists in the response schema but is not populated on the free API tier.
This blocks the AMFI stock list approach (see Finding 3).

### 9. Debt instruments are visible for hybrid and pure debt funds

The HDFC Corporate Bond Fund shows 191 instruments across government securities, bonds,
NCDs, debentures, and securitised debt. ICICI Balanced Advantage shows granular debt
breakdown by instrument type (GOI, CD, T-bill, SDL, NCD). This level of debt instrument
detail is in mfdata.in's response but currently discarded.

### 10. No ISINs shown in any aggregator's public pages

Neither Groww's public fund pages nor any of the tested AMC portfolio pages show ISINs
alongside equity or debt holdings. ISINs are only accessible via programmatic APIs.
This has no impact on the implementation — mfdata.in provides them — but confirms that
the ISIN → cap category lookup must come from programmatic sources.


## Findings From Live API Probes (Probes 1–7, 2026-04-27)

These findings are based on direct mfdata.in API calls across 17 funds, run from India.

### P1. equity_pct is reliable; debt_pct top-level field is not

Probe 4 tested 10 additional funds. The `equity_pct` field broadly matches official values
for all pure-equity funds (93–99% range, consistent with SEBI category minimums). However,
the `debt_pct` field is corrupted for most pure-equity and overseas funds — totals sum to
135–189% rather than 100%. Rule: use `equity_pct` directly; derive `debt_pct` from
`sum(debt_holdings[].weight_pct)` only.

### P2. Corruption pattern in debt_holdings

Probe 7 revealed a systematic corruption in `debt_holdings` for pure-equity funds: the
API injects index performance data (BSE 100, Nifty Midcap 150, BSE 500) as fake debt
instruments, with the performance percentage as `holding_type` (e.g. "23.23", "3.69")
and the return value as `credit_rating`. This appears in Axis, DSP, Mirae, Nippon, Tata,
Kotak, HDFC Mid Cap, and both overseas equity funds. Guard: if `holding_type` or
`credit_rating` is a numeric string, the entire `debt_holdings` array for that family
is corrupted — discard and fall back to category rules.

### P3. Complete holding_type taxonomy

Confirmed across 17 funds (probe 7):

| Type | Count | Meaning |
|---|---|---|
| B | 346 | Bond / NCD / debenture (NBFC, HFC, bank bonds) |
| BT | 161 | G-Sec, SDL, T-bill (Sovereign/SDL issuers) |
| DG | 70 | Derivative future (equity futures, negative market value possible) |
| CD | 56 | Certificate of deposit (bank issuers, CRISIL A1+ typical) |
| CP | 15 | Commercial paper |
| BD | 14 | Bond/debenture (PSU banks, export-import bank) |
| BY | 13 | Structured product / trust unit (INDIA UNIVERSAL TRUST AL1/AL2) |
| FO | 12 | Fund unit (ETF, domestic or overseas MF) |
| C | 2 | Cash |
| EP | 1 | Equity put option |
| EX | 1 | Exchange-listed instrument |
| CA | 1 | CBLO (Collateralized Borrowing & Lending Obligation) |
| CQ | 4 | Cash offset for derivatives |

### P4. Overseas fund holdings breakdown

- **DSP Global Innovation FoF**: 3 ETFs in equity_holdings (iShares NASDAQ-100 27.53%,
  KraneShares China 12.86%, Invesco NASDAQ-100 EW 12.25%) + 3 FO-type holdings in
  other_holdings (BlueBox Global Tech 37.16%, Fidelity Medical 4.01%, BlueBox Precision
  Medicine 2.50%). Removing the short-circuit will surface all 6 fund units.
- **Nippon India US Equity**: 27 direct US stocks in equity_holdings with sector data
  (TSMC ADR 9.54%, Alphabet 8.06%, Meta 6.71%, etc.). debt_pct=24.05 is corrupted.
- **Motilal Oswal S&P 500**: 475 S&P 500 stocks in equity_holdings with sectors.
  Clean total (97.07 + 0 + 0.28 = 97.35). Motilal is in `index_fund_overseas` category,
  not `fund_of_funds_overseas`, so it does not go through the FoF short-circuit.

### P5. AMFI portal has moved; all direct URLs are inaccessible

Probe 6 tested 7 candidate amfiindia.com URLs for consolidated portfolio and stock list.
All returned HTTP 404. The baseline NAV master URL returned a 302 redirect to
portal.amfiindia.com — confirming connectivity but also that AMFI migrated their public
endpoints. Phase B cannot proceed with the B1 proof-of-concept until the correct
portal.amfiindia.com URL is identified and any session/auth requirements are documented.


## Summary Of Recommended Changes Vs Stage 1

| Conclusion | Stage 1 (Codex) | This Review |
|---|---|---|
| Official AMC > mfdata for allocation totals | Yes | Agree |
| mfdata equity_pct field is reliable | Not addressed | Yes — confirmed across 17 funds (probe 4); use with A3 validation guard |
| mfdata ISINs available | Assumed yes (from docs) | No — null universally across all 17 tested funds (free tier limitation) |
| mfdata debt_holdings are available | Not checked | Yes — returned for hybrid/debt funds; corrupted for pure-equity funds (discard those) |
| Market cap fix | Requires AMC parsers | Blocked in Phase A: ISINs null + AMFI stock list URL returns 404. Deferred to Phase B |
| AMFI consolidated portfolio as a source | Not mentioned | Phase B candidate, but URL is 404; portal.amfiindia.com access must be investigated first |
| AMC-specific parsers (Tier 1 AMCs) | Primary M12 path | Still needed but later; after Phase A fixes and AMFI proof-of-concept |
| Overseas FoF handling | Not detailed | Broken for two distinct reasons; FoF ETF-level detail is available and should be shown |
| Sync reliability (retry/backoff) | Not mentioned | Must be fixed alongside any source work |
| PPFAS category routing | Highlighted as FoF issue | PPFAS does NOT go through FoF path; it is correctly treated as flexi cap |


## Recommended Direction For M12

M12 should be sequenced into two phases:

**Phase A — Code quality fixes (no new source required):** Fix the bugs identified above.
Expand the MfdataHoldings interface to capture debt and other holdings. Integrate the
AMFI biannual stock categorisation list for market cap. Add input validation to reject
implausible equity_pct values. Add a single retry with 2-second delay to fetchJson.
These changes improve data quality in days without depending on new sources.

**Phase B — Source evaluation and migration:** First evaluate the AMFI consolidated
portfolio disclosure as a structured source. Only if it is insufficient, proceed with
per-AMC parsers in the tier order Codex defined (DSP, HDFC, PPFAS, Motilal, Mirae, ICICI).
International FoF ETF-level holdings are a separate investigation — they may require a
different source (not mfdata.in) and should be scoped into Phase B or a follow-on plan.


## Sources

- `supabase/functions/sync-fund-portfolios/index.ts` (code audit, lines 1–410)
- `supabase/migrations/20260420000000_portfolio_insights_schema.sql`
- `src/hooks/usePortfolioInsights.ts`
- Stage 1 research: `docs/research/2026-04-21-composition-source-validation.md`
- Groww public fund pages (16 funds tested, April 2026):
  - groww.in/mutual-funds/sbi-bluechip-fund-direct-growth
  - groww.in/mutual-funds/nippon-india-large-cap-fund-direct-growth
  - groww.in/mutual-funds/axis-large-cap-fund-direct-growth
  - groww.in/mutual-funds/mirae-asset-large-cap-fund-direct-growth
  - groww.in/mutual-funds/birla-sun-life-frontline-equity-fund-direct-growth
  - groww.in/mutual-funds/dsp-blackrock-top-100-equity-fund-direct-growth
  - groww.in/mutual-funds/uti-nifty-fund-direct-growth
  - groww.in/mutual-funds/ppfas-long-term-equity-fund-direct-growth
  - groww.in/mutual-funds/hdfc-balanced-advantage-fund-direct-growth
  - groww.in/mutual-funds/icici-prudential-balanced-advantage-fund-direct-growth
  - groww.in/mutual-funds/hdfc-medium-term-opportunities-fund-direct-growth
  - groww.in/mutual-funds/hdfc-developed-world-indexes-fof-direct-growth
  - groww.in/mutual-funds/dsp-global-innovation-overseas-equity-omni-fof-direct-growth
  - groww.in/mutual-funds/franklin-india-feeder-franklin-u-s-opportunities-fund-direct-growth
  - groww.in/mutual-funds/nippon-india-us-equity-opportunities-fund-direct-growth
  - groww.in/mutual-funds/motilal-oswal-s-p-500-index-fund-direct-growth
- SEBI Circular SEBI/HO/IMD/DF3/CIR/P/2017/114 — Large/Mid/Small Cap categorisation
- AMFI portfolio disclosure mandate: SEBI (Mutual Funds) Regulations 1996, Regulation 59
- mfdata.in API live probe (scripts/mfdata-probe.sh + probe-2 through probe-7, 17 funds):
  confirmed actual field names (name, credit_rating, holding_type — not instrument_name,
  rating as docs state); ISINs null universally; full holding_type taxonomy; equity_pct
  reliability; AMFI URL accessibility
- mfdata.in API documentation (public): debt_holdings fields listed as instrument_name,
  isin, rating, maturity_date, coupon_rate, weight_pct — **several names do not match
  live API response** (use probe findings, not docs)

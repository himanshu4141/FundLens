# M12 — Composition Data Acquisition

## Status

Proposed


## Goal

Improve the reliability of fund composition data (equity/debt split, market-cap breakdown,
sector allocation, and top holdings) through a two-phase approach: fix code-level data
quality bugs first, then migrate to better upstream sources where those fixes are not
enough.


## User Value

Users are currently seeing:

- equity/debt percentages that are approximations even when better data is available
- market-cap breakdowns that are regulatory minimums, not actual portfolio composition
- every equity holding labelled as market cap "Other" regardless of what it really is
- debt funds and hybrid funds with no breakdown of what they actually hold

This milestone fixes the most impactful issues through targeted, verifiable improvements
rather than a full source migration upfront.


## Context

Two independent research passes agree on the root cause. See:

- Codex Stage 1: `docs/research/2026-04-21-composition-source-validation.md`
- Claude independent review: `docs/research/2026-04-27-composition-independent-review.md`

The agreed findings, confirmed by live API probes across 17 funds (scripts/mfdata-probe*.sh,
probes 1–7, run 2026-04-27):

1. **`debt_pct` field is corrupted for all pure-equity and overseas funds tested.** The
   top-level holdings totals exceed 100% for most large-cap funds (e.g. Axis Large Cap
   equity+debt+other = 156.25%, HDFC Mid Cap = 188.9%). The `debt_pct` field must never
   be used directly; derive it from `sum(debt_holdings[].weight_pct)` instead. Motilal
   Oswal S&P 500 (97.07+0+0.28 = 97.35) and DSP Global Innovation FoF (52.64+0+43.67 =
   96.31) are the only clean totals observed across 17 tested funds.
2. **`/allocation` endpoint is effectively useless.** Probe 2 confirmed: while the
   endpoint's outer wrapper object is not null, the actual `allocations` and
   `portfolio_date` fields are null for all 7 tested funds. Do not plan any work around
   this endpoint.
3. **`equity_pct` is reliable as a single field.** Probe 4 shows pure equity large-cap
   funds (Axis 93.65%, Mirae 99.18%, Nippon 99.27%, Tata 97.09%, Kotak 98.23%) all
   broadly match official values even when the debt total is corrupted. PPFAS at 78.46%
   appears wrong vs SEBI category (flexi cap ~65% min) but is actually correct: PPFAS
   genuinely holds 79 debt instruments (T-bills, CDs, CPs worth ~22% of AUM). Treat
   `equity_pct` as reliable, with the validation guard from A3 as a safety net.
4. **ISINs are null universally.** Confirmed across all 17 funds in probes 1–4. Zero
   exceptions. The `isin` field exists in the equity_holdings schema but the free API
   tier does not populate it. Market-cap classification via ISIN lookup is not possible.
5. **AMFI consolidated portfolio and stock list are inaccessible via direct URL.** Probe
   6 confirmed all tested amfiindia.com URLs return HTTP 404. Only the NAV master
   redirected to portal.amfiindia.com — suggesting AMFI moved their portal. Phase B must
   identify the correct portal URL or use an alternative access method before any AMFI-
   based approach can proceed.
6. **Overseas FoFs use both equity_holdings and other_holdings for fund units.** DSP
   Global Innovation FoF puts 3 ETFs in equity_holdings (iShares NASDAQ-100 27.53%,
   KraneShares China 12.86%, Invesco NASDAQ-100 EW 12.25%) and 3 funds in other_holdings
   with holding_type='FO' (BlueBox Global Tech 37.16%, Fidelity Medical 4.01%, BlueBox
   Precision Medicine 2.50%). Removing the overseas FoF short-circuit (A4) will surface
   all of these. Nippon India US Equity and Motilal S&P 500 return full individual stock
   lists (27 and 475 holdings respectively) in equity_holdings with sector data.


## Assumptions

- Both research reports have been reviewed.
- Phase A requires a schema change: one new `raw_debt_holdings JSONB` column on
  `fund_portfolio_composition` to store the debt instrument detail from mfdata.in.
  This is a small additive migration with no impact on existing queries.
- Phase B will likely require a more significant schema change; design before implementing.
- True international FoF ETF-level holdings (HDFC Developed World, DSP Global Innovation,
  Franklin US) require a separate data source investigation. This is deferred to Phase B
  or a follow-on plan — it should not block Phase A.


## Definitions

- **AMFI stock list**: AMFI's biannual SEBI-mandated classification of every BSE/NSE
  stock as Large Cap (rank 1–100), Mid Cap (rank 101–250), or Small Cap (rank 251+),
  based on 6-month average market capitalisation. Published every January and July.
  All AMCs must use this list for their own categorisation.
- **AMFI consolidated portfolio**: A monthly portfolio disclosure that SEBI requires all
  AMCs to submit to AMFI. Published at amfiindia.com, potentially in a machine-readable
  format covering all schemes.
- **Category rules**: The hardcoded SEBI regulatory minimum allocations in
  `sync-fund-portfolios/index.ts` used as fallback when API data is unavailable.
- **Source-native data**: Raw portfolio buckets as disclosed by the upstream source,
  before any normalisation into the app's four-bucket model.


## Scope

**Phase A — Code quality fixes (no new source required):**
- Expand the `MfdataHoldings` TypeScript interface to capture debt and other holdings
  that the API already returns but the code silently discards
- Store captured debt holdings in a new `raw_debt_holdings JSONB` column alongside
  `top_holdings` (requires additive migration)
- Compute `debt_pct` from actual debt holding weights instead of category rules
- Integrate the AMFI biannual stock list to replace `marketCap: 'Other'` hardcode
- Fix overseas fund handling: the current code routes all 'fund of funds investing
  overseas' to `otherPct: 100, holdings: null`. At minimum, stop overwriting holdings
  with null and preserve whatever mfdata.in returns. ETF-level detail for true FoFs
  is deferred to Phase B.
- Add equity_pct sanity check: reject values that deviate from category rules by more
  than 25pp for pure equity or pure debt fund categories (these indicate API data issues)
- Add one retry with 2-second delay to `fetchJson` for transient HTTP errors

**Phase B — Source evaluation and migration:**
- Proof-of-concept: fetch and parse one month of AMFI consolidated portfolio disclosure
- Decision: is AMFI consolidated sufficient as a primary source for asset allocation?
  - If yes: migrate `sync-fund-portfolios` to use it as the primary source
  - If no: proceed with per-AMC parsers for Tier 1 AMCs (DSP, HDFC, PPFAS, Motilal,
    Mirae, ICICI) as Codex's M12 proposed
- Investigate ETF-level holdings for international FoFs (HDFC Developed World, DSP
  Global Innovation, Franklin US) — identify source and store ETF names + weights


## Out of Scope

- App UI changes (those belong to M13)
- International FoF deep structure (separate follow-on)
- Historical composition data / trending
- Schema changes driven by full source-native storage model (Phase B only)


## Approach

### Phase A — Code quality fixes

#### A1. Expand MfdataHoldings interface and capture debt holdings

The `MfdataHoldings` interface in `sync-fund-portfolios/index.ts` currently only defines:
```ts
interface MfdataHoldings {
  equity_pct?: number;
  equity_holdings?: MfdataEquityHolding[];
}
```

Live API probe (2026-04-27, scripts/mfdata-probe-output.txt) confirmed the actual field
names in debt and other holdings. Use these — not the earlier draft names:

```ts
interface MfdataDebtHolding {
  name?: string;            // instrument name e.g. "6.90% Gs 2065", "Kotak Mahindra Bank (24/09/2026)"
  credit_rating?: string;   // e.g. "Sovereign", "CRISIL A1+", "ICRA AA+"
  maturity_date?: string | null;
  holding_type?: string;    // debt: B=bond, BT=G-Sec/T-bill, BD=bond/debenture, CD=cert of deposit, CP=commercial paper, BY=structured product/trust
                            // other: FO=fund unit, DG=derivative future, CQ=derivatives cash offset, EP=put option, CA=CBLO, C=cash, EX=exchange-listed
                            // WARNING: some families return numeric strings (e.g. "-18.07", "23.23") as holding_type — this is data corruption
  market_value?: number | null;
  weight_pct?: number;
  quantity?: number | null;
  month_change_qty?: number | null;
  month_change_pct?: number | null;
}

// other_holdings uses the same shape — it contains derivatives offsets, mutual fund units, etc.
type MfdataOtherHolding = MfdataDebtHolding;

interface MfdataHoldings {
  equity_pct?: number;
  debt_pct?: number;
  other_pct?: number;
  equity_holdings?: MfdataEquityHolding[];
  debt_holdings?: MfdataDebtHolding[];
  other_holdings?: MfdataOtherHolding[];
}
```

Note: `isin` is NOT present in debt or other holdings. The `equity_holdings` schema
includes an `isin` field but it was null for all 7 tested funds — ISINs appear to be
unavailable from mfdata.in's free API tier.

When debt_holdings are present and at least some have a valid weight_pct, compute
`debt_pct` from summing those weights instead of using category rules. Do NOT trust the
top-level `debt_pct` field from mfdata directly — DSP Large Cap showed debt_pct=49.29
on a pure equity fund (the field is corrupted for some families). Derive it from holdings.

Store the individual debt instruments in a new `raw_debt_holdings JSONB` column.

Data quality guard: if any debt_holding has a `credit_rating` OR `holding_type` that is
a numeric string (e.g. credit_rating: "-14.30", holding_type: "-18.07", holding_type:
"23.23"), that family's debt data is corrupted — discard it entirely and fall back to
category rules for debt_pct. Both fields can carry the corruption; check both.

#### A2. Market-cap classification — DEFERRED to Phase B

The original plan was to use the AMFI biannual stock list (ISIN → Large/Mid/Small Cap)
to replace the `marketCap: 'Other'` hardcode in buildPortfolioFromHoldings.

**This is not feasible in Phase A.** The live API probe confirmed that `isin` is null
for all equity holdings returned by mfdata.in. Without ISINs, the stock list lookup
cannot be done from holdings data alone.

Name-based matching (stock_name → AMFI list company name) is fragile due to name
variations and is not a viable substitute.

Phase B, when evaluating the AMFI consolidated portfolio disclosure, should check
whether that source provides ISINs alongside holdings. If it does, the stock list
lookup can be implemented as part of Phase B's schema work.

For Phase A: market-cap classification remains at `marketCap: 'Other'` and
large_cap_pct / mid_cap_pct / small_cap_pct remain at category-rule values. This
is unchanged from today.

#### A3. Input validation for equity_pct

Add a plausibility check before trusting `mfdata.in`'s `equity_pct`:

- For fund categories with `catRules.equity >= 80` (pure equity funds): reject if
  `equity_pct < 50` (fund cannot be less than half equity and still be pure equity)
- For fund categories with `catRules.equity <= 10` (pure debt/money market funds): reject
  if `equity_pct > 20` (debt fund cannot have significant equity without a disclosure event)
- On rejection: log a warning with scheme_code and both values; fall back to category rules

This prevents bad API responses from corrupting production data silently.

#### A4. Fix overseas FoF null-overwrite

The current code (lines 187–199) routes all funds where `catRules.other === 100` through
a short-circuit path that returns `otherPct: 100, sectorAllocation: null, topHoldings: null`.
This fires for any fund in the 'fund of funds investing overseas' category.

This is wrong: it overwrites potentially useful data from mfdata.in with nulls. Some
overseas FoFs return ETF holdings from mfdata.in; others return null. The current code
discards everything.

Fix: remove the short-circuit early return. Let `buildPortfolioFromHoldings` run for all
fund categories. If mfdata.in returns holdings for an overseas FoF, they will be stored.
If it returns nothing, the `!holdings.equity_holdings?.length` guard (line 320) already
falls back to category rules. No net behaviour change for funds where mfdata returns
nothing; improved data for funds where it returns ETF names.

The live probe confirmed this works: HDFC Developed World FoF (family 1387) returns
`equity_holdings[0]: "UBS MSCI USA NSL ETF USD acc"` at 70.37% and 4 more ETFs in
`other_holdings`. This data is available from mfdata today and is being thrown away.
Removing the short-circuit is sufficient to surface it — no new source needed.

#### A5. Retry logic in fetchJson

Add a single retry with 2-second delay for transient HTTP errors (5xx, 429, network
timeout). The current code makes one attempt and silently falls back to category rules
on failure.

```ts
async function fetchJson(url: string, retries = 1): Promise<unknown> {
  // ... existing fetch logic ...
  // on non-ok status: if retries > 0 and status >= 500, wait 2s then retry
}
```

A single retry is sufficient for hourly cron context. Do not add exponential backoff
beyond this — the function processes many schemes per invocation and a long retry chain
would exceed the edge function timeout.

---

### Phase B — Source evaluation and migration

#### B1. AMFI consolidated portfolio proof-of-concept

Before building any per-AMC parser, verify whether AMFI's consolidated portfolio
disclosure can serve as the primary source.

SEBI regulation 59 of the SEBI (Mutual Funds) Regulations 1996 requires each AMC to
submit its full portfolio to AMFI monthly. AMFI publishes this at amfiindia.com.

**Note (probe 6, 2026-04-27):** All tested amfiindia.com direct URLs for consolidated
portfolio and stock categorisation list return HTTP 404. Only the NAV master file works,
redirecting to portal.amfiindia.com. AMFI appears to have migrated their portal. Before
this B1 work begins, the correct portal URL must be identified (likely through
portal.amfiindia.com) and any session/POST requirements must be documented.

Proof-of-concept steps:
1. Identify the correct URL on portal.amfiindia.com for the consolidated portfolio
   disclosure and stock categorisation list. Test whether they require session auth or
   form-based POST.
2. Fetch the most recent consolidated portfolio file.
3. Check format: is it a structured CSV/Excel with per-scheme, per-holding rows? Does it
   include asset allocation percentages or only holding weights?
4. For 3 representative schemes (one large-cap equity, one hybrid, one FoF): compare
   AMFI consolidated data against the official AMC factsheet from Stage 1.
5. Document findings and make a binary decision: AMFI consolidated as primary source
   (yes/no), with concrete reasoning.

**If AMFI consolidated is sufficient:** design a single `sync-amfi-portfolio` edge
function that fetches the monthly file, parses it, and upserts into a new source-native
table. This replaces the per-AMC parser approach for domestic funds.

**If AMFI consolidated is not sufficient:** proceed with per-AMC parsers for Tier 1
AMCs as defined in Codex's M12, starting with DSP (richest official page observed in
Stage 1).

#### B2. Schema design for source-native storage

Regardless of which path B1 takes, a schema change is likely required. Design the schema
before writing any parser. Required capabilities:

- Store raw source bucket names and values (not just normalised four-bucket)
- Store source URL and disclosure date per row
- Store debt holdings and other holdings separately from equity holdings
- Store per-field source labels (equity_pct from 'amfi_consolidated', market_cap from
  'amfi_stock_list', etc.)
- Preserve a derived normalised summary for screens that need it

Do not add nullable columns to `fund_portfolio_composition` indefinitely. Design the
final schema for Phase B in one migration.

#### B3. Tier 1 AMC parser rollout (only if B1 concludes AMFI consolidated is insufficient)

Build parsers for: DSP, HDFC, PPFAS, Motilal Oswal, Mirae Asset, ICICI Prudential.

Each parser must:
- Fetch from the official AMC disclosure URL
- Validate total allocation sums to approximately 100
- Parse asset allocation, sector breakdown, and top holdings
- Store source URL and portfolio_date per row
- Handle failure gracefully — if the parser fails, do not overwrite a previous good row


## Alternatives Considered

- **Phase B before Phase A:** Doing the AMC parser work first. Rejected because Phase A
  fixes bugs that will exist regardless of which source is used. Phase A also produces
  better debt data within days rather than months.
- **AMFI stock list as the only market-cap fix:** Correct. No alternative was seriously
  considered for market-cap — SEBI's mandatory categorisation list is the authoritative
  source and the cleanest solution.
- **Adding more category rules:** Rejected. Category rules are regulatory minimums and
  will always be approximations. The only improvement from more rules is cosmetic.


## Milestones

### Milestone 1 — Phase A implementation

Scope:
- Write additive migration: add `raw_debt_holdings JSONB` column to `fund_portfolio_composition`
- Expand `MfdataHoldings` interface with actual field names confirmed by live probe
- Compute debt_pct from actual debt_holdings weights (guard against corrupted debt arrays)
- Remove the overseas FoF short-circuit that overwrites holdings with null
- Add equity_pct validation guard (A3)
- Add fetchJson retry (A5)

Note: AMFI stock list integration (A2) is NOT in this milestone. ISINs are null
universally on mfdata.in free tier, and AMFI stock list URLs return 404. Market-cap
classification remains at `marketCap: 'Other'` until Phase B resolves both issues.

Expected outcome:
- Debt holdings for hybrid/debt funds visible in `raw_debt_holdings` column
- `debt_pct` derived from actual instrument weights for funds where data is clean
- Overseas FoF holdings no longer wiped to null
- Transient mfdata failures no longer silently corrupt to category rules

Acceptance criteria:
- For a known hybrid fund (HDFC Balanced Advantage or ICICI Balanced Advantage):
  `debt_pct` computed from actual debt holding weights, not category rules
- For HDFC Developed World FoF: equity_holdings (ETFs) visible in DB, not null
- `raw_debt_holdings` column populated with instrument-level data for at least one
  hybrid fund after a sync run

Validation:
```bash
# Trigger sync for a known hybrid and inspect result
curl -X POST https://<project>.supabase.co/functions/v1/sync-fund-portfolios \
  -H 'Authorization: Bearer <service_key>'

# Query DB for DSP Aggressive Hybrid (scheme_code 119019)
# Expect: debt_pct > 0 and not from category rules, large_cap_pct computed from holdings
```

### Milestone 2 — Phase B proof-of-concept

Scope:
- Fetch AMFI consolidated portfolio disclosure
- Compare against 3 AMC factsheets from Stage 1
- Document decision: AMFI consolidated as primary source or not

Expected outcome:
- A short decision memo (append to this plan as an amendment)
- Clear direction for Milestone 3

Acceptance criteria:
- Decision is made with documented evidence, not deferred

### Milestone 3 — Phase B implementation

Scope (depends on Milestone 2 decision):
- Path A: single AMFI consolidated sync function + source-native schema
- Path B: Tier 1 per-AMC parsers (DSP, HDFC, PPFAS, Motilal, Mirae, ICICI) +
  source-native schema

Expected outcome:
- Asset allocation for covered funds sourced from official AMC/AMFI data, not category
  rules
- `source` field distinguishes 'amfi_consolidated', 'amc_official', 'mfdata_enriched',
  'category_rules'

Acceptance criteria:
- For a Tier 1 fund: asset allocation matches the official AMC factsheet within 1pp
- Category rules are only used as fallback for schemes with no official data available


## Validation

Before marking any milestone complete:
1. Run `npm run typecheck` and `npm run lint` — zero errors/warnings
2. For Phase A: compare specific scheme composition in DB against official AMC source
   for at least one equity fund and one hybrid fund
3. For Phase B: verify `source` field is set correctly; no category_rules rows for Tier 1
   funds unless official source was unavailable


## Risks And Mitigations

- Risk: AMFI portal URLs are not directly accessible (probe 6 confirmed all direct
  amfiindia.com URLs return 404). Mitigation: Phase B must begin by identifying the
  correct portal.amfiindia.com URL; if access requires a session or POST, use a
  server-side fetch with appropriate headers rather than assuming a direct CDN link.
- Risk: AMFI stock list URL or format changes. Mitigation: store last-fetched-at and
  alert if refresh fails; the 6-month update cadence gives ample warning time.
- Risk: mfdata debt_holdings field names differ from assumed names. Mitigation: log the
  raw API response for one hybrid scheme before writing any parsing code.
- Risk: AMFI consolidated portfolio proof-of-concept shows the data is not structured
  enough. Mitigation: Phase B already has an explicit fallback path to Tier 1 AMC parsers.
- Risk: AMC website structure changes break parsers. Mitigation: parsers must validate
  totals; a broken parser must not overwrite a previous good row.


## Decision Log

- Decision: Phase A before Phase B.
  Reason: Phase A fixes bugs that exist regardless of source. It also produces measurably
  better data (real market cap, real debt breakdown) in days rather than months.
- Decision: Check AMFI consolidated before building 16 AMC parsers.
  Reason: One endpoint covering all AMCs is far cheaper to operate. The cost of the
  proof-of-concept is one afternoon; the cost of 16 parsers is months of maintenance.
- Decision: Keep mfdata.in as equity holdings enrichment source.
  Reason: equity_pct and equity_holdings are reliable in the tested cases. No need to
  replace this path in Phase A.


## Progress

- [ ] Review both research reports and agree on phasing
- [ ] Phase A: write migration to add raw_debt_holdings column
- [ ] Phase A: expand MfdataHoldings interface and log raw debt response for hybrid fund
- [ ] Phase A: compute debt_pct from actual instrument weights
- [ ] Phase A: integrate AMFI biannual stock list for market cap
- [ ] Phase A: remove overseas FoF short-circuit that nulls out holdings
- [ ] Phase A: add equity_pct validation
- [ ] Phase A: add fetchJson retry
- [ ] Phase A: deploy and verify against hybrid + equity fund in DB
- [ ] Phase B: fetch AMFI consolidated disclosure and document decision
- [ ] Phase B: design source-native schema
- [ ] Phase B: implement chosen path (AMFI consolidated or Tier 1 parsers)
- [ ] Phase B: investigate ETF-level data source for true international FoFs
- [ ] Phase B: deploy and verify Tier 1 fund data against official AMC source

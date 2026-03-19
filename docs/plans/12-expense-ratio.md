# ExecPlan: Milestone 12 — Expense Ratio & Cost Transparency


## Goal


Show users exactly what they are paying to own each fund — the expense ratio as a percentage, the annual cost in rupees — and flag when a user is in a Regular plan instead of the cheaper Direct equivalent, quantifying the savings they are leaving on the table.


## User Value


Studies consistently show that over 60% of Indian retail SIP investors are in Regular plans without knowing it (SEBI, 2022). Regular plans pay a 0.5–1.5% annual distribution commission to intermediaries, which is deducted from the fund's NAV before it reaches the investor. On a ₹5 lakh portfolio with a 1% drag, that is ₹5,000 per year silently subtracted — and compounding over 10 years, this gap can cost ₹70,000–₹1,00,000. FundLens is direct-plan-only advice: show users what they're paying and what they'd save by switching.

The feature also unlocks the third factor in the Portfolio Health Score (Milestone 9), completing the scoring model.


## Context


Builds on Milestone 9. The `fund` table does not currently store expense ratio. A new Supabase Edge Function (`sync-metadata`) will fetch expense ratio and fund type (Regular vs Direct) from AMFI's publicly available data, store it in a new `expense_ratio` column on the `fund` table, and run on a weekly schedule.

The source of truth for expense ratio in India is AMFI's monthly Total Expense Ratio (TER) disclosure, which SEBI mandates all AMCs publish via AMFI. AMFI aggregates this into a structured page at `https://www.amfiindia.com/research-information/other-data/ter`. The page is HTML (not a JSON API) and requires parsing, but it is a stable, official, publicly accessible source.

An alternative lighter-weight approach — using mfapi.in's scheme metadata — is also evaluated in the Alternatives section.


## Branch


`claude/milestone-12-expense-ratio` → targets `main`


## Assumptions


- AMFI's TER disclosure page (or the mfapi.in metadata endpoint) returns usable structured data. Milestone 1 validates this as a proof of concept before full implementation.
- Expense ratios are updated monthly by AMCs; the `sync-metadata` function runs weekly, which is more than sufficient.
- Regular vs Direct plan detection is done by inspecting the scheme name. SEBI requires all Direct plan names to include the word "Direct" and all Regular plans to not include it. This is a reliable signal across all AMCs.
- Matching a Regular plan to its Direct equivalent is done by: (1) stripping "Regular" / "Reg" variants from the scheme name, (2) querying mfapi.in's search endpoint for a matching Direct plan from the same fund house and category.
- If no Direct equivalent can be found (rare — some funds have no Direct variant), the fund is shown with only its expense ratio, without a "savings gap" callout.
- The expense ratio stored is the **latest TER** (Total Expense Ratio), which includes the management fee, distribution commission (for Regular plans), and all other costs. It is expressed as an annual percentage of AUM.
- This milestone also triggers the Phase 2 upgrade of the Portfolio Health Score (Milestone 9): the expense ratio factor is activated once data is available.


## Definitions


**TER (Total Expense Ratio)** — The total annual fee charged by a mutual fund as a percentage of its average AUM. Includes fund management fee, distribution commission (for Regular plans), and other costs. A TER of 1.2% means ₹1,200 is deducted annually per ₹1,00,000 invested.

**Regular plan** — A share class of a mutual fund that pays a distribution commission (typically 0.5–1.5% per year) to the broker or distributor who sold it. This commission is included in the TER and reduces the investor's effective return.

**Direct plan** — A share class of the same fund with no distribution commission. Lower TER, higher NAV growth for the investor. Introduced by SEBI in 2013. Identifiable by the word "Direct" in the fund name.

**Savings gap** — The annual difference in rupees between what a user pays in a Regular plan vs what they would pay in the equivalent Direct plan, on their current invested corpus. `savingsGap = (regularTER - directTER) / 100 × currentValue`.

**10-year compounding impact** — An estimate of how much more the investor would accumulate over 10 years if they switched to Direct today. Approximated as `currentValue × ((1 + directTER/100)^10 / (1 + regularTER/100)^10 - 1)` — i.e. the extra compounding if the fee drag were reduced.

**AMFI TER disclosure** — AMFI India's monthly publication of expense ratios for all registered mutual fund schemes. Publicly accessible at `https://www.amfiindia.com/research-information/other-data/ter`.

**sync-metadata** — The new Supabase Edge Function that fetches and stores expense ratio data.


## Scope


- `supabase/migrations/YYYYMMDD_add_expense_ratio.sql` — Add `expense_ratio numeric(5,4)` and `is_direct_plan boolean` columns to the `fund` table.
- `supabase/functions/sync-metadata/index.ts` — New Edge Function. Fetches TER for all funds in the `fund` table from AMFI or mfapi.in; updates `fund.expense_ratio` and `fund.is_direct_plan`.
- `supabase/config.toml` — Register `sync-metadata` and add a weekly cron trigger (Sunday 2 AM IST).
- `src/hooks/usePortfolio.ts` — Include `expense_ratio` and `is_direct_plan` in the fund query; compute `annualCostRupees` per fund and portfolio `avgExpenseRatio`; pass `avgExpenseRatio` to `computeHealthScore`.
- `src/hooks/useFundDetail.ts` — Include `expense_ratio`, `is_direct_plan`, and (if `is_direct_plan = false`) `directEquivalent: { schemeName, expense_ratio }` in `FundDetailData`.
- `src/hooks/useDirectEquivalent.ts` — New hook. Given a Regular plan fund, queries mfapi.in search to find the Direct plan equivalent and its TER.
- `src/utils/healthScore.ts` — Activate Phase 2 scoring when `avgExpenseRatio` is present in `HealthScoreInput`.
- `app/(tabs)/index.tsx` — Add expense ratio pill to each `FundCard`; show Regular plan badge when `is_direct_plan = false`.
- `app/fund/[id].tsx` — Add a Cost section to the fund header card: TER percentage, annual cost in ₹, and (for Regular plans) a "You could save ₹X/year" callout with the Direct equivalent name.


## Out of Scope


- Facilitating the actual switch from Regular to Direct (buy/sell is out of scope for FundLens).
- Displaying AUM or fund house information.
- Historical expense ratio trends.
- Comparing expense ratios between user-held funds.
- Showing expense ratio in the Compare screen (future iteration).


## Approach


### Milestone 1 — Proof of Concept: Data Source


Before writing any production code, validate the data source.

**Option A — AMFI TER page:**
Fetch `https://www.amfiindia.com/research-information/other-data/ter` from the Edge Function runtime. Parse the HTML table (or look for a CSV download link on the page). Verify that expense ratio rows are keyed by scheme code (which matches `fund.scheme_code`).

**Option B — mfapi.in metadata:**
Fetch `https://api.mfapi.in/mf/{scheme_code}` for one known fund. Inspect the `meta` object for any `expense_ratio` or `ter` field. If present, this is the simpler path.

**Option C — AMFI flat file extension:**
AMFI's NAV flat file (`https://www.amfiindia.com/spages/NAVAll.txt`) contains scheme code, name, ISIN, and NAV — but not TER. This option is invalid.

Implement whichever of A or B returns usable data. If neither is workable, document the finding in the Decision Log and evaluate a manual-entry fallback (a Supabase table of manually curated TER values, updated quarterly).

The proof of concept is a standalone Deno script (`scripts/test-ter-source.ts`) that fetches and prints the expense ratio for 3 known scheme codes. This must succeed before Milestone 2 begins.


### Milestone 2 — Schema and Sync Function


After the data source is validated, add the columns and the sync function.

**Migration:**

    ALTER TABLE fund
      ADD COLUMN IF NOT EXISTS expense_ratio numeric(5,4),
      ADD COLUMN IF NOT EXISTS is_direct_plan boolean;

`expense_ratio` is nullable (null = not yet synced). `is_direct_plan` is derived from the scheme name: `scheme_name ILIKE '%direct%'`.

**`sync-metadata` Edge Function:**

1. Fetch all `(id, scheme_code, scheme_name)` rows from the `fund` table.
2. Set `is_direct_plan = scheme_name.toLowerCase().includes('direct')` for each row. (Done once on first sync; stable.)
3. For each fund, fetch its TER from the validated data source (Option A or B).
4. Upsert `expense_ratio` into `fund` using the scheme code as the key.
5. Log counts: `{ synced, failed, skipped }`.

The function is designed to be **idempotent** — running it multiple times produces the same result.

**Cron schedule in `supabase/config.toml`:**

    [functions.sync-metadata]
    schedule = "0 20 * * 0"    # Sunday 2 AM IST = Sunday 20:30 UTC Saturday

Alternatively, invoke manually via `supabase functions invoke sync-metadata` during development.


### Milestone 3 — Regular vs Direct Matching


For each fund where `is_direct_plan = false` (a Regular plan), find the corresponding Direct plan.

**Matching algorithm:**

1. Take the scheme name. Strip variants of "Regular", "Reg", " - " separators.
2. Append "Direct" and query the mfapi.in search endpoint: `https://api.mfapi.in/mf/search?q={sanitised_name}`.
3. Filter results to the same fund house (compare first word of `fund_house` in metadata).
4. Pick the result whose scheme name most closely matches (Levenshtein distance or substring match).
5. Fetch the TER for that Direct plan from the same data source.

Store the matched Direct plan's scheme code and TER in a new table `direct_equivalent`:

    CREATE TABLE direct_equivalent (
      regular_scheme_code integer PRIMARY KEY REFERENCES fund(scheme_code),
      direct_scheme_code  integer NOT NULL,
      direct_scheme_name  text NOT NULL,
      direct_expense_ratio numeric(5,4),
      matched_at          timestamptz DEFAULT now()
    );

This table is populated by `sync-metadata` on its first run and refreshed monthly. It is used by `useDirectEquivalent` to show the savings callout without requiring a live API call at render time.


### Fund Card UI


Each `FundCard` on the home screen shows a small pill below the category label:

    ┌────────────────────────────────────────────────────────┐
    │  Mirae Asset Large & Mid Cap Fund                      │
    │  Large & Mid Cap · [Regular · 1.52%]                  │  ← badge
    │                                        ₹1,23,450      │
    │                                    +0.42% today        │
    ├────────────────────────────────────────────────────────┤
    │  Invested ₹80,000 │ Current ₹1,23,450 │ Gain +₹43,450 │
    └────────────────────────────────────────────────────────┘

Badge styles:
- Direct plan: `Colors.positive` background, "Direct · 0.38%" text. Subtle, confirming.
- Regular plan: `Colors.warning` background, "Regular · 1.52%" text. Attention-drawing.
- No data yet: no badge shown.


### Fund Detail Cost Section


Added below the existing holdings row in the fund header card:

    ┌──────────────────────────────────────────────────────────────┐
    │  Mirae Asset Large & Mid Cap Fund                            │
    │  Large & Mid Cap Fund                                        │
    │                                                              │
    │  Current Value ₹1,23,450  ·  Invested ₹80,000  ·  Units 420 │
    │  vs Nifty 50                                                 │
    │                                                              │
    │  ── Cost ────────────────────────────────────────────────── │
    │  Expense Ratio   1.52% / year                                │
    │  Annual cost     ₹1,877 on your ₹1,23,450                    │
    │                                                              │
    │  ⚠ Regular plan                                              │
    │  Mirae Asset Large & Mid Cap - Direct Plan: 0.51%            │
    │  You could save ₹1,241 / year by switching to Direct.        │
    │  Over 10 years, this could compound to ₹18,400 extra.        │
    └──────────────────────────────────────────────────────────────┘

The "Regular plan" block is shown only when `is_direct_plan = false` and a Direct equivalent is found. The "You could save" figure uses `savingsGap = (regularTER - directTER) / 100 × currentValue`.

A small note below: "Switching requires a new folio. FundLens does not facilitate transactions."


### Health Score Phase 2 Activation


Once `avgExpenseRatio` is available from `usePortfolio`, pass it into `computeHealthScore`. The function already handles this via the optional `avgExpenseRatio` param (designed in Milestone 9). No changes to `healthScore.ts` are needed; the Phase 2 weight re-balancing activates automatically.

Update the score breakdown sheet to replace "Coming soon 🔒" with the actual expense ratio factor row.


## New Files


- `supabase/functions/sync-metadata/index.ts`
- `src/hooks/useDirectEquivalent.ts`
- `scripts/test-ter-source.ts` (proof of concept script, not shipped)
- `supabase/migrations/YYYYMMDD_add_expense_ratio.sql`
- `supabase/migrations/YYYYMMDD_add_direct_equivalent_table.sql`


## Modified Files


- `supabase/config.toml` — register `sync-metadata` cron
- `src/hooks/usePortfolio.ts` — include `expense_ratio`, `is_direct_plan`, compute `annualCostRupees`, `avgExpenseRatio`
- `src/hooks/useFundDetail.ts` — include `expense_ratio`, `is_direct_plan`, `directEquivalent`
- `src/utils/healthScore.ts` — Phase 2 activates automatically (no code change needed if param design from Milestone 9 was followed)
- `app/(tabs)/index.tsx` — expense ratio badge on `FundCard`
- `app/fund/[id].tsx` — Cost section in fund header card
- `src/types/database.types.ts` — regenerate after migration


## Validation


    npm run lint        -- zero warnings
    npm run typecheck   -- zero errors

    # Milestone 1 — data source PoC:
    # → Run: deno run --allow-net scripts/test-ter-source.ts
    # → Output shows expense_ratio for 3 test scheme codes (e.g. 120503, 135781, 101206)
    # → Values match the AMC's published TER on their website

    # Milestone 2 — sync function:
    # → Run: supabase functions invoke sync-metadata
    # → Log shows: "Synced N funds, failed 0"
    # → SELECT expense_ratio, is_direct_plan FROM fund LIMIT 10; → non-null values

    # Milestone 3 — matching:
    # → For a known Regular plan fund, direct_equivalent table has a matching row
    # → Direct scheme name contains "Direct"
    # → Direct expense_ratio is lower than regular expense_ratio

    # App UI:
    # → FundCard for a Regular plan shows orange "Regular · X.XX%" badge
    # → FundCard for a Direct plan shows green "Direct · X.XX%" badge
    # → Fund detail Cost section shows annual cost in ₹ with correct maths
    # → Savings callout appears for Regular plans with a found Direct equivalent
    # → Health Score breakdown sheet shows the expense ratio factor row (no longer locked)


## Risks And Mitigations


| Risk | Mitigation |
|------|------------|
| AMFI TER page HTML structure changes | The sync function logs a parse failure and keeps the last known value. An alert can be added to notify if sync success rate drops below 80%. |
| mfapi.in rate limits the metadata endpoint | Add a 100 ms delay between scheme code requests; batch requests in groups of 10. |
| Direct plan matching fails for some funds (no close match found) | Gracefully omit the savings callout for unmatched funds; show TER only. Record the match failure in `direct_equivalent` with `direct_scheme_code = null`. |
| Expense ratio is stale (monthly data, weekly sync) | Acceptable. TER rarely changes more than quarterly; weekly sync is well ahead of monthly updates. |
| Health Score changes when Phase 2 activates | Old score stored nowhere. Scores update on the next portfolio load. No backwards-compatibility issue. |
| AMC fund names are inconsistent (abbreviations, punctuation) | Normalise scheme names before matching: lowercase, remove punctuation, collapse spaces. Levenshtein distance with a threshold of 10 characters provides robustness. |


## Decision Log


- **Both show TER and flag Regular plans** — The user confirmed this is the goal. Showing TER alone is informational; flagging Regular plans with a rupee savings figure is actionable. Both are implemented.
- **AMFI TER page as primary source, mfapi.in as fallback** — AMFI is the authoritative, SEBI-mandated source. mfapi.in is convenient but not guaranteed to include TER. The proof-of-concept milestone resolves which source to actually use.
- **Savings gap in rupees on current invested amount** — Percentage comparisons are abstract. "You're paying ₹1,241 more per year" is concrete and motivating.
- **No facilitation of the switch** — FundLens is a tracking app, not a transaction platform. The callout is purely informational; no links to AMC portals or distributor platforms are included.
- **Direct equivalent matching stored in a DB table, not computed at render** — Live matching on every render would be expensive and unreliable. Storing in `direct_equivalent` means the match runs once (weekly) and is served instantly.
- **Phase 2 Health Score activates automatically** — The `computeHealthScore` function was designed in Milestone 9 to accept `avgExpenseRatio` as an optional parameter and use Phase 2 weights when present. No code change in `healthScore.ts` is needed; the UI change (unlock the locked row in the breakdown sheet) is the only UI update required.


## Progress


- [ ] Write `scripts/test-ter-source.ts` and validate data source (Milestone 1)
- [ ] Document data source decision in Decision Log
- [ ] Write migration: add `expense_ratio` and `is_direct_plan` to `fund` table
- [ ] Write `supabase/functions/sync-metadata/index.ts`
- [ ] Register cron in `supabase/config.toml`
- [ ] Run `supabase functions invoke sync-metadata` and verify data in DB
- [ ] Write migration: create `direct_equivalent` table
- [ ] Write `src/hooks/useDirectEquivalent.ts` and matching logic
- [ ] Update `src/hooks/usePortfolio.ts` (expense_ratio, annualCostRupees, avgExpenseRatio)
- [ ] Update `src/hooks/useFundDetail.ts` (expense_ratio, is_direct_plan, directEquivalent)
- [ ] Update `src/types/database.types.ts` (regenerate from Supabase)
- [ ] Add expense ratio badge to FundCard in `app/(tabs)/index.tsx`
- [ ] Add Cost section to fund header in `app/fund/[id].tsx`
- [ ] Activate Health Score Phase 2 (update breakdown sheet to show expense ratio factor)
- [ ] `npm run lint` — zero warnings
- [ ] `npm run typecheck` — zero errors
- [ ] QA: Regular plan badge, Direct plan badge, savings callout, no-direct-equivalent fund, Health Score Phase 2

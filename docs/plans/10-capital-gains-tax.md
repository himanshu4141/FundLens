# ExecPlan: Milestone 10 — Capital Gains & Tax Snapshot


## Goal


Show users exactly how much capital gains tax they owe (or have already realised) this financial year, without requiring them to understand the Indian tax code. A snapshot card on the home screen gives the total picture; a Tax tab on each fund's detail screen shows the per-fund breakdown.


## User Value


After the 2024 Union Budget changed LTCG rates and raised the exemption limit to ₹1.25 lakh, even informed investors are confused about their tax position. FundLens already holds every transaction — it can compute the answer automatically. Users with redemptions this FY will immediately see:

- How much LTCG they have realised and how much of the ₹1.25 lakh exemption remains.
- How much estimated tax is due, broken down by short-term and long-term gains.
- Which funds they have redeemed and at what holding period.

This removes the need to open a CA's spreadsheet or the AMFI tax calculator before filing returns in July.


## Context


Builds on Milestone 8. The `transaction` table already records every purchase and redemption with its date, units, NAV at transaction, and amount. `computeRealizedGains()` in `src/utils/xirr.ts` already implements the average cost method for realized P&L per fund. This milestone adds:

1. Classification of gains as LTCG or STCG per Indian income tax rules.
2. Aggregation of gains for the current financial year (1 April – 31 March).
3. Two new UI surfaces: a Tax Snapshot card on the home screen and a Tax tab on the fund detail screen.

No schema changes are required. All computation is client-side.


## Branch


`claude/milestone-10-capital-gains` → targets `main`


## Assumptions


- "This financial year" means 1 April of the current calendar year to 31 March of the next (Indian FY). The app uses the device clock to determine the current FY.
- Only **realised gains** (from redemption and switch-out transactions) are classified as LTCG/STCG. Unrealised gains on current holdings are shown separately and labelled as such.
- The average cost method is used for cost basis (same method already used by `computeRealizedGains`). This is the standard practice accepted by AMCs and widely used by Indian investors.
- Tax rates applied are as per the Finance (No. 2) Act, 2024 (effective 23 July 2024):
  - Equity funds (>65% equity): LTCG (holding > 12 months) @ 12.5% after ₹1.25L exemption; STCG (≤12 months) @ 20%.
  - Debt funds (any holding period): gains taxed at the user's income tax slab. Because slab rate is unknown, the app shows "taxed at slab" and does not compute a rupee estimate for debt gains.
  - Hybrid funds with >65% equity allocation: treated as equity. Other hybrid funds: treated as debt.
- Holding period for capital gains purposes is calculated from the **date of each lot purchased** to the **date of redemption**. The average cost method pools lots, so holding period is approximated as the weighted-average purchase date of the units redeemed (see Approach below).
- The app does not provide tax advice. All figures are labelled "Estimated" and a disclaimer is displayed.


## Definitions


**Financial Year (FY)** — 1 April to 31 March in India. FY 2025–26 runs from 1 April 2025 to 31 March 2026.

**Long-Term Capital Gain (LTCG)** — A gain on units held for more than 12 months (equity funds). Taxed at 12.5% flat after the ₹1.25 lakh annual exemption.

**Short-Term Capital Gain (STCG)** — A gain on units held for 12 months or fewer (equity funds). Taxed at 20% flat (no exemption).

**LTCG Exemption** — ₹1.25 lakh of LTCG per financial year is tax-free. Only equity gains (LTCG type) count against this exemption.

**Debt fund taxation** — From 1 April 2023, all gains from debt mutual funds are taxed at the investor's income tax slab rate, regardless of holding period. The app cannot know the user's slab rate, so it shows "slab-rate taxable" without a rupee estimate.

**Average cost method** — Cost basis = total amount invested in a fund ÷ total units purchased. When units are redeemed, the gain = redemption amount − (units redeemed × average cost per unit). Already implemented in `computeRealizedGains()`.

**Weighted-average purchase date** — Approximation of holding period: the average of all purchase dates, weighted by the rupee amount of each purchase. Used to classify a redemption as LTCG or STCG when the portfolio uses average cost method.

**Equity fund** — Any fund whose `scheme_category` contains: Equity, ELSS, Index, ETF, Flexi Cap, Multi Cap, Large Cap, Mid Cap, Small Cap, Sectoral, Thematic, or Arbitrage (>65% equity by SEBI mandate).

**Debt fund** — Any fund whose `scheme_category` contains: Debt, Liquid, Money Market, Overnight, Short Duration, Medium Duration, Long Duration, Gilt, Credit Risk, Floating Rate, or Banking and PSU.

**Hybrid fund** — Anything else or containing "Hybrid". Treated as Debt for conservative tax estimation.


## Scope


- `src/utils/taxGains.ts` — New file. Pure functions for tax classification, holding period estimation, aggregation, and tax-loss harvesting analysis. Accepts an optional `slabRate` parameter for debt fund estimates.
- `src/hooks/useCapitalGains.ts` — New hook. Accepts `financialYear: string` (e.g. `"2025-26"`) and `slabRate: number | null`. Fetches all transactions; returns `CapitalGainsResult` including harvest opportunities.
- `src/hooks/useTaxSettings.ts` — New lightweight hook backed by `AsyncStorage`. Persists the user's selected FY and slab rate between sessions.
- `app/(tabs)/index.tsx` — Add `TaxSnapshotCard` component below the `HealthScoreCard`. Card header includes FY selector (pill row: last 3 FYs) and slab rate picker (inline dropdown or modal). Card footer shows harvest opportunities summary if any exist.
- `app/fund/[id].tsx` — Add a third tab "Tax" to the existing Performance / NAV History tab bar. Renders `TaxTab`. Inherits selected FY from the same `useTaxSettings` hook. Tax tab includes a "Harvest opportunity" row for eligible funds.


## Out of Scope


- Form 26AS reconciliation.
- SIP tax planning (which SIPs will become LTCG, when).
- Exporting gains as a CSV or PDF.
- Carryforward loss tracking across years (requires Form 26AS data).


## Approach


### Tax Classification Logic


    function classifyFundType(schemeCategory: string): 'equity' | 'debt' | 'hybrid'

    function estimateHoldingPeriodDays(
      purchases: { date: string; amount: number }[],
      redemptionDate: string
    ): number
    // Returns the weighted-average number of days the redeemed units were held.
    // weights = purchase amounts (rupees)

    function classifyGain(
      holdingDays: number,
      fundType: 'equity' | 'debt' | 'hybrid'
    ): 'ltcg-equity' | 'stcg-equity' | 'debt-slab'
    // equity: holdingDays > 365 → ltcg-equity; else → stcg-equity
    // debt or hybrid: always → debt-slab

    function computeTaxEstimate(
      gain: number,
      type: 'ltcg-equity' | 'stcg-equity' | 'debt-slab',
      ltcgExemptionUsed: number,   // cumulative LTCG already exempted this FY
      slabRate: number | null      // e.g. 0.20 for 20%; null if user has not set it
    ): { taxable: number; rate: number | null; estimatedTax: number | null }
    // ltcg-equity: max(0, gain - max(0, 1_25_000 - ltcgExemptionUsed)) * 0.125
    // stcg-equity: gain * 0.20
    // debt-slab: taxable = gain, rate = slabRate, estimatedTax = slabRate ? gain * slabRate : null


### `useCapitalGains` Hook


Accepts `financialYear` (string, e.g. `"2025-26"`) and `slabRate` (number | null). Derives the FY date range: start = `1 April {year}`, end = `31 March {year+1}`. Fetches in a single query **all** transactions (not just current FY) because computing holding period requires the full purchase history prior to each redemption. Groups by fund. For each fund that has at least one redemption in the selected FY:

1. Run `computeRealizedGains` (already exists) to get `realizedGain`, `realizedAmount`, `redeemedUnits`.
2. Derive per-redemption records: for each redemption transaction in the current FY, compute holding days using the weighted-average purchase date of preceding purchases.
3. Classify as LTCG equity / STCG equity / Debt slab.
4. Aggregate across all funds:
   - `ltcgEquityTotal`: sum of LTCG equity gains (may include losses).
   - `stcgEquityTotal`: sum of STCG equity gains.
   - `debtSlabTotal`: sum of debt gains.
   - `ltcgExemptionUsed`: min(ltcgEquityTotal, 1_25_000).
   - `ltcgExemptionRemaining`: max(0, 1_25_000 − ltcgExemptionUsed).
   - `estimatedLtcgTax`: tax on LTCG equity after exemption.
   - `estimatedStcgTax`: tax on STCG equity.
   - Total estimated tax = ltcg + stcg (debt excluded).
5. Also returns unrealised gains per fund (current value − invested, already available from `usePortfolio`).

Return type:

    interface CapitalGainsResult {
      selectedFY: string;               // e.g. "2025–26"
      slabRate: number | null;          // as provided by caller; null = not set
      ltcgEquity: number;               // total LTCG in selected FY
      stcgEquity: number;               // total STCG this FY
      debtSlab: number;                 // total debt gains this FY (slab-rate)
      ltcgExemptionUsed: number;        // how much of ₹1.25L has been used
      ltcgExemptionRemaining: number;   // how much is left
      estimatedTax: number;             // equity gains tax only
      perFund: PerFundGains[];
    }

    interface PerFundGains {
      fundId: string;
      schemeName: string;
      schemeCategory: string;
      fundType: 'equity' | 'debt' | 'hybrid';
      ltcgEquity: number;
      stcgEquity: number;
      debtSlab: number;
      redemptions: RedemptionRecord[];
    }

    interface RedemptionRecord {
      date: string;
      units: number;
      proceeds: number;
      gain: number;
      holdingDays: number;
      gainType: 'ltcg-equity' | 'stcg-equity' | 'debt-slab';
      estimatedTax: number | null;
    }


### TaxSnapshotCard (Home Screen)


Shown on the home screen only when there are any redemptions in the selected FY. Hidden if no redemptions.

**FY Selector:** A horizontal pill row in the card header shows the last 3 financial years (e.g. "FY 24-25", "FY 25-26", "FY 26-27"). Tapping a pill updates the selected FY in `useTaxSettings` and triggers a recompute.

**Slab Rate Picker:** A small "Tax slab: 20% ▾" tappable row below the FY selector. Tapping opens a bottom sheet with options: Not set, 5%, 10%, 15%, 20%, 25%, 30%. When "Not set" is chosen, debt gains show "At slab rate" with no rupee estimate. When a rate is chosen, debt gains show the computed estimate. The selection is persisted in `AsyncStorage` via `useTaxSettings`.

Layout:

    ┌──────────────────────────────────────────────┐
    │  Tax Snapshot                      [Details] │
    │  [FY 23-24]  [FY 24-25]  [FY 25-26]         │
    │  Tax slab: 20% ▾                             │
    │                                              │
    │  LTCG (Equity)    ₹38,400   12.5% rate      │
    │  STCG (Equity)    ₹12,000   20% rate         │
    │  Debt / Hybrid    ₹4,500    ≈₹900 at 20%    │
    │                                              │
    │  ₹1.25L exemption:  ██████░░░░  ₹86,600 left│
    │  Estimated equity tax:  ₹2,100               │
    │                                              │
    │  ⓘ Estimates only. Consult a tax advisor.   │
    └──────────────────────────────────────────────┘

"Details" button opens the fund-by-fund breakdown as a bottom sheet listing each `PerFundGains` row.

Note: the FY selector on the card and the Tax tab on the fund detail screen share state via `useTaxSettings`, so switching FY on the home card also updates the fund detail Tax tab.


### Tax Tab (Fund Detail Screen)


A third tab added to the Performance / NAV History tab bar. Shown for all funds but displays "No redemptions in FY {selectedFY}" when `redemptions` is empty. The selected FY comes from `useTaxSettings` (shared with the home screen card).

Layout per redemption:

    Date          Units     Proceeds    Gain      Type     Est. Tax
    12 Aug 2025   500.00   ₹1,23,450   ₹18,200   LTCG    ₹1,025
    03 Jan 2026   200.00    ₹52,000    ₹7,000    STCG    ₹1,400

Below the table: total per fund + fund-type disclaimer (for debt funds: "Gains taxed at income slab rate.").

The `TaxTab` component receives `perFundGains` from the parent (passed down from `useCapitalGains`). The fund detail screen already calls `useFundDetail`; `useCapitalGains` is called at the same level and the relevant `perFund` entry passed in.


### Tax-Loss Harvesting Suggestions


Tax-loss harvesting is the practice of selling (redeeming) a fund that is currently showing an unrealised loss in order to crystallise that loss, which can then be offset against realised gains — reducing the current FY's tax liability. After selling, the user can immediately reinvest in the same or a similar fund to maintain market exposure.

**Why it matters:** If a user has realised ₹80,000 of LTCG equity gains this FY but also holds a fund with an unrealised LTCG loss of ₹30,000, redeeming that losing fund brings their net LTCG down to ₹50,000 — saving up to ₹3,750 in tax.

#### Identifying harvest candidates

For each fund with an active (non-zero) holding, compute:

    unrealisedGain = currentValue - investedAmount   // from usePortfolio

A fund is a **harvest candidate** when `unrealisedGain < 0` (i.e. the holding is currently at a loss).

For each candidate, also compute the **holding period** (weighted-average purchase date to today) using the same `estimateHoldingPeriodDays` function used for realised gains. This determines whether a harvest would produce an LTCG loss or STCG loss — both are valuable but LTCG losses are more flexible (offset against LTCG of any asset class).

#### Harvest opportunity record

    interface HarvestOpportunity {
      fundId: string;
      schemeName: string;
      unrealisedLoss: number;          // positive value representing the loss amount
      holdingDays: number;             // weighted-average holding period
      gainType: 'ltcg-equity' | 'stcg-equity' | 'debt-slab';
      potentialTaxSaving: number | null;  // null if no offsettable gains exist this FY
      daysToLTCG: number | null;       // days remaining until loss becomes LTCG (null if already LTCG)
    }

`potentialTaxSaving` is calculated as:
- For `ltcg-equity` loss: `min(unrealisedLoss, ltcgEquityTotal) × 0.125`
- For `stcg-equity` loss: `min(unrealisedLoss, stcgEquityTotal) × 0.20`
- For `debt-slab` loss: `min(unrealisedLoss, debtSlabTotal) × slabRate` (null if slabRate is null)

`daysToLTCG`: if holding < 365 days, this is `365 - holdingDays`. If already ≥ 365 days, null. This tells the user whether it is worth waiting a few more days before harvesting to get the better LTCG loss classification.

`CapitalGainsResult` gains a new field:

    harvestOpportunities: HarvestOpportunity[];   // sorted by potentialTaxSaving desc

#### Home screen card — harvest summary

If `harvestOpportunities.length > 0`, a compact row is shown at the bottom of the `TaxSnapshotCard`:

    💡 Harvest opportunity: 2 funds with losses could save up to ₹4,200 in tax  [View →]

Tapping "View →" opens the same per-fund details sheet, scrolled to a "Harvest Opportunities" section listing each candidate.

#### Fund detail Tax tab — harvest row

For a fund that is a harvest candidate, the Tax tab shows a highlighted row below the redemption table (or in place of "No redemptions" message):

    ┌─────────────────────────────────────────────────┐
    │  💡 Harvest opportunity                          │
    │  Unrealised loss: ₹12,400 (LTCG)               │
    │  Redeeming now could save ≈₹1,550 in LTCG tax  │
    │  Already qualifies as LTCG                      │
    └─────────────────────────────────────────────────┘

Or, if close to LTCG qualification:

    │  23 days until this loss qualifies as LTCG —   │
    │  waiting could save an additional ₹600 in tax  │

Both the card summary and the fund detail row carry the standard disclaimer. Harvesting suggestions are clearly labelled as illustrative estimates only.


### Disclaimer


All tax-related UI surfaces include this footer in `Colors.textTertiary`:

> Estimates based on average cost method. Actual tax may differ. Consult a qualified tax advisor before filing.


## New Files


- `src/utils/taxGains.ts`
- `src/hooks/useCapitalGains.ts`
- `src/hooks/useTaxSettings.ts`


## Modified Files


- `app/(tabs)/index.tsx` — add `TaxSnapshotCard` (with FY selector and slab picker)
- `app/fund/[id].tsx` — add Tax tab; consume `useTaxSettings` for shared FY selection


## Validation


    npm run lint        -- zero warnings
    npm run typecheck   -- zero errors

    # Home screen — user has equity fund redemptions this FY:
    # → TaxSnapshotCard appears with correct LTCG, STCG, and estimated tax values
    # → Exemption progress bar fills proportionally (e.g. ₹38,400 of ₹1.25L used)
    # → Tapping "Details" opens per-fund breakdown sheet
    # → If any held funds have unrealised losses, harvest summary row appears at card bottom

    # Home screen — no redemptions this FY:
    # → TaxSnapshotCard is hidden entirely (even if harvest candidates exist — no context for savings)

    # Fund detail screen:
    # → "Tax" tab appears as third option in tab bar
    # → Tapping it shows redemption table for that fund
    # → For debt funds: "At slab rate" label, no rupee tax estimate
    # → No redemptions + fund has unrealised loss: harvest opportunity row shown
    # → No redemptions + no loss: "No redemptions this financial year" message
    # → daysToLTCG shown correctly when holding < 365 days; null when ≥ 365 days

    # Tax math validation (manual):
    # → Fund with ₹50,000 LTCG: estimated tax = (50,000 − 50,000 exemption used) * 0.125 = 0
    # → Second redemption with ₹1,00,000 LTCG: (1,00,000 − 75,000 remaining exemption) * 0.125 = ₹3,125
    # → STCG ₹20,000: estimated tax = 20,000 * 0.20 = ₹4,000
    # → Fund with ₹12,400 unrealised LTCG loss, ₹80,000 realised LTCG: potentialTaxSaving = 12,400 * 0.125 = ₹1,550


## Risks And Mitigations


| Risk | Mitigation |
|------|------------|
| Average cost method gives different holding period than FIFO | Holding period is approximated from weighted-average purchase date, which is conservative and standard practice. The disclaimer notes figures are estimates. |
| Debt fund taxation rules changed in 2023; older transactions follow old rules | All transactions post-April 2023 are treated as debt-slab. Pre-April 2023 debt redemptions are rare and also shown as slab-rate (conservative). |
| User's fund has no `scheme_category` | Falls into "hybrid" bucket → treated as debt (conservative, not under-estimated). |
| Equity classification incorrect for a specific hybrid fund | Treated as debt → conservative tax estimate, not a tax shortfall. Disclaimer covers this. |
| User in a zero-tax bracket wrongly sees "Estimated tax: ₹X" | The slab picker defaults to "Not set". Users choose their slab deliberately; the disclaimer clarifies these are estimates and the app cannot account for other income. |


## Decision Log


- **Snapshot card + Tax tab, not a dedicated screen** — The user confirmed this two-surface approach: summary on home screen, detail on fund drill-down. A separate screen was considered but adds navigation depth without adding information.
- **Average cost, not FIFO** — FIFO is legally valid for Indian capital gains but `computeRealizedGains` already uses average cost, which is also widely accepted. Re-implementing FIFO would require restructuring the realized gains logic and matching specific tax lots, adding significant complexity for marginal accuracy difference at this stage.
- **Slab rate picker for debt fund estimates** — PR review suggested letting users specify their slab. This is now included: users select their applicable rate (5%–30%) or leave it at "Not set". When set, debt gains show a rupee estimate. The default is "Not set" to avoid showing misleading numbers to users who haven't configured this. The selection is persisted in AsyncStorage so it only needs to be set once.
- **Multi-year FY selector** — PR review requested the ability to view previous financial years. This is included: the card shows a pill selector with the last 3 FYs. All transaction data is already in the DB (the app imports full CAS history), so past FY calculations require no new data fetch — just a different date filter.
- **Full transaction history fetched regardless of FY** — Computing holding period for a redemption in FY 2025-26 requires purchase transactions from prior years. The hook fetches all transactions for the user (not just the selected FY) but filters redemptions to the selected FY when building the result.
- **Shared FY state via `useTaxSettings`** — The FY selection is stored in AsyncStorage and consumed by both the home screen card and the fund detail Tax tab, so they stay in sync without prop-drilling.
- **Tax-loss harvesting in scope** — The primary reason to show tax figures is to help users act on them. Showing LTCG of ₹80,000 without also surfacing that a held fund has a ₹30,000 unrealised loss that could save ₹3,750 in tax would leave the most actionable insight on the table. Harvesting suggestions are purely informational (no buy/sell execution), so the disclaimer requirement is the same as for the rest of the Tax feature. The data needed (current value, invested amount, purchase dates) is already fetched by `usePortfolio` and `useCapitalGains`.
- **No tax advice framing** — All copy is "estimated" and includes a disclaimer. This is not a tax filing tool.


## Progress


- [ ] Write `src/utils/taxGains.ts` (classification, holding period, tax estimate with slabRate param, harvest opportunity computation)
- [ ] Write `src/hooks/useTaxSettings.ts` (AsyncStorage-backed FY + slab state)
- [ ] Write `src/hooks/useCapitalGains.ts` (accepts financialYear + slabRate; returns harvestOpportunities)
- [ ] Add `TaxSnapshotCard` to `app/(tabs)/index.tsx` (FY pills + slab picker + harvest summary row)
- [ ] Add slab rate bottom sheet picker component
- [ ] Add Tax tab to `app/fund/[id].tsx` (redemption table + harvest opportunity row)
- [ ] Verify tax math against manual calculations (see Validation)
- [ ] Verify harvest saving calculation: loss × applicable rate, capped at offsettable gains
- [ ] QA: switch between FYs and confirm numbers change; set slab rate and confirm debt gain estimate appears; "Not set" hides debt estimate
- [ ] QA: fund with unrealised loss shows harvest row in Tax tab; daysToLTCG correct
- [ ] QA: harvest summary on home card; tapping navigates to details sheet harvest section
- [ ] `npm run lint` — zero warnings
- [ ] `npm run typecheck` — zero errors
- [ ] QA: equity LTCG, STCG, debt with slab set, debt without slab, no redemptions, multi-FY, harvest candidates

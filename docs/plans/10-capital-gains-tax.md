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


- `src/utils/taxGains.ts` — New file. Pure functions for tax classification, holding period estimation, and aggregation.
- `src/hooks/useCapitalGains.ts` — New hook. Fetches all transactions for all user funds in one query; returns `CapitalGainsResult`.
- `app/(tabs)/index.tsx` — Add `TaxSnapshotCard` component below the `HealthScoreCard` (or below the portfolio header if health score is not enabled).
- `app/fund/[id].tsx` — Add a third tab "Tax" to the existing Performance / NAV History tab bar. Renders `TaxTab`.


## Out of Scope


- Debt fund tax estimates in rupees (slab rate unknown).
- Tax-loss harvesting suggestions (future milestone).
- Form 26AS reconciliation.
- Multiple financial years (only the current FY is shown).
- SIP tax planning (which SIPs will become LTCG, when).
- Exporting gains as a CSV or PDF.


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
      ltcgExemptionUsed: number   // cumulative LTCG already exempted this FY
    ): { taxable: number; rate: number | null; estimatedTax: number | null }
    // ltcg-equity: max(0, gain - max(0, 1_25_000 - ltcgExemptionUsed)) * 0.125
    // stcg-equity: gain * 0.20
    // debt-slab: taxable = gain, rate = null (unknown), estimatedTax = null


### `useCapitalGains` Hook


Fetches in a single query all transactions for the current user across all funds. Groups by fund. For each fund that has at least one redemption in the current FY:

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
      currentFY: string;                // e.g. "2025–26"
      ltcgEquity: number;               // total LTCG this FY
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


Shown on the home screen only when `ltcgEquity + stcgEquity + debtSlab > 0` for the current FY. Hidden if no redemptions this year.

Layout:

    ┌──────────────────────────────────────────────┐
    │  Tax Snapshot · FY 2025–26         [Details] │
    │                                              │
    │  LTCG (Equity)    ₹38,400   12.5% rate      │
    │  STCG (Equity)    ₹12,000   20% rate         │
    │  Debt / Hybrid      ₹4,500   At slab rate    │
    │                                              │
    │  ₹1.25L exemption:  ██████░░░░  ₹86,600 left│
    │  Estimated equity tax:  ₹2,100               │
    │                                              │
    │  ⓘ Estimates only. Consult a tax advisor.   │
    └──────────────────────────────────────────────┘

"Details" button opens the fund-by-fund breakdown as a bottom sheet listing each `PerFundGains` row.


### Tax Tab (Fund Detail Screen)


A third tab added to the Performance / NAV History tab bar. Shown for all funds but displays "No redemptions this FY" when `redemptions` is empty.

Layout per redemption:

    Date          Units     Proceeds    Gain      Type     Est. Tax
    12 Aug 2025   500.00   ₹1,23,450   ₹18,200   LTCG    ₹1,025
    03 Jan 2026   200.00    ₹52,000    ₹7,000    STCG    ₹1,400

Below the table: total per fund + fund-type disclaimer (for debt funds: "Gains taxed at income slab rate.").

The `TaxTab` component receives `perFundGains` from the parent (passed down from `useCapitalGains`). The fund detail screen already calls `useFundDetail`; `useCapitalGains` is called at the same level and the relevant `perFund` entry passed in.


### Disclaimer


All tax-related UI surfaces include this footer in `Colors.textTertiary`:

> Estimates based on average cost method. Actual tax may differ. Consult a qualified tax advisor before filing.


## New Files


- `src/utils/taxGains.ts`
- `src/hooks/useCapitalGains.ts`


## Modified Files


- `app/(tabs)/index.tsx` — add `TaxSnapshotCard`
- `app/fund/[id].tsx` — add Tax tab to the tab bar; fetch and pass `PerFundGains`


## Validation


    npm run lint        -- zero warnings
    npm run typecheck   -- zero errors

    # Home screen — user has equity fund redemptions this FY:
    # → TaxSnapshotCard appears with correct LTCG, STCG, and estimated tax values
    # → Exemption progress bar fills proportionally (e.g. ₹38,400 of ₹1.25L used)
    # → Tapping "Details" opens per-fund breakdown sheet

    # Home screen — no redemptions this FY:
    # → TaxSnapshotCard is hidden entirely

    # Fund detail screen:
    # → "Tax" tab appears as third option in tab bar
    # → Tapping it shows redemption table for that fund
    # → For debt funds: "At slab rate" label, no rupee tax estimate
    # → No redemptions: "No redemptions this financial year" message

    # Tax math validation (manual):
    # → Fund with ₹50,000 LTCG: estimated tax = (50,000 − 50,000 exemption used) * 0.125 = 0
    # → Second redemption with ₹1,00,000 LTCG: (1,00,000 − 75,000 remaining exemption) * 0.125 = ₹3,125
    # → STCG ₹20,000: estimated tax = 20,000 * 0.20 = ₹4,000


## Risks And Mitigations


| Risk | Mitigation |
|------|------------|
| Average cost method gives different holding period than FIFO | Holding period is approximated from weighted-average purchase date, which is conservative and standard practice. The disclaimer notes figures are estimates. |
| Debt fund taxation rules changed in 2023; older transactions follow old rules | All transactions post-April 2023 are treated as debt-slab. Pre-April 2023 debt redemptions are rare and also shown as slab-rate (conservative). |
| User's fund has no `scheme_category` | Falls into "hybrid" bucket → treated as debt (conservative, not under-estimated). |
| Equity classification incorrect for a specific hybrid fund | Treated as debt → conservative tax estimate, not a tax shortfall. Disclaimer covers this. |
| User in a zero-tax bracket wrongly sees "Estimated tax: ₹X" | The disclaimer clarifies these are estimates. The app cannot know the user's slab or other investments. |


## Decision Log


- **Snapshot card + Tax tab, not a dedicated screen** — The user confirmed this two-surface approach: summary on home screen, detail on fund drill-down. A separate screen was considered but adds navigation depth without adding information.
- **Average cost, not FIFO** — FIFO is legally valid for Indian capital gains but `computeRealizedGains` already uses average cost, which is also widely accepted. Re-implementing FIFO would require restructuring the realized gains logic and matching specific tax lots, adding significant complexity for marginal accuracy difference at this stage.
- **Debt fund gains shown without rupee estimate** — The slab rate is unknown. Showing a wrong rupee number is worse than showing "slab rate applies". Debt gains are included in the display so users know they exist.
- **FY-scoped view only** — Multi-year carryforward losses require Form 26AS reconciliation, which is out of scope. The current FY is the actionable window before filing.
- **No tax advice framing** — All copy is "estimated" and includes a disclaimer. This is not a tax filing tool.


## Progress


- [ ] Write `src/utils/taxGains.ts` (classification, holding period, tax estimate functions)
- [ ] Write `src/hooks/useCapitalGains.ts`
- [ ] Add `TaxSnapshotCard` to `app/(tabs)/index.tsx`
- [ ] Add Tax tab to `app/fund/[id].tsx`
- [ ] Verify tax math against manual calculations (see Validation)
- [ ] `npm run lint` — zero warnings
- [ ] `npm run typecheck` — zero errors
- [ ] QA: equity fund with LTCG, STCG, debt fund, no redemptions, multiple funds

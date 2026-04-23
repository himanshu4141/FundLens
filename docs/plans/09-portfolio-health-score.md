# ExecPlan: Milestone 9 — Portfolio Health Score


## Goal


Give every user a single, instantly readable score (0–100) that answers "how healthy is my portfolio?" without requiring them to interpret XIRR numbers, category weights, or benchmark comparisons themselves.


## User Value


A first-time investor looking at their home screen today sees a portfolio value and a benchmark comparison — but has no easy way to answer "is this good?" The Health Score collapses multiple quality signals into one number. The number is color-coded so the answer is immediate: green means you're on track, amber means something deserves attention, red means action is likely needed. A single tap reveals exactly which factor is dragging the score down.


## Context


Builds on Milestone 8. The app already computes XIRR, market XIRR (via mirrored benchmark cashflows), current value per fund, and fund category per holding. All the raw inputs for Phase 1 scoring are already available from `usePortfolio`. Phase 1 uses three factors: XIRR vs benchmark, diversification across asset classes, and concentration risk. A fourth factor — expense ratio — is deferred to Milestone 12 because the data source does not yet exist in the app. The score is designed to accept a fourth dimension when that milestone lands.


## Branch


`claude/milestone-9-health-score` → targets `main`


## Assumptions


- The user has at least one active fund holding. If the portfolio is empty the score card is hidden.
- XIRR is finite and computable. If fewer than 2 transactions exist (XIRR cannot be solved), the XIRR factor contributes 0 points and a note is shown.
- "Diversification" is measured by number of distinct top-level asset classes in the portfolio. A fund's asset class is derived from its `scheme_category` field (already stored on the `fund` table) via substring matching.
- Phase 1 uses three factors totalling 100 points. Phase 2 (post Milestone 12) adds a fourth factor (expense ratio) and re-weights all four to still total 100 points. The plan documents both phases so they can be implemented incrementally.
- The score is computed client-side every time `usePortfolio` returns fresh data; no new backend call is needed.


## Definitions


**XIRR** — Extended Internal Rate of Return. An annualised return percentage that accounts for the irregular timing and size of each SIP or lump-sum investment. Already computed by `src/utils/xirr.ts`.

**Benchmark XIRR** — What your portfolio XIRR would have been if every rupee you invested in a mutual fund had instead gone into the selected benchmark index (e.g. Nifty 50) on the same date. Already computed by `src/hooks/usePortfolio.ts`.

**Alpha** — The difference between your XIRR and the benchmark XIRR, expressed in percentage points. Positive alpha = beating the market; negative = lagging.

**Scheme category** — The AMFI-defined category of a fund, e.g. "Large Cap Fund", "Short Duration Fund". Stored in `fund.scheme_category`.

**Asset class bucket** — A top-level grouping of scheme categories: Equity, Debt, Hybrid, Other. Used for diversification scoring.

**Concentration risk** — The danger of being too heavily dependent on a single fund or a single sub-category within an asset class. Examples: one fund making up 70%+ of the portfolio, or all equity exposure in a single sector. High concentration amplifies the impact of any one fund performing badly.

**Traffic light** — Three-state colour signal applied to the score: Green (≥70), Amber (40–69), Red (<40).

**Health Score card** — The card widget displayed on the home screen between the portfolio header and the fund list.

**Score detail sheet** — A bottom sheet (modal) that slides up when the Health Score card is tapped, showing the per-factor breakdown.


## Scope


- `src/utils/healthScore.ts` — New file. Pure functions: `computeHealthScore(input)`, `scoreColor(score)`, `categoryToBucket(category)`.
- `src/hooks/usePortfolio.ts` — Extend `PortfolioSummary` to include `healthScore: HealthScoreResult`.
- `app/(tabs)/index.tsx` — Add `HealthScoreCard` component between the portfolio header and the "Your Funds" list header. Add `ScoreDetailSheet` bottom-sheet modal.
- `src/constants/theme.ts` — Verify `Colors.warning` is defined (amber `#d97706`); add if missing.


## Out of Scope


- Expense ratio as a scoring factor (deferred to Milestone 12).
- Push notifications when the score changes.
- Persistent score history or trend over time.
- Per-fund score (score is portfolio-level only).
- Recommendations or advice copy (score is descriptive, not prescriptive).


## Approach


### Scoring Algorithm — Phase 1 (this milestone)


Three factors totalling 100 points.


**Factor 1 — XIRR vs Benchmark (40 pts)**

    alpha = portfolioXirr - benchmarkXirr    (both as decimals, e.g. 0.14 = 14%)

    alpha >= +0.05  →  40 pts   (beating market by 5 pp or more)
    alpha >= +0.02  →  32 pts   (beating market by 2–5 pp)
    alpha >=  0.00  →  24 pts   (at or just above market)
    alpha >= -0.02  →  14 pts   (lagging by up to 2 pp)
    alpha  < -0.02  →   6 pts   (lagging by more than 2 pp)

    If either XIRR is non-finite (fewer than 2 transactions): 0 pts, flag xirrUnavailable: true.


**Factor 2 — Diversification (30 pts)**

Map each fund's `scheme_category` to an asset class bucket using substring matching:

    "Equity", "ELSS", "Index", "ETF", "Flexi Cap", "Multi Cap", "Large Cap",
    "Mid Cap", "Small Cap", "Sectoral", "Thematic"  →  Equity

    "Debt", "Liquid", "Money Market", "Overnight", "Short Duration",
    "Medium Duration", "Long Duration", "Gilt", "Credit Risk",
    "Floating Rate", "Banking and PSU"              →  Debt

    "Hybrid", "Balanced", "Conservative", "Aggressive", "Arbitrage"  →  Hybrid

    anything else                                   →  Other

Count the number of distinct buckets present in the portfolio.

    4 buckets  →  30 pts
    3 buckets  →  23 pts
    2 buckets  →  13 pts
    1 bucket   →   5 pts

    Special rule: if portfolio has only 1 fund, cap Factor 2 at 13 pts regardless of bucket count.


**Factor 3 — Concentration Risk (30 pts)**

Concentration risk penalises portfolios where a single fund or sub-category dominates, because one bad outcome then has an outsized impact. The factor starts at 30 and deductions are applied:

    Rule A — Single-fund dominance:
      Largest fund by current value > 60% of total portfolio value  →  -15 pts
      Largest fund > 40% of total portfolio value                   →  -8 pts

    Rule B — Equity sub-category concentration:
      Applies only if portfolio has any equity funds.
      Look at equity funds only. If any single scheme_category
      makes up > 70% of total equity value:                         →  -10 pts
      (e.g. all equity in Small Cap funds)

    Rule C — Thin portfolio:
      Fewer than 3 distinct funds total                             →  -5 pts

    Minimum: 0 pts (deductions do not go below zero).

All inputs are already available from `usePortfolio` (`fundCards[*].currentValue`, `fundCards[*].schemeCategory`).


**Phase 1 total: Factor1 + Factor2 + Factor3 (max 100)**

Traffic light thresholds applied to total:

    score ≥ 70  →  Green   (#16a34a)
    score ≥ 40  →  Amber   (#d97706)
    score  < 40 →  Red     (#dc2626)


### Scoring Algorithm — Phase 2 (Milestone 12, not implemented here)


When `expense_ratio` is available on the `fund` table (added in Milestone 12), four factors replace the three-factor model. `computeHealthScore` already accepts an optional `avgExpenseRatio` param; when present, Phase 2 weights are used automatically.

    Factor 1 — XIRR vs Benchmark:      30 pts max (same breakpoints, scaled to 30)
    Factor 2 — Diversification:        25 pts max (same breakpoints, scaled to 25)
    Factor 3 — Concentration Risk:     25 pts max (same deduction rules, scaled to 25)
    Factor 4 — Expense Ratio:          20 pts max
        Portfolio weighted-average expense ratio:
          < 0.5%  →  20 pts   (mostly direct, low-cost funds)
          0.5–1%  →  15 pts
          1–1.5%  →   8 pts
          > 1.5%  →   3 pts   (likely mostly regular plans)


### Verdict Copy


    score 80–100:  "Excellent"   / "Beating market and well diversified."
    score 70–79:   "Healthy"     / "Strong performance, decent diversification."
    score 60–69:   "Good"        / "Mostly on track, room to improve."
    score 50–59:   "Fair"        / "Benchmark lagging or concentration risk."
    score 40–49:   "Watch"       / "One or more areas need attention."
    score  0–39:   "At Risk"     / "Lagging the market and under-diversified."


### HealthScoreCard Layout


    ┌─────────────────────────────────────────────┐
    │  ◉ 74              Healthy               ›  │
    │  Health Score      Beating market,          │
    │                    decent diversification    │
    └─────────────────────────────────────────────┘

- Left: large coloured numeral (size 40, bold) inside a lightly filled circle (traffic-light colour at 12% opacity). Label "Health Score" below.
- Right: verdict in traffic-light colour (bold, size 15), then reason line (size 13, secondary text).
- Chevron icon at far right signals it is tappable.
- Card shares the same `borderRadius`, `shadow`, and `backgroundColor: Colors.surface` as fund cards.


### ScoreDetailSheet Layout


A `Modal` with `animationType="slide"` and a drag handle. Contains:

    ═══════════════════════════════════════════
    Portfolio Health Score              72 / 100

    ─────────────────────────────────────────
    ① XIRR vs Benchmark                 32 / 40
       Your XIRR 14.2%  ·  Nifty 50 11.8%
       Alpha: +2.4 pp — beating the market
       ████████████████░░░░

    ② Diversification                   23 / 30
       3 asset classes: Equity, Debt, Hybrid
       Add an Other-class fund to reach max
       ████████████████░░░░

    ③ Concentration Risk                17 / 30
       Largest fund 55% of portfolio — moderate
       Spread across more funds to reduce risk
       ████████████░░░░░░░░

    ④ Expense Ratio                        —
       Coming in a future update  🔒

    ─────────────────────────────────────────
    Total: 72 / 100  ·  Healthy

Each factor row:
- Factor name + fraction (e.g. 32/40) right-aligned.
- Progress bar (View with background colour at 30%, filled portion at 100% opacity).
- One sentence using the user's actual numbers.
- One sentence suggestion if points are below maximum.

The fourth row (Expense Ratio) is always shown but locked until Milestone 12, so users understand the score is not yet final.


### New File: `src/utils/healthScore.ts`


    export interface HealthScoreInput {
      portfolioXirr: number;                          // decimal, e.g. 0.142 for 14.2%
      benchmarkXirr: number;                          // decimal
      funds: { name: string; category: string; currentValue: number }[];  // one per active fund
      avgExpenseRatio?: number;                       // optional; decimal, e.g. 0.008 for 0.8%
    }

    export interface HealthScoreResult {
      score: number;          // 0–100
      color: string;          // hex traffic-light colour
      verdict: string;        // "Healthy" etc.
      reason: string;         // one-line summary
      xirrFactor: {
        points: number; max: number;
        alpha: number;  unavailable: boolean;
      };
      diversificationFactor: {
        points: number; max: number;
        buckets: string[]; count: number;
      };
      concentrationRiskFactor: {
        points: number; max: number;
        largestFundPct: number;      // e.g. 0.55 for 55%
        largestFundName: string;
        equityConcentrated: boolean; // true if single equity sub-category > 70% of equity
        deductions: string[];        // human-readable list of applied deductions
      };
      expenseRatioFactor: {
        points: number; max: number; available: boolean;
      };
    }

    export function computeHealthScore(input: HealthScoreInput): HealthScoreResult
    export function scoreColor(score: number): string
    export function categoryToBucket(category: string): string


### Data Flow


    usePortfolio(benchmarkSymbol)
      already returns:
        summary.xirr                  — portfolio XIRR (decimal)
        summary.marketXirr            — benchmark XIRR (decimal)
        fundCards[*].schemeName
        fundCards[*].schemeCategory
        fundCards[*].currentValue
      new output:
        summary.healthScore: HealthScoreResult


## New Files


- `src/utils/healthScore.ts`


## Modified Files


- `src/hooks/usePortfolio.ts` — compute and attach `healthScore` to `PortfolioSummary`
- `app/(tabs)/index.tsx` — `HealthScoreCard` and `ScoreDetailSheet` components
- `src/constants/theme.ts` — verify / add `Colors.warning`


## Validation


    npm run lint        -- zero warnings
    npm run typecheck   -- zero errors

    # Home screen — portfolio with funds in 2 asset classes, XIRR beating benchmark:
    # → Health Score card appears between portfolio header and "Your Funds" heading
    # → Score numeral is green (if ≥70) / amber (if 40–69) / red (if <40)
    # → Verdict text and reason line match the score range
    # → Tapping card opens ScoreDetailSheet

    # ScoreDetailSheet:
    # → Factor 1 shows actual portfolio XIRR, benchmark XIRR, alpha in pp
    # → Factor 2 shows bucket count and bucket names
    # → Factor 3 shows largest fund %, any applied deductions, and suggestion
    # → Factor 4 shows "Coming soon 🔒"
    # → Progress bars fill proportionally to score/max
    # → Sheet dismisses on drag-down or tap-outside

    # Edge cases:
    # → 1-fund portfolio: diversification capped at 13/30; concentration deducts for thin portfolio
    # → XIRR not computable: XIRR factor shows 0 pts with "Not enough transaction data"
    # → Empty portfolio: card hidden entirely


## Risks And Mitigations


| Risk | Mitigation |
|------|------------|
| Score feels arbitrary | Thresholds documented in plan and in code comments; breakdown always visible so users see the inputs. |
| Phase 2 weight change surprises users | Score breakdown sheet will note "Expense ratio now included" when Milestone 12 is added. Old scores stored nowhere, so no discontinuity. |
| `scheme_category` values change from mfapi.in | Bucket mapping uses `includes()` substring match. Unknown categories fall into "Other", which still counts toward diversification. |
| Bottom sheet too tall on small screens | Sheet height capped at 75% of screen height; content is a `ScrollView` if it overflows. |
| XIRR unavailable for new users | `xirrUnavailable: true` flag suppresses Factor 1 from the score; a note in the breakdown explains why. |


## Decision Log


- **Number + traffic light combined** — The user confirmed this approach: the score numeral is the traffic light (its colour signals the state). This gives precision and instant signal in one glance, superior to a letter grade alone.
- **Risk added as Phase 1 factor** — The PR review raised the concern that a health score without risk is incomplete. Concentration risk (single-fund dominance, equity sub-category overload, thin portfolio) is computable from data already in `usePortfolio` — no new data fetch needed. It is universally applicable regardless of the user's age or risk tolerance, unlike volatility-based metrics (which require goal context).
- **Concentration risk, not volatility** — Standard deviation and beta require NAV history series per fund and meaningful computation. Concentration risk is simpler, more actionable, and easier to explain to a first-time investor: "One fund makes up 55% of your portfolio — that's a lot of eggs in one basket."
- **Phase 1 now has 3 factors; Phase 2 adds expense ratio as a 4th** — Expense ratio data requires a new sync pipeline not built until Milestone 12. Rather than block this feature on that dependency, Phase 1 scores from three factors; the missing fourth is shown as a locked row in the breakdown so it is transparent, not silently absent.
- **Asset-class buckets, not AMFI sub-categories** — Counting 12 distinct AMFI sub-categories would punish small portfolios. Four buckets reward the decision that matters: cross-asset diversification.
- **Client-side computation** — All inputs are already fetched for the home screen. No new backend API call needed; zero latency overhead.
- **Score not stored** — There is no value in persisting historical scores before Phase 2 (incomplete data). When Phase 2 lands the score formula changes anyway, making old scores incomparable.


## Progress


- [ ] Write `src/utils/healthScore.ts` (all three Phase 1 factors + Phase 2 hook)
- [ ] Manually verify scoring: green scenario, amber (poor diversification), red (dominant fund + lagging market), XIRR unavailable
- [ ] Extend `PortfolioSummary` in `src/hooks/usePortfolio.ts` (pass `funds` array with name, category, currentValue)
- [ ] Add `HealthScoreCard` to `app/(tabs)/index.tsx`
- [ ] Add `ScoreDetailSheet` modal to `app/(tabs)/index.tsx` (4 rows: XIRR, Diversification, Concentration, Expense Ratio locked)
- [ ] Verify / add `Colors.warning` in `src/constants/theme.ts`
- [ ] `npm run lint` — zero warnings
- [ ] `npm run typecheck` — zero errors
- [ ] QA: green, amber, red, XIRR unavailable, 1-fund portfolio, dominant fund > 60%, all equity in one sub-category, empty portfolio

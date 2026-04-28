# M2 — Clear Lens Continuation: Rebase Gap Closure

## Goal

Close the gaps introduced by rebasing `my/clear-lens-design-mode` onto `main`. The rebase brought in two major new screens (`wealth-journey.tsx`, rebased `leaderboard.tsx`) and updated `appStore.ts` with `WealthJourneyState`. Clear Lens mode must cover every navigable tab and screen consistently before this branch is PR-ready.

The design handoff at `fundlens-clear-lens/project/` (especially `fl-wealth.jsx`) is the visual source of truth for Wealth Journey. All other screen parity guidelines carry over from M1.


## Context

Branch: `my/clear-lens-design-mode` (rebased onto `origin/main` at commit `19bc1d9`).

Post-rebase state:

- `npm run typecheck` — **passes** (0 errors)
- `npm run lint` — **fails** with 620+ errors, all from `fundlens-clear-lens/` prototype files which are not excluded from ESLint
- `npm test` — **460 passing**
- Classic composition chart colors regressed: `COMP_ASSET_COLORS` / `COMP_CAP_COLORS` in `app/fund/[id].tsx` use `ClearLensColors` unconditionally at module scope, breaking Fund Detail Composition tab in classic mode

Screens still missing Clear Lens treatment:

| Screen | File | Lines | Status |
|---|---|---|---|
| Wealth Journey | `app/(tabs)/wealth-journey.tsx` | 1683 | No `isClearLens` usage at all |
| Leaderboard | `app/(tabs)/leaderboard.tsx` | 556 | No `isClearLens` usage at all |

Design token differences to reconcile:

| Item | Design spec | Current impl | File |
|---|---|---|---|
| Danger/negative red | `#E5484D` | `#EF4444` | `src/constants/clearLensTheme.ts:14` |
| Portfolio chart range set | `['1M', '3M', '6M', '1Y', '3Y', 'All']` | `['1M', '6M', '1Y', '3Y', 'All']` (missing `'3M'`) | `ClearLensPortfolioScreen.tsx:56` |
| Positive/negative change display | ▲/▼ arrow + sign + color | Color-only (flagged in `fl-system.jsx`) | `ClearLensPortfolioScreen.tsx`, `ClearLensFundsScreen.tsx` |


## Scope

### Phase A — Gate fixes (must ship first, no behavior change)

1. **ESLint ignore**: add `'fundlens-clear-lens/'` to the `ignores` array in `eslint.config.js` so the prototype files in that directory do not pollute the lint output.
2. **Composition color regression**: restore classic colors for `COMP_ASSET_COLORS` and `COMP_CAP_COLORS` in `app/fund/[id].tsx`. These constants are at module scope and consumed only by the classic `FundCompositionTab`. Either restore the original classic color literals, or move the constants inside the component and guard with `isClearLens`. Classic fund detail composition charts currently show emerald/navy/mint instead of the intended red/blue/orange/purple.

### Phase B — Clear Lens Wealth Journey

Implement `ClearLensWealthJourneyScreen` and gate it at the route boundary in `app/(tabs)/wealth-journey.tsx`:

```typescript
export default function WealthJourneyScreen() {
  const { isClearLens } = useAppDesignMode();
  return isClearLens ? <ClearLensWealthJourneyScreen /> : <ClassicWealthJourneyScreen />;
}
```

All 1683 lines of existing logic become `ClassicWealthJourneyScreen` (rename, no changes to logic or data hooks).

The Clear Lens screen follows the `fl-wealth.jsx` design handoff. It has four views managed by local state (not new routes):

**View 1 — Summary (default)**
- `ClearLensHeader` with title "Wealth Journey" and back/menu affordances
- "Your portfolio today" card: current corpus (large navy value), monthly SIP, portfolio XIRR — data from `usePortfolio` and `estimateRecurringMonthlySip`
- "Your plan at a glance" with two tabs: "Wealth growth" and "Withdrawal income"
- Projected corpus headline (e.g. ₹9.78 Cr in 15Y) using Zustand plan state or defaults
- SVG growth chart: two lines — adjusted plan (solid emerald) vs current plan (dashed slate) — reuse `projectWealth` from `src/utils/simulatorCalc.ts`; milestone dots at 5Y, 10Y, 15Y
- "Adjust your plan →" CTA navigates to View 2
- Inflation-adjusted context line (uses `toPresentValueEquivalent`)
- Retirement income snapshot (withdrawal tab): monthly income, duration, using `projectRetirementIncome`

**View 2 — Adjust plan**
- `ClearLensHeader` with back to Summary
- Editable parameters as Clear Lens cards:
  - Monthly SIP (current detected + edit affordance → View 4 modal)
  - Annual top-up %
  - Years to retirement (slider or stepper)
  - Expected return tier: Cautious (7%) / Balanced (10%) / Growth (13%) / Custom — pills using `buildReturnProfile`
  - Withdrawal rate %
  - Post-retirement return %
- "See results →" CTA navigates to View 3

**View 3 — Results**
- `ClearLensHeader` with back to Adjust
- Side-by-side comparison: current plan vs adjusted plan (corpus, monthly income)
- Inflation-adjusted note
- "Save plan" persists to Zustand `updateWealthJourney`
- "Start over" resets via `resetWealthJourney`

**View 4 — Edit SIP modal**
- Full-screen modal overlay (not a new route)
- Three-step flow matching `fl-wealth.jsx`: (1) review detected SIP, (2) manual entry, (3) confirmation
- On confirm: updates `currentSipOverride` in Zustand

Component file: `src/components/clearLens/screens/ClearLensWealthJourneyScreen.tsx`

Data sources: `usePortfolio`, `useAppStore`, `estimateRecurringMonthlySip`, `buildReturnProfile`, `buildSipPresetChips`, `projectWealth`, `projectRetirementIncome`, `toPresentValueEquivalent`, `getMilestones` — all already in the codebase. No new hooks or edge functions needed.

### Phase C — Clear Lens Leaderboard

Implement `ClearLensLeaderboardScreen` and gate it in `app/(tabs)/leaderboard.tsx`:

```typescript
export default function LeaderboardScreen() {
  const { isClearLens } = useAppDesignMode();
  return isClearLens ? <ClearLensLeaderboardScreen /> : <ClassicLeaderboardScreen />;
}
```

Clear Lens treatment (same data, new chrome):
- `ClearLensHeader` with title "Leaderboard" and `...` overflow menu
- Benchmark selector pills (same pattern as `ClearLensPortfolioScreen`)
- Fund rows as `ClearLensCard` cells: rank badge (emerald for leaders, red for laggards), fund name, XIRR, benchmark delta pill (ahead/behind)
- Portfolio insight summary card at the top (if available)
- `ClearLensPill` for section dividers ("Leaders" / "Laggards")
- Loading, empty, and error states using `ClearLensCard`

Component file: `src/components/clearLens/screens/ClearLensLeaderboardScreen.tsx`

### Phase D — Design token reconciliation

1. **Danger red**: change `negative: '#EF4444'` to `negative: '#E5484D'` in `src/constants/clearLensTheme.ts` line 14. Update `ClearLensCompatibleColors` mapping accordingly. Verify the red renders correctly in `ClearLensPortfolioScreen` (worst mover card, negative change values) and `ClearLensFundsScreen` (negative XIRR rows).

2. **Portfolio chart range set**: add `'3M'` to `JOURNEY_WINDOWS` in `ClearLensPortfolioScreen.tsx` line 56: `['1M', '3M', '6M', '1Y', '3Y', 'All']`.

3. **▲/▼ change display**: the design handoff (`fl-components.jsx`) flags color-only positive/negative encoding as a usability issue. Add a `▲`/`▼` prefix to change values in `ClearLensPortfolioScreen` (today's change, mover cards) and `ClearLensFundsScreen` (fund row today change). Keep the existing color treatment; the arrow makes the meaning unambiguous without color.


## Out of Scope

- New Supabase schema, migrations, or Edge Functions
- Changes to classic mode screens beyond the composition color fix
- Reworking M1 decisions or architecture
- Adding new financial calculations not already present in `src/utils/`


## Validation Checklist

### Automated (required, zero tolerance)

```bash
npm run typecheck   # 0 errors
npm run lint        # 0 warnings (--max-warnings 0)
npm test            # all suites pass, ≥95% coverage for src/utils/
npm run export:web  # web build completes
```

### Manual (browser / device with demo account)

1. Sign in with the demo account/dev auth shortcut.
2. Classic mode — verify Fund Detail Composition tab shows original red/blue/orange/purple colors (Phase A regression check).
3. Switch to Clear Lens mode in Settings.
4. **Portfolio**: confirm `'3M'` range pill is present; confirm ▲/▼ arrows on today's change and mover cards.
5. **Leaderboard**: Clear Lens chrome renders; benchmark selector works; leaders/laggards ranked correctly.
6. **Wealth Journey**: "Your portfolio today" card shows real corpus + SIP + XIRR; growth chart renders; "Adjust your plan" and results flow works end-to-end; Edit SIP modal confirms and updates the plan.
7. Switch back to classic mode — Wealth Journey and Leaderboard revert to classic design with no visual artifacts.
8. Confirm negative values use `#E5484D` (token change) — check worst mover card and any negative XIRR in Leaderboard.


## Risks and Mitigations

1. **Wealth Journey scope creep** — `fl-wealth.jsx` has detailed sub-screens. Implement view-state switching in one component file first; do not split into sub-routes unless the component exceeds ~500 lines per view and the state footprint is too large to manage locally.

2. **Classic regression from token change** — `negative` token is used only in Clear Lens components. Grep confirms `#EF4444` does not appear in classic theme files. Safe to change.

3. **Test coverage for new screens** — `ClearLensWealthJourneyScreen` and `ClearLensLeaderboardScreen` are UI components; unit tests for the underlying utilities (`wealthJourney.ts`, `simulatorCalc.ts`) already exist. Snapshot or smoke tests for the new screen files are optional; do not compromise the ≥95% `src/utils/` threshold.

4. **SIP edit modal interaction** — the three-step SIP flow is new interaction surface. Validate with the demo account by walking through all three steps and confirming the SIP override persists after navigating away and back.


## Progress

- [x] Phase A: Add `fundlens-clear-lens/` to ESLint ignores
- [x] Phase A: Fix classic composition color regression in `app/fund/[id].tsx`
- [x] Phase B: Implement `ClearLensWealthJourneyScreen` (Summary, Adjust, SIP modal)
- [x] Phase B: Gate `wealth-journey.tsx` route with `isClearLens`
- [x] Phase C: Implement `ClearLensLeaderboardScreen`
- [x] Phase C: Gate `leaderboard.tsx` route with `isClearLens`
- [x] Phase D: Fix negative color token (`#EF4444` → `#E5484D`)
- [x] Phase D: Add `'3M'` to portfolio chart range set
- [x] Phase D: Add ▲/▼ change display in portfolio and funds screens
- [x] Run automated validation gate (typecheck + lint + test + export:web)
- [ ] Manual validation pass with demo account
- [x] Update README "What works now"
- [x] Raise PR

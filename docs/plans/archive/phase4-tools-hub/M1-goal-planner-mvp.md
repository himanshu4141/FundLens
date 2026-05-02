# M1 — Goal Planner MVP

## Goal

Allow users to calculate the monthly investment required to reach one independent financial goal using a transparent, deterministic formula with beginner-friendly copy.


## User Value

A novice investor wants to know: "How much should I invest every month to buy a house in 10 years?" Today FundLens has no answer. After this milestone, the user can open Goal Planner from Tools Hub, enter their goal details, and immediately see the required monthly SIP — along with a clear gap vs what they invest today and a projected path chart.


## Context

This is the first tool milestone after M0 (Tools Foundation). It builds on:

- `app/tools.tsx` — stack route for Tools Hub
- `src/store/appStore.ts` — `toolsFlags.goalPlanner` feature flag (currently `false`)
- `ClearLensToolsScreen` — Goal Planner card navigates to `/tools/goal-planner` when flag is `true`
- Clear Lens design system — tokens in `src/constants/clearLensTheme.ts`

**Stacked on:** `feat/tools-hub-m0` → this branch is `feat/tools-hub-m1`.

**New files:**

```
app/tools/
  goal-planner.tsx               — Expo Router route
src/components/clearLens/screens/tools/
  ClearLensGoalPlannerScreen.tsx — full screen component
src/utils/
  goalPlanner.ts                 — calculation logic (pure functions)
src/utils/__tests__/
  goalPlanner.test.ts            — unit tests for calc
docs/plans/phase4-tools-hub/
  M1-goal-planner-mvp.md         — this file
```


## Assumptions

1. Goal Planner works with INR only.
2. No portfolio data is needed — this is a standalone calculator.
3. Return presets: Cautious 8% p.a., Balanced 10% p.a., Growth 12% p.a.
4. Calculation uses the future-value of a growing annuity formula (monthly compounding).
5. Lump sum is compounded at the same assumed return rate.
6. The result is the required monthly SIP to bridge any remaining gap after lump sum contribution.
7. The "gap" is `requiredMonthlyInvestment - currentMonthlyInvestment`. If gap ≤ 0, user is on track.
8. No step-up SIP in M1 (added in M5).
9. No advisory language. Copy uses "estimate" and "based on assumptions".
10. `toolsFlags.goalPlanner` is flipped to `true` in this milestone.


## Definitions

**Future Value (FV)** — The value of an investment at the end of the period, assuming a constant return rate.

**Required Monthly SIP** — The monthly contribution needed, given a lump sum and time horizon, to reach the target amount.

**Gap** — The difference between required monthly SIP and the user's stated current monthly investment. Positive = user needs to invest more. Negative or zero = user is on track.

**Return preset** — A named annual return assumption:
- Cautious: 8% p.a.
- Balanced: 10% p.a.
- Growth: 12% p.a.


## Calculation Formula

Given:
- `target` — goal target amount (₹)
- `lumpSum` — amount already saved (₹)
- `months` — total months to goal
- `annualReturn` — expected annual return (decimal, e.g. 0.10)
- `monthlyRate` = `annualReturn / 12`

Step 1 — Future value of lump sum:
```
fvLumpSum = lumpSum × (1 + monthlyRate)^months
```

Step 2 — Remaining amount for SIP to cover:
```
remaining = target - fvLumpSum
```
If `remaining ≤ 0`, monthly SIP required = 0 (lump sum alone reaches goal).

Step 3 — Required monthly SIP (annuity formula):
```
requiredSip = remaining × monthlyRate / ((1 + monthlyRate)^months - 1)
```
If `monthlyRate === 0`, use `requiredSip = remaining / months`.

Step 4 — Gap:
```
gap = requiredSip - currentMonthlyInvestment
```


## Scope

- `goalPlanner.ts` — pure calculation functions with full tests
- `ClearLensGoalPlannerScreen` — inputs, results, scenario tuning
- Input fields:
  - Goal name (text, optional label only)
  - Target amount (₹ number)
  - Timeline (years or months — recommend years + convert)
  - Lump sum already saved (₹, default 0)
  - Current monthly investment (₹, default 0)
  - Return assumption: Cautious / Balanced / Growth (segmented control)
- Result section (shown after tapping Calculate):
  - Required monthly investment
  - Gap (positive = need more, negative = on track)
  - Projected path — simple line chart (invested vs corpus growth over time)
  - Assumptions disclosure text
- Scenario tuning — same input fields update result in real time after first calculate
- Empty / zero / edge states — target 0, months 0, already reached
- `toolsFlags.goalPlanner` set to `true`
- Route `app/tools/goal-planner.tsx`


## Out of Scope

- Multiple goals
- Goal-based portfolio allocation
- Fund recommendations
- Advisory conclusions
- Step-up SIP (M5)
- Saving goals to Supabase


## Approach

### Screen layout

```
[Header — "Goal Planner" + back chevron]

[Input card]
  Goal name (text input, optional)
  Target amount (₹ number input)
  Timeline (years selector — 1–30)
  Amount already saved (₹ number, default 0)
  Current monthly investment (₹, default 0)
  Return assumption (Cautious / Balanced / Growth segmented)

[Calculate button]

[Result card — visible after first valid calculate]
  Required monthly investment   ₹34,000/mo
  Gap vs your current amount    ₹9,000 more needed
  OR: You're on track           (if gap ≤ 0)

[Projected path chart — simple line: corpus vs invested]

[Assumptions disclosure]
  "Based on: ₹50L target, 10 years, 10% p.a. return (Balanced). 
   Results are estimates. Past performance is not indicative of future returns."
```

### Component structure

- `ClearLensGoalPlannerScreen` — main screen, holds all state
- `GoalInputCard` — inner component for input fields
- `GoalResultCard` — inner component for results
- `ProjectionChart` — simple path chart using `react-native-gifted-charts` LineChart (already installed)


## Validation

1. `npx jest src/utils/__tests__/goalPlanner.test.ts` — all pass
2. `npm run typecheck && npm run lint` — zero errors/warnings
3. `npx jest --coverage` — overall ≥70%, src/utils ≥95%
4. Open app → Tools Hub → Goal Planner card is now tappable (not "Soon")
5. Enter: Target ₹50L, 10 years, Balanced → Calculate → result shows
6. Adjust timeline to 5 years → result updates
7. Enter lump sum ₹10L → required SIP drops
8. Set current monthly ₹25K → gap shown correctly
9. Enter target 0 → graceful empty state
10. Enter months 0 → graceful error state


## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| `app/tools/` directory may need a `_layout.tsx` for Expo Router | Check if other nested routes have a layout; add a minimal one if needed |
| Gifted charts may not render on web | Test on iOS simulator and note web limitation if present |
| Step-up SIP request in M1 | Explicitly out of scope; add UI affordance for "upgrade in a future update" if asked |


## Decision Log

- **2026-05-01**: Cautious/Balanced/Growth presets at 8%/10%/12% — industry-standard conservative assumptions, clearly disclosed.
- **2026-05-01**: No Supabase persistence for goals in M1 — local state only, reduces scope.
- **2026-05-01**: Monthly compounding — standard for SIP calculators.


## Progress

- [x] Branch `feat/tools-hub-m1` rebased onto `main` after M0 squash-merge
- [x] M1 ExecPlan written
- [x] `goalPlanner.ts` calculation functions + tests (24 tests, 97% coverage)
- [x] `ClearLensGoalPlannerScreen` implemented (input card, result card, SVG projection chart)
- [x] `app/tools/` directory restructured: `_layout.tsx` + `index.tsx` + `goal-planner.tsx`
- [x] `app/tools.tsx` removed (replaced by directory layout)
- [x] `toolsFlags.goalPlanner` set to `true`
- [x] typecheck ✓ lint ✓ 496 tests ✓ src/utils 96% ✓
- [x] PR #78 raised against `main`

## Amendments

- `app/tools.tsx` was moved to `app/tools/index.tsx` + `app/tools/_layout.tsx` to support nested routes (`/tools/goal-planner`). The root `app/_layout.tsx` received a `<Stack.Screen name="tools" />` entry.
- `GoalResultCard` uses inline Ionicons checkmark for the on-track state rather than a separate metric card.
- Projection chart built with `react-native-svg` (same pattern as WealthJourneyScreen), not `react-native-gifted-charts`.

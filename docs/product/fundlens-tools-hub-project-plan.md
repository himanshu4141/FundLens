# FundLens Tools Hub Project Plan

## 1. Overview

This plan breaks the Tools Hub programme into milestones that can be built incrementally.

Current bottom nav:

```text
Portfolio | Your Funds | Wealth Journey
```

Do not replace Wealth Journey yet. Add Tools as an entry point first. Later, once enough tools are live, replace Wealth Journey with Tools and make Wealth Journey the featured tool inside Tools.

---

## 2. Milestone order

```text
M0 Tools Foundation
   |
   +--> M1 Goal Planner MVP
   |
   +--> M2 Past SIP Check
   |
   +--> M3 Compare Funds MVP
   |
   +--> M4 Direct vs Regular Impact
           |
           +--> Cross-app integrations:
               Portfolio
               Portfolio Insights
               Your Funds
               Fund Detail
               Compare Funds
               Wealth Journey

After M1/M2 can begin:
   M5 Step-up SIP support

After M2/M3/M4 requirements are understood:
   M6 All-Fund Data Platform
```

### Parallelisation

After Milestone 0, these can run mostly in parallel:

- M1 Goal Planner MVP
- M2 Past SIP Check
- M3 Compare Funds MVP

M4 Direct vs Regular Impact can begin in parallel if direct/regular mapping and expense-ratio data are available. If not, do a short data spike first.

M5 Step-up SIP depends on Goal Planner and Wealth Journey assumptions being stable.

M6 All-Fund Data Platform is a larger data milestone and should not block M1–M5.

---

## 3. Milestone 0 — Tools Foundation

### Goal

Create the structural foundation for a Tools Hub without replacing Wealth Journey in bottom nav.

### Scope

- Tools Hub screen
- Clear Lens design implementation
- Tool category sections:
  - Featured
  - Plan
  - Compare
  - Explore
  - Cost & Fees
- Tool cards
- Feature flags per tool
- Coming-soon state
- Entry points from:
  - Wealth Journey
  - Portfolio quick actions
  - Your Funds expanded row where relevant
  - Fund Detail where relevant
- Navigation routes for tool screens
- Analytics events if existing app has analytics

### Out of scope

- Replacing bottom nav
- Building all tools fully
- All-fund data support
- Advisory recommendations

### Acceptance criteria

- User can open Tools Hub from Wealth Journey.
- User can open Tools Hub from Portfolio quick actions.
- Tools Hub follows Clear Lens tokens and components.
- Wealth Journey appears as the featured tool.
- Goal Planner, Compare Funds, Past SIP Check, and Direct vs Regular Impact appear as cards.
- Tool cards can be marked as available, disabled, or coming soon.
- Tapping an unavailable tool shows a calm coming-soon state.
- No references to Morningstar or star ratings exist.
- Bottom nav remains `Portfolio | Your Funds | Wealth Journey`.
- App name remains FundLens.
- No product rename to Clear Lens.
- Tests/build/lint pass.

---

## 4. Milestone 1 — Goal Planner MVP

### Goal

Allow users to calculate the monthly investment required to reach one independent goal.

### Scope

- Goal Planner screen
- Goal input form:
  - Goal name
  - Target amount
  - Target date / years
  - Existing lump sum
  - Current monthly investment
  - Return assumption: Cautious / Balanced / Growth
- Result summary:
  - Required monthly investment
  - Monthly gap
  - Projected path
  - Clear assumptions
- Scenario tuning:
  - Timeline
  - Monthly investment
  - Lump sum
  - Return assumption
- Empty/error states

### Out of scope

- Allocating current portfolio to goals
- Multiple-goal optimisation
- Goal-based recommendations
- Fund recommendations
- Step-up SIP support, unless implemented later via M5

### Acceptance criteria

- User can create and calculate a goal independently.
- Result clearly shows required monthly investment.
- Result clearly shows gap vs current monthly investment.
- User can adjust assumptions and see result update.
- Calculation uses deterministic, documented formula.
- Copy uses "estimate", "based on assumptions", and avoids guarantees.
- No advisory language is used.
- UI follows Clear Lens design system.
- Tests cover calculation edge cases.
- Build/lint/tests pass.

---

## 5. Milestone 2 — Past SIP Check

### Goal

Allow users to simulate how a monthly SIP would have performed in a selected user-held fund.

### Scope

- Past SIP Check screen
- Fund selector from user-held funds
- Monthly SIP amount input
- Duration selector
- Investment day selector, default 1st of month
- Benchmark selector:
  - Nifty 50
  - Nifty 100
  - BSE Sensex
- Result:
  - Total invested
  - Current value
  - Gain/loss
  - XIRR
  - Fund vs benchmark comparison
  - Growth chart
- Fund-history-shorter-than-duration handling

### Out of scope

- All mutual funds
- Tax-adjusted returns
- Fund recommendations
- Lumpsum mode
- Multiple SIP dates per month

### Acceptance criteria

- User can select a current portfolio fund.
- User can set SIP amount and duration.
- Simulation uses available NAV history.
- Benchmark comparison uses existing benchmark data.
- If fund history is too short, app explains adjusted start date.
- Result shows total invested, current value, gain/loss, and XIRR.
- Chart is readable and not dense.
- No advisory ranking is shown.
- UI follows Clear Lens design system.
- Tests cover monthly SIP date handling and short-history case.
- Build/lint/tests pass.

---

## 6. Milestone 3 — Compare Funds MVP

### Goal

Allow users to objectively compare up to 3 funds they already hold.

### Scope

- Compare Funds screen
- Fund picker for user-held funds
- Support 2–3 selected funds
- Comparison sections:
  - Basic details
  - Category
  - Fund age
  - AUM if available
  - Expense ratio
  - Benchmark
  - Trailing returns
  - Risk ratios if available
  - Asset allocation
  - Market-cap mix
  - Sector exposure
  - Top holdings
  - Holding overlap
- Objective insight cards

### Out of scope

- Morningstar rating
- Star ratings
- "Best fund" labels
- Buy/sell/hold recommendations
- Comparing funds outside user portfolio
- Category average unless already available

### Acceptance criteria

- User can select 2 or 3 funds from current portfolio.
- App shows comparison sections listed above where data exists.
- Missing data is handled gracefully.
- Holding overlap is shown if holdings data exists.
- No Morningstar/star rating references exist.
- No advisory copy is used.
- UI avoids dense tables where possible.
- Clear Lens visual system is used.
- Tests cover selected-fund constraints and missing-data handling.
- Build/lint/tests pass.

---

## 7. Milestone 4 — Direct vs Regular Impact

### Goal

Show users the estimated long-term cost impact of holding regular mutual fund plans compared with direct variants.

### Scope

- Direct vs Regular Impact tool screen
- Portfolio-level estimate
- Fund-level breakdown
- Horizon selector:
  - 5Y
  - 10Y
  - 15Y
  - 20Y
- SIP assumption:
  - Detected SIP where available
  - Manual override
- Assumption explanation
- Direct/regular split
- Weighted expense ratio
- Regular-plan exposure
- Cross-app integration:
  - Portfolio cost insight
  - Portfolio Insights Cost & Fees section
  - Your Funds plan-type chips and expanded-row cost action
  - Fund Detail Plan Cost card
  - Compare Funds expense-ratio comparison
  - Wealth Journey lower-cost scenario, optional if feasible

### Out of scope

- Advising user to switch
- Executing switch transaction
- Tax impact calculation
- Exit load calculation unless already available
- All-fund direct/regular mapping unless data exists

### Acceptance criteria

- Regular funds are detected where data allows.
- Direct funds are labelled correctly where data allows.
- Unknown plan types are handled gracefully.
- Tool shows estimated impact using clear assumptions.
- Estimates use cautious language.
- Portfolio, Portfolio Insights, Your Funds, and Fund Detail show relevant cost insights.
- No red warning/shaming treatment for regular plans.
- No "switch now" advisory CTA is used.
- UI follows Clear Lens design system.
- Tests cover expense-ratio difference, horizon, SIP override, and unknown mappings.
- Build/lint/tests pass.

---

## 8. Milestone 5 — Step-up SIP Support

### Goal

Add step-up SIP assumptions inside Goal Planner and Wealth Journey.

### Scope

- Add annual SIP increase selector:
  - 0%
  - 5%
  - 10%
  - Custom
- Use step-up in Goal Planner projection.
- Use step-up in Wealth Journey projection.
- Compare flat SIP vs step-up scenario where useful.
- Clear explanation of assumptions.

### Out of scope

- Standalone Step-up SIP tool
- Salary/income modelling
- Advisory suggestions

### Acceptance criteria

- Goal Planner supports annual SIP increase.
- Wealth Journey supports annual SIP increase.
- User can compare flat SIP and step-up scenario.
- Projections are deterministic and tested.
- Copy explains that results are estimates.
- UI follows Clear Lens design system.
- Build/lint/tests pass.

---

## 9. Milestone 6 — All-Fund Data Platform

### Goal

Enable Tools to work beyond user-held funds by building broader mutual fund data support.

### Scope

- Fund master
- Fund search
- All-fund NAV history
- Benchmark mapping
- Direct/regular mapping
- Expense-ratio data
- AUM/factsheet data
- Portfolio disclosures
- Risk ratios
- Category averages if available

### Out of scope

- Morningstar dependency
- Ratings-based recommendations
- Advisory ranking
- Broker sync

### Acceptance criteria

- User can search funds outside their portfolio.
- Past SIP Check can run for any fund with NAV history.
- Compare Funds can compare selected funds beyond user holdings.
- Direct vs Regular mapping works for supported schemes.
- Missing data is clearly explained.
- Data sync process is documented.
- Tests cover data import and matching.
- Build/lint/tests pass.

---

## 10. Recommended delivery sequence

### Phase A: Product shell

1. M0 Tools Foundation

### Phase B: User-value tools using existing data

These can run in parallel after M0:

2. M1 Goal Planner MVP
3. M2 Past SIP Check
4. M3 Compare Funds MVP

### Phase C: Cross-app cost insight

5. M4 Direct vs Regular Impact

### Phase D: Projection enhancement

6. M5 Step-up SIP Support

### Phase E: Data expansion

7. M6 All-Fund Data Platform

---

## 11. Dependency map

```text
M0 Tools Foundation
├── M1 Goal Planner MVP
│   └── M5 Step-up SIP Support
├── M2 Past SIP Check
│   └── M6 All-Fund Data Platform expands scope
├── M3 Compare Funds MVP
│   ├── M4 Direct vs Regular Impact enriches cost comparison
│   └── M6 All-Fund Data Platform expands scope
└── M4 Direct vs Regular Impact
    ├── Portfolio integration
    ├── Portfolio Insights integration
    ├── Your Funds integration
    ├── Fund Detail integration
    └── Wealth Journey scenario, optional
```

---

## 12. Validation expectations for every milestone

Each milestone must provide:

- Screenshot/video of changed screens
- Test results
- Lint/typecheck results
- Notes on assumptions
- Notes on missing data handling
- Confirmation that advisory boundaries are respected
- Confirmation that Clear Lens design system is used
- Confirmation that bottom nav is unchanged unless the milestone explicitly changes it

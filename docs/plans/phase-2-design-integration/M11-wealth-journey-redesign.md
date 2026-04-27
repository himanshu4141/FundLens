# M11 — Wealth Journey Redesign

## Goal

Replace the legacy `Simulator` experience with **Wealth Journey**, a planning flow
that feels grounded in the user’s actual portfolio and is useful for both wealth
creation and retirement-income exploration.


## User Value

Users were losing trust in the old simulator because it felt generic and brittle:

- SIP detection was often materially wrong
- there was no way to correct the inferred SIP once it was wrong
- 15% return defaults felt promotional rather than prudent
- the screen treated current corpus like just another input instead of real context
- retirement-style planning was impossible because withdrawals were not modeled

Wealth Journey fixes that by starting from the user’s real portfolio, giving them
clear override controls, and showing both future corpus and a simple drawdown view.


## Context

The original simulator shipped under M6 as a straightforward future-value calculator.
That plan was valid for the first version, but the product has since evolved:

- the app now has richer portfolio context available on-device
- users are comparing the tool against real planning products
- the Portfolio screen has become more polished and strategic, so the old simulator
  now feels like a disconnected utility

This plan exists because the implementation moved beyond “amend the old simulator.”
The redesign changes the interaction model, the projection model, the naming, and
the way the feature is introduced from the Portfolio screen. That is substantial
enough to deserve a new canonical ExecPlan rather than a large amendment block
inside M6.


## Assumptions

- We do not collect date of birth or a retirement age
- We do have access to:
  - current portfolio corpus
  - current portfolio XIRR
  - recent transaction history
- We can persist lightweight local planning state in the existing Zustand store
- v1 should keep inflation fixed and explanatory rather than user-configurable
- v1 should stay scenario-based, not imply regulated financial advice


## Definitions

- **Current corpus**: the user’s portfolio value today
- **Detected SIP**: an estimate of recurring monthly investment from recent transaction
  history
- **Additional top-up**: new money the user plans to add now, on top of today’s corpus
- **Accumulation phase**: the years during which corpus grows via compounding and SIPs
- **Withdrawal phase**: the years after that, during which money is withdrawn annually
- **Present-value equivalent**: today-value translation of a future nominal amount,
  using fixed 6% inflation for display only


## Scope

- Rename the tab and screen from `Simulator` to **Wealth Journey**
- Rebuild the screen around four sections:
  - `Your portfolio today`
  - `Adjust your plan`
  - `Projected wealth`
  - `Retirement income`
- Replace old tiny-step controls with chips plus direct input
- Tighten SIP detection to a recurring-pattern heuristic over the last 6 months
- Allow SIP override with local persistence and reset-to-detected
- Replace optimistic fixed defaults with portfolio-aware return presets
- Expand projections from one phase to two:
  - accumulation
  - withdrawal
- Add fixed 6% inflation present-value note under projected wealth
- Add a small Portfolio-screen teaser card that leads into Wealth Journey


## Out of Scope

- Collecting or storing DOB, retirement age, or tax profile
- Editable inflation assumptions
- Highly advanced retirement Monte Carlo or sequence-of-returns modeling
- Personalized advisor-like recommendations
- Changing portfolio import or transaction normalization rules themselves


## Approach

1. Move the feature onto a proper planning model backed by persisted local state
2. Separate “detected portfolio context” from “user-adjusted assumptions”
3. Use sane portfolio-aware defaults so the first render feels credible
4. Keep the screen simple enough for quick iteration, but introduce a second
   withdrawal phase so retirement use cases are no longer blocked
5. Add a teaser card on Portfolio that uses only known data and acts as a natural
   next step rather than a promotional banner


## Alternatives Considered

### 1. Keep patching the old simulator

Rejected because the problems were structural, not cosmetic. The old screen treated
corpus, SIP, and assumptions as a thin calculator surface; adding withdrawal logic
and better defaults on top of it would have produced a messy hybrid.

### 2. Create a completely separate retirement planner screen

Rejected because that would fragment the mental model. Users want one place to ask:
“What does my current plan become?” Retirement income is a second phase of the same
journey, not a different product.

### 3. Randomize teaser variants on the Portfolio screen

Rejected because the Portfolio teaser should reflect user state, not feel like
marketing rotation. Rule-based selection is more legible and easier to trust.


## Milestones

### Milestone 1 — Replace the math and persistence layer

Build a stable foundation for Wealth Journey:

- extend `src/utils/simulatorCalc.ts` with:
  - accumulation projection
  - withdrawal projection
  - present-value helper
- add new journey helpers in `src/utils/wealthJourney.ts` for:
  - recurring SIP detection
  - teaser selection
  - return preset derivation
- extend `src/store/appStore.ts` with persisted Wealth Journey state

Expected outcome:

- the app can derive a detected SIP
- the app can model both accumulation and withdrawal
- overrides and last-used values survive app restarts

### Milestone 2 — Rebuild the screen as Wealth Journey

Replace `app/(tabs)/wealth-journey.tsx` with a new interaction model:

- current corpus shown as context, not a tweak-first control
- chips plus direct input instead of stepper-only controls
- expected return presets:
  - Cautious
  - Balanced
  - Growth
- projected wealth section with:
  - nominal corpus
  - current-vs-adjusted comparison
  - milestone cards
  - chart
  - fixed 6% inflation note
- retirement section with:
  - retirement duration
  - withdrawal rate
  - post-retirement return
  - supported monthly income

Expected outcome:

- the screen feels like a planning flow rather than a calculator
- users can correct the SIP estimate and meaningfully explore scenarios

### Milestone 3 — Integrate Wealth Journey into the app shell

- rename the tab label in `app/(tabs)/_layout.tsx`
- add a small Portfolio teaser card below Portfolio Insights and above Your Funds
- update user-facing docs and screen-map docs

Expected outcome:

- the feature is discoverable from Portfolio
- the app language consistently says Wealth Journey, not Simulator


## Validation

Run:

    npm run typecheck
    npm run lint
    npm test -- --runInBand

Then verify in browser and on device:

1. Wealth Journey opens from the bottom tab and from the Portfolio teaser
2. The detected SIP can be overridden and reset
3. Return presets set a sane default rather than a hardcoded 15%
4. The chart starts from today’s corpus and stays within the viewport
5. Inflation note appears below projected wealth
6. Retirement section shows monthly income and residual corpus / depletion behavior
7. Portfolio teaser changes copy based on whether the user has saved Wealth Journey
   settings before


## Risks And Mitigations

- **Risk: SIP detection is still imperfect**
  - Mitigation: make override obvious, persist it locally, and support reset

- **Risk: projection numbers feel over-precise**
  - Mitigation: keep copy scenario-based and add the nominal/pre-tax inflation note

- **Risk: users interpret the feature as retirement-age aware**
  - Mitigation: avoid retirement-age language unless the user has explicitly chosen
    a time horizon

- **Risk: teaser card feels like a promo banner**
  - Mitigation: keep it in the same card family as Portfolio modules and use
    rule-based state-aware copy


## Decision Log

- We renamed the feature to **Wealth Journey** because “Simulator” is too generic
  and undersells the planning intent
- We kept inflation fixed at **6%** in v1 to ground outcomes without opening another
  complexity dial
- We chose **withdrawal rate** rather than monthly-income targeting as the primary
  retirement control because we do not have enough user profile data for a more
  sophisticated recommendation layer
- We chose **rule-based Portfolio teaser variants** over random rotation because the
  teaser should reflect user state, not behave like marketing copy
- We use **See possibilities** as the CTA so the card feels like an invitation,
  not a copycat of competitor wording


## Progress

- [x] Replace projection math and add withdrawal / inflation helpers
- [x] Add recurring SIP detection and teaser / return-profile helpers
- [x] Add persisted Wealth Journey state
- [x] Rebuild the screen as Wealth Journey
- [x] Add the Portfolio teaser card
- [x] Rename the shared tab label and update docs
- [x] Validate with typecheck, lint, and tests

## Amendments

### Summary-first journey replaced the original stacked screen

The original redesign plan described one long screen with portfolio context,
inputs, projected wealth, and withdrawal outputs all stacked vertically. That
proved serviceable for the math, but it remained too calculator-like on mobile
and kept reintroducing layout problems around charts and axis labels.

The implementation was deliberately reshaped into a clearer two-step journey:

- a **summary screen** with:
  - `Your portfolio today`
  - `Your plan at a glance`
  - one results view at a time via `Wealth growth` / `Withdrawal income`
  - a single `Adjust your plan` CTA
- an **adjust screen** where investment and withdrawal assumptions are edited
  without competing with charts

This also moved SIP correction out of the main planning form and into an explicit
review/edit flow, which better matches user intent:

- fixing a wrong detected SIP is a baseline correction
- changing the plan going forward is a separate action

That separation is now part of the intended design, not just an implementation
detail.

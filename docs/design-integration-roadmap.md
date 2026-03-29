# Design Integration Roadmap

## Goal

Adopt the strongest parts of the imported design concept without losing current FundLens functionality, while setting up a single focus-group session that gathers feedback on both product behavior and presentation.

This roadmap reflects the following fixed constraints:

- Compare should be removed completely.
- Settings should no longer occupy a primary bottom-tab slot.
- There will be one combined focus-group round, not repeated user-testing cycles.
- No new paid data source should be introduced to support concept features.
- No explicit replacement for Compare is required.

## Product guardrails

- Preserve the core value promised in [VISION.md](/Users/hyadav/code/personal/FundLens-main-review/VISION.md): novice-first portfolio signal, benchmark context, and SIP-aware return clarity.
- Preserve current live functionality on `main` unless there is an explicit replacement.
- Treat the imported concept as design direction, not as a source of truth for data models or feature cuts.
- Prefer free or already-adopted data sources. Any free community source used for enrichment must degrade gracefully.

## Recommended phases

### Phase 0 — Design audit and parity contract

Deliverable:
- a screen-by-screen audit of `funlens_design_concept` vs current `main`
- a parity matrix covering:
  - current behavior to preserve
  - concept-only ideas worth adding
  - current functionality missing from the concept
  - free-data feasibility and risk notes

Why first:
- this prevents accidental feature loss during the visual redesign
- it turns the design concept into an implementation backlog instead of a set of assumptions

### Phase 1 — Information architecture update

Scope:
- remove Compare from primary navigation
- move Settings behind a header/profile entry point
- introduce the new primary navigation without carrying Compare forward

Expected result:
- a cleaner primary nav that better reflects your intended product
- Compare is intentionally retired as a product capability

Open decision to resolve during implementation:
- whether the replacement nav is `Home / Leaderboard / Simulator` exactly, or whether one destination remains a placeholder until the corresponding feature is ready

### Phase 2 — Functional gap closure

Scope should be driven by the audit, but likely includes:
- Home additions from the concept that strengthen the current value proposition
- richer fund-detail presentation where it uses existing data or free data
- leaderboard screen if it materially replaces part of Compare’s value
- simulator screen because it is self-contained and data-source independent

Priority rule:
- implement only concept features that either strengthen the product story or are necessary for the focus group
- defer decorative or low-signal additions

Free-data rule:
- features that need paid or brittle data should be cut, simplified, or marked optional

### Phase 3 — Design variant architecture

Scope:
- add a persisted design toggle in Settings
- keep the current theme as the control
- add the editorial concept as the variant

Guardrail:
- do this only after the key feature set is close enough to parity that the focus group is not just reacting to missing functionality

### Phase 4 — Focus-group build and evaluation script

Scope:
- prepare a stable branch/build with both design variants available
- define a short evaluation script for the single focus-group round
- capture feedback on:
  - navigation clarity
  - home usefulness
  - fund-detail comprehension
  - perceived trust/polish
  - whether leaderboard/simulator add value after Compare is removed

Important framing:
- this is a comparative evaluation session, not a statistically clean A/B experiment

## Suggested milestone sequence

### M0 — Audit
- Write the parity audit and replacement contract.

### M1 — Navigation + Settings relocation
- Move Settings out of the tab bar.
- Remove Compare from primary nav.
- Add the replacement nav shell with placeholders only where justified.

### M2 — Home parity
- Add the concept’s strongest Home ideas that align with the vision:
  - portfolio-vs-market visual
  - top movers if they are computable from existing portfolio data
- Preserve existing benchmark and staleness behaviors.

### M3 — Leaderboard
- Build as a new portfolio-insight destination in its own right.
- Make the ranking logic explicit and novice-readable.

### M4 — Fund detail expansion
- Add the concept’s extra insight modules that can be backed by existing data first.
- Treat external free metadata enrichment as optional, not blocking.

### M5 — Simulator
- Build as a self-contained tool with no paid data dependency.

### M6 — Editorial variant toggle
- Add the theme/design toggle after functional bridging is far enough along.

### M7 — Focus-group prep
- Stabilize the evaluation build.
- Prepare the discussion script and feedback capture template.

## What not to do

- Do not remove existing capability without naming the replacement screen or interaction.
- Do not let optional metadata enrichment block core navigation and product flow work.
- Do not treat the designer’s HTML as an implementation spec for data fidelity.
- Do not call the final validation a clean A/B test if the variables are not isolated.

## Immediate next step

Use the audit in `docs/design-parity-audit.md` to decide:
- which concept features are worth building before the focus group
- which concept details should be cut because they require paid or unreliable data

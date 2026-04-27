# ExecPlan: Composition App Enrichment


## Status

Proposed


## Goal

Define how the app should present richer composition data once the source strategy from Stage 2 is implemented.


## User Value

- Users see composition data that better matches what the fund actually discloses.
- Hybrid funds and international FoFs stop looking artificially simplified.
- Important fund metadata such as benchmark, risk, and rating becomes easier to understand.


## Context

The Stage 1 research report in `docs/research/2026-04-21-composition-source-validation.md` found:

- official sources often win not just for asset allocation but also for sectors and holdings
- international FoFs expose richer structures that should not be flattened too early
- `mfdata` still matters as enrichment, especially for metadata and some international detail

The current app is optimized around a flat composition model:

- `Portfolio Insights` renders:
  - asset mix
  - debt / cash summary
  - market-cap mix
  - sector breakdown
  - top holdings
- the fund composition tab renders:
  - asset mix
  - market-cap mix
  - sector breakdown
  - top holdings
- debt holdings and other holdings are not shown
- provenance is reduced to a simple `amfi` vs `category_rules` footer


## Assumptions

- Stage 2 source rules and storage design are approved before any UI implementation begins.
- The first UI rollout should stay focused on the screens where composition already exists.
- The UI should remain novice-friendly even when the source data becomes richer.


## Definitions

- Rich source-native buckets: source-specific composition groups such as `Global`, `Arbitrage`, `REIT / InvIT`, `TREPS`, or `Debt and Money Market Instruments`.
- Simplified summary: a compact `equity / debt / cash / other` view used for fast comprehension.
- Provenance: where the displayed data came from and how trustworthy it is.


## Scope

- Define which new fund metadata to surface.
- Define how richer composition should be presented.
- Define how international FoFs should be presented differently from domestic equity funds.
- Define where provenance should appear.
- Define rollout order by screen.


## Out of Scope

- Implementing new components.
- Restyling unrelated screens.
- Expanding every holdings list in the app at once.


## Approach

### 1. Metadata to surface

Surface these fields first when available:

- declared benchmark name
- `risk_label`
- `morningstar_rating`
- existing technical metadata already in scope:
  - expense ratio
  - AUM
  - minimum SIP

Recommended first home:

- Fund Detail

Do not add these to every card or list immediately. Keep the first pass focused and readable.

### 2. Composition presentation model

Show both:

- a simple summary
- the richer raw structure when it adds meaning

Recommended presentation rule:

- always show a simple summary card for fast scanning
- show richer source-native sections underneath when available

Examples:

- domestic equity fund:
  - summary asset mix
  - market-cap mix
  - sector breakdown
  - top holdings
  - debt / cash details only when meaningful
- hybrid fund:
  - summary asset mix
  - debt holdings section
  - debt instrument break-up when available
  - equity sectors / holdings when available
- international FoF:
  - summary asset mix only as a secondary view
  - primary rich section should show:
    - global vs Indian exposure
    - underlying funds / ETFs
    - cash / TREPS
    - any REIT / InvIT or similar residual buckets

### 3. Provenance and trust cues

Replace the current coarse `AMFI disclosure` vs `Estimated from fund category` language with clearer provenance tiers:

- official AMC disclosure
- official AMC disclosure plus enrichment
- enriched from secondary source
- estimated from fund category

Each composition surface should also show:

- data as-of date
- short provenance label
- when needed, a one-line explanation of what is estimated

### 4. Debt and other holdings

Do not hide non-equity exposure behind a single debt / cash card only.

When available, expose:

- debt holdings
- debt instrument type or credit buckets if source provides them
- other holdings
- for FoFs, underlying funds / ETFs as their own list

### 5. Rollout order by screen

#### First rollout

- Fund Detail
- Portfolio Insights

Reason:

- both screens already contain composition concepts
- both are explicitly called out in `docs/SCREENS.md`
- this keeps the rollout focused without adding noise to the home screen or holdings list

#### Later rollout only if justified

- Your Funds
- Leaderboard
- Portfolio tab entry cards

Those screens should not be expanded until the richer data model proves valuable and stable.


## Alternatives Considered

- Show only the richer source-native structure and remove the simplified summary:
  - rejected because the app is designed for novice investors
- Keep only the four-bucket summary:
  - rejected because it would repeat the current information loss
- Roll richer metadata out across every screen immediately:
  - rejected because it would add noise before the new data model proves itself


## Milestones

### Milestone 1 — Fund Detail composition redesign

Scope:
- define how metadata and richer composition fit into the fund detail screen

Expected outcome:
- fund detail becomes the most information-rich single-fund view

Acceptance criteria:
- the screen can present domestic funds, hybrids, and international FoFs without forcing them into the same visual template

### Milestone 2 — Portfolio Insights redesign

Scope:
- define how portfolio-level aggregation should consume richer composition data

Expected outcome:
- portfolio insights can show richer debt / other composition without losing novice readability

Acceptance criteria:
- the screen still answers “what is my portfolio made of?” quickly

### Milestone 3 — Provenance and fallback states

Scope:
- define trust cues and estimated-data states

Expected outcome:
- users understand when a view is disclosure-backed, enriched, or estimated

Acceptance criteria:
- no composition screen relies on ambiguous `amfi` wording


## Validation

Before implementation begins, validate this plan against the Stage 1 research report and Stage 2 data plan:

1. Every proposed UI section maps to data that Stage 2 expects to store.
2. International FoFs have a dedicated presentation path.
3. Provenance labels align with the source precedence rules.


## Risks And Mitigations

- Risk: richer data could overwhelm novice users.
  Mitigation: keep the simple summary visible first and treat deeper sections as supporting detail.
- Risk: international FoFs may look inconsistent with domestic funds.
  Mitigation: accept a different layout when the source structure is genuinely different.
- Risk: provenance labels may become technical jargon.
  Mitigation: use plain language and short descriptions rather than source abbreviations.


## Decision Log

- Decision: first rollout should target Fund Detail and Portfolio Insights.
  Reason: those screens already own composition and can absorb richer detail without cluttering the primary portfolio view.
- Decision: keep both simplified summary and richer source-native detail.
  Reason: this balances novice readability with truthful fidelity.
- Decision: treat international FoFs as a first-class special case.
  Reason: Stage 1 showed they lose too much information when forced into the domestic equity pattern.


## Progress

- [ ] Review and approve the Stage 1 findings
- [ ] Review and approve the Stage 2 source strategy
- [ ] Lock first-rollout screens
- [ ] Convert this plan into a UI implementation plan

# ExecPlan: Design Integration Single PR

## Goal

Ship the designer-led FundLens redesign and feature bridge as one reviewable PR on a single branch.

The result should:

- remove Compare completely
- move Settings out of the bottom tab bar
- introduce the new primary navigation
- add the highest-value concept features that fit the current product and free-data constraints
- preserve current core portfolio, benchmark, XIRR, import, and operational behavior
- add a Settings toggle that lets the user switch between the current design and the new editorial design without restarting the app

## User Value

The app should feel materially more polished and more intentional without losing the signal-first behavior that already works on `main`.

After this work, a user should be able to:

- open the app and understand portfolio status from a clearer Home screen
- see which funds are leading or lagging in a dedicated portfolio-insight screen
- use a simple wealth simulator
- still inspect any individual fund deeply against its benchmark
- switch between the classic and editorial visual variants from Settings during the focus-group review

## Context

This plan builds on the current `main` baseline in `/Users/hyadav/code/personal/FundLens-main-review`.

Relevant repository anchors:

- [VISION.md](/Users/hyadav/code/personal/FundLens-main-review/VISION.md)
- [docs/SCREENS.md](/Users/hyadav/code/personal/FundLens-main-review/docs/SCREENS.md)
- [docs/TECH-DISCOVERY.md](/Users/hyadav/code/personal/FundLens-main-review/docs/TECH-DISCOVERY.md)

Supporting analysis produced before this plan:

- [docs/design-integration-roadmap.md](/Users/hyadav/code/personal/FundLens-main-review/docs/design-integration-roadmap.md)
- [docs/design-parity-audit.md](/Users/hyadav/code/personal/FundLens-main-review/docs/design-parity-audit.md)

The imported design concept lives at:

- `/Users/hyadav/code/personal/FundLens/funlens_design_concept`

Current product constraints:

- Compare is being removed completely.
- Settings should not remain a dedicated bottom-tab destination.
- There will be one focus-group round, so both functionality and presentation need to be reviewable from a single branch.
- No paid data source may be introduced.

This is intentionally a large, single-branch effort. That is riskier than the repository’s earlier milestone flow, but it matches the request for one PR to review.

Commit policy for this branch:

- each milestone in this plan should land as its own commit
- each commit should leave the branch in a working state
- follow-up fix commits are allowed, but the main structure of the history should still map one commit to one milestone

Validation policy for this branch:

- the validation gate applies before opening the PR
- the validation gate also applies after every milestone commit that changes behavior
- if a later fix commit is added after milestone review or manual testing, rerun the full gate before continuing

## Technical Discovery

This section records the implementation decisions that have been researched up front so the branch does not drift into ad hoc design during delivery.

### Current architecture findings

- The root shell in [app/_layout.tsx](/Users/hyadav/code/personal/FundLens-main-review/app/_layout.tsx) uses a `Stack` with hidden headers for tabs and a native header for `fund/[id]`.
- The bottom-tab shell in [app/(tabs)/_layout.tsx](/Users/hyadav/code/personal/FundLens-main-review/app/(tabs)/_layout.tsx) still contains `index`, `compare`, and `settings`.
- App preferences in [src/store/appStore.ts](/Users/hyadav/code/personal/FundLens-main-review/src/store/appStore.ts) are not persisted today; only `defaultBenchmarkSymbol` is stored in Zustand memory.
- The current token file in [src/constants/theme.ts](/Users/hyadav/code/personal/FundLens-main-review/src/constants/theme.ts) is a single static design system, not variant-aware.
- Home in [app/(tabs)/index.tsx](/Users/hyadav/code/personal/FundLens-main-review/app/(tabs)/index.tsx) already computes benchmark-aware portfolio summary via `usePortfolio`, but has no portfolio timeline chart.
- Fund Detail in [app/fund/[id].tsx](/Users/hyadav/code/personal/FundLens-main-review/app/fund/[id].tsx) contains the densest current behavior and must be treated as behavior-first during redesign.
- Compare logic exists in [src/hooks/useCompare.ts](/Users/hyadav/code/personal/FundLens-main-review/src/hooks/useCompare.ts) and can be removed cleanly because it is route-local.
- AsyncStorage is already installed in `package.json`, so persisted UI preferences can be added without introducing a new storage library.

### Locked implementation decisions

#### 1. Design variant state

Decision:
- extend the Zustand app store to persist both `defaultBenchmarkSymbol` and `designVariant`
- use Zustand `persist` middleware backed by AsyncStorage on native and default storage behavior on web

Reason:
- the project already uses Zustand
- this avoids adding a second app-level state mechanism just for theming
- it satisfies the requirement that the theme toggle persists across reloads

#### 2. Theme architecture

Decision:
- keep [src/constants/theme.ts](/Users/hyadav/code/personal/FundLens-main-review/src/constants/theme.ts) as the classic token set
- add a second token file for the editorial tokens
- add a lightweight theme selector helper or provider that returns the active token map from the persisted variant

Reason:
- the current codebase imports `Colors`, `Spacing`, `Radii`, and `Typography` directly in many places
- replacing all styling with a new abstraction at once would create unnecessary churn
- a token selector layer allows screen-by-screen migration while preserving existing business logic

#### 3. Header and Settings access

Decision:
- do not build a brand-new root header system for every route
- add a reusable tab-screen header component for `Home`, `Leaderboard`, and `Simulator`
- add a `headerRight` Settings entry on Fund Detail through the stack screen options if needed for consistency

Reason:
- the current root stack uses mixed header ownership
- replacing navigation headers globally would create avoidable risk
- a tab-shell header is enough to remove Settings from the bottom tabs and match the concept direction

#### 4. Compare removal

Decision:
- remove the Compare route, tab entry, hook, tests, and README/docs references in this branch

Concrete files expected to be removed or rewritten:

- `app/(tabs)/compare.tsx`
- `src/hooks/useCompare.ts`
- `src/hooks/__tests__/useCompare.test.ts`
- any references in `README.md`, `docs/SCREENS.md`, and historical “what works now” sections that describe Compare as a live feature

Reason:
- Compare is intentionally cut, not deprecated
- there is no replacement destination to keep alive during the transition

#### 5. Portfolio-vs-market chart data model

Decision:
- create a dedicated hook, expected path `src/hooks/usePortfolioTimeline.ts`
- support `1Y` and `3Y` windows only in this PR
- compute indexed portfolio value and indexed benchmark value over shared dates

Algorithm:
- load all active funds, all user transactions, all required NAV history, and selected benchmark history
- derive cumulative units held per fund over time from transactions
- choose benchmark index dates within the selected window as the reference timeline
- for each reference date, compute portfolio value by summing `units_held_on_date * nearest_nav_on_or_before_date` for each active fund
- rebase both series to `100` on the first common date

Reason:
- this aligns with the existing fund-detail comparison model
- it keeps the Home chart understandable for novice users
- limiting to `1Y` and `3Y` avoids overcomplicating the first implementation

#### 6. Top movers on Home

Decision:
- derive top gainer and top loser from existing `FundCardData.dailyChangePct` and `dailyChangeAmount`
- show the section only when at least two funds have valid daily movement

Reason:
- no extra data source is needed
- this is a cheap addition once Home is already computing fund cards

#### 7. Leaderboard ranking rule

Decision:
- rank funds by `window fund return minus window benchmark return`
- use `1Y` as the default window for the first version
- group rows into `Leaders` and `Laggards` using the sign of the delta

Algorithm:
- reuse existing fund NAV history and benchmark history concepts from `useFundDetail`
- for each fund, compute window-scoped indexed return using the same common-start alignment rule already used on Fund Detail
- compute delta vs the selected benchmark
- sort descending by delta

Reason:
- this is more understandable than ranking by XIRR across mixed investment durations
- it matches the visual language of the concept and the current fund-detail comparison behavior

#### 8. Fund Detail additive modules

Decision:
- preserve all current Performance and NAV History behaviors
- add:
  - growth consistency from quarterly NAV returns
  - portfolio impact from `fund.currentValue / portfolio.totalValue`
- keep technical metadata enrichment optional and non-blocking

Reason:
- these additions can be derived from existing data or lightweight calculations
- they add value without undermining the current detail screen

#### 9. Technical metadata enrichment

Decision:
- do not make this a blocking part of the branch
- if implemented, it must use only free sources and degrade to blank or hidden values safely
- do not promise `Exit Load` as a structured field in this PR

Reason:
- this is the least reliable part of the concept from a data perspective
- it should not hold up the navigation and experience work

#### 10. Simulator scope

Decision:
- build the simulator entirely client-side as a pure math feature
- inputs: SIP delta or amount, lump sum, expected return, horizon
- outputs: projected terminal value plus milestone snapshots
- persist nothing except the active design variant unless a “goal” save falls out cheaply

Reason:
- this keeps the feature self-contained and testable
- no backend or new data source is needed

#### 11. Typography

Decision:
- do not let custom font loading block the branch
- first make the editorial variant work using the existing Expo/native font defaults and weight hierarchy
- if custom font loading is added later in the branch, it should be a contained enhancement, not a prerequisite for the rest of the screens

Reason:
- `expo-font` is not currently configured in this repo
- typography polish is important, but not more important than navigation and feature completion

## Assumptions

- The implementation branch will be cut from current `main`.
- Existing demo auth and seeded demo portfolio remain available and will be used for local end-to-end validation.
- The editorial concept is a design direction, not a literal specification for every metric and CTA shown in its HTML.
- Optional free third-party fund metadata may be used only if it degrades safely and does not block the main flow.
- Compare and its tests can be removed if all references are cleaned up and the app navigation remains coherent.

## Definitions

- **Classic design**: the current live app appearance on `main`.
- **Editorial design**: the new visual direction taken from `funlens_design_concept` and its design system.
- **Design variant**: the persisted `classic` or `editorial` choice used to render shared screens with different visual tokens and layout treatments.
- **Parity contract**: the list of current features that must survive the redesign.
- **Portfolio-vs-market chart**: a Home visualization showing indexed portfolio growth against a chosen benchmark over the same period.
- **Leaderboard**: a ranked screen showing which funds are leading or lagging according to an explicit comparison rule.

## Scope

Included:

- navigation restructuring
- Compare removal
- Settings relocation and redesign
- Home redesign and portfolio-vs-market chart
- top movers section on Home
- new Leaderboard screen
- new Simulator screen
- fund detail layout refresh plus additive insight modules that fit current/free data
- design variant architecture and persisted Settings toggle
- auth and onboarding visual refresh where needed for cohesion
- documentation updates for what works now
- validation on web using the demo account

Included only if feasible without destabilising the branch:

- free-source fund metadata enrichment for expense ratio, AUM, and minimum SIP
- custom magic-link email styling

## Out of Scope

- preserving Compare in any form
- push notifications
- watchlists
- direct investment flows like `Invest Now`
- paid market or fund data sources
- statistically rigorous A/B experimentation infrastructure
- backend re-platforming or auth-system changes beyond UI integration needs

## Approach

Use a single implementation branch with one living ExecPlan and one PR. Sequence the work so the shell and shared architecture land first, then the new screens and modules, then the variant toggle, then validation and cleanup.

The commit history should mirror the milestones below. The intended shape is:

1. baseline and contract
2. navigation shell and variant architecture
3. Home redesign
4. Leaderboard
5. Fund Detail redesign
6. Simulator
7. Settings, auth, and onboarding polish
8. cleanup, docs, and validation

If a milestone is too large for a single safe commit, reduce its scope before implementing it rather than mixing two milestones into one commit.

The implementation should separate:

- shared data and logic
- design tokens and variant selection
- screen-specific layout composition

That keeps the redesign from duplicating business logic just to support two visual styles.

The safest high-level pattern is:

1. keep data hooks mostly intact
2. add view-model helpers only where current hooks do not already provide the right shape
3. introduce a design-variant context and theme token maps
4. refactor screens so the same data can render through classic or editorial presentation

Concrete implementation shape:

1. convert app preferences to a persisted store with `defaultBenchmarkSymbol` and `designVariant`
2. add editorial tokens and a theme selector helper
3. swap the tab shell to `Home / Leaderboard / Simulator`
4. add tab-level reusable header components with Settings access
5. build the new Home modules using existing `usePortfolio` data plus a new timeline hook
6. build Leaderboard using derived fund-vs-benchmark return deltas
7. refresh Fund Detail while preserving current chart logic and tabs
8. add Simulator and its tests
9. redesign Settings, auth, and onboarding
10. remove Compare and stale references

## Alternatives Considered

### Stacked milestone PRs

This is the safer engineering shape because each milestone can be validated independently. It was rejected because the requested review flow is one PR with the whole concept integration visible at once.

### Theme-only A/B without feature bridging

This would be cheaper but misleading. The design concept introduces not just styling changes but also destination and content changes. Shipping only the theme would not answer the real review question.

### Literal concept port

This would be faster visually but would regress shipped product behavior. It was rejected because the current app already has meaningful functionality that the concept does not model.

## Milestones

### Milestone 1 — Freeze the contract and prepare the branch

Scope:

- keep this ExecPlan updated as the source of truth
- convert the audit conclusions into a concrete implementation checklist
- cut the working branch from current `main`
- capture the current baseline with screenshots of Home, Fund Detail, Settings, and auth using the demo account

Expected outcome:

- the branch has a clear scope and a before-state reference

Commands:

    git switch -c codex/design-integration-single-pr
    npm install
    npm run typecheck
    npm run lint
    npm run web

Acceptance criteria:

- local app runs from the branch
- demo sign-in works
- baseline screenshots or notes exist for comparison while refactoring
- commit this milestone as the first branch commit

### Milestone 2 — Navigation shell and variant architecture

Scope:

- remove Compare from the tab layout
- move Settings access into a shared header or header action pattern
- add the new primary nav shell, expected to be `Home / Leaderboard / Simulator`
- introduce a design-variant store and provider
- create shared classic/editorial token maps

Files likely touched:

- `app/_layout.tsx`
- `app/(tabs)/_layout.tsx`
- `src/constants/theme.ts`
- `src/constants/themeEditorial.ts` or similar
- `src/context/ThemeContext.tsx` or equivalent
- `src/store/appStore.ts`
- any shared header or shell components under `src/components/`

Expected outcome:

- the app launches with the new nav structure
- Compare is gone
- the app can switch between design variants without restarting

Acceptance criteria:

- tabs render correctly
- Settings is reachable from the new shell
- variant selection persists locally
- commit this milestone separately before starting Home work

Implementation notes:

- use Zustand `persist` middleware rather than introducing a separate preferences layer
- do not delete Compare code in this milestone yet if doing so blocks the shell from compiling; route removal can be completed in Milestone 8 after replacements exist

### Milestone 3 — Home redesign and feature bridge

Scope:

- redesign Home in both classic-safe and editorial-capable structures
- add the portfolio-vs-market chart
- add top movers on Home if current portfolio data supports it cleanly
- preserve benchmark selection and staleness treatment
- preserve fund-card drill-through

Files likely touched:

- `app/(tabs)/index.tsx`
- `src/hooks/usePortfolio.ts`
- `src/hooks/usePortfolioTimeline.ts`
- `src/hooks/__tests__/usePortfolioTimeline.test.ts`
- new helper hook or utility for the portfolio timeline if needed
- shared chart and card components

Expected outcome:

- Home reflects the new hierarchy and includes the missing chart layer

Acceptance criteria:

- portfolio summary still matches current calculations
- benchmark switching still works
- staleness messaging still appears correctly
- portfolio-vs-market chart updates with the selected window and benchmark
- commit this milestone separately before starting Leaderboard work

Implementation notes:

- support only `1Y` and `3Y` windows in this PR
- derive top movers from existing daily change fields; do not add new backend queries for this

### Milestone 4 — Leaderboard

Scope:

- add a new `Leaderboard` tab screen
- rank funds with a clear and simple rule
- show leaders and laggards with drill-through to fund detail
- optionally support benchmark/window selection if this can reuse existing logic cleanly

Files likely touched:

- `app/(tabs)/leaderboard.tsx`
- `src/hooks/useLeaderboard.ts` or a dedicated derived hook
- `src/hooks/__tests__/useLeaderboard.test.ts`
- shared ranking card components

Expected outcome:

- the second tab becomes a real portfolio-insight destination

Acceptance criteria:

- funds are grouped and ordered deterministically
- labels explain what “leader” and “laggard” mean
- tapping a row opens the correct fund detail
- commit this milestone separately before starting Fund Detail redesign

Implementation notes:

- rank by `fund return over window - benchmark return over window`
- use `1Y` as the default and only add more windows if the logic stays simple

### Milestone 5 — Fund detail redesign and additive insights

Scope:

- refresh the fund detail layout to align with the editorial concept
- preserve current benchmark comparison, crosshair, and NAV history behavior
- add growth-consistency and portfolio-impact modules if they can be computed from existing data
- optionally add technical metadata if a free-source path is stable enough

Files likely touched:

- `app/fund/[id].tsx`
- `src/hooks/useFundDetail.ts`
- `src/hooks/usePortfolio.ts`
- any new utilities for quarterly aggregation or portfolio-share calculations
- tests for any new derived calculations

Expected outcome:

- fund detail feels upgraded without regressing the most information-dense screen in the product

Acceptance criteria:

- existing chart interactions still work
- NAV History remains available
- new additive modules do not change current headline numbers
- if technical metadata is unavailable, the UI degrades cleanly with placeholders or hidden rows
- commit this milestone separately before starting Simulator work

Implementation notes:

- keep the existing two-tab structure unless the replacement is clearly better and fully preserves NAV History
- do not add `Invest Now`, `Watchlist`, or notification-oriented controls

### Milestone 6 — Simulator

Scope:

- add the `Simulator` tab
- implement pure-math projections for SIP, lump sum, expected return, and horizon
- render the simulator in both design variants

Files likely touched:

- `app/(tabs)/simulator.tsx`
- new utility under `src/utils/` for projection math
- tests for the projection math

Expected outcome:

- a fully working self-contained simulator exists in the third tab

Acceptance criteria:

- slider/input changes update projections immediately
- formulas are tested
- assumptions are explained in plain language
- commit this milestone separately before starting Settings/auth polish

### Milestone 7 — Settings, auth, and onboarding polish

Scope:

- redesign Settings using the new layout language
- add the design-toggle control
- preserve current import and operational controls
- refresh auth and onboarding visuals for coherence
- keep the actual email-forwarding and PDF fallback model from current `main`

Files likely touched:

- `app/(tabs)/settings.tsx`
- `app/auth/index.tsx`
- onboarding screens under `app/onboarding/`

Expected outcome:

- the app feels visually coherent end-to-end

Acceptance criteria:

- design toggle works from Settings
- dev auth bypass remains local-only
- import controls remain reachable and understandable
- commit this milestone separately before cleanup

Implementation notes:

- Settings must retain import address, PDF upload, benchmark preference, and sync controls
- onboarding must continue to reflect the current email-forwarding-first import model, not only the PDF concept

### Milestone 8 — Cleanup, docs, and validation

Scope:

- remove dead Compare code, tests, and docs references
- update README and any affected docs
- run the full validation gate
- manually validate the integrated flow on web with the demo account
- add an Amendments section if implementation diverged from the plan

Files likely touched:

- `app/(tabs)/compare.tsx` and related tests or references
- `README.md`
- `docs/SCREENS.md`
- this ExecPlan

Expected outcome:

- the branch is reviewable as a coherent single PR

Acceptance criteria:

- no broken imports or stale routes remain
- docs reflect the new navigation and capabilities
- validation passes
- finish with a final cleanup and validation commit

Implementation notes:

- remove `useCompare` and its tests in this milestone if not already deleted
- update `README.md` and `docs/SCREENS.md` to reflect the new live surface area

## Validation

Run the full validation gate before opening the PR and again after every milestone commit or later fix commit that changes behavior.

### Code quality gate

These must pass with zero errors and zero warnings:

    npm run typecheck
    npm run lint
    npm test

### Test coverage expectations

- new hooks, utilities, and computation logic introduced by this branch must have tests
- aim for strong coverage of pure logic and view-model code
- projection math, ranking rules, and any new time-series derivation should be explicitly tested for happy path and edge cases

### Local end-to-end validation

Run the app locally on web using the demo account:

    npm run web

Use Playwright or equivalent browser automation when practical, and supplement with direct manual checks when visual behavior or interactive chart inspection is easier to verify by hand.

Required local flow:

1. Open the app and sign in with the dev shortcut.
2. Verify the new tab layout loads and Compare is absent.
3. Check Home in both design variants.
4. Check benchmark changes and any timeline/window controls on Home.
5. Open multiple fund detail screens and verify:
   - header values
   - benchmark selector
   - chart crosshair
   - NAV History tab
   - any new insight modules
6. Open Leaderboard and verify ranking, labels, and drill-through.
7. Open Simulator and verify projection updates.
8. Open Settings and switch between classic and editorial.
9. Verify onboarding/import entry points still make sense.
10. Reload the app and confirm the selected design variant persists.

Capture screenshots of key states for PR review as you go, especially after milestones that materially change navigation, Home, Fund Detail, or Settings.

### Optional metadata validation

If the branch includes any free-source fund metadata sync:

1. run the sync path manually
2. verify fields populate for known demo funds
3. verify missing data does not break the UI

### Validation cadence by branch strategy

Because this is a single branch with milestone commits rather than stacked PRs:

- run at least the code quality gate after every milestone commit
- rerun the full local end-to-end validation after Milestones 2 through 7
- rerun the complete gate again just before opening the PR

## Risks And Mitigations

### Risk: the branch becomes too wide and hard to stabilise

Mitigation:
- sequence work by shell first, screens second, polish last
- keep this plan updated with amendments when scope changes
- defer optional metadata enrichment if it starts to destabilise the branch

### Risk: redesign regresses dense existing behaviors on Fund Detail

Mitigation:
- preserve current hook logic unless a change is necessary
- use baseline screenshots and manual test notes
- treat fund detail as behavior-first, layout-second

### Risk: the design toggle duplicates too much UI code

Mitigation:
- share hooks and domain logic
- centralise tokens and variant flags
- only branch layout where the editorial design materially differs

### Risk: Compare removal leaves the product feeling thinner

Mitigation:
- strengthen Home and Leaderboard enough that the app still answers the user’s main questions quickly
- do not spend effort recreating Compare in disguise

### Risk: free-source metadata proves unreliable

Mitigation:
- make metadata cards optional
- hide or placeholder unsupported fields
- do not block the PR on metadata sync

## Decision Log

- Compare is removed completely and will not be replaced.
- Settings is removed from the bottom tab bar.
- One single PR is preferred over a stacked sequence for review.
- The editorial concept is treated as a design direction, not a literal feature spec.
- No paid data source may be added for this work.

## Progress

- [ ] Create the working branch from current `main`
- [ ] Capture baseline screenshots and notes
- [ ] Add design-variant architecture
- [ ] Remove Compare from navigation
- [ ] Add new nav shell with Settings access
- [ ] Redesign Home and add portfolio-vs-market chart
- [ ] Add top movers section if data support is sufficient
- [ ] Build Leaderboard screen
- [ ] Refresh Fund Detail and preserve current advanced behavior
- [ ] Add growth-consistency and portfolio-impact modules if feasible
- [ ] Add optional free-source metadata enrichment only if stable
- [ ] Build Simulator screen and projection math tests
- [ ] Redesign Settings and add design toggle
- [ ] Refresh auth/onboarding visuals without changing core import behavior
- [ ] Remove dead Compare code and references
- [ ] Update README and docs
- [ ] Add Amendments section if implementation diverges
- [ ] Run typecheck, lint, tests, and manual local validation

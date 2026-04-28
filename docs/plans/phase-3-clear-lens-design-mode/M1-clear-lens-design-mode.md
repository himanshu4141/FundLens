# M1 — Clear Lens Design Mode

## Goal

Implement a feature-gated Clear Lens redesign for FundLens while preserving the current app as the default experience.

The work starts a new execution-plan phase. Older execution plans are historical records and must not be amended for this redesign.


## User Value

FundLens is built for novice mutual fund investors who want to know whether they are doing well without reading a dense finance dashboard. Clear Lens makes the app calmer, more visual, and more beginner-friendly while keeping the same calculations and navigation.

A user should be able to open Settings, switch from `Current design` to `New Clear Lens design`, restart the app, and still see the new design. Switching back restores the classic UI.


## Context

The app is an Expo React Native app with TypeScript, Expo Router, Supabase data loading, Zustand app settings, and `react-native-gifted-charts` / `react-native-svg` for charts and vector visuals.

Current navigation stays intact:

- bottom tabs: `Portfolio`, `Leaderboard`, `Simulator`
- hidden route: `Settings`
- stack routes: `Portfolio Insights`, `Your Funds`, `Fund Detail`, onboarding/import screens

There is an older color-only Editorial theme toggle implemented as `designVariant: 'v1' | 'v2'`. Clear Lens is not color-only. It changes screen layout, chart meaning, information hierarchy, and supporting surfaces. This milestone replaces that old toggle with `appDesignMode: 'classic' | 'clearLens'`.

The visual source of truth is the uploaded Focus Ring / Clear Lens design direction:

- app name remains `FundLens`
- Clear Lens / Focus Ring is the design direction, not the product name
- palette: navy `#0A1430`, slate `#263248`, emerald `#10B981`, mint `#A7F3D0`, light grey `#E6EBF1`, background `#FAFBFD`
- logo is a code-native SVG focus ring with an emerald upward signal
- typography should use Inter where available
- cards are rounded, light, spacious, and mobile-first


## Assumptions

1. Proceed from the visible Focus Ring brand board, the visible Fund Detail mockup, and the written requirements for unavailable mockup files.
2. Existing live portfolio data remains the source of truth. Mockup numbers are reference/demo expectations, not hardcoded product values.
3. No Supabase schema, migration, or Edge Function change is expected.
4. Older execution plans remain fixed. Divergence discovered during this work is recorded only in this Phase 3 plan.
5. If the old Editorial theme creates unnecessary complexity, remove it and migrate old persisted values to `classic`.


## Definitions

**Classic design**

The currently shipped FundLens design.

**Clear Lens design**

The new Focus Ring visual and UX system. It uses the approved palette, SVG logo, Inter typography, stacked card layout, beginner-friendly labels, and redesigned primary screens.

**Design mode**

The persisted app setting that chooses which screen family to render. Values are `classic` and `clearLens`.

**Investment vs benchmark chart**

A portfolio chart with three INR-value series:

- cumulative amount invested
- current worth of the real portfolio over time
- what the same cashflows would be worth in the selected benchmark


## Scope

1. Add a persistent Settings control for `appDesignMode: 'classic' | 'clearLens'`.
2. Replace the old Editorial `designVariant` toggle and migrate old persisted values to `classic`.
3. Add Clear Lens tokens and reusable Clear Lens primitives.
4. Implement the SVG Focus Ring / FundLens logo in code.
5. Redesign the main Clear Lens screens:
   - Portfolio
   - Portfolio Insights
   - Your Funds
   - Fund Detail
6. Redesign supporting surfaces in Clear Lens mode:
   - Settings
   - onboarding/import CAS
   - manual CAS upload
   - Leaderboard
   - Simulator
   - empty/loading/error states
   - action menus, bottom sheets, and toasts
7. Preserve existing routes, calculations, data loading, and error behavior unless a Clear Lens screen intentionally changes presentation.
8. Validate with the demo account by launching the app locally.


## Out of Scope

1. Renaming FundLens to Clear Lens.
2. Shipping raster or base64 logo assets.
3. Adding new investment advice, recommendations, tax reporting, broker integrations, or stock portfolio support.
4. Changing Supabase database schema or deployed Edge Functions.
5. Reworking older execution plans.


## Approach

### Feature flag and settings architecture

Use one persisted setting in `src/store/appStore.ts`:

- `appDesignMode: 'classic' | 'clearLens'`
- `setAppDesignMode(mode)`

Add migration logic so old stored `designVariant` values do not keep a third design path alive. Any old `v1` or `v2` persisted value maps to `classic`.

Expose a small helper/hook that answers whether Clear Lens is active. Use it at screen boundaries. For example, `Portfolio` can return a Clear Lens screen component when the mode is enabled and otherwise render the existing classic implementation.

### Design token implementation

Add Clear Lens tokens in a dedicated file. The first implementation should contain at least:

- colors exactly matching the approved palette
- typography names sized for mobile card UI
- card radius and shadow/elevation treatment
- spacing aliases that can map to the existing spacing scale where useful

Classic tokens remain available to existing screens.

### SVG logo implementation

Create reusable code-native SVG components:

- icon-only focus ring mark
- horizontal lockup with `FundLens`
- optional tagline `FOCUS. COMPARE. GROW.`

The logo mark uses navy segmented circular arcs, an emerald upward signal line, and an emerald focus dot. It must scale cleanly from small header size to large empty-state size.

### Screen-by-screen implementation plan

Portfolio:

- Replace the old dense gradient dashboard with a light Clear Lens summary.
- Show the FundLens header with Focus Ring logo.
- Show total value, daily move, overall gain, SIP-aware return, and benchmark status.
- Show benchmark options for Nifty 50, Nifty 100, and BSE Sensex.
- Replace the old indexed portfolio-vs-market chart with the investment vs benchmark chart.
- Show best/worst fund cards, asset allocation preview, and entries to Portfolio Insights and Your Funds.

Portfolio Insights:

- Show asset allocation, market-cap mix, sector exposure, top holdings, and AMFI disclosure date.
- Keep category-rule fallback, stale/missing data behavior, and sync affordances.

Your Funds:

- Show allocation overview, active fund count, top three share, largest position, search, and sort.
- Keep sort options: current value, invested, XIRR, lead vs benchmark, alphabetical.
- Use redesigned fund list rows and expanded detail rows.

Fund Detail:

- Use a Clear Lens fund hero and tabs: Performance, NAV History, Composition.
- Performance keeps fund-vs-benchmark return summary, range selector, benchmark selector, rebased chart, technical details, growth consistency, and portfolio weight.
- NAV History keeps NAV chart, current/start NAV, period change, technical details, and beginner-friendly explanation.
- Composition keeps asset mix, market-cap mix, sector breakdown, and top holdings.

Supporting screens:

- Settings uses the Clear Lens palette and includes the design-mode selector.
- Onboarding/import and manual CAS upload use Clear Lens cards and plain-language copy in Clear Lens mode.
- Leaderboard and Simulator keep behavior but adopt Clear Lens chrome, cards, buttons, loading, empty, and error treatment.
- Any Clear Lens bottom sheet or modal uses the same token system.

### Chart changes

Add a new pure computation path for the investment vs benchmark portfolio chart. It should:

1. read fund NAV history, user transactions, and selected benchmark history
2. build cumulative fund units over time
3. compute actual portfolio value per date
4. compute cumulative invested value using existing cost-basis semantics unless a later correction requires gross contribution
5. compute benchmark units from the same cashflows and selected benchmark values
6. return sampled INR-value series suitable for a mobile chart

Keep old portfolio-vs-market chart available for classic mode.


## Alternatives Considered

1. Keep `classic`, `editorial`, and `clearLens` modes.

   Rejected for the first Clear Lens pass because Editorial was a color-only experiment and would multiply screen paths without adding product value.

2. Hardcode the mockup values.

   Rejected because FundLens must remain a real portfolio tracker. Mockup values guide visual QA, while live hooks provide product data.

3. Restyle all existing components in place.

   Rejected because Clear Lens changes hierarchy and chart meaning. Screen-level component swaps are easier to remove later and safer for classic mode.


## Milestones

### Milestone 1 — Plan and design-mode foundation

Scope:

- Create this Phase 3 ExecPlan.
- Add `appDesignMode` store state, migration, and Settings control.
- Add Clear Lens tokens.
- Add Focus Ring SVG logo components.
- Remove the old Editorial-only setting path.

Expected outcome:

The app can switch between classic and Clear Lens mode, persists the setting, and has reusable brand primitives.

Commands:

    npm run typecheck
    npm test -- src/store/__tests__/appStore.test.ts

Acceptance criteria:

- Settings shows `Current design` and `New Clear Lens design`.
- Default is `Current design`.
- Old persisted `designVariant` values no longer expose Editorial mode.
- Switching modes survives app restart.

### Milestone 2 — Clear Lens primary screens

Scope:

- Implement Clear Lens Portfolio, Portfolio Insights, Your Funds, and Fund Detail.
- Add the investment vs benchmark chart computation and rendering.
- Preserve existing data hooks and navigation routes.

Expected outcome:

The primary Clear Lens experience matches the Focus Ring design direction and remains fully data-driven.

Commands:

    npm run typecheck
    npm run lint
    npm test

Acceptance criteria:

- Portfolio shows Clear Lens header, summary, benchmark comparison, new chart, best/worst funds, asset allocation preview, and entries.
- Portfolio Insights shows asset allocation, market cap, sectors, holdings, and disclosure label.
- Your Funds supports search, sort sheet, redesigned rows, and expanded rows.
- Fund Detail tabs render Performance, NAV History, and Composition content.

### Milestone 3 — Supporting screens and polish

Scope:

- Apply Clear Lens visual system to Settings, onboarding/import, manual CAS upload, Leaderboard, Simulator, menus, sheets, empty/loading/error states.
- Update README "What works now".

Expected outcome:

Clear Lens mode does not leave common app paths feeling half-classic.

Commands:

    npm run typecheck
    npm run lint
    npm test
    npm run export:web

Acceptance criteria:

- Settings, import, upload, Leaderboard, Simulator, menus, and sheets use Clear Lens tokens when enabled.
- Classic mode remains visually and functionally intact.

### Milestone 4 — Demo-account visual validation

Scope:

- Launch the app locally.
- Sign in with the demo account/dev auth shortcut.
- Switch to Clear Lens.
- Capture required screenshots and compare against the supplied references and written spec.
- Fix mismatches and repeat.

Expected outcome:

The implementation is visually close enough to the Focus Ring / Clear Lens references for hands-on review.

Commands:

    npm run web

Acceptance criteria:

- Screenshots captured for Settings switch, Portfolio, Portfolio Insights, Your Funds, Fund Detail Performance, Fund Detail NAV History, Fund Detail Composition, sort sheet, and one supporting screen.
- The visual pass confirms correct colors, logo usage, typography, spacing, bottom-nav labels, and no accidental product rename.

### Milestone 5 — Spec alignment correction pass

Scope:

- Correct the Clear Lens Portfolio hero so it follows the dark value/status card from the Focus Ring spec.
- Correct today's best and today's worst cards so positive and negative movement use the intended green/red treatment.
- Add the missing debt and cash details section to Portfolio Insights.
- Correct Your Funds rows and expanded fund cards so they match the compact list-card direction from the spec.
- Apply the Clear Lens visual system to the main import portfolio / CAS setup screen.
- Convert Portfolio Insights allocation cards toward the spec's donut-card presentation.
- Refine Your Funds expanded sparkline and sort bottom sheet toward the supplied fund-card and sheet examples.
- Align the Portfolio chart card naming and control placement with the board's `How your money grew` section.
- Tighten Clear Lens shared chrome, negative color tokens, and PDF import fallback styling.
- Record remaining visual differences against the uploaded spec and define the next correction pass.

Expected outcome:

The most visible Clear Lens mismatches called out in preview testing are corrected before continuing broader visual polish.

Commands:

    npm run typecheck
    npm run lint
    npm test
    npm run export:web

Acceptance criteria:

- Portfolio hero is a navy summary card with portfolio value, today's move, overall gain, XIRR, and benchmark status visible in the first viewport.
- Today's best uses green emphasis and today's worst uses red emphasis.
- Portfolio Insights includes debt and cash values and fund-level debt/cash breakdown when the portfolio has meaningful non-equity exposure.
- Your Funds list rows show compact value/share information and expanded rows show Today, XIRR, invested, gain/loss, redeemed/booked P&L where available.
- Import portfolio uses Clear Lens header, cards, typography, and button treatment instead of the classic gradient onboarding surface when Clear Lens mode is enabled.
- Portfolio Insights asset allocation and market-cap mix use donut cards with legend/value rows.
- Your Funds expanded card uses a filled mini sparkline and sort bottom sheet uses icon/radio rows plus an explicit apply action.
- Portfolio chart card uses the `How your money grew` title, benchmark pill, clearer legend labels, and range controls below the graph.
- Clear Lens negative values use the red loss token, the shared header/bottom tabs are less oversized, and `/onboarding/pdf` uses the same card/button treatment as the main import screen.
- Remaining differences are documented with an implementation plan instead of being left implicit.


## Validation

Required automated checks:

    npm run typecheck
    npm run lint
    npm test
    npm run export:web

Required manual/browser checks with the demo account:

1. Launch the app locally.
2. Sign in with the demo account/dev auth shortcut.
3. Open Settings and switch to `New Clear Lens design`.
4. Confirm the setting persists after app reload.
5. Capture and inspect:
   - Settings design switch
   - Portfolio in Clear Lens mode
   - Portfolio Insights in Clear Lens mode
   - Your Funds in Clear Lens mode
   - Fund Detail Performance tab
   - Fund Detail NAV History tab
   - Fund Detail Composition tab
   - Sort bottom sheet
   - at least one redesigned supporting screen
6. Compare against the Focus Ring brand board, Fund Detail mockup, and written spec.
7. Fix visible mismatches and repeat validation.

Expected automated result:

- TypeScript exits with zero errors.
- ESLint exits with zero warnings.
- Jest exits successfully.
- Web export completes successfully.


## Risks And Mitigations

1. Risk: Clear Lens conditionals spread through the codebase.

   Mitigation: switch at screen boundaries and use reusable Clear Lens components.

2. Risk: classic mode regresses.

   Mitigation: keep classic components intact and add focused tests around app settings and chart computation.

3. Risk: chart semantics are confused with the old indexed chart.

   Mitigation: keep a separate computation function and label the three INR-value series clearly.

4. Risk: supporting screens remain half-classic.

   Mitigation: apply Clear Lens tokens to shared headers, menus, loading, empty, and error primitives.

5. Risk: Inter loading changes app startup.

   Mitigation: load Inter through Expo font support and fall back cleanly to system fonts if loading fails.


## Decision Log

1. Clear Lens starts a new Phase 3 plan. Older ExecPlans are not amended.
2. The app name remains FundLens.
3. Clear Lens / Focus Ring is a design direction, not a product rename.
4. The old Editorial `designVariant` path is removed rather than preserved as a third mode.
5. `appDesignMode` defaults to `classic`.
6. Old persisted `v1` and `v2` values migrate to `classic`.
7. Mockup values are visual references; live portfolio data remains authoritative.
8. Preview feedback after the first Clear Lens pass is treated as a Milestone 5 correction pass rather than a new design direction.
9. The uploaded Focus Ring board remains the visual source of truth for Portfolio, Portfolio Insights, Your Funds, and sort sheet alignment.


## Progress

- [x] Write Phase 3 ExecPlan
- [x] Add `appDesignMode` persistence and migration
- [x] Add Clear Lens tokens
- [x] Add Focus Ring SVG logo components
- [x] Add Settings design switch
- [x] Implement Clear Lens Portfolio
- [x] Implement Clear Lens Portfolio Insights
- [x] Implement Clear Lens Your Funds
- [x] Implement Clear Lens Fund Detail
- [x] Implement Clear Lens supporting screens and chrome
- [x] Add tests
- [x] Run automated validation
- [x] Launch app and validate with demo account
- [x] Correct Clear Lens Portfolio hero and mover cards
- [x] Add Clear Lens debt/cash details in Portfolio Insights
- [x] Correct Clear Lens Your Funds card and expanded-row shape
- [x] Apply Clear Lens treatment to main import portfolio screen
- [x] Convert Clear Lens Insights allocation cards to donut-card presentation
- [x] Refine Clear Lens Your Funds sparkline and sort bottom sheet
- [x] Align Clear Lens Portfolio chart card title and controls
- [x] Tighten Clear Lens shared chrome, negative tokens, and PDF import fallback
- [x] Record remaining visual differences and follow-up plan
- [x] Remove duplicate Portfolio hero benchmark chip and tighten Fund Detail / fund-card parity
- [x] Add Your Funds allocation overview fallback when composition insights are still loading
- [x] Bootstrap Clear Lens Portfolio Insights composition data on direct navigation
- [x] Compact Clear Lens Portfolio journey chart toward the board layout


## Amendments

1. Portfolio investment journey chart was expanded after demo-account visual review. The Clear Lens portfolio now uses a custom SVG chart instead of the generic gifted line chart so the long-history view can keep x/y labels, legend, crosshair, and tooltip fully contained inside the card.
2. The chart supports `1Y`, `3Y`, `5Y`, `10Y`, `15Y`, and `All` ranges. Long ranges use currency-level y-axis ticks so early investments remain readable instead of being flattened by a large linear scale.
3. Investment-vs-benchmark data fetching now pages transaction, NAV, and index history; uses the latest available NAV or benchmark value on or before each chart date; and preserves all historical cashflows needed to simulate benchmark worth across long journeys.
4. Preview feedback drove a Milestone 5 spec-alignment pass. Portfolio now uses a dark navy hero card, best/worst movers use green/red semantics, Portfolio Insights includes debt/cash details, and Your Funds rows use a compact expanded-card shape with Today, XIRR, invested, gain/loss, realized values, and a sparkline when NAV history is available.
5. A follow-up review found the main import portfolio screen still using the classic onboarding gradient. The Clear Lens correction keeps the same PAN, import-address, CAS request, refresh, and PDF fallback behavior while replacing the visual surface with Clear Lens header, cards, status chips, and button styling.
6. The next parity pass converted Portfolio Insights asset allocation and market-cap mix from stacked bars to donut cards, changed Your Funds expanded sparklines to a filled mini-chart treatment, and restyled the sort bottom sheet with icons, radio controls, and an apply action.
7. Portfolio chart copy and controls were aligned closer to the board: the card now uses `How your money grew`, shows a compact benchmark pill, uses plain-language legend labels, and places range controls below the graph.
8. Clear Lens support surfaces were tightened after the first checkpoint push: negative color tokens now use red, the shared Clear Lens header and bottom tabs are more compact, and the PDF import fallback uses Clear Lens card, radius, shadow, typography, and button treatment.
9. The next screenshot pass removed the duplicate benchmark status from the Portfolio hero, centered the shared Clear Lens title header, moved Fund Detail benchmark status into the hero card, tightened Fund Detail stat labels, and made expanded fund cards always show Redeemed and Booked P&L rows.
10. Your Funds overview now falls back to live fund values for top-3 share, largest position, and row percentages when composition insight rows are not yet available, avoiding blank/zero summary states during direct navigation.
11. Clear Lens Portfolio Insights now treats "fund cards loaded but no composition insights yet" as a bootstrap state and triggers the composition sync instead of leaving the user on the empty state.
12. The Portfolio journey card now defaults to the board's 1Y view, uses the shorter board range set, and drops the persistent snapshot panel so the chart area is more compact and the mover cards sit closer to the first viewport.

## Remaining Visual Gaps

- Portfolio chart card is now closer to the board, but still needs screenshot comparison for exact chart density, axis labels, first-viewport balance, and benchmark control sizing.
- Portfolio Insights allocation cards now use donut presentation, but still need screenshot comparison for exact spacing, sizing, and disclosure-row placement.
- Your Funds expanded row now has a filled mini-chart and improved sort sheet, but still needs screenshot comparison for exact card density and row spacing.
- Header chrome is closer to the board after the centered-title pass, but bottom-tab chrome still needs a final pixel pass after the primary card surfaces are aligned.
- Import portfolio and PDF fallback now have Clear Lens treatment, but still need screenshot comparison alongside the other supporting screens.

## Handoff Summary

Current progress:

- Branch/worktree state contains the feature-gated Clear Lens implementation, including design-mode persistence, Clear Lens tokens, logo, primary screens, supporting chrome, and investment-vs-benchmark chart work.
- Preview testing found the highest-impact visual mismatches in Portfolio, Portfolio Insights, and Your Funds rather than in the underlying calculations or navigation.
- Milestone 5 corrections are implemented for Portfolio hero/mover colors, Portfolio Insights debt/cash details, and Your Funds compact/expanded fund cards.
- Import portfolio now has dedicated Clear Lens treatment on `/onboarding`; behavior stayed unchanged.
- Portfolio Insights allocation cards, Your Funds mini-chart, and sort sheet were further aligned toward the uploaded design examples.
- Portfolio chart card naming, benchmark pill, legend labels, and range-control placement are now closer to the supplied board.
- Clear Lens negative tokens, shared header/tab sizing, and PDF fallback styling have been tightened.
- Current in-progress parity pass removes the extra Portfolio hero status chip, centers title headers, restores Fund Detail hero benchmark status, and fills out expanded fund-card realized-value rows.
- Your Funds now uses live current-value fallback percentages while waiting for composition insights.
- Portfolio Insights now auto-bootstraps composition data on direct navigation so the Debt and Cash card can appear without pressing the manual load button.
- Portfolio journey chart now defaults to 1Y and no longer reserves space for the non-spec persistent snapshot panel.
- The current checkout is detached at the Clear Lens branch tip, so continue carefully without assuming a named branch is checked out.

Decisions:

- Keep live portfolio and composition hooks as the source of truth; do not hardcode spec numbers.
- Align screen hierarchy and color treatment to the uploaded Focus Ring board before chasing smaller typography and spacing differences.
- Keep classic mode untouched and make corrections only inside Clear Lens screen components unless a shared Clear Lens primitive is clearly responsible.

Next steps:

- Do a browser/device visual pass against the uploaded board for Portfolio, Portfolio Insights, Your Funds, and sort sheet.
- Screenshot-check the main import portfolio screen and PDF fallback in Clear Lens mode.
- Screenshot-check Portfolio Insights donut cards, Your Funds expanded cards, and the sort bottom sheet in Clear Lens mode.
- Continue with screenshot-based chart density and exact spacing adjustments.

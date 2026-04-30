# Phase: Money Trail

## Goal

Build Money Trail on top of mainline Clear Lens so a FundLens user can understand every CAS-derived investment, withdrawal, switch, and dividend that shaped their portfolio.

The observable result is:

- Portfolio includes a Clear Lens Money Trail preview using Indian financial years.
- Quick Actions, expanded fund rows, and Fund Detail link into Money Trail.
- Money Trail shows summary totals, yearly summaries, search, filters, sorting, CSV export, a clean transaction list, and a full transaction detail screen.
- Money Trail explains how each transaction is included in invested amount, current holdings, and return calculation.


## User Value

FundLens already answers whether the user is doing well. Money Trail answers how the user got there. It helps novice investors see how much money went in, how much came out, which fund activity happened, and whether a transaction affects FundLens calculations without reading a dense ledger.


## Context

This work started on PR #64 while Clear Lens was still stacked, then moved onto `main` after Clear Lens merged. It is implemented in the isolated worktree `/Users/hyadav/code/personal/FundLens-money-trail` on branch `feature/money-trail`.

Mainline Clear Lens provides:

- `src/constants/clearLensTheme.ts` for tokens.
- `src/components/clearLens/ClearLensPrimitives.tsx` for reusable Clear Lens surfaces.
- Clear Lens screen implementations under `src/components/clearLens/screens/`.
- `src/hooks/useAppDesignMode.ts` and the design-mode architecture that switches between classic and Clear Lens screen families.
- Generated SVG FundLens logo primitives in `src/components/clearLens/FundLensLogo.tsx`.

Money Trail must reuse those foundations. It must not create another design system or fork the Clear Lens architecture.

Stored product and design inputs:

- PRD: `docs/product/money-trail-prd.md`
- Design companion: `docs/design/money-trail-clear-lens-design.md`
- Design handoff image: `docs/design/assets/money-trail-clear-lens-handoff.png`


## Assumptions

1. CAS-imported transaction rows in Supabase remain the only Money Trail source for MVP.
2. Existing portfolio hooks and calculation utilities remain authoritative for portfolio value, invested amount, withdrawals, holdings, and XIRR semantics.
3. Where Money Trail needs a screen-specific view model, it adapts existing transaction data and shared calculation semantics instead of creating competing portfolio math.
4. Indian financial year is the only annual grouping for MVP. A financial year runs from April 1 through March 31.
5. Failed, cancelled, rejected, reversed, and reversal-paired transactions are hidden by default where they can be detected from current data.
6. Switches and STP movements are internal portfolio movement unless existing canonical calculation logic says otherwise.
7. Dividend payout is money out/income if reliably detectable. Dividend reinvestment is internal reinvestment if reliably detectable. Ambiguous dividends are classified conservatively and documented in implementation notes.
8. If the app lacks native file-save infrastructure, CSV export can use the simplest Expo/React Native share flow available in the current dependency set.


## Definitions

**Money Trail**

The user-facing feature name for the transaction history and yearly money-flow explanation.

**CAS**

Consolidated Account Statement. In FundLens this is the imported statement source that provides mutual fund holdings and transactions.

**External money in**

Fresh money the user invested, such as SIP purchase or lump-sum purchase.

**External money out**

Money returned to the user, such as redemption, SWP, or dividend payout when the existing calculation model treats it as external.

**Internal movement**

Money moved inside the portfolio, such as switch in, switch out, STP, or dividend reinvestment. These records are visible but do not inflate net invested.

**Net invested**

External money in minus external money out.

**XIRR**

The app's SIP-aware return calculation. Money Trail should report whether a transaction is used in the return calculation according to the shared calculation model.


## Scope

1. Store the supplied PRD and Clear Lens design handoff in the repo.
2. Add this execution-plan phase.
3. Locate existing calculation and data-loading logic for transactions, portfolio value, invested amount, withdrawals, holdings, and XIRR.
4. Add a Money Trail transaction view model that exposes the fields the UI needs while aligning with existing calculations.
5. Add annual financial-year summary helpers.
6. Add Money Trail preview to the Clear Lens Portfolio screen.
7. Add a dedicated Clear Lens Money Trail screen.
8. Add a full transaction detail screen.
9. Add search, active filter chips, filter sheet, and sort sheet.
10. Add CSV export for currently visible transactions.
11. Add Quick Actions, expanded fund-row, and Fund Detail entry points.
12. Add tests for mapping, yearly grouping, hiding, filters, sort, search, CSV, preview, detail model, and existing calculation alignment.
13. Update README and screen documentation for the new capability.
14. Run validation and capture screenshots.


## Out of Scope

1. Manual transaction creation.
2. Editing CAS transactions.
3. Broker or platform sync.
4. Bank reconciliation.
5. Tax reports or capital gains calculation.
6. Raw CAS field explorer.
7. Duplicate correction UI.
8. Calendar-year toggle.
9. PDF export.
10. Changing the app name or renaming Money Trail to Transactions in user-facing UI.


## Approach

### Data Source Assumptions

Read CAS-imported transaction data from the same Supabase tables and hooks that already feed portfolio and fund calculations. The implementation should prefer existing `user_transactions` or equivalent app models over adding a new table. If a view model is needed, create it in `src/utils` or `src/hooks` as a presentation adapter.

The Money Trail view model should expose equivalents of:

- transaction id
- ISO date
- Indian financial year
- fund id/name
- AMC id/name where available
- user-facing type
- direction
- amount
- units and NAV when available
- folio number
- reference id when available
- status
- CAS source
- inclusion flags for invested amount, XIRR, and current holdings

### Existing Calculation Alignment

Before implementation, inspect and document:

- portfolio value calculation
- invested amount calculation
- withdrawal/redemption calculation
- holdings calculation
- XIRR cashflow generation

Money Trail summary totals should either reuse the same utility or derive from the same classified transaction stream. If a mismatch exists between the PRD and current app behavior, prefer the existing app behavior unless the shared calculation layer is deliberately updated for all screens in the same change.

### Data Model Changes

No database migration is expected for MVP. Add TypeScript view-model types and pure helpers for classification, filtering, sorting, search, CSV rows, detail display, and financial-year summaries.

### Portfolio Screen Preview Plan

Update the Clear Lens Portfolio screen to include a Money Trail card using existing Clear Lens card styles. The card shows:

- title `Money Trail`
- subtitle `Your investments and withdrawals by financial year`
- current financial year net invested
- current financial year invested and withdrawn values
- compact yearly bars for recent years
- total invested, total withdrawn, net invested
- CTA `View all`

The preview should use emerald for invested/net invested and slate or amber for withdrawals.

### Money Trail Screen Plan

Create a route named for the feature, for example `app/money-trail.tsx`, and render a Clear Lens screen by default. The screen shows:

- header `Money Trail`
- subtitle `Every investment, withdrawal, switch, and dividend in your portfolio.`
- total invested, total withdrawn, net invested, and transaction count
- annual summary by Indian financial year
- search input
- sort and filter controls
- active filter chips
- transaction list
- empty, filtered-empty, and partial-error states

Classic mode can render a simple compatible screen or the same feature with Clear Lens primitives if the route is reached. The user-facing requirement is Clear Lens.

### Transaction Detail Plan

Create a full-screen transaction detail route, for example `app/money-trail/[id].tsx`. It receives a transaction id and optional fund prefilter context. It displays:

- type, amount, date, fund, AMC, folio number
- units, NAV/price per unit, payment mode, installment number, reference id, and status when available
- included in invested amount: Yes/No
- used in XIRR calculation: Yes/No
- included in current holdings: Yes/No
- a plain-language `How FundLens uses this` block
- share and CSV export actions

Switch and reversed/hidden states use specialized explanation copy.

### Filter And Sort Plan

Add a filter bottom sheet with:

- date range presets: this financial year, last financial year, last 3 months, all time, custom range where practical
- transaction type
- AMC
- fund name
- amount range
- include hidden/reversed toggle
- clear all and apply actions

Add a sort bottom sheet with:

- newest first
- oldest first
- amount high to low
- amount low to high
- fund name A to Z
- fund name Z to A

Default sort is newest first.

### CSV Export Plan

Export the visible filtered/searched/sorted transactions. File name pattern:

    fundlens-money-trail-YYYY-MM-DD.csv

Columns:

- Date
- Financial Year
- Transaction Type
- Direction
- Fund Name
- AMC
- Folio Number
- Amount
- Units
- NAV
- Status
- Included In Invested Amount
- Used In XIRR Calculation
- Reference ID

Amounts should be numeric where practical. Dates should be ISO or app-consistent. The export should avoid raw CAS noise.

### Quick Action Menu Entry

Add `Money Trail` to the existing Clear Lens quick action menu. The optional description is `See all investments, withdrawals, switches, and dividends.`

### Fund Row Entry Point

In the Clear Lens Your Funds expanded row, add `View transactions` and route to Money Trail with the selected fund pre-applied as a filter.

### Fund Detail Entry Point

In the Clear Lens Fund Detail screen, add `View fund transactions` and route to Money Trail with the selected fund pre-applied as a filter.

### Empty And Error States

Implement:

- no transactions
- no filtered results
- annual summary failure while preserving the transaction list
- missing optional detail fields
- CSV export failure

### Clear Lens Design System Reuse

Use `ClearLensColors`, `ClearLensTypography`, `ClearLensSpacing`, `ClearLensCard`, `ClearLensScreen`, `ClearLensHeader`, and related mainline Clear Lens primitives. Add only feature-specific components, not a new token system.


## Alternatives Considered

1. Build Money Trail from classic pre-Clear Lens UI.

   Rejected because Clear Lens is now the default interface and Money Trail should extend that system instead of reviving older screen patterns.

2. Create a new transaction table or migration.

   Rejected for MVP because Money Trail explains existing CAS-imported transaction history and should not change persistence unless inspection proves the current model cannot represent the feature.

3. Use a dense ledger table.

   Rejected because the product goal is beginner-friendly explanation, not an accounting terminal.

4. Count switches and dividend reinvestments as fresh investments.

   Rejected unless existing shared calculation logic already does this. Internal movement should be visible without inflating net invested.


## Milestones

### Milestone 1 — Documentation And Plan

Scope:

- Store PRD, design handoff image, and design companion doc.
- Add this Money Trail phase plan.
- Update the plan index.

Expected outcome:

The repo contains the product/design source material and a self-contained implementation plan before implementation code changes.

Commands:

    git status --short

Acceptance criteria:

- `docs/product/money-trail-prd.md` exists.
- `docs/design/money-trail-clear-lens-design.md` exists.
- `docs/design/assets/money-trail-clear-lens-handoff.png` exists.
- This plan is listed in `docs/plans/README.md`.

### Milestone 2 — Calculation And Data Mapping

Scope:

- Inspect existing hooks, Supabase row types, and calculation helpers for portfolio, holdings, withdrawals, and XIRR.
- Add Money Trail pure helpers and view-model adapters.
- Document any calculation mismatch in this plan.

Expected outcome:

Money Trail has one typed adapter layer that the preview, index, detail, filters, sort, search, and CSV export can share.

Commands:

    npm test -- src/utils/__tests__/moneyTrail.test.ts
    npm run typecheck

Acceptance criteria:

- Transaction classification covers purchase, SIP, redemption, switch, STP, SWP, dividend payout, dividend reinvestment, failed, reversed, and unknown.
- Indian financial-year grouping is tested.
- Failed/reversed transactions are hidden by default.
- Switches are internal movement.
- Dividend classification is documented and tested.
- Existing portfolio/XIRR tests still pass or are updated only when shared behavior intentionally changes.

### Milestone 3 — Entry Points And Portfolio Preview

Scope:

- Add portfolio Money Trail preview.
- Add Quick Actions entry.
- Add expanded fund-row entry.
- Add Fund Detail entry.

Expected outcome:

Users can discover Money Trail from the primary portfolio surface, app actions, fund list, and fund detail.

Commands:

    npm run typecheck
    npm run lint

Acceptance criteria:

- Portfolio preview appears in Clear Lens mode.
- Preview uses financial year, not calendar year.
- CTA navigates to Money Trail.
- Fund-specific entries pass a fund filter to Money Trail.

### Milestone 4 — Money Trail Screen, Detail, Filters, Sort, Export

Scope:

- Implement Money Trail route and transaction detail route.
- Add summary cards, yearly summary, search, sort, filters, active chips, and transaction list.
- Add CSV export for current visible transactions.
- Add empty and error states.

Expected outcome:

Money Trail is usable end to end from screen entry through filtered browsing, detail inspection, and CSV export.

Commands:

    npm test -- src/utils/__tests__/moneyTrail.test.ts
    npm run typecheck
    npm run lint

Acceptance criteria:

- Default sort is newest first.
- Filters and search change the visible list and exported CSV.
- Detail screen avoids raw CAS fields.
- CSV columns match the user-friendly export contract.
- Reversed/failed transactions are hidden by default and muted when shown.

### Milestone 5 — Validation, Docs, And Screenshots

Scope:

- Update README "What works now" and screen docs.
- Run full validation.
- Launch/render changed screens and capture screenshots.

Expected outcome:

The implementation is verified and the final response can report test status, screenshots, known gaps, and calculation alignment.

Commands:

    npm run typecheck
    npm run lint
    npm test -- --runInBand
    EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_dummy npm run export:web

Acceptance criteria:

- TypeScript passes.
- Lint passes with zero warnings.
- Tests pass.
- App renders Portfolio, Money Trail, transaction detail, filter sheet, sort sheet, CSV export flow, Quick Action entry, expanded fund-row entry, and Fund Detail entry.
- Screenshots are captured and compared with the supplied handoff.


## Validation

Required validation before raising or marking a PR ready:

    npm run typecheck
    npm run lint
    npm test -- --runInBand

Additional validation:

- Build or export the app with dummy Supabase env values if no local secrets are available.
- Launch the app locally and visually inspect changed Clear Lens screens.
- Confirm no Edge Function was touched. If one is touched unexpectedly, follow the Edge Function deployment checklist from `AGENTS.md`.
- Confirm no Supabase migration was added. If one becomes necessary, apply it and verify production database migration status before PR readiness.

Screenshot list:

- Stored PRD/design docs in repo.
- New execution-plan phase.
- Portfolio screen with Money Trail preview.
- Money Trail screen.
- Transaction list with search/sort/filter.
- Transaction detail screen.
- Filter bottom sheet.
- Sort bottom sheet.
- CSV export flow.
- Quick action menu entry.
- Expanded fund-row entry point.
- Fund detail transaction entry point.


## Risks And Mitigations

- Risk: Existing transaction data lacks enough typed fields to distinguish all PRD transaction categories.
  Mitigation: classify conservatively, document limitations, and do not invent unsupported certainty in UI.

- Risk: Money Trail totals drift from existing portfolio and XIRR values.
  Mitigation: reuse existing helpers or the same classified transaction stream, then add tests that protect portfolio/XIRR behavior.

- Risk: CSV export behavior differs by platform.
  Mitigation: use existing Expo-compatible sharing/filesystem APIs where present and document any platform limitation.

- Risk: The feature becomes a dense transaction ledger.
  Mitigation: keep rows minimal, move details into the detail screen, and use Clear Lens cards/charts instead of tables.

- Risk: Clear Lens mainline changes while this work is underway.
  Mitigation: keep the Money Trail branch rebased onto `origin/main` before PR review.


## Rollback Plan

If Money Trail needs to be disabled after merge:

1. Remove or hide the Portfolio preview, Quick Action menu entry, expanded fund-row action, and Fund Detail action.
2. Leave pure helpers and tests in place if they are harmless and useful for later re-enable.
3. Remove the `money-trail` routes from navigation if the feature must be inaccessible.
4. Revert this feature branch commits if a full rollback is safer.
5. No database rollback is expected because MVP should not add migrations.


## Open Questions / Assumptions

- Resolved: mainline Clear Lens reads CAS rows from the `transaction` table and fund names from the `fund` view. Available fields are transaction id, fund id, date, type, units, amount, NAV, folio number, CAS import id, and created timestamp.
- Resolved: existing XIRR logic in `src/utils/xirr.ts` treats `purchase`, `switch_in`, and `dividend_reinvest` as negative cashflows, and `redemption` plus `switch_out` as positive cashflows. It also reports invested amount as remaining cost basis after average-cost deductions, not lifetime money-in.
- Resolved: current app dependencies include `expo-file-system`. CSV export uses browser download on web, Android Storage Access Framework folder selection on Android, and a native share-sheet fallback after writing to Expo app storage when folder selection is unavailable or cancelled.
- Limitation: the current database enum has `purchase`, `redemption`, `switch_in`, `switch_out`, and `dividend_reinvest`. Dividend payout, STP, SWP, failed, and reversal rows are supported by the view model for forward compatibility, but current import code skips or normalizes some of these before storage.
- Limitation: AMC name is not stored on the `transaction` table or `fund` view. Money Trail infers common AMC names from the fund name when possible and otherwise marks AMC as unavailable.
- Assumption: folio numbers can be displayed unmasked per PRD.
- Assumption: Money Trail can use a Clear Lens-only presentation while the route remains reachable from Clear Lens entry points.


## Decision Log

- 2026-04-29: Based Money Trail on fetched PR #64 branch `pr-64-clear-lens` and created isolated worktree `/Users/hyadav/code/personal/FundLens-money-trail` on `feature/money-trail`.
- 2026-04-29: Chose `docs/plans/phase-3-clear-lens-design-mode/M2-money-trail.md` because the feature must extend the Clear Lens phase rather than start from the older classic UI.
- 2026-04-29: Chose no database migration for the initial plan until existing transaction data is inspected.
- 2026-04-29: Kept Money Trail lifetime external cashflow totals separate from the app's existing `investedAmount`, because existing `investedAmount` is remaining cost basis and powers portfolio/fund calculations.
- 2026-04-29: Kept existing XIRR behavior unchanged. Money Trail marks switch and dividend-reinvestment records as used in XIRR when the current shared XIRR helper uses them, while Money Trail net-invested summaries treat them as internal movement.
- 2026-04-29: Implemented CSV export without a new dependency by using web downloads and native `expo-file-system/legacy` file writes.
- 2026-04-29: After device testing, changed native CSV export to open an Android folder picker before writing the CSV, with share-sheet fallback instead of showing app-private `file://` paths in the UI.
- 2026-04-30: After Clear Lens merged to `main`, rebased Money Trail onto `origin/main` using only the Money Trail commits and archived the shipped Clear Lens M1 ExecPlan in the plan index.


## Amendments

- 2026-04-29: Blank amount filter inputs must remain unset. `Number('')` produced `0`, which made an untouched max-amount field exclude all positive-amount transactions after applying filters.
- 2026-04-29: Failed-payment reversals can arrive in the current database as a same-day `purchase` plus `redemption` pair because earlier CAS import behavior mapped `REVERSAL` to `redemption`. Money Trail now hides those pairs by default, and shared portfolio/XIRR/timeline helpers remove the pair before calculating holdings, current value, invested amount, realized gains, and benchmark comparisons.


## Progress

- [x] Read `VISION.md`.
- [x] Originally fetched PR #64 into `pr-64-clear-lens`; rebased onto `origin/main` after Clear Lens merged.
- [x] Created isolated Money Trail worktree on `feature/money-trail`.
- [x] Stored supplied Money Trail PRD in `docs/product/money-trail-prd.md`.
- [x] Stored supplied Clear Lens design handoff image in `docs/design/assets/money-trail-clear-lens-handoff.png`.
- [x] Added design companion doc in `docs/design/money-trail-clear-lens-design.md`.
- [x] Added this Money Trail execution-plan phase.
- [x] Update plan index.
- [x] Inspect existing data and calculation logic.
- [x] Add Money Trail view-model helpers and tests.
- [x] Add Portfolio preview and entry points.
- [x] Add Money Trail screen and transaction detail.
- [x] Add filter, sort, search, and CSV export.
- [x] Update README and screen docs.
- [x] Run full validation and capture screenshots.

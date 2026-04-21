# M10 — Screen Family Consistency

## Goal

Make FundLens feel like one coherent product by standardising navigation chrome and high-frequency list interactions across related screen families, without forcing every screen into the same header pattern.


## User Value

Today the app answers useful investing questions, but some screens still feel stitched together:

1. The Portfolio header is taller than the other primary tabs even though all three belong to the same top-level shell.
2. The `...` menu and gear icon both try to represent global actions, which creates redundant chrome.
3. Fund Detail shows two back affordances and one of them uses misleading copy (`Portfolio`) even when the user arrived from `Leaderboard` or `Your Funds`.
4. `Your Funds` is useful but hard to scan once the portfolio grows because the list cannot be sorted.

Fixing these issues will make the app easier to trust and easier to navigate, especially for novice users who rely on clear, predictable patterns more than power-user shortcuts.


## Context

The current app has three distinct screen families already, but they are implemented inconsistently:

1. **Primary shell screens**
   `app/(tabs)/index.tsx`, `app/(tabs)/leaderboard.tsx`, and `app/(tabs)/simulator.tsx`

   These are the product destinations users visit most often. They should share one top bar and one global-actions pattern.

2. **Utility / task screens**
   `app/(tabs)/settings.tsx`, `app/onboarding/index.tsx`, `app/onboarding/pdf.tsx`, and likely `app/funds.tsx`

   These help users manage the app, import data, or complete account tasks. They should feel related, but lighter and more task-focused than the primary shell.

3. **Detail screens**
   `app/fund/[id].tsx`

   These should prioritise content and navigation clarity. They should not pretend the user always came from Portfolio.

Current implementation notes:

1. Portfolio, Leaderboard, and Simulator each hand-roll a logo header and overflow menu.
2. Portfolio, Leaderboard, and Simulator still render both `...` and a gear icon even though Settings is already in the overflow.
3. `app/funds.tsx` currently has a simple utility-style back header.
4. `app/fund/[id].tsx` currently renders:
   - the native stack back button
   - an extra in-screen back row with `Portfolio`
5. `Your Funds` currently renders the fund list in fetch order with no sort affordance.


## Assumptions

1. The current information architecture stays intact:
   - primary tabs remain `Portfolio`, `Leaderboard`, `Simulator`
   - Settings remains hidden from the tab bar
   - `Compare` remains a hidden legacy route for now
2. `Your Funds` remains a dedicated route and does not move back inline onto Portfolio.
3. We are optimising for clarity and consistency, not for introducing advanced filtering or a large navigation redesign.
4. We should preserve the existing design-token system and not reopen the theme architecture.


## Definitions

**Primary shell header**

The shared top bar used on top-level product destinations. It includes:

- FundLens logo on the left
- one overflow action trigger on the right
- no separate gear icon

**Utility header**

A lighter header used on task-focused screens such as Settings and import flows. It usually contains:

- one back button
- one screen title
- no global shell chrome unless there is a strong reason

**Detail header**

A content-first header for a drill-down screen such as Fund Detail. It should use one clear back action and must not hardcode the origin screen in the label.

**Sort mode**

A user-selected ordering for the `Your Funds` list, for example:

- current value
- invested amount
- XIRR
- lead vs benchmark
- alphabetical


## Scope

1. Introduce a reusable header model for screen families.
2. Unify the header used by:
   - Portfolio
   - Leaderboard
   - Simulator
3. Remove the redundant gear icon from those primary screens and keep global actions behind `...`.
4. Clean up Fund Detail navigation so only one meaningful back path is visible.
5. Add sorting on `Your Funds`.
6. Decide whether `Your Funds` should use the utility header or share the primary shell header, and implement the chosen pattern consistently.
7. Update docs if the shipped UI conventions change from the current screen map.


## Out of Scope

1. Reworking the entire visual design language.
2. Replacing the bottom-tab structure.
3. Adding filters, search, grouping, or pinned funds on `Your Funds`.
4. Changing the data model behind fund cards.
5. Reintroducing `Compare` or changing its legacy-route status.


## Approach

### 1. Model the app as screen families, not one giant global shell

This work should not attempt to make every screen look identical. That would flatten useful distinctions between product destinations, task screens, and detail screens.

Instead, define three explicit UI families:

1. **Primary shell**
   Portfolio, Leaderboard, Simulator
2. **Utility**
   Settings, onboarding, CAS upload, account-management flows, and likely `Your Funds`
3. **Detail**
   Fund Detail

This gives us consistency without overfitting.

### 2. Extract a reusable primary header

Create a shared component for the primary shell header. It should own:

1. logo treatment
2. vertical spacing
3. safe-area handling
4. overflow trigger placement
5. optional action injection if one primary screen needs custom menu items

This replaces the near-duplicate header code in:

- `app/(tabs)/index.tsx`
- `app/(tabs)/leaderboard.tsx`
- `app/(tabs)/simulator.tsx`

### 3. Remove redundant global chrome

The gear icon should be removed from the primary screens because:

1. it duplicates the purpose of `...`
2. it visually competes with the global actions trigger
3. it teaches two patterns for the same destination

Settings should stay available through the overflow menu only.

### 4. Simplify Fund Detail navigation

Fund Detail should use one back affordance, not two.

The recommended implementation is:

1. rely on the stack header back action
2. remove the in-content back row that says `Portfolio`
3. avoid any copy that assumes where the user came from

If the native stack header title needs tuning, change that title and back-label behavior there rather than layering another custom back row inside the page.

### 5. Add lightweight sorting to `Your Funds`

Sorting is the right next-level control for `Your Funds` because it increases usability without creating new conceptual load.

Recommended sort modes:

1. `Current value` (default, descending)
2. `Invested`
3. `XIRR`
4. `Lead vs benchmark`
5. `Alphabetical`

Implementation guidance:

1. place a compact sort affordance near the `All Funds` header
2. use a small picker, sheet, or menu instead of a large persistent control row
3. compute sorted data in-memory from existing `fundCards`
4. persist the selected sort mode in app state only if the UX feels clearly better after trying it; otherwise keep it local to the screen

### 6. Treat `Your Funds` as a utility screen unless implementation says otherwise

Current recommendation:

`Your Funds` should use the utility-family header, not the full primary shell header.

Reasoning:

1. it is a drill-out from Portfolio, not a top-level destination
2. it benefits more from list-management clarity than from brand-shell repetition
3. it should feel closer to `Settings` than to `Portfolio`

This recommendation can change if implementation reveals that users treat `Your Funds` as a primary destination, but that is not the best default.


## Alternatives Considered

### Alternative A — Same header on every screen

Rejected.

Why:

1. Settings and import flows would inherit unnecessary global chrome.
2. Fund Detail would become visually heavier and less content-focused.
3. This solves inconsistency by erasing useful hierarchy.

### Alternative B — Only patch the four reported issues one by one

Rejected.

Why:

1. It fixes symptoms but not the design-system gap causing them.
2. We would likely create more one-off header implementations.
3. Future screens would drift again.

### Alternative C — Promote `Your Funds` into a fourth visible bottom tab

Rejected for now.

Why:

1. It increases top-level navigation load.
2. It weakens the summary-first role of Portfolio.
3. The current problem is interaction quality, not insufficient tab count.


## Milestones

### Milestone 1 — Baseline the screen-family contract

Scope:

1. Create or update a small shared header component strategy in code.
2. Decide final ownership:
   - primary shell header component
   - utility header component or utility-header helper
   - stack-header treatment for Fund Detail

Expected outcome:

A developer can point to exactly which screens use which header family.

Files likely touched:

- `src/components/` for new shared header components
- `app/(tabs)/index.tsx`
- `app/(tabs)/leaderboard.tsx`
- `app/(tabs)/simulator.tsx`

## Amendments

### Shared overflow actions were extracted alongside the primary header

The original plan called out a shared primary header, but in practice the repeated overflow menu code was part of the same inconsistency. The implementation therefore extracted both:

1. a reusable primary-shell header
2. a reusable shared overflow menu for top-level screens

This keeps the shell structurally consistent and removes the redundant gear icon everywhere those screens appear.

### Utility-header rollout included import flows

The original plan left the import flows slightly softer in scope. During implementation it was clearer to apply the utility-header pattern not just to `Settings` and `Your Funds`, but also to:

1. `app/onboarding/index.tsx`
2. `app/onboarding/pdf.tsx`

That gives the utility/task family one predictable back-title pattern instead of leaving import screens as special cases.

### `Your Funds` sorting stayed local instead of becoming persisted preference

The plan deliberately left persistence as an open implementation choice. The shipped version keeps the selected sort mode local to the `Your Funds` screen because:

1. it avoids growing global state for a lightweight list affordance
2. it keeps the behavior easy to reason about
3. it can still be promoted to persisted state later if real usage shows it is worth remembering

### Branch-level implementation also absorbed preview-stream simplification

This branch later picked up Expo preview-stream work that was not part of the original UX scope, but the user explicitly requested that the existing branch plan carry the branch narrative forward instead of creating a second ExecPlan.

That follow-on work changed:

1. OTA publishing from per-PR branches to a shared `pr-builds` stream
2. merge-to-main OTA publishing from `production` to a shared `main` preview stream
3. Expo app config so `FundLens Main` and `FundLens PR` can be installed side by side with distinct package identifiers and deep-link schemes

This divergence is operational rather than product-UX driven, but it now lives on the same branch and should be tracked here for historical accuracy.
- `app/(tabs)/settings.tsx`
- `app/funds.tsx`
- possibly `app/_layout.tsx` or stack options if detail-header behavior is centralised there

Acceptance criteria:

1. No primary tab screen owns a bespoke header layout.
2. The header height and spacing match across Portfolio, Leaderboard, and Simulator.
3. The gear icon is gone from those screens.

### Milestone 2 — Fund Detail navigation cleanup

Scope:

1. Remove redundant in-page back chrome.
2. Ensure back behavior is history-aware and not mislabeled.

Expected outcome:

A user arriving from Portfolio, Your Funds, or Leaderboard sees one clear way back and never sees incorrect origin copy.

Files likely touched:

- `app/fund/[id].tsx`
- possibly stack options in `app/_layout.tsx`

Acceptance criteria:

1. Only one back affordance is visible.
2. No UI text says `Portfolio` unless the navigation truly guarantees that origin, which it does not today.

### Milestone 3 — Your Funds sorting

Scope:

1. Add sort state and UI.
2. Implement in-memory ordering for supported sort modes.

Expected outcome:

Users can quickly reorder holdings to answer practical questions like:

- what is my biggest position
- what is performing best
- which funds are lagging their benchmark

Files likely touched:

- `app/funds.tsx`
- possibly `src/store/appStore.ts` if sort preference is persisted
- possibly shared menu / picker components if reused

Acceptance criteria:

1. `Your Funds` defaults to `Current value` descending.
2. Users can switch sort mode without leaving the screen.
3. Sorting uses live numbers already shown in the cards.

### Milestone 4 — Documentation and polish

Scope:

1. Update `docs/SCREENS.md` if screen-family behavior or header conventions materially change.
2. Update README only if the user-facing navigation description changed in a meaningful way.
3. Add Amendments to this ExecPlan if implementation diverges.

Expected outcome:

The repo documents the new header-family model rather than leaving it implicit in code.


## Validation

Run:

    npm run typecheck
    npm run lint

Manual validation on device / preview:

1. Open `Portfolio`, `Leaderboard`, and `Simulator`
   - header height matches
   - logo placement matches
   - only `...` is shown for global actions

2. Open the overflow menu on all primary screens
   - Settings is present
   - action ordering is consistent

3. Open a fund from:
   - Portfolio
   - Your Funds
   - Leaderboard

   Confirm:
   - only one back affordance is visible
   - back returns to the actual previous screen
   - no misleading `Portfolio` label appears

4. Open `Your Funds`
   - sort affordance is visible and understandable
   - switching sort modes reorders the list correctly
   - default sort is `Current value`

5. Open Settings, Import CAS, and CAS PDF upload
   - utility screens still feel coherent and uncluttered
   - they do not accidentally inherit the primary-shell header unless explicitly intended


## Risks And Mitigations

1. **Risk: header extraction causes subtle layout regressions on one tab**
   Mitigation:
   implement the shared header first, wire one screen, then roll it to the other two.

2. **Risk: removing the in-page back row on Fund Detail reveals an unsatisfactory default stack title**
   Mitigation:
   adjust stack options in the navigator rather than restoring duplicate chrome.

3. **Risk: sort controls add clutter to `Your Funds`**
   Mitigation:
   keep the affordance compact and use a small menu rather than a wide persistent control bar.

4. **Risk: benchmark-relative sorting is expensive or confusing**
   Mitigation:
   derive it from existing loaded values only; if this proves noisy, keep the mode but label it clearly as `Lead vs benchmark`.


## Decision Log

1. We are standardising by screen family, not across the entire app.
2. Primary shell screens get one shared header with logo + `...`.
3. The gear icon is redundant and should be removed from primary screens.
4. Fund Detail should use one history-aware back path only.
5. `Your Funds` should gain sorting before any heavier filtering/search work.
6. Initial recommendation: `Your Funds` stays in the utility family, not the primary shell family.


## Progress

- [ ] Write shared screen-family header contract into code
- [ ] Unify headers across Portfolio, Leaderboard, and Simulator
- [ ] Remove redundant gear icon from primary screens
- [ ] Simplify Fund Detail to one clear back affordance
- [ ] Add sorting to `Your Funds`
- [ ] Validate on device / preview
- [ ] Update docs and amendments if needed

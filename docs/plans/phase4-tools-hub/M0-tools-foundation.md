# M0 — Tools Foundation

## Goal

Create the structural foundation for a Tools Hub in FolioLens. This milestone introduces a Tools Hub screen and entry points from existing screens (Wealth Journey and Portfolio). No tools are fully built here — the goal is the shell, navigation, feature flags, and coming-soon states so every subsequent milestone (M1–M4) has a consistent home to land in.


## User Value

A novice investor using FolioLens today can view their portfolio and project future wealth, but has no single place to find planning or comparison tools. M0 creates that home. After this milestone, a user can tap "Explore tools" from the Wealth Journey screen (or a Tools shortcut from Portfolio quick actions), land on a clean Tools Hub screen, and see the tools that are available now vs coming soon — all within the Clear Lens design system.


## Context

FolioLens is an Expo React Native app with TypeScript, Expo Router, Supabase, and Zustand. Clear Lens is the default design mode (shipped in Phase 3). The feature-flag system is implemented via `useAppDesignMode` and the `appStore` Zustand store.

**Repository layout relevant to this plan:**

```
app/
  (tabs)/
    _layout.tsx          — bottom tabs: Portfolio | Funds | Wealth Journey
    index.tsx            — Portfolio tab (delegates to ClearLensPortfolioScreen)
    wealth-journey.tsx   — Wealth Journey tab
  tools.tsx              — NEW: Tools Hub route (stack, not a tab)

src/
  components/
    clearLens/
      ClearLensPrimitives.tsx     — ClearLensCard, ClearLensHeader, ClearLensScreen, etc.
      screens/
        ClearLensPortfolioScreen.tsx
        ClearLensWealthJourneyScreen.tsx
        ClearLensToolsScreen.tsx  — NEW: Tools Hub screen component
  constants/
    clearLensTheme.ts             — color, spacing, typography, radii, shadow tokens
  store/
    appStore.ts                   — Zustand store; holds appDesignMode and feature flags
  hooks/
    useToolsFeatureFlags.ts       — NEW: thin hook for tool availability

docs/
  product/
    foliolens-tools-hub-prd.md        — PRD (source of truth)
    foliolens-tools-hub-project-plan.md
    foliolens-tools-hub-design.png    — design mockup reference image
  plans/
    phase4-tools-hub/
      M0-tools-foundation.md    — this file
```

**Design system tokens** are in `src/constants/clearLensTheme.ts`:

- `ClearLensColors` — navy, slate, emerald, mint, background, surface, border…
- `ClearLensSpacing` — xs (4), sm (8), md (16), lg (24), xl (32), xxl (48)
- `ClearLensTypography` — hero, h1, h2, body, bodySmall, label, caption
- `ClearLensRadii` — sm (8), md (12), lg (16), xl (24), full (9999)
- `ClearLensShadow` — card shadow

**Bottom nav stays unchanged:**

```text
Portfolio | Funds | Wealth Journey
```

Tools is a stack route (`app/tools.tsx`), not a tab. It is reached via deep-link or programmatic `router.push('/tools')`.


## Assumptions

1. Clear Lens design mode is in mainline and is the default (`appDesignMode === 'clearLens'`).
2. No Supabase schema changes are required for M0.
3. Tools Hub is Clear Lens-only. If classic mode is active, the entry points are hidden.
4. Feature flags are stored in the Zustand store, not Supabase, so they are local-only for now.
5. Coming-soon state replaces a full sheet/modal — a simple inline message inside the card is sufficient.
6. No analytics events are wired in M0 (analytics system not confirmed to exist).
7. The design image `docs/product/foliolens-tools-hub-design.png` is the visual reference. Numbers shown in mockups are illustrative; real data comes from existing portfolio hooks.


## Definitions

**Tool card** — A tappable card in the Tools Hub listing one tool, its subtitle, and its availability state (available | coming-soon).

**Coming-soon state** — A non-interactive variant of the tool card with a `Coming soon` pill and muted style. Tapping shows no action (or a brief toast).

**Feature flag** — A boolean in the Zustand store that controls whether a specific tool route is accessible. All tools start as `false` (coming soon) except Wealth Journey which is always available.

**Entry point** — A tappable row or button on an existing screen that navigates to `/tools`.


## Scope

- `docs/product/` — store PRD, project plan, and design image.
- `docs/plans/phase4-tools-hub/M0-tools-foundation.md` — this ExecPlan.
- `src/store/appStore.ts` — add `toolsFlags` shape (`goalPlanner`, `pastSipCheck`, `compareFunds`, `directVsRegular`), all `false` for now.
- `src/hooks/useToolsFeatureFlags.ts` — thin hook returning tool flag values.
- `src/components/clearLens/screens/ClearLensToolsScreen.tsx` — full Tools Hub screen.
- `app/tools.tsx` — Expo Router stack route that renders the screen.
- `src/components/clearLens/screens/ClearLensWealthJourneyScreen.tsx` — add "Explore tools" entry row near the bottom of the scroll content.
- `src/components/clearLens/screens/ClearLensPortfolioScreen.tsx` — add a "Tools" quick-action button in the existing EntryRows block.
- Unit tests for `useToolsFeatureFlags`.
- `docs/SCREENS.md` — add Tools Hub entry.


## Out of Scope

- Building any tool (Goal Planner, Past SIP Check, Compare Funds, Direct vs Regular Impact).
- Replacing bottom nav with Tools tab.
- Any Supabase edge functions or DB migrations.
- Analytics instrumentation.
- Your Funds or Fund Detail entry points (added in M1+).


## Approach

### Tools Hub screen layout

```
[Header — "Tools" title + back chevron + account avatar]

[Featured section]
  [Wealth Journey card — available — taps to /(tabs)/wealth-journey]

[Plan section]
  [Goal Planner card — coming soon]

[Compare section]
  [Compare Funds card — coming soon]

[Explore section]
  [Past SIP Check card — coming soon]

[Cost & Fees section]
  [Direct vs Regular Impact card — coming soon]

[Footer — disclaimer copy]
```

Each section header is a small muted label (`ClearLensTypography.label`, `ClearLensColors.textTertiary`).

**Tool card anatomy:**

```
[Icon]  [Tool name — body semiBold]
        [Subtitle — bodySmall, textSecondary]
[→ chevron or Coming soon pill]
```

The card uses `ClearLensCard` with `ClearLensShadow.card`. Available cards are `TouchableOpacity` with `activeOpacity={0.75}`. Coming-soon cards are non-pressable with muted opacity.

**Entry points:**

Wealth Journey screen — add a tappable row at the bottom of the scroll:

```
Explore more tools  [→]
```

Styled as a secondary link row (`ClearLensTypography.bodySmall`, `textTertiary` label, emerald chevron).

Portfolio screen — add a `Tools` entry to the existing `EntryRows` component alongside `Portfolio Insights` and `Your Funds`.


### Feature flags shape (appStore)

```ts
toolsFlags: {
  goalPlanner: boolean;
  pastSipCheck: boolean;
  compareFunds: boolean;
  directVsRegular: boolean;
}
```

Default all `false`. When a flag is `true`, the tool card becomes interactive and its route navigates to the tool screen (route not yet built in M0 — flag reserved for M1+).


## Alternatives Considered

**Option A — Tools as a new bottom tab immediately.**
Rejected: PRD explicitly says not to replace Wealth Journey in the nav until enough tools are live.

**Option B — Tools as a modal sheet.**
Rejected: a full-screen route is a better foundation for deep-linking and future nav promotion.

**Option C — Feature flags in Supabase.**
Rejected for M0: adds infra complexity before any tool exists. Local Zustand flags are sufficient; remote flags can be added later.


## Milestones

### Step 1 — Store product docs

Store the PRD, project plan, and design image in `docs/product/`. No code changes.

Validation: `ls docs/product/` shows all three files.

### Step 2 — Feature flags in appStore

Add `toolsFlags` to the Zustand store with all values `false`.

File: `src/store/appStore.ts`

Add to the store state interface and the initial state. Persist the field alongside existing fields.

Validation: `useAppStore.getState().toolsFlags` returns `{ goalPlanner: false, pastSipCheck: false, compareFunds: false, directVsRegular: false }`.

### Step 3 — useToolsFeatureFlags hook

Create `src/hooks/useToolsFeatureFlags.ts`. It reads from `appStore` and returns each flag plus a convenience `anyAvailable` boolean.

Write a unit test in `src/hooks/__tests__/useToolsFeatureFlags.test.ts`.

### Step 4 — Tools Hub screen

Create `src/components/clearLens/screens/ClearLensToolsScreen.tsx`.

Implements the layout described in the Approach section. Uses only existing `ClearLensPrimitives`, `ClearLensColors`, `ClearLensSpacing`, `ClearLensTypography`, `ClearLensRadii`, and `ClearLensShadow`.

Navigates to `/(tabs)/wealth-journey` when Wealth Journey card is tapped.

For coming-soon tool cards: renders the card in muted style. Tapping does nothing (or shows a subtle inline note — no modal).

### Step 5 — Route

Create `app/tools.tsx`. It renders `ClearLensToolsScreen` gated behind `isClearLens`. If classic mode is active, redirect or show a simple "not available" screen.

### Step 6 — Entry points

**Wealth Journey screen** (`src/components/clearLens/screens/ClearLensWealthJourneyScreen.tsx`):

Find the bottom of the scroll content. Add an "Explore more tools →" tappable row that calls `router.push('/tools')`.

**Portfolio screen** (`src/components/clearLens/screens/ClearLensPortfolioScreen.tsx`):

Find the `EntryRows` component and its `onInsights` and `onFunds` props. Add an `onTools` prop and render a "Tools" entry row. Pass `onTools={() => router.push('/tools')}` from the call site.

### Step 7 — Docs update

Update `docs/SCREENS.md` to add a Tools Hub entry under the screen map.

### Step 8 — Tests, typecheck, lint

Run:

```bash
npm run typecheck   # zero errors
npm run lint        # zero warnings
npx jest --coverage # overall ≥70%, src/hooks/ ≥95%
```

Fix any issues before marking complete.


## Validation

After implementing all steps:

1. Start the dev server: `npx expo start`
2. Open the app in Clear Lens mode (default).
3. Go to Wealth Journey tab.
4. Verify "Explore more tools" row is visible at the bottom of the screen.
5. Tap it — verify you land on the Tools Hub screen.
6. Verify the screen shows: Featured (Wealth Journey), Plan (Goal Planner), Compare, Explore, Cost & Fees sections.
7. Tap Wealth Journey card — verify it navigates to `/(tabs)/wealth-journey`.
8. Tap a coming-soon card — verify nothing happens (no crash, no navigation).
9. Go back to Portfolio tab.
10. Verify a "Tools" entry row is present in the entry rows section.
11. Tap it — verify you land on the Tools Hub screen.
12. Switch to classic mode in Settings — verify entry points are hidden.
13. Run `npm run typecheck && npm run lint && npx jest --coverage` — all green.


## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| ClearLensWealthJourneyScreen is 1731 lines — hard to find right insertion point | Grep for `paddingBottom` in scroll content or the last card before the closing `</ScrollView>` |
| EntryRows in Portfolio is a local component — may need new prop | Inspect the component definition at the bottom of ClearLensPortfolioScreen and add the prop cleanly |
| `router.push('/tools')` requires `app/tools.tsx` to exist | Create the route file first (Step 5) before wiring entry points |
| Jest coverage may drop if new hook is not tested | Write the hook test (Step 3) before running coverage |


## Decision Log

- **2026-05-01**: Tools as a stack route (not a tab) — PRD requirement, Wealth Journey stays in nav for now.
- **2026-05-01**: Feature flags in Zustand, not Supabase — avoids infra complexity before any tool exists.
- **2026-05-01**: Coming-soon taps do nothing rather than showing a sheet — simpler, less intrusive.
- **2026-05-01**: Tools Hub is Clear Lens-only — classic mode predates Tools Hub, no value in back-porting.


## Progress

- [x] Branch `feat/tools-hub-m0` created off `main`
- [x] Store product docs in `docs/product/`
- [x] M0 ExecPlan written (`docs/plans/phase4-tools-hub/M0-tools-foundation.md`)
- [x] Feature flags added to `appStore` (`toolsFlags` shape, `AppStore` interface exported)
- [x] `useToolsFeatureFlags` hook + test (100% coverage)
- [x] `ClearLensToolsScreen` implemented (Featured/Plan/Compare/Explore/Cost sections)
- [x] `app/tools.tsx` route created
- [x] Wealth Journey entry point added ("Explore more tools →" in home mode)
- [x] Portfolio entry point added ("Tools" entry row in EntryRows)
- [x] `docs/SCREENS.md` updated (Tools Hub entry added, section 8)
- [x] typecheck ✓ lint ✓ 472 tests ✓ src/utils 96% ✓
- [x] PR #77 raised against `main`

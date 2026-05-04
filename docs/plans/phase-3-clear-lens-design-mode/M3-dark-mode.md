# M3 — Clear Lens Dark Mode + Theme-aware Brand Assets

## Goal

Ship a complete dark colour scheme for Clear Lens, expose a Settings → Preferences appearance picker (light / dark / follow system), retire the legacy Classic mode, and align every app icon / favicon / monochrome asset with the canonical foliolens.in brand mark across iOS, Android, and web.

## User Value

A user who prefers a dark UI — or whose phone is set to dark — gets a properly themed app: not just inverted colours, but charts, badges, surfaces, and chrome that read with the same hierarchy in both schemes. The Settings picker lets them override the OS preference without leaving the app. App icons and browser favicons follow the OS scheme on iOS 18 / Android 13+ / modern browsers, and the in-app picker overrides the favicon at runtime on web.

## Context

This work landed on PR #97 against `claude/add-dark-theme-selection-hZil0`, stacked initially on `feature/desktop-web-shell` (PR #95) and rebased onto `main` after that PR squash-merged as `b679a9e`.

Before this PR:

- The Clear Lens design system shipped a single light palette in `src/constants/clearLensTheme.ts`.
- A "Classic" mode persisted in Settings as a fallback design.
- All app icons used an inverted lockup (white arcs on a navy plate) that did not match the foliolens.in brand light variant (navy arcs on a transparent / light canvas).
- The web favicon was a single 64×64 PNG; iOS lacked dark / tinted icon variants; Android had a broken (all-white) monochrome themed icon.

## Definitions

- **Token** — a value in `clearLensTheme.ts` (e.g. `c.emerald`, `c.heroSurface`).
- **Semantic token** — a derived role (e.g. `tokens.semantic.marketCap.large`) that resolves to a token per scheme.
- **Live tokens** — values returned by `useClearLensTokens()`. They re-resolve when the active scheme changes.
- **Module-level styles** — `StyleSheet.create({...})` calls evaluated once at import time. They cannot react to a scheme flip on their own; we either wrap them in a `makeStyles(tokens)` factory or remount the route via `key={resolvedScheme}`.
- **Scheme** — `'light' | 'dark'`. The user picker holds `'light' | 'dark' | 'system'`; `'system'` resolves to the OS scheme via `useColorScheme()`.

## Scope

- A second palette `ClearLensDarkColors` parallel to `ClearLensLightColors`.
- A `getClearLensTokens(scheme)` factory and `ThemeContext` that resolves the active scheme and exposes `useClearLensTokens()`.
- Persisted store slot `appColorScheme: 'light' | 'dark' | 'system'` (default `'system'`), with a v5 migration that drops the legacy `appDesignMode`.
- Settings → Preferences picker with three radio rows.
- Migration of every Clear Lens screen to consume live tokens. Module-level styles are lifted into `makeStyles(tokens)` factories.
- A handful of contrast / consistency fixes that surfaced from manual + automated dark-mode QA (sparkline trough, market-cap palette, fund-card MetricRow default colour, window-pill borders, allocation-strip min width, negative surface saturation, etc.).
- Theme-aware app icons:
  - iOS — `expo.ios.icon = { light, dark, tinted }` (Expo SDK 55 supports the object form; iOS 18 picks the variant from the user's appearance setting).
  - Android — fixed monochrome themed icon for Android 13+ themed-icons mode.
  - Web — SVG favicons with `prefers-color-scheme` `<link>` tags; `ThemedAppShell` swaps the icon href at runtime so the in-app picker wins on web.
- A canonical SVG source set under `assets/brand/` and a `scripts/build-icons.mjs` renderer (resvg) so the PNG outputs stay in sync with the brand.

## Out of Scope

- Redesigning the Clear Lens light palette.
- Migrating any classic-only screens (Classic is retired in this milestone).
- Updating marketing site assets (foliolens.in is the source of truth — we mirror it, we don't change it).

## Architecture

```
src/constants/clearLensTheme.ts
  ClearLensColorScheme = 'light' | 'dark'
  ClearLensColorTokens (interface)
  ClearLensLightColors / ClearLensDarkColors (parallel palettes)
  ClearLensSemanticTokens (interface)
  buildSemanticColors(c, scheme)
  getClearLensTokens(scheme): { colors, semantic }
  ClearLensColors  ← still exported for back-compat (= light palette)

src/store/appStore.ts
  appColorScheme: 'light' | 'dark' | 'system'
  setColorScheme(s)
  migratePersistedAppState — v5 drops appDesignMode

src/context/ThemeContext.tsx
  ThemeProvider — picks resolvedScheme from store + useColorScheme()
  useTheme()  — { colors, clearLens, colorScheme, resolvedScheme, setColorScheme }
  useClearLensTokens() — sugar for the (resolved) tokens object

app/_layout.tsx → ThemedAppShell
  - syncs SystemUI background to scheme
  - status bar style flips with scheme
  - <AuthGate key={resolvedScheme}> remounts the route stack on toggle so any
    module-level StyleSheet.create captured values get re-evaluated
  - on web, swaps document <link rel="icon" type="image/svg+xml"> to the
    light-or-dark favicon at runtime, overriding the prefers-color-scheme
    media query with the in-app picker choice

app/+html.tsx
  - emits two SVG favicon links (light + dark) media-gated by prefers-color-scheme
  - PNG fallback + apple-touch-icon

assets/brand/*.svg
  - canonical FolioLens mark variants (light, dark, tinted, adaptive
    foreground, splash, favicon light, favicon dark)

scripts/build-icons.mjs
  - renders every brand SVG to its expected PNG via @resvg/resvg-js
  - run after editing any brand SVG: `node scripts/build-icons.mjs`

app.config.js
  - ios.icon = { light, dark, tinted } pointing at icon.png / icon-dark.png /
    icon-tinted.png
  - android.adaptiveIcon.monochromeImage = monochrome-icon.png
  - web.favicon = favicon.png (default; +html.tsx + ThemedAppShell handle the
    theme-aware swap)
```

## Validation

The validation gate inherited from CLAUDE.md applies:

```
npm run typecheck       # zero errors
npm run lint            # zero warnings
npx jest --coverage     # all suites pass; ≥95% on src/utils/
```

Dark-mode QA was driven through Expo web (`npx expo start --web --port 8083`) and Playwright, walking every reachable screen in both schemes at 390×844 (mobile) and 1440×900 (desktop). Screenshots are dumped under `qa-audit/` (gitignored). The audit confirms:

- No black-on-black or white-on-white text in either scheme.
- Bar / donut / line charts use distinct hues that read on both canvases.
- Selection states (chips, pills, segments, sidebar nav rows) have enough contrast to be obviously "selected".
- Window pills have a visible inactive border in both schemes.
- Inter-text contrast on lifted surfaces (cards, hero, toasts) clears WCAG AA at 14px+.

## Milestones

### M3.1 — Foundation

Add the dark palette and the theme picker. Retire Classic.

- Outcome: Settings → Preferences shows a Light / Dark / System picker. Toggling re-paints the app immediately. Classic mode is gone from the codebase.
- Files: `src/constants/clearLensTheme.ts`, `src/store/appStore.ts`, `src/context/ThemeContext.tsx`, `app/_layout.tsx`, `app/(tabs)/settings/preferences.tsx`.

### M3.2 — Content migration

Lift every Clear Lens screen onto live tokens. Hunt down module-level `StyleSheet.create` calls and convert them to `makeStyles(tokens)` factories.

- Outcome: every reachable screen looks correct in both schemes, with no static colour leaks.

### M3.3 — Contrast / consistency

QA-driven fixes surfaced by the dark-mode audit:

- Hero "Your portfolio value" card — introduced `heroSurface` token (brand-dark in both modes) so the hero never collides with the page bg.
- Market-cap palette — `large = emerald`, `mid = emeraldDeep (light) / mint (dark)`, `small = amber`. Original `large = navy` flipped to near-white in dark and disappeared.
- Fund-allocation palette — replaced the `navy` slot (which read as near-white on dark) with a 6-hue cycle that works in both schemes.
- Standardised chip / pill / segment selection styles on the emerald-themed pattern (mint50 + emerald border + emeraldDeep text).
- `MetricRow` default colour — was `ClearLensColors.navy` (light-only), rendered black-on-black on the dark fund card. Default through `tokens.colors.textPrimary`.
- Wealth Journey + Goal Summary chart axes — used module-level `ClearLensColors.borderLight` / `textTertiary` (light-only). Migrated to `tokens.colors.*`.
- Sparkline trough — `mint50` (good in light, near-black in dark) → `surfaceSoft` (subtle lift in both).
- Window pills (1M / 3M / etc.) — inactive bg was indistinguishable from the page bg in dark. Now `surface` + hairline `border`.
- "Today's Worst" mover chip — bumped dark `negativeBg` from `#3A1A1F` (muddy brown) to `#451B23` (saturated red). Switched the fund-name colour from `cl.navy` to `cl.textPrimary` for clearer intent.
- Allocation strip segments — floored `flex` at 4 so a 3% sliver (e.g. Cash) doesn't disappear.

### M3.4 — Brand asset alignment

Align every icon / favicon with foliolens.in. Generate light / dark / tinted variants and wire them up.

- Created `assets/brand/*.svg` (canonical sources) and `scripts/build-icons.mjs` (resvg renderer).
- iOS — `expo.ios.icon = { light, dark, tinted }` in `app.config.js`. Variants are 1024×1024 PNGs rendered from the brand SVGs.
- Android — fixed monochrome themed icon (was an all-white empty mask).
- Web — `app/+html.tsx` emits SVG favicons with `prefers-color-scheme` `<link>` tags + PNG fallback; `ThemedAppShell` swaps the SVG `href` at runtime when the in-app picker changes scheme. Public copies of the favicons live under `public/`.

## Amendments (post-merge)

This section captures where the actual implementation diverged from the original loose plan, per the CLAUDE.md "Amendments after divergence" requirement.

- The plan started as "add a dark palette + a picker" and grew to include the brand-asset alignment after a manual review surfaced inconsistent icons across mobile and web. Both threads ship in PR #97.
- The original draft kept Classic as a third option. We removed Classic outright once the dark palette was in place — it was unloved, untested in mobile shells, and added an axis to QA. Migration handles persisted `appDesignMode` cleanly.
- We initially picked `marketCap.mid = c.mint` for both schemes. Light-mode QA showed mint washing out on white card surfaces. The shipped version branches per scheme: `emeraldDeep` on light (saturated mid-green that pops on white), `mint` on dark (light pop against the dark canvas).
- The plan called for a lifted dark-mode `heroSurface` of `#1F2A4A`. Real usage showed selected pills / chips were only a few percent brighter than the surrounding card, which made selections hard to spot. Bumped to `#34416B` so selections read clearly.
- The plan did not foresee the `qa-audit` workflow (Playwright walk + screenshot dump). The folder is gitignored and the test-session-1 dump from earlier QA was relocated into it.
- The plan budget assumed a single contrast pass. We did **two** rounds (one dark-only, one dark + light-regression sweep) and both passes' findings landed on this PR.

## Progress

- [x] M3.1 — dark palette, store migration, theme context, picker
- [x] M3.2 — content migration to live tokens
- [x] M3.3 — contrast / consistency fixes
- [x] M3.4 — brand asset alignment + theme-aware icons / favicon
- [x] Validation: typecheck / lint / jest / coverage
- [x] Docs: README, SCREENS.md, DESIGN.md updated; this ExecPlan written

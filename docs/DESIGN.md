# FundLens Clear Lens Design

## Design Overview

Clear Lens is the default FundLens interface. It is a calm mobile-first system for novice mutual fund investors: portfolio signal first, plain-language labels, restrained chrome, and consistent benchmark context.

Classic remains selectable in Settings.

## Principles

- Lead with the answer: value, movement, benchmark context, and XIRR must be visible quickly.
- Keep finance terms sparse and explain unavoidable terms in place.
- Use live portfolio data; prototype values are visual examples only.
- Prefer reusable Clear Lens primitives and semantic tokens over screen-local styling.
- Keep classic behavior intact behind the design switch.

## Tokens

The source of truth is `src/constants/clearLensTheme.ts`.

Core colors:

- Navy: `ClearLensColors.navy`
- Slate: `ClearLensColors.slate`
- Emerald: `ClearLensColors.emerald`
- Mint: `ClearLensColors.mint`
- Background: `ClearLensColors.background`
- Surface: `ClearLensColors.surface`
- Negative: `ClearLensColors.negative` (`#E5484D`)

## Semantic Color System

Use `ClearLensSemanticColors` for data and state colors:

- Asset mix: equity, debt, cash, other
- Market cap: large, mid, small, other
- Chart series: invested, portfolio/fund, benchmark
- Sentiment: positive, negative, positive surface, negative surface
- State: loading, success, warning, danger, empty icon
- Overlay: backdrop, dark divider, focus ring

## Typography

Clear Lens uses Inter via Expo font loading:

- Hero values: large bold tabular numeric text
- Headings: bold/semi-bold, compact mobile scale
- Body: regular Inter, short sentences
- Labels: small semi-bold uppercase only for compact metadata
- Numeric values should use stable width where supported and must not rely on viewport-scaled fonts

## Spacing, Radius, Shadow

- Spacing follows the Clear Lens 4/8 point scale.
- Cards use the shared Clear Lens radius and subtle shadow.
- Pills are fully rounded.
- Bottom sheets use large top radii and the Clear Lens backdrop overlay.

## Components

Shared Clear Lens primitives live under `src/components/clearLens/`:

- `ClearLensScreen`
- `ClearLensHeader`
- `ClearLensCard`
- `ClearLensPill`
- `ClearLensSegmentedControl`
- `FundLensLogo`

Primary screens should compose these primitives before adding screen-specific styles.

## Data Visualization

- Portfolio chart: show amount invested, real portfolio worth, and benchmark worth in rupees.
- Money Trail: show financial-year invested/withdrawn/net-invested summaries with compact bars; keep transaction rows minimal and place units, NAV, and calculation flags in detail.
- Fund detail performance: fund vs benchmark, with period controls.
- Composition: use semantic asset and market-cap colors.
- Portfolio Insights holdings: show up to 30 holdings, 10 per page, with icon chevrons for paging.
- Wealth Journey: show current vs adjusted growth and withdrawal drawdown paths.
- Positive and negative deltas should use arrowed signed formatting (`▲ +1.23%`, `▼ -1.23%`) in Clear Lens UI.

## Screen Patterns

- Primary tabs: logo/header, concise title copy where needed, stacked cards, overflow menu.
- Utility screens: back-title header, card-based forms, clear primary action.
- Modals and sort sheets: bottom sheet, icon/radio rows where relevant, explicit apply/save action.
- Empty states: one icon, one title, one plain next action.

## States

Every Clear Lens screen should cover:

- loading
- empty/no-data
- error/retry
- syncing/requested
- stale or missing composition data where relevant
- classic fallback through Settings

## Accessibility

- Avoid color-only meaning; pair positive/negative color with arrow/sign text.
- Keep touch targets at least 40px high.
- Keep text inside cards and pills from clipping on mobile widths.
- Use plain labels for financial terms and avoid unexplained acronyms.

## Known Divergences

Intentional divergences from the handoff prototype are tracked in `docs/design-audits/clear-lens-handoff-parity.md`.

The largest product-level divergence is that live portfolio data remains authoritative. Prototype values and fund names are not hardcoded.

## QA Checklist

- `npm run typecheck`
- `npm run lint`
- `npm test -- --runInBand`
- `EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_dummy npm run export:web`
- Browser pass on local Expo web with the demo auth shortcut
- Screenshot pass for Portfolio, Portfolio Insights, Your Funds, Fund Detail, Leaderboard, Wealth Journey, Settings, import, PDF upload, overflow menu, sort sheet, and modal states

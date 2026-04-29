# FundLens — Screens & Navigation

Clear Lens is the default app design. Classic remains available from Settings for fallback and comparison.

## Navigation Structure

Primary bottom tabs:

- `Portfolio`
- `Funds`
- `Wealth Journey`

Secondary navigation:

- `Settings` is hidden from the tab bar and opened from the shared header overflow menu.
- `Portfolio Insights` and `Fund Detail` are stack routes from Portfolio and fund rows.
- `Leaderboard` is hidden legacy chrome in Clear Lens for now; classic keeps its tab.
- `Onboarding / Import CAS` and `PDF Upload` are utility flows used for first-run import and later portfolio maintenance.
- `Compare` remains a hidden legacy route for transition and deep-link safety.

Screen families:

- Clear Lens primary tabs use the FundLens focus-ring header, restrained bottom tabs, Inter typography, and tokenized card surfaces.
- Utility screens use a back-title header, Clear Lens cards, and plain-language import/status copy.
- Classic screens remain behind the Settings design switch and should not inherit Clear Lens-only composition colors.

## Screen Map

### 1. Portfolio

The Portfolio tab is the default landing screen.

Clear Lens includes:

- dark value hero with total value, today's move, overall gain/loss, and SIP-aware XIRR
- benchmark comparison chip and benchmark selector
- `How your money grew` chart with invested, portfolio, and benchmark worth
- range controls: `1M`, `3M`, `6M`, `1Y`, `3Y`, `All`
- today's best and worst movers with arrowed signed deltas
- allocation preview when composition data is available
- entries for `Portfolio Insights`, `Your Funds`, and the Wealth Journey teaser path
- loading, empty, sync-requested, sync-error, and pull-to-refresh states

### 2. Portfolio Insights

Accessible from Portfolio.

Shows portfolio-level composition derived from shared scheme composition data:

- asset allocation donut card
- debt and cash details when relevant
- market-cap donut card
- sector exposure
- top holdings, paginated 10 per page up to the top 30 names
- AMFI disclosure date, stale state, bootstrap sync, and missing-data states

Category-rule fallback renders immediately. AMFI-backed data upgrades the screen when available.

### 3. Your Funds

Primary Clear Lens tab. Also accessible from Portfolio entry rows.

Includes:

- allocation overview with active fund count, top-three share, and largest position
- search
- sort bottom sheet with current value, invested amount, XIRR, benchmark lead, and alphabetical options
- compact fund rows with value and portfolio share
- expandable fund cards with Today, XIRR, invested, gain/loss, redeemed, booked P&L, NAV staleness, and filled sparkline when available

### 4. Fund Detail

Clear Lens Fund Detail includes:

- hero card with fund name, category, current value, invested amount, units, gain/loss, and XIRR
- tabs: `Performance`, `NAV History`, `Composition`
- Performance chart and growth consistency
- NAV History chart and period stats
- Composition asset mix, market-cap mix, sectors, top holdings, and disclosure footer
- Portfolio Weight card

Classic Fund Detail remains available when the design switch is set to classic.

### 5. Leaderboard

The classic Leaderboard tab ranks existing holdings against the selected benchmark. Clear Lens keeps the screen implementation available for future iteration, but the bottom tab currently points to `Funds`.

Clear Lens includes:

- benchmark selector
- portfolio-vs-benchmark alpha card
- leaders and laggards sections
- ranked fund cards with current value, XIRR, alpha in percentage points, and daily delta
- loading, empty, retry/error, and overflow-menu sync/import/settings states

### 6. Wealth Journey

The Wealth Journey tab models future wealth and withdrawal-income scenarios from the real portfolio.

Clear Lens includes:

- home screen with `Your portfolio today`, detected SIP review/edit, and `Your plan at a glance`
- segmented home preview for `Wealth growth` and `Withdrawal income`
- `Adjust your plan` step for future SIP, top-up, saving period, return preset/custom return, withdrawal rate, and post-withdrawal return
- results screen with growth chart, current-vs-adjusted path, milestones, present-value context, withdrawal snapshot, and drawdown view
- edit-SIP modal with detected and manual SIP paths
- persisted Zustand `wealthJourney` state shared with classic mode

### 7. Settings

Settings is hidden from tabs and opened from the overflow menu.

Includes:

- account details
- connected accounts and Google linking
- default benchmark preference
- design switch: Clear Lens default, classic selectable
- sync controls
- import tools, CAS address, PAN management, PDF upload shortcut
- sign out

### 8. Onboarding / Import CAS

Reusable for first-run onboarding and later imports.

Main import paths:

- dedicated CAS forwarding address
- CAS request via registered email
- direct PDF upload flow

Clear Lens mode uses the same behavior with Clear Lens header, cards, status chips, shadows, radii, and button treatment.

# FundLens — Screens & Navigation

## Navigation Structure

Primary tabs:

- `Portfolio`
- `Leaderboard`
- `Wealth Journey`

Secondary navigation:

- `Settings` is hidden from the tab bar and opened from the shared header/menu
- `Fund Detail`, `Portfolio Insights`, and `Your Funds` are stack routes
- `Compare` still exists as a hidden legacy route for transition / deep-link safety, but it is no longer part of the intended primary IA

Screen families:

- `Portfolio`, `Leaderboard`, and `Wealth Journey` use the shared primary-shell header: logo on the left, one `...` action sheet on the right
- `Settings`, `Your Funds`, and CAS import screens use a lighter utility header with one back action and one title
- `Fund Detail` uses the native stack back behavior and does not hardcode an origin label

## Screen Map

### 1. Portfolio

The Portfolio tab is the main landing screen.

It includes:

- total portfolio value
- unrealised gain / loss
- portfolio XIRR vs the selected benchmark
- weekend-aware NAV staleness messaging
- portfolio-vs-market chart
- top gainers / losers
- `Portfolio Insights` entry card
- `Wealth Journey` teaser card
- `Your Funds` entry card

The benchmark selector is configurable and reused across the app.

### 2. Portfolio Insights

Accessible from the Portfolio screen.

Shows portfolio-level composition derived from `fund_portfolio_composition`:

- asset mix
- debt / cash summary when relevant
- market-cap mix
- sector breakdown when disclosure data exists
- top holdings when disclosure data exists

Behavior:

- category-rule fallback means the screen can render immediately
- AMFI-backed data progressively upgrades the experience
- stale / missing composition can trigger a sync path
- the UI clearly marks estimated data vs disclosure-backed data

### 3. Your Funds

Accessible from the Portfolio screen.

Purpose:

- show the full holdings list in one dedicated place
- keep the home screen focused on summary and insights

Includes:

- fund-allocation overview
- count of all active funds
- lightweight sorting by current value, invested amount, XIRR, lead vs benchmark, or alphabetical via a bottom sheet
- one shared `FundCard` per holding

### 4. Fund Detail

Header:

- current value
- invested amount
- units
- gain / loss
- XIRR
- stale-date labeling when relevant
- one history-aware back path via the stack header
- polished composition cards with aligned labels / numeric columns

Tabs:

`Performance`
- fund vs benchmark return summary
- benchmark selector pills
- interactive line chart with crosshair
- growth-consistency / composition-related enhancements from later milestones

`NAV History`
- historical NAV chart
- period filters
- current and start-of-window NAV values at AMFI precision

Where available, fund composition data also surfaces here.

### 5. Leaderboard

Purpose:

- rank portfolio holdings into leaders / laggards
- compare holdings against a selected benchmark

Includes:

- leaders / laggards counts
- benchmark selector
- ranked holding list
- insight card explaining ranking mode / benchmark fallback behavior when needed

### 6. Wealth Journey

Purpose:

- help users model future wealth creation and withdrawal-income scenarios from their
  actual portfolio rather than from generic defaults

Includes:

- summary-first flow with:
  - `Your portfolio today`
  - `Your plan at a glance`
  - segmented results: `Wealth growth` / `Withdrawal income`
- dedicated `Adjust your plan` step instead of one long stacked calculator
- detected SIP review/edit flow that is separate from future plan changes
- current corpus and current XIRR context
- accumulation projection from today’s corpus
- fixed 6% inflation note to translate future nominal values into today-value context
- withdrawal-income view with withdrawal rate, withdrawal duration, and post-withdrawal return
- mobile-first charts showing visible checkpoint years only

### 7. Settings

Accessible from the shared header/menu, not as a visible bottom tab.

Includes:

- account details
- connected accounts / Google linking
- benchmark preference
- design theme preference
- sync controls
- import tools / CAS address / PAN management
- sign out

### 8. Onboarding / Import CAS

Reusable both for first-run onboarding and later portfolio management.

Main import paths:

- dedicated CAS forwarding address
- direct PDF upload flow

Related account-maintenance screens also live in this flow, including PAN / import-address management.

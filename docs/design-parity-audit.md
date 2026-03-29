# Design Parity Audit

## Scope

This document compares the imported concept at `/Users/hyadav/code/personal/FundLens/funlens_design_concept` against current `main` in `/Users/hyadav/code/personal/FundLens-main-review`.

It is written against the current product constraints:

- Compare will be removed from primary navigation.
- Settings should not remain its own bottom tab.
- There will be one combined focus-group round for design and functionality feedback.
- No new paid data source should be introduced.
- Compare is intentionally being retired without a replacement feature.

## Baseline on current `main`

Current `main` already ships a more complete product than the imported concept suggests:

- Home: portfolio total, gain/loss, configurable benchmark context, NAV staleness handling, fund cards
- Fund detail: holding summary, SIP-aware XIRR, benchmark comparison, crosshair-synced chart summary, NAV history
- Compare: multi-item comparison for funds and indexes
- Settings: account, import controls, benchmark preference, sign out
- Onboarding/import: CAS parser email workflow plus PDF upload path
- Local dev auth + seeded demo path

Relevant references:

- [README.md](/Users/hyadav/code/personal/FundLens-main-review/README.md)
- [SCREENS.md](/Users/hyadav/code/personal/FundLens-main-review/docs/SCREENS.md)
- [app/(tabs)/_layout.tsx](/Users/hyadav/code/personal/FundLens-main-review/app/(tabs)/_layout.tsx)
- [app/(tabs)/compare.tsx](/Users/hyadav/code/personal/FundLens-main-review/app/(tabs)/compare.tsx)
- [app/(tabs)/settings.tsx](/Users/hyadav/code/personal/FundLens-main-review/app/(tabs)/settings.tsx)

## Concept summary

The concept is strongest as a visual and IA direction:

- clearer editorial hierarchy
- stronger hero surfaces
- cleaner card rhythm
- explicit leaderboard destination
- explicit simulator destination
- more premium header/navigation treatment

It is weaker as a complete product specification:

- it omits or downplays several current core behaviors
- some displayed metrics appear illustrative rather than grounded in current data availability
- some concept controls imply features not yet implemented or not supported by current data

## Global observations

### Strong concept additions

- `dashboard_multi_index_pulse`: clearer portfolio hero and a visible portfolio-vs-market section
- `fund_performance`: a dedicated leaderboard screen that could absorb part of Compare’s discovery value
- `wealth_simulator`: a strong, self-contained capability with no paid-data dependency
- `bharat_wealth_blue/DESIGN.md`: a coherent design language worth preserving as a variant

### Current functionality the concept does not adequately represent

- NAV staleness states and stale-date wording
- crosshair-driven chart inspection
- per-fund benchmark override
- compare-anything workflow for funds and indexes
- email-forwarding import workflow and inbound CAS address model
- manual sync and operational settings

### Free-data feasibility notes

- Portfolio-vs-market chart: feasible from current holdings, transactions, NAV history, and cached index history
- Top gainers/losers: feasible from current portfolio cards if daily change remains available
- Simulator: feasible with local math only
- Technical metadata like expense ratio / AUM / min SIP: only feasible from free third-party sources or manual curation; should be optional
- Exit load: not reliably available from existing approved sources; should not be promised as a structured field

## Screen-by-screen parity matrix

### 1. Home

Concept source:
- `/Users/hyadav/code/personal/FundLens/funlens_design_concept/dashboard_multi_index_pulse`

Current `main`:
- strong portfolio summary and benchmark context
- fund list on the same screen
- existing benchmark selection and staleness handling

Concept-only additions worth considering:
- prominent `Portfolio vs. Market` chart
- `Top Gainers & Losers Today`
- stronger editorial hierarchy in the header and hero

Current behaviors to preserve:
- novice-readable market comparison
- live/stale/outdated framing
- direct path into fund cards
- real benchmark logic grounded in cached data

Concept gaps:
- no visible staleness treatment
- no clear preservation of current benchmark preference behavior
- mock benchmark choices include unsupported non-core options like `S&P 500`
- concept header shows notifications but there is no notifications capability on `main`

Recommendation:
- adopt the portfolio-vs-market chart
- adopt top movers if the data stays cheap to compute
- do not adopt unsupported benchmarks or notifications as implied scope
- preserve staleness and benchmark logic as non-negotiable

Priority:
- high

### 2. Fund detail

Concept source:
- `/Users/hyadav/code/personal/FundLens/funlens_design_concept/fund_details`

Current `main`:
- solid data-backed performance view
- benchmark selector
- interactive line chart with crosshair
- NAV history tab
- SIP-aware XIRR in the header

Concept-only additions worth considering:
- stronger XIRR narrative block
- growth-consistency section
- portfolio-impact/donut module
- technical details card

Current behaviors to preserve:
- crosshair inspection
- period-consistent comparison
- benchmark override controls
- NAV history tab
- real transactional context in the holding header

Concept gaps:
- no NAV history tab
- no visible benchmark selector
- no crosshair/inspection behavior
- includes `Exit Load` even though this is not currently available from an approved free structured source
- includes aspirational CTAs like `Invest Now` and `Add to Watchlist` that are out of scope for the current product

Recommendation:
- use the concept mostly as a layout treatment, not a behavioral spec
- add growth consistency and portfolio contribution if the current data model supports them cleanly
- treat technical metadata as optional enrichment
- cut or defer watchlist/invest actions

Priority:
- high

### 3. Leaderboard

Concept source:
- `/Users/hyadav/code/personal/FundLens/funlens_design_concept/fund_performance`

Current `main`:
- no leaderboard destination
- Compare exists today but is being intentionally removed from the product

Concept-only additions worth considering:
- ranked leaders/laggards screen
- high-level portfolio alpha summary

Concept gaps:
- ranking methodology is not specified
- benchmark choice behavior is not shown

Recommendation:
- build this as a new portfolio-insight destination, not as a Compare replacement
- make the ranking basis explicit and simple, likely one window at a time
- ensure drill-through to fund detail

Priority:
- medium-high

### 4. Simulator

Concept source:
- `/Users/hyadav/code/personal/FundLens/funlens_design_concept/wealth_simulator`

Current `main`:
- no simulator screen

Concept-only additions worth considering:
- adjustable SIP/lumpsum/return inputs
- baseline vs adjusted projection
- simple future-value storytelling

Current behaviors to preserve:
- none directly, this is net-new

Concept gaps:
- no clear persistence model
- no explanation of assumptions
- includes notifications icon and broader shell assumptions that are not core to the simulator itself

Recommendation:
- build this
- keep the first version simple and transparent about assumptions
- treat `Set as Goal` as optional

Priority:
- high

### 5. Settings

Concept source:
- `/Users/hyadav/code/personal/FundLens/funlens_design_concept/settings_updated`

Current `main`:
- richer operational settings than the concept
- account details, import controls, sync actions, benchmark preferences

Concept-only additions worth considering:
- design-theme toggle
- dark-mode toggle shell, if the variant architecture exists
- cleaner visual grouping

Current behaviors to preserve:
- import controls
- inbound CAS address
- PDF upload path
- benchmark preference
- sign out
- any sync or data-status visibility already shipped

Concept gaps:
- no import management workflow
- no manual sync
- no CAS address visibility
- shows push notifications, which do not exist on current `main`

Recommendation:
- use the concept for styling and sectioning
- keep operational settings from current `main`
- add the design toggle here later
- do not let the concept simplify Settings so much that core import management disappears

Priority:
- medium-high

### 6. Onboarding and auth

Concept sources:
- `/Users/hyadav/code/personal/FundLens/funlens_design_concept/login_magic_link`
- `/Users/hyadav/code/personal/FundLens/funlens_design_concept/cas_upload_onboarding`
- `/Users/hyadav/code/personal/FundLens/funlens_design_concept/magic_link_email_template`

Current `main`:
- magic-link auth
- local dev bypass for development
- onboarding/import includes email-forwarding workflow and PDF fallback

Concept-only additions worth considering:
- improved auth polish
- more premium PDF upload presentation
- custom magic-link email template

Current behaviors to preserve:
- magic-link auth behavior
- dev-only local bypass remaining hidden from production
- email-forwarding as the preferred import flow
- PDF upload fallback

Concept gaps:
- onboarding concept is PDF-centric and does not reflect the preferred email-forwarding model from the current product
- import-security copy is generic and does not explain the real workflow

Recommendation:
- restyle auth and onboarding, but keep the actual import model from current `main`
- if only one onboarding concept is implemented before the focus group, it should include both email-forwarding and PDF fallback

Priority:
- medium

## Replacement contract for Compare removal

Since Compare is a deliberate product cut, the question is not how to preserve it. The question is whether any of its behaviors should still influence other screen designs.

Current user jobs served by Compare:

- compare multiple funds side by side
- compare funds against indexes
- visually inspect return divergence on one chart
- scan a compact metrics table

Accepted loss:

- ad hoc multi-series, user-selected comparison will disappear
- side-by-side metrics table for multiple funds will disappear
- direct fund-vs-index selection outside Home and Fund Detail will disappear

Implication for the rest of the app:

- Home should answer “how is my portfolio doing?”
- Leaderboard should answer “which funds are doing well or poorly?”
- Fund Detail should answer “how is this specific fund doing versus its benchmark?”
- none of these screens needs to preserve Compare’s free-form comparison workflow

## Suggested implementation order from the audit

1. Finalize the replacement contract for Compare.
2. Update navigation and move Settings out of the tab bar.
3. Build the Home portfolio-vs-market section.
4. Build Leaderboard as the primary “funds overview” destination.
5. Build Simulator.
6. Expand Fund Detail with only the insight modules supported by current or free data.
7. Add the editorial design variant toggle in Settings.

## Non-goals from this audit

- introducing push notifications
- adding watchlists
- adding direct investing flows
- adding paid or contract-bound market/fund metadata sources
- turning the focus-group round into a statistically rigorous A/B test

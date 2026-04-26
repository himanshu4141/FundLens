# FundLens — ExecPlan Index

---

## Active plans

None — all plans are archived. Create a new ExecPlan for the next feature.

---

## Archived plans

All shipped work is in `docs/plans/archive/`. These are read-only historical records — agents should not read them unless debugging a specific decision from that feature.

**Phase 1 — Foundation Build** (`archive/phase-1-foundation/`)

| Plan | What it covers |
|---|---|
| `01-foundation.md` | Project scaffold, Supabase schema, auth |
| `02-data-pipeline.md` | NAV sync edge function, index history |
| `03-onboarding.md` | PAN entry, CAS registrar selection, import address |
| `04-home-screen.md` | Portfolio header, fund cards, benchmark comparison |
| `05-fund-detail.md` | Performance tab, NAV history tab, crosshair chart |
| `06-compare.md` | Multi-fund comparison screen |
| `07-cas-inbound-flow.md` | Email-forwarding inbound CAS pipeline |
| `07-settings-improvements.md` | Settings preferences, benchmark picker |
| `08-improvements.md` | UX polish, test session 1 fixes |
| `milestone-8-ux-polish.md` | Additional UX polish pass |
| `09-local-cas-pdf-parser.md` | Local PDF parsing (replaces CAS upload) |
| `10-dev-auth-bypass.md` | Demo account / local dev auth shortcut |
| `10-supabase-migration-drift-repair.md` | Migration drift repair and parity CI |
| `11-shared-scheme-catalog.md` | Shared scheme metadata catalog + slimmer user holdings storage |

**Phase 2 — Design Integration & Feature Completion** (`archive/phase-2-design-integration/`)

| Plan | What it covers |
|---|---|
| `M1-nav-restructure.md` | Settings→header icon; 3-tab layout |
| `M2-home-enhancements.md` | Portfolio vs Market chart; Top Gainers/Losers |
| `M3-leaderboard.md` | Performance Leaderboard screen |
| `M4-fund-tech-details.md` | Fund metadata sync (expense ratio, AUM, min SIP) |
| `M5-fund-detail-enhancements.md` | Growth consistency chart; Portfolio health donut |
| `M6-wealth-simulator.md` | Interactive SIP/lumpsum wealth projection tool |
| `M7-ab-theme-toggle.md` | V2 "Editorial Wealth" theme; settings toggle; new logo |
| `M8-google-login.md` | Google OAuth sign-in; account linking; existing-account detection |
| `M9-portfolio-insights.md` | Asset mix, market-cap mix, sector exposure, top holdings |
| `M10-screen-family-consistency.md` | Unified navigation chrome, single back affordance in Fund Detail, sortable Your Funds list |
| `M11-wealth-journey-redesign.md` | Wealth Journey — portfolio-anchored planning with drawdown view |

**Bug Fixes** (`archive/bug-fixes/`)

| Plan | What it covers |
|---|---|
| `1-portfolio-value-bug-fix.md` | CAS import REVERSAL/tax fix; Android PDF XHR; auth host guard; CI db push |

---

## Phase 3 — Clear Lens Design Mode (`phase-3-clear-lens-design-mode/`)

A new design-mode phase that keeps the current app as the default while adding the Focus Ring / Clear Lens redesign behind a persistent Settings switch.

| Plan | What it covers |
|---|---|
| `M1-clear-lens-design-mode.md` | `appDesignMode` setting; Clear Lens tokens and logo; redesigned Portfolio, Insights, Your Funds, Fund Detail, and supporting screens |

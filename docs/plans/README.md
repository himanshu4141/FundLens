# FundLens — ExecPlan Index

This folder contains the execution plans that document every significant change to the FundLens codebase. Plans are organised by phase.

---

## Phase 1 — Foundation Build (`phase-1-foundation/`)

The initial build of the app: auth, data pipeline, onboarding, core screens (Home, Fund Detail, Compare, Settings), NAV sync, and developer tooling.

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

---

## Phase 2 — Design Integration & Feature Completion (`phase-2-design-integration/`)

A stacked milestone series (M1→M7) that bridges the gap between the built app and the designer's "Editorial Wealth" concept, building all missing features before an A/B focus group test.

The milestones are a stacked PR chain — each branch builds on the one before it. **Test from the M7 tip branch** to see the complete product.

| Plan | Branch | What it covers |
|---|---|---|
| `M1-nav-restructure.md` | `feat/m1-nav-restructure` | Settings→header icon; Compare removed; Leaderboard+Simulator tab placeholders |
| `M2-home-enhancements.md` | `feat/m2-home-enhancements` | Portfolio vs Market chart; Top Gainers/Losers section |
| `M3-leaderboard.md` | `feat/m3-leaderboard` | Performance Leaderboard screen (Leaders/Laggards) |
| `M4-fund-tech-details.md` | `feat/m4-fund-tech-details` | Fund metadata sync (expense ratio, AUM, min SIP); technical details card |
| `M5-fund-detail-enhancements.md` | `feat/m5-fund-detail-enhancements` | Growth consistency chart; Portfolio health donut |
| `M6-wealth-simulator.md` | `feat/m6-wealth-simulator` | Interactive SIP/lumpsum wealth projection tool |
| `M7-ab-theme-toggle.md` | `feat/m7-ab-theme-toggle` | V2 "Editorial Wealth" theme; settings toggle; new logo |
| `M8-google-login.md` | `claude/google-login-integration-Gx6to` | Google OAuth sign-in; account linking in Settings; existing-account detection |
| `M12-composition-data-acquisition.md` | `TBD` | Source-aware composition data design after Stage 1 research |
| `M13-composition-app-enrichment.md` | `TBD` | Fund Detail + Portfolio Insights plan for richer composition presentation |

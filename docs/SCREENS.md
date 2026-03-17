# FundLens — Screens & Navigation

## Screen Map

### 1. Home
- Portfolio total value
- Movement over time: past day, past week, custom date range (text + visual chart)
- You vs Market: portfolio return vs a broad market index (default: auto-selected based on user's funds, e.g. Nifty 50), with ability to switch index manually
- Scroll down → Fund Cards (see below)

### 2. Fund Cards (inline on Home, scrollable)
One card per fund in the portfolio. Each card shows:
- Fund name
- Current NAV + today's movement
- Fund return vs its benchmark at a glance (e.g. Fund +18% / Benchmark +15%)

Tapping a card → Fund Detail screen

### 3. Fund Detail
Two tabs:

**Performance tab**
- XIRR (plain English: "your actual return accounting for every SIP instalment")
- Fund return vs benchmark across time windows
- Plain language explanation of each metric shown

**NAV History tab**
- Historical NAV chart
- Date range selector

### 4. Compare
- Select 2+ funds from your portfolio
- Side-by-side comparison of returns, benchmark performance, XIRR

### 5. Onboarding (first launch)
- **Option A (recommended)**: Upload CAS PDF or scan CAMS QR code → auto-import all funds, units, and transaction history
- **Option B (fallback)**: Manually search and add funds, enter SIP details per fund

> Note: CAMS changed their CAS request process ~March 2026. Research the current process before implementing this flow.

### 6. Settings / Manage Funds
- View and manage tracked funds (add / remove)
- Refresh transactions (re-upload CAS or re-fetch via CAMS)
- Change default market benchmark index

## Navigation Structure

    Home (portfolio summary + fund cards)
      └── Fund Detail (performance + NAV history)

    Compare (tab or bottom nav item)

    Settings (accessible from Home header)
      └── Onboarding flow (reusable for first launch and fund management)

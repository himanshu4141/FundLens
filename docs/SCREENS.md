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
- **Option A (recommended)**: MFcentral redirect flow — app opens MFcentral in browser, user authenticates with OTP, generates a QR code on MFcentral, returns to app and uploads the QR → app fetches and parses full transaction history automatically
- **Option B (fallback)**: Manual CAS PDF upload — user downloads CAS from CAMS/KFintech themselves and uploads the PDF in-app

> See docs/TECH-DISCOVERY.md for full details on why this flow was chosen and the constraints around CAS import.

### 6. Settings / Manage Funds
- View and manage tracked funds (add / remove)
- Refresh transactions (re-run MFcentral redirect flow or re-upload CAS PDF)
- Change default market benchmark index

## Navigation Structure

    Home (portfolio summary + fund cards)
      └── Fund Detail (performance + NAV history)

    Compare (tab or bottom nav item)

    Settings (accessible from Home header)
      └── Onboarding flow (reusable for first launch and fund management)

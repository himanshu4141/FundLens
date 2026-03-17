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
- **Primary flow**: Guided CAS PDF upload — app walks user step-by-step through downloading their CAS from camsonline.com, then uploading the PDF in-app. App parses it automatically and imports all funds and transaction history.
- **Manual fallback**: Search and add funds individually without transaction history (limits XIRR accuracy)

> See docs/TECH-DISCOVERY.md for why MFcentral QR flow was ruled out (defunct since Sept 2025) and full CAS import details.

### 6. Settings / Manage Funds
- View and manage tracked funds (add / remove)
- Refresh transactions (re-upload a fresh CAS PDF)
- Change default market benchmark index

## Navigation Structure

    Home (portfolio summary + fund cards)
      └── Fund Detail (performance + NAV history)

    Compare (tab or bottom nav item)

    Settings (accessible from Home header)
      └── Onboarding flow (reusable for first launch and fund management)

# FundLens — Screens & Navigation

## Screen Map

### 1. Home
- Portfolio total value + unrealised gain/loss (amount + %)
- You vs Market: portfolio XIRR vs a configurable benchmark (default Nifty 50); benchmark selector row lets the user switch between Nifty 50, Nifty 100, BSE Sensex, BSE 100, BSE 500, Nifty Bank, Nifty IT
- NAV staleness banner when data is ≥2 days old
- Scroll down → Fund Cards (see below)

### 2. Fund Cards (inline on Home, scrollable)
One card per fund in the portfolio. Each card shows:
- Parsed short fund name (e.g. "HDFC Flexi Cap Fund") with "Direct · Growth" or "Regular · IDCW" badge below the category label
- Current value + today's change; label reads "as of [date]" when NAV is stale instead of "today"

Tapping a card → Fund Detail screen

### 3. Fund Detail
Header card: current value (with "as of [date]" when stale), invested, units, gain/loss, XIRR (SIP-adjusted, annualised)

Two tabs:

**Performance tab**
- Period-consistent comparison card: Your Fund (window) % vs Benchmark (window) %, verdict row "↑ Outperforming by X.X% vs {index}" or "↓ Underperforming by X.X%"
- Scrollable benchmark selector pills — user can override the comparison index for this fund (Nifty 50, Nifty 100, BSE Sensex, BSE 100, BSE 500, Nifty Bank, Nifty IT)
- Dual area chart (fund NAV + benchmark indexed to 100 at start of period); crosshair on hover/touch shows exact values
- Return summary below chart syncs to crosshair position; resets to end-of-period when crosshair is released
- Explainer: "Both series rebased to 100 at start of period · higher = outperforming"

**NAV History tab**
- Historical NAV chart with Y-axis labels
- Date range selector (1M, 3M, 6M, 1Y, 3Y, All)
- NAV stats showing current and start-of-window NAV at 4 decimal places (AMFI precision)

### 4. Compare
- Select 2+ funds from your portfolio
- Side-by-side comparison of returns, benchmark performance, XIRR

### 5. Onboarding (first launch)
- **Primary flow**: Email forwarding — app shows user their dedicated CASParser.in forwarding address. User forwards their CAMS CAS email to it. App auto-imports all funds and full transaction history via webhook.
- **Fallback**: Manual CAS PDF download from camsonline.com → upload in-app → parsed automatically.

> MFcentral QR flow removed — email sync and PDF upload cover all practical cases with lower friction. See docs/plans/03-onboarding.md for the decision record.

> See docs/TECH-DISCOVERY.md for full CAS import details and the reasoning behind each option.

### 6. Settings / Manage Funds
- View and manage tracked funds (add / remove)
- Refresh transactions — forward latest CAMS email to dedicated address (primary), or re-run PDF upload
- **Preferences** — default benchmark selector (persists via Zustand; resets on app restart)
- Data section — dynamic NAV badge (Live / Stale / Outdated) with last-sync date; CAS registrar email address for import

## Navigation Structure

    Home (portfolio summary + fund cards)
      └── Fund Detail (performance + NAV history)

    Compare (tab or bottom nav item)

    Settings (accessible from Home header)
      └── Onboarding flow (reusable for first launch and fund management)

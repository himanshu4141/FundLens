# FundLens — Technical Discovery

This document captures the outcome of the technical discovery session. It records the decisions made, the reasoning behind them, and the key findings from research. No implementation has started yet.

---

## Tech Stack Decisions

| Layer | Decision | Reasoning |
|---|---|---|
| **Frontend** | Expo (React Native) + TypeScript | Familiar React ecosystem, native widgets on Android/iOS, single codebase covers Android + iOS + iPad + macOS + Web. New Architecture (stable 2024) closes performance gap with Flutter. |
| **Backend** | Supabase (Postgres + Edge Functions) | Lightweight, handles DB + auth + scheduled jobs. Fits a personal-scale app. No separate server to maintain. |
| **NAV data** | mfapi.in | Free, JSON, no auth, 9000+ schemes, historical NAV going back years. Sourced from AMFI. |
| **Index data** | Yahoo Finance via `yfinance` (server-side) | Reliable free source for Nifty 50, Nifty Midcap 150, Nifty Smallcap 250 etc. Must be fetched server-side — NSE direct calls fail in browser due to CORS. |
| **CAS import** | MFcentral redirect + QR flow (primary) | Better UX than manual PDF upload. User stays in control of their own auth. No third-party gets credential or Gmail access. |
| **CAS fallback** | Manual CAS PDF upload | For users who prefer it or if MFcentral flow fails. |
| **CAS parsing** | Open-source `casparser` Python library (self-hosted on Supabase) | Same parser used by CASParser.in commercially. Zero third-party data sharing, free, we control everything. |
| **XIRR calculation** | Client-side TypeScript | Standard algorithm, no external dependency. Accounts for SIP timing to give accurate money-weighted returns. |

---

## Data Sources

### Mutual Fund NAVs — mfapi.in

- **Base URL**: `https://api.mfapi.in`
- **Key endpoints**:
  - `GET /mf/search?query={name}` — search schemes
  - `GET /mf/{scheme_code}` — full NAV history
  - `GET /mf/{scheme_code}/latest` — latest NAV only
- **Cost**: Free, no auth
- **Update frequency**: Daily after 9 PM IST
- **Coverage**: 9000+ schemes, 20M+ historical records
- **Caching strategy**: Daily cron job on Supabase Edge Function stores NAVs in DB — app never calls mfapi.in directly

### Benchmark Index Data — Yahoo Finance

- **Symbols**:
  - Nifty 50: `^NSEI`
  - Nifty Midcap 150: `NIFTYMIDCAP150.NS`
  - Nifty Smallcap 250: `NIFTYSMLCAP250.NS`
- **Library**: `yfinance` (Python) on Supabase Edge Functions
- **CORS note**: NSE API calls from browser fail. All index data must be fetched server-side and cached in DB.
- **Cost**: Free

### CAS Import — MFcentral Redirect Flow

The MFcentral programmatic API was shut down by AMFI in September 2025 following distributor complaints about data sharing. The user-facing MFcentral portal still works. FundLens uses the same approach as Value Research:

**Flow:**
1. User taps "Import / Refresh transactions" in app
2. App opens MFcentral (`mfc-cas.mfcentral.com`) in browser / in-app webview
3. User authenticates with OTP on MFcentral
4. User selects: Both Regular + Direct, Transactions, All AMCs
5. User generates and saves QR code
6. User returns to FundLens and uploads the QR code
7. App sends QR to backend → backend fetches CAS → `casparser` parses it → transactions stored in DB

**On mobile**: After generating the QR on MFcentral, user screenshots/saves it and taps "Upload QR" back in the app. One extra step but far better than full manual PDF workflow.

**CAS parsing library**: [`casparser`](https://github.com/codereverser/casparser) (MIT, Python 3.10+)
- Supports CAMS, KFintech, FTAMIL statements
- Outputs structured JSON: holdings, transaction history, units, cost basis
- Transaction history is what enables accurate XIRR calculation per fund

---

## What MFcentral CAS Contains

Each CAS includes:
- All folios across CAMS + KFintech RTAs
- Full transaction history (SIP instalments, lump sums, STPs, redemptions, switches)
- Current units and NAV per scheme
- Cost of investment

This gives us everything needed to compute XIRR accurately for SIP investors.

---

## Key Constraints & Decisions Not To Revisit

- **No Gmail OAuth** — rejected on privacy grounds. User authenticates directly on MFcentral; FundLens never handles credentials.
- **No CASParser.in API** — rejected to avoid third-party data sharing, even though the service is reputable. Self-hosted parsing is sufficient.
- **No Account Aggregator** — requires SEBI RIA license, ₹5-25L cost, 5-10 month implementation. Not viable.
- **Index data must be server-side** — CORS blocks browser-side NSE API calls. No exceptions.

---

## Open Questions (to resolve before implementation)

- [ ] Confirm `casparser` Python library works within Supabase Edge Function environment (Deno vs Python runtime)
- [ ] Verify MFcentral QR code format — research exactly how Value Research uses the QR to fetch CAS on their backend
- [ ] Decide on benchmark auto-mapping: how do we map each fund's scheme code to its declared benchmark index?
- [ ] Confirm `yfinance` rate limits and whether a daily cron is sufficient or needs a fallback source

# FundLens — Technical Discovery

This document captures the outcome of the technical discovery session. It records the decisions made, the reasoning behind them, and the key findings from research. No implementation has started yet.

---

## Tech Stack Decisions

| Layer | Decision | Reasoning |
|---|---|---|
| **Frontend** | Expo (React Native) + TypeScript | Familiar React ecosystem, native widgets on Android/iOS, single codebase covers Android + iOS + iPad + macOS + Web. New Architecture (stable 2024) closes performance gap with Flutter. |
| **Backend** | Supabase (Postgres + Edge Functions) | Lightweight, handles DB + auth + scheduled jobs. Fits a personal-scale app. |
| **CAS parsing service** | Python FastAPI on Fly.io (or Modal) | `casparser` is Python-only — Supabase Edge Functions are Deno (TypeScript only), so a separate lightweight Python microservice is required. No JS/TS equivalent of `casparser` exists. |
| **NAV data** | mfapi.in | Free, JSON, no auth, 9000+ schemes, historical NAV going back years. Sourced from AMFI. |
| **Index data** | `yfinance` (Python, server-side) | Free, sufficient for daily EOD fetch. Must be server-side — NSE direct calls fail in browser due to CORS. Fallback chain required (see below). |
| **Benchmark mapping** | SEBI category lookup table (hardcoded) | mfapi.in and AMFI flat file contain no benchmark data. Using `scheme_category` from mfapi.in + hardcoded SEBI category-to-benchmark table covers ~80% of funds deterministically. |
| **CAS import** | Manual CAS PDF upload (primary) | MFcentral QR flow is fully defunct — the backend API (`services.mfcentral.com`) was shut down Sept 2025 alongside the programmatic API. No live QR-to-CAS pipeline exists anymore. Manual PDF upload is now the most reliable option. |
| **CAS parsing** | Open-source `casparser` Python library | Runs on our Python microservice (Fly.io). Supports CAMS, KFintech, FTAMIL. Zero third-party data sharing. |
| **XIRR calculation** | Client-side TypeScript | Standard algorithm, no external dependency needed. Accounts for every SIP instalment timing. |

---

## Architecture Overview

```
Expo App (React Native)
    │
    ├── Supabase (Postgres + Edge Functions)
    │     ├── DB: funds, nav_history, index_history, transactions
    │     ├── Daily cron: fetch NAVs from mfapi.in
    │     ├── Daily cron: fetch index data via yfinance
    │     └── On CAS upload: call Python parsing service
    │
    └── Python Parsing Service (Fly.io / Modal)
          ├── Accepts CAS PDF upload
          ├── Runs casparser
          └── Returns structured JSON → written to Supabase DB
```

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
- **Caching strategy**: Daily cron on Supabase Edge Function stores NAVs in DB — app never calls mfapi.in directly

### Benchmark Index Data — yfinance

- **Symbols**:
  - Nifty 50: `^NSEI`
  - Nifty Midcap 150: `^NSEMDCP150`
  - Nifty Smallcap 250: `^NSEMDCP250` (verify symbol)
- **Library**: `yfinance` (Python) on the Python microservice or a dedicated Supabase cron
- **CORS note**: All index data must be fetched server-side and cached in DB
- **Known issue**: `^NSEMDCP150` is less reliable than `^NSEI` on Yahoo Finance — can return stale or empty data
- **Cron timing**: Run after 10:30 UTC (4:00 PM IST) to ensure EOD bar is finalised
- **Fallback chain**:
  1. `yfinance` (primary)
  2. Stooq via pandas-datareader for Nifty 50 (`https://stooq.com/q/d/l/?s=^nsei&i=d`)
  3. EODHD free tier (20 calls/day) for Midcap/Smallcap indices where yfinance is unreliable
- **Validation required**: Check returned DataFrame is non-empty, date matches expected trading day, value is within sane range

### Benchmark Mapping — SEBI Category Lookup

Neither mfapi.in nor AMFI's flat NAV file contain benchmark data. The mapping is derived from:

1. **`scheme_category` field from mfapi.in** (e.g., `"Equity Scheme - Large Cap Fund"`)
2. **Hardcoded SEBI category-to-benchmark table** (from SEBI's 2017 Categorization circular, TRI mandated since Feb 2018)

Standard mappings:

| Category | Benchmark |
|---|---|
| Large Cap | Nifty 100 TRI |
| Mid Cap | Nifty Midcap 150 TRI |
| Small Cap | Nifty Smallcap 250 TRI |
| Large & Mid Cap | Nifty LargeMidcap 250 TRI |
| Flexi Cap | Nifty 500 TRI |
| Multi Cap | Nifty 500 Multicap 50:25:25 TRI |
| ELSS | Nifty 500 TRI (heterogeneous — may need per-fund override) |
| Index Fund (Nifty 50) | Nifty 50 TRI |
| Liquid | Nifty Liquid Index TRI |

**Stability**: Benchmarks rarely change — only during SEBI regulatory events (~2-3 times per decade industry-wide). Safe to treat as stable within a regulatory era. Store with a `valid_from` date.

**Edge cases**: ELSS and thematic/sectoral funds are heterogeneous — category default may not be accurate. Override with per-fund data scraped from Value Research Online as needed.

### CAS Import — Manual PDF Upload

The MFcentral QR flow is **no longer viable**. Research confirmed the backend API (`services.mfcentral.com/api/client/V1/submitcasdetailrequest`) was shut down in September 2025 alongside the programmatic API. Even if the user-facing portal generates a QR, there is no endpoint to redeem it for CAS data.

**Current flow:**
1. User taps "Import / Refresh transactions" in app
2. App shows step-by-step guide: go to camsonline.com → request CAS → download PDF
3. User uploads PDF in FundLens
4. App sends PDF to Python parsing service on Fly.io
5. `casparser` parses PDF → structured JSON returned
6. Supabase stores full transaction history

**CAS parsing library**: [`casparser`](https://github.com/codereverser/casparser) (MIT, Python 3.10+)
- Supports CAMS, KFintech, FTAMIL statements
- Outputs: holdings, full transaction history (SIP instalments, lump sums, STPs, redemptions, switches), units, cost basis
- Transaction history enables accurate XIRR calculation per fund

**Python parsing service**: FastAPI on [Fly.io](https://fly.io) (free tier: 3 shared-CPU VMs) or [Modal](https://modal.com) (serverless, pay-per-call — ideal for infrequent parsing)

---

## What CAS Contains

Each CAS PDF includes:
- All folios across CAMS + KFintech RTAs
- Full transaction history (SIP instalments, lump sums, STPs, redemptions, switches)
- Current units and NAV per scheme
- Cost of investment

This gives us everything needed to compute XIRR accurately for SIP investors.

---

## Key Constraints & Decisions Not To Revisit

- **No Gmail OAuth** — rejected on privacy grounds.
- **No CASParser.in API** — rejected to avoid third-party data sharing. Self-hosted parsing is sufficient.
- **No Account Aggregator** — requires SEBI RIA license, ₹5-25L cost, 5-10 month implementation. Not viable.
- **No MFcentral QR flow** — defunct since Sept 2025. Backend API shut down — no way to redeem QR for CAS data.
- **Index data must be server-side** — CORS blocks browser-side NSE API calls.
- **casparser cannot run in Supabase Edge Functions** — Edge Functions are Deno (TypeScript only). A separate Python microservice is required.

---

## Open Questions

All open questions from initial discovery have been resolved. None remain.

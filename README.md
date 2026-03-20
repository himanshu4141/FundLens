# FundLens

Track your Indian mutual fund portfolio against benchmarks. Import from CAS, see XIRR, compare funds side-by-side.

---

## What works now

- Magic link authentication (sign in / sign out)
- **Import portfolio** — enter your KFintech email and request a CAS via CASParser, or upload a CAS PDF directly through the app's Python parser path
- **Home screen** — total portfolio value, today's NAV change, your XIRR vs Nifty 50, scrollable fund cards
- **Fund detail** — XIRR, fund vs benchmark chart (indexed to 100), NAV history chart, time window selector
- **Compare** — select up to 3 funds, multi-line chart, side-by-side XIRR / 1Y return table
- **Settings** — account info, inbound CAS address, PDF upload shortcut, sign out
- **Data sync** — NAV and benchmark index data synced hourly on weekdays via pg_cron + Edge Functions
- Full CI/CD: typecheck + lint + EAS Update on every PR; Supabase deploy + production EAS Update on merge to main

---

## Prerequisites

| Tool | Install |
|---|---|
| Node.js 20+ | [nodejs.org](https://nodejs.org) |
| Expo CLI | `npm install -g expo-cli` |
| EAS CLI | `npm install -g eas-cli` |
| Supabase CLI | `brew install supabase/tap/supabase` |

---

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/FundLens.git
cd FundLens
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Get these from your [Supabase project](https://supabase.com/dashboard) → Settings → API.

> **Note:** Supabase now uses **publishable keys** (format: `sb_publishable_...`) instead of the old `anon` key. See the [migration announcement](https://github.com/orgs/supabase/discussions/29260).

### 3. Start the app

```bash
npm start        # opens Expo dev server — scan QR with Expo Go
npm run web      # runs in browser at localhost:8081
npm run android  # opens Android emulator or connected device
```

### 4. Supabase schema

The schema is already deployed to the project. If you fork and use a new Supabase project, push the migrations:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

Regenerate TypeScript types after schema changes:

```bash
npm run gen:types
```

---

## Android APK (install on your phone)

Build a preview APK via EAS:

```bash
eas build --profile preview --platform android
```

After ~20 minutes, EAS prints a download link. Open it on your phone, download the APK, and install it. You only need to rebuild when native code changes; JS changes deploy instantly via `eas update`.

---

## Auth: Magic Link

1. Open the app → enter your email → tap "Send magic link"
2. Check your inbox → tap the link
3. The link opens `fundlens://auth/confirm` and signs you in automatically

The deep link scheme `fundlens://` is configured in `app.json` and the Supabase Auth redirect URL allow-list.

---

## CI/CD

| Trigger | Workflow | What it does |
|---|---|---|
| Pull request | `pr-preview.yml` | `tsc`, `eslint`, `eas update` to `pr-{N}` branch, posts QR comment |
| Merge to main | `production.yml` | `tsc`, `eslint`, `eas update` to `production` channel |
| Merge to main | Vercel (automatic) | `expo export --platform web` → deploys to Vercel |
| Merge to main | `supabase-deploy.yml` | Deploy edge functions + run migrations (triggers when `supabase/` paths change) |

**Required GitHub secrets:**
- `EXPO_TOKEN` — from expo.dev → Account Settings → Access Tokens
- `EXPO_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — your Supabase publishable key
- `SUPABASE_ACCESS_TOKEN` — from supabase.com → Account → Access Tokens
- `SUPABASE_PROJECT_REF` — your project ref (e.g. `imkgazlrxtlhkfptkzjc`)
- `SUPABASE_DB_URL` — from Supabase Dashboard → Settings → Database → Connection string (direct)

---

## Project structure

```
app/               Expo Router screens
  _layout.tsx      Root layout: providers + auth gate
  auth/            Sign in + confirm screens
  (tabs)/          Home, Compare, Settings tabs
  fund/[id].tsx    Fund detail
  onboarding/      CAS import flows (onboarding, qr, pdf)
src/
  components/      Shared UI components
  hooks/           useSession, usePortfolio, useFundDetail, useCompare, ...
  lib/             supabase.ts, queryClient.ts
  types/           database.types.ts (auto-generated), app.ts
  utils/           xirr.ts, formatCurrency.ts, cashflows.ts, filterToWindow.ts
supabase/
  functions/       Edge Functions: sync-nav, sync-index, cas-webhook
  migrations/      SQL migrations
docs/
  plans/           ExecPlan documents per milestone
.github/workflows/ CI/CD (pr-preview, production, supabase-deploy)
```

---

## Milestones

| # | Branch | Description |
|---|---|---|
| 1 | `milestone/1-foundation` | App skeleton, auth, schema, CI/CD |
| 2 | `milestone/2-data-pipeline` | Edge Functions: sync-nav, sync-index, Supabase deploy workflow |
| 3 | `milestone/3-onboarding` | CAS import via CASParser inbound email, PDF upload |
| 4 | `milestone/4-home-screen` | Portfolio total, XIRR vs benchmark, fund cards |
| 5 | `milestone/5-fund-detail` | Fund vs benchmark chart, NAV history, time windows |
| 6 | `milestone/6-compare` | Multi-fund comparison chart and metrics table |
| 7 | `milestone/7-improvements` | Settings screen, smart import, hourly cron |

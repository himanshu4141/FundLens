# FundLens

Track your Indian mutual fund portfolio against benchmarks. Import from CAS, see XIRR, inspect composition, and model future outcomes.

---

## What works now

- Magic link authentication (sign in / sign out) and **Google OAuth** — sign in with your Google account as an alternative; connect Google to an existing account from Settings
- Optional local-only dev auth shortcut backed by a seeded demo user
- **Import portfolio** — enter your CAS registrar email and request a CAS via CASParser, or upload a CAS PDF directly; supports CAMS / KFintech / MFCentral PDFs (password = PAN) and CDSL / NSDL demat CAS PDFs (password = PAN + date of birth); type is auto-detected from the PDF content; failed SIPs (REVERSAL transactions) are correctly excluded so they never create phantom holdings
- **Portfolio / Home screen** — Clear Lens is the default: dark value hero, NAV staleness context, XIRR vs configurable benchmark, investment journey chart with `1M`/`3M`/`6M`/`1Y`/`3Y`/`All` ranges, top movers, allocation preview, Portfolio Insights entry, Your Funds entry, and Wealth Journey path; classic remains selectable in Settings
- **Money Trail** — Clear Lens transaction history built from CAS imports, with portfolio preview by Indian financial year, quick action entry, fund-specific entry points, summary totals, search, filters, sorting, transaction detail, and CSV export of the visible filtered list
- **Fund detail** — polished holding header with current value, gain/loss, XIRR (SIP-adjusted, annualised), clearer composition cards/tables, and one clean history-aware back path; Performance tab with period-consistent fund vs benchmark comparison, per-fund benchmark selector, interactive crosshair, crosshair-synced return summary; NAV History tab with 4dp precision; both charts have Y-axis labels and fit all data within the container
- **Leaderboard** — Clear Lens ranked leaders / laggards view with benchmark-aware scoring, alpha summary, benchmark selector, loading/empty/error states, and classic fallback
- **Wealth Journey** — Clear Lens summary-first planning flow based on your current corpus, detected SIP pace with separate review/edit, future-SIP targeting, expected-return presets, top-ups, withdrawal scenarios, inflation-adjusted context, side-by-side current-vs-adjusted results, and withdrawal drawdown view
- **Settings** — account info, **Connected Accounts** (shows linked providers; connect Google to an existing magic-link account), inbound CAS address, PDF upload shortcut, Preferences section with default benchmark picker and design theme, sign out
- **Portfolio Insights** — one-tap access from the Portfolio screen to asset mix, market cap distribution, sector exposure, debt/cash mix, top holdings, and fund allocation; two-layer data: SEBI category rules (instant) + AMFI monthly disclosure (richer); prominent "estimated" banner when showing category-derived data; auto-syncs when data is >35 days old
- **Shared scheme catalog** — scheme metadata and composition caches are now stored once per `scheme_code`, so future users can reuse known fund data instead of rebuilding duplicate per-user copies; the catalog also captures future-use `mfdata` fields like family linkage, declared benchmark text, risk label, Morningstar rating, and related variants
- **Screen-family navigation** — Portfolio / Leaderboard / Wealth Journey are the primary tabs; Settings and Compare are hidden from the tab bar; utility screens use a lighter back-title header; Fund Detail relies on one clear history-aware back path
- **Your Funds** — dedicated screen listing all holdings with shared fund cards, portfolio-allocation context, a mobile-friendly sort sheet, and in-memory sorting by current value, invested amount, XIRR, benchmark lead, or alphabetical order
- **Clear Lens design mode** — Clear Lens is the default Focus Ring design; Settings can switch back to the current/classic design, and the choice persists across restarts while the app name remains FundLens
- **Preview usage metrics** — EAS Insights support is enabled via `expo-insights`, so once the preview apps are rebuilt and installed you can see usage trends for the preview streams in Expo
- **Data sync** — NAV and benchmark index data synced via parallel fetch (Promise.allSettled) on pg_cron; completes in <30s regardless of scheme count
- Full CI/CD: typecheck + lint + coverage in CI, EAS Update on every PR, Supabase migration replay validation on PRs, linked-project migration/schema validation before Supabase deploys on merge to main, and hardened preview publishing for Vercel / EAS export hangs

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

### 3a. Optional: local dev auth shortcut + demo portfolio

If you want to test the app end to end without waiting for magic-link emails or using a real portfolio:

1. Set these in `.env.local`:

```env
EXPO_PUBLIC_ENABLE_DEV_AUTH_BYPASS=true
EXPO_PUBLIC_DEV_AUTH_EMAIL=demo@fundlens.local
EXPO_PUBLIC_DEV_AUTH_PASSWORD=change-me-local-only
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

2. Seed the demo user and portfolio:

```bash
npm run seed:demo
```

3. Start the app locally. On the sign-in screen, a dev-only `Continue as demo user` shortcut will appear on localhost / dev builds.

Notes:
- This shortcut is intended for local development only.
- Do not enable it in production or shared preview environments.
- Private real CAS files can be kept under `fixtures/private/`, which is git-ignored.

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

Build the stable preview APK via EAS:

```bash
eas build --profile preview-main --platform android
```

Build the rolling PR preview APK via EAS:

```bash
eas build --profile preview-pr --platform android
```

After ~20 minutes, EAS prints a download link. Open it on your phone, download the APK, and install it. You only need to rebuild when native code changes; JS changes deploy instantly via `eas update`.

Recommended device setup during active development:

- Install `preview-main` once as your stable shareable preview app
- Install `preview-pr` once as your rolling PR review app
- `main` merges publish OTA updates to the `main` stream for `FundLens Main`
- PR commits publish OTA updates to the `pr-builds` stream for `FundLens PR`

---

## Auth: Magic Link

1. Open the app → enter your email → tap "Send secure link →"
2. Check your inbox → tap the link
3. The link opens your installed FundLens app and signs you in automatically

The app scheme varies by installed build (`fundlens`, `fundlens-main`, `fundlens-pr`, etc.) and is configured in [app.config.js](/Users/hyadav/code/personal/FundLens/app.config.js).

---

## Auth: Google OAuth

Tap "Continue with Google" on the sign-in screen. The app opens an in-app browser (or redirects on web), you authenticate with Google, and the app completes sign-in automatically.

**Existing accounts:** if your Google email matches an existing magic-link account, Supabase auto-links the two identities and you see a confirmation. If you signed in via magic link first, go to Settings → Connected Accounts → Connect to add Google afterwards.

### Setup required (one-time, in dashboards)

**1. Google Cloud Console**

- Create an OAuth 2.0 Web Client ID at [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials.
- Add these to **Authorized redirect URIs**:
  - `https://<your-project-ref>.supabase.co/auth/v1/callback`

**2. Supabase Dashboard**

- Go to Auth → Providers → Google → enable and paste the Client ID and Client Secret.
- Go to Auth → URL Configuration:
  - set `Site URL` to `https://fund-lens.vercel.app`
  - add these exact `Redirect URLs`:

  | Environment | URL |
  |---|---|
  | Production web bridge | `https://fund-lens.vercel.app/auth/confirm` |
  | Production web OAuth | `https://fund-lens.vercel.app/auth/callback` |
  | Vercel preview bridge | `https://fund-lens-*.vercel.app/auth/confirm` |
  | Vercel preview OAuth | `https://fund-lens-*.vercel.app/auth/callback` |
  | Local web dev bridge | `http://localhost:8081/auth/confirm` |
  | Local web dev OAuth | `http://localhost:8081/auth/callback` |
  | Local Expo web bridge | `http://localhost:19006/auth/confirm` |
  | Local Expo web OAuth | `http://localhost:19006/auth/callback` |
  | Native production app bridge | `fundlens://auth/confirm` |
  | Native production app OAuth | `fundlens://auth/callback` |
  | Native main preview bridge | `fundlens-main://auth/confirm` |
  | Native main preview OAuth | `fundlens-main://auth/callback` |
  | Native PR preview bridge | `fundlens-pr://auth/confirm` |
  | Native PR preview OAuth | `fundlens-pr://auth/callback` |

Notes:
- `/auth/confirm` is used by the magic-link/native bridge flow
- `/auth/callback` is used by Google OAuth
- we intentionally avoid the broader `https://*.vercel.app/**` wildcard and only allow preview URLs matching this project’s naming pattern

**3. Local web development (`npm run web`)**

For Google login to work at `http://localhost:8081`, add `http://localhost:8081/auth/callback` to both lists above (Supabase Redirect URLs **and** Google Cloud Console Authorized redirect URIs).

No `.env.local` changes are needed — the client reads the Google OAuth configuration from Supabase automatically.

**Native local testing**

Google OAuth on native requires a build that has the right app scheme registered. Expo Go cannot be used. Options:

- Build a development client: `eas build --profile development --platform android` (or `ios`)
- Install the stable preview app: `eas build --profile preview-main --platform android`
- Install the rolling PR preview app: `eas build --profile preview-pr --platform android`

---

## CI/CD

| Trigger | Workflow | What it does |
|---|---|---|
| Pull request | `pr-preview.yml` | `tsc`, `eslint`, `eas update` to the shared `pr-builds` stream for the installed `FundLens PR` app, posts update comment |
| Pull request | `supabase-validate.yml` | Rebuilds the local Supabase DB from migrations and lints the resulting public schema |
| Merge to main | `production.yml` | `tsc`, `eslint`, `eas update` to both the shared `main` preview stream and the existing `production` stream |
| Merge to main | Vercel (automatic) | `expo export --platform web` → deploys to Vercel |
| Merge to main | `supabase-deploy.yml` | Validates local replay + linked migration/schema parity, then deploys edge functions and runs migrations (triggers when `supabase/` paths change) |

## Preview Metrics

Expo currently gives you two levels of visibility:

- EAS Update already provides high-level adoption/usage signals from update requests
- `expo-insights` adds more precise app-launch usage metrics and app-version breakdowns in the Expo dashboard

Current setup:

- `expo-insights` is installed in this project
- metrics begin flowing after you create and install fresh native builds that include the package
- view them in Expo Dashboard → Project → Insights

Practical implication:

- rebuild and reinstall `preview-main` and `preview-pr` once after this change
- after that, the `FundLens Main` preview app is the right stream to monitor for friend/family/focus-group usage

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
  auth/            Sign in, confirm, and OAuth callback screens
  (tabs)/          Portfolio, Leaderboard, Wealth Journey (+ hidden Settings / legacy Compare routes)
  funds.tsx        Dedicated "Your Funds" screen
  fund/[id].tsx    Fund detail
  portfolio-insights.tsx  Portfolio composition detail screen
  onboarding/      CAS import flows
src/
  components/      Shared UI components
  hooks/           useSession, usePortfolio, useFundDetail, usePortfolioInsights, ...
  lib/             supabase.ts, queryClient.ts
  types/           database.types.ts (auto-generated), app.ts
  utils/           xirr.ts, formatCurrency.ts, cashflows.ts, filterToWindow.ts, authUtils.ts
supabase/
  functions/       Edge Functions: sync-nav, sync-index, cas-webhook, sync-fund-portfolios
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
| 8 | `milestone/8-google-login` | Google OAuth sign-in, account linking |
| 9 | `claude/portfolio-insights-feature-ciUhb` | Portfolio Insights: asset mix, market cap, sectors, top holdings |

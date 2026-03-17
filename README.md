# FundLens

Track your Indian mutual fund portfolio against benchmarks. Import from CAS, see XIRR, compare funds side-by-side.

---

## What works now (Milestone 1)

- App skeleton with Expo Router navigation (Home, Compare, Settings tabs)
- Magic link authentication via Supabase (sign in / sign out)
- Full database schema deployed to Supabase with user isolation + RLS
- EAS Build for Android APK internal distribution
- Vercel web deployment via GitHub integration
- CI/CD: typecheck + lint + EAS Update on every PR; production deploy on merge to main

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

**Required GitHub secrets:**
- `EXPO_TOKEN` — from expo.dev → Account Settings → Access Tokens
- `EXPO_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — your Supabase publishable key

---

## Project structure

```
app/               Expo Router screens
  _layout.tsx      Root layout: providers + auth gate
  auth/            Sign in + confirm screens
  (tabs)/          Home, Compare, Settings tabs
  fund/[id].tsx    Fund detail (Milestone 5)
  onboarding/      CAS import flows (Milestone 3)
src/
  hooks/           useSession — Supabase auth state
  lib/             supabase.ts, queryClient.ts
  types/           database.types.ts (auto-generated), app.ts
supabase/
  migrations/      SQL migrations
docs/
  plans/           ExecPlan documents per milestone
.github/workflows/ CI/CD
```

---

## Milestones

| # | Branch | Status |
|---|---|---|
| 1 | `milestone/1-foundation` | ✅ This PR |
| 2 | `milestone/2-data-pipeline` | Pending |
| 3 | `milestone/3-onboarding` | Pending |
| 4 | `milestone/4-home-screen` | Pending |
| 5 | `milestone/5-fund-detail` | Pending |
| 6 | `milestone/6-compare` | Pending |

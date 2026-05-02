# ExecPlan: Milestone 1 — Foundation + CI/CD

## Status
Complete

## Goal
Running app skeleton with:
- Expo Router navigation (Home, Compare, Settings + auth screens)
- Supabase Magic Link authentication with session persistence
- Full DB schema with user isolation (RLS on all user-owned tables)
- EAS Build internal distribution for Android APK testing
- Vercel web deployment via GitHub integration
- CI/CD: typecheck + lint + EAS Update on PRs; production deploy on merge

## Branch
`milestone/1-foundation` → targets `main`

## Deliverables

### App
- `app/_layout.tsx` — Root providers (QueryClient, SafeAreaProvider) + auth gate
- `app/auth/index.tsx` — Magic link email input
- `app/auth/confirm.tsx` — "Check your email" screen
- `app/(tabs)/` — Home, Compare, Settings stubs
- `app/fund/[id].tsx` — Fund detail stub
- `app/onboarding/` — CAS import flow stubs

### Auth
- `src/hooks/useSession.ts` — Wraps `supabase.auth.onAuthStateChange`
- Deep link scheme `foliolens://` in `app.json`
- Supabase Auth redirect URL: `foliolens://auth/confirm`

### Supabase
- `supabase/migrations/20260317000000_initial_schema.sql` — Full schema
- `src/types/database.types.ts` — Auto-generated from schema
- `src/lib/supabase.ts` — Typed client with AsyncStorage session persistence

### State management
- `src/lib/queryClient.ts` — TanStack Query with 5-min stale time

### Config
- `app.json` — Expo config (scheme, bundleIdentifier, web.bundler=metro)
- `tsconfig.json` — Strict mode, `@/*` alias
- `eslint.config.js` — eslint-config-expo flat config
- `.prettierrc` — Consistent formatting
- `eas.json` — development/preview/production build profiles
- `vercel.json` — Static web export config for Vercel

### CI/CD
- `.github/workflows/pr-preview.yml` — Typecheck → lint → EAS Update → QR comment
- `.github/workflows/production.yml` — Typecheck → lint → EAS Update to production

## Schema decisions

### User-owned tables (RLS enforced)
- `fund` — one row per fund per user; `unique(user_id, scheme_code)` prevents duplicates
- `transaction` — cashflow events; dedup via `unique(fund_id, date, type, units, amount)`
- `cas_import` — audit log of import attempts

### Global tables (read-only for auth users)
- `nav_history` — keyed by `scheme_code` (not `fund.id`) — shared across users
- `index_history` — benchmark index daily values
- `benchmark_mapping` — 25 AMFI category → benchmark index seed rows

### Key constraint
`nav_history` uses `scheme_code` (int, mfapi.in key), not `fund.id`, because NAV data is scheme-level and shared across all users who track the same fund. This avoids duplicating NAV rows per user.

## Env vars
- `EXPO_PUBLIC_SUPABASE_URL` — safe for JS bundle
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — replaces old anon key (new format: `sb_publishable_...`)
- `EXPO_TOKEN` — CI only, never in app bundle

## Risks addressed
- Magic link deep link: `foliolens://` scheme configured in `app.json` + Supabase allow-list
- Supabase new key format: using `PUBLISHABLE_KEY` not `ANON_KEY`
- Android testing: EAS `preview` profile with `buildType: apk` for direct install

## Validation
- `npm run typecheck` → zero errors
- `npm run lint` → zero warnings
- `npx expo start` → tabs navigate, auth gate redirects unauthenticated users
- `npx expo export --platform web` → builds without error
- Schema validated via `supabase db push` + type generation

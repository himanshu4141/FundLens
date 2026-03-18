# ExecPlan: Milestone 7 — Settings & Reliability Improvements


## Status
Complete


## Goal

Polish the app with a useful settings screen, smarter import entry point, and reliable data sync scheduling. Addresses operational gaps surfaced after Milestones 1–6 were deployed.


## User Value

- User can see their account details, KFintech email, and inbound address in one place without navigating through onboarding.
- "Import" on the home screen routes intelligently — straight to PDF upload for returning users, to onboarding for new users.
- NAV and index data syncs hourly on weekdays instead of once daily, so a single failed run doesn't cause stale data for the rest of the day.


## Context

Builds on all previous milestones. The app is fully functional end-to-end. This milestone adds quality-of-life improvements and operational reliability.


## Branch

`milestone/7-improvements` → targets `milestone/6-compare`


## Scope

- Improved settings screen showing: email, masked PAN, KFintech email (with edit link), inbound CAS address (copyable), PDF upload shortcut, sign out.
- Smart Import button on home screen: routes to `/onboarding/pdf` if `kfintech_email` is set, otherwise to `/onboarding`.
- Hourly cron schedules for `sync-nav` and `sync-index` (replacing daily-only schedules).
- pg_cron + pg_net extensions enabled via migration.


## Out of Scope

- Push notifications when sync completes.
- In-app fund management (add/remove funds manually).
- Account deletion.


## Approach

### Settings screen

Replaced the sign-out-only stub with a rich settings screen. Data sources:
- `useQuery(['user-profile'])` — fetches `user_profile` row for email, PAN, kfintech_email
- `useInboundSession(userId)` — fetches the user's CASParser inbound email address

Components:
- `maskPan()` — shows first 2 + last 2 characters, masks middle 6 (e.g. `AB****1234`)
- `CopyRow` — a row with a label, value, and copy button using `expo-clipboard`

### Smart Import button

```typescript
router.push(profile?.kfintech_email ? '/onboarding/pdf' : '/onboarding')
```

### Hourly cron

New migration `20260320000000_update_sync_schedules_hourly.sql`:
1. `cron.unschedule('sync-nav-daily')` and `cron.unschedule('sync-index-daily')`
2. Re-schedule as `sync-nav-hourly` (`0 * * * 1-5`) and `sync-index-hourly` (`5 * * * 1-5`)

Sync functions are idempotent (upsert with `ignoreDuplicates: true`) so hourly re-runs are safe.


## New Files

- `supabase/migrations/20260319000002_enable_cron_and_sync_schedules.sql` — enables pg_cron + pg_net, registers initial daily cron jobs
- `supabase/migrations/20260320000000_update_sync_schedules_hourly.sql` — updates to hourly schedule


## Modified Files

- `app/(tabs)/settings.tsx` — full rewrite from stub to rich settings screen
- `app/(tabs)/index.tsx` — smart Import button routing


## Validation

    # Confirm cron jobs are hourly
    SELECT jobname, schedule FROM cron.job ORDER BY jobname;
    # Expected:
    # sync-index-hourly | 5 * * * 1-5
    # sync-nav-hourly   | 0 * * * 1-5

    npm run typecheck   -- zero errors
    npm run lint        -- zero warnings

    # Settings screen: sign in, open Settings tab
    # → email shown, PAN masked, KFintech email shown (or "Not set")
    # → tap copy on inbound address → clipboard value matches
    # → tap "Edit" on KFintech email → navigates to /onboarding
    # → tap "Upload PDF" → navigates to /onboarding/pdf
    # → tap Sign Out → session cleared, redirected to auth screen

    # Smart import:
    # → with kfintech_email set: Import taps to /onboarding/pdf
    # → without kfintech_email: Import taps to /onboarding


## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| Hourly sync increases Supabase Edge Function invocations | Sync functions only upsert new rows; runs with no new data are near-instant. Acceptable for personal app scale. |
| pg_cron not enabled on project | Migration uses `CREATE EXTENSION IF NOT EXISTS` — safe to re-run. |
| `cron.unschedule` fails if job doesn't exist | Wrapped in a migration that only runs once; if the old job names don't exist the error is safe to ignore manually. |


## Decision Log

- **Hourly over daily** — one failed daily run loses the day's data. Hourly runs are resilient: the next run picks up any missed data. Sync functions are idempotent so duplicate runs have no side effects.
- **Settings screen over profile modal** — a dedicated tab is more discoverable than a modal; aligns with SCREENS.md navigation structure.
- **Smart Import routing** — avoids sending users who already completed onboarding back to the full setup flow. PDF upload is the most common repeat action after initial setup.


## Progress

- [x] Rewrite `app/(tabs)/settings.tsx` with full profile display
- [x] Add smart Import routing to `app/(tabs)/index.tsx`
- [x] Write `supabase/migrations/20260319000002_enable_cron_and_sync_schedules.sql`
- [x] Write `supabase/migrations/20260320000000_update_sync_schedules_hourly.sql`
- [x] Apply migrations to production DB
- [x] Verify cron jobs are hourly in `cron.job` table
- [x] `npm run typecheck` — zero errors
- [x] `npm run lint` — zero warnings

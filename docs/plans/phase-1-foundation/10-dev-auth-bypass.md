# ExecPlan: Dev Auth Bypass And Demo Portfolio

## Status
In progress

## Goal
Allow a developer or coding agent to sign into FundLens quickly in development without waiting for a magic-link email, then land in a seeded demo portfolio that exercises the main app flows.

## User Value
Today, local development depends on inbox access and a real portfolio. That slows implementation, makes autonomous testing hard, and couples routine UI checks to sensitive user data.

After this change, a developer can:

- seed a deterministic demo user and portfolio
- sign in through a dev-only shortcut on the auth screen
- validate Home, Fund Detail, Compare, Settings, and onboarding-adjacent behavior without touching a real portfolio

## Context
Production auth in FundLens is Supabase magic-link email auth. The app has no password login path today.

The safest shortcut is not a fake auth system. It is:

1. create a normal Supabase auth user for development only
2. seed portfolio data for that user
3. expose a sign-in-with-password shortcut only in local development and only when explicitly enabled

This keeps production auth untouched while removing inbox friction during local work.

## Assumptions
- The bypass is for local development, not production or public preview environments.
- Demo credentials live only in the developer's local `.env.local`.
- Seeding can rely on the Supabase service role key and direct database access from a local script.
- Demo funds can use synthetic scheme codes because this path is intended for local development only.

## Scope
- Add a dev-only sign-in shortcut to the auth screen.
- Add a local script to create or update a demo auth user and seed demo portfolio data.
- Add docs and env examples for using the dev path safely.
- Add a local-only ignored fixtures folder convention for private CAS validation work.

## Out of Scope
- Replacing magic-link auth in production.
- Using a real user portfolio as the default test dataset.
- End-to-end automation of private CAS uploads.
- Creating a staging-wide shared demo environment.

## Approach

### Dev auth path
- Gate the shortcut behind an explicit public env flag.
- Also require a local-development context before rendering the shortcut.
- Use Supabase `signInWithPassword` against a seeded demo user.

### Demo data
- Add a local Node script that:
  - creates the demo auth user if missing
  - resets that user's portfolio rows
  - inserts deterministic demo funds, transactions, NAV history, and benchmark history

### Private real-data validation
- Reserve `fixtures/private/` for local-only sensitive files.
- Ignore that directory in git so a developer can place a real CAMS CAS there without risking commits.

## Alternatives Considered

### Return sessions from a custom dev Edge Function
Rejected because it introduces a second auth mechanism and makes the security model harder to reason about.

### Commit a real portfolio fixture
Rejected because it creates unnecessary privacy and handling risk.

### Use anonymous auth
Rejected because the product uses user-owned RLS tables and the app benefits from testing against a stable seeded identity.

## Milestones

### M1 — Guardrails and UX
- Add a clearly labeled dev-only auth section to the sign-in screen.
- Keep magic-link as the default and only production path.

### M2 — Seed script
- Add a script that creates a demo user and inserts deterministic demo portfolio data.
- Make it safe to re-run.

### M3 — Documentation
- Document env vars, usage, and safety constraints.
- Note the private fixture path.

### M4 — Validation
- Run typecheck and lint.
- Run the seed script in dry expectations or documented mode.

## Validation
- `npm run typecheck`
- `npm run lint`
- `node scripts/seed-demo-user.mjs` with valid env should complete successfully
- with dev env enabled locally, auth screen should show the dev sign-in shortcut

## Risks And Mitigations
- Risk: dev shortcut leaks into production UI
  Mitigation: require explicit env flag and local-dev context
- Risk: demo credentials get committed
  Mitigation: keep them out of tracked files; document `.env.local` usage only
- Risk: seeded data drifts or becomes hard to reset
  Mitigation: make the seed script idempotent and destructive only for the demo user

## Decision Log
- 2026-03-21: Chose seeded email/password auth over a custom bypass token flow to stay inside standard Supabase auth behavior.
- 2026-03-21: Kept the feature local-development-only rather than preview-wide to minimize accidental exposure.

## Progress
- [x] Review current auth flow and insertion points
- [x] Write ExecPlan
- [x] Implement dev-only auth shortcut
- [x] Implement demo seeding script
- [x] Update docs and ignored private fixture path
- [x] Run `npm run typecheck`
- [x] Run `npm run lint`
- [ ] Run `npm run seed:demo` with local demo env configured
